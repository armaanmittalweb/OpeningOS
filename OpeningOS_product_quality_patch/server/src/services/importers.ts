import { env } from '../config.js';

export async function fetchLichessGames(username: string, max = 50): Promise<string[]> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${Math.min(200, max)}&pgnInJson=true`;
  const headers: Record<string, string> = { Accept: 'application/x-ndjson' };
  if (env.LICHESS_TOKEN) headers.Authorization = `Bearer ${env.LICHESS_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Lichess import failed: ${res.status}`);
  const text = await res.text();
  return text.split(/\n+/).filter(Boolean).map(line => { try { return JSON.parse(line).pgn || ''; } catch { return ''; } }).filter(Boolean);
}

export async function fetchChessComGames(username: string, max = 50): Promise<string[]> {
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`, { headers: { 'User-Agent': env.CHESSCOM_USER_AGENT } });
  if (!archivesRes.ok) throw new Error(`Chess.com archive lookup failed: ${archivesRes.status}`);
  const archives = await archivesRes.json() as { archives?: string[] };
  const urls = (archives.archives || []).slice(-6).reverse();
  const out: string[] = [];
  for (const url of urls) {
    const res = await fetch(url, { headers: { 'User-Agent': env.CHESSCOM_USER_AGENT } });
    if (!res.ok) continue;
    const json = await res.json() as any;
    for (const g of json.games || []) {
      if (g.pgn) out.push(g.pgn);
      if (out.length >= max) return out;
    }
  }
  return out;
}
