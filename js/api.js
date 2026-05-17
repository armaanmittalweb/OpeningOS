/* OpeningOS — public/API-backed game import clients
 * Signed-in users use the deployed OpeningOS backend import worker first so
 * Chess.com/Lichess CORS, rate limits and heavy fetches do not break the UI.
 * Offline/local-only users fall back to browser public APIs. Returns [{ pgn, headers }].
 */
(function (global) {
  'use strict';

  const DEFAULT_BACKEND_URL = (location.origin.includes('localhost') ? 'http://localhost:8787' : 'https://monkfish-app-yxidj.ondigitalocean.app');

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function json(x, fallback) { try { return JSON.parse(x); } catch (_) { return fallback; } }

  function backendConfig() {
    const out = { baseUrl: '', token: '' };
    try {
      if (global.OOSAuthBridge && global.OOSAuthBridge.authState) {
        const s = global.OOSAuthBridge.authState();
        out.baseUrl = s.backendUrl || '';
        out.token = s.token || s.accessToken || '';
      }
      if ((!out.baseUrl || !out.token) && global.OOSSaaS && global.OOSSaaS.config) {
        const c = global.OOSSaaS.config();
        out.baseUrl = out.baseUrl || c.backendUrl || '';
        out.token = out.token || c.accessToken || c.token || '';
      }
      if ((!out.baseUrl || !out.token) && global.OOSEnterpriseAPI) {
        const c = global.OOSEnterpriseAPI.cfg ? global.OOSEnterpriseAPI.cfg() : {};
        const t = global.OOSEnterpriseAPI.tokens ? global.OOSEnterpriseAPI.tokens() : {};
        out.baseUrl = out.baseUrl || c.baseUrl || '';
        out.token = out.token || t.accessToken || t.token || '';
      }
    } catch (_) {}
    out.baseUrl = String(out.baseUrl || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
    return out;
  }

  async function requestBackend(path, opts) {
    const cfg = backendConfig();
    if (!cfg.baseUrl) throw new Error('Backend URL is not configured.');
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {});
    if (cfg.token) headers.Authorization = 'Bearer ' + cfg.token;
    const res = await fetch(cfg.baseUrl + path, Object.assign({}, opts || {}, { headers }));
    const text = await res.text();
    const body = text ? json(text, { text }) : {};
    if (!res.ok) throw new Error(body.error || body.message || body.text || res.statusText || ('HTTP ' + res.status));
    return body;
  }

  async function backendImportGames(source, username, max) {
    const cfg = backendConfig();
    if (!cfg.token) throw new Error('Please sign in to import via the OpeningOS backend.');
    const created = await requestBackend('/imports/jobs', {
      method: 'POST',
      body: JSON.stringify({ source, payload: { username, max: Number(max || 20), limit: Number(max || 20) } }),
    });
    const id = created.id;
    if (!id) throw new Error('Backend did not return an import job id.');
    let last = null;
    for (let i = 0; i < 30; i++) {
      await sleep(i < 4 ? 700 : 1200);
      last = await requestBackend('/imports/jobs/' + encodeURIComponent(id));
      if (last && last.status === 'done') {
        const result = last.result || {};
        if (Array.isArray(result.games)) return result.games.filter(g => g && g.pgn);
        if (Array.isArray(result.pgns)) return result.pgns.map(pgn => ({ pgn, headers: { Site: source } }));
        if (result.ndjson) return parseLichessNdjson(result.ndjson);
        if (result.pgn) return splitPgnBundle(result.pgn);
        throw new Error('Import finished but returned no parseable games.');
      }
      if (last && last.status === 'failed') throw new Error(last.error || 'Backend import failed.');
    }
    throw new Error('Backend import is still running. Try again in a moment.');
  }

  // --- Lichess --------------------------------------------------------------
  async function lichessUserGames(username, max = 20) {
    const cfg = backendConfig();
    if (cfg.token) {
      try { return await backendImportGames('lichess', username, max); }
      catch (backendErr) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast('Server Lichess import failed; trying browser import.', 'warn'); }
    }
    try {
      const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&moves=true&tags=true&clocks=false&evals=false`;
      const r = await fetch(url, { headers: { 'Accept': 'application/x-chess-pgn' } });
      if (!r.ok) throw new Error(`Lichess error ${r.status}: ${await safeText(r) || r.statusText}`);
      const pgnBundle = await r.text();
      const games = splitPgnBundle(pgnBundle);
      if (games.length) return games;
      throw new Error('Lichess returned no PGNs.');
    } catch (directErr) {
      if (!cfg.token) throw new Error(`Lichess import failed: ${directErr.message}. Sign in to use the server import worker.`);
      throw directErr;
    }
  }

  // --- Chess.com ------------------------------------------------------------
  async function chesscomUserGames(username, max = 20) {
    const cfg = backendConfig();
    if (cfg.token) {
      try { return await backendImportGames('chesscom', username, max); }
      catch (backendErr) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast('Server Chess.com import failed; trying browser import.', 'warn'); }
    }
    try {
      const games = await chesscomDirect(username, max);
      if (games.length) return games;
      throw new Error('Chess.com returned no PGNs.');
    } catch (directErr) {
      if (!cfg.token) throw new Error(`Chess.com import failed: ${directErr.message}. Sign in to use the server import worker.`);
      throw directErr;
    }
  }

  async function chesscomDirect(username, max) {
    const archivesUrl = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`;
    const r = await fetch(archivesUrl);
    if (!r.ok) throw new Error(`Chess.com error ${r.status}: ${await safeText(r) || r.statusText}`);
    const data = await r.json();
    const archives = (data.archives || []).slice().reverse();
    const out = [];
    for (let i = 0; i < archives.length && out.length < max; i++) {
      const ar = await fetch(archives[i]);
      if (!ar.ok) continue;
      const aj = await ar.json();
      (aj.games || []).slice().reverse().forEach(g => {
        if (out.length >= max) return;
        if (g.pgn) out.push({ pgn: g.pgn, headers: { TimeControl: g.time_control || g.time_class || '?', Site: g.url || 'Chess.com' } });
      });
    }
    return out;
  }

  async function lichessExplorer(fen, options = {}) {
    const { speeds = ['blitz','rapid','classical'], ratings = [1600, 1800, 2000, 2200] } = options;
    const url = `https://explorer.lichess.ovh/lichess?variant=standard&fen=${encodeURIComponent(fen)}&speeds=${speeds.join(',')}&ratings=${ratings.join(',')}&moves=8`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Lichess explorer error ${r.status}`);
    return r.json();
  }

  function parseLichessNdjson(text) {
    const out = [];
    String(text || '').split(/\n+/).forEach(line => {
      const o = json(line, null);
      if (o && o.pgn) out.push({ pgn: o.pgn, headers: { Site: 'Lichess', Event: 'Lichess game' } });
    });
    return out;
  }

  function splitPgnBundle(text) {
    const games = [];
    const trimmed = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!trimmed) return games;
    trimmed.split(/\n\n(?=\[)/).forEach(p => { if (p.trim()) games.push({ pgn: p.trim(), headers: {} }); });
    return games;
  }

  async function safeText(r) { try { return await r.text(); } catch (_) { return ''; } }

  global.OOSApi = { lichessUserGames, chesscomUserGames, lichessExplorer, backendImportGames, importViaBackend: backendImportGames };
})(window);
