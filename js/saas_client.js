/* OpeningOS — SaaS integration client
 * Connects the static/local-first app to the OpeningOS backend for auth,
 * account recovery, passkeys, real graph sync, coach workspaces, sharing,
 * import workers, engine-analysis jobs, billing and admin operations.
 */
(function (global) {
  'use strict';
  const KEY = 'oos.saas.config.v2';
  const DEFAULT = { backendUrl: '', accessToken: '', refreshToken: '', user: null, autoSync: false, deviceId: '' };
  function read() { try { return Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { return Object.assign({}, DEFAULT); } }
  function write(patch) { const next = Object.assign(read(), patch || {}); if (!next.deviceId) next.deviceId = deviceId(); localStorage.setItem(KEY, JSON.stringify(next)); return next; }
  function deviceId() { let id = localStorage.getItem('oos.device.id'); if (!id) { id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('oos.device.id', id); } return id; }
  function config() { return write({}); }
  function configured() { return !!config().backendUrl; }
  function token() { return config().accessToken || ''; }
  function profileId() { return global.OOSProfiles && global.OOSProfiles.activeId ? global.OOSProfiles.activeId() : 'default'; }
  function activeVersion() { const st = global.OOSData && global.OOSData.state || {}; return Number(st.syncVersion || st.version || 0); }
  function snapshotPayload() { return global.OOSData && global.OOSData.exportAll ? global.OOSData.exportAll() : {}; }
  function endpoint(path) { return String(config().backendUrl || '').replace(/\/+$/, '') + path; }
  async function request(method, path, body, opts) {
    opts = opts || {}; const cfg = config(); if (!cfg.backendUrl) throw new Error('Backend URL is not configured.');
    const headers = Object.assign({ 'Content-Type': 'application/json', 'X-OpeningOS-Device': cfg.deviceId }, opts.headers || {});
    if (opts.auth !== false && cfg.accessToken) headers.Authorization = 'Bearer ' + cfg.accessToken;
    const res = await fetch(endpoint(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); let json = {}; try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { text }; }
    if (!res.ok) throw new Error(json.error || json.message || res.statusText || ('HTTP ' + res.status));
    return json;
  }
  function remember(out) { if (out && (out.accessToken || out.refreshToken || out.user)) write({ accessToken: out.accessToken || config().accessToken, refreshToken: out.refreshToken || config().refreshToken, user: out.user || config().user }); return out; }

  const api = {
    read, config, configured, token,
    configure: patch => write(Object.assign({}, patch, { backendUrl: patch && patch.backendUrl ? String(patch.backendUrl).replace(/\/+$/, '') : config().backendUrl })),
    request,
    signup: (email, password, displayName) => request('POST', '/auth/signup', { email, password, displayName }, { auth: false }).then(remember),
    login: (email, password) => request('POST', '/auth/login', { email, password }, { auth: false }).then(remember),
    refresh: () => request('POST', '/auth/refresh', { refreshToken: config().refreshToken }, { auth: false }).then(remember),
    logout: () => request('POST', '/auth/logout', {}).finally(() => write({ accessToken: '', refreshToken: '', user: null })),
    me: () => request('GET', '/me').then(out => { if (out.user) write({ user: out.user }); return out; }),
    requestPasswordReset: email => request('POST', '/auth/password-reset/request', { email }, { auth: false }),
    confirmPasswordReset: (resetToken, password) => request('POST', '/auth/password-reset/confirm', { token: resetToken, password }, { auth: false }),
    regenerateRecoveryCodes: () => request('POST', '/auth/recovery-codes/regenerate', {}),
    recoverAccount: (email, code) => request('POST', '/auth/recover-account', { email, code }, { auth: false }).then(remember),
    oauthStart: provider => request('GET', '/auth/oauth/' + encodeURIComponent(provider) + '/start', undefined, { auth: false }),
    passkeyRegisterOptions: () => request('POST', '/auth/passkeys/register/options', {}),
    passkeyRegisterVerify: payload => request('POST', '/auth/passkeys/register/verify', payload),
    passkeyLoginOptions: email => request('POST', '/auth/passkeys/login/options', { email }, { auth: false }),
    passkeyLoginVerify: payload => request('POST', '/auth/passkeys/login/verify', payload, { auth: false }).then(remember),
    pushSnapshot: () => request('POST', '/sync/snapshot', { profileId: profileId(), version: activeVersion(), payload: snapshotPayload(), clientUpdatedAt: Date.now() }),
    pullSnapshot: () => request('GET', '/sync/snapshot/' + encodeURIComponent(profileId())).then(out => { if (out && out.payload && global.OOSData && global.OOSData.importAll) global.OOSData.importAll(out.payload); return out; }),
    syncChanges: changes => request('POST', '/sync/changes', { profileId: profileId(), baseVersion: activeVersion(), clientId: config().deviceId, changes: changes || [] }),
    graphPush: () => request('PUT', '/graph/snapshot', { profileId: profileId(), version: activeVersion(), graph: global.OOSData && global.OOSData.graphNativeSnapshot ? global.OOSData.graphNativeSnapshot() : {} }),
    graphPull: () => request('GET', '/graph/snapshot/' + encodeURIComponent(profileId())).then(out => { if (out && out.graph && global.OOSData && global.OOSData.importGraphBundle) global.OOSData.importGraphBundle({ graph: out.graph }); return out; }),
    createCoachInvite: (studentEmail, role) => request('POST', '/coach/invitations', { studentEmail, role: role || 'student' }),
    acceptCoachInvite: inviteToken => request('POST', '/coach/invitations/accept', { token: inviteToken }),
    coachWorkspace: () => request('GET', '/coach/workspace'),
    createAssignment: payload => request('POST', '/coach/assignments', payload || {}),
    updateAssignmentProgress: (id, progress, status) => request('POST', '/coach/assignments/' + encodeURIComponent(id) + '/progress', { progress, status }),
    addCoachComment: payload => request('POST', '/coach/comments', payload || {}),
    revokeCoachLink: id => request('DELETE', '/coach/links/' + encodeURIComponent(id)),
    createShare: payload => request('POST', '/shares', payload || {}),
    getShare: shareToken => request('GET', '/shares/' + encodeURIComponent(shareToken), undefined, { auth: false }),
    cloneShare: shareToken => request('POST', '/shares/' + encodeURIComponent(shareToken) + '/clone', {}),
    revokeShare: id => request('DELETE', '/shares/' + encodeURIComponent(id)),
    shareAccessLogs: id => request('GET', '/shares/' + encodeURIComponent(id) + '/access'),
    createImportJob: (source, payload) => request('POST', '/imports/jobs', { source, payload: payload || {} }),
    importJob: id => request('GET', '/imports/jobs/' + encodeURIComponent(id)),
    analyzeFen: (fen, depth) => request('POST', '/analysis/quick', { fen, depth: depth || 12 }),
    createAnalysisJob: payload => request('POST', '/analysis/jobs', payload || {}),
    subscription: () => request('GET', '/billing/subscription'),
    checkout: plan => request('POST', '/billing/checkout', { plan: plan || 'pro' }),
    billingPortal: () => request('POST', '/billing/portal', {}),
    adminOverview: () => request('GET', '/admin/overview'),
    adminUsers: () => request('GET', '/admin/users'),
    adminJobs: () => request('GET', '/admin/jobs'),
    deleteAccount: () => request('DELETE', '/account'),
  };
  function h(tag, attrs, children) { const n = document.createElement(tag); attrs = attrs || {}; Object.keys(attrs).forEach(k => { if (k === 'class') n.className = attrs[k]; else if (k === 'on') Object.keys(attrs[k]).forEach(ev => n.addEventListener(ev, attrs[k][ev])); else if (k === 'style') Object.assign(n.style, attrs[k]); else if (k in n) n[k] = attrs[k]; else n.setAttribute(k, attrs[k]); }); (Array.isArray(children) ? children : [children]).forEach(c => { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return n; }
  function field(label, value, type) { const input = h('input', { class: 'input', type: type || 'text', value: value || '', placeholder: label }); return h('label', { class: 'field oos-field' }, [h('span', {}, [label]), input]); }
  function toast(message, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(message, kind || 'info'); else console.log(message); }
  function panel() {
    const main = document.querySelector('.settings-grid > div:last-child'); if (!main || document.getElementById('settings-saas')) return;
    const cfg = config(); const url = field('Backend URL', cfg.backendUrl || ''); const email = field('Email', cfg.user && cfg.user.email || '', 'email'); const pass = field('Password', '', 'password'); const display = field('Display name', cfg.user && cfg.user.displayName || ''); const invite = field('Coach invite token', ''); const username = field('Import username', '');
    const run = (promise, ok) => promise.then(r => { toast(ok || 'Done', 'good'); return r; }).catch(e => toast(e.message || String(e), 'bad'));
    main.appendChild(h('section', { class: 'settings-group', id: 'settings-saas' }, [
      h('div', { class: 'settings-group-head' }, [h('h3', {}, ['SaaS, accounts & collaboration']), h('p', { class: 'muted' }, ['Production account, sync, coach, sharing, server imports, engine jobs, billing and admin controls.'])]),
      h('div', { class: 'setting-row' }, [h('div', {}, [h('div', { class: 'label' }, ['Backend connection']), h('div', { class: 'desc' }, ['Set your deployed Fastify API URL.'])]), h('div', { class: 'stack-sm' }, [url, h('button', { class: 'btn btn-sm', on: { click: () => { api.configure({ backendUrl: url.querySelector('input').value }); toast('Backend saved', 'good'); } } }, ['Save'])])]),
      h('div', { class: 'setting-row' }, [h('div', {}, [h('div', { class: 'label' }, ['Account & recovery']), h('div', { class: 'desc' }, ['Signup/login, password reset, recovery codes and passkey endpoints.'])]), h('div', { class: 'stack-sm' }, [display, email, pass, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [h('button', { class: 'btn btn-sm', on: { click: () => run(api.signup(email.querySelector('input').value, pass.querySelector('input').value, display.querySelector('input').value), 'Signed up') } }, ['Sign up']), h('button', { class: 'btn btn-sm', on: { click: () => run(api.login(email.querySelector('input').value, pass.querySelector('input').value), 'Signed in') } }, ['Login']), h('button', { class: 'btn btn-sm', on: { click: () => run(api.requestPasswordReset(email.querySelector('input').value), 'Reset email queued') } }, ['Reset password']), h('button', { class: 'btn btn-sm', on: { click: () => api.regenerateRecoveryCodes().then(r => alert('Recovery codes:\n' + (r.codes || []).join('\n'))).catch(e => toast(e.message, 'bad')) } }, ['Recovery codes'])])])]),
      h('div', { class: 'setting-row' }, [h('div', {}, [h('div', { class: 'label' }, ['Real sync']), h('div', { class: 'desc' }, ['Push/pull local snapshot and graph-native edge store to the backend.'])]), h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [h('button', { class: 'btn btn-sm', on: { click: () => run(api.pushSnapshot(), 'Snapshot pushed') } }, ['Push snapshot']), h('button', { class: 'btn btn-sm', on: { click: () => run(api.pullSnapshot(), 'Snapshot pulled') } }, ['Pull snapshot']), h('button', { class: 'btn btn-sm', on: { click: () => run(api.graphPush(), 'Graph pushed') } }, ['Push graph']), h('button', { class: 'btn btn-sm', on: { click: () => run(api.graphPull(), 'Graph pulled') } }, ['Pull graph'])])]),
      h('div', { class: 'setting-row' }, [h('div', {}, [h('div', { class: 'label' }, ['Coach & sharing']), h('div', { class: 'desc' }, ['Invite/accept coach links and create hosted share URLs.'])]), h('div', { class: 'stack-sm' }, [invite, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [h('button', { class: 'btn btn-sm', on: { click: () => api.createCoachInvite(email.querySelector('input').value).then(r => alert(r.url || r.token)).catch(e => toast(e.message, 'bad')) } }, ['Invite student']), h('button', { class: 'btn btn-sm', on: { click: () => run(api.acceptCoachInvite(invite.querySelector('input').value), 'Invitation accepted') } }, ['Accept invite']), h('button', { class: 'btn btn-sm', on: { click: () => api.createShare({ scope: 'profile', targetId: profileId(), visibility: 'unlisted', payload: snapshotPayload(), title: 'OpeningOS share' }).then(r => alert(r.url || r.token)).catch(e => toast(e.message, 'bad')) } }, ['Create hosted share'])])])]),
      h('div', { class: 'setting-row' }, [h('div', {}, [h('div', { class: 'label' }, ['Server jobs & billing']), h('div', { class: 'desc' }, ['Backend Lichess/Chess.com imports, engine jobs, subscription hooks and admin dashboard.'])]), h('div', { class: 'stack-sm' }, [username, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [h('button', { class: 'btn btn-sm', on: { click: () => run(api.createImportJob('lichess', { username: username.querySelector('input').value }), 'Lichess import queued') } }, ['Lichess job']), h('button', { class: 'btn btn-sm', on: { click: () => run(api.createImportJob('chesscom', { username: username.querySelector('input').value }), 'Chess.com import queued') } }, ['Chess.com job']), h('button', { class: 'btn btn-sm', on: { click: () => api.checkout('pro').then(r => r.url ? location.href = r.url : alert(JSON.stringify(r, null, 2))).catch(e => toast(e.message, 'bad')) } }, ['Upgrade']), h('button', { class: 'btn btn-sm', on: { click: () => api.adminOverview().then(r => alert(JSON.stringify(r, null, 2))).catch(e => toast(e.message, 'bad')) } }, ['Admin'])])])])
    ]));
    const side = document.querySelector('.settings-side'); if (side && !side.querySelector('[href="#settings-saas"]')) side.appendChild(h('a', { href: '#settings-saas', on: { click: e => { e.preventDefault(); document.getElementById('settings-saas').scrollIntoView({ behavior: 'smooth', block: 'start' }); } } }, ['SaaS']));
  }
  function patch() { if (!global.OOSViews || !global.OOSViews.renderSettings || global.OOSViews.__saasPatched) return false; const old = global.OOSViews.renderSettings; global.OOSViews.renderSettings = function () { const out = old.apply(this, arguments); setTimeout(panel, 0); return out; }; global.OOSViews.__saasPatched = true; return true; }
  const timer = setInterval(() => { if (patch()) clearInterval(timer); }, 25);
  global.OOSSaaS = api;
})(window);
