/* OpeningOS — engine/database analysis client */
(function (global) {
  'use strict';
  function materialScore(fen) {
    const board = String(fen || '').split(' ')[0] || '';
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let score = 0;
    for (const ch of board) {
      const v = values[ch.toLowerCase()];
      if (v === undefined) continue;
      score += ch === ch.toUpperCase() ? v : -v;
    }
    return { cp: Math.round(score * 100), source: 'local-material-fallback' };
  }
  async function queueEngine(fen, depth) {
    if (!global.OOSEnterpriseAPI || !global.OOSEnterpriseAPI.tokens().accessToken) return materialScore(fen);
    const job = await global.OOSEnterpriseAPI.createAnalysisJob('engine', { fen, depth: depth || 12 });
    return Object.assign({ queued: true }, job);
  }
  async function queueOpeningExplorer(fen) {
    if (!global.OOSEnterpriseAPI || !global.OOSEnterpriseAPI.tokens().accessToken) return { queued: false, source: 'offline', message: 'Connect backend for explorer.' };
    return global.OOSEnterpriseAPI.createAnalysisJob('opening-explorer', { fen });
  }
  async function validateAlternate(fenBefore, san, fenAfter) {
    const local = materialScore(fenAfter || fenBefore);
    let verdict = 'outside-prep';
    if (local.cp > 250) verdict = 'promising';
    if (local.cp < -250) verdict = 'needs-engine-check';
    return { san, verdict, local, engineJob: await queueEngine(fenAfter || fenBefore, 10).catch(err => ({ error: err.message })) };
  }
  async function evaluateLineQuality(lineId) {
    const DB = global.OOSData;
    const cards = DB.positionsForLine(lineId).slice(0, 20);
    const fens = cards.map(c => c.fen);
    if (global.OOSEnterpriseAPI && global.OOSEnterpriseAPI.tokens().accessToken) return global.OOSEnterpriseAPI.createAnalysisJob('repertoire-quality', { lineId, fens, depth: 10 });
    return { source: 'local', results: fens.map(fen => ({ fen, analysis: materialScore(fen) })) };
  }
  global.OOSEngineClient = { materialScore, queueEngine, queueOpeningExplorer, validateAlternate, evaluateLineQuality };
})(window);
