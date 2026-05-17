/* OpeningOS engine/database analysis client.
 * Uses backend Stockfish when configured; otherwise provides a local lightweight
 * material/safety fallback so UI flows never dead-end offline.
 */
(function(global){
  'use strict';
  function materialScore(fen){ const vals={p:100,n:320,b:330,r:500,q:900,k:0}; let s=0; for(const ch of String(fen||'').split(' ')[0]){ const v=vals[ch.toLowerCase()]||0; if(v) s += ch===ch.toUpperCase()?v:-v; } return s; }
  async function analyzeFen(fen, opts){
    if(global.OOSSaaS && global.OOSSaaS.configured && global.OOSSaaS.configured()) {
      try { return await global.OOSSaaS.analyzeFen(fen, opts || {}); } catch(err) { console.warn('server engine unavailable', err); }
    }
    return { source:'local-material-fallback', evalCp:materialScore(fen), depth:0, warning:'Backend Stockfish not connected. Configure server STOCKFISH_CMD for engine-backed analysis.' };
  }
  async function validateAlternate(card, san){
    if(!global.Chess || !card) return { verdict:'unknown', reason:'No chess engine available.' };
    const c=new global.Chess(card.fen); const m=c.move(san,{sloppy:true}); if(!m) return { verdict:'illegal', reason:'Move is illegal in this position.' };
    const before=await analyzeFen(card.fen,{movetimeMs:300}); const after=await analyzeFen(c.fen(),{movetimeMs:300});
    const side=card.side || String(card.fen).split(/\s+/)[1]; const delta=(after.evalCp||0)-(before.evalCp||0); const userDelta=side==='w'?delta:-delta;
    if(userDelta < -180) return { verdict:'legal-but-bad', before, after, reason:'Engine/material check suggests this alternate may lose too much value.' };
    return { verdict:'playable', before, after, reason:'No major tactical/material issue detected by the available analyser.' };
  }
  async function openingExplorer(fen){
    // Hook for server-side opening-explorer provider. Offline returns empty.
    if(global.OOSSaaS && global.OOSSaaS.configured && global.OOSSaaS.configured()) {
      try { return await global.OOSSaaS.request('POST','/analysis/jobs',{ kind:'explorer', payload:{ fen } }); } catch(_) {}
    }
    return { source:'offline', games:0, moves:[], message:'Connect backend/database explorer for public-frequency data.' };
  }
  global.OOSEngine={ analyzeFen, validateAlternate, openingExplorer };
})(window);
