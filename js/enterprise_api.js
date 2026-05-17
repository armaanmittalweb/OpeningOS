/* OpeningOS — production backend client
 * Connects the static app to the optional SaaS backend for accounts, sync,
 * coach workspaces, server-side imports, sharing, billing, and analysis jobs.
 */
(function (global) {
  'use strict';
  const DEPLOYED_BACKEND_URL = 'https://monkfish-app-yxidj.ondigitalocean.app';
  const CFG_KEY = 'oos.enterprise.api.v1';
  const TOKEN_KEY = 'oos.enterprise.tokens.v1';
  const CLIENT_ID_KEY = 'oos.enterprise.clientId.v1';
  function defaultApi() { const meta = document.querySelector('meta[name="openingos-api-url"]'); const fromMeta = meta && meta.getAttribute('content'); const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8787' : ''; return String((window.OOSDeployment && window.OOSDeployment.backendUrl) || window.OPENINGOS_BACKEND_URL || fromMeta || local || DEPLOYED_BACKEND_URL || '').replace(/\/+$/, ''); }
  const DEFAULT_API = defaultApi();

  function json(x, fallback) { try { return JSON.parse(x); } catch (_) { return fallback; } }
  function cfg() { return Object.assign({ baseUrl: DEFAULT_API, autoSync: false, realtime: false }, json(localStorage.getItem(CFG_KEY) || '{}', {})); }
  function saveCfg(patch) { const next = Object.assign(cfg(), patch || {}); next.baseUrl = String(next.baseUrl || '').replace(/\/+$/, ''); localStorage.setItem(CFG_KEY, JSON.stringify(next)); return next; }
  function tokens() { return json(localStorage.getItem(TOKEN_KEY) || '{}', {}); }
  function saveTokens(t) { localStorage.setItem(TOKEN_KEY, JSON.stringify(Object.assign(tokens(), t || {}))); }
  function clearTokens() { localStorage.removeItem(TOKEN_KEY); }
  function clientId() { let id = localStorage.getItem(CLIENT_ID_KEY); if (!id) { id = 'client_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(CLIENT_ID_KEY, id); } return id; }
  function activeProfileId() { return (global.OOSProfiles && global.OOSProfiles.activeId && global.OOSProfiles.activeId()) || 'default'; }

  async function request(path, options) {
    const c = cfg(); if (!c.baseUrl) throw new Error('Backend URL is not configured.');
    const t = tokens();
    const opts = Object.assign({ method: 'GET', headers: {} }, options || {});
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (t.accessToken) opts.headers.Authorization = 'Bearer ' + t.accessToken;
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    const res = await fetch(c.baseUrl + path, opts);
    const text = await res.text(); const body = text ? json(text, text) : null;
    if (!res.ok) throw new Error((body && body.error) || text || res.statusText);
    return body;
  }

  async function signUp(email, password, displayName) { const r = await request('/auth/signup', { method: 'POST', body: { email, password, name: displayName || String(email || '').split('@')[0] } }); saveTokens(r); return r; }
  async function login(email, password) { const r = await request('/auth/login', { method: 'POST', body: { email, password } }); saveTokens(r); return r; }
  async function logout() { try { await request('/auth/logout', { method: 'POST' }); } finally { clearTokens(); } }
  async function me() { return request('/me'); }
  async function requestPasswordReset(email) { return request('/auth/password-reset/request', { method: 'POST', body: { email } }); }
  async function confirmPasswordReset(token, password) { return request('/auth/password-reset/confirm', { method: 'POST', body: { token, password } }); }
  async function oauthStart(provider) { const r = await request('/auth/oauth/' + encodeURIComponent(provider) + '/start?redirect=' + encodeURIComponent(location.href)); if (r.url) location.href = r.url; return r; }

  async function pushSnapshot() {
    const snapshot = global.OOSData.exportSnapshot();
    return request('/sync/snapshot', { method: 'POST', body: { profileId: activeProfileId(), version: snapshot.version || 1, payload: snapshot, clientUpdatedAt: Date.now() } });
  }
  async function pullSnapshot() {
    const row = await request('/sync/snapshot/' + encodeURIComponent(activeProfileId()));
    if (row && row.payload && global.OOSData.importSnapshot) global.OOSData.importSnapshot(row.payload);
    return row;
  }
  async function pushOps(ops) { return request('/sync/ops', { method: 'POST', body: { profileId: activeProfileId(), clientId: clientId(), baseVersion: Number(localStorage.getItem('oos.enterprise.serverVersion') || 0), ops } }); }
  async function changes(since) { return request('/sync/changes/' + encodeURIComponent(activeProfileId()) + '/' + Number(since || 0)); }
  async function pushGraph() {
    const g = global.OOSData.graphNativeSnapshot ? global.OOSData.graphNativeSnapshot() : global.OOSData.graphSnapshot();
    return request('/graph/bulk', { method: 'POST', body: { profileId: activeProfileId(), positions: Object.values(g.positions || {}), edges: Object.values(g.move_edges || {}), linePaths: Object.values(g.line_paths || {}), annotations: Object.values(g.annotations || {}) } });
  }

  async function createWorkspace(name) { return request('/coach/workspaces', { method: 'POST', body: { name } }); }
  async function listWorkspaces() { return request('/coach/workspaces'); }
  async function inviteStudent(workspaceId, studentEmail, role) { return request('/coach/invitations', { method: 'POST', body: { workspaceId, studentEmail, role: role || 'student' } }); }
  async function acceptInvitation(token) { return request('/coach/invitations/accept', { method: 'POST', body: { token } }); }
  async function coachDashboard(workspaceId) { return request('/coach/workspaces/' + encodeURIComponent(workspaceId) + '/dashboard'); }
  async function addPositionComment(workspaceId, targetKind, targetId, body) { return request('/coach/workspaces/' + encodeURIComponent(workspaceId) + '/comments', { method: 'POST', body: { targetKind, targetId, body } }); }

  async function createShare(scope, targetId, options) {
    const payload = scope === 'line' && targetId && global.OOSData.line ? { line: global.OOSData.line(targetId), graph: global.OOSData.linePathFor && global.OOSData.linePathFor(targetId) } : global.OOSData.exportSnapshot();
    return request('/shares', { method: 'POST', body: Object.assign({ scope, targetId, visibility: 'unlisted', permission: 'clone', payload }, options || {}) });
  }
  async function fetchShare(token) { return request('/shares/' + encodeURIComponent(token)); }
  async function cloneShare(token) { const r = await request('/shares/' + encodeURIComponent(token) + '/clone', { method: 'POST' }); if (r.payload && global.OOSData.importSnapshot && r.payload.schema) global.OOSData.importSnapshot(r.payload); return r; }
  async function revokeShare(id) { return request('/shares/' + encodeURIComponent(id) + '/revoke', { method: 'POST' }); }

  async function createImportJob(source, payload) { return request('/imports/jobs', { method: 'POST', body: { source, payload } }); }
  async function getImportJob(id) { return request('/imports/jobs/' + encodeURIComponent(id)); }
  async function createAnalysisJob(kind, payload) { return request('/analysis/jobs', { method: 'POST', body: { kind, payload } }); }
  async function getAnalysisJob(id) { return request('/analysis/jobs/' + encodeURIComponent(id)); }
  async function billingCheckout(plan) { const r = await request('/billing/checkout', { method: 'POST', body: { plan } }); if (r.url) location.href = r.url; return r; }
  async function billingPortal() { const r = await request('/billing/portal', { method: 'POST' }); if (r.url) location.href = r.url; return r; }
  async function adminDashboard() { return request('/admin/dashboard'); }
  async function audit() { return request('/audit'); }
  async function notifications() { return request('/notifications'); }
  async function deleteAccount() { return request('/account', { method: 'DELETE' }); }

  function applyOAuthReturnTokens() {
    const params = new URLSearchParams(location.search || '');
    const hashParams = new URLSearchParams((location.hash.split('?')[1] || ''));
    const accessToken = params.get('token') || hashParams.get('token');
    const refreshToken = params.get('refresh') || hashParams.get('refresh');
    if (accessToken || refreshToken) { saveTokens({ accessToken, refreshToken }); history.replaceState(null, '', location.pathname + location.hash.split('?')[0]); }
  }

  function patchAuditSync() {
    const DB = global.OOSData; if (!DB || DB.__enterpriseSyncPatched) return; DB.__enterpriseSyncPatched = true;
    const origAudit = DB.audit && DB.audit.bind(DB);
    DB.audit = function (action, details) {
      const out = origAudit ? origAudit(action, details) : null;
      const c = cfg();
      if (c.autoSync && tokens().accessToken) pushOps([{ opId: 'op_' + Math.random().toString(36).slice(2), entityType: 'audit', entityId: action + '_' + Date.now(), opType: action, patch: details || {}, lamport: Date.now() }]).catch(() => {});
      return out;
    };
  }

  global.OOSEnterpriseAPI = { cfg, saveCfg, tokens, clearTokens, signUp, login, logout, me, requestPasswordReset, confirmPasswordReset, oauthStart, pushSnapshot, pullSnapshot, pushOps, changes, pushGraph, createWorkspace, listWorkspaces, inviteStudent, acceptInvitation, coachDashboard, addPositionComment, createShare, fetchShare, cloneShare, revokeShare, createImportJob, getImportJob, createAnalysisJob, getAnalysisJob, billingCheckout, billingPortal, adminDashboard, audit, notifications, deleteAccount, patchAuditSync };
  applyOAuthReturnTokens();
  setTimeout(patchAuditSync, 0);
})(window);
