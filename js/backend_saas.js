/* OpeningOS SaaS integration layer
 * Provides production-facing auth, account recovery, OAuth/passkey hooks,
 * permissions, coach workspaces, sharing, billing, import jobs, admin tools,
 * notifications, and backend-connected sync APIs. The app can still run as a
 * local-first GitHub Pages app; when a backend URL is configured this layer
 * connects every major product area to the server.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'openingos.saas.v1';
  function defaultBackendUrl() { const meta = document.querySelector('meta[name="openingos-api-url"]'); const fromMeta = meta && meta.getAttribute('content'); const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8787' : ''; return String(global.OPENINGOS_BACKEND_URL || fromMeta || local || '').replace(/\/+$/, ''); }
  const DEFAULT_BACKEND = defaultBackendUrl();
  const PROVIDERS = ['google', 'github', 'lichess'];

  function now() { return Date.now(); }
  function uuid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10) + '_' + now().toString(36); }
  function toast(message, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(message, kind || 'info'); }
  function getState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; } }
  function setState(patch) { const next = Object.assign(getState(), patch || {}, { updatedAt: now() }); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next; }
  function config() {
    const s = getState();
    return {
      backendUrl: String(s.backendUrl || global.OPENINGOS_BACKEND_URL || DEFAULT_BACKEND || '').replace(/\/$/, ''),
      token: s.token || '',
      refreshToken: s.refreshToken || '',
      user: s.user || null,
      tenantId: s.tenantId || 'default',
      sessionExpiresAt: s.sessionExpiresAt || 0,
    };
  }
  function isConfigured() { return !!config().backendUrl; }
  function signedIn() { const c = config(); return !!(c.backendUrl && c.token && c.user); }

  async function request(path, options) {
    const c = config();
    if (!c.backendUrl) throw new Error('Connect OpeningOS Cloud in Settings first.');
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options && options.headers || {});
    if (c.token) headers.Authorization = 'Bearer ' + c.token;
    const res = await fetch(c.backendUrl + path, Object.assign({}, options || {}, { headers }));
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: text }; }
    if (res.status === 401 && c.refreshToken && path !== '/auth/refresh') {
      try { await refreshSession(); return request(path, options); } catch (_) {}
    }
    if (!res.ok) throw new Error((body && (body.error || body.message)) || ('Request failed: ' + res.status));
    return body;
  }

  async function refreshSession() {
    const c = config();
    if (!c.backendUrl || !c.refreshToken) throw new Error('No refresh token available.');
    const res = await fetch(c.backendUrl + '/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: c.refreshToken }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Session refresh failed.');
    setState({ token: body.token, refreshToken: body.refreshToken || c.refreshToken, sessionExpiresAt: body.expiresAt || (now() + 3600_000), user: body.user || c.user });
    return body;
  }

  async function signUp({ email, password, name }) {
    const body = await request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) });
    setState({ token: body.token, refreshToken: body.refreshToken, user: body.user, sessionExpiresAt: body.expiresAt });
    audit('auth.signup', { email });
    return body;
  }
  async function signIn({ email, password }) {
    const body = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setState({ token: body.token, refreshToken: body.refreshToken, user: body.user, sessionExpiresAt: body.expiresAt });
    audit('auth.login', { email });
    return body;
  }
  async function signOut() {
    try { await request('/auth/logout', { method: 'POST' }); } catch (_) {}
    setState({ token: '', refreshToken: '', user: null, sessionExpiresAt: 0 });
    audit('auth.logout', {});
  }
  async function requestPasswordReset(email) { return request('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }); }
  async function resetPassword(token, password) { return request('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }); }
  async function recoverAccount(email) { return request('/auth/recovery/start', { method: 'POST', body: JSON.stringify({ email }) }); }
  async function oauthUrl(provider, redirectUri) {
    if (!PROVIDERS.includes(provider)) throw new Error('Unsupported OAuth provider.');
    const body = await request('/auth/oauth/' + encodeURIComponent(provider) + '/url', { method: 'POST', body: JSON.stringify({ redirectUri }) });
    return body.url;
  }
  async function startOAuth(provider) {
    const redirectUri = location.origin + location.pathname + '#settings';
    const url = await oauthUrl(provider, redirectUri);
    location.href = url;
  }

  function b64url(buf) {
    const bytes = new Uint8Array(buf);
    let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function fromB64url(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const raw = atob(s);
    return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer;
  }
  function decodeWebAuthnOptions(opts) {
    const out = JSON.parse(JSON.stringify(opts || {}));
    if (out.challenge) out.challenge = fromB64url(out.challenge);
    if (out.user && out.user.id) out.user.id = fromB64url(out.user.id);
    if (Array.isArray(out.allowCredentials)) out.allowCredentials.forEach(c => { if (c.id) c.id = fromB64url(c.id); });
    if (Array.isArray(out.excludeCredentials)) out.excludeCredentials.forEach(c => { if (c.id) c.id = fromB64url(c.id); });
    return out;
  }
  function encodeCredential(credential) {
    if (!credential) return null;
    const response = credential.response || {};
    return {
      id: credential.id,
      rawId: b64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: response.clientDataJSON ? b64url(response.clientDataJSON) : undefined,
        attestationObject: response.attestationObject ? b64url(response.attestationObject) : undefined,
        authenticatorData: response.authenticatorData ? b64url(response.authenticatorData) : undefined,
        signature: response.signature ? b64url(response.signature) : undefined,
        userHandle: response.userHandle ? b64url(response.userHandle) : undefined,
      },
    };
  }
  async function registerPasskey(label) {
    if (!navigator.credentials || !navigator.credentials.create) throw new Error('Passkeys are not supported in this browser.');
    const opts = await request('/auth/webauthn/register/options', { method: 'POST', body: JSON.stringify({ label: label || 'OpeningOS passkey' }) });
    const credential = await navigator.credentials.create({ publicKey: decodeWebAuthnOptions(opts.publicKey) });
    return request('/auth/webauthn/register/verify', { method: 'POST', body: JSON.stringify({ credential: encodeCredential(credential), label }) });
  }
  async function loginWithPasskey(email) {
    if (!navigator.credentials || !navigator.credentials.get) throw new Error('Passkeys are not supported in this browser.');
    const opts = await request('/auth/webauthn/login/options', { method: 'POST', body: JSON.stringify({ email }) });
    const credential = await navigator.credentials.get({ publicKey: decodeWebAuthnOptions(opts.publicKey) });
    const body = await request('/auth/webauthn/login/verify', { method: 'POST', body: JSON.stringify({ credential: encodeCredential(credential), email }) });
    setState({ token: body.token, refreshToken: body.refreshToken, user: body.user, sessionExpiresAt: body.expiresAt });
    return body;
  }

  async function pushEntityChanges(changes) { return request('/sync/changes', { method: 'POST', body: JSON.stringify({ changes }) }); }
  async function pullEntityChanges(since) { return request('/sync/changes?since=' + encodeURIComponent(since || '0'), { method: 'GET' }); }
  async function openRealtime(onMessage) {
    const c = config();
    if (!c.backendUrl || !c.token) throw new Error('Sign in required.');
    const wsUrl = c.backendUrl.replace(/^http/, 'ws') + '/realtime?token=' + encodeURIComponent(c.token);
    const socket = new WebSocket(wsUrl);
    socket.onmessage = ev => { try { onMessage(JSON.parse(ev.data)); } catch (_) {} };
    return socket;
  }

  async function createCoachInvitation(studentEmail, role) { return request('/coach/invitations', { method: 'POST', body: JSON.stringify({ studentEmail, role: role || 'student' }) }); }
  async function acceptCoachInvitation(token) { return request('/coach/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) }); }
  async function coachWorkspace() { return request('/coach/workspace', { method: 'GET' }); }
  async function createAssignment(payload) { return request('/coach/assignments', { method: 'POST', body: JSON.stringify(payload || {}) }); }
  async function updateAssignmentProgress(id, progress) { return request('/coach/assignments/' + encodeURIComponent(id) + '/progress', { method: 'POST', body: JSON.stringify(progress || {}) }); }
  async function revokeCoachAccess(studentUserId) { return request('/coach/students/' + encodeURIComponent(studentUserId) + '/revoke', { method: 'POST' }); }
  async function addPositionComment(payload) { return request('/coach/comments', { method: 'POST', body: JSON.stringify(payload || {}) }); }

  async function createShareLink(scope, targetId, options) { return request('/shares', { method: 'POST', body: JSON.stringify(Object.assign({ scope, targetId }, options || {})) }); }
  async function revokeShareLink(id) { return request('/shares/' + encodeURIComponent(id) + '/revoke', { method: 'POST' }); }
  async function cloneSharedRepertoire(token) { return request('/shares/' + encodeURIComponent(token) + '/clone', { method: 'POST' }); }
  async function accessShare(token) { return request('/shares/' + encodeURIComponent(token), { method: 'GET' }); }
  async function listTeamLibraries() { return request('/teams/libraries', { method: 'GET' }); }

  async function queueImportJob(source, payload) { return request('/imports/jobs', { method: 'POST', body: JSON.stringify({ source, payload: payload || {} }) }); }
  async function importJob(id) { return request('/imports/jobs/' + encodeURIComponent(id), { method: 'GET' }); }
  async function queueAnalysisJob(payload) { return request('/analysis/jobs', { method: 'POST', body: JSON.stringify(payload || {}) }); }
  async function analysisJob(id) { return request('/analysis/jobs/' + encodeURIComponent(id), { method: 'GET' }); }

  async function createCheckout(plan) { return request('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }); }
  async function billingPortal() { return request('/billing/portal', { method: 'POST' }); }
  async function subscriptionStatus() { return request('/billing/subscription', { method: 'GET' }); }
  async function deleteAccount(reason) { return request('/account/delete', { method: 'POST', body: JSON.stringify({ reason }) }); }
  async function exportAccount() { return request('/account/export', { method: 'POST' }); }
  async function audit(action, details) {
    try {
      if (global.OOSData && global.OOSData.audit) global.OOSData.audit(action, details || {});
      if (signedIn()) request('/audit', { method: 'POST', body: JSON.stringify({ action, details: details || {} }) }).catch(() => {});
    } catch (_) {}
  }
  async function adminDashboard() { return request('/admin/dashboard', { method: 'GET' }); }

  function input(label, type, value, autocomplete) {
    const wrap = document.createElement('label'); wrap.className = 'field';
    const span = document.createElement('span'); span.textContent = label;
    const el = document.createElement('input'); el.className = 'input'; el.type = type || 'text'; el.value = value || ''; if (autocomplete) el.autocomplete = autocomplete;
    wrap.append(span, el); return { wrap, el };
  }
  function button(label, cls, run) {
    const b = document.createElement('button'); b.className = cls || 'btn btn-sm'; b.type = 'button'; b.textContent = label; b.addEventListener('click', run); return b;
  }
  function card(title, children) {
    const box = document.createElement('section'); box.className = 'card pro-card';
    const h = document.createElement('h3'); h.textContent = title; box.appendChild(h);
    (Array.isArray(children) ? children : [children]).forEach(c => c && box.appendChild(c)); return box;
  }

  function renderAuthPanel() {
    const c = config();
    const root = document.createElement('div'); root.className = 'saas-grid';
    const url = input('Connection URL', 'url', c.backendUrl, 'url');
    const email = input('Email', 'email', c.user && c.user.email || '', 'email');
    const password = input('Password', 'password', '', 'current-password');
    const name = input('Name', 'text', c.user && c.user.name || '', 'name');
    const status = document.createElement('p'); status.className = 'muted'; status.textContent = signedIn() ? 'Signed in as ' + (c.user.email || c.user.id) : 'Not signed in. You can keep working offline and sync later.';
    const actions = document.createElement('div'); actions.className = 'row wrap';
    actions.append(
      button('Save URL', 'btn btn-sm', () => { setState({ backendUrl: url.el.value.trim() }); toast('Connection URL saved', 'good'); }),
      button('Sign up', 'btn btn-sm btn-primary', async () => { try { setState({ backendUrl: url.el.value.trim() }); await signUp({ email: email.el.value.trim(), password: password.el.value, name: name.el.value.trim() }); toast('Account created', 'good'); global.OOSApp && global.OOSApp.go('settings'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Sign in', 'btn btn-sm btn-primary', async () => { try { setState({ backendUrl: url.el.value.trim() }); await signIn({ email: email.el.value.trim(), password: password.el.value }); toast('Signed in', 'good'); global.OOSApp && global.OOSApp.go('settings'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Sign out', 'btn btn-sm', async () => { await signOut(); toast('Signed out', 'good'); global.OOSApp && global.OOSApp.go('settings'); }),
      button('Password reset', 'btn btn-sm', async () => { try { await requestPasswordReset(email.el.value.trim()); toast('Reset email queued', 'good'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Register passkey', 'btn btn-sm', async () => { try { await registerPasskey('OpeningOS passkey'); toast('Passkey registered', 'good'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Login with passkey', 'btn btn-sm', async () => { try { await loginWithPasskey(email.el.value.trim()); toast('Passkey login complete', 'good'); } catch (e) { toast(e.message, 'warn'); } })
    );
    const oauth = document.createElement('div'); oauth.className = 'row wrap';
    PROVIDERS.forEach(p => oauth.appendChild(button('Connect with ' + p, 'btn btn-sm', async () => { try { setState({ backendUrl: url.el.value.trim() }); await startOAuth(p); } catch (e) { toast(e.message, 'warn'); } })));
    root.append(card('Account and session', [url.wrap, name.wrap, email.wrap, password.wrap, actions, oauth, status]));
    return root;
  }

  function renderOperationsPanel() {
    const root = document.createElement('div'); root.className = 'saas-grid';
    const student = input('Student email', 'email', '', 'email');
    const shareTarget = input('Share target line/profile ID', 'text', '', 'off');
    const importUser = input('Import username / PGN reference', 'text', '', 'off');
    const actions = document.createElement('div'); actions.className = 'row wrap';
    actions.append(
      button('Create coach invite', 'btn btn-sm', async () => { try { const r = await createCoachInvitation(student.el.value.trim(), 'student'); toast('Invite created: ' + (r.url || r.token), 'good'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Load coach workspace', 'btn btn-sm', async () => { try { const r = await coachWorkspace(); toast('Workspace: ' + ((r.students || []).length) + ' students', 'good'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Create share link', 'btn btn-sm', async () => { try { const r = await createShareLink('line', shareTarget.el.value.trim(), { visibility: 'unlisted', permission: 'read' }); toast('Share URL created', 'good'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Queue Lichess import', 'btn btn-sm', async () => { try { const r = await queueImportJob('lichess', { username: importUser.el.value.trim() }); toast('Import queued: ' + r.id, 'good'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Queue Chess.com import', 'btn btn-sm', async () => { try { const r = await queueImportJob('chesscom', { username: importUser.el.value.trim() }); toast('Import queued: ' + r.id, 'good'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Check repertoire quality', 'btn btn-sm', async () => { try { const r = await queueAnalysisJob({ kind: 'repertoire', snapshot: global.OOSData && global.OOSData.graphNativeSnapshot ? global.OOSData.graphNativeSnapshot() : null }); toast('Analysis queued: ' + r.id, 'good'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Plan settings', 'btn btn-sm', async () => { try { const r = await billingPortal(); if (r.url) location.href = r.url; else toast('Portal unavailable in this plan', 'warn'); } catch (e) { toast(e.message, 'warn'); } }),
      button('Workspace health check', 'btn btn-sm', async () => { try { const r = await adminDashboard(); toast('Admin: ' + (r.users || 0) + ' users', 'good'); } catch (e) { toast(e.message, 'warn'); } })
    );
    root.append(card('Cloud tools', [student.wrap, shareTarget.wrap, importUser.wrap, actions]));
    return root;
  }

  function appendSettingsPanel() {
    const app = document.getElementById('app');
    if (!app || app.querySelector('[data-saas-panel="true"]')) return;
    if (!(location.hash || '').includes('settings')) return;
    const panel = document.createElement('section'); panel.className = 'card'; panel.dataset.saasPanel = 'true';
    const h = document.createElement('h2'); h.textContent = 'Account, collaboration and sharing';
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Manage your OpeningOS account, password recovery, coach workspaces, game imports, sharing and multi-device sync.';
    panel.append(h, p, renderAuthPanel(), renderOperationsPanel());
    const target = app.querySelector('.settings-grid') || app.firstElementChild || app;
    target.appendChild(panel);
  }
  function installSettingsPatch() {
    const render = () => setTimeout(appendSettingsPanel, 50);
    window.addEventListener('hashchange', render);
    window.addEventListener('DOMContentLoaded', render);
    const mo = new MutationObserver(render); mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  const api = {
    config, isConfigured, signedIn, request, signUp, signIn, signOut, refreshSession,
    requestPasswordReset, resetPassword, recoverAccount, oauthUrl, startOAuth,
    registerPasskey, loginWithPasskey, pushEntityChanges, pullEntityChanges, openRealtime,
    createCoachInvitation, acceptCoachInvitation, coachWorkspace, createAssignment,
    updateAssignmentProgress, revokeCoachAccess, addPositionComment, createShareLink,
    revokeShareLink, cloneSharedRepertoire, accessShare, listTeamLibraries, queueImportJob,
    importJob, queueAnalysisJob, analysisJob, createCheckout, billingPortal, subscriptionStatus,
    exportAccount, deleteAccount, adminDashboard, audit, setConfig: setState,
    renderAuthPanel, renderOperationsPanel,
  };
  global.OOSSaaS = Object.assign({}, global.OOSSaaS || {}, api);
  installSettingsPatch();
})(window);
