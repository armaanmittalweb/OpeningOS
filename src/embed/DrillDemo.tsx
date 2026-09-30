import { useMemo, useState } from 'react';
import { schedule, type SchedulingState } from '../domain/fsrs';
import { useDrillCard } from '../app/useDrillCard';
import { verdictText } from '../app/GameReview';
import { demoGames } from '../lib/demo';
import { Board } from '../ui/Board';
import { DrillPanel } from '../ui/DrillPanel';
import { MoveText } from '../ui/notation';
import { reviewDemo, setupDrill, timed, type StageEvent } from './pipeline';
import { useKeys } from '../app/useKeys';

/** Five cards from the Italian demo, scheduled in memory (the embed never touches the app's storage). */
export function DrillDemo({ run, emit, onRestart }: { run: number; emit: (e: StageEvent) => void; onRestart: () => void }) {
  const setup = useMemo(() => setupDrill(emit), [run]);
  const [i, setI] = useState(0);
  const [sched, setSched] = useState<Record<string, SchedulingState>>({});
  const card = setup.cards[i] ?? null;
  const d = useDrillCard(card, card ? sched[card.id] : undefined, (c, g, meta) => {
    const next = timed(4, emit, () => schedule({ ...sched[c.id], hinted: meta.hinted }, g));
    setSched((s) => ({ ...s, [c.id]: next }));
    return next;
  });
  const review = useMemo(() => (i >= setup.cards.length ? reviewDemo(setup, emit) : null), [i >= setup.cards.length, setup]);
  const game = demoGames()[0]!;

  useKeys((e) => {
    if (!card || review) return;
    if (d.phase === 'ask' && e.key === 'h') d.hint();
    else if (d.phase === 'ask' && e.key === 's') d.reveal();
    else if (d.phase === 'correct' && /^[1-4]$/.test(e.key)) d.grade(Number(e.key) as 1 | 2 | 3 | 4);
    else if (d.phase === 'graded' && e.key === 'Enter') {
      e.preventDefault();
      setI(i + 1);
    }
  });

  if (review) {
    const vt = verdictText(review.review, game);
    const dev = review.review.verdict?.ply ?? 0;
    return (
      <div className="embed-grid">
        <div className="embed-board">
          <Board fen={review.review.verdict?.fenBefore ?? setup.cards[0]!.fen} label="Game review position" coordinates={false} arrows={[]} />
        </div>
        <div className="embed-side">
          <p className="label">Game review</p>
          <p className={`verdict is-${vt.tone}`}>{vt.text}</p>
          <p className="meta">You prepared {review.review.verdict?.expected}. The card for this position goes back into your queue.</p>
          <MoveText moves={review.moves.slice(0, dev + 2)} className="is-small" markFor={(k) => (k === dev - 1 ? 'is-dev' : k >= dev ? 'is-out' : undefined)} />
          <button type="button" className="btn btn-ink" onClick={onRestart}>
            Run it again
          </button>
        </div>
      </div>
    );
  }
  if (!card) return null;
  return (
    <div className="embed-grid">
      <div className="embed-board">
        <Board fen={d.fen} lastMove={d.lastMove} onMove={d.phase === 'ask' ? d.onMove : undefined} movable="w" arrows={d.arrows} marks={d.marks} label="Drill board. Your move as White." coordinates={false} />
      </div>
      <div className="embed-side">
        <ol className="ticks" aria-label={`Card ${i + 1} of ${setup.cards.length}`}>
          {setup.cards.map((c, k) => (
            <li key={c.id} className={k < i ? 'is-done' : k === i ? 'is-now' : undefined} />
          ))}
        </ol>
        <DrillPanel card={card} lineName={setup.lines.find((l) => l.id === card.lineIds[0])?.name ?? 'Italian Game'} d={d} onNext={() => setI(i + 1)} compact />
      </div>
    </div>
  );
}
