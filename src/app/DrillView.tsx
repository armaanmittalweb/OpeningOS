import { useMemo, useRef, useState } from 'react';
import { formatInterval } from '../domain/fsrs';
import type { PracticeCard } from '../domain/repertoire';
import { dueQueue, store, useDerived, useStore } from '../lib/store';
import { Board } from '../ui/Board';
import { DrillPanel } from '../ui/DrillPanel';
import { navigate } from './router';
import { useDrillCard } from './useDrillCard';
import { useKeys } from './useKeys';

const SESSION = 20;

export function DrillView() {
  const lines = useStore((s) => s.data.lines);
  const sched = useStore((s) => s.data.cards);
  const { cards } = useDerived();
  const [session, setSession] = useState<{ ids: string[]; i: number; misses: number } | null>(null);
  const [typed, setTyped] = useState('');
  const [typeErr, setTypeErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const queue = useMemo(() => dueQueue(cards, sched), [cards, sched]);
  const card: PracticeCard | null = session ? (byId.get(session.ids[session.i] ?? '') ?? null) : null;
  const d = useDrillCard(card, card ? sched[card.id] : undefined, (c, g, meta) => {
    if (g === 1 && session) setSession({ ...session, misses: session.misses + 1 });
    return store.grade(c, g, meta);
  });

  const start = (list: PracticeCard[]) => setSession({ ids: list.slice(0, SESSION).map((c) => c.id), i: 0, misses: 0 });
  const next = () => session && setSession({ ...session, i: session.i + 1 });
  const done = session && session.i >= session.ids.length;

  useKeys((e) => {
    if (!card) {
      if (e.key === 'Enter' && queue.length && !session) start(queue);
      return;
    }
    if (d.phase === 'ask' && e.key === 'h') d.hint();
    else if (d.phase === 'ask' && e.key === 's') d.reveal();
    else if (d.phase === 'correct' && /^[1-4]$/.test(e.key)) d.grade(Number(e.key) as 1 | 2 | 3 | 4);
    else if (d.phase === 'graded' && e.key === 'Enter') {
      e.preventDefault();
      next();
    } else if (d.phase === 'ask' && /^[a-hKQRBNO]$/.test(e.key)) {
      e.preventDefault();
      setTyped(e.key);
      inputRef.current?.focus();
    }
  });

  const upcoming = cards
    .map((c) => sched[c.id]?.due)
    .filter((t): t is number => !!t && t > Date.now())
    .sort((a, b) => a - b)[0];
  const lineName = (c: PracticeCard) => lines.find((l) => l.id === c.lineIds[0])?.name ?? 'Repertoire';

  return (
    <div className="table">
      <section className="table-board" aria-label="Board">
        <Board
          fen={card ? d.fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
          orientation={card?.color ?? 'w'}
          lastMove={card ? d.lastMove : null}
          onMove={card && d.phase === 'ask' ? d.onMove : undefined}
          movable={card?.color ?? 'both'}
          arrows={d.arrows}
          marks={d.marks}
          label={card ? `Drill position. Your move as ${card.color === 'w' ? 'White' : 'Black'}.` : 'Board'}
        />
        {card && d.phase === 'ask' && (
          <form
            className="move-entry"
            onSubmit={(e) => {
              e.preventDefault();
              setTypeErr(d.onSan(typed));
              setTyped('');
            }}
          >
            <label htmlFor="drill-input" className="sr-only">
              Type your move
            </label>
            <input id="drill-input" ref={inputRef} className="input" value={typed} autoComplete="off" spellCheck={false} placeholder="Or type it: Bc4" onChange={(e) => setTyped(e.target.value)} />
            <button type="submit" className="btn">
              Play
            </button>
          </form>
        )}
        {typeErr && d.phase === 'ask' && <p className="status is-error">{typeErr}</p>}
      </section>

      <section className="table-page" aria-labelledby="drill-title">
        <div className="page-head">
          <h1 id="drill-title" className="label">
            Drill
          </h1>
          {session && !done && (
            <p className="meta">
              Card {session.i + 1} of {session.ids.length}
            </p>
          )}
        </div>
        {session && !done && (
          <ol className="ticks" aria-hidden="true">
            {session.ids.map((id, i) => (
              <li key={id} className={i < session.i ? 'is-done' : i === session.i ? 'is-now' : undefined} />
            ))}
          </ol>
        )}

        {card && !done && <DrillPanel card={card} lineName={lineName(card)} d={d} onNext={next} />}

        {!session && lines.length === 0 && (
          <div className="empty">
            <p className="display">Nothing to practise yet.</p>
            <p className="lede">Drills come from your repertoire: every position where it is your move becomes a card, scheduled with FSRS.</p>
            <div className="row">
              <button type="button" className="btn" onClick={() => store.loadDemo()}>
                Load the Italian Game demo
              </button>
              <button type="button" className="link" onClick={() => navigate('repertoire')}>
                Build a line
              </button>
            </div>
          </div>
        )}

        {!session && lines.length > 0 && (
          <div className="empty">
            {queue.length ? (
              <>
                <p className="display">
                  {queue.length} {queue.length === 1 ? 'card is' : 'cards are'} waiting.
                </p>
                <p className="lede">
                  {queue.filter((c) => sched[c.id]?.reps).length} due for review, {queue.filter((c) => !sched[c.id]?.reps).length} new. Sessions are up to {SESSION} cards.
                </p>
                <button type="button" className="btn btn-due" onClick={() => start(queue)}>
                  Start drill <span className="kbd kbd-inv">↵</span>
                </button>
              </>
            ) : (
              <>
                <p className="display">All caught up.</p>
                <p className="lede">Nothing is due{upcoming ? `; the next card comes back in ${formatInterval((upcoming - Date.now()) / 86_400_000)}` : ''}. Practising early is allowed but makes the schedule less accurate.</p>
                <button type="button" className="btn" onClick={() => start([...cards].sort((a, b) => (sched[a.id]?.due ?? 0) - (sched[b.id]?.due ?? 0)).slice(0, 10))}>
                  Practise ahead
                </button>
              </>
            )}
          </div>
        )}

        {done && session && (
          <div className="empty fade-in">
            <p className="display">Session complete.</p>
            <p className="lede">
              {session.ids.length - session.misses} of {session.ids.length} recalled. Missed cards come back in ten minutes.
            </p>
            <div className="row">
              <button type="button" className="btn btn-ink" onClick={() => setSession(null)}>
                Done
              </button>
              <button type="button" className="link" onClick={() => navigate('graph')}>
                See the graph
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
