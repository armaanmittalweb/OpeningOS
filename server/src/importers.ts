import { query } from './db.js';

export type ImportJob = { id: string; user_id: string; source: string; payload: any };

async function fetchText(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Import fetch failed ${res.status}: ${await res.text()}`);
  return res.text();
}

export async function runImportJob(job: ImportJob) {
  const payload = job.payload || {};
  if (job.source === 'pgn') {
    return { games: [{ pgn: String(payload.pgn || ''), headers: payload.headers || {} }], importedAt: new Date().toISOString() };
  }
  if (job.source === 'lichess') {
    const username = String(payload.username || '').trim();
    if (!username) throw new Error('Lichess username is required.');
    const max = Math.min(200, Number(payload.max || 50));
    const since = payload.since ? `&since=${encodeURIComponent(String(payload.since))}` : '';
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=false&opening=true&moves=true${since}`;
    const headers: Record<string, string> = { Accept: 'application/x-ndjson' };
    if (process.env.LICHESS_TOKEN) headers.Authorization = `Bearer ${process.env.LICHESS_TOKEN}`;
    const ndjson = await fetchText(url, headers);
    return { source: 'lichess', username, raw: ndjson, format: 'ndjson', importedAt: new Date().toISOString() };
  }
  if (job.source === 'chesscom') {
    const username = String(payload.username || '').trim().toLowerCase();
    if (!username) throw new Error('Chess.com username is required.');
    const archivesRaw = await fetchText(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`, { 'User-Agent': process.env.CHESSCOM_USER_AGENT || 'OpeningOS/1.0' });
    const archives = JSON.parse(archivesRaw).archives || [];
    const selected = archives.slice(-Math.min(6, Number(payload.months || 3)));
    const games: any[] = [];
    for (const archive of selected) {
      const txt = await fetchText(archive, { 'User-Agent': process.env.CHESSCOM_USER_AGENT || 'OpeningOS/1.0' });
      const json = JSON.parse(txt);
      games.push(...(json.games || []));
    }
    return { source: 'chesscom', username, games, importedAt: new Date().toISOString() };
  }
  throw new Error(`Unsupported import source: ${job.source}`);
}

export async function claimNextImportJob(workerId: string): Promise<ImportJob | null> {
  const res = await query<ImportJob>(`
    update import_jobs set status='running', locked_at=now(), locked_by=$1, attempts=attempts+1, updated_at=now()
    where id = (
      select id from import_jobs
      where status='queued' or (status='running' and locked_at < now() - interval '10 minutes')
      order by priority asc, created_at asc
      limit 1 for update skip locked
    ) returning id, user_id, source, payload`, [workerId]);
  return res.rows[0] || null;
}

export async function completeImportJob(jobId: string, result: unknown) {
  await query('update import_jobs set status=$2, result=$3, error=null, updated_at=now() where id=$1', [jobId, 'complete', result]);
}

export async function failImportJob(jobId: string, error: unknown) {
  await query('update import_jobs set status=$2, error=$3, updated_at=now() where id=$1', [jobId, 'failed', String((error as any)?.message || error)]);
}
