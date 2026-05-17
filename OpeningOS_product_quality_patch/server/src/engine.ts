import { spawn } from 'node:child_process';
import { query } from './db.js';

export type AnalysisJob = { id: string; user_id: string; kind: string; payload: any };

function materialHeuristic(fen: string) {
  const board = fen.split(' ')[0] || '';
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let score = 0;
  for (const ch of board) {
    const v = values[ch.toLowerCase()];
    if (v === undefined) continue;
    score += ch === ch.toUpperCase() ? v : -v;
  }
  return { cp: Math.round(score * 100), source: 'material-fallback' };
}

export async function analyseFenWithStockfish(fen: string, depth = Number(process.env.ENGINE_NODE_DEPTH || 12)): Promise<any> {
  const path = process.env.STOCKFISH_PATH || 'stockfish';
  return new Promise((resolve) => {
    const child = spawn(path, [], { stdio: 'pipe' });
    let best = '';
    let score: any = null;
    const timer = setTimeout(() => { child.kill(); resolve({ ...materialHeuristic(fen), warning: 'engine-timeout' }); }, 8000);
    child.stdout.on('data', (buf) => {
      const text = String(buf);
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/score (cp|mate) (-?\d+)/);
        if (m) score = { type: m[1], value: Number(m[2]) };
        const bm = line.match(/^bestmove\s+(\S+)/);
        if (bm) {
          best = bm[1];
          clearTimeout(timer);
          child.kill();
          resolve({ source: 'stockfish', depth, bestMove: best, score });
        }
      }
    });
    child.on('error', () => { clearTimeout(timer); resolve({ ...materialHeuristic(fen), warning: 'stockfish-not-available' }); });
    child.stdin.write('uci\n');
    child.stdin.write(`position fen ${fen}\n`);
    child.stdin.write(`go depth ${depth}\n`);
  });
}

export async function openingExplorer(positionFen: string): Promise<any> {
  const url = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(positionFen)}&moves=12`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Explorer failed ${res.status}`);
  return res.json();
}

export async function runAnalysisJob(job: AnalysisJob) {
  const payload = job.payload || {};
  if (job.kind === 'engine') return analyseFenWithStockfish(String(payload.fen || ''), Number(payload.depth || process.env.ENGINE_NODE_DEPTH || 12));
  if (job.kind === 'opening-explorer') return openingExplorer(String(payload.fen || ''));
  if (job.kind === 'novelty') {
    const explorer = await openingExplorer(String(payload.fen || ''));
    return { novelty: !(explorer.moves || []).length, explorer };
  }
  if (job.kind === 'repertoire-quality') {
    const fens = payload.fens || [];
    const results = [];
    for (const fen of fens.slice(0, 20)) results.push({ fen, analysis: await analyseFenWithStockfish(fen, Number(payload.depth || 10)) });
    return { results };
  }
  throw new Error(`Unsupported analysis kind: ${job.kind}`);
}

export async function claimNextAnalysisJob(workerId: string): Promise<AnalysisJob | null> {
  const res = await query<AnalysisJob>(`
    update analysis_jobs set status='running', locked_at=now(), locked_by=$1, attempts=attempts+1, updated_at=now()
    where id = (
      select id from analysis_jobs
      where status='queued' or (status='running' and locked_at < now() - interval '10 minutes')
      order by priority asc, created_at asc limit 1 for update skip locked
    ) returning id, user_id, kind, payload`, [workerId]);
  return res.rows[0] || null;
}

export async function completeAnalysisJob(jobId: string, result: unknown) {
  await query('update analysis_jobs set status=$2, result=$3, error=null, updated_at=now() where id=$1', [jobId, 'complete', result]);
}

export async function failAnalysisJob(jobId: string, error: unknown) {
  await query('update analysis_jobs set status=$2, error=$3, updated_at=now() where id=$1', [jobId, 'failed', String((error as any)?.message || error)]);
}
