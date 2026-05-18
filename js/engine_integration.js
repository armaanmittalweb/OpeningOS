/* OpeningOS — engine/database analysis integration
 * Uses server-side analysis jobs when configured; falls back to a local legal
 * move/material/explorer check. A Stockfish worker can be dropped at
 * engine/stockfish.js for fully offline WASM analysis.
 */
(function (global) {
  'use strict';
  let worker = null;
  let pending = new Map();
  let seq = 0;
  function backendBase() { return global.OOSSaaS && global.OOSSaaS.config ? global.OOSSaaS.config().backendUrl : (localStorage.getItem('oos.backend.url') || ''); }
  function token() { return global.OOSSaaS && global.OOSSaaS.token ? global.OOSSaaS.token() : localStorage.getItem('oos.backend.token') || ''; }
  async function backend(path, body) {
    const base = backendBase(); if (!base) throw new Error('Cloud analysis is not connected.');
    const r = await fetch(base.replace(/\/+$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(body || {}) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || data.message || r.statusText);
    return data;
  }
  function ensureWorker() {
    if (worker) return worker;
    try {
      worker = new Worker('engine/stockfish.js');
      worker.onmessage = ev => {
        const text = String(ev.data || '');
        pending.forEach((job, id) => {
          job.lines.push(text);
          if (/^bestmove\s+/.test(text)) { pending.delete(id); job.resolve(parseInfo(job.lines)); }
        });
      };
      worker.postMessage('uci');
      return worker;
    } catch (_) { return null; }
  }
  function parseInfo(lines) {
    const info = { bestmove: '', scoreCp: null, mate: null, pv: [], raw: lines.slice(-50) };
    lines.forEach(line => {
      const bm = line.match(/^bestmove\s+(\S+)/); if (bm) info.bestmove = bm[1];
      const cp = line.match(/ score cp (-?\d+)/); if (cp) info.scoreCp = Number(cp[1]);
      const mate = line.match(/ score mate (-?\d+)/); if (mate) info.mate = Number(mate[1]);
      const pv = line.match(/ pv (.+)$/); if (pv) info.pv = pv[1].split(/\s+/).slice(0, 12);
    });
    return info;
  }
  function analyzeWithWorker(fen, depth) {
    const w = ensureWorker();
    if (!w) return Promise.reject(new Error('Local engine is not installed. Use cloud analysis when available.'));
    const id = 'job_' + (++seq);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, lines: [] });
      w.postMessage('ucinewgame');
      w.postMessage('position fen ' + fen);
      w.postMessage('go depth ' + (depth || 12));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('Engine timed out.')); } }, 15000);
    });
  }
  async function analyzePosition(fen, opts) {
    opts = opts || {};
    if (opts.backend !== false && backendBase()) {
      const job = await backend('/analysis/quick', { fen, depth: opts.depth || 12 });
      return Object.assign({ source: 'backend' }, job.result || job);
    }
    try { return Object.assign({ source: 'stockfish-wasm' }, await analyzeWithWorker(fen, opts.depth || 12)); }
    catch (err) {
      const material = global.OOSAnalysis && global.OOSAnalysis.materialScore ? global.OOSAnalysis.materialScore(fen) : 0;
      return { source: 'local-heuristic', scoreCp: material * 100, bestmove: '', pv: [], warning: err.message || String(err) };
    }
  }
  async function validateMove(fen, san) {
    const chess = new global.Chess(fen); const legal = chess.move(san, { sloppy: true });
    if (!legal) return { verdict: 'illegal', source: 'chess.js', reason: 'Move is illegal from this position.' };
    const after = chess.fen();
    const beforeEval = await analyzePosition(fen, { depth: 10, backend: true }).catch(() => null);
    const afterEval = await analyzePosition(after, { depth: 10, backend: true }).catch(() => null);
    const drop = beforeEval && afterEval && beforeEval.scoreCp != null && afterEval.scoreCp != null ? (beforeEval.scoreCp - afterEval.scoreCp) : null;
    let verdict = 'playable';
    if (drop != null && drop > 180) verdict = 'bad';
    else if (drop != null && drop > 80) verdict = 'dubious';
    return { verdict, source: (beforeEval && beforeEval.source) || 'local', reason: drop == null ? 'Legal move; engine/database confidence unavailable.' : `Evaluation change ${drop}cp.`, fenAfter: after, scoreDropCp: drop, before: beforeEval, after: afterEval };
  }
  async function analyzeGameOpening(game, line) {
    const pgn = game && game.pgn || ''; const toks = (global.OOSAdvancedReview && global.OOSAdvancedReview.tokens ? global.OOSAdvancedReview.tokens(pgn) : pgn.split(/\s+/));
    const chess = new global.Chess(); let lastFen = chess.fen();
    toks.slice(0, Math.min(16, toks.length)).forEach(t => { const m = chess.move(t, { sloppy: true }); if (m) lastFen = chess.fen(); });
    const evalResult = await analyzePosition(lastFen, { depth: 12 });
    const status = Math.abs(Number(evalResult.scoreCp || 0)) > 140 ? 'prep-quality-warning' : 'healthy';
    return { status, lineId: line && line.id, fen: lastFen, evaluation: evalResult, message: status === 'healthy' ? 'Engine check did not flag the opening endpoint.' : 'Engine check suggests reviewing this line endpoint.' };
  }
  const prior = global.OOSAnalysis || {};
  global.OOSAnalysis = Object.assign({}, prior, { analyzePosition, validateMove, analyzeGameOpening, engineAvailable: () => !!backendBase() || !!ensureWorker() });
})(window);
