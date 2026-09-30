/**
 * The OpeningOS sync API. It stores one opaque, client-encrypted snapshot per
 * sync phrase and hands it back; it cannot read what it stores.
 *
 *   GET    /sync/:id   -> { version, data, updatedAt } | 404
 *   PUT    /sync/:id   If-Match: "<version you last saw>" ("0" creates)
 *                      body { data: { v: 1, iv, ct } }
 *                      -> { version } | 409 { version } when someone else wrote first
 *   DELETE /sync/:id   -> 204 | 404
 *
 * Writes are optimistic: the UPDATE only matches the row at the version the
 * client last saw, so two devices writing at once cannot both win.
 */
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { Queryable } from './db';

/** The Workers rate limiting binding (declared in wrangler.jsonc). */
export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Bindings {
  DATABASE_URL: string;
  ALLOWED_ORIGINS?: string;
  MAX_TABLE_BYTES?: string;
  LIMITER?: Limiter;
}

export const MAX_BODY_BYTES = 1_048_576;
export const DEFAULT_MAX_TABLE_BYTES = 400_000_000;
export const PRUNE_AFTER_DAYS = 365;

const ID = /^[0-9a-f]{64}$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

type Env = { Bindings: Bindings };

interface SnapshotRow {
  version: number;
  data: string;
  updated_at: Date | string;
}

const fail = (c: Context<Env>, status: 400 | 404 | 409 | 413 | 428 | 429 | 507, error: string, extra: object = {}) =>
  c.json({ error, ...extra }, status);

function envelopeOf(body: unknown): { v: 1; iv: string; ct: string } | null {
  const data = (body as { data?: unknown } | null)?.data as { v?: unknown; iv?: unknown; ct?: unknown } | undefined;
  if (!data || data.v !== 1 || typeof data.iv !== 'string' || typeof data.ct !== 'string') return null;
  if (!B64.test(data.iv) || !B64.test(data.ct)) return null;
  return { v: 1, iv: data.iv, ct: data.ct };
}

async function currentVersion(db: Queryable, id: string): Promise<number> {
  const rows = await db.query<{ version: number }>('select version from snapshots where id = $1', [id]);
  return rows[0] ? Number(rows[0].version) : 0;
}

export function createApp(db: (env: Bindings) => Queryable) {
  const app = new Hono<Env>();

  app.use('*', async (c, next) => {
    const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
    return cors({
      origin: (origin) => (allowed.includes(origin) ? origin : null),
      allowMethods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'If-Match'],
      maxAge: 86400,
    })(c, next);
  });

  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  app.get('/health', (c) => c.json({ ok: true }));

  app.use('/sync/*', async (c, next) => {
    if (c.req.method === 'OPTIONS' || !c.env.LIMITER) return next();
    const { success } = await c.env.LIMITER.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' });
    if (!success) return fail(c, 429, 'Too many sync requests. Try again in a minute.');
    return next();
  });

  app.use('/sync/:id', async (c, next) => {
    if (!ID.test(c.req.param('id'))) return fail(c, 400, 'A sync id is 64 lowercase hex characters.');
    return next();
  });

  app.get('/sync/:id', async (c) => {
    const rows = await db(c.env).query<SnapshotRow>('select version, data, updated_at from snapshots where id = $1', [c.req.param('id')]);
    const row = rows[0];
    if (!row) return fail(c, 404, 'Nothing is synced under this phrase.');
    return c.json({ version: Number(row.version), data: JSON.parse(row.data), updatedAt: new Date(row.updated_at).toISOString() });
  });

  app.put('/sync/:id', async (c) => {
    const id = c.req.param('id');
    const match = /^"?(\d{1,9})"?$/.exec(c.req.header('If-Match') ?? '');
    if (!match) return fail(c, 428, 'Send If-Match with the version you last saw ("0" to create).');
    const base = Number(match[1]);

    if (Number(c.req.header('Content-Length') ?? 0) > MAX_BODY_BYTES) return fail(c, 413, 'The snapshot is larger than 1 MB.');
    const text = await c.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return fail(c, 413, 'The snapshot is larger than 1 MB.');

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return fail(c, 400, 'The body is not JSON.');
    }
    const envelope = envelopeOf(body);
    if (!envelope) return fail(c, 400, 'Expected { data: { v: 1, iv, ct } } with base64 iv and ct.');
    const data = JSON.stringify(envelope);
    const conn = db(c.env);

    if (base === 0) {
      const cap = Number(c.env.MAX_TABLE_BYTES) || DEFAULT_MAX_TABLE_BYTES;
      const [size] = await conn.query<{ bytes: string | number }>("select pg_total_relation_size('snapshots') as bytes");
      if (Number(size?.bytes ?? 0) >= cap) return fail(c, 507, 'Sync is full for now; new phrases are paused. Existing ones still work.');
      const rows = await conn.query<{ version: number }>(
        'insert into snapshots (id, version, data) values ($1, 1, $2) on conflict (id) do nothing returning version',
        [id, data],
      );
      if (!rows[0]) return fail(c, 409, 'Another device has already synced under this phrase.', { version: await currentVersion(conn, id) });
      return c.json({ version: 1 });
    }

    const rows = await conn.query<{ version: number }>(
      'update snapshots set data = $2, version = version + 1, updated_at = now() where id = $1 and version = $3 returning version',
      [id, data, base],
    );
    if (!rows[0]) return fail(c, 409, 'Another device has synced since this one last did.', { version: await currentVersion(conn, id) });
    return c.json({ version: Number(rows[0].version) });
  });

  app.delete('/sync/:id', async (c) => {
    const rows = await db(c.env).query('delete from snapshots where id = $1 returning id', [c.req.param('id')]);
    if (!rows[0]) return fail(c, 404, 'Nothing is synced under this phrase.');
    return c.body(null, 204);
  });

  app.notFound((c) => c.json({ error: 'Not found.' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'The sync server hit an error.' }, 500);
  });

  return app;
}

/** Deletes snapshots nobody has written for PRUNE_AFTER_DAYS. Returns how many. */
export async function prune(db: Queryable): Promise<number> {
  const rows = await db.query(`delete from snapshots where updated_at < now() - interval '${PRUNE_AFTER_DAYS} days' returning id`);
  return rows.length;
}
