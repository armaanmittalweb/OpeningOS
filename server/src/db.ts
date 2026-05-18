import pg from 'pg';
const { Pool } = pg;

type DbSslConfig = false | { rejectUnauthorized: boolean; ca?: string };

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function buildDatabaseConfig() {
  const raw = process.env.DATABASE_URL || '';
  const pgSslMode = String(process.env.PGSSLMODE || '').toLowerCase();
  const forceSsl = envBool('DATABASE_SSL', false);
  const keepSslParams = envBool('DATABASE_KEEP_SSL_QUERY_PARAMS', false);
  const hostLooksManaged = /\.db\.ondigitalocean\.com$/i.test(safeHost(raw)) || /ondigitalocean\.com/i.test(raw);
  const urlMode = readUrlParam(raw, 'sslmode').toLowerCase();
  const urlWantsSsl = ['require', 'prefer', 'verify-ca', 'verify-full', 'no-verify'].includes(urlMode);
  const envWantsSsl = ['require', 'prefer', 'verify-ca', 'verify-full', 'no-verify'].includes(pgSslMode);
  const sslRequested = forceSsl || hostLooksManaged || urlWantsSsl || envWantsSsl;

  // node-postgres warns that SSL-related URL parameters can override the explicit
  // ssl object. For DigitalOcean we want one clear source of truth, so strip the
  // query SSL knobs and pass the TLS options directly below.
  const connectionString = keepSslParams ? raw : stripPgSslParams(raw);

  const ca = process.env.DATABASE_SSL_CA || process.env.PGSSLROOTCERT_INLINE || '';
  const defaultRejectUnauthorized = ca ? true : false;
  const rejectUnauthorized = envBool('DATABASE_SSL_REJECT_UNAUTHORIZED', defaultRejectUnauthorized);
  const ssl: DbSslConfig = sslRequested ? { rejectUnauthorized, ...(ca ? { ca } : {}) } : false;

  return {
    connectionString,
    ssl,
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 15000),
    application_name: process.env.DATABASE_APPLICATION_NAME || 'openingos-api',
  };
}

function safeHost(raw: string): string {
  try { return new URL(raw).hostname || ''; } catch { return ''; }
}

function readUrlParam(raw: string, key: string): string {
  try { return new URL(raw).searchParams.get(key) || ''; } catch { return ''; }
}

function stripPgSslParams(raw: string): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return raw.replace(/[?&](sslmode|sslcert|sslkey|sslrootcert)=[^&]*/gi, (match, _k, offset, str) => {
      const first = match.startsWith('?');
      const hasMore = str.slice(offset + match.length).startsWith('&');
      return first && hasMore ? '?' : '';
    });
  }
}

export const pool = new Pool(buildDatabaseConfig());

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  return pool.query(text, params) as Promise<{ rows: T[] }>;
}
export async function withUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await query('select set_config($1,$2,true)', ['app.current_user_id', userId]);
  return fn();
}
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
