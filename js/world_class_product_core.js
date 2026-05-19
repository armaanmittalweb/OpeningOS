/* OpeningOS — world-class product core
 * Consolidates product shell, chess-player dashboard, repertoire workspace,
 * import cockpit, game repair reports, sync trust, and keyboard polish.
 * This layer deliberately uses player-facing language only: Account, Workspace,
 * Cloud sync, Repertoire, Practice, Games.
 */
(function (global) {
  'use strict';

  const VERSION = '2026.05.18-world-class-core';
  const NAV = [
    { id: 'today', label: 'Today', icon: '⌂' },
    { id: 'repertoire', label: 'Repertoire', icon: '♟' },
    { id: 'practice', label: 'Practice', icon: '▶' },
    { id: 'games', label: 'Games', icon: '▤' },
    { id: 'insights', label: 'Insights', icon: '◌' },
    { id: 'library', label: 'Library', icon: '□' },
    { id: 'coach', label: 'Coach', icon: '◎' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ];
  const IMPORT_STEPS = ['Connecting', 'Fetching games', 'Parsing games', 'Matching repertoire', 'Finding repair moments'];
  const BUILD_KEY = 'OpeningOS Beta · ' + VERSION;
  let syncProbeTimer = null;
  let enhancementTimer = null;
  let mutationObserver = null;
  let installDone = false;
  let enhancementBusy = false;
  let lastLanguageSanitizeAt = 0;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]); }
  function nowLabel(ts) {
    if (!ts) return 'Not synced yet';
    const d = Date.now() - Number(ts);
    if (d < 10_000) return 'Synced just now';
    if (d < 60_000) return 'Synced ' + Math.max(10, Math.round(d / 1000)) + 's ago';
    if (d < 3_600_000) return 'Synced ' + Math.round(d / 60_000) + 'm ago';
    return 'Synced ' + new Date(Number(ts)).toLocaleString();
  }
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info'); }
  function appView() { return (document.body && document.body.dataset.view) || (location.hash || '#today').slice(1) || 'today'; }
  function go(view, opts) { if (global.OOSApp && global.OOSApp.go) global.OOSApp.go(view, opts || {}); else location.hash = view; }
  function auth() { try { return global.OOSAuthBridge && global.OOSAuthBridge.authState ? global.OOSAuthBridge.authState() : {}; } catch (_) { return {}; } }
  function signedIn() { const s = auth(); return !!(s && (s.token || s.accessToken) && s.user); }
  function backendUrl() { const s = auth(); return String((s && s.backendUrl) || (global.OPENINGOS_ENV && global.OPENINGOS_ENV.backendUrl) || 'https://monkfish-app-yxidj.ondigitalocean.app').replace(/\/+$/, ''); }
  function activeUserLabel() { const s = auth(); return (s.user && (s.user.name || s.user.displayName || s.user.email)) || ((global.OOSProfiles && global.OOSProfiles.active && global.OOSProfiles.active() || {}).name) || 'Player'; }

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'on') Object.keys(v || {}).forEach(ev => n.addEventListener(ev, v[ev]));
      else if (k === 'style') Object.assign(n.style, v || {});
      else if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }

  function install() {
    if (installDone) return;
    installDone = true;
    document.body.classList.add('wc-shell-enabled');
    ensureShell();
    installSyncHooks();
    installImportWizard();
    installKeyboard();
    installMutationEnhancer();
    scheduleEnhance();
    setInterval(updateSyncTrust, 15_000);
  }

  function ensureShell() {
    if ($('#wcSidebar')) { updateActiveNav(); return; }

    const sidebar = el('aside', { id: 'wcSidebar', class: 'wc-sidebar', 'aria-label': 'OpeningOS workspace navigation' }, [
      el('div', { class: 'wc-sidebar-brand' }, [
        el('div', { class: 'wc-brand-mark', text: '♞' }),
        el('div', {}, [el('strong', { text: 'OpeningOS' }), el('span', { text: 'Opening prep workspace' })])
      ]),
      el('nav', { class: 'wc-side-nav' }, NAV.map(item => el('button', { type: 'button', 'data-wc-nav': item.id, on: { click: () => go(item.id) } }, [
        el('span', { class: 'wc-nav-icon', text: item.icon }),
        el('span', { text: item.label })
      ]))),
      el('div', { class: 'wc-sidebar-foot' }, [
        el('button', { class: 'wc-feedback', type: 'button', on: { click: openFeedback } }, ['Send feedback']),
        el('small', { text: BUILD_KEY })
      ])
    ]);

    const topbar = el('div', { id: 'wcTopbar', class: 'wc-topbar' }, [
      el('div', { class: 'wc-topbar-left' }, [
        el('button', { id: 'wcMobileMenu', class: 'wc-icon-button', type: 'button', 'aria-label': 'Open menu', on: { click: toggleSidebar } }, ['☰']),
        el('button', { class: 'wc-search', type: 'button', on: { click: () => $('#cmdTrigger') && $('#cmdTrigger').click() } }, [
          el('span', { text: 'Search openings, games, actions…' }),
          el('kbd', { text: 'Ctrl K' })
        ])
      ]),
      el('div', { class: 'wc-topbar-right' }, [
        el('button', { id: 'wcSyncPill', class: 'wc-sync-pill is-checking', type: 'button', on: { click: () => retrySync() } }, [
          el('span', { class: 'wc-status-dot' }),
          el('span', { class: 'wc-sync-text', text: 'Checking sync…' })
        ]),
        el('button', { id: 'wcAccountButton', class: 'wc-account-chip', type: 'button', on: { click: () => openAccount() } }, [
          el('span', { class: 'wc-account-avatar', text: '♔' }),
          el('span', { class: 'wc-account-label', text: activeUserLabel() })
        ])
      ])
    ]);

    document.body.insertBefore(sidebar, document.body.firstChild);
    const main = $('#app');
    if (main) document.body.insertBefore(topbar, main);
    updateActiveNav();
    updateSyncTrust();
  }

  function toggleSidebar() { document.body.classList.toggle('wc-sidebar-open'); }
  function updateActiveNav() {
    const v = appView();
    $all('[data-wc-nav]').forEach(b => b.classList.toggle('is-active', b.dataset.wcNav === v));
    const label = $('#wcAccountButton .wc-account-label');
    if (label) label.textContent = activeUserLabel();
  }
  function openAccount() {
    if (global.OOSAuthBridge && global.OOSAuthBridge.show) return global.OOSAuthBridge.show({ onDone: () => { updateSyncTrust(true); scheduleEnhance(); } });
    const btn = $('#profileBtn');
    if (btn) btn.click();
  }

  function installSyncHooks() {
    if (global.OOSData && !global.OOSData.__wcPersistWrapped && global.OOSData.persist) {
      const old = global.OOSData.persist.bind(global.OOSData);
      global.OOSData.persist = function () {
        const out = old.apply(this, arguments);
        localStorage.setItem('oos.trust.localSavedAt', String(Date.now()));
        updateSyncTrust();
        return out;
      };
      global.OOSData.__wcPersistWrapped = true;
    }
    ['OOSSaaS', 'OOSEnterpriseAPI'].forEach(name => {
      const api = global[name];
      if (!api || api.__wcSyncWrapped) return;
      ['pushSnapshot', 'pullSnapshot', 'pushGraphSnapshot', 'pullGraphSnapshot'].forEach(fn => {
        if (typeof api[fn] !== 'function') return;
        const old = api[fn].bind(api);
        api[fn] = async function () {
          setSyncStatus('syncing', 'Syncing…');
          try {
            const out = await old.apply(this, arguments);
            localStorage.setItem('oos.trust.lastCloudSyncAt', String(Date.now()));
            setSyncStatus('good', 'Synced just now');
            return out;
          } catch (err) {
            setSyncStatus('warn', 'Sync needs attention');
            throw err;
          }
        };
      });
      api.__wcSyncWrapped = true;
    });
  }

  function setSyncStatus(kind, text) {
    const pill = $('#wcSyncPill');
    if (!pill) return;
    pill.className = 'wc-sync-pill is-' + kind;
    const t = pill.querySelector('.wc-sync-text');
    if (t) t.textContent = text;
  }

  async function updateSyncTrust(force) {
    ensureShell();
    if (syncProbeTimer && !force) return;
    syncProbeTimer = setTimeout(() => { syncProbeTimer = null; }, 5000);
    const localAt = localStorage.getItem('oos.trust.localSavedAt');
    const syncAt = localStorage.getItem('oos.trust.lastCloudSyncAt');
    if (!signedIn()) {
      setSyncStatus('local', localAt ? 'Saved on this device' : 'Local workspace');
      return;
    }
    const last = syncAt ? nowLabel(syncAt) : 'Cloud connected';
    setSyncStatus('good', last);
    if (force) {
      try {
        const res = await fetch(backendUrl() + '/health', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        setSyncStatus(json && json.ok ? 'good' : 'warn', json && json.ok ? last : 'Cloud check failed');
      } catch (_) { setSyncStatus('warn', 'Cloud unreachable'); }
    }
  }
  async function retrySync() {
    try {
      if (!signedIn()) return openAccount();
      setSyncStatus('syncing', 'Syncing…');
      if (global.OOSSaaS && global.OOSSaaS.pushSnapshot) await global.OOSSaaS.pushSnapshot();
      else if (global.OOSEnterpriseAPI && global.OOSEnterpriseAPI.pushSnapshot) await global.OOSEnterpriseAPI.pushSnapshot();
      localStorage.setItem('oos.trust.lastCloudSyncAt', String(Date.now()));
      setSyncStatus('good', 'Synced just now');
      toast('Cloud sync updated', 'good');
    } catch (err) {
      setSyncStatus('warn', 'Sync failed — retry');
      toast((global.OOSAuthBridge && global.OOSAuthBridge.friendlyError ? global.OOSAuthBridge.friendlyError(err) : err.message) || 'Sync failed', 'warn');
    }
  }

  function installMutationEnhancer() {
  window.addEventListener('hashchange', function () { scheduleEnhance(); });

  window.addEventListener('resize', function () {
    document.documentElement.style.setProperty('--wc-vh', (window.innerHeight * 0.01) + 'px');
  }, { passive: true });

  document.documentElement.style.setProperty('--wc-vh', (window.innerHeight * 0.01) + 'px');

  if (global.OOSApp && !global.OOSApp.__wcEnhanceGoHooked && typeof global.OOSApp.go === 'function') {
    const oldGo = global.OOSApp.go.bind(global.OOSApp);
    global.OOSApp.go = function wcGoPatched() {
      const out = oldGo.apply(this, arguments);
      scheduleEnhance();
      return out;
    };
    global.OOSApp.__wcEnhanceGoHooked = true;
  }
} function scheduleEnhance() {
    clearTimeout(enhancementTimer);
    const run = () => {
      if (enhancementBusy) return;
      enhancementBusy = true;
      try { enhance(); } finally { enhancementBusy = false; }
    };
    enhancementTimer = setTimeout(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 900 });
      else run();
    }, 120);
  }
  function enhance() {
    ensureShell();
    updateActiveNav();
    const view = appView();
    const app = $('#app');
    // Language cleanup is useful, but it should be scoped and throttled. A full
    // document TreeWalker on every mutation was the main source of unresponsiveness.
    const now = Date.now();
    if (app && now - lastLanguageSanitizeAt > 1000) {
      sanitizeLanguage(app);
      lastLanguageSanitizeAt = now;
    }
    if (view === 'today') enhanceToday();
    if (view === 'repertoire') enhanceRepertoire();
    if (view === 'games') enhanceGames();
    if (view === 'practice') enhancePractice();
    if (view === 'settings') enhanceSettings();
    wireFocusTraps();
  }

  function sanitizeLanguage(root) {
    const replacements = [
      [/backend API/gi, 'Cloud connection'], [/backend/gi, 'cloud'], [/SaaS/gi, 'Cloud'], [/sync snapshot/gi, 'cloud backup'], [/graph bundle/gi, 'repertoire package'], [/local profile/gi, 'workspace'], [/profile/gi, 'workspace']
    ];
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !/(backend|SaaS|snapshot|graph bundle|local profile)/i.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || ['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      let next = n.nodeValue;
      replacements.forEach(([re, to]) => { next = next.replace(re, to); });
      if (next !== n.nodeValue) n.nodeValue = next;
    });
    $all('.account-gateway .account-grid .field:first-child, .auth-grid .field:first-child').forEach(n => n.style.display = 'none');
  }

  function enhanceToday() {
    const app = $('#app');
    if (!app || $('#wcTodayCommand')) return;
    const DB = global.OOSData;
    if (!DB) return;
    const due = safeArray(() => DB.duePositions());
    const weak = safeArray(() => DB.weakPositions());
    const games = safeArray(() => DB.importedGames ? DB.importedGames() : []);
    const repair = repairMoments().slice(0, 6);
    const weakest = weak[0] || due[0];
    const syncedAt = localStorage.getItem('oos.trust.lastCloudSyncAt');
    const localAt = localStorage.getItem('oos.trust.localSavedAt');
    const command = el('section', { id: 'wcTodayCommand', class: 'wc-command-center' }, [
      el('div', { class: 'wc-command-copy' }, [
        el('div', { class: 'eyebrow', text: 'Today\'s preparation' }),
        el('h1', { text: due.length ? 'Your next review is ready.' : 'Your repertoire is caught up.' }),
        el('p', { text: due.length ? 'Start with the cards due today, then repair the mistakes found in your recent games.' : 'Add a line, import recent games, or warm up with weak positions.' })
      ]),
      el('div', { class: 'wc-command-actions' }, [
        el('button', { class: 'btn btn-primary', on: { click: () => go('practice') } }, ['Start review']),
        el('button', { class: 'btn', on: { click: () => global.OOSApp && global.OOSApp.openImport ? global.OOSApp.openImport() : go('games') } }, ['Import games'])
      ]),
      el('div', { class: 'wc-today-kpis' }, [
        statCard(String(due.length), 'positions due today', due.length ? 'Estimated ' + Math.max(5, Math.round(due.length * 0.5)) + ' min' : 'No pressure today', () => go('practice')),
        statCard(weakest ? weakest.name : 'None', 'weakest line', weakest ? 'Open and repair this line' : 'Add games to find weaknesses', () => weakest ? go('repertoire', { lineId: weakest.lineId || weakest.id }) : go('games')),
        statCard(String(repair.length), 'repair moments', repair.length ? 'Practice your repair set now' : 'Import games to create repairs', () => repair.length ? practiceRepairSet(repair) : global.OOSApp.openImport()),
        statCard(syncedAt ? nowLabel(syncedAt) : (localAt ? 'Saved locally' : 'Ready'), 'cloud safety', signedIn() ? 'Cloud connected' : 'Create account for sync', () => retrySync())
      ])
    ]);
    const first = app.firstElementChild;
    if (first) app.insertBefore(command, first); else app.appendChild(command);
  }
  function statCard(value, label, meta, click) {
    return el('button', { class: 'wc-stat-card', type: 'button', on: { click } }, [el('strong', { text: value }), el('span', { text: label }), el('small', { text: meta })]);
  }

  function enhanceRepertoire() {
    const layout = $('.rep-layout');
    if (!layout || layout.classList.contains('wc-enhanced-repertoire')) return;
    layout.classList.add('wc-enhanced-repertoire');
    const DB = global.OOSData;
    const active = activeLine();
    const header = el('section', { class: 'wc-rep-command' }, [
      el('div', {}, [el('div', { class: 'eyebrow', text: 'Repertoire workspace' }), el('h1', { text: active ? active.name : 'Build your openings' }), el('p', { text: 'Board, move list, idea card, and repair actions stay together so you can prepare without hunting through menus.' })]),
      el('div', { class: 'wc-rep-actions' }, [
        el('input', { id: 'wcLineSearch', class: 'input', placeholder: 'Search openings or lines…', on: { input: e => filterLines(e.target.value) } }),
        el('button', { class: 'btn btn-primary', on: { click: () => clickByText('Practice from here') || clickByText('Practice line') || go('practice') } }, ['Practice from here']),
        el('button', { class: 'btn', on: { click: openPositionCommandMenu } }, ['Position actions'])
      ])
    ]);
    layout.parentElement.insertBefore(header, layout);

    const filters = el('div', { class: 'wc-line-filters' }, ['All','Due','Weak','Critical','Branches','Retired'].map(label => el('button', { type: 'button', class: label === 'All' ? 'is-active' : '', on: { click: (e) => { $all('.wc-line-filters button').forEach(b => b.classList.remove('is-active')); e.currentTarget.classList.add('is-active'); filterLines($('#wcLineSearch') ? $('#wcLineSearch').value : '', label.toLowerCase()); } } }, [label])));
    const folders = $('.rep-folders');
    if (folders) folders.insertBefore(filters, folders.firstChild);

    const boardHost = $('.board-wrap') || $('.chess-board') || $('.board-panel');
    if (boardHost && !$('.wc-board-toolbar', boardHost.parentElement)) {
      const toolbar = el('div', { class: 'wc-board-toolbar', role: 'toolbar', 'aria-label': 'Board controls' }, [
        el('button', { class: 'btn btn-sm', on: { click: () => clickByText('Flip') } }, ['Flip board']),
        el('button', { class: 'btn btn-sm', on: { click: () => document.body.classList.toggle('wc-board-focus') } }, ['Focus board']),
        el('button', { class: 'btn btn-sm', on: { click: () => setBoardSize('compact') } }, ['Compact']),
        el('button', { class: 'btn btn-sm', on: { click: () => setBoardSize('comfort') } }, ['Comfort']),
        el('button', { class: 'btn btn-sm', on: { click: () => setBoardSize('analysis') } }, ['Analysis'])
      ]);
      boardHost.parentElement.insertBefore(toolbar, boardHost);
    }

    const dock = el('div', { class: 'wc-position-dock' }, [
      posAction('Practice', () => clickByText('Practice from here') || go('practice')),
      posAction('Reply', () => focusPlaceholder('Opponent reply from here')),
      posAction('Variation', () => focusPlaceholder('Side variation moves')),
      posAction('Critical', () => clickByText('Mark critical') || clickByText('✓ Critical')),
      posAction('Idea', () => openIdeaEditor()),
      posAction('Split', () => clickByText('Split from here')),
      posAction('Retire', () => clickByText('Retire line') || clickByText('Restore line')),
      posAction('Transpositions', () => scrollToText('Also occurs in') || scrollToText('Transposition options'))
    ]);
    const right = $('.move-tree') ? $('.move-tree').parentElement : null;
    if (right && !$('.wc-position-dock', right)) right.insertBefore(dock, right.firstChild);

    const lines = safeArray(() => DB.lines({ includeRetired: true }));
    $all('.rep-line').forEach(node => {
      const name = node.textContent || '';
      const line = lines.find(l => name.includes(l.name));
      if (line) {
        const pills = el('span', { class: 'wc-line-pills' });
        if (line.parentLineId) pills.appendChild(el('small', { text: 'branch' }));
        if (line.status === 'retired' || line.retired) pills.appendChild(el('small', { text: 'retired' }));
        const count = safeArray(() => DB.positionsForLine(line.id)).length;
        if (count) pills.appendChild(el('small', { text: count + ' cards' }));
        if (!node.querySelector('.wc-line-pills')) node.appendChild(pills);
        node.tabIndex = 0;
        node.setAttribute('role', 'button');
        if (node.dataset.wcLineKeyboard !== '1') {
          node.dataset.wcLineKeyboard = '1';
          node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); node.click(); } });
        }
      }
    });
  }
  function posAction(label, fn) { return el('button', { type: 'button', on: { click: fn } }, [label]); }
  function setBoardSize(size) {
    document.documentElement.setAttribute('data-board-size', size);
    try { global.OOSData && global.OOSData.setSetting && global.OOSData.setSetting('boardSize', size); } catch (_) {}
    toast('Board size: ' + size, 'good');
  }
  function activeLine() {
    const txt = ($('.rep-line.is-active') || {}).textContent || '';
    const lines = safeArray(() => global.OOSData.lines({ includeRetired: true }));
    return lines.find(l => txt.includes(l.name)) || lines[0] || null;
  }
  function filterLines(query, filter) {
    query = String(query || '').toLowerCase(); filter = filter || (($('.wc-line-filters .is-active') || {}).textContent || 'all').toLowerCase();
    const lines = safeArray(() => global.OOSData.lines({ includeRetired: true }));
    $all('.rep-line').forEach(node => {
      const txt = String(node.textContent || '').toLowerCase();
      const line = lines.find(l => txt.includes(String(l.name || '').toLowerCase()));
      let ok = !query || txt.includes(query);
      if (ok && line && filter !== 'all') {
        if (filter === 'branches') ok = !!line.parentLineId;
        else if (filter === 'retired') ok = line.status === 'retired' || line.retired;
        else if (filter === 'due') ok = safeArray(() => global.OOSData.cardsFromLine(line.id)).some(c => safeArray(() => global.OOSData.duePositions()).some(d => d.id === c.id));
        else if (filter === 'weak') ok = safeArray(() => global.OOSData.cardsFromLine(line.id)).some(c => safeArray(() => global.OOSData.weakPositions()).some(d => d.id === c.id));
        else if (filter === 'critical') ok = safeArray(() => global.OOSData.cardsFromLine(line.id)).some(c => c.critical || (global.OOSData.positionFlag && global.OOSData.positionFlag(c.id).critical));
      }
      node.hidden = !ok;
    });
  }
  function openIdeaEditor() {
    const details = $('.idea-edit');
    if (details) { details.open = true; details.scrollIntoView({ behavior: 'smooth', block: 'center' }); const ta = details.querySelector('textarea'); if (ta) ta.focus(); return true; }
    const input = $('.rep-aside textarea'); if (input) { input.focus(); return true; }
    toast('Step into a position to edit its idea card.', 'info'); return false;
  }
  function clickByText(text) {
    const btn = $all('button').find(b => (b.textContent || '').trim().toLowerCase().includes(String(text).toLowerCase()));
    if (btn) { btn.click(); return true; }
    return false;
  }
  function focusPlaceholder(fragment) {
    const field = $all('input, textarea').find(i => String(i.placeholder || '').toLowerCase().includes(String(fragment).toLowerCase()));
    if (field) { field.focus(); field.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
    toast('Open an editable line or customize a copy first.', 'info'); return false;
  }
  function scrollToText(text) {
    const node = $all('body *').find(n => n.children.length === 0 && String(n.textContent || '').includes(text));
    if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
    toast('No transpositions found for this position yet.', 'info'); return false;
  }

  function enhanceGames() {
    const app = $('#app');
    if (!app || $('#wcImportCockpit')) return;
    const repair = repairMoments();
    const cockpit = el('section', { id: 'wcImportCockpit', class: 'wc-import-cockpit' }, [
      el('div', {}, [el('div', { class: 'eyebrow', text: 'Games become training' }), el('h1', { text: 'Import games, find opening leaks, repair them.' }), el('p', { text: 'OpeningOS matches your real games to your repertoire and turns deviations into a focused repair set.' })]),
      el('div', { class: 'wc-import-actions' }, [
        el('button', { class: 'btn btn-primary', on: { click: () => openProductImport('chesscom') } }, ['Import Chess.com']),
        el('button', { class: 'btn', on: { click: () => openProductImport('lichess') } }, ['Import Lichess']),
        el('button', { class: 'btn', on: { click: () => openProductImport('pgn') } }, ['Paste PGN'])
      ]),
      el('div', { class: 'wc-repair-summary' }, [
        el('strong', { text: String(repair.length) }),
        el('span', { text: repair.length ? 'repair moments found from your imported games' : 'repair moments will appear here after import' }),
        el('button', { class: 'btn btn-sm', disabled: !repair.length, on: { click: () => practiceRepairSet(repair) } }, ['Practice repair set'])
      ])
    ]);
    app.insertBefore(cockpit, app.firstElementChild);
    enhanceRepairCards(repair);
  }
  function enhanceRepairCards(repair) {
    if (!repair.length || $('#wcRepairInbox')) return;
    const app = $('#app');
    const inbox = el('section', { id: 'wcRepairInbox', class: 'wc-repair-inbox card' }, [
      el('div', { class: 'row-between' }, [el('div', {}, [el('div', { class: 'eyebrow', text: 'Opening repair report' }), el('h3', { text: 'Your most useful corrections' })]), el('button', { class: 'btn btn-primary btn-sm', on: { click: () => practiceRepairSet(repair) } }, ['Practice repair set'])]),
      ...repair.slice(0, 5).map(r => el('div', { class: 'wc-repair-row' }, [
        el('div', {}, [el('strong', { text: r.title }), el('p', { text: r.copy })]),
        el('button', { class: 'btn btn-sm', on: { click: () => r.practice() } }, ['Practice'])
      ]))
    ]);
    const cockpit = $('#wcImportCockpit');
    if (cockpit) cockpit.after(inbox); else app.prepend(inbox);
  }

  function installImportWizard() {
    if (!global.OOSViews || global.OOSViews.__wcImportInstalled) return;
    const original = global.OOSViews.showImportWizard;
    global.OOSViews.showImportWizard = function (onSubmit, preferred) { return showProductImportWizard(onSubmit, preferred); };
    global.OOSViews.__wcImportInstalled = true;
    global.OOSViews.showLegacyImportWizard = original;
  }
  function openProductImport(source) { showProductImportWizard((r) => { if (r && global.OOSApp) global.OOSApp.go('games'); }, source); }

  function showProductImportWizard(onSubmit, preferred) {
    const DB = global.OOSData;
    const wrap = el('div', { class: 'modal wc-import-modal' });
    const panel = el('div', { class: 'modal-panel wide wc-import-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Import games' });
    let source = preferred || 'chesscom';
    let games = [];
    let parsed = [];
    let status = 'idle';
    let message = '';
    let importMode = 'game';
    let color = 'auto';
    const state = { step: 0 };
    function render() {
      panel.innerHTML = '';
      panel.append(el('div', { class: 'wc-import-head' }, [
        el('div', {}, [el('div', { class: 'eyebrow', text: 'Game import' }), el('h2', { text: 'Turn recent games into opening prep' }), el('p', { text: 'Import, match, review, and create repair practice in one flow.' })]),
        el('button', { class: 'icon-btn', 'aria-label': 'Close', on: { click: close } }, ['×'])
      ]));
      const tabs = el('div', { class: 'wc-import-tabs' }, [
        tab('chesscom', 'Chess.com'), tab('lichess', 'Lichess'), tab('pgn', 'Paste PGN')
      ]);
      panel.append(tabs);
      if (status === 'idle' || status === 'error') renderInput();
      else if (status === 'working') renderProgress();
      else renderResults();
      wrap.appendChild(panel);
    }
    function tab(id, label) { return el('button', { type: 'button', class: source === id ? 'is-active' : '', on: { click: () => { source = id; games = []; parsed = []; status = 'idle'; render(); } } }, [label]); }
    function renderInput() {
      if (source === 'pgn') {
        const ta = el('textarea', { class: 'input wc-pgn-input', placeholder: 'Paste one or many PGNs here…' });
        panel.append(el('div', { class: 'wc-import-body' }, [ta, message ? el('div', { class: 'wc-import-error', text: message }) : null, el('button', { class: 'btn btn-primary', on: { click: () => runPgn(ta.value) } }, ['Parse PGN'])]));
      } else {
        const user = el('input', { class: 'input', placeholder: source === 'chesscom' ? 'Chess.com username' : 'Lichess username', autocomplete: 'off' });
        const max = el('select', { class: 'input' }, [10,20,50,100,200].map(n => el('option', { value: String(n), text: String(n) + ' games' })) );
        panel.append(el('div', { class: 'wc-import-body' }, [
          el('div', { class: 'wc-import-form-grid' }, [el('label', { class: 'field' }, [el('span', { text: 'Username' }), user]), el('label', { class: 'field' }, [el('span', { text: 'Amount' }), max])]),
          el('div', { class: 'wc-import-help', text: signedIn() ? 'Cloud import is active. OpeningOS will fetch games from the server, then match them to your repertoire.' : 'Create an account for the most reliable imports. Browser fallback is available for public profiles.' }),
          message ? el('div', { class: 'wc-import-error', text: message }) : null,
          el('button', { class: 'btn btn-primary', on: { click: () => runRemote(user.value, Number(max.value || 20)) } }, ['Import games'])
        ]));
        setTimeout(() => user.focus(), 50);
      }
    }
    function renderProgress() {
      panel.append(el('div', { class: 'wc-import-progress' }, IMPORT_STEPS.map((s, i) => el('div', { class: 'wc-import-step ' + (i < state.step ? 'is-done' : i === state.step ? 'is-active' : '') }, [el('span'), el('strong', { text: s }), el('small', { text: i === state.step ? message || 'Working…' : '' })]))));
    }
    function renderResults() {
      const summary = summarizeImport(parsed);
      panel.append(el('div', { class: 'wc-import-results' }, [
        el('div', { class: 'wc-import-scorecards' }, [
          statCard(String(parsed.length), 'games parsed', 'Ready to save', () => {}),
          statCard(String(summary.matched), 'matched lines', 'Against your repertoire', () => {}),
          statCard(String(summary.deviations), 'repair moments', 'Can become practice', () => {})
        ]),
        el('div', { class: 'wc-import-preview' }, parsed.slice(0, 6).map((g, i) => {
          const h = global.OOSPgn.openingFromHeaders(g.headers || {});
          return el('div', { class: 'wc-import-preview-row' }, [el('strong', { text: (h.white || 'White') + ' vs ' + (h.black || 'Black') }), el('span', { text: h.opening || 'Unknown opening' }), el('small', { text: h.result || '*' })]);
        })),
        el('div', { class: 'wc-import-save-grid' }, [
          optionButton('game', 'Save as games', 'Best for review and repair'),
          optionButton('line', 'Create repertoire line', 'Useful for studies/analysis'),
          optionButton('both', 'Both', 'Save theory and game evidence')
        ]),
        el('div', { class: 'choice-row' }, ['auto','w','b'].map(v => el('button', { class: color === v ? 'is-active' : '', on: { click: () => { color = v; render(); } } }, [v === 'auto' ? 'Auto color' : v === 'w' ? 'I was White' : 'I was Black']))),
        el('div', { class: 'auth-actions product-actions' }, [el('button', { class: 'btn', on: { click: () => { status = 'idle'; render(); } } }, ['Back']), el('button', { class: 'btn btn-primary', on: { click: saveImport } }, ['Save and create repairs'])])
      ]));
    }
    function optionButton(id, title, copy) { return el('button', { class: 'wc-import-save-card ' + (importMode === id ? 'is-active' : ''), on: { click: () => { importMode = id; render(); } } }, [el('strong', { text: title }), el('small', { text: copy })]); }
    async function runRemote(username, max) {
      username = String(username || '').trim();
      if (!username) { message = 'Enter a public username.'; status = 'error'; render(); return; }
      status = 'working'; state.step = 0; message = 'Connecting to ' + (source === 'chesscom' ? 'Chess.com' : 'Lichess') + '…'; render();
      try {
        state.step = 1; message = 'Fetching recent games…'; render();
        games = source === 'chesscom' ? await global.OOSApi.chesscomUserGames(username, max) : await global.OOSApi.lichessUserGames(username, max);
        state.step = 2; message = 'Parsing PGNs…'; render();
        parsed = parseGameList(games);
        if (!parsed.length) throw new Error('No parseable games were returned. Check the username, privacy settings, or try fewer games.');
        state.step = 3; message = 'Matching your repertoire…'; render(); await delay(120);
        state.step = 4; message = 'Finding useful repair moments…'; render(); await delay(120);
        status = 'done'; render();
      } catch (err) { status = 'error'; message = friendlyImportError(err); render(); }
    }
    function runPgn(text) {
      try { parsed = global.OOSPgn.parse(String(text || '')); if (!parsed.length) throw new Error('No PGN games found.'); status = 'done'; render(); }
      catch (err) { status = 'error'; message = friendlyImportError(err); render(); }
    }
    function parseGameList(list) {
      const out = [];
      (list || []).forEach(g => {
        try {
          if (g && g.parsed) out.push(g.parsed);
          else if (g && g.pgn) global.OOSPgn.parse(g.pgn).forEach(p => out.push(p));
        } catch (_) {}
      });
      return out;
    }
    function summarizeImport(gamesParsed) {
      let matched = 0, deviations = 0;
      gamesParsed.forEach(g => {
        const ml = global.OOSPgn.mainlineSan(g);
        const match = global.OOSData.bestLineMatchForPgn ? global.OOSData.bestLineMatchForPgn(ml.sanMoves.join(' ')) : null;
        if (match && match.lineId) matched++;
        if (match && match.lineId && ml.sanMoves.length > (match.matchedPlies || 0)) deviations++;
      });
      return { matched, deviations };
    }
    function saveImport() {
      let created = null, savedGames = 0, skipped = 0;
      parsed.forEach((g, idx) => {
        const h = global.OOSPgn.openingFromHeaders(g.headers || {});
        const ml = global.OOSPgn.mainlineSan(g);
        if (!ml.sanMoves.length) return;
        if ((importMode === 'line' || importMode === 'both') && !created && idx === 0) {
          created = DB.addUserLine({ name: h.opening || 'Imported line', eco: h.eco || '', opening: h.opening || 'Imported line', color: color === 'b' ? 'b' : 'w', tag: 'nice-to-know', description: 'Imported from ' + (h.event || source), moves: ml.sanMoves });
        }
        if (importMode === 'game' || importMode === 'both') {
          const pgnKey = ml.sanMoves.join(' ');
          const dup = safeArray(() => DB.importedGames()).some(existing => String(existing.pgn || '') === pgnKey);
          if (dup) { skipped++; return; }
          const match = created ? { lineId: created.id } : (DB.bestLineMatchForPgn ? DB.bestLineMatchForPgn(pgnKey) : null);
          const resolved = color === 'auto' ? 'w' : color;
          DB.addUserGame({ site: source === 'pgn' ? 'Imported' : (source === 'chesscom' ? 'Chess.com' : 'Lichess'), vs: resolved === 'w' ? h.black : h.white, yourColor: resolved, result: h.result === '1-0' ? (resolved === 'w' ? 'w' : 'l') : h.result === '0-1' ? (resolved === 'b' ? 'w' : 'l') : 'd', played: 'imported just now', timeControl: h.timeControl || g.headers?.TimeControl || '?', pgn: pgnKey, lineId: match && match.lineId || null, matchedLineId: match && match.lineId || null, status: match && match.lineId ? 'matched' : 'unmatched' });
          savedGames++;
        }
      });
      toast('Import complete: ' + savedGames + ' games saved' + (skipped ? ', ' + skipped + ' duplicates skipped' : '') + '.', 'good');
      close();
      onSubmit && onSubmit({ line: created, games: parsed, savedGames, skipped });
      go('games');
    }
    function close() { wrap.remove(); }
    wrap.append(el('div', { class: 'modal-back', on: { click: close } }), panel);
    document.body.appendChild(wrap); render();
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function friendlyImportError(err) {
    const raw = String(err && err.message || err || 'Import failed.');
    if (/404|not found|private|disabled/i.test(raw)) return 'This profile is private, unavailable, or has no public games.';
    if (/429|rate/i.test(raw)) return 'The game service is rate-limiting requests. Wait a minute and try again.';
    if (/network|fetch|failed/i.test(raw)) return 'Network request failed. Check your connection and try again.';
    if (/no parseable|no games|returned no/i.test(raw)) return 'No readable games were found. Try a different username or paste PGN.';
    return raw.replace(/^Error:\s*/i, '');
  }

  function enhancePractice() {
    const app = $('#app');
    if (!app || $('#wcPracticeCoach')) return;
    const due = safeArray(() => global.OOSData.duePositions());
    const weak = safeArray(() => global.OOSData.weakPositions());
    const note = el('div', { id: 'wcPracticeCoach', class: 'wc-practice-coach' }, [
      el('strong', { text: due.length ? 'Review due positions first.' : 'No cards due — train weak lines or learn new theory.' }),
      el('span', { text: weak.length ? ' Weak cards: ' + weak.length + '.' : ' Keep sessions short and accurate.' })
    ]);
    app.prepend(note);
  }
  function enhanceSettings() {
    const app = $('#app');
    if (!app || $('#wcTrustPanel')) return;
    const panel = el('section', { id: 'wcTrustPanel', class: 'wc-trust-panel card' }, [
      el('div', { class: 'row-between' }, [el('div', {}, [el('div', { class: 'eyebrow', text: 'Trust & safety' }), el('h3', { text: 'Your opening work is protected' }), el('p', { text: 'Use cloud sync, exports, and account controls before relying on prep for tournaments.' })]), el('button', { class: 'btn btn-primary btn-sm', on: { click: retrySync } }, ['Retry sync'])]),
      el('div', { class: 'wc-trust-grid' }, [
        trustItem('Saved locally', localStorage.getItem('oos.trust.localSavedAt') ? nowLabel(localStorage.getItem('oos.trust.localSavedAt')) : 'Ready'),
        trustItem('Cloud sync', signedIn() ? (localStorage.getItem('oos.trust.lastCloudSyncAt') ? nowLabel(localStorage.getItem('oos.trust.lastCloudSyncAt')) : 'Connected') : 'Sign in to enable'),
        trustItem('Backup', 'Export available from this page'),
        trustItem('Privacy', 'Private by default')
      ]),
      el('div', { class: 'wc-settings-links' }, [
        el('a', { href: 'PRIVACY.md', target: '_blank', rel: 'noopener', text: 'Privacy' }),
        el('a', { href: 'SECURITY.md', target: '_blank', rel: 'noopener', text: 'Security' }),
        el('button', { class: 'link-button', on: { click: openFeedback } }, ['Report a bug'])
      ])
    ]);
    app.prepend(panel);
  }
  function trustItem(k, v) { return el('div', { class: 'wc-trust-item' }, [el('span', { text: k }), el('strong', { text: v })]); }

  function repairMoments() {
    const DB = global.OOSData;
    if (!DB) return [];
    const games = safeArray(() => DB.importedGames());
    const counts = {};
    return games.map(g => {
      const dev = DB.detectDeviationForGame ? DB.detectDeviationForGame(g) : null;
      if (!dev) return null;
      const line = g.lineId && DB.line ? DB.line(g.lineId) : null;
      const key = (line && line.name || 'Unmatched opening') + ':' + dev.ply;
      counts[key] = (counts[key] || 0) + 1;
      return { game: g, dev, line, key, get title() { return 'Left prep on move ' + Math.ceil(dev.ply / 2); }, get copy() { return (line ? line.name : 'Imported game') + ' · prepared ' + (dev.expected || '?') + ', played ' + (dev.played || '?') + (counts[key] > 1 ? ' · repeated ' + counts[key] + ' times' : ''); }, practice() { const cards = line && DB.cardsFromLine ? DB.cardsFromLine(line.id, Math.max(0, dev.ply - 1)) : []; if (cards.length && global.OOSViews.startSessionWith) global.OOSViews.startSessionWith(cards, { mode: 'repair' }); else go('games'); } };
    }).filter(Boolean);
  }
  function practiceRepairSet(repair) {
    const cards = [];
    (repair || repairMoments()).forEach(r => { const more = r.line && global.OOSData.cardsFromLine ? global.OOSData.cardsFromLine(r.line.id, Math.max(0, r.dev.ply - 1)) : []; more.slice(0, 4).forEach(c => { if (!cards.some(x => x.id === c.id)) cards.push(c); }); });
    if (cards.length && global.OOSViews.startSessionWith) global.OOSViews.startSessionWith(cards, { mode: 'repair' }); else toast('No repair cards are ready yet. Import and match games first.', 'info');
  }

  function installKeyboard() {
    if (document.__wcKeyboardInstalled) return;
    document.__wcKeyboardInstalled = true;
    document.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
      if (e.key === '?') { e.preventDefault(); openKeyboardHelp(); }
      if (e.altKey && /^[1-8]$/.test(e.key)) { e.preventDefault(); const item = NAV[Number(e.key) - 1]; if (item) go(item.id); }
      if (appView() === 'repertoire') {
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); clickByText('Flip board'); }
        if (e.key === 'b' || e.key === 'B') { e.preventDefault(); document.body.classList.toggle('wc-board-focus'); }
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); clickByText('Practice from here'); }
        if (e.key === 'a' || e.key === 'A') { e.preventDefault(); openPositionCommandMenu(); }
      }
    });
  }
  function openKeyboardHelp() {
    if ($('#wcKeyboardHelp')) return;
    const wrap = el('div', { id: 'wcKeyboardHelp', class: 'modal' }, [el('div', { class: 'modal-back', on: { click: () => wrap.remove() } }), el('div', { class: 'modal-panel wc-keyboard-help' }, [
      el('h3', { text: 'Keyboard shortcuts' }),
      ...[['Ctrl/Cmd K','Search and jump'], ['Alt 1–8','Navigate sections'], ['F','Flip board'], ['B','Focus board'], ['P','Practice from current position'], ['A','Position actions'], ['1–4','Grade practice answer'], ['?','Show this help']].map(r => el('div', { class: 'wc-shortcut-row' }, [el('kbd', { text: r[0] }), el('span', { text: r[1] })])),
      el('button', { class: 'btn btn-primary', on: { click: () => wrap.remove() } }, ['Done'])
    ])]);
    document.body.appendChild(wrap);
  }

  function openPositionCommandMenu() {
    if ($('#wcPositionMenu')) return;
    const wrap = el('div', { id: 'wcPositionMenu', class: 'modal' }, [el('div', { class: 'modal-back', on: { click: () => wrap.remove() } }), el('div', { class: 'modal-panel wc-position-menu' }, [
      el('div', { class: 'eyebrow', text: 'Current position' }), el('h3', { text: 'What do you want to do here?' }),
      ...[
        ['Practice from here', () => clickByText('Practice from here')], ['Add opponent reply', () => focusPlaceholder('Opponent reply from here')], ['Add side variation', () => focusPlaceholder('Side variation moves')], ['Mark critical', () => clickByText('Mark critical') || clickByText('✓ Critical')], ['Add idea / plan / hook', openIdeaEditor], ['Split line from here', () => clickByText('Split from here')], ['Retire or restore line', () => clickByText('Retire line') || clickByText('Restore line')], ['Show transpositions', () => scrollToText('Also occurs in') || scrollToText('Transposition options')]
      ].map(([label, fn]) => el('button', { class: 'wc-menu-action', on: { click: () => { wrap.remove(); fn(); } } }, [label]))
    ])]);
    document.body.appendChild(wrap);
  }

  function openFeedback() {
    const url = 'https://github.com/armaanmittalweb/OpeningOS/issues/new';
    window.open(url, '_blank', 'noopener');
  }
  function wireFocusTraps() {
    $all('.modal:not([data-wc-focus])').forEach(m => {
      m.setAttribute('data-wc-focus', 'true');
      m.addEventListener('keydown', e => {
        if (e.key === 'Escape') { const back = m.querySelector('.modal-back'); if (back) back.click(); else m.remove(); }
      });
    });
  }
  function safeArray(fn) { try { const v = fn(); return Array.isArray(v) ? v : []; } catch (_) { return []; } }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();

  global.OOSWorldClassProduct = { version: VERSION, enhance, retrySync, showProductImportWizard, practiceRepairSet };
})(window);
