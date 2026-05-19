/* OpeningOS settings enforcement
 * Applies notation, default practice mode, reveal-after-wrong, screen-reader
 * announcements, real sharing controls, and local AI summaries.
 */
(function (global) {
  'use strict';
  const srId = 'oos-sr-live';
  function DB() { return global.OOSData; }
  function setting(k, fallback) { return DB() && DB().getSetting ? DB().getSetting(k, fallback) : fallback; }
  function ensureLive() { let el = document.getElementById(srId); if (!el) { el = document.createElement('div'); el.id = srId; el.className = 'sr-only'; el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true'); document.body.appendChild(el); } return el; }
  function announce(message) { if (!setting('moveAnnouncements', false)) return; ensureLive().textContent = message; }
  function notationMove(move) {
    const n = setting('notation', 'san');
    if (!move) return '';
    if (n === 'uci' || n === 'lan') return move.from && move.to ? move.from + move.to + (move.promotion || '') : String(move.san || move);
    if (n === 'figurine') return String(move.san || move).replace(/K/g,'♔').replace(/Q/g,'♕').replace(/R/g,'♖').replace(/B/g,'♗').replace(/N/g,'♘');
    return String(move.san || move);
  }
  function summarizePosition(card) {
    if (!card) return 'No position selected.';
    const idea = DB().ideaCardFor ? DB().ideaCardFor(card.id) : {};
    const bits = [card.name || card.opening, 'Move ' + card.move, idea.idea, idea.plan, idea.hook].filter(Boolean);
    return bits.join('. ');
  }
  function aiSummary(target) {
    if (global.OOSSaaS && global.OOSSaaS.signedIn() && setting('aiSummaries', false)) {
      return global.OOSSaaS.request('/ai/summarize', { method: 'POST', body: JSON.stringify({ target }) }).catch(() => ({ summary: localSummary(target) }));
    }
    return Promise.resolve({ summary: localSummary(target) });
  }
  function localSummary(target) {
    if (!target) return 'No content selected.';
    if (target.card) return summarizePosition(target.card);
    if (target.line) return `${target.line.name}: ${((target.line.moves || []).length)} half-moves. Focus on idea cards, critical positions, and recent mistakes.`;
    if (target.game) return `Game vs ${target.game.vs || 'opponent'}: review deviations and add repeated sidelines only if relevant.`;
    return 'OpeningOS local summary generated from saved notes and repertoire metadata.';
  }
  function patchPractice() {
    if (!global.OOSViews || global.OOSViews.__settingsEnforced) return; global.OOSViews.__settingsEnforced = true;
    if (global.OOSPractice && global.OOSPractice.PracticeSession) {
      const P = global.OOSPractice.PracticeSession.prototype;
      const origEval = P.evaluate;
      P.evaluate = function (san) {
        const res = origEval.call(this, san);
        const moveText = san;
        if (res.kind === 'correct' || res.kind === 'correct-alt') announce('Correct move: ' + moveText);
        else announce('Move not in repertoire: ' + moveText + (setting('revealOnWrong', true) ? '. Prepared move: ' + (this.current && this.current.move || '') : '. Try again.'));
        if (!setting('revealOnWrong', true) && res.kind === 'wrong') res.answerHidden = true;
        return res;
      };
    }
    const appStart = global.OOSApp && global.OOSApp.startPractice;
    if (global.OOSApp && appStart && !global.OOSApp.startPractice.__settingsWrapped) {
      const wrapped = function (mode) { return appStart(mode || setting('defaultPracticeMode', 'daily')); };
      wrapped.__settingsWrapped = true; global.OOSApp.startPractice = wrapped;
    }
  }
  function appendSharingSettings() { /* Merged into the main Settings page. */ }
  window.addEventListener('DOMContentLoaded', () => { ensureLive(); setTimeout(patchPractice, 0); });
  window.addEventListener('hashchange', () => {});
  global.OOSSettingsRuntime = { announce, notationMove, aiSummary, localSummary, summarizePosition };
})(window);
