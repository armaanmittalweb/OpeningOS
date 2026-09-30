import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deriveId, deriveKey, open, seal, SyncClient, SyncConflict } from '../../src/lib/sync';
import { createApp, MAX_BODY_BYTES, prune, type Bindings, type Limiter } from '../src/app';
import { freshPglite, pgliteDb } from './helpers';

const ID = 'a'.repeat(64);
const ENV: Bindings = { DATABASE_URL: 'unused', ALLOWED_ORIGINS: 'https://openingos.amittal.dev,http://localhost:5174' };
const envelope = { v: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'c2VhbGVk' };

let pg: PGlite;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  pg = await freshPglite();
  const db = pgliteDb(pg);
  app = createApp(() => db);
});

beforeEach(async () => {
  await pg.exec('truncate snapshots');
});

const put = (version: number | null, body: unknown = { data: envelope }, env: Bindings = ENV, id = ID) =>
  app.request(
    `/sync/${id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(version === null ? {} : { 'If-Match': `"${version}"` }) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    env,
  );
const get = (id = ID) => app.request(`/sync/${id}`, {}, ENV);

describe('snapshots', () => {
  it('404s before anything is synced', async () => {
    expect((await get()).status).toBe(404);
  });

  it('creates at version 1 and returns what was stored', async () => {
    const res = await put(0);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 1 });
    const body = (await (await get()).json()) as { version: number; data: unknown; updatedAt: string };
    expect(body.version).toBe(1);
    expect(body.data).toEqual(envelope);
    expect(Number.isNaN(Date.parse(body.updatedAt))).toBe(false);
  });

  it('bumps the version on each write from the current version', async () => {
    await put(0);
    expect(await (await put(1)).json()).toEqual({ version: 2 });
    expect(await (await put(2)).json()).toEqual({ version: 3 });
  });

  it('answers 409 with the current version to a stale write', async () => {
    await put(0);
    await put(1);
    const res = await put(1);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ version: 2 });
  });

  it('answers 409 to a create when the phrase is already in use', async () => {
    await put(0);
    const res = await put(0);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ version: 1 });
  });

  it('lets exactly one of two writes from the same version win', async () => {
    await put(0);
    const results = await Promise.all([put(1), put(1)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('deletes, then 404s', async () => {
    await put(0);
    const del = await app.request(`/sync/${ID}`, { method: 'DELETE' }, ENV);
    expect(del.status).toBe(204);
    expect((await get()).status).toBe(404);
    expect((await app.request(`/sync/${ID}`, { method: 'DELETE' }, ENV)).status).toBe(404);
  });

  it('stores only the envelope fields', async () => {
    await put(0, { data: { ...envelope, extra: 'x' }, other: 1 });
    const [row] = (await pg.query<{ data: string }>('select data from snapshots')).rows;
    expect(JSON.parse(row!.data)).toEqual(envelope);
  });
});

describe('validation', () => {
  it('rejects ids that are not 64 lowercase hex characters', async () => {
    expect((await get('abc')).status).toBe(400);
    expect((await get('A'.repeat(64))).status).toBe(400);
    expect((await put(0, undefined, ENV, 'g'.repeat(64))).status).toBe(400);
  });

  it('requires If-Match on PUT', async () => {
    expect((await put(null)).status).toBe(428);
  });

  it('rejects bodies over 1 MB', async () => {
    const big = { data: { ...envelope, ct: 'A'.repeat(MAX_BODY_BYTES) } };
    expect((await put(0, big)).status).toBe(413);
  });

  it('rejects bodies that are not an envelope', async () => {
    expect((await put(0, 'not json')).status).toBe(400);
    expect((await put(0, { data: { v: 2, iv: 'AA', ct: 'AA' } })).status).toBe(400);
    expect((await put(0, { data: { v: 1, iv: 'not base64!', ct: 'AA' } })).status).toBe(400);
    expect((await put(0, { data: 'plaintext' })).status).toBe(400);
  });
});

describe('limits', () => {
  it('answers 429 when the rate limiter says no', async () => {
    const LIMITER: Limiter = { limit: async () => ({ success: false }) };
    const res = await put(0, undefined, { ...ENV, LIMITER });
    expect(res.status).toBe(429);
    expect((await app.request('/health', {}, { ...ENV, LIMITER })).status).toBe(200);
  });

  it('pauses new phrases when the table is full, but keeps existing ones working', async () => {
    await put(0);
    const full = { ...ENV, MAX_TABLE_BYTES: '1' };
    expect((await put(0, undefined, full, 'b'.repeat(64))).status).toBe(507);
    expect((await put(1, undefined, full)).status).toBe(200);
  });

  it('prunes snapshots not written for a year', async () => {
    await put(0);
    await put(0, undefined, ENV, 'b'.repeat(64));
    await pg.query(`update snapshots set updated_at = now() - interval '400 days' where id = $1`, [ID]);
    expect(await prune(pgliteDb(pg))).toBe(1);
    expect((await get()).status).toBe(404);
    expect((await get('b'.repeat(64))).status).toBe(200);
  });
});

describe('CORS', () => {
  it('allows the listed origins and nobody else', async () => {
    const ok = await app.request('/health', { headers: { Origin: 'https://openingos.amittal.dev' } }, ENV);
    const no = await app.request('/health', { headers: { Origin: 'https://evil.example' } }, ENV);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://openingos.amittal.dev');
    expect(no.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows If-Match in preflight', async () => {
    const res = await app.request(
      `/sync/${ID}`,
      { method: 'OPTIONS', headers: { Origin: 'http://localhost:5174', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'if-match,content-type' } },
      ENV,
    );
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('if-match');
  });
});

describe('with the app’s own sync client', () => {
  const client = () =>
    new SyncClient('https://sync.test', (input, init) => Promise.resolve(app.request(String(input).replace('https://sync.test', ''), init, ENV)));

  it('round-trips an encrypted snapshot and detects a conflict', async () => {
    const phrase = 'abandon ability able about above absent';
    const [id, key] = await Promise.all([deriveId(phrase), deriveKey(phrase)]);
    const data = { v: 1, updatedAt: 1, lines: ['e4 e5 Nf3'] };

    expect(await client().get(id)).toBeNull();
    const v1 = await client().put(id, 0, await seal(key, data));
    expect(v1).toBe(1);

    const remote = await client().get(id);
    expect(remote?.version).toBe(1);
    expect(await open(key, remote!.data)).toEqual(data);

    // The server holds ciphertext only.
    const [row] = (await pg.query<{ data: string }>('select data from snapshots')).rows;
    expect(row!.data).not.toContain('e4 e5');

    await client().put(id, 1, await seal(key, { ...data, updatedAt: 2 }));
    await expect(client().put(id, 1, await seal(key, data))).rejects.toBeInstanceOf(SyncConflict);

    await client().remove(id);
    expect(await client().get(id)).toBeNull();
  });
});

describe('internal routes', () => {
  const KEY = 'internal-test-key';
  const withKey = { ...ENV, INTERNAL_KEY: KEY };
  const call = (path: string, init: RequestInit = {}, env: Bindings = withKey) => app.request(path, init, env);

  it('404s without the key, with a wrong key, or when no key is configured', async () => {
    expect((await call('/internal/stats')).status).toBe(404);
    expect((await call('/internal/stats', { headers: { 'x-internal-key': 'nope' } })).status).toBe(404);
    expect((await call('/internal/stats', { headers: { 'x-internal-key': KEY } }, ENV)).status).toBe(404);
  });

  it('reports counts and sizes, and prunes on request', async () => {
    await put(0);
    const stats = (await (await call('/internal/stats', { headers: { 'x-internal-key': KEY } })).json()) as Record<string, number>;
    expect(stats).toMatchObject({ snapshots: 1, written24h: 1, active30d: 1 });
    expect(stats.tableBytes).toBeGreaterThan(0);
    expect(stats.maxTableBytes).toBeGreaterThan(stats.tableBytes);
    const res = await call('/internal/prune', { method: 'POST', headers: { 'x-internal-key': KEY } });
    expect(await res.json()).toEqual({ deleted: 0 });
  });
});
