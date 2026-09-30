import { normalizeFen, type Color, type NativeRepertoireGraph } from './graph';
import { cardId, outgoing, replay } from './repertoire';
import type { SchedulingState } from './fsrs';

export interface ReviewEvent {
  id: string;
  cardId: string;
  lineId?: string | null;
  grade: 1 | 2 | 3 | 4;
  at: number;
  durationMs: number;
  guessed: boolean;
  hinted?: boolean;
  outcome: string;
  played?: string;
  expected?: string;
}

export interface CandidateLineMatch {
  lineId: string;
  name?: string;
  confidence: number;
  prefix: number;
  shared?: number;
  transpositions: number;
  firstMismatch?: number | null;
  total: number;
}

export interface DeviationMoment {
  kind: 'deviation' | 'out-of-book' | 'short-game' | 'quality-warning' | 'known-transposition' | 'prep-quality' | 'user-left-prep' | 'opponent-sideline';
  ply: number;
  phase?: 'opening' | 'early-middlegame' | 'middlegame/endgame' | string;
  side?: 'w' | 'b';
  played?: string;
  expected?: string;
  fenBefore?: string;
  isUser?: boolean;
  relevance?: 'low' | 'medium' | 'high' | { label: 'low' | 'medium' | 'high'; count?: number; message?: string };
  reason?: string;
  cardId?: string | null;
  forgottenTrainedCard?: boolean;
  repeated?: number;
  repairScore?: number;
  recommendation?: string;
}

export interface EngineReview {
  source: 'stockfish' | 'stockfish-worker' | 'server-heuristic' | 'database' | 'local-heuristic' | string;
  fen?: string;
  scoreCp?: number;
  bestmove?: string;
  pv?: string[];
  warning?: string;
}

export interface GameReviewReport {
  gameId: string;
  matchedLineIds?: string[];
  matches: CandidateLineMatch[];
  bestLineId?: string | null;
  confidence?: number;
  phase?: string;
  moments: DeviationMoment[];
  deviations?: DeviationMoment[];
  rankedRepairs?: DeviationMoment[];
  quality?: {
    label: 'ok' | 'watch' | 'bad-prep' | 'needs-engine-check';
    reason: string;
    engine?: EngineReview;
  } | null;
}

// ---------------------------------------------------------------------------
// Reviewing a played game against the position graph.


export interface GameRecord {
  id: string;
  source: 'lichess' | 'chesscom' | 'pgn' | 'demo';
  white: string;
  black: string;
  userColor: Color;
  result: string;
  playedAt: number;
  moves: string[];
  url?: string;
  opening?: string;
  speed?: string;
}

export interface GameReview extends GameReviewReport {
  /** Last ply (1-based) that was still inside the repertoire. */
  lastBookPly: number;
  /** First moment that ended or broke the preparation, if any. */
  verdict: DeviationMoment | null;
}

export function classifyPhase(ply: number): string {
  if (ply <= 16) return 'opening';
  if (ply <= 30) return 'early-middlegame';
  return 'middlegame/endgame';
}

/**
 * Walk the game position by position. While positions are in the graph the
 * game is "in book"; the first move that leaves it is attributed to whoever
 * played it. Because nodes are keyed by position, a game that reaches your
 * preparation through another move order is recognised as a transposition.
 */
export function reviewGame(g: NativeRepertoireGraph, game: GameRecord, cards: Record<string, SchedulingState> = {}): GameReview {
  const r = replay(game.moves);
  const keys = r.fens.map(normalizeFen);
  const moments: DeviationMoment[] = [];
  let lastBookPly = 0;
  let inBook = !!g.positions[keys[0] ?? ''];
  let verdict: DeviationMoment | null = null;
  const empty = Object.keys(g.move_edges).length === 0;

  for (let i = 0; i < r.sans.length && !empty; i++) {
    const key = keys[i] ?? '';
    const next = keys[i + 1] ?? '';
    const node = g.positions[key];
    const side: Color = i % 2 === 0 ? 'w' : 'b';
    const isUser = side === game.userColor;
    if (!node) {
      if (g.positions[next]) {
        moments.push({ kind: 'known-transposition', ply: i + 1, side, played: r.sans[i] ?? '', isUser, reason: 'Back in your preparation by transposition.' });
        inBook = true;
        lastBookPly = i + 1;
      }
      continue;
    }
    const edges = outgoing(g, key);
    if (!edges.length) {
      if (inBook && !verdict) {
        verdict = { kind: 'out-of-book', ply: i + 1, side, played: r.sans[i] ?? '', fenBefore: r.fens[i] ?? '', isUser, phase: classifyPhase(i + 1), reason: 'Your preparation ends here.' };
        moments.push(verdict);
      }
      break;
    }
    const uci = r.uci[i];
    if (edges.some((e) => e.uci === uci) || g.positions[next]) {
      lastBookPly = i + 1;
      continue;
    }
    const id = isUser ? cardId(game.userColor, key) : null;
    const card = id ? cards[id] : undefined;
    const moment: DeviationMoment = {
      kind: isUser ? 'user-left-prep' : 'opponent-sideline',
      ply: i + 1,
      side,
      played: r.sans[i] ?? '',
      expected: edges.map((e) => e.san).join(' / '),
      fenBefore: r.fens[i] ?? '',
      isUser,
      phase: classifyPhase(i + 1),
      cardId: id,
      forgottenTrainedCard: !!card?.reps,
      reason: isUser ? 'You left your preparation.' : 'Your opponent played a move you have not prepared.',
    };
    if (!verdict) verdict = moment;
    moments.push(moment);
    inBook = false;
  }

  const gameKeys = new Set(keys);
  const matches: CandidateLineMatch[] = Object.values(g.line_paths)
    .map((path) => {
      let prefix = 0;
      while (prefix < path.nodeIds.length && path.nodeIds[prefix] === keys[prefix]) prefix++;
      const shared = path.nodeIds.filter((id) => gameKeys.has(id)).length;
      const firstMismatch = prefix < path.nodeIds.length ? prefix : null;
      return {
        lineId: path.id,
        name: path.name,
        prefix,
        shared,
        transpositions: Math.max(0, shared - prefix),
        firstMismatch,
        total: path.nodeIds.length,
        confidence: Math.round((100 * shared) / Math.max(1, path.nodeIds.length)),
      };
    })
    .filter((m) => m.shared > 1)
    .sort((a, b) => b.shared - a.shared || b.prefix - a.prefix);

  return {
    gameId: game.id,
    matches,
    matchedLineIds: matches.map((m) => m.lineId),
    bestLineId: matches[0]?.lineId ?? null,
    confidence: matches[0]?.confidence ?? 0,
    phase: classifyPhase(lastBookPly),
    moments,
    deviations: moments.filter((m) => m.kind === 'user-left-prep' || m.kind === 'opponent-sideline'),
    lastBookPly,
    verdict,
    quality: null,
  };
}
