/* OpeningOS complete accessibility layer
 * Focus traps, keyboard activation, move announcements, modal escape handling,
 * route announcements, and screen-reader board summaries.
 */
(function (global) {
  'use strict';
  const liveId = 'oos-global-live';
  let lastFocus = null;
  function live() { let el = document.getElementById(liveId); if (!el) { el = document.createElement('div'); el.id = liveId; el.className = 'sr-only'; el.setAttribute('aria-live','polite'); el.setAttribute('aria-atomic','true'); document.body.appendChild(el); } return el; }
  function announce(msg) { live().textContent = msg; if (global.OOSSettingsRuntime) global.OOSSettingsRuntime.announce(msg); }
  function focusables(root) { return Array.from((root || document).querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null || el === document.activeElement); }
  function trapModal(root) {
    if (!root || root.dataset.focusTrap === 'true') return;
    root.dataset.focusTrap = 'true'; root.setAttribute('role', root.getAttribute('role') || 'dialog'); root.setAttribute('aria-modal','true');
    lastFocus = document.activeElement;
    const fs = focusables(root); if (fs[0]) fs[0].focus();
    root.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { const close = root.querySelector('[data-close], .modal-close, .btn-close'); if (close) close.click(); else root.remove(); restoreFocus(); }
      if (ev.key !== 'Tab') return; const items = focusables(root); if (!items.length) return; const first = items[0], last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  }
  function restoreFocus() { try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (_) {} }
  function enhanceKeyboard() {
    document.querySelectorAll('.card[onclick], .line-row, .clickable, [data-clickable="true"]').forEach(el => {
      if (el.dataset.keyboardEnhanced) return; el.dataset.keyboardEnhanced = 'true'; if (!el.hasAttribute('tabindex')) el.tabIndex = 0; if (!el.getAttribute('role')) el.setAttribute('role','button');
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); } });
    });
  }
  function describeBoard() {
    const board = document.querySelector('.board, .chessboard, [data-board]'); if (!board) return;
    if (!board.getAttribute('aria-label')) board.setAttribute('aria-label', 'Chess board. Use notation input or piece selection to make moves.');
    const selected = document.querySelector('.selected-square');
    if (selected) announce('Selected square ' + (selected.dataset.square || selected.textContent || ''));
  }
  function routeAnnounce() { const h = (location.hash || '#today').replace('#',''); announce('Opened ' + h + ' view'); }
  function observe() { const mo = new MutationObserver(() => { document.querySelectorAll('.modal, .dialog, [role="dialog"]').forEach(trapModal); enhanceKeyboard(); describeBoard(); }); mo.observe(document.documentElement, { childList: true, subtree: true }); }
  document.addEventListener('DOMContentLoaded', () => { live(); observe(); enhanceKeyboard(); describeBoard(); routeAnnounce(); });
  window.addEventListener('hashchange', routeAnnounce);
  document.addEventListener('oos:move', ev => { const d = ev.detail || {}; announce(`${d.color || 'Side'} played ${d.san || d.move || ''}`); });
  global.OOSA11yComplete = { announce, trapModal, restoreFocus, enhanceKeyboard, describeBoard };
})(window);
