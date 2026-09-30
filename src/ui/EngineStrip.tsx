import { useEffect, useRef, useState } from 'react';
import { Engine, type EngineLine, type EngineStatus } from '../lib/engine';
import { Chess } from 'chess.js';
import { MoveText } from './notation';

let shared: { engine: Engine; listeners: Set<(l: EngineLine | null, s: EngineStatus, d?: string) => void> } | null = null;

function getEngine() {
  if (!shared) {
    const listeners = new Set<(l: EngineLine | null, s: EngineStatus, d?: string) => void>();
    let status: EngineStatus = 'idle';
    const engine = new Engine(
      (l) => listeners.forEach((f) => f(l, status)),
      (s, d) => {
        status = s;
        listeners.forEach((f) => f(null, s, d));
      },
    );
    shared = { engine, listeners };
  }
  return shared;
}

function uciToSan(fen: string, pv: string[], max = 8): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const u of pv.slice(0, max)) {
    try {
      out.push(chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] ?? 'q' }).san);
    } catch {
      break;
    }
  }
  return out;
}

export function formatEval(l: EngineLine): string {
  if (l.mate !== null) return `${l.mate > 0 ? '+' : '−'}M${Math.abs(l.mate)}`;
  const v = (l.cp ?? 0) / 100;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;
}

/** Analysis on demand. The engine only loads the first time it is switched on. */
export function EngineStrip({ fen, onBestMove }: { fen: string; onBestMove?: (uci: string | null) => void }) {
  const [on, setOn] = useState(false);
  const [line, setLine] = useState<EngineLine | null>(null);
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const fenRef = useRef(fen);
  fenRef.current = fen;

  useEffect(() => {
    if (!on) return;
    const { engine, listeners } = getEngine();
    const f = (l: EngineLine | null, s: EngineStatus, d?: string) => {
      if (l) setLine(l);
      setStatus(s);
      if (s === 'error') setError(d ?? 'The engine could not start.');
    };
    listeners.add(f);
    return () => {
      listeners.delete(f);
      engine.stop();
    };
  }, [on]);

  useEffect(() => {
    if (!on) return;
    setLine(null);
    setError(null);
    const chess = new Chess(fen);
    if (chess.isGameOver()) return;
    getEngine().engine.analyse(fen, 22).catch((e: unknown) => setError(e instanceof Error ? e.message : 'The engine could not start.'));
  }, [fen, on]);

  useEffect(() => {
    onBestMove?.(on && line?.pv[0] ? line.pv[0] : null);
  }, [line, on, onBestMove]);

  const build = shared?.engine.build ?? null;
  const sans = line ? uciToSan(fen, line.pv) : [];
  const ply = (Number(fen.split(' ')[5] ?? 1) - 1) * 2 + (fen.split(' ')[1] === 'b' ? 1 : 0);

  return (
    <div className="engine" aria-live="polite">
      <button type="button" className="seg-toggle" aria-pressed={on} onClick={() => setOn(!on)}>
        Engine {on ? 'on' : 'off'}
      </button>
      {on && error && <span className="engine-msg is-error">{error}</span>}
      {on && !error && !line && <span className="engine-msg">{status === 'loading' ? 'Loading Stockfish…' : 'Thinking…'}</span>}
      {on && !error && line && (
        <>
          <span className="engine-eval">{formatEval(line)}</span>
          <span className="engine-depth">d{line.depth}</span>
          <MoveText moves={sans} startPly={ply} className="is-small engine-pv" />
        </>
      )}
      {on && build && <span className="engine-build">Stockfish 19 lite · {build.threads > 1 ? `${build.threads} threads` : 'single thread'}</span>}
    </div>
  );
}
