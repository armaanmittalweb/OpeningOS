import type { NativeRepertoireGraph } from '../domain/graph';
import { parseMoveText } from '../domain/pgn';
import { buildCards, buildGraph, replay, type PracticeCard, type RepLine } from '../domain/repertoire';
import { reviewGame, type GameReview } from '../domain/review';
import { DEMO_LINES, demoGames } from '../lib/demo';
import { formatMovesPlain } from '../domain/repertoire';
import { STAGES, type StageIndex } from './protocol';

export interface StageEvent {
  i: StageIndex;
  name: string;
  ms: number;
  ok: boolean;
}

/** Run fn, time it, and report it as a stage. */
export function timed<T>(i: StageIndex, emit: (e: StageEvent) => void, fn: () => T, ok: (v: T) => boolean = () => true): T {
  const t = performance.now();
  let v: T;
  try {
    v = fn();
  } catch (e) {
    emit({ i, name: STAGES[i], ms: performance.now() - t, ok: false });
    throw e;
  }
  emit({ i, name: STAGES[i], ms: Math.round((performance.now() - t) * 100) / 100, ok: ok(v) });
  return v;
}

export interface DrillSetup {
  lines: RepLine[];
  graph: NativeRepertoireGraph;
  cards: PracticeCard[];
}

/** Stages 0 to 3: from typed lines to five practice cards. */
export function setupDrill(emit: (e: StageEvent) => void): DrillSetup {
  const now = Date.now();
  // Round-trip the demo lines through text, as a user would type them.
  const texts = DEMO_LINES.map((l) => ({ ...l, text: formatMovesPlain(l.moves) }));
  const parsed = timed(0, emit, () => texts.map((l) => ({ ...l, moves: parseMoveText(l.text) })), (v) => v.every((l) => l.moves.length > 0));
  const lines = timed(1, emit, () => parsed.map((l): RepLine => ({ id: l.id, name: l.name, color: l.color, moves: replay(l.moves).sans, createdAt: now })), (v) => v.every((l, i) => l.moves.length === parsed[i]?.moves.length));
  const graph = timed(2, emit, () => buildGraph(lines), (g) => Object.keys(g.positions).length > 0);
  const cards = timed(3, emit, () => pickFive(buildCards(graph, lines)), (c) => c.length === 5);
  return { lines, graph, cards };
}

/** A spread of five cards: the first move, then decisions deeper in the tree. */
function pickFive(cards: PracticeCard[]): PracticeCard[] {
  const byDepth = [...cards].sort((a, b) => a.depth - b.depth);
  const want = [0, 2, 4, 6, 8];
  const out: PracticeCard[] = [];
  for (const d of want) {
    const c = byDepth.find((x) => x.depth === d && !out.includes(x));
    if (c) out.push(c);
  }
  for (const c of byDepth) if (out.length < 5 && !out.includes(c)) out.push(c);
  return out.slice(0, 5);
}

/** Stage 5: review a sample game against the demo repertoire. */
export function reviewDemo(setup: DrillSetup, emit: (e: StageEvent) => void): { review: GameReview; moves: string[] } {
  const game = demoGames()[0]!;
  const review = timed(5, emit, () => reviewGame(setup.graph, game), (r) => r.verdict !== null);
  return { review, moves: game.moves };
}

export const TRANSPOSE_ORDERS = [
  { id: 'order-a', name: '1.e4 e5 2.Nf3', text: '1.e4 e5 2.Nf3' },
  { id: 'order-b', name: '1.Nf3 e5 2.e4', text: '1.Nf3 e5 2.e4' },
] as const;
