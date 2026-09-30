import { neon } from '@neondatabase/serverless';

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Neon over HTTP: every statement here is a single query (the conditional
 * writes are one UPDATE or INSERT each), so no transaction or WebSocket is needed.
 */
export function neonDb(connectionString: string): Queryable {
  const sql = neon(connectionString);
  return { query: (text, params) => sql.query(text, params) as Promise<any[]> };
}
