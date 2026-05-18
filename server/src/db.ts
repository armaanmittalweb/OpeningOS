import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || '';
const sslRequested = /sslmode=require/i.test(connectionString) || String(process.env.PGSSLMODE || '').toLowerCase() === 'require';
const rejectUnauthorized = String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() === 'true';

export const pool = new Pool({
  connectionString,
  ssl: sslRequested ? { rejectUnauthorized } : undefined,
});

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
