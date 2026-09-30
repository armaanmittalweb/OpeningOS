import { useState } from 'react';
import type { SchedulingState } from '../domain/fsrs';
import { isDue } from '../domain/fsrs';
import type { PracticeCard, RepLine } from '../domain/repertoire';
import { store } from '../lib/store';
import { MoveText } from '../ui/notation';
import { builder } from './builder';

interface Props {
  lines: RepLine[];
  cards: PracticeCard[];
  sched: Record<string, SchedulingState>;
  activeId: string | null;
}

export function LineList({ lines, cards, sched, activeId }: Props) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!lines.length) return null;
  return (
    <ol className="lines">
      {lines.map((l) => {
        const due = cards.filter((c) => c.lineIds.includes(l.id) && sched[c.id]?.reps && isDue(sched[c.id])).length;
        return (
          <li key={l.id} className={l.id === activeId ? 'is-active' : undefined}>
            <div className="line-head">
              <button type="button" className="line-name" onClick={() => builder.load(l.moves, l.color, l.name)}>
                {l.name}
              </button>
              {due > 0 && <span className="due-tag">{due} due</span>}
              {confirm === l.id ? (
                <span className="line-confirm">
                  Delete this line?{' '}
                  <button type="button" className="link" onClick={() => store.deleteLine(l.id)}>
                    Delete
                  </button>{' '}
                  <button type="button" className="link" onClick={() => setConfirm(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" className="link line-del" aria-label={`Delete ${l.name}`} onClick={() => setConfirm(l.id)}>
                  Delete
                </button>
              )}
            </div>
            <MoveText moves={l.moves} className="is-small" />
          </li>
        );
      })}
    </ol>
  );
}
