import { useMemo, useState } from 'react';
import { parsePgn, splitPgnGames } from '../domain/pgn';
import { reviewGame, type GameRecord } from '../domain/review';
import { cardId, replay } from '../domain/repertoire';
import { normalizeFen } from '../domain/graph';
import { importChessCom, importLichess, ImportError } from '../lib/imports';
import { store, useDerived, useStore } from '../lib/store';
import { Board } from '../ui/Board';
import { EngineStrip } from '../ui/EngineStrip';
import { builder, fenAt, lastMoveAt } from './builder';
import { GameReviewPanel, verdictText } from './GameReview';
import { navigate } from './router';
import { stepKeys, useKeys } from './useKeys';

type Source = 'lichess' | 'chesscom' | 'pgn';
const SOURCE_NAME: Record<Source, string> = { lichess: 'Lichess', chesscom: 'Chess.com', pgn: 'PGN' };

function ago(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function GamesView() {
  const games = useStore((s) => s.data.games);
  const sched = useStore((s) => s.data.cards);
  const settings = useStore((s) => s.settings);
  const { graphs } = useDerived();
  const [source, setSource] = useState<Source>(settings.importSource);
  const [user, setUser] = useState(settings.importUser);
  const [pgn, setPgn] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  const reviews = useMemo(() => new Map(games.map((g) => [g.id, reviewGame(graphs[g.userColor], g, sched)])), [games, graphs, sched]);
  const game = games.find((g) => g.id === selId) ?? null;
  const review = game ? reviews.get(game.id) : undefined;

  const select = (g: GameRecord) => {
    setSelId(g.id);
    const r = reviews.get(g.id);
    setCursor(r?.verdict ? r.verdict.ply : Math.min(g.moves.length, r?.lastBookPly ?? 0));
  };

  useKeys((e) => {
    if (game) stepKeys(e, (dl) => setCursor((c) => Math.max(0, Math.min(game.moves.length, c + dl))), setCursor, game.moves.length);
  });

  const runImport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      let found: GameRecord[];
      if (source === 'pgn') {
        found = splitPgnGames(pgn).map((text, i) => {
          const { headers, moves } = parsePgn(text);
          return { id: `pgn:${Date.now().toString(36)}:${i}`, source: 'pgn' as const, white: headers.White ?? 'White', black: headers.Black ?? 'Black', userColor: 'w' as const, result: headers.Result ?? '*', playedAt: Date.now(), moves: replay(moves).sans, ...(headers.Opening ? { opening: headers.Opening } : {}) };
        }).filter((g) => g.moves.length > 0);
        if (!found.length) throw new ImportError('No games found in that PGN.', 'empty');
      } else {
        const name = user.trim();
        if (!name) throw new ImportError('Enter a username.', 'empty');
        store.setSettings({ importUser: name, importSource: source });
        found = source === 'lichess' ? await importLichess(name, 30) : await importChessCom(name, 30);
      }
      const added = store.addGames(found);
      setMsg({ tone: 'ok', text: found.length ? `Imported ${added} new ${added === 1 ? 'game' : 'games'}${found.length > added ? ` (${found.length - added} already here)` : ''}.` : 'No standard games found.' });
      if (source === 'pgn') setPgn('');
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ImportError ? e.message : 'Something went wrong while importing.' });
    } finally {
      setBusy(false);
    }
  };

  const fen = game ? fenAt(game.moves, cursor) : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  return (
    <div className="table">
      <section className="table-board" aria-label="Board">
        <Board fen={fen} orientation={game?.userColor ?? 'w'} lastMove={game ? lastMoveAt(game.moves, cursor) : null} label="Game position" />
        {game && (
          <p className="caption">
            <button type="button" className="link" onClick={() => setCursor((c) => Math.max(0, c - 1))} aria-label="Previous move">
              ← Back
            </button>
            <span className="caption-sep"> · </span>
            Ply {cursor} of {game.moves.length}
            <span className="caption-sep"> · </span>
            <button type="button" className="link" onClick={() => setCursor((c) => Math.min(game.moves.length, c + 1))} aria-label="Next move">
              Forward →
            </button>
          </p>
        )}
        <EngineStrip fen={fen} />
      </section>
      <section className="table-page" aria-labelledby="games-title">
        <div className="page-head">
          <h1 id="games-title" className="label">
            Games
          </h1>
          <p className="meta">{games.length} imported</p>
        </div>
        <p className="display">Your games against your preparation.</p>

        <form
          className="block import"
          onSubmit={(e) => {
            e.preventDefault();
            void runImport();
          }}
        >
          <div className="seg" role="group" aria-label="Import from">
            {(['lichess', 'chesscom', 'pgn'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(s)}>
                {SOURCE_NAME[s]}
              </button>
            ))}
          </div>
          {source === 'pgn' ? (
            <>
              <label htmlFor="pgn-input" className="sr-only">
                PGN
              </label>
              <textarea id="pgn-input" className="input textarea" rows={4} value={pgn} placeholder="Paste one or more games in PGN" onChange={(e) => setPgn(e.target.value)} />
            </>
          ) : (
            <>
              <label htmlFor="user-input" className="sr-only">
                {SOURCE_NAME[source]} username
              </label>
              <input id="user-input" className="input" value={user} autoComplete="off" spellCheck={false} placeholder={`${SOURCE_NAME[source]} username`} onChange={(e) => setUser(e.target.value)} />
            </>
          )}
          <button type="submit" className="btn btn-ink" disabled={busy}>
            {busy ? `Fetching from ${SOURCE_NAME[source]}…` : source === 'pgn' ? 'Import PGN' : 'Import last 30 games'}
          </button>
          <p className={`status ${msg?.tone === 'err' ? 'is-error' : ''}`} role="status">
            {msg?.text ?? ''}
          </p>
        </form>

        {game && review && (
          <GameReviewPanel
            game={game}
            review={review}
            cursor={cursor}
            onSelect={setCursor}
            onDrill={() => {
              const v = review.verdict;
              if (v?.fenBefore) store.requeue(cardId(game.userColor, normalizeFen(v.fenBefore)));
              navigate('drill');
            }}
            onExtend={() => {
              builder.load(game.moves.slice(0, review.verdict?.ply ?? 0), game.userColor);
              navigate('repertoire');
            }}
          />
        )}

        <div className="block">
          <h2 className="label">Imported</h2>
          {games.length === 0 ? (
            <p className="meta">No games yet. Import yours by username; both sites allow it without signing in.</p>
          ) : (
            <ul className="games">
              {games.map((g) => {
                const r = reviews.get(g.id);
                const vt = r ? verdictText(r, g) : { tone: 'none', text: '' };
                const opp = g.userColor === 'w' ? g.black : g.white;
                return (
                  <li key={g.id}>
                    <button type="button" className={`game-row${g.id === selId ? ' is-active' : ''}`} aria-current={g.id === selId ? 'true' : undefined} onClick={() => select(g)}>
                      <span className="game-vs">
                        <span className={`side side-${g.userColor}`} aria-label={g.userColor === 'w' ? 'You had White' : 'You had Black'} /> vs {opp}
                      </span>
                      <span className="meta">
                        {g.result} · {g.speed ? `${g.speed} · ` : ''}
                        {ago(g.playedAt)}
                      </span>
                      <span className={`game-verdict is-${vt.tone}`}>{vt.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
