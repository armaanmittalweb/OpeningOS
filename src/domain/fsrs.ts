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

  // Stability after each outcome, computed from the same inputs so the four
  // grades stay ordered: Again < Hard < Good < Easy. Earlier versions could
  // give Good a shorter interval than Hard (and shrink stability on a
  // successful recall) once difficulty rose above ~8, because the
  // (11 - D) / 8 factor fell below 1.
  const hardStability = Math.max(0.35, oldStability * (1.2 + 0.12 * r) * penalty);
  const goodStability = Math.max(1, hardStability * 1.2, oldStability * (2.1 + 0.35 * r) * (11 - oldDifficulty) / 8 * penalty);
  const easyStability = Math.max(2, goodStability * 1.3, oldStability * (3.1 + 0.6 * r) * (11 - oldDifficulty) / 7.5 * penalty);

  if (grade === 1) {
    lapses += 1;
    difficulty = Math.min(10, oldDifficulty + 1.15);
    stability = Math.max(0.12, oldStability * (0.32 + 0.1 * r));
    missRate = Math.min(1, missRate * 0.75 + 0.25);
  } else if (grade === 2) {
    difficulty = Math.min(10, oldDifficulty + 0.35);
    stability = hardStability;
    missRate = Math.min(1, missRate * 0.88 + 0.04);
  } else if (grade === 3) {
    difficulty = Math.max(1, oldDifficulty - 0.12);
    stability = goodStability;
    missRate = Math.max(0, missRate * 0.82);
  } else {
    difficulty = Math.max(1, oldDifficulty - 0.45);
    stability = easyStability;
    missRate = Math.max(0, missRate * 0.68);
  }

  const scheduledDays = grade === 1
    ? (cfg.relearningStepsMinutes[0] || 10) / 1440
    : Math.min(cfg.maximumIntervalDays, Math.max(1 / 24, Math.round(stability * (grade === 4 ? 1.22 : 1) * 10) / 10));
  return { scheduler: 'fsrs-compatible-openingos-v2', stability, difficulty, retrievability: grade === 1 ? 0.35 : cfg.retentionTarget, scheduledDays, due: at + scheduledDays * DAY, lapses, missRate, reps, lastReview: at, hinted: !!card.hinted, guessed: !!card.guessed, retentionTarget: cfg.retentionTarget };
}

/** Interval in days each grade would give, for labelling the grade buttons. */
export function previewIntervals(card: SchedulingState, at = Date.now(), config: Partial<SchedulerConfig> = {}): Record<Grade, number> {
  return {
    1: schedule(card, 1, at, config).scheduledDays,
    2: schedule(card, 2, at, config).scheduledDays,
    3: schedule(card, 3, at, config).scheduledDays,
    4: schedule(card, 4, at, config).scheduledDays,
  };
}

/** "10 min", "12 h", "2.4 days", "3 mo". */
export function formatInterval(days: number): string {
  const minutes = days * 1440;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  if (days < 1) return `${Math.round(minutes / 60)} h`;
  if (days < 30) {
    const d = Math.round(days * 10) / 10;
    return `${d % 1 === 0 ? d.toFixed(0) : d.toFixed(1)} ${d === 1 ? 'day' : 'days'}`;
  }
  if (days < 365) return `${Math.round(days / 30)} mo`;
  const y = Math.round(days / 36.5) / 10;
  return `${y} yr`;
}

export function isNew(card: SchedulingState | undefined): boolean {
  return !card || !card.reps;
}

export function isDue(card: SchedulingState | undefined, at = Date.now()): boolean {
  return !card || (card.due ?? 0) <= at;
}

export type Heat = 'new' | 'fresh' | 'soon' | 'due' | 'overdue';

/** Discrete due-ness bucket used to colour graph nodes. */
export function heat(card: SchedulingState | undefined, at = Date.now()): Heat {
  if (isNew(card)) return 'new';
  const due = card?.due ?? 0;
  if (due <= at - DAY) return 'overdue';
  if (due <= at) return 'due';
  if (due <= at + 2 * DAY) return 'soon';
  return 'fresh';
}
