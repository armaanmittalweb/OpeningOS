/* OpeningOS professional game-review engine
 * Uses graph-native matching, multiple candidate lines, phase detection,
 * repeated-mistake memory, sideline relevance, and engine/database hooks.
 */
(function (global) {
  'use strict';
  function normFen(fen) { return global.OOSData && global.OOSData.normalizeFen ? global.OOSData.normalizeFen(fen) : String(fen || '').split(' ').slice(0,4).join(' '); }
  function pgnTokens(pgn) { return String(pgn || '').replace(/\{[^}]*\}/g,' ').replace(/\([^)]*\)/g,' ').replace(/\d+\.\.\.|\d+\./g,' ').split(/\s+/).filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)); }
  function gamePath(pgn) {
    const chess = new global.Chess(); const nodes = [{ ply: 0, fen: chess.fen(), key: normFen(chess.fen()), san: null }];
    pgnTokens(pgn).forEach((tok, i) => { const before = chess.fen(); const m = chess.move(tok, { sloppy: true }); if (m) nodes.push({ ply: i + 1, fenBefore: before, fen: chess.fen(), key: normFen(chess.fen()), san: m.san, side: m.color }); });
    return nodes;
  }
  function graphCandidates(pgn) {
    const DB = global.OOSData; const graph = DB && DB.graphNativeSnapshot ? DB.graphNativeSnapshot() : (DB && DB.graphSnapshot ? DB.graphSnapshot() : null);
    const path = gamePath(pgn); if (!graph || !graph.line_paths) return [];
    const candidates = Object.keys(graph.line_paths).map(lineId => {
      const lp = graph.line_paths[lineId]; const nodeIds = lp.nodeIds || []; const lineKeys = nodeIds.map(pid => graph.positions[pid] && graph.positions[pid].fenKey).filter(Boolean);
      let prefix = 0, transpositions = 0, shared = 0, firstMismatch = null;
      for (let i = 0; i < Math.min(path.length, lineKeys.length); i++) { if (path[i].key === lineKeys[i]) prefix++; else { firstMismatch = firstMismatch || i; break; } }
      path.forEach((n, i) => { const idx = lineKeys.indexOf(n.key); if (idx >= 0) { shared++; if (idx !== i) transpositions++; } });
      const confidence = Math.max(0, Math.min(100, Math.round(prefix * 11 + shared * 4 + transpositions * 6 - Math.abs(lineKeys.length - path.length) * 0.8)));
      return { lineId, name: lp.name, confidence, prefix, shared, transpositions, firstMismatch, total: lineKeys.length };
    }).filter(c => c.confidence >= 15).sort((a,b) => b.confidence - a.confidence);
    return candidates.slice(0, 10);
  }
  function phase(ply) { if (ply <= 16) return 'opening'; if (ply <= 30) return 'early-middlegame'; return 'middlegame/endgame'; }
  function deviationsForCandidate(pgn, lineId) {
    const DB = global.OOSData; const line = DB.line(lineId); if (!line) return [];
    const tokens = pgnTokens(pgn); const game = new global.Chess(); const prep = new global.Chess(); const events = [];
    for (let i = 0; i < Math.max(tokens.length, (line.moves || []).length); i++) {
      const playedRaw = tokens[i]; const expectedRaw = (line.moves || [])[i]; const fenBefore = game.fen(); const side = game.turn();
      if (!playedRaw && !expectedRaw) break;
      if (!playedRaw) break;
      const played = game.move(playedRaw, { sloppy: true });
      const expected = expectedRaw ? prep.move(expectedRaw, { sloppy: true }) : null;
      if (!expected) { events.push({ kind: 'out-of-book', ply: i + 1, phase: phase(i + 1), played: played ? played.san : playedRaw, expected: '', fenBefore, side, isUser: side === line.color }); break; }
      if (!played || played.san !== expected.san && normFen(game.fen()) !== normFen(prep.fen())) {
        events.push({ kind: 'deviation', ply: i + 1, phase: phase(i + 1), played: played ? played.san : playedRaw, expected: expected.san, fenBefore, side, isUser: side === line.color, reachedKnownTransposition: normFen(game.fen()) === normFen(prep.fen()) });
        // Continue after one deviation using game state and attempt to advance prep with same move if possible.
      }
      if (events.length >= 8) break;
    }
    return events;
  }
  function repeatedMistakeScore(cardId, played) {
    const m = global.OOSData && global.OOSData.mistakes ? global.OOSData.mistakes(1000) : [];
    return m.filter(x => x.cardId === cardId || String(x.played || '').replace(/[+#?!]/g,'') === String(played || '').replace(/[+#?!]/g,'')).length;
  }
  async function reviewGame(game) {
    const DB = global.OOSData; const pgn = game && game.pgn || ''; const candidates = graphCandidates(pgn);
    const best = candidates[0]; const allDeviations = [];
    candidates.slice(0, 4).forEach(c => deviationsForCandidate(pgn, c.lineId).forEach(d => allDeviations.push(Object.assign(d, { lineId: c.lineId, candidateConfidence: c.confidence }))));
    const ranked = [];
    allDeviations.forEach(d => {
      const card = DB && DB.cardAtLinePly ? DB.cardAtLinePly(d.lineId, d.ply) : null;
      const srs = card && DB.srs ? DB.srs(card.id) : null;
      const repeated = repeatedMistakeScore(card && card.id, d.played);
      let score = d.candidateConfidence || 0;
      if (d.isUser) score += 25; else score += 10;
      if (srs && srs.reps > 0) score += 20;
      if (repeated) score += Math.min(30, repeated * 8);
      if (d.phase !== 'opening') score -= 15;
      ranked.push(Object.assign({}, d, { cardId: card && card.id, forgottenTrainedCard: !!(srs && srs.reps > 0 && d.isUser), repeated, repairScore: Math.max(0, score), recommendation: score >= 80 ? 'Critical repair' : score >= 50 ? 'Add to next review' : score >= 25 ? 'Optional sideline' : 'Probably ignore' }));
    });
    ranked.sort((a,b) => b.repairScore - a.repairScore);
    const quality = best && !ranked.length && global.OOSEngine ? { status: 'needs-engine-check', message: 'You followed prep. Run engine/database analysis to validate the line.', lineId: best.lineId } : null;
    return { gameId: game && game.id, candidates, bestLineId: best && best.lineId, confidence: best && best.confidence || 0, phase: phase(gamePath(pgn).length), deviations: allDeviations, rankedRepairs: ranked, quality };
  }
  function patchDB() {
    const DB = global.OOSData; if (!DB || DB.__proReviewPatched) return; DB.__proReviewPatched = true;
    const old = DB.deepReviewGame && DB.deepReviewGame.bind(DB);
    DB.deepReviewGame = function (game) {
      const base = old ? old(game) : { matches: [], deviations: [], moments: [] };
      const quick = { gameId: game && game.id, candidates: graphCandidates(game && game.pgn || ''), rankedRepairs: [] };
      try {
        const candidates = quick.candidates;
        const bestLineId = (candidates[0] || {}).lineId || base.lineId;
        const devs = bestLineId ? deviationsForCandidate(game.pgn || '', bestLineId) : [];
        const ranked = devs.map(d => {
          const card = this.cardAtLinePly ? this.cardAtLinePly(bestLineId, d.ply) : null; const srs = card && this.srs ? this.srs(card.id) : null; const repeated = repeatedMistakeScore(card && card.id, d.played);
          return Object.assign({}, d, { lineId: bestLineId, cardId: card && card.id, forgottenTrainedCard: !!(srs && srs.reps && d.isUser), repeated, repairScore: (d.isUser ? 40 : 20) + (srs && srs.reps ? 20 : 0) + repeated * 8 });
        }).sort((a,b) => b.repairScore - a.repairScore);
        return Object.assign({}, base, quick, { matches: candidates, lineId: bestLineId, deviations: devs, rankedRepairs: ranked, moments: (base.moments || []).concat(ranked.slice(0, 5)) });
      } catch (_) { return Object.assign({}, base, quick); }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchDB); else setTimeout(patchDB, 0);
  global.OOSGameReviewPro = { gamePath, graphCandidates, deviationsForCandidate, reviewGame, phase };
})(window);
