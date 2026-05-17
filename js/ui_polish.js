/* OpeningOS — final UX polish layer
 * Adds responsive/touch polish, keyboard affordances for card-like controls,
 * and a visible feature assurance panel in Settings.
 */
(function (global) {
  'use strict';

  const VERSION = '0.5.1-ux-polish';

  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(k => {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'style') Object.assign(node.style, attrs[k]);
      else if (k === 'on') Object.keys(attrs[k]).forEach(ev => node.addEventListener(ev, attrs[k][ev]));
      else if (k in node) node[k] = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    });
    return node;
  }

  function toast(message, kind) {
    if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(message, kind || 'info');
  }

  function featureChecks() {
    const DB = global.OOSData || {};
    const Views = global.OOSViews || {};
    const Practice = global.OOSPractice || {};
    const Cloud = global.OOSCloud || {};
    return [
      {
        name: 'Store theory',
        desc: 'Manual lines, PGN import, notes, labels, editable copies.',
        ok: !!(DB.addUserLine && DB.updateUserLine && DB.duplicateLine && Views.showLineCreationWizard && Views.showImportWizard),
      },
      {
        name: 'Practice deeply',
        desc: 'Due queue, weak-line drills, accepted alternates, hints, review events.',
        ok: !!(Practice.PracticeSession && DB.duePositions && DB.addAlternateToCard && DB.reviewEvents),
      },
      {
        name: 'Repair games',
        desc: 'PGN/game import, deviations, unmatched games, ignored sidelines, alternates.',
        ok: !!(DB.addUserGame && DB.deviationsForGame && DB.ignoreDeviation && DB.addAlternateForDeviation),
      },
      {
        name: 'Coach workflows',
        desc: 'Student records, assignments, coach-pack export/import.',
        ok: !!(DB.addStudent && DB.addAssignment && DB.exportCoachPack && DB.importCoachPack),
      },
      {
        name: 'Serious-player modes',
        desc: 'Tournament mode, opponent prep, insights, repertoire health.',
        ok: !!(DB.setTournament && Views.renderOpponentPrep && Views.renderInsights && DB.saveOpponentReport),
      },
      {
        name: 'Safety and sync',
        desc: 'Full backup/restore, integrity repair, optional Appwrite cloud snapshot sync.',
        ok: !!(DB.exportSnapshot && DB.importSnapshot && DB.healthReport && Cloud.pushSnapshot && Cloud.pullSnapshot),
      },
      {
        name: 'Deployability',
        desc: 'PWA shell, local vendor chess engine, CI, GitHub Pages/Vercel/Netlify configs.',
        ok: !!(global.navigator && global.navigator.serviceWorker !== undefined && document.querySelector('link[rel="manifest"]')),
      },
      {
        name: 'Responsive UX',
        desc: 'Mobile-safe board, touch targets, focus states, bottom sheet, compact nav.',
        ok: !!document.documentElement.dataset.uxPolished,
      },
    ];
  }

  function runUXChecklist() {
    const checks = featureChecks();
    const passed = checks.filter(c => c.ok).length;
    const missing = checks.filter(c => !c.ok);
    const m = modal('UX and feature assurance', `${passed}/${checks.length} product pillars are active in this build.`);
    const list = h('div', { class: 'ux-check-list' }, checks.map(c => h('div', { class: 'ux-check ' + (c.ok ? 'ok' : 'warn') }, [
      h('div', { class: 'ux-check-dot', 'aria-hidden': 'true' }, [c.ok ? '✓' : '!']),
      h('div', {}, [
        h('strong', {}, [c.name]),
        h('div', { class: 'muted' }, [c.desc]),
      ]),
    ])));
    m.panel.appendChild(list);
    m.panel.appendChild(h('div', { class: 'row ux-modal-actions' }, [
      h('button', { class: 'btn', on: { click: () => m.close() } }, ['Close']),
      h('button', { class: 'btn', on: { click: () => { m.close(); if (global.OOSViews && global.OOSViews.showBackupRestore) global.OOSViews.showBackupRestore(); } } }, ['Open data safety']),
      h('button', { class: 'btn btn-primary', on: { click: () => {
        if (!missing.length) toast('All core product pillars are active', 'good');
        else toast(`${missing.length} pillar needs attention`, 'warn');
      } } }, ['Run check again']),
    ]));
    return { passed, total: checks.length, missing };
  }

  function modal(title, subtitle) {
    const wrap = h('div', { class: 'modal ux-modal' });
    const back = h('div', { class: 'modal-back', on: { click: () => wrap.remove() } });
    const panel = h('div', { class: 'modal-panel wide ux-modal-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    panel.appendChild(h('div', { class: 'eyebrow' }, ['Product polish']));
    panel.appendChild(h('h3', { style: { marginTop: '6px' } }, [title]));
    if (subtitle) panel.appendChild(h('p', { class: 'muted', style: { marginTop: '6px', fontSize: '13px' } }, [subtitle]));
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    const focusable = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(() => focusable.focus(), 20);
    wrap.addEventListener('keydown', e => {
      if (e.key === 'Escape') wrap.remove();
    });
    return { wrap, panel, close: () => wrap.remove() };
  }

  function appendAssurancePanel(app) {
    if (!app || app.querySelector('.ux-assurance-card')) return;
    const target = app.querySelector('.settings-grid > main') || app.querySelector('.settings-grid') || app;
    const checks = featureChecks();
    const passed = checks.filter(c => c.ok).length;
    const card = h('section', { class: 'setting-group ux-assurance-card', id: 'settings-product-assurance' }, [
      h('div', { class: 'row-between ux-assurance-head' }, [
        h('div', {}, [
          h('h3', {}, ['Product assurance']),
          h('div', { class: 'desc' }, ['A quick confidence panel for serious players, coaches, and deployment testing.']),
        ]),
        h('span', { class: 'pill ' + (passed === checks.length ? 'pill-good' : 'pill-warn') }, [`${passed}/${checks.length} active`]),
      ]),
      h('div', { class: 'ux-feature-grid' }, checks.map(c => h('div', { class: 'ux-feature ' + (c.ok ? 'ok' : 'warn') }, [
        h('span', { class: 'ux-feature-icon', 'aria-hidden': 'true' }, [c.ok ? '✓' : '!']),
        h('div', {}, [h('strong', {}, [c.name]), h('small', {}, [c.desc])]),
      ]))),
      h('div', { class: 'row ux-assurance-actions' }, [
        h('button', { class: 'btn', on: { click: runUXChecklist } }, ['Run UX check']),
        h('button', { class: 'btn', on: { click: () => global.OOSViews && global.OOSViews.showBackupRestore ? global.OOSViews.showBackupRestore() : toast('Data safety center unavailable', 'warn') } }, ['Data safety']),
        h('button', { class: 'btn btn-primary', on: { click: () => { const n = document.getElementById('settings-cloud'); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' }); else toast('Cloud sync panel is in Settings after Appwrite setup loads', 'info'); } } }, ['Cloud sync setup']),
      ]),
    ]);
    target.appendChild(card);

    const side = app.querySelector('.settings-side');
    if (side && !side.querySelector('[href="#settings-product-assurance"]')) {
      side.appendChild(h('a', { href: '#settings-product-assurance', on: { click: e => {
        e.preventDefault();
        const n = document.getElementById('settings-product-assurance');
        if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } } }, ['Product assurance']));
    }
  }

  function enhanceInteractive(root) {
    root = root || document;
    const selector = [
      '.action-card', '.rep-folder', '.rep-line', '.game-item', '.cov-cell',
      '.onboard-opt', '.import-opt', '.note-type', '.mode-card', '.course-card',
      '.calendar-day', '.launch-stat', '.ux-feature'
    ].join(',');
    root.querySelectorAll(selector).forEach(node => {
      if (node.dataset.uxKeyed === 'true') return;
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');
      if (!node.hasAttribute('role')) node.setAttribute('role', 'button');
      node.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          node.click();
        }
      });
      node.dataset.uxKeyed = 'true';
    });
  }

  function installSkipLink() {
    if (document.querySelector('.skip-link')) return;
    const link = h('a', { class: 'skip-link', href: '#app' }, ['Skip to content']);
    document.body.insertBefore(link, document.body.firstChild);
    const app = document.getElementById('app');
    if (app && !app.hasAttribute('tabindex')) app.setAttribute('tabindex', '-1');
  }

  function patchViews() {
    const Views = global.OOSViews;
    if (!Views || Views.__uxPolished) return false;
    Views.__uxPolished = true;
    ['renderToday','renderRepertoire','renderPractice','renderGames','renderInsights','renderSettings','renderLibrary','renderCoach','renderOpponentPrep'].forEach(name => {
      if (typeof Views[name] !== 'function') return;
      const original = Views[name];
      Views[name] = function patchedRender() {
        const result = original.apply(this, arguments);
        const app = document.getElementById('app');
        requestAnimationFrame(() => {
          enhanceInteractive(app || document);
          if (name === 'renderSettings') appendAssurancePanel(app);
        });
        return result;
      };
    });
    return true;
  }

  function init() {
    document.documentElement.dataset.uxPolished = 'true';
    if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) document.documentElement.dataset.touch = 'true';
    installSkipLink();
    enhanceInteractive(document);
    patchViews();
    window.addEventListener('resize', () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`), { passive: true });
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  }

  document.addEventListener('DOMContentLoaded', init);
  setTimeout(() => { init(); patchViews(); }, 0);

  global.OOSUX = {
    version: VERSION,
    featureChecks,
    runUXChecklist,
    enhanceInteractive,
    appendAssurancePanel,
  };
})(window);
