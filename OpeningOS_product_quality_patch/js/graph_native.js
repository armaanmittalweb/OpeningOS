/* OpeningOS graph-native source-of-truth store
 * Maintains a true edge-ID graph alongside the legacy line arrays. The existing
 * UI can still render SAN arrays, while sync/backend APIs persist graph nodes,
 * edges, paths, annotations, lifecycle states, and transpositions by ID.
 */
(function (global) {
  'use strict';
  function normFen(fen) { return String(fen || '').trim().split(/\s+/).slice(0,4).join(' '); }
  function id(prefix, str) { let h=2166136261; str=String(str||''); for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);} return prefix + '_' + (h>>>0).toString(36); }
  function empty() { return { schema:'openingos-graph-native-v2', positions:{}, move_edges:{}, line_paths:{}, annotations:{}, updatedAt:Date.now() }; }
  function state() { const DB=global.OOSData; if(!DB) return empty(); DB.state.graphNative = DB.state.graphNative || empty(); return DB.state.graphNative; }
  function ensurePosition(g, fen) { const key=normFen(fen); if(!g.positions[key]) g.positions[key]={ id:key, fen, fenKey:key, sideToMove:String(fen).split(/\s+/)[1]||'w', critical:false, retired:false, sourceRefs:[] }; return g.positions[key]; }
  function ingestLine(line) {
    if (!global.Chess || !line || !line.id) return null;
    const g=state(); const c=new global.Chess(); const nodeIds=[]; const edgeIds=[]; ensurePosition(g,c.fen()); nodeIds.push(normFen(c.fen()));
    (line.moves||[]).forEach((san,idx)=>{ const fromFen=c.fen(); const from=ensurePosition(g,fromFen); const m=c.move(san,{sloppy:true}); if(!m) return; const to=ensurePosition(g,c.fen()); const eid=id('edge', from.id + '|' + to.id + '|' + m.san); if(!g.move_edges[eid]) g.move_edges[eid]={ id:eid, from:from.id, to:to.id, san:m.san, uci:m.from+m.to+(m.promotion||''), ply:idx+1, comment:'', sourceRefs:line.sourceRefs||[], retired:!!line.retired, createdAt:Date.now(), lineIds:[] }; if(!g.move_edges[eid].lineIds.includes(line.id)) g.move_edges[eid].lineIds.push(line.id); edgeIds.push(eid); nodeIds.push(to.id); });
    g.line_paths[line.id]={ id:line.id, name:line.name, color:line.color, status:line.status||'active', branchOf:line.parentLineId||null, branchFromPly:line.branchFromPly||null, nodeIds, edgeIds, metadata:{ tag:line.tag, opening:line.opening, eco:line.eco, repId:line.repId, source:line.source, moves:(line.moves||[]).slice() }, updatedAt:Date.now() };
    g.updatedAt=Date.now(); return g.line_paths[line.id];
  }
  function rebuildFromLines() { const DB=global.OOSData; const g=empty(); if(!DB||!DB.lines) return g; DB.state.graphNative=g; DB.lines().forEach(ingestLine); if(DB.persist) DB.persist(); return g; }
  function lineMovesFromPath(pathId) { const g=state(); const p=g.line_paths[pathId]; if(!p) return []; return (p.edgeIds||[]).map(eid => g.move_edges[eid] && g.move_edges[eid].san).filter(Boolean); }
  function setEdgeComment(edgeId, comment) { const g=state(); if(g.move_edges[edgeId]) { g.move_edges[edgeId].comment=comment; g.move_edges[edgeId].updatedAt=Date.now(); persist('graph.edgeComment',{edgeId}); } return g.move_edges[edgeId]; }
  function setPositionCritical(fenOrKey, critical, reason) { const g=state(); const key=normFen(fenOrKey); if(!g.positions[key]) g.positions[key]={ id:key, fen:fenOrKey, fenKey:key, sideToMove:'w', sourceRefs:[] }; g.positions[key].critical=!!critical; g.positions[key].criticalReason=reason||''; g.positions[key].updatedAt=Date.now(); persist('graph.positionCritical',{key,critical}); return g.positions[key]; }
  function retirePath(pathId, archived) { const g=state(); if(g.line_paths[pathId]) { g.line_paths[pathId].status=archived?'archived':'retired'; g.line_paths[pathId].retiredAt=Date.now(); (g.line_paths[pathId].edgeIds||[]).forEach(e=>{ if(g.move_edges[e]) g.move_edges[e].retired=true; }); persist('graph.pathRetired',{pathId}); } return g.line_paths[pathId]; }
  function insertEdgePath(pathId, index, edgeIds) { const g=state(); const p=g.line_paths[pathId]; if(!p) return null; const idx=Math.max(0,Math.min(Number(index||0),p.edgeIds.length)); p.edgeIds.splice(idx,0,...edgeIds); p.nodeIds=rebuildNodesForEdges(p.edgeIds,g); p.updatedAt=Date.now(); p.metadata.moves=lineMovesFromPath(pathId); persist('graph.pathInsert',{pathId,index:idx}); return p; }
  function removeEdgeAt(pathId, index) { const g=state(); const p=g.line_paths[pathId]; if(!p) return null; const idx=Math.max(0,Math.min(Number(index||0),p.edgeIds.length-1)); const removed=p.edgeIds.splice(idx,1); p.nodeIds=rebuildNodesForEdges(p.edgeIds,g); p.updatedAt=Date.now(); p.metadata.moves=lineMovesFromPath(pathId); persist('graph.pathRemove',{pathId,index:idx,removed}); return p; }
  function splitPath(pathId, index, name) { const g=state(); const p=g.line_paths[pathId]; if(!p) return null; const idx=Math.max(0,Math.min(Number(index||0),p.edgeIds.length)); const newId='line_graph_' + Math.random().toString(36).slice(2,9); const edgeIds=p.edgeIds.slice(idx); const nodeIds=rebuildNodesForEdges(edgeIds,g); g.line_paths[newId]={ id:newId, name:name||((p.name||'Line')+' split'), color:p.color, status:'active', branchOf:pathId, branchFromPly:idx, nodeIds, edgeIds, metadata:Object.assign({},p.metadata,{ splitFrom:pathId, moves:edgeIds.map(e=>g.move_edges[e]?.san).filter(Boolean) }), updatedAt:Date.now() }; persist('graph.pathSplit',{pathId,newId,index:idx}); return g.line_paths[newId]; }
  function mergeTransposition(sourcePathId, targetPathId) { const g=state(); const a=g.line_paths[sourcePathId], b=g.line_paths[targetPathId]; if(!a||!b) return null; let match=null; for(const n of a.nodeIds||[]) if((b.nodeIds||[]).includes(n)){match=n;break;} a.status='merged'; a.mergedInto=targetPathId; a.mergeFenKey=match; a.updatedAt=Date.now(); persist('graph.pathMerged',{sourcePathId,targetPathId,match}); return a; }
  function rebuildNodesForEdges(edgeIds,g) { const out=[]; edgeIds.forEach((eid,i)=>{ const e=g.move_edges[eid]; if(!e) return; if(i===0) out.push(e.from); out.push(e.to); }); return out; }
  function annotate(targetKind,targetId,kind,body,metadata){ const g=state(); const aid='ann_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); g.annotations[aid]={ id:aid,targetKind,targetId,kind:kind||'note',body:body||'',metadata:metadata||{},createdAt:Date.now() }; persist('graph.annotation',{aid}); return g.annotations[aid]; }
  function transpositionsForFen(fen) { const key=normFen(fen); const g=state(); return Object.values(g.line_paths||{}).filter(p => (p.nodeIds||[]).includes(key)).map(p=>({ linePathId:p.id, name:p.name, ply:(p.nodeIds||[]).indexOf(key) })); }

  function mergeGraphs(a,b) {
    a = a || empty(); b = b || empty();
    return {
      schema: 'openingos-graph-native-v2',
      positions: Object.assign({}, a.positions || {}, b.positions || {}),
      move_edges: Object.assign({}, a.move_edges || {}, b.move_edges || {}),
      line_paths: Object.assign({}, a.line_paths || {}, b.line_paths || {}),
      annotations: Object.assign({}, a.annotations || {}, b.annotations || {}),
      updatedAt: Date.now(),
      mergedFrom: [a.updatedAt || null, b.updatedAt || null]
    };
  }
  function importGraphBundle(bundle) {
    const DB = global.OOSData; if(!DB) return null;
    const incoming = bundle && (bundle.graphNative || bundle.graph || bundle);
    const current = state();
    DB.state.graphNative = mergeGraphs(current, incoming);
    if(DB.persist) DB.persist();
    return DB.state.graphNative;
  }

  function mergeGraphs(incoming) { const g=state(); incoming=incoming||{}; ['positions','move_edges','line_paths','annotations','review_events','games','deviations'].forEach(k=>{ g[k]=g[k]||{}; Object.keys(incoming[k]||{}).forEach(id=>{ const cur=g[k][id]; const inc=incoming[k][id]; g[k][id]=!cur || (inc.updatedAt||0) >= (cur.updatedAt||0) ? Object.assign({},cur||{},inc) : cur; }); }); g.updatedAt=Date.now(); persist('graph.mergeGraphs',{ schema: incoming.schema||'' }); return g; }
  function importGraphBundle(bundle) { const incoming=(bundle&&bundle.graph)||bundle||{}; const g=mergeGraphs(incoming); const DB=global.OOSData; if(DB&&DB.init) DB.init(); return g; }
  function persist(action, details){ const DB=global.OOSData; if(DB&&DB.audit) DB.audit(action,details||{}); if(DB&&DB.persist) DB.persist(); }
  function patchData() {
    const DB=global.OOSData; if(!DB || DB.__graphNativePatched) return; DB.__graphNativePatched=true;
    const add=DB.addUserLine&&DB.addUserLine.bind(DB); if(add) DB.addUserLine=function(line){ const saved=add(line); ingestLine(saved); this.persist(); return saved; };
    const upd=DB.updateUserLine&&DB.updateUserLine.bind(DB); if(upd) DB.updateUserLine=function(id,patch){ const out=upd(id,patch); if(out) ingestLine(out); this.persist(); return out; };
    const del=DB.deleteUserLine&&DB.deleteUserLine.bind(DB); if(del) DB.deleteUserLine=function(id){ const g=state(); if(g.line_paths[id]) g.line_paths[id].status='deleted'; return del(id); };
    DB.graphNativeSnapshot=function(){ const g=state(); if(!Object.keys(g.move_edges||{}).length && this.lines) { try { rebuildFromLines(); } catch(_){} } return JSON.parse(JSON.stringify(state())); };
    DB.rebuildGraphNative=rebuildFromLines;
    DB.lineMovesFromEdgePath=lineMovesFromPath;
    DB.insertGraphMove=function(lineId,index,san){
      const res=this.insertMoveAt ? this.insertMoveAt(lineId,index,san) : null;
      try { const line=this.getLine?this.getLine(lineId):null; if(line) ingestLine(line); } catch(_){}
      return res;
    };
    DB.removeGraphMove=function(lineId,ply){
      const res=this.removeMoveAt ? this.removeMoveAt(lineId,ply) : null;
      try { const line=this.getLine?this.getLine(lineId):null; if(line) ingestLine(line); } catch(_){}
      return res;
    };
    DB.addGraphBranch=function(lineId,ply,moves,opts){
      const res=this.addSideVariation ? this.addSideVariation(lineId,ply,moves,opts||{}) : null;
      try { if(res) ingestLine(res); } catch(_){}
      return res;
    };
    DB.splitGraphLine=function(lineId,ply,name){
      const res=this.splitLineFromPly ? this.splitLineFromPly(lineId,ply,name) : null;
      try { if(res) ingestLine(res); else splitPath(lineId,ply,name); } catch(_){}
      return res || state().line_paths[lineId];
    };
    DB.mergeGraphTransposition=function(sourceLineId,targetLineId){
      const res=this.mergeTransposition ? this.mergeTransposition(sourceLineId,targetLineId) : null;
      try { mergeTransposition(sourceLineId,targetLineId); } catch(_){}
      return res || state().line_paths[sourceLineId];
    };
    DB.retireGraphLine=function(lineId,archived){
      const res=this.retireLine ? this.retireLine(lineId,archived) : null;
      try { retirePath(lineId,archived); } catch(_){}
      return res || state().line_paths[lineId];
    };
  }
  patchData(); try{ if(global.OOSData&&global.OOSData.lines) rebuildFromLines(); }catch(_){}
  if (window.addEventListener) window.addEventListener('load',()=>{ patchData(); try{ if(global.OOSData&&global.OOSData.lines) rebuildFromLines(); }catch(_){} });
  global.OOSGraphNative={ state, ingestLine, rebuildFromLines, lineMovesFromPath, setEdgeComment, setPositionCritical, retirePath, insertEdgePath, removeEdgeAt, splitPath, mergeTransposition, mergeGraphs, importGraphBundle, annotate, transpositionsForFen };
})(window);
