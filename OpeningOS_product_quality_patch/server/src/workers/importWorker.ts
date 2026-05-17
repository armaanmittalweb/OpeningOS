import { query } from '../db.js';
import { fetchChessComGames, fetchLichessGames } from '../services/importers.js';

export async function processImportJob(id: string) {
  const r = await query<any>('select * from import_jobs where id=$1', [id]);
  const job = r.rows[0];
  if (!job) return null;
  await query('update import_jobs set status=$1, updated_at=now() where id=$2', ['running', id]);
  try {
    let pgns: string[] = [];
    if (job.source === 'lichess') pgns = await fetchLichessGames(job.payload.username, job.payload.max || 50);
    else if (job.source === 'chesscom') pgns = await fetchChessComGames(job.payload.username, job.payload.max || 50);
    else if (job.source === 'pgn') pgns = [job.payload.pgn || ''].filter(Boolean);
    else pgns = [];
    await query('update import_jobs set status=$1, result=$2, updated_at=now() where id=$3', ['complete', { pgns, count: pgns.length }, id]);
    return { id, status: 'complete', pgns };
  } catch (err: any) {
    await query('update import_jobs set status=$1, error=$2, updated_at=now() where id=$3', ['failed', String(err?.message || err), id]);
    throw err;
  }
}
