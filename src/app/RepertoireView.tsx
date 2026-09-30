import { useMemo, useRef, useState } from 'react';
import { normalizeFen } from '../domain/graph';
import { incoming, outgoing } from '../domain/repertoire';
import { store, useDerived, useStore } from '../lib/store';
import { Board } from '../ui/Board';
import { EngineStrip } from '../ui/EngineStrip';
import { figurine, MoveText } from '../ui/notation';
import { builder, fenAt, lastMoveAt, useBuilder } from './builder';
import { LineList } from './LineList';
import { stepKeys, useKeys } from './useKeys';

const COLOR_NAME = { w: 'White', b: 'Black' } as const;

export function RepertoireView() {
  const b = useBuilder();
  const lines = useStore((s) => s.data.lines);
  const sched = useStore((s) => s.data.cards);
  const { graphs, cards } = useDerived();
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fen = fenAt(b.moves, b.cursor);
  const g = graphs[b.color];
  const key = normalizeFen(fen);
  const node = g.positions[key];
  const next = node ? outgoing(g, key) : [];
  const parents = node ? new Set(incoming(g, key).map((e) => e.fromPositionId)).size : 0;
  const myLines = useMemo(() => lines.filter((l) => l.color === b.color), [lines, b.color]);
  const myCards = cards.filter((c) => c.color === b.color);
  const activeId = myLines.find((l) => l.moves.length >= b.moves.length && b.moves.every((m, i) => l.moves[i] === m))?.id ?? null;
  const covered = activeId !== null && b.moves.length > 0;
  const orientation = b.flipped ? (b.color === 'w' ? 'b' : 'w') : b.color;
  const myTurn = fen.split(' ')[1] === b.color;

  const play = (m: Parameters<typeof builder.play>[0]) => {
    const err = builder.play(m);
    setMsg(err ? { tone: 'err', text: err } : null);
    return !err;
  };

  const save = () => {
    const r = store.saveLine({ name: b.name, color: b.color, moves: b.moves });
    const name = store.get().data.lines.find((l) => l.id === r.lineId)?.name ?? 'line';
    setMsg({ tone: 'ok', text: r.action === 'added' ? `Saved as “${name}”.` : r.action === 'extended' ? `Extended “${name}”.` : `Already covered by “${name}”.` });
  };

  useKeys((e) => {
    if (stepKeys(e, builder.step, builder.goto, b.moves.length)) return;
    if (e.key === 'f') builder.flip();
    else if (e.key === '/' || /^[a-hKQRBNO]$/.test(e.key)) {
      // Keyboard move entry: start typing anywhere.
      e.preventDefault();
      inputRef.current?.focus();
      if (e.key !== '/') setDraft(e.key);
    }
  });

  return (
    <div className="table">
      <section className="table-board" aria-label="Board">
        <Board
          fen={fen}
          orientation={orientation}
          lastMove={lastMoveAt(b.moves, b.cursor)}
          onMove={(from, to, promotion) => play(promotion ? { from, to, promotion } : { from, to })}
          label={`Board, ${fen.split(' ')[1] === 'w' ? 'White' : 'Black'} to move. Type a move in the move field to play it.`}
        />
        <p className="caption">
          {b.cursor === 0 ? 'Starting position' : <>Position after <MoveText moves={b.moves.slice(b.cursor - 1, b.cursor)} startPly={b.cursor - 1} className="inline" /></>}
          <span className="caption-sep"> · </span>
          <button type="button" className="link" onClick={builder.flip}>
            Flip board
          </button>
        </p>
        <EngineStrip fen={fen} />
      </section>

      <section className="table-page" aria-labelledby="rep-title">
        <div className="page-head">
          <div className="seg" role="group" aria-label="Repertoire colour">
            {(['w', 'b'] as const).map((c) => (
              <button key={c} type="button" aria-pressed={b.color === c} onClick={() => builder.setColor(c)}>
                {COLOR_NAME[c]}
              </button>
            ))}
          </div>
          <p className="meta">
            {myLines.length} {myLines.length === 1 ? 'line' : 'lines'} · {myCards.length} practice {myCards.length === 1 ? 'card' : 'cards'}
          </p>
        </div>
        <h1 id="rep-title" className="display">
          {COLOR_NAME[b.color]} repertoire
        </h1>

        {lines.length === 0 && b.moves.length === 0 && (
          <div className="empty fade-in">
            <p className="title">An empty study table.</p>
            <p className="lede">Play a move on the board, or just start typing one (e4, d4, Nf3), to begin your first line. Every position where it is your move becomes a practice card.</p>
            <button type="button" className="btn" onClick={() => store.loadDemo()}>
              Load the Italian Game demo
            </button>
          </div>
        )}

        <div className="block">
          <h2 className="label">Current line</h2>
          {b.moves.length ? (
            <MoveText moves={b.moves} cursor={b.cursor} onSelect={builder.goto} label="Current line" />
          ) : (
            <p className="movetext placeholder">No moves yet.</p>
          )}
          <form
            className="move-entry"
            onSubmit={(e) => {
              e.preventDefault();
              const tokens = draft.trim().split(/\s+/).filter(Boolean);
              for (const t of tokens) if (!play(t.replace(/^\d+\.+/, ''))) return;
              setDraft('');
            }}
          >
            <label htmlFor="move-input" className="sr-only">
              Type a move
            </label>
            <input
              id="move-input"
              ref={inputRef}
              className="input"
              value={draft}
              autoComplete="off"
              spellCheck={false}
              placeholder="Type a move: e4, Nf3, O-O"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') inputRef.current?.blur();
              }}
            />
            <button type="submit" className="btn">
              Play
            </button>
          </form>
          <div className="row">
            <label htmlFor="line-name" className="sr-only">
              Line name
            </label>
            <input id="line-name" className="input input-name" value={b.name} placeholder="Line name (optional)" onChange={(e) => builder.setName(e.target.value)} />
            <button type="button" className="btn btn-ink" disabled={!b.moves.length || covered} onClick={save}>
              Save line
            </button>
            <button type="button" className="link" disabled={!b.moves.length} onClick={builder.clear}>
              Clear
            </button>
          </div>
          <p className={`status ${msg?.tone === 'err' ? 'is-error' : ''}`} role="status">
            {msg?.text ?? (covered ? 'This line is in your repertoire.' : b.moves.length ? 'Not saved yet.' : '')}
          </p>
        </div>

        {node && (
          <div className="block fade-in" key={key}>
            <h2 className="label">This position</h2>
            <p>
              {parents > 1 ? (
                <>
                  <strong>Transposition.</strong> Reached by {parents} different move orders in your repertoire; they share one node and one practice card.
                </>
              ) : b.cursor === 0 ? (
                'The starting position.'
              ) : (
                'In your repertoire.'
              )}
            </p>
            {next.length > 0 && (
              <p className="next-moves">
                <span className="meta">{myTurn ? (next.length > 1 ? 'Your prepared moves: ' : 'Your prepared move: ') : 'Replies you have prepared: '}</span>
                {next.map((e) => (
                  <button key={e.id} type="button" className="chip" onClick={() => play(e.san)}>
                    {figurine(e.san)}
                  </button>
                ))}
              </p>
            )}
            {next.length === 0 && <p className="meta">Your preparation ends here.</p>}
          </div>
        )}

        <div className="block">
          <h2 className="label">Lines</h2>
          {myLines.length ? (
            <LineList lines={myLines} cards={cards} sched={sched} activeId={activeId} />
          ) : (
            <p className="meta">No {COLOR_NAME[b.color].toLowerCase()} lines yet.</p>
          )}
        </div>
        <p className="shortcuts meta">
          <span className="kbd">←</span> <span className="kbd">→</span> step through moves · type to enter a move · <span className="kbd">F</span> flip
        </p>
      </section>
    </div>
  );
}

