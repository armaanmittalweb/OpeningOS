/* OpeningOS — app shell
 * Router, command palette, keyboard shortcuts, toasts.
 */
(function (global) {
  'use strict';

  const VIEWS = ['today', 'repertoire', 'practice', 'games', 'insights', 'library', 'coach', 'opponent', 'settings'];
  let currentView = 'today';
  let currentOpts = {};

  function go(view, opts = {}) {
    if (!VIEWS.includes(view)) view = 'today';
    currentView = view;
    currentOpts = opts;
    history.replaceState(null, '', '#' + view);

    document.body.dataset.view = view;
    document.querySelectorAll('.primary-nav a, [data-nav]').forEach(a => {
      const active = a.dataset && a.dataset.nav === view;
      a.classList.toggle('is-active', active);
      if (a.matches('a')) {
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
    });

    const app = document.getElementById('app');
    app.classList.remove('view-fade');
    void app.offsetWidth;
    app.classList.add('view-fade');

    switch (view) {
      case 'today':      global.OOSViews.renderToday(app); break;
      case 'repertoire': global.OOSViews.renderRepertoire(app, opts); break;
      case 'practice':   global.OOSViews.renderPractice(app, opts); break;
      case 'games':      global.OOSViews.renderGames(app, opts); break;
      case 'insights':   global.OOSViews.renderInsights(app); break;
      case 'library':    global.OOSViews.renderLibrary(app); break;
      case 'coach':      global.OOSViews.renderCoach(app); break;
      case 'opponent':   global.OOSViews.renderOpponentPrep(app); break;
      case 'settings':   global.OOSViews.renderSettings(app); break;
    }
  }

  function startWeakDrill() {
    const weak = global.OOSData.weakPositions();
    const due = global.OOSData.duePositions();
    const cards = weak.length ? weak : due;
    if (!cards.length) { go('practice'); return; }
    global.OOSViews.startSessionWith(cards);
  }

  function startLineDrill(lineId, fromPly = 0) {
    const cards = global.OOSData.cardsFromLine ? global.OOSData.cardsFromLine(lineId, fromPly) : global.OOSData.positionsForLine(lineId);
    if (!cards.length) { go('practice'); return; }
    global.OOSViews.startSessionWith(cards, { mode: 'daily' });
  }

  // -- Toasts ------------------------------------------------------------
  function toast(message, kind = '') {
    const stack = document.getElementById('toastStack');
    const node = document.createElement('div');
    node.className = 'toast' + (kind ? ' ' + kind : '');
    node.textContent = message;
    stack.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity 200ms, transform 200ms';
      node.style.opacity = '0';
      node.style.transform = 'translateY(6px)';
    }, 2400);
    setTimeout(() => node.remove(), 2700);
  }

  // -- Command palette ---------------------------------------------------
  function buildCommands() {
    const DB = global.OOSData;
    const base = [
      { kind: 'page', label: 'Today',           run: () => go('today') },
      { kind: 'page', label: 'Repertoire',      run: () => go('repertoire') },
      { kind: 'page', label: 'Practice',        run: () => go('practice') },
      { kind: 'page', label: 'Games',           run: () => go('games') },
      { kind: 'page', label: 'Library',         run: () => go('library') },
      { kind: 'page', label: 'Insights',        run: () => go('insights') },
      { kind: 'page', label: 'Coach mode',      run: () => go('coach') },
      { kind: 'page', label: 'Opponent prep',   run: () => go('opponent') },
      { kind: 'page', label: 'Settings',        run: () => go('settings') },
      { kind: 'action', label: 'Start daily review',  run: () => go('practice') },
      { kind: 'action', label: 'Drill weak lines',    run: () => startWeakDrill() },
      { kind: 'action', label: 'Import PGN',          run: () => openImport() },
      { kind: 'action', label: 'Create line manually', run: () => global.OOSViews.showLineCreationWizard(() => go('repertoire')) },
      { kind: 'action', label: 'Backup / restore data', run: () => global.OOSViews.showBackupRestore ? global.OOSViews.showBackupRestore() : go('settings') },
      { kind: 'action', label: 'Import coach pack', run: () => global.OOSViews.importCoachPack ? global.OOSViews.importCoachPack() : go('coach') },
      { kind: 'action', label: 'Export coach pack', run: () => global.OOSViews.exportCoachPack ? global.OOSViews.exportCoachPack() : go('coach') },
      { kind: 'action', label: 'Trust center', run: () => global.OOSViews.showTrustCenter ? global.OOSViews.showTrustCenter() : go('settings') },
      { kind: 'action', label: 'Toggle tournament mode', run: () => toggleTournament() },
      { kind: 'action', label: 'Toggle light/dark theme', run: () => toggleTheme() },
      { kind: 'action', label: 'Reset demo data',     run: () => { global.OOSData.reset(); toast('Demo data reset', 'good'); go(currentView); } },
    ];
    DB.lines().forEach(line => {
      base.push({ kind: 'line', label: 'Open ' + line.name, run: () => go('repertoire', { lineId: line.id }) });
    });
    return base;
  }

  let cmdActiveIdx = 0;
  let cmdItems = [];

  function openCmd() {
    const palette = document.getElementById('cmdPalette');
    palette.hidden = false;
    const input = document.getElementById('cmdInput');
    input.value = '';
    cmdActiveIdx = 0;
    renderCmdList('');
    setTimeout(() => input.focus(), 30);
  }
  function closeCmd() {
    const palette = document.getElementById('cmdPalette');
    palette.hidden = true;
  }
  function renderCmdList(query) {
    const list = document.getElementById('cmdList');
    list.innerHTML = '';
    const q = query.trim().toLowerCase();
    const all = buildCommands();
    cmdItems = q
      ? all.filter(c => c.label.toLowerCase().includes(q))
      : all;
    cmdItems.slice(0, 8).forEach((c, i) => {
      const li = document.createElement('li');
      if (i === cmdActiveIdx) li.classList.add('is-active');
      const ic = document.createElement('span');
      ic.className = 'ico';
      ic.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 6l6 6-6 6"/></svg>';
      li.appendChild(ic);
      const lbl = document.createElement('span');
      lbl.textContent = c.label;
      li.appendChild(lbl);
      const kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = c.kind;
      li.appendChild(kind);
      li.addEventListener('click', () => { c.run(); closeCmd(); });
      list.appendChild(li);
    });
    if (cmdItems.length === 0) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No matches.';
      list.appendChild(li);
    }
  }

  function toggleTournament() {
    const DB = global.OOSData;
    const next = !DB.isTournament();
    DB.setTournament(next);
    document.body.dataset.tournament = next ? 'true' : 'false';
    document.getElementById('tournamentBtn').setAttribute('aria-pressed', next ? 'true' : 'false');
    toast(next ? 'Tournament mode on — new theory hidden' : 'Tournament mode off', next ? 'warn' : 'good');
    if (currentView === 'today') go('today');
  }

  function openImport() {
    global.OOSViews.showImportWizard((result) => {
      if (result && result.line) {
        toast(`Imported "${result.line.name}" — ${result.line.moves.length} moves`, 'good');
        go(currentView, currentOpts);
      } else if (result && result.games) {
        toast('Games imported', 'good');
        go(currentView, currentOpts);
      }
    });
  }

  // -- Profile menu ------------------------------------------------------
  function openProfileMenu() {
    const menu = document.getElementById('profileMenu');
    const panel = document.getElementById('profileMenuPanel');
    const Profiles = global.OOSProfiles;
    const active = Profiles.active();
    panel.innerHTML = '';

    // Header
    const head = document.createElement('div');
    head.className = 'pm-head';
    head.innerHTML = `
      <div class="avatar pm-avatar" style="background: linear-gradient(135deg, ${active.color}, color-mix(in oklab, ${active.color} 60%, #91b89f))">${active.initials}</div>
      <div>
        <div class="pm-name">${escapeHtml(active.name)}</div>
        <div class="pm-role">${active.role || 'player'}</div>
      </div>`;
    panel.appendChild(head);

    panel.appendChild(divider());

    // Profile list
    Profiles.list().forEach(p => {
      const row = document.createElement('button');
      row.className = 'pm-row' + (p.id === active.id ? ' is-active' : '');
      row.innerHTML = `
        <span class="avatar" style="background: linear-gradient(135deg, ${p.color}, color-mix(in oklab, ${p.color} 60%, #91b89f))">${p.initials}</span>
        <span class="pm-row-name">${escapeHtml(p.name)}</span>
        <span class="pm-row-role">${p.role || 'player'}</span>`;
      row.addEventListener('click', () => {
        if (p.id !== active.id) {
          Profiles.activate(p.id);
          closeProfileMenu();
          // Reboot data layer for the new profile
          global.OOSData.init();
          applyPersistedSettings();
          if (global.OOSAudio) global.OOSAudio.setEnabled(!!global.OOSData.getSetting('sound', false));
          syncProfileAvatar();
          go('today');
          toast(`Switched to ${p.name}`, 'good');
        } else closeProfileMenu();
      });
      panel.appendChild(row);
    });

    panel.appendChild(divider());

    // Actions
    const actions = [
      { label: 'Create new profile', icon: '+', run: createProfileFlow },
      { label: 'Rename current profile', icon: '✎', run: renameProfileFlow },
      { label: 'Delete current profile', icon: '✕', run: deleteProfileFlow, danger: true },
      { label: 'Sign out (clears local data)', icon: '↩', run: signOutFlow, danger: true },
    ];
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'pm-action' + (a.danger ? ' danger' : '');
      b.innerHTML = `<span class="pm-icon">${a.icon}</span><span>${a.label}</span>`;
      b.addEventListener('click', () => { a.run(); });
      panel.appendChild(b);
    });

    menu.hidden = false;
    document.getElementById('profileBtn').setAttribute('aria-expanded', 'true');
  }
  function closeProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.hidden = true;
    const btn = document.getElementById('profileBtn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu.hidden) openProfileMenu(); else closeProfileMenu();
  }

  function createProfileFlow() {
    closeProfileMenu();
    const name = prompt('Name for the new profile?');
    if (!name) return;
    global.OOSProfiles.create({ name: name.trim(), role: 'player' });
    global.OOSData.init();
    applyPersistedSettings();
    syncProfileAvatar();
    go('today');
    toast(`Created profile "${name.trim()}"`, 'good');
  }
  function renameProfileFlow() {
    closeProfileMenu();
    const cur = global.OOSProfiles.active();
    const name = prompt('Rename profile to?', cur.name);
    if (!name) return;
    global.OOSProfiles.rename(cur.id, name.trim());
    syncProfileAvatar();
    toast('Profile renamed', 'good');
  }
  function deleteProfileFlow() {
    closeProfileMenu();
    const cur = global.OOSProfiles.active();
    if (!confirm(`Delete profile "${cur.name}" and all its data? This cannot be undone.`)) return;
    global.OOSProfiles.remove(cur.id);
    if (!global.OOSProfiles.activeId()) {
      // No profiles left — re-prompt
      promptCreateFirstProfile(() => bootApp());
      return;
    }
    global.OOSData.init();
    applyPersistedSettings();
    syncProfileAvatar();
    go('today');
    toast('Profile deleted', 'good');
  }
  function signOutFlow() {
    closeProfileMenu();
    if (!confirm('Sign out and clear all profiles + data on this device?')) return;
    // Wipe everything
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('openingos.')) localStorage.removeItem(k);
    });
    location.reload();
  }
  function divider() { const d = document.createElement('div'); d.className = 'pm-divider'; return d; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]); }

  // -- Bottom sheet (mobile FAB) -----------------------------------------
  function openBottomSheet() {
    const sheet = document.getElementById('bottomSheet');
    const panel = document.getElementById('bottomSheetPanel');
    panel.innerHTML = '';
    const items = [
      { label: 'Start daily review',  desc: 'Practice cards due today',         run: () => go('practice') },
      { label: 'Create line',         desc: 'Build manually with board or SAN', run: () => global.OOSViews.showLineCreationWizard(() => go('repertoire')) },
      { label: 'Import PGN / game',   desc: 'Paste PGN, Lichess, or Chess.com', run: () => openImport() },
      { label: 'Library',             desc: 'Clone starter repertoires',        run: () => go('library') },
      { label: 'Insights',            desc: 'See weak lines and health',        run: () => go('insights') },
      { label: 'Coach mode',          desc: 'Students and assignment packs',    run: () => go('coach') },
      { label: 'Opponent prep',       desc: 'Prepare against a player',         run: () => go('opponent') },
      { label: 'Settings / backup',   desc: 'Theme, cloud sync, safety tools',  run: () => go('settings') },
      { label: 'Reliability center',  desc: 'Backup, share packs, readiness',  run: () => global.OOSLaunch ? global.OOSLaunch.showReliabilityCenter() : (global.OOSViews.showDataSafetyCenter ? global.OOSViews.showDataSafetyCenter() : go('settings')) },
    ];
    panel.innerHTML = '<div class="bs-handle"></div><h3 style="margin-bottom:4px">Quick actions</h3><p class="muted" style="font-size:12px;margin:0 0 12px">Everything important is reachable in two taps.</p>';
    items.forEach(it => {
      const b = document.createElement('button');
      b.className = 'bs-item';
      b.innerHTML = `<div class="bs-name">${it.label}</div><div class="bs-desc">${it.desc}</div>`;
      b.addEventListener('click', () => { closeBottomSheet(); it.run(); });
      panel.appendChild(b);
    });
    sheet.hidden = false;
  }
  function closeBottomSheet() {
    const sheet = document.getElementById('bottomSheet');
    if (sheet) sheet.hidden = true;
  }

  function toggleTheme() {
    const DB = global.OOSData;
    const cur = DB.getSetting('theme', 'dark');
    const next = cur === 'light' ? 'dark' : 'light';
    DB.setSetting('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    toast(`Theme: ${next}`, 'good');
  }

  function setViewportUnit() {
    document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    document.documentElement.setAttribute('data-touch', touch ? 'true' : 'false');
  }

  // -- Wiring ------------------------------------------------------------
  function wireNav() {
    setViewportUnit();
    window.addEventListener('resize', setViewportUnit, { passive: true });
    window.addEventListener('orientationchange', setViewportUnit, { passive: true });
    document.querySelectorAll('.primary-nav a, .brand[data-nav], a.icon-btn[data-nav], .mobile-tab[data-nav]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        go(a.dataset.nav);
      });
    });
    document.getElementById('cmdTrigger').addEventListener('click', openCmd);
    document.getElementById('tournamentBtn').addEventListener('click', toggleTournament);
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Profile menu
    const pBtn = document.getElementById('profileBtn');
    if (pBtn) pBtn.addEventListener('click', () => toggleProfileMenu());
    const pMenu = document.getElementById('profileMenu');
    if (pMenu) pMenu.addEventListener('click', e => {
      if (e.target.dataset.profileClose !== undefined || e.target === pMenu) closeProfileMenu();
    });

    // FAB + bottom sheet
    const fab = document.getElementById('fabBtn');
    if (fab) fab.addEventListener('click', openBottomSheet);
    const mobileMore = document.getElementById('mobileMoreBtn');
    if (mobileMore) mobileMore.addEventListener('click', openBottomSheet);
    const sheet = document.getElementById('bottomSheet');
    if (sheet) sheet.addEventListener('click', e => {
      if (e.target.dataset.sheetClose !== undefined || e.target === sheet) closeBottomSheet();
    });
    const syncFabVisibility = () => {
      const btn = document.getElementById('fabBtn');
      if (btn) btn.hidden = !window.matchMedia('(max-width: 720px)').matches;
    };
    syncFabVisibility();
    window.addEventListener('resize', syncFabVisibility, { passive: true });

    // Cmd palette input
    const input = document.getElementById('cmdInput');
    input.addEventListener('input', e => { cmdActiveIdx = 0; renderCmdList(e.target.value); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') return closeCmd();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        cmdActiveIdx = Math.min(cmdActiveIdx + 1, Math.min(cmdItems.length, 8) - 1);
        renderCmdList(input.value);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        cmdActiveIdx = Math.max(cmdActiveIdx - 1, 0);
        renderCmdList(input.value);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = cmdItems[cmdActiveIdx];
        if (item) { item.run(); closeCmd(); }
      }
    });
    document.querySelectorAll('[data-cmd-close]').forEach(n => n.addEventListener('click', closeCmd));

    // Global shortcuts
    document.addEventListener('keydown', e => {
      // Ignore shortcuts while typing in inputs/textareas.
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const palette = document.getElementById('cmdPalette');
        if (palette.hidden) openCmd(); else closeCmd();
        return;
      }
      // Practice shortcuts: 1-4 grade, H hint, N note, Space continue
      if (currentView === 'practice') {
        if (['1','2','3','4'].includes(e.key)) {
          e.preventDefault();
          global.OOSViews.applyGrade(parseInt(e.key, 10));
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          // Trigger hint via DOM click on the Hint button if present.
          const hintBtn = Array.from(document.querySelectorAll('.practice-side button')).find(b => /hint/i.test(b.textContent));
          if (hintBtn) hintBtn.click();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          toast('Note: open Repertoire to attach a note to this position', 'info');
        } else if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          // Space continues — same as Good (3) when feedback shown
          global.OOSViews.applyGrade(3);
        }
      }
    });

    // Hashchange routing
    window.addEventListener('hashchange', () => {
      const h = (location.hash || '#today').slice(1);
      go(h);
    });
  }

  // Allow weak drill / line drill to inject a session (legacy hook).
  function _setSession(session) {
    // No-op: kept for backwards compat with earlier wiring.
  }

  global.OOSApp = {
    go,
    startWeakDrill,
    startLineDrill,
    openImport,
    toast,
    applyGrade: (g) => global.OOSViews.applyGrade(g),
    _setSession,
    openProfileMenu,
    closeProfileMenu,
    syncProfileAvatar,
    bootApp,
    openBottomSheet,
    closeBottomSheet,
  };

  // -- Onboarding --------------------------------------------------------
  function maybeShowOnboarding() {
    const DB = global.OOSData;
    if (DB.isOnboarded()) return;
    if (location.search.includes('skip-onboard')) { DB.setOnboarded(); return; }
    const onb = document.getElementById('onboard');
    onb.hidden = false;
    global.OOSViews.renderOnboarding();
  }

  // -- Apply persisted settings to <html> on boot ------------------------
  function applyPersistedSettings() {
    const DB = global.OOSData;
    const s = DB.settings();
    document.documentElement.setAttribute('data-theme', s.theme || 'dark');
    document.documentElement.setAttribute('data-contrast', s.highContrast ? 'high' : 'normal');
    document.documentElement.setAttribute('data-reduced-motion', s.reducedMotion ? 'true' : 'false');
    document.documentElement.setAttribute('data-fontsize', s.fontSize || 'normal');
    document.documentElement.setAttribute('data-board-size', s.boardSize || 'medium');
    document.documentElement.setAttribute('data-pieces', s.piecesSet || 'classic');
    document.documentElement.setAttribute('data-cb-safe', s.cbSafe ? 'true' : 'false');
    document.documentElement.setAttribute('data-coords', s.coords === false ? 'false' : 'true');
  }

  // -- Init --------------------------------------------------------------
  function init() {
    if (!global.Chess) {
      console.error('chess.js failed to load');
      return;
    }

    // Initialize profile registry first; data.js reads from active profile's
    // namespaced storage when present.
    global.OOSProfiles.init();

    // First-time experience: if no profiles exist, prompt to create one
    // before doing anything else. ?skip-onboard auto-creates a demo profile.
    if (!global.OOSProfiles.activeId()) {
      if (location.search.includes('skip-onboard')) {
        global.OOSProfiles.create({ name: 'Demo', role: 'player' });
        bootApp();
        return;
      }
      promptCreateFirstProfile(() => {
        bootApp();
      });
      return;
    }
    bootApp();
  }

  function bootApp() {
    global.OOSData.init();
    applyPersistedSettings();

    // Wire audio enable
    if (global.OOSAudio) global.OOSAudio.setEnabled(!!global.OOSData.getSetting('sound', false));

    document.body.dataset.tournament = global.OOSData.isTournament() ? 'true' : 'false';
    document.getElementById('tournamentBtn').setAttribute('aria-pressed', global.OOSData.isTournament() ? 'true' : 'false');

    syncProfileAvatar();
    wireNav();

    const h = (location.hash || '#today').slice(1);
    go(VIEWS.includes(h) ? h : 'today');

    maybeShowOnboarding();
    registerServiceWorker();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return; // SW unsupported on file://
    try {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        if (!reg) return;
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              if (global.OOSObservability) global.OOSObservability.emit('service_worker_update_ready', {}, 'info');
              if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast('OpeningOS update downloaded. Refresh to use the latest build.', 'info');
            }
          });
        });
      }).catch(err => console.warn('SW failed', err));
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (global.OOSObservability) global.OOSObservability.emit('service_worker_controller_changed', {}, 'info');
      });
    } catch (_) {}
  }

  function syncProfileAvatar() {
    const p = global.OOSProfiles.active();
    const av = document.getElementById('profileAvatar');
    if (!p || !av) return;
    av.textContent = p.initials;
    av.style.background = `linear-gradient(135deg, ${p.color}, color-mix(in oklab, ${p.color} 60%, #91b89f))`;
  }

  function promptCreateFirstProfile(onDone) {
    // Build a tiny modal directly to avoid bootstrap dependency on views/data.
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal-back"></div>
      <div class="modal-panel">
        <div class="eyebrow">Welcome to OpeningOS</div>
        <h3 style="margin-top:6px">Who's training today?</h3>
        <p class="muted" style="font-size:13px;margin-top:6px">
          Create a profile to keep your repertoire, notes, and progress separate.
          Multiple people can use this device — switch profiles any time.
        </p>
        <div class="row" style="margin-top:14px;gap:8px;flex-direction:column;align-items:stretch">
          <input class="input" id="firstProfileName" placeholder="Your name" autocomplete="off" />
          <div class="choice-row" style="align-self:flex-start">
            <button data-role="player" class="is-active">Player</button>
            <button data-role="coach">Coach</button>
            <button data-role="student">Student</button>
          </div>
        </div>
        <div class="row" style="margin-top:14px;justify-content:flex-end;gap:8px">
          <button class="btn btn-primary" id="firstProfileCreate">Create profile</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    let role = 'player';
    wrap.querySelectorAll('.choice-row button').forEach(b => {
      b.addEventListener('click', () => {
        wrap.querySelectorAll('.choice-row button').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        role = b.dataset.role;
      });
    });
    const nameInput = wrap.querySelector('#firstProfileName');
    setTimeout(() => nameInput.focus(), 60);
    function submit() {
      const name = (nameInput.value || '').trim() || 'Player';
      global.OOSProfiles.create({ name, role });
      wrap.remove();
      onDone && onDone();
    }
    wrap.querySelector('#firstProfileCreate').addEventListener('click', submit);
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
