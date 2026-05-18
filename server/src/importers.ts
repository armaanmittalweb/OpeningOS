import { query } from './db.js';

export type ImportJob = { id: string; user_id: string; source: string; payload: any };

type NormalizedGame = {
  id?: string;
  source: string;
  sourceGameId?: string;
  url?: string;
  pgn: string;
  white?: string;
  black?: string;
  result?: string;
  date?: string;
  rated?: boolean;
  timeControl?: string;
  timeClass?: string;
  eco?: string;
  opening?: string;
  headers?: Record<string, string>;
};

async function fetchText(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    if (res.status === 404) throw new Error('The profile was not found or has no public games.');
    if (res.status === 429) throw new Error('The game service is rate-limiting requests. Try again later.');
    if (res.status === 403) throw new Error('The profile is private or unavailable.');
    throw new Error(`Import fetch failed ${res.status}: ${text || res.statusText}`);
  }
  return text;
}

function pgnTag(name: string, value: unknown) {
  const clean = String(value == null || value === '' ? '?' : value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[${name} "${clean}"]`;
}

function chesscomGameToPgn(g: any, username: string) {
  if (g.pgn) return String(g.pgn);
  const white = g.white?.username || 'White';
  const black = g.black?.username || 'Black';
  const result = g.white?.result === 'win' ? '1-0' : g.black?.result === 'win' ? '0-1' : '1/2-1/2';
  const tags = [
    pgnTag('Event', 'Chess.com game'), pgnTag('Site', g.url || 'Chess.com'), pgnTag('Date', g.end_time ? new Date(g.end_time * 1000).toISOString().slice(0, 10).replace(/-/g, '.') : '????.??.??'),
    pgnTag('White', white), pgnTag('Black', black), pgnTag('Result', result), pgnTag('TimeControl', g.time_control || g.time_class || '?')
  ];
  return `${tags.join('\n')}\n\n*`;
}

function normalizeChesscomGame(g: any, username: string): NormalizedGame {
  const pgn = chesscomGameToPgn(g, username);
  return {
    id: g.uuid || g.url,
    source: 'chesscom',
    sourceGameId: g.uuid,
    url: g.url,
    pgn,
    white: g.white?.username,
    black: g.black?.username,
    result: g.white?.result === 'win' ? '1-0' : g.black?.result === 'win' ? '0-1' : '1/2-1/2',
    date: g.end_time ? new Date(g.end_time * 1000).toISOString() : undefined,
    rated: !!g.rated,
    timeControl: g.time_control,
    timeClass: g.time_class,
    headers: { Site: g.url || 'Chess.com', TimeControl: g.time_control || g.time_class || '?' },
  };
}

function lichessJsonToPgn(o: any, username: string) {
  if (o.pgn) return String(o.pgn);
  const white = o.players?.white?.user?.name || o.players?.white?.userId || 'White';
  const black = o.players?.black?.user?.name || o.players?.black?.userId || 'Black';
  const result = o.status === 'draw' ? '1/2-1/2' : o.winner === 'white' ? '1-0' : o.winner === 'black' ? '0-1' : '*';
  const tags = [
    pgnTag('Event', 'Lichess game'), pgnTag('Site', o.id ? `https://lichess.org/${o.id}` : 'Lichess'), pgnTag('Date', o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10).replace(/-/g, '.') : '????.??.??'),
    pgnTag('White', white), pgnTag('Black', black), pgnTag('Result', result), pgnTag('TimeControl', o.speed || o.clock?.initial || '?'), pgnTag('ECO', o.opening?.eco || '?'), pgnTag('Opening', o.opening?.name || '?')
  ];
  return `${tags.join('\n')}\n\n${o.moves || '*'} ${result}`;
}

function normalizeLichessGame(o: any, username: string): NormalizedGame {
  const pgn = lichessJsonToPgn(o, username);
  return {
    id: o.id,
    source: 'lichess',
    sourceGameId: o.id,
    url: o.id ? `https://lichess.org/${o.id}` : undefined,
    pgn,
    white: o.players?.white?.user?.name || o.players?.white?.userId,
    black: o.players?.black?.user?.name || o.players?.black?.userId,
    result: o.status === 'draw' ? '1/2-1/2' : o.winner === 'white' ? '1-0' : o.winner === 'black' ? '0-1' : '*',
    date: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
    rated: !!o.rated,
    timeClass: o.speed,
    eco: o.opening?.eco,
    opening: o.opening?.name,
    headers: { Site: o.id ? `https://lichess.org/${o.id}` : 'Lichess', ECO: o.opening?.eco || '', Opening: o.opening?.name || '' },
  };
}

function parseNdjson(text: string) {
  return String(text || '').split(/\n+/).map(line => {
    try { return line.trim() ? JSON.parse(line) : null; } catch { return null; }
  }).filter(Boolean);
}

export async function runImportJob(job: ImportJob) {
  const payload = job.payload || {};
  const startedAt = new Date().toISOString();
  if (job.source === 'pgn') {
    return { source: 'pgn', games: [{ source: 'pgn', pgn: String(payload.pgn || ''), headers: payload.headers || {} }], importedAt: startedAt, summary: { fetched: 1, normalized: 1 } };
  }
  if (job.source === 'lichess') {
    const username = String(payload.username || '').trim();
    if (!username) throw new Error('Lichess username is required.');
    const max = Math.min(300, Math.max(1, Number(payload.max || payload.limit || 50)));
    const since = payload.since ? `&since=${encodeURIComponent(String(payload.since))}` : '';
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&opening=true&moves=true&pgnInJson=true&clocks=false&evals=false${since}`;
    const headers: Record<string, string> = { Accept: 'application/x-ndjson' };
    if (process.env.LICHESS_TOKEN) headers.Authorization = `Bearer ${process.env.LICHESS_TOKEN}`;
    const ndjson = await fetchText(url, headers);
    const rows = parseNdjson(ndjson);
    const games = rows.map(o => normalizeLichessGame(o, username)).filter(g => g.pgn);
    return { source: 'lichess', username, games, rawCount: rows.length, importedAt: startedAt, summary: { fetched: rows.length, normalized: games.length } };
  }
  if (job.source === 'chesscom') {
    const username = String(payload.username || '').trim().toLowerCase();
    if (!username) throw new Error('Chess.com username is required.');
    const max = Math.min(300, Math.max(1, Number(payload.max || payload.limit || 50)));
    const archivesRaw = await fetchText(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`, { 'User-Agent': process.env.CHESSCOM_USER_AGENT || 'OpeningOS/1.0 (contact: support@openingos.app)' });
    const archives = JSON.parse(archivesRaw).archives || [];
    const selected = archives.slice().reverse();
    const games: NormalizedGame[] = [];
    let scannedArchives = 0;
    for (const archive of selected) {
      if (games.length >= max) break;
      const txt = await fetchText(archive, { 'User-Agent': process.env.CHESSCOM_USER_AGENT || 'OpeningOS/1.0 (contact: support@openingos.app)' });
      scannedArchives++;
      const json = JSON.parse(txt);
      for (const game of (json.games || []).slice().reverse()) {
        if (games.length >= max) break;
        const normalized = normalizeChesscomGame(game, username);
        if (normalized.pgn) games.push(normalized);
      }
    }
    return { source: 'chesscom', username, games, importedAt: startedAt, summary: { archives: scannedArchives, fetched: games.length, normalized: games.length, requested: max } };
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
