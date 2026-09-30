import { useSyncExternalStore } from 'react';
import type { Color, NativeRepertoireGraph } from '../domain/graph';
import { schedule, type Grade, type SchedulingResult, type SchedulingState } from '../domain/fsrs';
import { buildCards, buildGraph, upsertLine, type PracticeCard, type RepLine, type UpsertResult } from '../domain/repertoire';
import type { GameRecord, ReviewEvent } from '../domain/review';
import { openKV, type KV } from './idb';
import { demoGames, demoLines } from './demo';

export interface AppData {
  v: 1;
  lines: RepLine[];
  cards: Record<string, SchedulingState>;
  games: GameRecord[];
  log: ReviewEvent[];
  updatedAt: number;
}

export type ThemePref = 'system' | 'light' | 'dark';
export interface Settings {
  theme: ThemePref;
  importUser: string;
  importSource: 'lichess' | 'chesscom';
}

export const emptyData = (): AppData => ({ v: 1, lines: [], cards: {}, games: [], log: [], updatedAt: 0 });
const defaultSettings: Settings = { theme: 'system', importUser: '', importSource: 'lichess' };

interface State {
  ready: boolean;
  persistent: boolean;
  data: AppData;
  settings: Settings;
}

let state: State = { ready: false, persistent: true, data: emptyData(), settings: defaultSettings };
let kv: KV | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
}

function persistData() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void kv?.set('data', state.data), 150);
}

function updateData(fn: (d: AppData) => AppData) {
  set({ data: { ...fn(state.data), updatedAt: Date.now() } });
  persistData();
}

export async function initStore(opts: { kv?: KV; seed?: AppData } = {}): Promise<void> {
  kv = opts.kv ?? (await openKV());
  const [data, settings] = await Promise.all([kv.get<AppData>('data'), kv.get<Settings>('settings')]);
  set({
    ready: true,
    persistent: kv.persistent,
    data: data?.v === 1 ? data : (opts.seed ?? emptyData()),
    settings: { ...defaultSettings, ...settings },
  });
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  kv: () => kv,

  saveLine(input: { name: string; color: Color; moves: string[] }): UpsertResult {
    const result = upsertLine(state.data.lines, input, () => `l_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
    if (result.action !== 'exists') updateData((d) => ({ ...d, lines: result.lines }));
    return result;
  },
  renameLine(id: string, name: string) {
    updateData((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, name, updatedAt: Date.now() } : l)) }));
  },
  deleteLine(id: string) {
    updateData((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));
  },
  grade(card: PracticeCard, grade: Grade, meta: { hinted: boolean; played: string; durationMs: number }): SchedulingResult {
    const prev = state.data.cards[card.id] ?? {};
    const next = schedule({ ...prev, hinted: meta.hinted, guessed: false }, grade);
    const event: ReviewEvent = {
      id: `r_${Date.now().toString(36)}`,
      cardId: card.id,
      lineId: card.lineIds[0] ?? null,
      grade,
      at: next.lastReview,
      durationMs: meta.durationMs,
      guessed: false,
      hinted: meta.hinted,
      outcome: grade === 1 ? 'miss' : 'recall',
      played: meta.played,
      expected: card.expected.join('/'),
    };
    updateData((d) => ({ ...d, cards: { ...d.cards, [card.id]: next }, log: [...d.log.slice(-499), event] }));
    return next;
  },
  addGames(games: GameRecord[]): number {
    const known = new Set(state.data.games.map((g) => g.id));
    const fresh = games.filter((g) => !known.has(g.id));
    if (fresh.length) updateData((d) => ({ ...d, games: [...fresh, ...d.games].sort((a, b) => b.playedAt - a.playedAt).slice(0, 500) }));
    return fresh.length;
  },
  removeGame(id: string) {
    updateData((d) => ({ ...d, games: d.games.filter((g) => g.id !== id) }));
  },
  loadDemo() {
    updateData((d) => {
      const ids = new Set(d.lines.map((l) => l.id));
      const gameIds = new Set(d.games.map((g) => g.id));
      return {
        ...d,
        lines: [...d.lines, ...demoLines().filter((l) => !ids.has(l.id))],
        games: [...d.games, ...demoGames().filter((g) => !gameIds.has(g.id))],
      };
    });
  },
  /** Replace everything (sync pull or backup restore). */
  replaceData(data: AppData) {
    set({ data });
    persistData();
  },
  setSettings(patch: Partial<Settings>) {
    set({ settings: { ...state.settings, ...patch } });
    void kv?.set('settings', state.settings);
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state));
}

// Derived data, memoised on the lines array identity.
let memoLines: RepLine[] | null = null;
let memo: { graphs: Record<Color, NativeRepertoireGraph>; cards: PracticeCard[] } | null = null;

export function derived(lines: RepLine[]) {
  if (lines !== memoLines || !memo) {
    const w = lines.filter((l) => l.color === 'w');
    const b = lines.filter((l) => l.color === 'b');
    const graphs = { w: buildGraph(w), b: buildGraph(b) };
    memo = { graphs, cards: [...buildCards(graphs.w, w), ...buildCards(graphs.b, b)] };
    memoLines = lines;
  }
  return memo;
}

export function useDerived() {
  const lines = useStore((s) => s.data.lines);
  return derived(lines);
}

/** Cards due now: overdue first, then new cards (up to a daily cap). */
export function dueQueue(cards: PracticeCard[], sched: Record<string, SchedulingState>, at = Date.now(), newCap = 20): PracticeCard[] {
  const due = cards.filter((c) => sched[c.id]?.reps && (sched[c.id]?.due ?? 0) <= at).sort((a, b) => (sched[a.id]?.due ?? 0) - (sched[b.id]?.due ?? 0));
  const fresh = cards.filter((c) => !sched[c.id]?.reps).slice(0, newCap);
  return [...due, ...fresh];
}
