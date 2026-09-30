import type { GameRecord, GameReview as Review } from '../domain/review';
import { figurine, moveNumber, MoveText } from '../ui/notation';

export function verdictText(r: Review, g: GameRecord): { tone: 'bad' | 'warn' | 'ok' | 'none'; text: string } {
  const v = r.verdict;
  const at = (ply: number, san: string) => `${moveNumber(ply - 1, true)}${figurine(san)}`;
  if (!r.matches.length && !v) return { tone: 'none', text: 'Not in your repertoire.' };
  if (!v) return { tone: 'ok', text: `Stayed in your preparation through ${at(r.lastBookPly, g.moves[r.lastBookPly - 1] ?? '')}.` };
  if (v.kind === 'user-left-prep') return { tone: 'bad', text: `You left your preparation at ${at(v.ply, v.played ?? '')}.` };
  if (v.kind === 'opponent-sideline') return { tone: 'warn', text: `Your opponent left it at ${at(v.ply, v.played ?? '')}.` };
  return { tone: 'ok', text: `Played your preparation to the end (${r.lastBookPly} plies).` };
}

interface Props {
  game: GameRecord;
  review: Review;
  cursor: number;
  onSelect: (plies: number) => void;
  onDrill: () => void;
  onExtend: () => void;
}

export function GameReviewPanel({ game, review, cursor, onSelect, onDrill, onExtend }: Props) {
  const v = review.verdict;
  const vt = verdictText(review, game);
  const devIndex = v && v.kind !== 'out-of-book' ? v.ply - 1 : -1;
  const shown = game.moves.slice(0, Math.max(40, cursor));
  return (
    <div className="review fade-in" key={game.id}>
      <p className="label">Review</p>
      <h2 className="title">
        {game.white} – {game.black} <span className="meta">{game.result}</span>
      </h2>
      {game.opening && <p className="meta">{game.opening}</p>}
      <p className={`verdict is-${vt.tone}`}>{vt.text}</p>
      {v?.kind === 'user-left-prep' && (
        <p>
          You prepared <strong>{v.expected?.split(' / ').map(figurine).join(' or ')}</strong>
          {v.forgottenTrainedCard ? ', and you had already drilled this position. It goes back into the queue.' : '.'}
        </p>
      )}
      {v?.kind === 'opponent-sideline' && (
        <p>
          You have prepared {v.expected?.split(' / ').map(figurine).join(', ')} here. Add a reply to {figurine(v.played ?? '')} so you are ready next time.
        </p>
      )}
      {review.moments.some((m) => m.kind === 'known-transposition') && <p className="meta">The game reached your preparation by transposition.</p>}
      <MoveText
        moves={shown}
        cursor={cursor}
        onSelect={onSelect}
        label="Game moves"
        markFor={(i) => (i === devIndex ? 'is-dev' : i >= review.lastBookPly && i !== devIndex ? 'is-out' : undefined)}
      />
      {game.moves.length > shown.length && <p className="meta">…{game.moves.length - shown.length} more plies</p>}
      <div className="row">
        {v?.kind === 'user-left-prep' && (
          <button type="button" className="btn btn-ink" onClick={onDrill}>
            Drill this position
          </button>
        )}
        {v?.kind === 'opponent-sideline' && (
          <button type="button" className="btn btn-ink" onClick={onExtend}>
            Prepare a reply
          </button>
        )}
        {game.url && (
          <a className="link" href={game.url} target="_blank" rel="noreferrer noopener">
            Open on {game.source === 'lichess' ? 'Lichess' : 'Chess.com'}
          </a>
        )}
      </div>
    </div>
  );
}
