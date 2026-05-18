/* OpeningOS — polished product account bridge
 * A normal product-grade cloud account flow. Deployment details are hidden
 * behind an advanced disclosure, errors are translated for users, and the same
 * auth state is written to every legacy client layer so sync/imports work.
 */
(function (global) {
  'use strict';

  const BACKEND_STATE_KEY = 'openingos.saas.v1';
  const SAAS_STATE_KEY = 'oos.saas.config.v2';
  const ENTERPRISE_CFG_KEY = 'oos.enterprise.api.v1';
  const ENTERPRISE_TOKEN_KEY = 'oos.enterprise.tokens.v1';
  const DEFAULT_BACKEND = (global.OOSDeployment && global.OOSDeployment.backendUrl) ||
    (global.OPENINGOS_ENV && global.OPENINGOS_ENV.backendUrl) ||
    global.OPENINGOS_BACKEND_URL ||
    ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:8787' : 'https://monkfish-app-yxidj.ondigitalocean.app');

  function readJson(key, fallback) {
    try { return Object.assign({}, fallback || {}, JSON.parse(localStorage.getItem(key) || '{}')); }
    catch (_) { return Object.assign({}, fallback || {}); }
  }
  function writeJson(key, patch) {
    const next = Object.assign(readJson(key), patch || {});
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  }
  function cleanUrl(url) { return String(url || DEFAULT_BACKEND || '').trim().replace(/\/+$/, ''); }
  function deviceId() {
    let id = localStorage.getItem('oos.device.id');
    if (!id) { id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('oos.device.id', id); }
    return id;
  }
  function getBackendUrl() {
    const a = readJson(BACKEND_STATE_KEY).backendUrl;
    const b = readJson(SAAS_STATE_KEY).backendUrl;
    const c = readJson(ENTERPRISE_CFG_KEY).baseUrl;
    return cleanUrl(a || b || c || DEFAULT_BACKEND);
  }
  function configureBackend(url) {
    const backendUrl = cleanUrl(url);
    writeJson(BACKEND_STATE_KEY, { backendUrl, updatedAt: Date.now() });
    writeJson(SAAS_STATE_KEY, { backendUrl, deviceId: deviceId() });
    writeJson(ENTERPRISE_CFG_KEY, { baseUrl: backendUrl, autoSync: readJson(ENTERPRISE_CFG_KEY).autoSync || false });
    if (global.OOSSaaS && global.OOSSaaS.setConfig) global.OOSSaaS.setConfig({ backendUrl });
    if (global.OOSSaaS && global.OOSSaaS.configure) global.OOSSaaS.configure({ backendUrl });
    if (global.OOSEnterpriseAPI && global.OOSEnterpriseAPI.saveCfg) global.OOSEnterpriseAPI.saveCfg({ baseUrl: backendUrl });
    return backendUrl;
  }
  function authState() {
    const a = readJson(BACKEND_STATE_KEY);
    const b = readJson(SAAS_STATE_KEY);
    const c = readJson(ENTERPRISE_TOKEN_KEY);
    const token = a.token || b.accessToken || c.accessToken || '';
    const refreshToken = a.refreshToken || b.refreshToken || c.refreshToken || '';
    const user = a.user || b.user || c.user || null;
    return { backendUrl: getBackendUrl(), token, accessToken: token, refreshToken, user };
  }
  function signedIn() { const s = authState(); return !!(s.backendUrl && s.token && s.user); }
  function saveAuth(out) {
    const backendUrl = getBackendUrl();
    const accessToken = out.accessToken || out.token || out.jwt || '';
    const refreshToken = out.refreshToken || '';
    const user = out.user || null;
    writeJson(BACKEND_STATE_KEY, { backendUrl, token: accessToken, refreshToken, user, sessionExpiresAt: out.expiresAt || 0, updatedAt: Date.now() });
    writeJson(SAAS_STATE_KEY, { backendUrl, accessToken, refreshToken, user, deviceId: deviceId() });
    writeJson(ENTERPRISE_CFG_KEY, { baseUrl: backendUrl, autoSync: true });
    writeJson(ENTERPRISE_TOKEN_KEY, { accessToken, refreshToken, user });
    return { backendUrl, accessToken, refreshToken, user };
  }
  function displayNameFromUser(user, fallback) {
    const raw = (user && (user.displayName || user.name || user.email || user.id)) || fallback || 'Player';
    return String(raw).split('@')[0].replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Player';
  }
  function ensureLocalProfileFromUser(user, nameHint) {
    if (!global.OOSProfiles) return null;
    if (!global.OOSProfiles.state) global.OOSProfiles.init();
    const email = String(user && user.email || '').toLowerCase();
    const existing = email ? global.OOSProfiles.list().find(p => String(p.accountEmail || '').toLowerCase() === email) : null;
    if (existing) { global.OOSProfiles.activate(existing.id); return existing; }
    const active = global.OOSProfiles.active && global.OOSProfiles.active();
    if (active) return active;
    return global.OOSProfiles.create({ name: displayNameFromUser(user, nameHint), role: 'player', accountEmail: email });
  }
  function firstZodIssueFromString(text) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed[0]) return parsed[0];
      if (parsed && Array.isArray(parsed.issues) && parsed.issues[0]) return parsed.issues[0];
    } catch (_) {}
    return null;
  }
  function friendlyError(errOrMessage) {
    let msg = errOrMessage && errOrMessage.message ? errOrMessage.message : String(errOrMessage || 'Something went wrong.');
    const issue = firstZodIssueFromString(msg);
    if (issue) {
      const path = Array.isArray(issue.path) ? issue.path.join('.') : '';
      if (path.includes('password') && issue.code === 'too_small') return 'Use at least 10 characters for your password.';
      if (path.includes('email')) return 'Enter a valid email address.';
      return issue.message || 'Please check the highlighted fields and try again.';
    }
    if (/password.*10|10 character/i.test(msg)) return 'Use at least 10 characters for your password.';
    if (/already exists|duplicate key|unique/i.test(msg)) return 'An account already exists for this email. Use Sign in instead.';
    if (/invalid email or password/i.test(msg)) return 'The email or password is incorrect.';
    if (/self[- ]signed certificate|certificate chain|UNABLE_TO_VERIFY/i.test(msg)) return 'OpeningOS Cloud can reach the server, but the database connection needs attention. Redeploy the latest server patch and try again.';
    if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Could not reach OpeningOS Cloud. Check your connection and try again.';
    if (/sign in required|unauthorized|401/i.test(msg)) return 'Please sign in again to continue.';
    return msg.replace(/^Error:\s*/i, '');
  }
  async function request(method, path, body, options) {
    options = options || {};
    const state = authState();
    const backendUrl = cleanUrl(options.backendUrl || state.backendUrl);
    if (!backendUrl) throw new Error('OpeningOS Cloud is not configured.');
    const headers = Object.assign({ 'Content-Type': 'application/json', 'X-OpeningOS-Device': deviceId() }, options.headers || {});
    if (options.auth !== false && state.token) headers.Authorization = 'Bearer ' + state.token;
    let res;
    try {
      res = await fetch(backendUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (err) { throw new Error(friendlyError(err)); }
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { text }; }
    if (!res.ok) throw new Error(friendlyError(json.error || json.message || json.text || res.statusText || ('HTTP ' + res.status)));
    return json;
  }
  function validateCredentials(email, password, mode) {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (!password) throw new Error('Enter your password.');
    if (mode === 'signup' && password.length < 10) throw new Error('Use at least 10 characters for your password.');
  }
  async function signUp(email, password, name, backendUrl) {
    validateCredentials(email, password, 'signup');
    configureBackend(backendUrl || getBackendUrl());
    const out = await request('POST', '/auth/signup', { email, password, name, displayName: name }, { auth: false });
    saveAuth(out);
    localStorage.removeItem('oos.auth.localOnly');
    localStorage.removeItem('oos.account.localOnly');
    ensureLocalProfileFromUser(out.user, name || email);
    return out;
  }
  async function signIn(email, password, backendUrl) {
    validateCredentials(email, password, 'signin');
    configureBackend(backendUrl || getBackendUrl());
    const out = await request('POST', '/auth/login', { email, password }, { auth: false });
    saveAuth(out);
    localStorage.removeItem('oos.auth.localOnly');
    localStorage.removeItem('oos.account.localOnly');
    ensureLocalProfileFromUser(out.user, email);
    return out;
  }
  async function signOut() {
    try { await request('POST', '/auth/logout', {}); } catch (_) {}
    writeJson(BACKEND_STATE_KEY, { token: '', refreshToken: '', user: null, sessionExpiresAt: 0, updatedAt: Date.now() });
    writeJson(SAAS_STATE_KEY, { accessToken: '', refreshToken: '', user: null });
    writeJson(ENTERPRISE_TOKEN_KEY, { accessToken: '', refreshToken: '', user: null });
  }
  async function health(backendUrl) {
    const url = cleanUrl(backendUrl || getBackendUrl());
    if (!url) throw new Error('OpeningOS Cloud is not configured.');
    let res;
    try { res = await fetch(url + '/health'); }
    catch (err) { throw new Error(friendlyError(err)); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(friendlyError(json.error || 'OpeningOS Cloud is not reachable.'));
    return json;
  }
  function toast(message, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(message, kind || 'info'); }
  function el(tag, attrs, children) {
    const n = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(k => {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs[k]).forEach(ev => n.addEventListener(ev, attrs[k][ev]));
      else if (k === 'style') Object.assign(n.style, attrs[k]);
      else if (k in n) n[k] = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (Array.isArray(children) ? children : [children]).filter(x => x !== null && x !== undefined).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }
  function field(label, type, value, autocomplete, placeholder) {
    const input = el('input', { class: 'input', type: type || 'text', value: value || '', autocomplete: autocomplete || 'off', placeholder: placeholder || '' });
    return el('label', { class: 'field product-field' }, [el('span', { text: label }), input]);
  }
  function benefit(title, copy) {
    return el('div', { class: 'product-benefit' }, [el('span', { text: '✓' }), el('div', {}, [el('strong', { text: title }), el('p', { text: copy })])]);
  }
  function showFirstRun(onDone) {
    const wrap = el('div', { class: 'modal product-auth-modal product-login-modal' });
    const back = el('div', { class: 'modal-back product-auth-backdrop' });
    const shell = el('div', { class: 'product-login-shell', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'OpeningOS account' });
    let mode = signedIn() ? 'status' : 'signup';
    let busy = false;
    function render() {
      const state = authState();
      const user = state.user;
      const backendField = field('Connection URL', 'url', state.backendUrl || DEFAULT_BACKEND, 'url');
      const name = field('Display name', 'text', displayNameFromUser(user, ''), 'name', 'Your name');
      const email = field('Email', 'email', user && user.email || '', 'email', 'you@example.com');
      const pass = field('Password', 'password', '', mode === 'signin' ? 'current-password' : 'new-password', mode === 'signin' ? 'Your password' : 'At least 10 characters');
      const localName = field('Workspace name', 'text', '', 'name', 'Player');
      const message = el('div', { class: 'product-auth-message', 'aria-live': 'polite' });
      const connection = el('details', { class: 'connection-details' }, [
        el('summary', { text: 'Connection settings' }),
        el('p', { class: 'muted', text: 'OpeningOS Cloud is preconfigured. Change this only if support asks you to.' }),
        backendField,
        el('button', { class: 'btn btn-sm', type: 'button', on: { click: async () => {
          message.className = 'product-auth-message'; message.textContent = 'Checking OpeningOS Cloud…';
          try { const r = await health(backendField.querySelector('input').value); configureBackend(backendField.querySelector('input').value); message.className = 'product-auth-message good'; message.textContent = 'Cloud connection ready.' + (r.mode ? ' Mode: ' + r.mode + '.' : ''); }
          catch (err) { message.className = 'product-auth-message bad'; message.textContent = friendlyError(err); }
        } } }, ['Test connection'])
      ]);
      shell.innerHTML = '';
      shell.append(
        el('section', { class: 'product-login-story' }, [
          el('div', { class: 'product-logo-row' }, [el('div', { class: 'product-logo', text: '♞' }), el('div', {}, [el('strong', { text: 'OpeningOS' }), el('span', { text: 'Opening preparation, built for serious chess players.' })])]),
          el('h1', { text: 'Own your openings before the game starts.' }),
          el('p', { class: 'lead', text: 'Build a repertoire, remember it with smart practice, import your games, and repair the exact lines that cost you points.' }),
          el('div', { class: 'product-benefits' }, [
            benefit('Cloud sync & recovery', 'Your repertoire, notes and review history follow you across devices.'),
            benefit('Game imports that become prep', 'Fetch Chess.com or Lichess games, detect opening problems, and turn them into review cards.'),
            benefit('Coach-ready workflow', 'Share lines, assign prep, and track progress when you are ready to use coach tools.')
          ])
        ]),
        el('section', { class: 'product-login-card' }, [])
      );
      const card = shell.querySelector('.product-login-card');
      card.append(el('div', { class: 'auth-tabs product-tabs' }, [
        el('button', { type: 'button', class: mode === 'signup' ? 'is-active' : '', on: { click: () => { mode = 'signup'; render(); } } }, ['Create account']),
        el('button', { type: 'button', class: mode === 'signin' ? 'is-active' : '', on: { click: () => { mode = 'signin'; render(); } } }, ['Sign in'])
      ]));
      if (mode === 'status' && user) {
        card.append(el('h2', { text: 'You are signed in' }), el('p', { class: 'muted', text: user.email || 'OpeningOS Cloud account connected.' }), message, el('div', { class: 'auth-actions product-actions' }, [
          el('button', { class: 'btn', type: 'button', on: { click: async () => { await signOut(); mode = 'signin'; render(); } } }, ['Sign out']),
          el('button', { class: 'btn btn-primary', type: 'button', on: { click: () => finish({ account: true, user }) } }, ['Continue'])
        ]));
      } else if (mode === 'local') {
        card.append(el('h2', { text: 'Continue offline' }), el('p', { class: 'muted', text: 'Local mode stores prep only in this browser. Use it for private testing; create an account later for sync, imports and recovery.' }), localName, message, el('div', { class: 'auth-actions product-actions' }, [
          el('button', { class: 'btn', type: 'button', on: { click: () => { mode = 'signup'; render(); } } }, ['Back']),
          el('button', { class: 'btn btn-primary', type: 'button', on: { click: () => {
            const p = global.OOSProfiles.create({ name: localName.querySelector('input').value.trim() || 'Player', role: 'player' });
            localStorage.setItem('oos.auth.localOnly', 'true'); localStorage.setItem('oos.account.localOnly', 'true');
            finish({ profile: p, localOnly: true });
          } } }, ['Start local study'])
        ]));
      } else {
        card.append(
          el('h2', { text: mode === 'signin' ? 'Welcome back' : 'Create your account' }),
          el('p', { class: 'muted', text: mode === 'signin' ? 'Sign in to sync your openings, imports and coach workspaces.' : 'Use a real account for sync, recovery, reliable game imports and sharing.' }),
          mode === 'signup' ? name : null,
          email,
          pass,
          el('p', { class: 'password-hint', text: mode === 'signup' ? 'Use at least 10 characters. You can change it later from account settings.' : 'Forgot password support is available from Settings after email is configured.' }),
          message,
          el('div', { class: 'auth-actions product-actions' }, [
            el('button', { class: 'btn btn-primary auth-submit', type: 'button', on: { click: () => submit(mode, { backendField, name, email, pass, message }) } }, [mode === 'signin' ? 'Sign in' : 'Create account']),
          ]),
          el('div', { class: 'product-secondary-actions' }, [
            el('button', { class: 'link-button', type: 'button', on: { click: () => { mode = mode === 'signin' ? 'signup' : 'signin'; render(); } } }, [mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in']),
            el('button', { class: 'link-button muted-link', type: 'button', on: { click: () => { mode = 'local'; render(); } } }, ['Continue offline'])
          ]),
          connection
        );
      }
      setTimeout(() => {
        const target = mode === 'signin' || mode === 'signup' ? email.querySelector('input') : localName.querySelector('input');
        if (target) target.focus();
      }, 60);
    }
    async function submit(which, refs) {
      if (busy) return;
      const backendUrl = refs.backendField.querySelector('input').value.trim();
      const emailVal = refs.email.querySelector('input').value.trim();
      const passVal = refs.pass.querySelector('input').value;
      const nameVal = refs.name.querySelector('input') ? refs.name.querySelector('input').value.trim() : '';
      refs.message.className = 'product-auth-message';
      refs.message.textContent = '';
      try {
        busy = true;
        refs.message.textContent = which === 'signin' ? 'Signing in securely…' : 'Creating your workspace…';
        const out = which === 'signin' ? await signIn(emailVal, passVal, backendUrl) : await signUp(emailVal, passVal, nameVal || emailVal.split('@')[0], backendUrl);
        refs.message.className = 'product-auth-message good';
        refs.message.textContent = which === 'signin' ? 'Signed in. Loading your workspace…' : 'Account created. Loading your workspace…';
        toast(which === 'signin' ? 'Signed in to OpeningOS Cloud' : 'OpeningOS account created', 'good');
        setTimeout(() => finish({ user: out.user, account: true }), 250);
      } catch (err) {
        refs.message.className = 'product-auth-message bad';
        refs.message.textContent = friendlyError(err);
      } finally { busy = false; }
    }
    function finish(out) {
      wrap.remove();
      if (global.OOSAccountGateway && global.OOSAccountGateway.updateStatusPill) global.OOSAccountGateway.updateStatusPill();
      onDone && onDone(out || {});
    }
    back.addEventListener('click', () => {});
    wrap.append(back, shell);
    document.body.appendChild(wrap);
    render();
  }
  function showAuthModal(opts) { return show(opts || {}); }
  function show(opts) {
    opts = opts || {};
    showFirstRun((out) => {
      if (global.OOSAccountGateway && global.OOSAccountGateway.updateStatusPill) global.OOSAccountGateway.updateStatusPill();
      opts.onDone && opts.onDone(out);
      if (!opts.onDone && global.OOSApp && global.OOSApp.go) global.OOSApp.go(document.body.dataset.view || 'today');
    });
  }
  function updateChrome() { if (global.OOSAccountGateway && global.OOSAccountGateway.updateStatusPill) global.OOSAccountGateway.updateStatusPill(); }

  global.OOSAuthBridge = {
    getBackendUrl, configureBackend, authState, signedIn, saveAuth, signUp, signIn, signOut,
    request, health, ensureLocalProfile: ensureLocalProfileFromUser, ensureLocalProfileFromUser,
    showFirstRun, showAuthModal, show, updateChrome, friendlyError,
  };
  global.OOSAuth = Object.assign({}, global.OOSAuth || {}, {
    showWelcome: (opts) => showFirstRun((out) => {
      if (global.OOSAccountGateway && global.OOSAccountGateway.updateStatusPill) global.OOSAccountGateway.updateStatusPill();
      if (out && out.localOnly && opts && opts.onOffline) opts.onOffline(out);
      else if (opts && opts.onDone) opts.onDone(out);
    }),
    showAuthModal, show, updateChrome, signedIn, authState, signOut,
  });
  global.OOSProductAuth = {
    shouldGate: () => {
      if (location.search.includes('skip-auth') || location.search.includes('offline') || location.search.includes('skip-onboard')) return false;
      const hasProfile = !!(global.OOSProfiles && global.OOSProfiles.activeId && global.OOSProfiles.activeId());
      if (!hasProfile) return true;
      if (localStorage.getItem('oos.auth.localOnly') === 'true' || localStorage.getItem('oos.account.localOnly') === 'true') return false;
      return !signedIn();
    },
    showGate: (onDone) => showFirstRun((out) => {
      if (global.OOSAccountGateway && global.OOSAccountGateway.updateStatusPill) global.OOSAccountGateway.updateStatusPill();
      onDone && onDone(out);
    }),
    isSignedIn: signedIn,
    authState,
  };
})(window);
