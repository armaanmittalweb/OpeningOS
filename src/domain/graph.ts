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

export function normalizeFen(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

export function edgeTransitionKey(fromPositionId: string, uci: string, toPositionId: string): string {
  return `${fromPositionId}|${uci}|${toPositionId}`;
}
