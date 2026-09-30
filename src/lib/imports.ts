import { parsePgn } from '../domain/pgn';
import type { GameRecord } from '../domain/review';

export class ImportError extends Error {
  constructor(message: string, readonly kind: 'not-found' | 'rate-limited' | 'network' | 'empty') {
    super(message);
  }
}

type Fetch = typeof fetch;

async function get(url: string, f: Fetch, accept = 'application/json'): Promise<Response> {
  let res: Response;
  try {
    res = await f(url, { headers: { Accept: accept } });
  } catch {
    throw new ImportError('Could not reach the server. Check your connection and try again.', 'network');
  }
  if (res.status === 404) throw new ImportError('No player with that username.', 'not-found');
  if (res.status === 429) throw new ImportError('The site is rate-limiting requests. Wait a minute, then try again.', 'rate-limited');
  if (!res.ok) throw new ImportError(`The server answered ${res.status}.`, 'network');
  return res;
}

interface LichessGame {
  id: string;
  variant: string;
  speed?: string;
  createdAt: number;
  winner?: 'white' | 'black';
  status?: string;
  moves?: string;
  initialFen?: string;
  opening?: { name?: string };
  players: { white: { user?: { name: string } }; black: { user?: { name: string } } };
}

export async function importLichess(username: string, max = 30, f: Fetch = fetch): Promise<GameRecord[]> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&moves=true&opening=true&clocks=false&evals=false`;
  const res = await get(url, f, 'application/x-ndjson');
  const text = await res.text();
  const me = username.toLowerCase();
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as LichessGame)
    .filter((g) => g.variant === 'standard' && !g.initialFen && g.moves)
    .map((g) => {
      const white = g.players.white.user?.name ?? 'Anonymous';
      const black = g.players.black.user?.name ?? 'Anonymous';
      const record: GameRecord = {
        id: `lichess:${g.id}`,
        source: 'lichess',
        white,
        black,
        userColor: black.toLowerCase() === me ? 'b' : 'w',
        result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : g.status === 'started' ? '*' : '½-½',
        playedAt: g.createdAt,
        moves: (g.moves ?? '').split(' ').filter(Boolean),
        url: `https://lichess.org/${g.id}`,
      };
      if (g.opening?.name) record.opening = g.opening.name;
      if (g.speed) record.speed = g.speed;
      return record;
    });
}

interface ChessComGame {
  url: string;
  pgn?: string;
  rules: string;
  time_class?: string;
  end_time: number;
  initial_setup?: string;
  white: { username: string };
  black: { username: string };
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export async function importChessCom(username: string, max = 30, f: Fetch = fetch): Promise<GameRecord[]> {
  const user = encodeURIComponent(username.toLowerCase());
  const archives = (await (await get(`https://api.chess.com/pub/player/${user}/games/archives`, f)).json()) as { archives?: string[] };
  const months = (archives.archives ?? []).slice().reverse();
  if (!months.length) throw new ImportError('This player has no public games yet.', 'empty');
  const out: GameRecord[] = [];
  const me = username.toLowerCase();
  for (const month of months.slice(0, 6)) {
    const { games = [] } = (await (await get(month, f)).json()) as { games?: ChessComGame[] };
    for (const g of games.slice().reverse()) {
      if (g.rules !== 'chess' || !g.pgn || (g.initial_setup && g.initial_setup !== START)) continue;
      const { headers, moves } = parsePgn(g.pgn);
      const record: GameRecord = {
        id: `chesscom:${g.url.split('/').pop() ?? g.url}`,
        source: 'chesscom',
        white: g.white.username,
        black: g.black.username,
        userColor: g.black.username.toLowerCase() === me ? 'b' : 'w',
        result: (headers.Result ?? '*').replace('1/2-1/2', '½-½'),
        playedAt: g.end_time * 1000,
        moves,
        url: g.url,
      };
      const eco = headers.ECOUrl?.split('/').pop();
      if (eco) record.opening = decodeURIComponent(eco).replace(/-\d+\..*$/, '').replace(/-/g, ' ');
      if (g.time_class) record.speed = g.time_class;
      out.push(record);
      if (out.length >= max) return out;
    }
  }
  return out;
}
