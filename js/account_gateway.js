/* OpeningOS — account gateway
 * Product-facing auth/sync/import layer. This turns the app from an invisible
 * local-profile tool into an explicit cloud account product while preserving a
 * offline fallback for private/offline study.
 */
(function (global) {
  'use strict';

  const API_META = 'meta[name="openingos-api-url"]';
  const STATUS_ID = 'accountStatusPill';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function h(tag, attrs, children) {
    const n = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(k => {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'on') Object.keys(attrs[k]).forEach(ev => n.addEventListener(ev, attrs[k][ev]));
      else if (k === 'style') Object.assign(n.style, attrs[k]);
      else if (k in n) n[k] = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info'); else console.log(msg); }
  function defaultBackendUrl() {
    const meta = $(API_META);
    const fromMeta = meta && meta.getAttribute('content');
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8787' : '';
    const cfg = global.OOSSaaS && global.OOSSaaS.config ? global.OOSSaaS.config() : {};
    return String((cfg && cfg.backendUrl) || global.OPENINGOS_BACKEND_URL || (global.OPENINGOS_ENV && global.OPENINGOS_ENV.backendUrl) || (global.OOSDeployment && global.OOSDeployment.backendUrl) || fromMeta || local || '').replace(/\/+$/, '');
  }
  function api() { return global.OOSSaaS || null; }
  function currentUser() {
    if (global.OOSAuthBridge && global.OOSAuthBridge.authState) return global.OOSAuthBridge.authState().user || null;
    const a = api(); return a && a.config ? (a.config().user || null) : null;
  }
  function signedIn() {
    if (global.OOSAuthBridge && global.OOSAuthBridge.signedIn) return !!global.OOSAuthBridge.signedIn();
    const a = api(); return !!(a && a.signedIn && a.signedIn());
  }
  function saveBackend(url) {
    url = String(url || '').trim().replace(/\/+$/, '');
    const a = api();
    if (a && a.setConfig) a.setConfig({ backendUrl: url });
    if (global.OOSEnterpriseAPI && global.OOSEnterpriseAPI.saveCfg) global.OOSEnterpriseAPI.saveCfg({ baseUrl: url });
    try { localStorage.setItem('oos.backend.url', url); } catch (_) {}
    return url;
  }

  function ensureProfileForAccount(user, fallbackName, role) {
    const Profiles = global.OOSProfiles;
    if (!Profiles) return null;
    if (!Profiles.state) Profiles.init();
    const existing = Profiles.active && Profiles.active();
    if (existing) return existing;
    const name = (user && (user.displayName || user.name || user.email)) || fallbackName || 'Player';
    const profile = Profiles.create({ name: String(name).split('@')[0] || 'Player', role: role || 'player' });
    return profile;
  }

  async function signUp(email, password, name, backendUrl) {
    if (global.OOSAuthBridge && global.OOSAuthBridge.signUp) {
      const out = await global.OOSAuthBridge.signUp(email, password, name, backendUrl);
      ensureProfileForAccount(out.user, name, 'player');
      return out;
    }
    const a = api(); if (!a || !a.signUp) throw new Error('Cloud client is not loaded.');
    saveBackend(backendUrl);
    const out = await a.signUp({ email, password, name });
    ensureProfileForAccount(out.user, name, 'player');
    return out;
  }
  async function signIn(email, password, backendUrl) {
    if (global.OOSAuthBridge && global.OOSAuthBridge.signIn) {
      const out = await global.OOSAuthBridge.signIn(email, password, backendUrl);
      ensureProfileForAccount(out.user, email, 'player');
      return out;
    }
    const a = api(); if (!a || !a.signIn) throw new Error('Cloud client is not loaded.');
    saveBackend(backendUrl);
    const out = await a.signIn({ email, password });
    ensureProfileForAccount(out.user, email, 'player');
    return out;
  }
  async function signOut() {
    if (global.OOSAuthBridge && global.OOSAuthBridge.signOut) await global.OOSAuthBridge.signOut();
    else { const a = api(); if (a && a.signOut) await a.signOut(); }
    updateStatusPill();
  }

  function showAuthGate(opts) {
    opts = opts || {};
    if (global.OOSAuthBridge && global.OOSAuthBridge.show) {
      return global.OOSAuthBridge.show({ onDone: opts.onDone || (() => { if (global.OOSApp && global.OOSApp.go) global.OOSApp.go(document.body.dataset.view || 'today'); }) });
    }
    const wrap = h('div', { class: 'modal account-modal' });
    const back = h('div', { class: 'modal-back' });
    const panel = h('div', { class: 'modal-panel account-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'OpeningOS account' });
    let mode = opts.mode || (signedIn() ? 'status' : 'signup');
    let busy = false;

    function input(label, type, value, autocomplete) {
      return h('label', { class: 'auth-field' }, [
        h('span', { text: label }),
        h('input', { class: 'input', type: type || 'text', value: value || '', autocomplete: autocomplete || 'off' })
      ]);
    }
    function render() {
      const user = currentUser();
      const backend = defaultBackendUrl();
      panel.innerHTML = '';
      panel.appendChild(h('div', { class: 'account-hero' }, [
        h('div', { class: 'account-mark', text: '♞' }),
        h('div', {}, [
          h('div', { class: 'eyebrow', text: 'OpeningOS Cloud' }),
          h('h2', { text: mode === 'status' && user ? 'Your account is connected' : mode === 'login' ? 'Log in to OpeningOS' : 'Create your OpeningOS account' }),
          h('p', { class: 'muted', text: 'Use the same repertoire, games, coach workspaces, and sync on every device. Local profiles remain available for offline/private study.' })
        ])
      ]));

      if (mode === 'status' && user) {
        panel.appendChild(h('div', { class: 'account-status-card' }, [
          h('strong', { text: user.email || 'Signed in' }),
          h('span', { class: 'muted', text: 'Cloud sync connected' })
        ]));
        panel.appendChild(h('div', { class: 'account-actions' }, [
          h('button', { class: 'btn', on: { click: () => syncNow(panel) } }, ['Sync now']),
          h('button', { class: 'btn', on: { click: async () => { await signOut(); toast('Signed out of cloud account', 'good'); mode = 'login'; render(); } } }, ['Sign out']),
          h('button', { class: 'btn btn-primary', on: { click: () => { close(true); } } }, ['Continue'])
        ]));
        return;
      }

      const backendField = input('Connection URL', 'url', backend, 'url');
      const nameField = input('Display name', 'text', '', 'name');
      const emailField = input('Email', 'email', '', 'email');
      const passField = input('Password', 'password', '', mode === 'login' ? 'current-password' : 'new-password');
      panel.appendChild(h('div', { class: 'auth-form' }, [
        backendField,
        mode === 'signup' ? nameField : null,
        emailField,
        passField
      ]));
      const status = h('div', { class: 'auth-status muted', text: 'Your sync connection is already configured.' });
      panel.appendChild(status);
      panel.appendChild(h('div', { class: 'account-actions' }, [
        h('button', { class: 'btn', on: { click: () => { mode = mode === 'login' ? 'signup' : 'login'; render(); } } }, [mode === 'login' ? 'Create account instead' : 'I already have an account']),
        opts.allowLocal !== false ? h('button', { class: 'btn btn-ghost', on: { click: () => localProfileFallback(opts) } }, ['Continue offline']) : null,
        h('button', { class: 'btn btn-primary', on: { click: async () => {
          if (busy) return;
          const email = emailField.querySelector('input').value.trim();
          const password = passField.querySelector('input').value;
          const name = mode === 'signup' ? nameField.querySelector('input').value.trim() : '';
          const url = backendField.querySelector('input').value.trim();
          if (!url) { status.textContent = 'Connection URL is required.'; return; }
          if (!email || !password) { status.textContent = 'Email and password are required.'; return; }
          busy = true; status.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…';
          try {
            const out = mode === 'login' ? await signIn(email, password, url) : await signUp(email, password, name || email.split('@')[0], url);
            status.textContent = 'Connected as ' + ((out.user && out.user.email) || email) + '. Starting OpeningOS…';
            toast(mode === 'login' ? 'Signed in' : 'Account created', 'good');
            updateStatusPill();
            setTimeout(() => close(true), 250);
          } catch (err) {
            status.textContent = err.message || String(err);
            toast(status.textContent, 'bad');
          } finally { busy = false; }
        } } }, [mode === 'login' ? 'Log in' : 'Create cloud account'])
      ]));
      setTimeout(() => emailField.querySelector('input').focus(), 60);
    }
    function close(success) {
      wrap.remove();
      if (success && opts.onDone) opts.onDone();
    }
    function localProfileFallback(options) {
      const name = prompt('Local profile name?');
      if (!name) return;
      ensureProfileForAccount(null, name, 'player');
      toast('Local profile created. You can sign in from the account menu later.', 'info');
      close(true);
    }
    back.addEventListener('click', () => { if (signedIn() || opts.allowClose) close(!!global.OOSProfiles.activeId()); });
    wrap.appendChild(back); wrap.appendChild(panel); document.body.appendChild(wrap); render();
  }

  async function syncNow(container) {
    const a = api(); if (!a || !a.signedIn || !a.signedIn()) return toast('Sign in first', 'warn');
    try {
      if (global.OOSData && global.OOSData.exportAll && a.pushEntityChanges) { /* keep queue engine active */ }
      if (a.pushSnapshot) await a.pushSnapshot();
      if (a.graphPush) await a.graphPush();
      toast('Cloud sync complete', 'good');
    } catch (err) { toast(err.message || String(err), 'bad'); }
  }

  function extractGamesFromResult(result) {
    result = result || {};
    const games = [];
    if (Array.isArray(result.pgns)) result.pgns.forEach(pgn => { if (pgn) games.push({ pgn: String(pgn), headers: {} }); });
    if (Array.isArray(result.games)) result.games.forEach(g => { if (g && g.pgn) games.push({ pgn: g.pgn, headers: g.headers || {} }); });
    if (result.pgnBundle) splitPgnBundle(result.pgnBundle).forEach(pgn => games.push({ pgn, headers: {} }));
    if (result.pgn) splitPgnBundle(result.pgn).forEach(pgn => games.push({ pgn, headers: {} }));
    if (result.ndjson) {
      String(result.ndjson).split(/\n+/).forEach(line => { try { const j = JSON.parse(line); if (j.pgn) games.push({ pgn: j.pgn, headers: {} }); } catch (_) {} });
    }
    return games;
  }
  function splitPgnBundle(text) {
    const trimmed = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!trimmed) return [];
    return trimmed.split(/\n\n(?=\[)/).map(s => s.trim()).filter(Boolean);
  }
  async function importGames(source, username, max) {
    async function queueWithBridge() {
      const job = await global.OOSAuthBridge.request('POST', '/imports/jobs', { source, payload: { username, max: Number(max || 20), limit: Number(max || 20) } });
      let cur = job;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, i < 4 ? 650 : 1100));
        cur = await global.OOSAuthBridge.request('GET', '/imports/jobs/' + encodeURIComponent(job.id));
        const status = String(cur && cur.status || '').toLowerCase();
        if (['done','complete','completed'].includes(status)) return extractGamesFromResult(cur.result || {});
        if (status === 'failed') throw new Error(cur.error || 'Import job failed.');
      }
      throw new Error('Import job is still running. Try again in a moment from Games → Import.');
    }
    if (global.OOSAuthBridge && global.OOSAuthBridge.signedIn && global.OOSAuthBridge.signedIn()) return queueWithBridge();
    const a = api();
    if (!a || !a.signedIn || !a.signedIn() || !a.queueImportJob || !a.importJob) throw new Error('Sign in to use server imports.');
    const job = await a.queueImportJob(source, { username, max: Number(max || 20), limit: Number(max || 20) });
    let cur = job;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, i < 4 ? 650 : 1100));
      cur = await a.importJob(job.id);
      const status = String(cur && cur.status || '').toLowerCase();
      if (['done','complete','completed'].includes(status)) return extractGamesFromResult(cur.result || {});
      if (status === 'failed') throw new Error(cur.error || 'Import job failed.');
    }
    throw new Error('Import job is still running. Try again in a moment from Games → Import.');
  }

  function updateStatusPill() {
    let pill = document.getElementById(STATUS_ID);
    const right = $('.topnav-right');
    if (!right) return;
    if (!pill) {
      pill = h('button', { id: STATUS_ID, class: 'account-pill', type: 'button', on: { click: () => showAuthGate({ allowLocal: false, allowClose: true, onDone: () => global.OOSApp && global.OOSApp.go && global.OOSApp.go(document.body.dataset.view || 'today') }) } });
      right.insertBefore(pill, right.firstChild);
    }
    const user = currentUser();
    if (signedIn() && user) {
      pill.classList.add('is-online');
      pill.textContent = 'Cloud sync';
      pill.title = user.email || 'Signed in to OpeningOS Cloud';
    } else {
      pill.classList.remove('is-online');
      pill.textContent = 'Sign in';
    }
  }
  window.addEventListener('DOMContentLoaded', () => { updateStatusPill(); setInterval(updateStatusPill, 5000); });

  global.OOSAccountGateway = { showAuthGate, signUp, signIn, signOut, signedIn, currentUser, ensureProfileForAccount, importGames, saveBackend, defaultBackendUrl, updateStatusPill };
})(window);
