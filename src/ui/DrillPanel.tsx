import { formatInterval, type Grade } from '../domain/fsrs';
import type { PracticeCard } from '../domain/repertoire';
import type { useDrillCard } from '../app/useDrillCard';
import { figurine, MoveText } from './notation';

const GRADES: Array<{ g: Grade; name: string }> = [
  { g: 1, name: 'Again' },
  { g: 2, name: 'Hard' },
  { g: 3, name: 'Good' },
  { g: 4, name: 'Easy' },
];

function dueDate(ms: number): string {
  const d = new Date(ms);
  const days = (ms - Date.now()) / 86_400_000;
  if (days < 1) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

interface Props {
  card: PracticeCard;
  lineName: string;
  d: ReturnType<typeof useDrillCard>;
  onNext: () => void;
  compact?: boolean;
}

/** Prompt, verdict, grade buttons (labelled with the interval each would give) and the scheduled result. */
export function DrillPanel({ card, lineName, d, onNext, compact = false }: Props) {
  const side = card.color === 'w' ? 'White' : 'Black';
  const expected = card.expected.map(figurine).join(' or ');
  const ply = card.path.length;
  const moveNo = Math.floor(ply / 2) + 1;
  const expectedLabel = `${moveNo}.${ply % 2 ? '..' : ''}${expected}`;
  return (
    <div className="drill" aria-live="polite">
      <p className="label">{lineName}</p>
      <h2 className={compact ? 'title' : 'display'}>
        {d.phase === 'ask' ? `Your move as ${side}.` : d.phase === 'correct' ? 'Correct.' : d.wrong ? 'Not your move here.' : d.played ? 'Recorded.' : 'The answer.'}
      </h2>
      <MoveText
        moves={d.played && !d.wrong ? [...card.path, d.played.san] : card.path}
        trailing={d.played && !d.wrong ? undefined : '?'}
        className={compact ? 'is-small' : ''}
        label="Moves to this position"
      />

      {d.phase === 'ask' && (
        <div className="row drill-help">
          <button type="button" className="link" onClick={d.hint}>
            {d.hinted ? 'Another hint' : 'Hint'} <span className="kbd">H</span>
          </button>
          <button type="button" className="link" onClick={d.reveal}>
            Show answer <span className="kbd">S</span>
          </button>
        </div>
      )}

      {d.wrong && d.played && (
        <p className="verdict is-bad">
          You played {figurine(d.played.san)}. Your repertoire plays <strong>{expectedLabel}</strong>.
        </p>
      )}
      {d.phase === 'graded' && !d.played && <p className="verdict">Your repertoire plays <strong>{expectedLabel}</strong>.</p>}

      {d.phase === 'correct' && (
        <div className="grades" role="group" aria-label="How well did you know it?">
          {GRADES.map(({ g, name }) => (
            <button key={g} type="button" className={`grade${g === (d.hinted ? 2 : 3) ? ' is-suggested' : ''}`} onClick={() => d.grade(g)}>
              <span className="grade-name">
                {name} <span className="kbd">{g}</span>
              </span>
              <span className="grade-int">{formatInterval(d.intervals[g])}</span>
            </button>
          ))}
        </div>
      )}

      {d.phase === 'graded' && d.result && (
        <div className="scheduled fade-in">
          <p className="label">FSRS schedule</p>
          <p className="scheduled-int">
            Next review in <strong>{formatInterval(d.result.next.scheduledDays)}</strong>
          </p>
          <p className="meta">
            {d.result.grade === 1 ? 'Again' : GRADES[d.result.grade - 1]?.name} · due {dueDate(d.result.next.due)} · stability {d.result.next.stability.toFixed(1)} d
          </p>
          <button type="button" className="btn btn-ink" onClick={onNext} autoFocus>
            Next card <span className="kbd kbd-inv">↵</span>
          </button>
        </div>
      )}
    </div>
  );
}
