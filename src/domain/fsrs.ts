export type Grade = 1 | 2 | 3 | 4;

export interface SchedulingState {
  scheduler?: string;
  stability?: number;
  difficulty?: number;
  retrievability?: number;
  scheduledDays?: number;
  due?: number;
  lapses?: number;
  missRate?: number;
  reps?: number;
  lastReview?: number;
  hinted?: boolean;
  guessed?: boolean;
  retentionTarget?: number;
}

export interface SchedulerConfig {
  retentionTarget: number;
  maximumIntervalDays: number;
  newCardsPerDay: number;
  relearningStepsMinutes: number[];
}

export interface SchedulingResult extends Required<Omit<SchedulingState, 'hinted' | 'guessed' | 'retentionTarget'>> {
  hinted: boolean;
  guessed: boolean;
  retentionTarget: number;
}

const DAY = 86_400_000;
const DEFAULT_CONFIG: SchedulerConfig = { retentionTarget: 0.9, maximumIntervalDays: 3650, newCardsPerDay: 20, relearningStepsMinutes: [10, 60, 24 * 60] };

export function retrievability(card: SchedulingState, at = Date.now()): number {
  const stability = Math.max(0.1, card.stability ?? 0.1);
  const last = card.lastReview || at;
  const elapsedDays = Math.max(0, (at - last) / DAY);
  return Math.max(0, Math.min(1, Math.exp(Math.log(card.retentionTarget || 0.9) * elapsedDays / stability)));
}

export function schedule(card: SchedulingState, grade: Grade, at = Date.now(), config: Partial<SchedulerConfig> = {}): SchedulingResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const reps = (card.reps || 0) + 1;
  const oldStability = Math.max(0.1, card.stability || 0.4);
  const oldDifficulty = Math.min(10, Math.max(1, card.difficulty || 5));
  const r = retrievability(card, at);
  const penalty = (card.hinted ? 0.82 : 1) * (card.guessed ? 0.72 : 1);
  let difficulty = oldDifficulty;
  let stability = oldStability;
  let lapses = card.lapses || 0;
  let missRate = card.missRate || 0;

  if (grade === 1) {
    lapses += 1;
    difficulty = Math.min(10, oldDifficulty + 1.15);
    stability = Math.max(0.12, oldStability * (0.32 + 0.1 * r));
    missRate = Math.min(1, missRate * 0.75 + 0.25);
  } else if (grade === 2) {
    difficulty = Math.min(10, oldDifficulty + 0.35);
    stability = Math.max(0.35, oldStability * (1.2 + 0.12 * r) * penalty);
    missRate = Math.min(1, missRate * 0.88 + 0.04);
  } else if (grade === 3) {
    difficulty = Math.max(1, oldDifficulty - 0.12);
    stability = Math.max(1, oldStability * (2.1 + 0.35 * r) * (11 - difficulty) / 8 * penalty);
    missRate = Math.max(0, missRate * 0.82);
  } else {
    difficulty = Math.max(1, oldDifficulty - 0.45);
    stability = Math.max(2, oldStability * (3.1 + 0.6 * r) * (11 - difficulty) / 7.5 * penalty);
    missRate = Math.max(0, missRate * 0.68);
  }

  const scheduledDays = grade === 1
    ? (cfg.relearningStepsMinutes[0] || 10) / 1440
    : Math.min(cfg.maximumIntervalDays, Math.max(1 / 24, Math.round(stability * (grade === 4 ? 1.22 : 1) * 10) / 10));
  return { scheduler: 'fsrs-compatible-openingos-v2', stability, difficulty, retrievability: grade === 1 ? 0.35 : cfg.retentionTarget, scheduledDays, due: at + scheduledDays * DAY, lapses, missRate, reps, lastReview: at, hinted: !!card.hinted, guessed: !!card.guessed, retentionTarget: cfg.retentionTarget };
}
