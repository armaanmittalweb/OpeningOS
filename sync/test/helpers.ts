import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { Queryable } from '../src/db';

export const schemaSql = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

/** Adapts PGlite (single connection, in-process) to the Worker's Queryable. */
export function pgliteDb(pg: PGlite): Queryable {
  return { query: async (text, params) => (await pg.query(text, params)).rows as any[] };
}

export async function freshPglite(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(schemaSql);
  return pg;
}
