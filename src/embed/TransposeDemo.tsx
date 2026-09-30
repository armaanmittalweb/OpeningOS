import { useEffect, useMemo, useState } from 'react';
import { parseMoveText } from '../domain/pgn';
import { buildGraph, replay, transpositionIds, type RepLine } from '../domain/repertoire';
import { normalizeFen } from '../domain/graph';
import { Board } from '../ui/Board';
import { GraphCanvas } from '../ui/GraphCanvas';
import { MoveText } from '../ui/notation';
import { timed, TRANSPOSE_ORDERS, type StageEvent } from './pipeline';

const STEP_MS = 650;

/** Plays 1.e4 e5 2.Nf3, then 1.Nf3 e5 2.e4, growing the graph until both land on one node. */
export function TransposeDemo({ run, emit }: { run: number; emit: (e: StageEvent) => void }) {
  const orders = useMemo(() => timed(0, emit, () => TRANSPOSE_ORDERS.map((o) => ({ ...o, moves: parseMoveText(o.text) }))), [run]);
  const total = orders.reduce((n, o) => n + o.moves.length, 0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStep(reduced ? total : 0);
    if (reduced) return;
    const t = setInterval(() => setStep((s) => (s >= total ? s : s + 1)), STEP_MS);
    return () => clearInterval(t);
  }, [run, total]);

  const a = orders[0]!;
  const b = orders[1]!;
  const aPlies = Math.min(step, a.moves.length);
  const bPlies = Math.max(0, step - a.moves.length);
  const active = bPlies > 0 ? b : a;
  const activePlies = bPlies > 0 ? bPlies : aPlies;

  const { lines, fen, uci } = useMemo(() => {
    const r = timed(1, emit, () => replay(active.moves.slice(0, activePlies)));
    const ls: RepLine[] = [];
    if (aPlies) ls.push({ id: a.id, name: a.name, color: 'w', moves: a.moves.slice(0, aPlies), createdAt: 0 });
    if (bPlies) ls.push({ id: b.id, name: b.name, color: 'w', moves: b.moves.slice(0, bPlies), createdAt: 0 });
    return { lines: ls, fen: r.fens.at(-1)!, uci: r.uci.at(-1) };
  }, [step]);

  const graph = useMemo(() => timed(2, emit, () => buildGraph(lines), (g) => step < total || transpositionIds(g).size > 0), [lines]);
  const merged = step >= total && transpositionIds(graph).size > 0;

  return (
    <div className="embed-grid">
      <div className="embed-board">
        <Board fen={fen} lastMove={uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null} label="Transposition demo board" coordinates={false} />
      </div>
      <div className="embed-side">
        <div className="embed-orders">
          {[a, b].map((o, i) => (
            <MoveText key={o.id} moves={o.moves.slice(0, i === 0 ? aPlies : bPlies)} className={`is-small${o === active ? '' : ' is-dim'}`} trailing={(i === 0 ? aPlies : bPlies) < o.moves.length ? '…' : undefined} />
          ))}
        </div>
        <div className="embed-graph">
          <GraphCanvas graph={graph} color="w" sched={{}} selected={merged ? normalizeFen(fen) : null} onSelect={() => {}} compact />
        </div>
        <p className="embed-caption" aria-live="polite">
          {merged ? 'Two move orders, one position: both lines share a node and a practice card.' : 'Playing both move orders…'}
        </p>
      </div>
    </div>
  );
}
