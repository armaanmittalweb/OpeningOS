/* OpeningOS engine and opening database connector
 * Supports browser Stockfish worker, server-side engine jobs, Lichess explorer,
 * novelty detection, tactical validation, and ranked repair suggestions.
 */
(function (global) {
  'use strict';
  let worker = null;
  let ready = false;
  let seq = 0;
  const pending = new Map();
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info'); }
  function normFen(fen) { return global.OOSData && global.OOSData.normalizeFen ? global.OOSData.normalizeFen(fen) : String(fen || '').split(' ').slice(0,4).join(' '); }
  function initWorker(path) {
    if (worker || !path) return worker;
    try {
      worker = new Worker(path);
      worker.onmessage = e => handleLine(String(e.data || ''));
      post('uci'); post('isready');
    } catch (e) { worker = null; }
    return worker;
  }
  function post(msg) { if (worker) worker.postMessage(msg); }
  function handleLine(line) {
    if (/uciok|readyok/.test(line)) ready = true;
    if (line.startsWith('info ')) {
      pending.forEach(p => { p.lines.push(line); });
    }
    if (line.startsWith('bestmove')) {
      const first = pending.keys().next().value;
      if (!first) return;
      const p = pending.get(first); pending.delete(first);
      p.resolve(parseAnalysis(p.lines, line, p.fen));
    }
  }
  function parseScore(line) {
    const cp = /score cp (-?\d+)/.exec(line); if (cp) return Number(cp[1]) / 100;
    const mate = /score mate (-?\d+)/.exec(line); if (mate) return Number(mate[1]) > 0 ? 100 : -100;
    return null;
  }
  function parsePv(line) { const m = / pv (.+)$/.exec(line); return m ? m[1].trim().split(/\s+/).slice(0, 12) : []; }
  function parseAnalysis(lines, bestLine, fen) {
    let best = null; let score = null; let pv = [];
    lines.forEach(l => { const s = parseScore(l); if (s !== null) { score = s; pv = parsePv(l); } });
    const bm = /bestmove\s+(\S+)/.exec(bestLine || ''); if (bm) best = bm[1];
    return { fen, bestmove: best, score, pv, source: 'stockfish-worker', rawLines: lines.slice(-10) };
  }
  function analyzeLocal(fen, opts) {
    const path = (opts && opts.workerPath) || (global.OOSEngineConfig && global.OOSEngineConfig.workerPath) || 'vendor/stockfish.js';
    initWorker(path);
    if (!worker) return Promise.reject(new Error('Stockfish worker not available. Configure vendor/stockfish.js or use server analysis.'));
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { fen, lines: [], resolve, reject });
      post('ucinewgame'); post('position fen ' + fen); post('go depth ' + ((opts && opts.depth) || 12));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('Engine analysis timed out.')); } }, (opts && opts.timeoutMs) || 20000);
    });
  }
  async function analyzeServer(fen, opts) {
    if (!global.OOSSaaS || !global.OOSSaaS.signedIn()) throw new Error('Sign in to use server engine analysis.');
    const job = await global.OOSSaaS.queueAnalysisJob({ kind: 'position', fen, options: opts || {} });
    const started = Date.now();
    while (Date.now() - started < ((opts && opts.timeoutMs) || 30000)) {
      await new Promise(r => setTimeout(r, 1200));
      const cur = await global.OOSSaaS.analysisJob(job.id);
      if (cur && cur.status === 'done') return cur.result;
      if (cur && cur.status === 'failed') throw new Error(cur.error || 'Analysis job failed.');
    }
    return { id: job.id, status: 'queued', source: 'server' };
  }
  async function analyzePosition(fen, opts) {
    opts = opts || {};
    if (opts.server) return analyzeServer(fen, opts);
    try { return await analyzeLocal(fen, opts); } catch (e) { if (global.OOSSaaS && global.OOSSaaS.signedIn()) return analyzeServer(fen, opts); throw e; }
  }
  async function explorer(fen) {
    if (global.OOSApi && global.OOSApi.lichessExplorer) return global.OOSApi.lichessExplorer(fen, { speeds: ['rapid','classical','blitz'], ratings: [1600,1800,2000,2200,2500] });
    return { moves: [] };
  }
  function materialBalance(fen) {
    const board = String(fen || '').split(' ')[0];
    const values = { p: 1, n: 3, b: 3.1, r: 5, q: 9, k: 0 };
    let s = 0;
    for (const c of board) { const v = values[c.toLowerCase()] || 0; if (/[A-Z]/.test(c)) s += v; else s -= v; }
    return s;
  }
  async function validateAlternate(card, san) {
    const chess = new global.Chess(card.fen);
    const move = chess.move(san, { sloppy: true });
    if (!move) return { status: 'illegal', message: 'Illegal move.' };
    const fenAfter = chess.fen();
    let explorerData = null; try { explorerData = await explorer(card.fen); } catch (_) {}
    const dbMove = explorerData && (explorerData.moves || []).find(m => String(m.san || '').replace(/[+#?!]/g, '') === move.san.replace(/[+#?!]/g, ''));
    if (dbMove) {
      const total = (explorerData.moves || []).reduce((a,m) => a + (m.white || 0) + (m.draws || 0) + (m.black || 0), 0) || 1;
      const freq = ((dbMove.white || 0) + (dbMove.draws || 0) + (dbMove.black || 0)) / total;
      return { status: freq > 0.03 ? 'database-supported' : 'rare', move: move.san, fenAfter, frequency: freq, message: freq > 0.03 ? 'Supported by opening database.' : 'Rare but seen in database.' };
    }
    const before = materialBalance(card.fen), after = materialBalance(fenAfter);
    const swing = card.side === 'w' ? after - before : before - after;
    if (swing < -2.5) return { status: 'likely-bad', move: move.san, fenAfter, scoreSwing: swing, message: 'Material heuristic flags this as tactically suspicious.' };
    return { status: 'outside-prep', move: move.san, fenAfter, message: 'Legal but not in your prep or opening database sample.' };
  }
  async function noveltyReport(line) {
    const chess = new global.Chess();
    const rows = [];
    for (let i = 0; i < (line.moves || []).length; i++) {
      const fen = chess.fen();
      let db = null; try { db = await explorer(fen); } catch (_) {}
      const move = chess.move(line.moves[i], { sloppy: true }); if (!move) break;
      const found = db && (db.moves || []).some(m => String(m.san || '').replace(/[+#?!]/g, '') === move.san.replace(/[+#?!]/g, ''));
      if (!found) rows.push({ ply: i + 1, move: move.san, fen, novelty: true, message: 'Not found in explorer sample.' });
    }
    return rows;
  }
  function rankRepairs(review) {
    const moments = (review && review.moments) || [];
    return moments.map(m => {
      let score = 10;
      if (m.severity === 'forgot-trained-card') score += 30;
      if (m.repeated) score += Math.min(30, m.repeated * 10);
      if (m.relevance && m.relevance.label === 'high') score += 20;
      if (m.kind === 'prep-quality') score += 15;
      return Object.assign({}, m, { repairScore: score, recommendation: score >= 50 ? 'Fix immediately' : score >= 25 ? 'Schedule lightweight repair' : 'Optional / ignore for now' });
    }).sort((a,b) => b.repairScore - a.repairScore);
  }
  function patchPractice() {
    if (!global.OOSPractice || !global.OOSPractice.PracticeSession || global.OOSPractice.__enginePatched) return;
    global.OOSPractice.__enginePatched = true;
    const proto = global.OOSPractice.PracticeSession.prototype;
    const orig = proto.evaluate;
    proto.evaluate = function (san) {
      const result = orig.call(this, san);
      if (result && result.kind === 'wrong' && this.current) {
        result.validationPromise = validateAlternate(this.current, san).then(v => { result.validation = v; return v; }).catch(e => ({ status: 'unknown', message: e.message }));
      }
      return result;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchPractice); else setTimeout(patchPractice, 0);
  global.OOSEngine = { initWorker, analyzePosition, analyzeLocal, analyzeServer, explorer, validateAlternate, noveltyReport, rankRepairs, materialBalance };
})(window);
