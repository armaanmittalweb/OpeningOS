import { spawn } from 'node:child_process';
import { env } from '../config.js';

export type EngineResult = { bestMove?: string; evalCp?: number; mate?: number; depth?: number; source: 'stockfish' | 'heuristic'; lines?: string[]; warning?: string };

export async function analyzeFen(fen: string, opts: { depth?: number; movetimeMs?: number } = {}): Promise<EngineResult> {
  if (env.STOCKFISH_CMD) return analyzeWithStockfish(fen, opts).catch(err => heuristic(fen, String(err?.message || err)));
  return heuristic(fen, 'STOCKFISH_CMD not configured; used safe heuristic fallback.');
}

function heuristic(fen: string, warning?: string): EngineResult {
  const pieces = fen.split(' ')[0];
  const values: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  let score = 0;
  for (const ch of pieces) {
    const v = values[ch.toLowerCase()] || 0;
    if (!v) continue;
    score += ch === ch.toUpperCase() ? v : -v;
  }
  return { evalCp: score, depth: 0, source: 'heuristic', warning };
}

function analyzeWithStockfish(fen: string, opts: { depth?: number; movetimeMs?: number }): Promise<EngineResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(env.STOCKFISH_CMD as string, [], { stdio: 'pipe' });
    let out = '';
    let bestMove = '';
    let evalCp: number | undefined;
    let mate: number | undefined;
    let depth = 0;
    const timeout = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('Stockfish timeout')); }, Math.max(5000, (opts.movetimeMs || 1000) + 4000));
    proc.stdout.on('data', d => {
      out += String(d);
      for (const line of String(d).split(/\r?\n/)) {
        const dm = line.match(/\bdepth\s+(\d+)/); if (dm) depth = Math.max(depth, Number(dm[1]));
        const cp = line.match(/\bscore\s+cp\s+(-?\d+)/); if (cp) evalCp = Number(cp[1]);
        const mt = line.match(/\bscore\s+mate\s+(-?\d+)/); if (mt) mate = Number(mt[1]);
        const bm = line.match(/^bestmove\s+(\S+)/); if (bm) { bestMove = bm[1]; clearTimeout(timeout); proc.kill(); resolve({ bestMove, evalCp, mate, depth, source: 'stockfish', lines: out.split(/\r?\n/).slice(-12) }); }
      }
    });
    proc.stderr.on('data', d => { out += String(d); });
    proc.on('error', reject);
    proc.stdin.write('uci\n');
    proc.stdin.write('isready\n');
    proc.stdin.write('ucinewgame\n');
    proc.stdin.write(`position fen ${fen}\n`);
    if (opts.depth) proc.stdin.write(`go depth ${opts.depth}\n`); else proc.stdin.write(`go movetime ${opts.movetimeMs || 1000}\n`);
  });
}
