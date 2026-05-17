/* OpeningOS — serious game-review engine
 * Matches imported games against the repertoire graph, returns multiple line
 * candidates with confidence, detects transpositions, forgotten trained cards,
 * repeated mistakes, side-line rarity, prep-quality warnings and ranked repairs.
 */
(function (global) {
  'use strict';
  function normFen(fen) { return global.OOSData && global.OOSData.normalizedFen ? global.OOSData.normalizedFen(fen) : String(fen || '').split(/\s+/).slice(0,4).join(' '); }
  function tokens(pgn) { return String(pgn || '').replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\d+\.\.\.|\d+\./g, ' ').split(/\s+/).filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)); }
  function gameTrace(pgn) {
    const chess = new global.Chess();
    const out = [{ ply: 0, fen: chess.fen(), fenKey: normFen(chess.fen()), side: chess.turn(), move: null, san: null }];
    tokens(pgn).forEach((tok, i) => {
      const before = chess.fen();
      const m = chess.move(tok, { sloppy: true });
      if (!m) out.push({ ply: i + 1, illegal: true, token: tok, fenBefore: before, fenKey: normFen(before), side: String(before).split(/\s+/)[1] || '' });
      else out.push({ ply: i + 1, fen: chess.fen(), fenKey: normFen(chess.fen()), fenBefore: before, fenBeforeKey: normFen(before), side: m.color, move: m, san: m.san });
    });
    return out;
  }
  function lineCandidates(trace, graph, lines) {
    const gameKeys = trace.map(x => x.fenKey);
    return (lines || []).map(line => {
      const path = graph.line_paths[line.id];
      if (!path) return null;
      const keys = path.nodeIds || path.nodeKeys || [];
      const edgeIds = path.edgeIds || [];
      let prefix = 0; let transpositions = 0; let edgeHits = 0;
      for (let i = 0; i < Math.min(keys.length, gameKeys.length); i++) { if (keys[i] === gameKeys[i]) prefix++; else break; }
      gameKeys.forEach((k, i) => { if (keys.includes(k) && i >= prefix) transpositions++; });
      for (let i = 1; i < trace.length; i++) {
        const before = trace[i].fenBeforeKey; const after = trace[i].fenKey; const san = trace[i].san;
        const found = edgeIds.some(id => { const e = graph.move_edges[id]; return e && e.from === before && e.to === after && (!san || e.san === san); });
        if (found) edgeHits++;
      }
      const score = prefix * 12 + edgeHits * 8 + transpositions * 4 - Math.abs(edgeIds.length - (trace.length - 1)) * 0.15;
      const confidence = Math.max(0, Math.min(1, score / Math.max(20, (edgeIds.length || 1) * 10)));
      return { lineId: line.id, name: line.name, color: line.color, prefix, edgeHits, transpositions, totalEdges: edgeIds.length, score, confidence: Math.round(confidence * 100) / 100 };
    }).filter(Boolean).filter(c => c.prefix > 1 || c.edgeHits > 0 || c.transpositions > 0).sort((a,b) => b.score - a.score).slice(0, 8);
  }
  function deviationMoments(trace, graph, line, DB) {
    const path = graph.line_paths[line.id];
    if (!path) return [];
    const moments = [];
    const edgeIds = path.edgeIds || [];
    for (let ply = 1; ply < trace.length; ply++) {
      const expectedEdge = graph.move_edges[edgeIds[ply - 1]];
      const actual = trace[ply];
      if (!expectedEdge) {
        moments.push({ kind: 'out-of-book', ply, played: actual.san || actual.token, fenBefore: actual.fenBefore, isUser: actual.side === line.color, message: 'Game continued after saved prep ended.' });
        break;
      }
      if (actual.illegal || actual.fenKey !== expectedEdge.to) {
        const card = DB && DB.cardAtLinePly ? DB.cardAtLinePly(line.id, ply) : null;
        const trained = card && DB.srs && DB.srs(card.id) && DB.srs(card.id).reps > 0;
        const repeated = card && DB.mistakes ? DB.mistakes(1000).filter(m => m.cardId === card.id).length : 0;
        const relevance = estimateRarity(DB, line.id, ply, actual.san || actual.token);
        moments.push({ kind: actual.side === line.color ? 'user-left-prep' : 'opponent-sideline', ply, played: actual.san || actual.token, expected: expectedEdge.san, fenBefore: actual.fenBefore, expectedEdgeId: expectedEdge.id, cardId: card && card.id, isUser: actual.side === line.color, trained, repeated, relevance, severity: trained ? 'forgot-trained-card' : repeated >= 2 ? 'repeated-mistake' : 'new-gap', message: actual.side === line.color ? 'You left repertoire from a known graph edge.' : 'Opponent entered a graph sideline not covered by this line.' });
        break;
      }
    }
    return moments;
  }
  function estimateRarity(DB, lineId, ply, san) {
    const games = DB && DB.importedGames ? DB.importedGames() : [];
    const sameLine = games.filter(g => g.lineId === lineId);
    const count = sameLine.filter(g => tokens(g.pgn || '')[ply - 1] === san).length;
    const pct = sameLine.length ? count / sameLine.length : 0;
    if (count >= 3 || pct >= 0.2) return { label: 'high', count, pct, message: 'Repeated in your games; add this repair.' };
    if (count === 2 || pct >= 0.08) return { label: 'medium', count, pct, message: 'Worth a lightweight response.' };
    return { label: 'low', count, pct, message: 'Rare so far; keep as optional unless opponent-specific.' };
  }
  function rankRepairs(moments) {
    return (moments || []).map(m => {
      let score = 10;
      if (m.kind === 'user-left-prep') score += 20;
      if (m.trained) score += 15;
      if (m.repeated) score += Math.min(20, m.repeated * 5);
      if (m.relevance && m.relevance.label === 'high') score += 20;
      if (m.relevance && m.relevance.label === 'low') score -= 5;
      const action = m.kind === 'user-left-prep' ? 'Practice this graph position' : (m.relevance && m.relevance.label === 'low' ? 'Ignore or tag optional' : 'Add sideline branch');
      return Object.assign({}, m, { repairScore: score, recommendedAction: action });
    }).sort((a,b) => b.repairScore - a.repairScore);
  }
  async function engineQuality(game, line, moments) {
    if (moments && moments.length) return { status: 'deviation-first', message: 'Fix deviations before judging prep quality.' };
    if (!global.OOSAnalysis || !global.OOSAnalysis.analyzeGameOpening) return { status: 'not-run', message: 'Engine analysis not configured.' };
    return global.OOSAnalysis.analyzeGameOpening(game, line).catch(err => ({ status: 'error', message: err.message || String(err) }));
  }
  function reviewGame(game) {
    const DB = global.OOSData;
    const graph = (DB && DB.graphNativeSnapshot ? DB.graphNativeSnapshot() : DB && DB.graphSnapshot ? DB.graphSnapshot() : { line_paths: {}, move_edges: {} });
    const lines = DB && DB.lines ? DB.lines({ includeRetired: true }) : [];
    const trace = gameTrace(game && game.pgn || '');
    const matches = lineCandidates(trace, graph, lines);
    const chosen = game && game.lineId ? lines.find(l => l.id === game.lineId) : (matches[0] && lines.find(l => l.id === matches[0].lineId));
    const moments = chosen ? deviationMoments(trace, graph, chosen, DB) : [];
    const rankedRepairs = rankRepairs(moments);
    const phase = trace.length <= 10 ? 'opening' : trace.length <= 24 ? 'opening-to-middlegame' : 'middlegame-reached';
    return { gameId: game && game.id, phase, trace, matches, lineId: chosen && chosen.id, deviations: moments, moments, rankedRepairs, engineQuality: { status: 'queued-on-demand', message: 'Use engine analysis when backend/Stockfish is configured.' } };
  }
  function patchDB() {
    const DB = global.OOSData;
    if (!DB || DB.__advancedReviewPatched) return false;
    DB.__advancedReviewPatched = true;
    DB.matchGameToRepertoireGraph = function (pgn) { return lineCandidates(gameTrace(pgn), DB.graphNativeSnapshot ? DB.graphNativeSnapshot() : DB.graphSnapshot(), DB.lines({ includeRetired: true })); };
    const old = DB.deepReviewGame && DB.deepReviewGame.bind(DB);
    DB.deepReviewGame = function (game) { const out = reviewGame(game); if ((!out.matches || !out.matches.length) && old) return old(game); return out; };
    return true;
  }
  if (typeof setInterval === 'function') { if (!patchDB()) {
    const setInt = global.setInterval || function(fn){ return global.setTimeout(fn, 25); };
    const clrInt = global.clearInterval || global.clearTimeout || function(){};
    const timer = setInt(() => { if (patchDB()) clrInt(timer); }, 25);
  } } else patchDB();
  global.OOSAdvancedReview = { tokens, gameTrace, lineCandidates, deviationMoments, rankRepairs, reviewGame, engineQuality };
})(window);
