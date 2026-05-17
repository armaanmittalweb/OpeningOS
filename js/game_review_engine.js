/* OpeningOS — advanced graph-based game review engine */
(function (global) {
  'use strict';
  function fenKey(fen) { return String(fen || '').trim().split(/\s+/).slice(0, 4).join(' '); }
  function cleanPgn(text) { return String(text || '').replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\d+\.\.\.|\d+\./g, ' ').trim().split(/\s+/).filter(Boolean).filter(t => !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)); }
  function gameTrace(pgn) {
    const chess = new global.Chess(); const trace = [{ ply: 0, fen: chess.fen(), key: fenKey(chess.fen()), side: chess.turn(), san: null }];
    cleanPgn(pgn).forEach((tok, idx) => { const before = chess.fen(); const side = chess.turn(); const m = chess.move(tok, { sloppy: true }); if (m) trace.push({ ply: idx + 1, fenBefore: before, fen: chess.fen(), key: fenKey(chess.fen()), beforeKey: fenKey(before), side, san: m.san, uci: m.from + m.to + (m.promotion || '') }); });
    return trace;
  }
  function pathKeys(DB, line) {
    const g = DB.graphNativeSnapshot ? DB.graphNativeSnapshot() : DB.graphSnapshot();
    const path = DB.linePathFor ? DB.linePathFor(line.id) : (g.line_paths && g.line_paths[line.id]);
    if (path && path.nodeIds) return path.nodeIds.map(id => (g.positions[id] || {}).fenKey || id);
    const chess = new global.Chess(); const keys = [fenKey(chess.fen())];
    (line.moves || []).forEach(m => { if (chess.move(m, { sloppy: true })) keys.push(fenKey(chess.fen())); });
    return keys;
  }
  function classifyPhase(ply) { if (ply <= 16) return 'opening'; if (ply <= 30) return 'early-middlegame'; return 'middlegame'; }
  function matchGame(DB, pgn) {
    const trace = gameTrace(pgn); const gameKeys = trace.map(t => t.key); const lines = DB.lines().filter(l => l.status !== 'retired');
    return lines.map(line => {
      const keys = pathKeys(DB, line); let prefix = 0; let intersections = 0; let lastSharedPly = 0; const seen = new Set(keys);
      for (let i = 0; i < Math.min(keys.length, gameKeys.length); i++) { if (keys[i] === gameKeys[i]) prefix++; else break; }
      gameKeys.forEach((k, idx) => { if (seen.has(k)) { intersections++; lastSharedPly = Math.max(lastSharedPly, idx); } });
      const coverage = intersections / Math.max(1, Math.min(keys.length, gameKeys.length));
      const confidence = Math.round(Math.min(100, prefix * 9 + intersections * 4 + coverage * 25));
      return { lineId: line.id, name: line.name, prefix, intersections, transpositions: Math.max(0, intersections - prefix), lastSharedPly, confidence, phase: classifyPhase(lastSharedPly), total: keys.length, keys };
    }).filter(m => m.prefix >= 2 || m.intersections >= 3).sort((a, b) => b.confidence - a.confidence).slice(0, 8);
  }
  function deviationsForMatch(DB, pgn, match) {
    const trace = gameTrace(pgn); const line = DB.line(match.lineId); if (!line) return [];
    const cardsByPly = {}; DB.positionsForLine(line.id).forEach(c => { cardsByPly[c.ply] = c; });
    const chessLine = new global.Chess(); const out = [];
    for (let i = 0; i < Math.max(line.moves.length, trace.length - 1); i++) {
      const expected = line.moves[i]; const actual = trace[i + 1]; const before = trace[i] || trace[trace.length - 1];
      if (!expected && actual) { out.push({ kind: 'out-of-book', ply: i + 1, side: before.side, played: actual.san, fenBefore: before.fen, phase: classifyPhase(i + 1) }); break; }
      if (expected && !actual) { out.push({ kind: 'game-ended-before-prep', ply: i + 1, expected, fenBefore: before.fen, phase: classifyPhase(i + 1) }); break; }
      const expBefore = chessLine.fen(); const exp = chessLine.move(expected, { sloppy: true });
      if (!exp || !actual || (exp.san !== actual.san && fenKey(chessLine.fen()) !== actual.key)) {
        const card = cardsByPly[i + 1]; const srs = card && DB.srs(card.id); const trained = !!(srs && srs.reps);
        out.push({ kind: actual && before.side === line.color ? 'user-left-prep' : 'opponent-sideline', ply: i + 1, side: before.side, played: actual && actual.san, expected: exp && exp.san || expected, fenBefore: before.fen || expBefore, expectedFen: chessLine.fen(), cardId: card && card.id, trained, forgotten: trained && before.side === line.color, phase: classifyPhase(i + 1) });
        break;
      }
    }
    return out;
  }
  function sidelineRelevance(DB, lineId, dev) {
    const games = (DB.games || []).filter(g => !lineId || g.lineId === lineId);
    let count = 0;
    games.forEach(g => { const best = matchGame(DB, g.pgn || '')[0]; if (!best) return; deviationsForMatch(DB, g.pgn || '', best).forEach(d => { if (d.ply === dev.ply && d.played === dev.played) count++; }); });
    const label = count >= 3 ? 'high' : count === 2 ? 'medium' : 'low';
    return { label, count, reason: label === 'high' ? 'Repeated in your imported games.' : label === 'medium' ? 'Seen twice; consider a short answer.' : 'Rare in your current data.' };
  }
  function recommendations(DB, pgn, match, deviations) {
    const recs = [];
    deviations.forEach(d => {
      const relevance = sidelineRelevance(DB, match.lineId, d);
      if (d.kind === 'user-left-prep') recs.push({ priority: d.forgotten ? 95 : 80, action: 'practice-card', cardId: d.cardId, title: d.forgotten ? 'Relearn forgotten trained card' : 'Add this gap to review', reason: `You left prep on ply ${d.ply}.` });
      if (d.kind === 'opponent-sideline') recs.push({ priority: relevance.label === 'high' ? 85 : relevance.label === 'medium' ? 60 : 35, action: relevance.label === 'low' ? 'ignore-or-light-note' : 'add-sideline', title: 'Opponent sideline response', reason: relevance.reason, dev: d });
    });
    if (!deviations.length) recs.push({ priority: 40, action: 'quality-check', title: 'You stayed in prep — run engine/database quality check', reason: 'No deviation detected; evaluate whether the prepared middlegame is healthy.' });
    return recs.sort((a, b) => b.priority - a.priority);
  }
  function review(DB, game) {
    const matches = matchGame(DB, game.pgn || ''); const best = game.lineId ? matches.find(m => m.lineId === game.lineId) || matches[0] : matches[0];
    const deviations = best ? deviationsForMatch(DB, game.pgn || '', best) : [];
    const recs = best ? recommendations(DB, game.pgn || '', best, deviations) : [];
    const moments = deviations.map(d => Object.assign({}, d, { relevance: best && sidelineRelevance(DB, best.lineId, d), message: d.kind === 'user-left-prep' ? `You left prep on ply ${d.ply}.` : `Opponent sideline on ply ${d.ply}.` }));
    return { gameId: game.id, matches, bestMatch: best || null, lineId: best && best.lineId, deviations, moments, recommendations: recs, phase: best && best.phase, confidence: best && best.confidence };
  }
  function patch(DB) {
    if (!DB || DB.__advancedReviewPatched) return; DB.__advancedReviewPatched = true;
    DB.matchGameToRepertoire = function (pgn) { return matchGame(this, pgn); };
    DB.deepReviewGame = function (game) { return review(this, game || {}); };
  }
  global.OOSGameReview = { gameTrace, matchGame, deviationsForMatch, sidelineRelevance, recommendations, review, patch };
  if (global.OOSData) patch(global.OOSData);
})(window);
