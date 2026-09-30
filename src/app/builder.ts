import { useSyncExternalStore } from 'react';
import { Chess } from 'chess.js';
import type { Color } from '../domain/graph';
import { replay, START_FEN } from '../domain/repertoire';

/** The line currently on the builder board. Shared by Repertoire and Graph. */
export interface BuilderState {
  color: Color;
  moves: string[];
  cursor: number;
  name: string;
  flipped: boolean;
}

let s: BuilderState = { color: 'w', moves: [], cursor: 0, name: '', flipped: false };
const ls = new Set<() => void>();
const setState = (n: Partial<BuilderState>) => {
  s = { ...s, ...n };
  ls.forEach((l) => l());
};

export function useBuilder(): BuilderState {
  return useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => s,
    () => s,
  );
}

export const builder = {
  get: () => s,
  /** Play a move at the cursor (SAN, or from/to squares). Returns an error message or null. */
  play(move: string | { from: string; to: string; promotion?: string }): string | null {
    const chess = new Chess(fenAt(s.moves, s.cursor));
    try {
      const m = typeof move === 'string' ? chess.move(move.trim().replace(/[+#!?]+$/, ''), { strict: false }) : chess.move(move);
      const moves = s.moves.slice(0, s.cursor);
      // Keep the rest of the line if the same move was replayed.
      if (s.moves[s.cursor] === m.san) setState({ cursor: s.cursor + 1 });
      else setState({ moves: [...moves, m.san], cursor: s.cursor + 1 });
      return null;
    } catch {
      return typeof move === 'string' ? `“${move}” is not a legal move here.` : 'That move is not legal.';
    }
  },
  step(delta: number) {
    setState({ cursor: Math.max(0, Math.min(s.moves.length, s.cursor + delta)) });
  },
  goto(cursor: number) {
    setState({ cursor: Math.max(0, Math.min(s.moves.length, cursor)) });
  },
  undo() {
    if (!s.cursor) return;
    setState({ moves: s.moves.slice(0, s.cursor - 1), cursor: s.cursor - 1 });
  },
  clear() {
    setState({ moves: [], cursor: 0, name: '' });
  },
  load(moves: string[], color: Color, name = '') {
    setState({ moves: [...moves], cursor: moves.length, color, name, flipped: false });
  },
  setColor(color: Color) {
    setState({ color, flipped: false });
  },
  setName(name: string) {
    setState({ name });
  },
  flip() {
    setState({ flipped: !s.flipped });
  },
};

export function fenAt(moves: readonly string[], cursor: number): string {
  return replay(moves.slice(0, cursor)).fens.at(-1) ?? START_FEN;
}

export function lastMoveAt(moves: readonly string[], cursor: number): { from: string; to: string } | null {
  if (!cursor) return null;
  const uci = replay(moves.slice(0, cursor)).uci.at(-1);
  return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null;
}
