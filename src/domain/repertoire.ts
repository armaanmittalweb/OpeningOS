import { Chess } from 'chess.js';
import {
  edgeTransitionKey,
  normalizeFen,
  type Color,
  type LinePath,
  type MoveEdge,
  type NativeRepertoireGraph,
  type PositionNode,
} from './graph';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A repertoire line as the user entered it: one move order from the start. */
export interface RepLine {
  id: string;
  name: string;
  color: Color;
  moves: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface Replay {
  /** fens[0] is the start; fens[i] is the position after i plies. */
  fens: string[];
  sans: string[];
  uci: string[];
  error: { ply: number; move: string } | null;
}

export function replay(moves: readonly string[], fen: string = START_FEN): Replay {
  const chess = new Chess(fen);
  const out: Replay = { fens: [chess.fen()], sans: [], uci: [], error: null };
  for (let i = 0; i < moves.length; i++) {
    const raw = moves[i] ?? '';
    let m;
    try {
      m = chess.move(raw.replace(/[+#]+$/, ''), { strict: false });
    } catch {
      m = null;
    }
    if (!m) {
      out.error = { ply: i + 1, move: raw };
      break;
    }
    out.sans.push(m.san);
    out.uci.push(m.from + m.to + (m.promotion ?? ''));
    out.fens.push(chess.fen());
  }
  return out;
}

export function sideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/**
 * Build the position graph. Nodes are keyed by normalized FEN, so two move
 * orders that reach the same position share a node. Edges are keyed by
 * (from, uci) and shared between lines that play the same move.
 */
export function buildGraph(lines: readonly RepLine[], now = Date.now()): NativeRepertoireGraph {
  const g: NativeRepertoireGraph = {
    schema: 'openingos-native-graph-v2',
    updatedAt: now,
    positions: {},
    move_edges: {},
    line_paths: {},
    practice_cards: {},
    annotations: {},
    deviations: {},
    indexes: { fenToPosition: {}, edgeByTransition: {}, linesByEdge: {}, linesByPosition: {}, edgesByFrom: {} },
  };
  const ix = g.indexes as Required<NativeRepertoireGraph['indexes']>;

  const ensure = (fen: string, depth: number, lineId: string): PositionNode => {
    const key = normalizeFen(fen);
    let node = g.positions[key];
    if (!node) {
      node = { id: key, fen, fenKey: key, sideToMove: sideToMove(fen), lifecycle: 'active', metadata: { depth }, createdAt: now };
      g.positions[key] = node;
      ix.fenToPosition[key] = key;
    } else if (node.metadata && typeof node.metadata.depth === 'number' && depth < node.metadata.depth) {
      node.metadata.depth = depth;
    }
    const list = (ix.linesByPosition[key] ??= []);
    if (!list.includes(lineId)) list.push(lineId);
    return node;
  };

  for (const line of lines) {
    const r = replay(line.moves);
    const path: LinePath = { id: line.id, lineId: line.id, name: line.name, color: line.color, lifecycle: 'active', nodeIds: [], edgeIds: [], createdAt: line.createdAt };
    let from = ensure(r.fens[0] ?? START_FEN, 0, line.id);
    path.nodeIds.push(from.id);
    r.sans.forEach((san, i) => {
      const to = ensure(r.fens[i + 1] ?? START_FEN, i + 1, line.id);
      const uci = r.uci[i] ?? '';
      const edgeId = `${from.id}|${uci}`;
      if (!g.move_edges[edgeId]) {
        const edge: MoveEdge = { id: edgeId, fromPositionId: from.id, toPositionId: to.id, fromFenKey: from.fenKey, toFenKey: to.fenKey, san, uci, side: from.sideToMove, lifecycle: 'active', createdAt: now };
        g.move_edges[edgeId] = edge;
        ix.edgeByTransition[edgeTransitionKey(from.id, uci, to.id)] = edgeId;
        (ix.edgesByFrom[from.id] ??= []).push(edgeId);
      }
      const byEdge = (ix.linesByEdge[edgeId] ??= []);
      if (!byEdge.includes(line.id)) byEdge.push(line.id);
      path.nodeIds.push(to.id);
      path.edgeIds.push(edgeId);
      from = to;
    });
    g.line_paths[line.id] = path;
  }
  return g;
}

export function outgoing(g: NativeRepertoireGraph, positionId: string): MoveEdge[] {
  return (g.indexes.edgesByFrom?.[positionId] ?? []).map((id) => g.move_edges[id]).filter((e): e is MoveEdge => !!e);
}

export function incoming(g: NativeRepertoireGraph, positionId: string): MoveEdge[] {
  return Object.values(g.move_edges).filter((e) => e.toPositionId === positionId);
}

/** Positions reached from two or more different parent positions. */
export function transpositionIds(g: NativeRepertoireGraph): Set<string> {
  const parents = new Map<string, Set<string>>();
  for (const e of Object.values(g.move_edges)) {
    const set = parents.get(e.toPositionId) ?? new Set<string>();
    set.add(e.fromPositionId);
    parents.set(e.toPositionId, set);
  }
  return new Set([...parents].filter(([, s]) => s.size > 1).map(([id]) => id));
}

/** One practice card per position where it is your move and you have prepared a reply. */
export interface PracticeCard {
  id: string;
  color: Color;
  positionId: string;
  fen: string;
  depth: number;
  /** Prepared replies in SAN; any of them counts as correct. */
  expected: string[];
  expectedUci: string[];
  lineIds: string[];
  /** One move order that reaches this position (the shortest). */
  path: string[];
}

export function cardId(color: Color, positionId: string): string {
  return `${color}:${positionId}`;
}

export function buildCards(g: NativeRepertoireGraph, lines: readonly RepLine[]): PracticeCard[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const cards: PracticeCard[] = [];
  for (const node of Object.values(g.positions)) {
    const edges = outgoing(g, node.id);
    for (const color of ['w', 'b'] as const) {
      if (node.sideToMove !== color) continue;
      const mine = edges.filter((e) => (g.indexes.linesByEdge?.[e.id] ?? []).some((lid) => byId.get(lid)?.color === color));
      if (!mine.length) continue;
      const lineIds = [...new Set(mine.flatMap((e) => g.indexes.linesByEdge?.[e.id] ?? []))].filter((lid) => byId.get(lid)?.color === color);
      cards.push({
        id: cardId(color, node.id),
        color,
        positionId: node.id,
        fen: node.fen,
        depth: typeof node.metadata?.depth === 'number' ? node.metadata.depth : 0,
        expected: mine.map((e) => e.san),
        expectedUci: mine.map((e) => e.uci ?? ''),
        lineIds,
        path: shortestPath(g, lines, node.id),
      });
    }
  }
  return cards.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
}

function shortestPath(g: NativeRepertoireGraph, lines: readonly RepLine[], positionId: string): string[] {
  let best: string[] | null = null;
  for (const line of lines) {
    const path = g.line_paths[line.id];
    if (!path) continue;
    const idx = path.nodeIds.indexOf(positionId);
    if (idx < 0) continue;
    if (!best || idx < best.length) best = path.edgeIds.slice(0, idx).map((id) => g.move_edges[id]?.san ?? '');
  }
  return best ?? [];
}

export type UpsertResult = { lines: RepLine[]; action: 'added' | 'extended' | 'exists'; lineId: string };

/**
 * Save a move sequence. If an existing line of the same colour is a prefix of
 * it, that line is extended; if it is already covered by a longer line,
 * nothing changes; otherwise a new line is added.
 */
export function upsertLine(lines: readonly RepLine[], input: { name: string; color: Color; moves: string[] }, makeId: () => string, now = Date.now()): UpsertResult {
  const moves = replay(input.moves).sans;
  const same = lines.filter((l) => l.color === input.color);
  const covering = same.find((l) => l.moves.length >= moves.length && moves.every((m, i) => l.moves[i] === m));
  if (covering) return { lines: [...lines], action: 'exists', lineId: covering.id };
  const prefix = same
    .filter((l) => l.moves.length < moves.length && l.moves.every((m, i) => moves[i] === m))
    .sort((a, b) => b.moves.length - a.moves.length)[0];
  if (prefix) {
    return {
      lines: lines.map((l) => (l.id === prefix.id ? { ...l, moves, updatedAt: now } : l)),
      action: 'extended',
      lineId: prefix.id,
    };
  }
  const line: RepLine = { id: makeId(), name: input.name.trim() || defaultLineName(moves), color: input.color, moves, createdAt: now };
  return { lines: [...lines, line], action: 'added', lineId: line.id };
}

export function defaultLineName(moves: readonly string[]): string {
  return moves.length ? `Line from ${formatMovesPlain(moves.slice(0, 4))}` : 'Empty line';
}

export function formatMovesPlain(moves: readonly string[], startPly = 0): string {
  return moves
    .map((m, i) => {
      const ply = startPly + i;
      const n = Math.floor(ply / 2) + 1;
      if (ply % 2 === 0) return `${n}.${m}`;
      return i === 0 ? `${n}...${m}` : m;
    })
    .join(' ');
}
