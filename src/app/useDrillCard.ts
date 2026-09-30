import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { previewIntervals, type Grade, type SchedulingResult, type SchedulingState } from '../domain/fsrs';
import { replay, type PracticeCard } from '../domain/repertoire';
import type { Arrow } from '../ui/Board';

export type DrillPhase = 'ask' | 'correct' | 'graded';
export type GradeFn = (card: PracticeCard, grade: Grade, meta: { hinted: boolean; played: string; durationMs: number }) => SchedulingResult;

/**
 * One practice card: you get the position after your opponent's move and
 * must play your prepared reply. A wrong move or a revealed answer is graded
 * Again at once; a correct one lets you pick Hard / Good / Easy.
 */
export function useDrillCard(card: PracticeCard | null, state: SchedulingState | undefined, grade: GradeFn) {
  const [phase, setPhase] = useState<DrillPhase>('ask');
  const [played, setPlayed] = useState<{ san: string; from: string; to: string; fen: string } | null>(null);
  const [wrong, setWrong] = useState(false);
  const [hint, setHint] = useState(0);
  const [result, setResult] = useState<{ grade: Grade; next: SchedulingResult } | null>(null);
  const started = useRef(Date.now());

  useEffect(() => {
    setPhase('ask');
    setPlayed(null);
    setWrong(false);
    setHint(0);
    setResult(null);
    started.current = Date.now();
  }, [card?.id]);

  const intervals = useMemo(() => previewIntervals({ ...state, hinted: hint > 0 }), [state, hint, card?.id]);
  const lastMove = useMemo(() => {
    if (!card?.path.length) return null;
    const uci = replay(card.path).uci.at(-1);
    return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null;
  }, [card]);
  const expected = card?.expectedUci[0] ?? '';

  const doGrade = (g: Grade, san = played?.san ?? '') => {
    if (!card) return;
    const next = grade(card, g, { hinted: hint > 0, played: san, durationMs: Date.now() - started.current });
    setResult({ grade: g, next });
    setPhase('graded');
  };

  const onMove = (from: string, to: string, promotion?: string): boolean => {
    if (!card || phase !== 'ask') return false;
    const chess = new Chess(card.fen);
    let m;
    try {
      m = chess.move(promotion ? { from, to, promotion } : { from, to });
    } catch {
      return false;
    }
    const uci = m.from + m.to + (m.promotion ?? '');
    setPlayed({ san: m.san, from: m.from, to: m.to, fen: chess.fen() });
    if (card.expectedUci.includes(uci)) {
      setPhase('correct');
    } else {
      setWrong(true);
      doGrade(1, m.san);
    }
    return true;
  };

  const onSan = (san: string): string | null => {
    if (!card) return null;
    try {
      const m = new Chess(card.fen).move(san.replace(/[+#!?]+$/, ''), { strict: false });
      onMove(m.from, m.to, m.promotion);
      return null;
    } catch {
      return `“${san}” is not a legal move here.`;
    }
  };

  const arrows: Arrow[] = [];
  const marks: Record<string, 'good' | 'bad' | 'hint'> = {};
  if (card && wrong && played) arrows.push({ from: played.from, to: played.to, tone: 'played' });
  if (card && (wrong || (phase === 'graded' && !played))) arrows.push({ from: expected.slice(0, 2), to: expected.slice(2, 4), tone: 'expected' });
  if (phase === 'ask' && hint >= 1) marks[expected.slice(0, 2)] = 'hint';
  if (phase === 'ask' && hint >= 2) marks[expected.slice(2, 4)] = 'hint';
  if (!wrong && played) marks[played.to] = 'good';

  return {
    phase,
    wrong,
    hinted: hint > 0,
    played,
    result,
    intervals,
    fen: !wrong && played ? played.fen : (card?.fen ?? ''),
    lastMove: !wrong && played ? { from: played.from, to: played.to } : lastMove,
    arrows,
    marks,
    onMove,
    onSan,
    grade: doGrade,
    hint: () => setHint((h) => Math.min(2, h + 1)),
    reveal: () => {
      setWrong(false);
      doGrade(1, '');
    },
  };
}
