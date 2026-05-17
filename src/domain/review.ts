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
