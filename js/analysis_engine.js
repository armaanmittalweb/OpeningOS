/* OpeningOS — analysis helpers
 * Lightweight, privacy-preserving helpers for move quality and summaries. The
 * app can call Lichess Explorer when online; otherwise it returns a clear local
 * heuristic rather than pretending to be a chess engine.
 */
(function (global) {
  'use strict';

  function materialScore(fen) {
    const board = String(fen || '').split(' ')[0] || '';
    const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let score = 0;
    for (const ch of board) {
      const v = vals[ch.toLowerCase()] || 0;
      if (!v) continue;
      score += ch === ch.toUpperCase() ? v : -v;
    }
    return score;
  }

  async function validateMoveWithExplorer(fen, san) {
    const fallback = { ok: null, confidence: 'local', source: 'local heuristic', message: 'No online database available. Treat this as a user-approved alternate unless checked by coach/engine.' };
    if (!global.OOSApi || !global.OOSApi.lichessExplorer) return fallback;
    try {
      const data = await global.OOSApi.lichessExplorer(fen, { speeds: ['rapid','classical','blitz'], ratings: [1600,1800,2000,2200,2500] });
      const move = (data.moves || []).find(m => normalize(m.san) === normalize(san));
      if (!move) return { ok: false, confidence: 'database', source: 'Lichess Explorer', message: `${san} was not among the top database replies in this position.` };
      const total = Math.max(1, (move.white || 0) + (move.draws || 0) + (move.black || 0));
      return {
        ok: true,
        confidence: total >= 100 ? 'high' : total >= 20 ? 'medium' : 'low',
        source: 'Lichess Explorer',
        games: total,
        message: `${san} appears in ${total} database games. Confidence: ${total >= 100 ? 'high' : total >= 20 ? 'medium' : 'low'}.`,
      };
    } catch (err) {
      return Object.assign({}, fallback, { message: 'Explorer check failed: ' + (err.message || err) });
    }
  }

  function normalize(x) { return String(x || '').replace(/[+#?!]+/g, '').trim(); }

  function summarizeLine(line, cards) {
    const ideas = (cards || []).map(c => c.idea || '').filter(Boolean).slice(0, 4);
    const hooks = (cards || []).map(c => c.hook || '').filter(Boolean).slice(0, 3);
    const breaks = ideas.join(' ').match(/\b[.…]?[a-h][3-6]\b/g) || [];
    return {
      title: line.name,
      summary: ideas.length ? ideas.join(' ') : `${line.name} is a ${line.color === 'w' ? 'White' : 'Black'} repertoire line. Add ideas to make this explanation stronger.`,
      memoryHooks: hooks,
      candidatePawnBreaks: Array.from(new Set(breaks)).slice(0, 4),
      generatedAt: Date.now(),
      mode: 'local-summary',
    };
  }

  function openingQualityHeuristic(game, line, deviations) {
    if (!game || !line) return { status: 'unknown', message: 'No line match.' };
    const dev = (deviations || [])[0];
    if (dev && dev.isUser) return { status: 'user-left-prep', message: `You left prep on ply ${dev.ply}. Fix recall before judging the line.` };
    if (dev && !dev.isUser) return { status: 'opponent-sideline', message: `Opponent left your prep on ply ${dev.ply}. Decide whether this sideline is worth adding.` };
    const result = game.result;
    if (result === 'l') return { status: 'review-needed', message: 'You followed the saved line but lost. Check the middlegame transition and consider engine/database review.' };
    return { status: 'healthy', message: 'No opening deviation detected against this line.' };
  }

  global.OOSAnalysis = { materialScore, validateMoveWithExplorer, summarizeLine, openingQualityHeuristic };
})(window);
