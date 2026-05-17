/* OpeningOS — public-API clients
 * Lichess and Chess.com expose CORS-enabled public endpoints. We never need
 * an API key for read access. Each function returns parsed games with the
 * shape { headers, pgn }.
 */
(function (global) {
  'use strict';

  // --- Lichess --------------------------------------------------------------
  // Endpoint: https://lichess.org/api/games/user/{username}?max=N&pgnInJson=false
  // Returns a stream of PGNs separated by blank lines.
  async function lichessUserGames(username, max = 20) {
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&moves=true&tags=true&clocks=false&evals=false`;
    const r = await fetch(url, { headers: { 'Accept': 'application/x-chess-pgn' } });
    if (!r.ok) {
      const text = await safeText(r);
      throw new Error(`Lichess error ${r.status}: ${text || r.statusText}`);
    }
    const pgnBundle = await r.text();
    return splitPgnBundle(pgnBundle);
  }

  // --- Chess.com ------------------------------------------------------------
  // Public archive endpoint: /pub/player/{username}/games/archives gives a list
  // of monthly archive URLs. Each archive returns { games: [{ pgn, ... }] }.
  async function chesscomUserGames(username, max = 20) {
    const archivesUrl = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`;
    const r = await fetch(archivesUrl);
    if (!r.ok) {
      const text = await safeText(r);
      throw new Error(`Chess.com error ${r.status}: ${text || r.statusText}`);
    }
    const data = await r.json();
    const archives = (data.archives || []).slice().reverse(); // newest first
    const out = [];
    for (let i = 0; i < archives.length && out.length < max; i++) {
      const ar = await fetch(archives[i]);
      if (!ar.ok) continue;
      const aj = await ar.json();
      (aj.games || []).reverse().forEach(g => {
        if (out.length >= max) return;
        if (g.pgn) out.push({ pgn: g.pgn, headers: { TimeControl: g.time_class, Site: 'Chess.com' } });
      });
    }
    return out;
  }

  // --- Lichess opening explorer (for novelty tracker / coverage) -----------
  // Returns the most popular continuations from a given FEN.
  async function lichessExplorer(fen, options = {}) {
    const { speeds = ['blitz','rapid','classical'], ratings = [1600, 1800, 2000, 2200] } = options;
    const url = `https://explorer.lichess.ovh/lichess?variant=standard&fen=${encodeURIComponent(fen)}&speeds=${speeds.join(',')}&ratings=${ratings.join(',')}&moves=8`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Lichess explorer error ${r.status}`);
    return r.json();
  }

  // --- helpers --------------------------------------------------------------
  function splitPgnBundle(text) {
    // PGN games are separated by a blank line between the last move/result of
    // one game and the [Tag] block of the next.
    const games = [];
    const trimmed = text.replace(/\r\n/g, '\n').trim();
    if (!trimmed) return games;
    // A simple split on /\n\n\[/ which preceds new headers
    const parts = trimmed.split(/\n\n(?=\[)/);
    parts.forEach(p => {
      if (p.trim()) games.push({ pgn: p.trim(), headers: {} });
    });
    return games;
  }

  async function safeText(r) {
    try { return await r.text(); } catch (_) { return ''; }
  }

  global.OOSApi = {
    lichessUserGames,
    chesscomUserGames,
    lichessExplorer,
  };
})(window);
