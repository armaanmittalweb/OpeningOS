/* OpeningOS graph-native chess model
 * Makes positions and move edges the canonical persisted objects while keeping
 * the existing line.moves API as a compatibility view for older UI components.
 */
(function (global) {
  'use strict';
  function now() { return Date.now(); }
  function id(prefix, seed) { if (seed) return prefix + '_' + hash(seed); return prefix + '_' + Math.random().toString(36).slice(2, 9) + '_' + now().toString(36); }
  function hash(str) { let h = 2166136261; str = String(str || ''); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function clone(x) { return JSON.parse(JSON.stringify(x || {})); }
  function normFen(fen) { return global.OOSData && global.OOSData.normalizeFen ? global.OOSData.normalizeFen(fen) : String(fen || '').split(' ').slice(0,4).join(' '); }
  function emptyGraph() { return { schema: 'openingos-graph-native-v2', updatedAt: now(), positions: {}, move_edges: {}, line_paths: {}, practice_cards: {}, annotations: {}, deviations: {}, indexes: { fenToPosition: {}, edgeByTransition: {}, linesByEdge: {}, linesByPosition: {} } }; }
  function ensureState() {
    const DB = global.OOSData;
    if (!DB || !DB.state) return emptyGraph();
    DB.state.nativeGraph = DB.state.nativeGraph || emptyGraph();
    const g = DB.state.nativeGraph;
    g.positions = g.positions || {}; g.move_edges = g.move_edges || {}; g.line_paths = g.line_paths || {}; g.practice_cards = g.practice_cards || {}; g.annotations = g.annotations || {}; g.deviations = g.deviations || {};
    g.indexes = g.indexes || { fenToPosition: {}, edgeByTransition: {}, linesByEdge: {}, linesByPosition: {} };
    g.indexes.fenToPosition = g.indexes.fenToPosition || {}; g.indexes.edgeByTransition = g.indexes.edgeByTransition || {}; g.indexes.linesByEdge = g.indexes.linesByEdge || {}; g.indexes.linesByPosition = g.indexes.linesByPosition || {};
    return g;
  }
  function ensurePosition(graph, fen, extras) {
    const key = normFen(fen); let pid = graph.indexes.fenToPosition[key];
    if (!pid) { pid = id('pos', key); graph.indexes.fenToPosition[key] = pid; }
    graph.positions[pid] = Object.assign({ id: pid, fenKey: key, fen, sideToMove: String(fen || '').split(' ')[1] || 'w', critical: false, lifecycle: 'active', sourceRefs: [], createdAt: now(), updatedAt: now() }, graph.positions[pid] || {}, extras || {}, { updatedAt: now() });
    return graph.positions[pid];
  }
  function ensureEdge(graph, from, to, move, line, extras) {
    const transition = from.id + '|' + (move.lan || move.from + move.to + (move.promotion || '')) + '|' + to.id;
    let edgeId = graph.indexes.edgeByTransition[transition];
    if (!edgeId) { edgeId = id('edge', transition); graph.indexes.edgeByTransition[transition] = edgeId; }
    graph.move_edges[edgeId] = Object.assign({ id: edgeId, fromPositionId: from.id, toPositionId: to.id, fromFenKey: from.fenKey, toFenKey: to.fenKey, san: move.san, lan: move.from + move.to + (move.promotion || ''), uci: move.from + move.to + (move.promotion || ''), side: move.color, lifecycle: 'active', comment: '', sourceRefs: [], createdAt: now(), updatedAt: now() }, graph.move_edges[edgeId] || {}, extras || {}, { updatedAt: now() });
    const set = graph.indexes.linesByEdge[edgeId] || []; if (line && !set.includes(line.id)) set.push(line.id); graph.indexes.linesByEdge[edgeId] = set;
    return graph.move_edges[edgeId];
  }
  function saveLineGraph(line) {
    const graph = ensureState();
    const chess = new global.Chess();
    const nodeIds = []; const edgeIds = []; const moveSans = [];
    let pos = ensurePosition(graph, chess.fen(), { sourceRefs: line.sourceRefs || [] }); nodeIds.push(pos.id);
    for (let i = 0; i < (line.moves || []).length; i++) {
      const before = chess.fen();
      const move = chess.move(line.moves[i], { sloppy: true });
      if (!move) break;
      moveSans.push(move.san);
      const from = ensurePosition(graph, before, { sourceRefs: line.sourceRefs || [] });
      const to = ensurePosition(graph, chess.fen(), { sourceRefs: line.sourceRefs || [] });
      const edge = ensureEdge(graph, from, to, move, line, { plyHint: i + 1, sourceRefs: line.sourceRefs || [], lifecycle: line.status === 'retired' || line.retired ? 'retired' : 'active' });
      edgeIds.push(edge.id); nodeIds.push(to.id);
      const lp = graph.indexes.linesByPosition[to.id] || []; if (!lp.includes(line.id)) lp.push(line.id); graph.indexes.linesByPosition[to.id] = lp;
    }
    graph.line_paths[line.id] = Object.assign({}, graph.line_paths[line.id] || {}, {
      id: line.id, lineId: line.id, name: line.name, color: line.color, repertoireId: line.repId || '', edgeIds, nodeIds,
      branchOf: line.parentLineId || null, branchFromPly: line.branchFromPly || null, branchType: line.branchType || null,
      lifecycle: line.status === 'retired' || line.retired ? 'retired' : 'active', mergedInto: line.mergedInto || null,
      metadata: { eco: line.eco || '?', opening: line.opening || line.name, tag: line.tag || 'nice-to-know', description: line.description || '', source: line.source || 'user' },
      createdAt: line.createdAt || now(), updatedAt: now(), movesView: moveSans,
    });
    edgeIds.forEach(eid => { graph.indexes.linesByEdge[eid] = Array.from(new Set([].concat(graph.indexes.linesByEdge[eid] || [], line.id))); });
    graph.updatedAt = now();
    return graph.line_paths[line.id];
  }
  function materializeLine(lineId) {
    const graph = ensureState(); const path = graph.line_paths[lineId];
    if (!path) return null;
    const moves = (path.edgeIds || []).map(id => graph.move_edges[id] && graph.move_edges[id].san).filter(Boolean);
    return { id: lineId, moves, nodeIds: path.nodeIds || [], edgeIds: path.edgeIds || [] };
  }
  function createGraphLineFromEdges(baseLine, edgeIds, patch) {
    const graph = ensureState();
    const moves = edgeIds.map(id => graph.move_edges[id] && graph.move_edges[id].san).filter(Boolean);
    const line = Object.assign({}, baseLine || {}, patch || {}, { moves, edgeIds: edgeIds.slice(), source: (patch && patch.source) || 'graph-native' });
    return global.OOSData.addUserLine(line);
  }
  function lineEdges(lineId) { const graph = ensureState(); const path = graph.line_paths[lineId]; return path ? (path.edgeIds || []).map(id => graph.move_edges[id]).filter(Boolean) : []; }
  function positionForCard(cardId) { const DB = global.OOSData; const c = DB && DB.position ? DB.position(cardId) : null; if (!c) return null; const graph = ensureState(); const pid = graph.indexes.fenToPosition[normFen(c.fen)]; return pid ? graph.positions[pid] : ensurePosition(graph, c.fen, {}); }
  function setPositionMeta(cardId, patch) { const graph = ensureState(); const p = positionForCard(cardId); if (!p) return null; Object.assign(p, patch || {}, { updatedAt: now() }); graph.updatedAt = now(); persist(); return p; }
  function setEdgeAnnotation(edgeId, patch) { const graph = ensureState(); const e = graph.move_edges[edgeId]; if (!e) return null; graph.annotations[edgeId] = Object.assign({ id: id('ann'), targetKind: 'edge', targetId: edgeId, createdAt: now() }, graph.annotations[edgeId] || {}, patch || {}, { updatedAt: now() }); if (patch && patch.comment !== undefined) e.comment = patch.comment; graph.updatedAt = now(); persist(); return graph.annotations[edgeId]; }
  function transpositionMergeCandidates(lineId) {
    const graph = ensureState(); const path = graph.line_paths[lineId]; if (!path) return [];
    const out = [];
    (path.nodeIds || []).forEach((pid, idx) => {
      const lines = graph.indexes.linesByPosition[pid] || [];
      lines.filter(x => x !== lineId).forEach(other => out.push({ lineId: other, sourcePly: idx, targetPositionId: pid, fenKey: graph.positions[pid] && graph.positions[pid].fenKey }));
    });
    return out;
  }
  function persist() { const DB = global.OOSData; if (DB && DB.persist) DB.persist(); }
  function rebuildAll() { const DB = global.OOSData; if (!DB || !DB.state) return emptyGraph(); DB.state.nativeGraph = emptyGraph(); (DB.lines ? DB.lines({ includeRetired: true }) : []).forEach(saveLineGraph); persist(); return DB.state.nativeGraph; }

  function patchDB() {
    const DB = global.OOSData; if (!DB || DB.__nativeGraphPatched) return; DB.__nativeGraphPatched = true;
    const origInit = DB.init.bind(DB);
    DB.init = function () { const r = origInit(); try { (this.data.lines || []).forEach(saveLineGraph); } catch (e) {} return r; };
    const origAdd = DB.addUserLine.bind(DB);
    DB.addUserLine = function (line) { const saved = origAdd(line); try { const path = saveLineGraph(saved); const user = (this.state.userLines || []).find(l => l.id === saved.id); if (user) { user.edgeIds = path.edgeIds.slice(); user.nodeIds = path.nodeIds.slice(); user.graphVersion = 'native-v2'; } this.persist(); } catch (e) { if (global.OOSObservability) global.OOSObservability.emit('native_graph.add_failed', { message: e.message }, 'warn'); } return saved; };
    const origUpdate = DB.updateUserLine && DB.updateUserLine.bind(DB);
    if (origUpdate) DB.updateUserLine = function (id, patch) { const saved = origUpdate(id, patch); if (saved) { try { const path = saveLineGraph(saved); const user = (this.state.userLines || []).find(l => l.id === saved.id); if (user) { user.edgeIds = path.edgeIds.slice(); user.nodeIds = path.nodeIds.slice(); user.graphVersion = 'native-v2'; } this.persist(); } catch (e) {} } return saved; };
    DB.graphNativeSnapshot = function () { return clone(ensureState()); };
    DB.rebuildNativeGraph = rebuildAll;
    DB.lineEdges = lineEdges;
    DB.setEdgeAnnotation = setEdgeAnnotation;
    DB.setPositionMeta = setPositionMeta;
    DB.transpositionMergeCandidates = transpositionMergeCandidates;
    DB.materializeGraphLine = materializeLine;
    DB.createGraphLineFromEdges = createGraphLineFromEdges;
    const origMark = DB.markPositionCritical && DB.markPositionCritical.bind(DB);
    if (origMark) DB.markPositionCritical = function (cardId, critical, reason) { const r = origMark(cardId, critical, reason); setPositionMeta(cardId, { critical: !!critical, criticalReason: reason || '' }); return r; };
    try { rebuildAll(); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchDB); else setTimeout(patchDB, 0);
  global.OOSNativeGraph = { ensureState, rebuildAll, saveLineGraph, materializeLine, lineEdges, setEdgeAnnotation, setPositionMeta, transpositionMergeCandidates, createGraphLineFromEdges };
})(window);
