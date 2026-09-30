import { describe, expect, it } from 'vitest';
import { normalizeFen } from './graph';
import { formatInterval, heat, previewIntervals, schedule, type Grade, type SchedulingState } from './fsrs';
import { buildCards, buildGraph, cardId, replay, transpositionIds, upsertLine, formatMovesPlain, type RepLine } from './repertoire';
import { reviewGame, type GameRecord } from './review';
import { parseMoveText, parsePgn, splitPgnGames } from './pgn';

const DAY = 86_400_000;
const line = (id: string, moves: string, color: 'w' | 'b' = 'w'): RepLine => ({ id, name: id, color, moves: moves.split(' '), createdAt: 0 });

describe('normalizeFen', () => {
  it('drops move counters', () => {
    expect(normalizeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
  });
  it('drops an en-passant square nobody can capture on', () => {
    // FEN written by a tool that records ep after every double push (1.Nf3 e5 2.e4).
    const a = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq e3 0 2';
    const b = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    expect(normalizeFen(a)).toBe(normalizeFen(b));
  });
  it('keeps an en-passant square that can be captured', () => {
    const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
    expect(normalizeFen(fen).endsWith(' f6')).toBe(true);
  });
});

describe('position graph', () => {
  it('merges transpositions into one node', () => {
    const g = buildGraph([line('a', 'e4 e5 Nf3'), line('b', 'Nf3 e5 e4')]);
    const endA = g.line_paths.a?.nodeIds.at(-1);
    const endB = g.line_paths.b?.nodeIds.at(-1);
    expect(endA).toBe(endB);
    expect(transpositionIds(g).has(endA!)).toBe(true);
    // start + 3 unique positions per line, sharing the final one
    expect(Object.keys(g.positions)).toHaveLength(6);
  });
  it('shares edges between lines that play the same move', () => {
    const g = buildGraph([line('a', 'e4 e5 Nf3 Nc6'), line('b', 'e4 e5 Nf3 d6')]);
    expect(Object.keys(g.move_edges)).toHaveLength(5);
    expect(g.indexes.linesByEdge?.[g.line_paths.a!.edgeIds[0]!]).toEqual(['a', 'b']);
  });
  it('stops a line at the first illegal move', () => {
    expect(replay(['e4', 'e5', 'Ke3']).error).toEqual({ ply: 3, move: 'Ke3' });
    expect(buildGraph([line('a', 'e4 e5 Ke3')]).line_paths.a?.edgeIds).toHaveLength(2);
  });
});

describe('practice cards', () => {
  it('makes one card per position where it is your move', () => {
    const lines = [line('a', 'e4 e5 Nf3 Nc6 Bc4'), line('b', 'e4 c5 Nf3')];
    const cards = buildCards(buildGraph(lines), lines);
    // start (e4), after 1...e5 (Nf3), after 2...Nc6 (Bc4), after 1...c5 (Nf3)
    expect(cards.map((c) => c.expected.join('/'))).toEqual(['e4', 'Nf3', 'Nf3', 'Bc4']);
    expect(cards.every((c) => c.color === 'w')).toBe(true);
  });
  it('merges cards reached by transposition and accepts every prepared move', () => {
    const lines = [line('a', 'e4 e5 Nf3 Nc6'), line('b', 'Nf3 e5 e4 d6')];
    const cards = buildCards(buildGraph(lines), lines);
    expect(cards.filter((c) => c.color === 'w').map((c) => c.expected.sort().join('/'))).toEqual(['Nf3/e4', 'Nf3', 'e4']);
  });
  it('builds black cards from black lines only', () => {
    const lines = [line('w', 'e4 e5'), line('b', 'e4 c5 Nf3 d6', 'b')];
    const cards = buildCards(buildGraph(lines), lines).filter((c) => c.color === 'b');
    expect(cards.map((c) => c.expected.join('/'))).toEqual(['c5', 'd6']);
    expect(cards[1]?.path).toEqual(['e4', 'c5', 'Nf3']);
  });
});

describe('upsertLine', () => {
  const id = () => 'new';
  it('extends a line that is a prefix', () => {
    const r = upsertLine([line('a', 'e4 e5')], { name: '', color: 'w', moves: ['e4', 'e5', 'Nf3'] }, id);
    expect(r.action).toBe('extended');
    expect(r.lines[0]?.moves).toEqual(['e4', 'e5', 'Nf3']);
  });
  it('recognises moves already covered', () => {
    expect(upsertLine([line('a', 'e4 e5 Nf3')], { name: '', color: 'w', moves: ['e4', 'e5'] }, id).action).toBe('exists');
  });
  it('adds a branch as a new line and normalizes SAN', () => {
    const r = upsertLine([line('a', 'e4 e5 Nf3')], { name: 'Scotch', color: 'w', moves: ['e4', 'e5', 'd4'] }, id);
    expect(r.action).toBe('added');
    expect(r.lines).toHaveLength(2);
    expect(upsertLine([], { name: '', color: 'w', moves: ['e2e4'] }, id).lines[0]?.moves).toEqual(['e4']);
  });
});

describe('fsrs schedule', () => {
  const at = 1_700_000_000_000;
  const grades: Grade[] = [1, 2, 3, 4];
  it('orders intervals Again < Hard < Good < Easy for a new card', () => {
    const p = previewIntervals({}, at);
    expect(p[1]).toBeLessThan(p[2]);
    expect(p[2]).toBeLessThan(p[3]);
    expect(p[3]).toBeLessThan(p[4]);
  });
  it('keeps the order at high difficulty (regression: Good used to be shorter than Hard)', () => {
    const card: SchedulingState = { stability: 10, difficulty: 10, reps: 6, lastReview: at - 10 * DAY, due: at };
    const p = previewIntervals(card, at);
    expect(p[2]).toBeLessThan(p[3]);
    expect(p[3]).toBeLessThan(p[4]);
    // A successful, unassisted recall never shrinks stability.
    expect(schedule(card, 3, at).stability).toBeGreaterThanOrEqual(10);
  });
  it('holds the ordering across a grid of states', () => {
    for (const stability of [0.2, 1, 5, 30, 200]) {
      for (const difficulty of [1, 4, 7, 9, 10]) {
        for (const elapsed of [0, 1, 10, 100]) {
          const card: SchedulingState = { stability, difficulty, reps: 3, lastReview: at - elapsed * DAY };
          const days = grades.map((g) => schedule(card, g, at).scheduledDays);
          expect(days[0]!).toBeLessThan(days[1]!);
          expect(days[1]!).toBeLessThan(days[2]!);
          expect(days[2]!).toBeLessThan(days[3]!);
        }
      }
    }
  });
  it('relearns a lapse in ten minutes and counts it', () => {
    const r = schedule({ stability: 5, reps: 3, lastReview: at - 5 * DAY }, 1, at);
    expect(r.scheduledDays * 1440).toBeCloseTo(10);
    expect(r.lapses).toBe(1);
    expect(r.due).toBe(at + 10 * 60_000);
  });
  it('shortens intervals for hinted or guessed answers', () => {
    const base = { stability: 5, difficulty: 5, reps: 3, lastReview: at - 5 * DAY };
    expect(schedule({ ...base, hinted: true }, 3, at).scheduledDays).toBeLessThan(schedule(base, 3, at).scheduledDays);
  });
  it('respects the maximum interval', () => {
    expect(schedule({ stability: 5000, difficulty: 1, reps: 20, lastReview: at - 5000 * DAY }, 4, at).scheduledDays).toBe(3650);
  });
  it('formats intervals and buckets due-ness', () => {
    expect(formatInterval(10 / 1440)).toBe('10 min');
    expect(formatInterval(0.5)).toBe('12 h');
    expect(formatInterval(2.4)).toBe('2.4 days');
    expect(formatInterval(1)).toBe('1 day');
    expect(heat(undefined, at)).toBe('new');
    expect(heat({ reps: 1, due: at - 2 * DAY }, at)).toBe('overdue');
    expect(heat({ reps: 1, due: at + DAY }, at)).toBe('soon');
    expect(heat({ reps: 1, due: at + 9 * DAY }, at)).toBe('fresh');
  });
});

describe('reviewGame', () => {
  const lines = [line('italian', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3')];
  const g = buildGraph(lines);
  const game = (moves: string, userColor: 'w' | 'b' = 'w'): GameRecord => ({ id: 'g', source: 'pgn', white: 'me', black: 'them', userColor, result: '*', playedAt: 0, moves: moves.split(' ') });

  it('attributes a deviation to the opponent', () => {
    const r = reviewGame(g, game('e4 e5 Nf3 d6 d4'));
    expect(r.verdict?.kind).toBe('opponent-sideline');
    expect(r.verdict?.ply).toBe(4);
    expect(r.verdict?.expected).toBe('Nc6');
    expect(r.lastBookPly).toBe(3);
  });
  it('attributes a deviation to you and flags a trained card', () => {
    const cards = { [cardId('w', normalizeFen(replay(['e4', 'e5', 'Nf3', 'Nc6']).fens[4]!))]: { reps: 3 } };
    const r = reviewGame(g, game('e4 e5 Nf3 Nc6 Bb5'), cards);
    expect(r.verdict?.kind).toBe('user-left-prep');
    expect(r.verdict?.played).toBe('Bb5');
    expect(r.verdict?.expected).toBe('Bc4');
    expect(r.verdict?.forgottenTrainedCard).toBe(true);
  });
  it('reports the end of preparation', () => {
    const r = reviewGame(g, game('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4'));
    expect(r.verdict?.kind).toBe('out-of-book');
    expect(r.verdict?.ply).toBe(8);
    expect(r.lastBookPly).toBe(7);
    expect(r.bestLineId).toBe('italian');
  });
  it('recognises a transposition back into the repertoire', () => {
    const r = reviewGame(g, game('Nf3 Nc6 e4 e5 Bc4 Bc5 c3'));
    expect(r.moments.some((m) => m.kind === 'known-transposition')).toBe(true);
    expect(r.lastBookPly).toBe(7);
  });
  it('handles an empty repertoire', () => {
    const r = reviewGame(buildGraph([]), game('e4 e5'));
    expect(r.verdict).toBeNull();
    expect(r.matches).toEqual([]);
  });
});

describe('pgn parsing', () => {
  it('strips numbers, comments, variations, NAGs and results', () => {
    expect(parseMoveText('1. e4 {best by test} e5 2. Nf3 (2. Bc4 Nf6 (2...Bc5)) Nc6!? $1 3...a6 1-0')).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'a6']);
    expect(parseMoveText('1.e4 e5 2.Nf3')).toEqual(['e4', 'e5', 'Nf3']);
  });
  it('reads headers and splits multi-game files', () => {
    const text = '[White "A"]\n[Black "B"]\n\n1. e4 e5 1-0\n\n[White "C"]\n[Black "D"]\n\n1. d4 d5 *\n';
    const games = splitPgnGames(text);
    expect(games).toHaveLength(2);
    expect(parsePgn(games[1]!).headers.White).toBe('C');
    expect(parsePgn(games[1]!).moves).toEqual(['d4', 'd5']);
  });
  it('formats moves plainly', () => {
    expect(formatMovesPlain(['e4', 'e5', 'Nf3'])).toBe('1.e4 e5 2.Nf3');
    expect(formatMovesPlain(['Nc6', 'Bb5'], 3)).toBe('2...Nc6 3.Bb5');
  });
});
