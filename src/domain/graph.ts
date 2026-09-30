export type Color = 'w' | 'b';
export type Lifecycle = 'active' | 'retired' | 'archived' | 'merged' | 'deleted';

export interface SourceReference {
  kind: 'manual' | 'pgn' | 'game' | 'coach' | 'library' | 'engine' | 'database' | 'ai' | 'course' | 'share';
  id?: string;
  title?: string;
  url?: string;
  gameId?: string;
  version?: string;
  author?: string;
  reviewer?: string;
  importedAt?: number;
}

export interface PositionNode {
  id: string;
  fen: string;
  fenKey: string;
  sideToMove: Color;
  critical?: boolean;
  lifecycle?: Lifecycle;
  sourceRefs?: SourceReference[];
  metadata?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

export interface MoveEdge {
  id: string;
  fromPositionId: string;
  toPositionId: string;
  fromFenKey?: string;
  toFenKey?: string;
  san: string;
  lan?: string;
  uci?: string;
  side?: Color;
  comment?: string;
  lifecycle?: Lifecycle;
  sourceRefs?: SourceReference[];
  metadata?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

export interface LinePath {
  id: string;
  lineId?: string;
  repertoireId?: string;
  name: string;
  color: Color;
  lifecycle: Lifecycle;
  branchOf?: string | null;
  branchFromPly?: number | null;
  branchType?: 'main' | 'side-variation' | 'opponent-reply' | 'split' | 'transposition' | string | null;
  nodeIds: string[];
  edgeIds: string[];
  mergedInto?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

export interface Annotation {
  id: string;
  targetKind: 'position' | 'edge' | 'line' | 'game' | 'assignment' | 'share';
  targetId: string;
  kind: 'idea' | 'plan' | 'hook' | 'warning' | 'comment' | 'source' | 'note' | string;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt?: number;
}

export interface NativeRepertoireGraph {
  schema: 'openingos-native-graph-v2' | 'openingos-graph-native-v2';
  updatedAt: number;
  positions: Record<string, PositionNode>;
  move_edges: Record<string, MoveEdge>;
  line_paths: Record<string, LinePath>;
  practice_cards: Record<string, unknown>;
  annotations: Record<string, Annotation>;
  deviations: Record<string, unknown>;
  indexes: {
    fenToPosition?: Record<string, string>;
    edgeByTransition?: Record<string, string>;
    linesByEdge?: Record<string, string[]>;
    linesByPosition?: Record<string, string[]>;
    byFen?: Record<string, string>;
    edgesByFrom?: Record<string, string[]>;
    lineByLegacyId?: Record<string, string>;
  };
}

/**
 * Reduce a FEN to the part that identifies a position: placement, side to
 * move, castling rights and en-passant square. Move counters are dropped so
 * transpositions compare equal.
 *
 * The en-passant field is kept only when a pawn of the side to move stands
 * next to the pawn that just advanced two squares. Many FEN writers (older
 * chess.js, PGN FEN tags from some sites) record the square after every
 * double push, which would otherwise split 1.e4 e5 2.Nf3 and 1.Nf3 e5 2.e4
 * into two nodes. The check is pseudo-legal: a pinned capturer still counts.
 */
export function normalizeFen(fen: string): string {
  const [placement = '', side = 'w', castling = '-', ep = '-'] = fen.trim().split(/\s+/);
  return [placement, side, castling || '-', epIsCapturable(placement, side, ep) ? ep : '-'].join(' ');
}

function epIsCapturable(placement: string, side: string, ep: string): boolean {
  if (!/^[a-h][36]$/.test(ep)) return false;
  const file = ep.charCodeAt(0) - 97;
  // White to move captures onto rank 6 from rank 5; black onto rank 3 from rank 4.
  const rank = side === 'w' ? 5 : 4;
  const pawn = side === 'w' ? 'P' : 'p';
  const row = expandRank(placement, rank);
  if (!row) return false;
  return row[file - 1] === pawn || row[file + 1] === pawn;
}

function expandRank(placement: string, rank: number): string | null {
  const rows = placement.split('/');
  const raw = rows[8 - rank];
  if (raw === undefined) return null;
  return raw.replace(/[1-8]/g, (d) => '.'.repeat(Number(d)));
}

export function edgeTransitionKey(fromPositionId: string, uci: string, toPositionId: string): string {
  return `${fromPositionId}|${uci}|${toPositionId}`;
}
