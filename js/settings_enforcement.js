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
  function appendSharingSettings() {
    const app = document.getElementById('app'); if (!app || !(location.hash || '').includes('settings') || app.querySelector('[data-sharing-settings="true"]')) return;
    const box = document.createElement('section'); box.className = 'card'; box.dataset.sharingSettings = 'true';
    box.innerHTML = '<h2>Sharing and AI settings</h2><p class="muted">These settings now affect share-link permissions, local summaries, backend AI summaries, and screen-reader practice announcements.</p>';
    const row = document.createElement('div'); row.className = 'row wrap';
    [['privacy','select',['private','unlisted','public']], ['defaultPracticeMode','select',['daily','weak','learn','blind','speed','warmup']], ['notation','select',['san','lan','uci','figurine']]].forEach(([key,type,opts]) => {
      const label = document.createElement('label'); label.className = 'field compact'; const span = document.createElement('span'); span.textContent = key;
      const select = document.createElement('select'); select.className = 'input'; opts.forEach(o => { const option = document.createElement('option'); option.value = o; option.textContent = o; select.appendChild(option); }); select.value = setting(key, opts[0]); select.addEventListener('change', () => { DB().setSetting(key, select.value); }); label.append(span, select); row.appendChild(label);
    });
    [['revealOnWrong','Reveal answer after wrong move'], ['moveAnnouncements','Screen-reader move announcements'], ['aiSummaries','Backend AI summaries']].forEach(([key,text]) => {
      const label = document.createElement('label'); label.className = 'check'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!setting(key, false); cb.addEventListener('change', () => DB().setSetting(key, cb.checked)); label.append(cb, document.createTextNode(' ' + text)); row.appendChild(label);
    });
    const share = document.createElement('button'); share.className = 'btn btn-sm'; share.textContent = 'Create profile share link'; share.type = 'button'; share.addEventListener('click', async () => {
      try {
        if (global.OOSSaaS && global.OOSSaaS.signedIn()) { const r = await global.OOSSaaS.createShareLink('profile', (global.OOSProfiles.active() || {}).id, { visibility: setting('privacy','private') }); alert('Hosted share created: ' + (r.url || r.token)); }
        else { const s = DB().createShareSnapshot('profile', (global.OOSProfiles.active() || {}).id); alert('Local share snapshot created: ' + s.id); }
      } catch (e) { alert(e.message); }
    });
    row.appendChild(share); box.appendChild(row); app.appendChild(box);
  }
  window.addEventListener('DOMContentLoaded', () => { ensureLive(); setTimeout(patchPractice, 0); setTimeout(appendSharingSettings, 200); });
  window.addEventListener('hashchange', () => setTimeout(appendSharingSettings, 100));
  global.OOSSettingsRuntime = { announce, notationMove, aiSummary, localSummary, summarizePosition };
})(window);
