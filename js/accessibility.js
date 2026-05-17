/* OpeningOS — accessibility runtime
 * Focus-traps modal dialogs, adds Escape handling, and ensures custom panels
 * expose keyboard activation. It complements semantic controls in views.js.
 */
(function (global) {
  'use strict';

  let lastFocus = null;
  const focusable = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  function trap(modal) {
    if (!modal || modal.dataset.a11yTrap === 'true') return;
    modal.dataset.a11yTrap = 'true';
    lastFocus = document.activeElement;
    const panel = modal.querySelector('.modal-panel, .bottom-sheet-panel, .cmd-panel') || modal;
    panel.setAttribute('role', panel.getAttribute('role') || 'dialog');
    panel.setAttribute('aria-modal', 'true');
    const nodes = Array.from(panel.querySelectorAll(focusable)).filter(x => x.offsetParent !== null || x === document.activeElement);
    setTimeout(() => (nodes[0] || panel).focus && (nodes[0] || panel).focus(), 30);
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const close = modal.querySelector('[data-sheet-close], [data-cmd-close], .modal-back, .bottom-sheet-back, .cmd-backdrop');
        if (close) close.click(); else modal.remove();
        restoreFocus();
      }
      if (e.key !== 'Tab') return;
      const list = Array.from(panel.querySelectorAll(focusable)).filter(x => !x.disabled);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function restoreFocus() {
    if (lastFocus && lastFocus.focus) setTimeout(() => lastFocus.focus(), 10);
    lastFocus = null;
  }

  function observe() {
    const mo = new MutationObserver(records => {
      records.forEach(r => r.addedNodes.forEach(n => {
        if (!(n instanceof HTMLElement)) return;
        if (n.matches && (n.matches('.modal, .bottom-sheet, .cmd-palette') || n.querySelector('.modal-panel'))) trap(n.matches('.modal, .bottom-sheet, .cmd-palette') ? n : n.querySelector('.modal'));
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', e => {
      if (e.target && (e.target.matches('.modal-back') || e.target.matches('.bottom-sheet-back') || e.target.matches('.cmd-backdrop'))) restoreFocus();
    }, true);
    document.addEventListener('keydown', e => {
      if ((e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches('.card-hover, .rep-line, .game-item')) {
        e.preventDefault(); e.target.click();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();

  global.OOSA11y = { trap, restoreFocus };
})(window);
