/* OpeningOS Cloud Sync (optional Appwrite adapter)
 * This is intentionally provider-light: the app remains fully local-first, but
 * serious users can enable authenticated cloud backup/sync through Appwrite.
 * Appwrite setup steps are documented in APPWRITE_SETUP.md.
 */
(function (global) {
  'use strict';

  const CONFIG_KEY = 'oos.appwrite.config.v1';
  const STATUS_KEY = 'oos.appwrite.status.v1';
  const VERSION = '0.7.0-enterprise-graph';
  let autoTimer = null;
  let isSyncing = false;

  function safeJson(text, fallback) {
    try { return JSON.parse(text); } catch (_) { return fallback; }
  }

  function readConfig() {
    const cfg = safeJson(localStorage.getItem(CONFIG_KEY) || '{}', {});
    return Object.assign({
      endpoint: '',
      projectId: '',
      databaseId: '',
      collectionId: '',
      documentId: 'openingos_default',
      autoBackup: false,
    }, cfg || {});
  }

  function writeConfig(next) {
    const clean = Object.assign(readConfig(), next || {});
    clean.endpoint = String(clean.endpoint || '').replace(/\/+$/, '').replace(/\/v1$/, '');
    clean.projectId = String(clean.projectId || '').trim();
    clean.databaseId = String(clean.databaseId || '').trim();
    clean.collectionId = String(clean.collectionId || '').trim();
    clean.documentId = sanitizeDocId(clean.documentId || 'openingos_default');
    localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
    return clean;
  }

  function readStatus() {
    return Object.assign({ lastPushAt: null, lastPullAt: null, accountEmail: '', message: '' }, safeJson(localStorage.getItem(STATUS_KEY) || '{}', {}));
  }

  function writeStatus(patch) {
    const next = Object.assign(readStatus(), patch || {});
    localStorage.setItem(STATUS_KEY, JSON.stringify(next));
    return next;
  }

  function sanitizeDocId(id) {
    let out = String(id || 'openingos_default').replace(/[^A-Za-z0-9._-]/g, '_');
    if (!/^[A-Za-z0-9]/.test(out)) out = 'oos_' + out;
    return out.slice(0, 36) || 'openingos_default';
  }

  function isConfigured() {
    const c = readConfig();
    return !!(c.endpoint && c.projectId && c.databaseId && c.collectionId && c.documentId);
  }

  function makePath(path) {
    const c = readConfig();
    return c.endpoint.replace(/\/+$/, '') + '/v1' + path;
  }

  async function request(method, path, body) {
    const c = readConfig();
    if (!isConfigured()) throw new Error('Cloud sync is not configured yet.');
    const options = {
      method: method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': c.projectId,
        'X-Appwrite-Response-Format': '1.9.4',
      },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(makePath(path), options);
    if (res.status === 204) return null;
    const text = await res.text();
    const json = safeJson(text, null);
    if (!res.ok) {
      const message = (json && (json.message || json.error)) || text || res.statusText || ('HTTP ' + res.status);
      throw new Error(message);
    }
    return json || {};
  }

  function uniqueId() {
    return 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
  }

  async function signUp(name, email, password) {
    await request('POST', '/account', {
      userId: uniqueId(),
      email: String(email || '').trim(),
      password: String(password || ''),
      name: String(name || '').trim() || 'OpeningOS user',
    });
    return signIn(email, password);
  }

  async function signIn(email, password) {
    const session = await request('POST', '/account/sessions/email', {
      email: String(email || '').trim(),
      password: String(password || ''),
    });
    const account = await currentAccount().catch(() => null);
    writeStatus({ accountEmail: (account && account.email) || String(email || '').trim(), message: 'Signed in' });
    return session;
  }

  async function signOut() {
    await request('DELETE', '/account/sessions/current');
    writeStatus({ accountEmail: '', message: 'Signed out' });
  }

  async function currentAccount() {
    return request('GET', '/account');
  }

  function snapshotPayload() {
    const snapshot = global.OOSData && global.OOSData.exportAll ? global.OOSData.exportAll() : (global.OOSData && global.OOSData.exportSnapshot ? global.OOSData.exportSnapshot() : {});
    snapshot.clientVersion = VERSION;
    snapshot.localSavedAt = new Date().toISOString();
    return snapshot;
  }

  function snapshotDocument() {
    const payload = snapshotPayload();
    return {
      kind: 'openingos_snapshot',
      schema: payload.schema || 'openingos-local-v2',
      clientVersion: VERSION,
      updatedAt: new Date().toISOString(),
      payload: JSON.stringify(payload),
    };
  }

  async function pushSnapshot() {
    if (isSyncing) return null;
    isSyncing = true;
    try {
      const c = readConfig();
      const data = snapshotDocument();
      const docPath = '/databases/' + encodeURIComponent(c.databaseId) + '/collections/' + encodeURIComponent(c.collectionId) + '/documents/' + encodeURIComponent(c.documentId);
      let doc;
      try {
        // Appwrite updates existing documents with PATCH.
        doc = await request('PATCH', docPath, { data: data });
      } catch (err) {
        const msg = String(err && err.message || err || '');
        if (!/not found|404|document/i.test(msg)) throw err;
        // First backup: create the document explicitly with the configured ID.
        doc = await request('POST', '/databases/' + encodeURIComponent(c.databaseId) + '/collections/' + encodeURIComponent(c.collectionId) + '/documents', {
          documentId: c.documentId,
          data: data,
        });
      }
      writeStatus({ lastPushAt: data.updatedAt, message: 'Cloud backup saved' });
      return doc;
    } finally {
      isSyncing = false;
    }
  }

  async function pullSnapshot() {
    const c = readConfig();
    const doc = await request('GET', '/databases/' + encodeURIComponent(c.databaseId) + '/collections/' + encodeURIComponent(c.collectionId) + '/documents/' + encodeURIComponent(c.documentId));
    if (!doc || !doc.payload) throw new Error('Remote snapshot document has no payload.');
    const snapshot = safeJson(doc.payload, null);
    if (!snapshot) throw new Error('Remote snapshot payload is invalid JSON.');
    if (global.OOSData && global.OOSData.importAll) global.OOSData.importAll(snapshot);
    else if (global.OOSData && global.OOSData.importSnapshot) global.OOSData.importSnapshot(snapshot);
    writeStatus({ lastPullAt: new Date().toISOString(), message: 'Cloud backup restored' });
    return snapshot;
  }

  async function testConnection() {
    const account = await currentAccount();
    writeStatus({ accountEmail: account.email || '', message: 'Connected as ' + (account.email || account.name || account.$id || 'user') });
    return account;
  }

  function scheduleAutoPush() {
    const c = readConfig();
    if (!c.autoBackup || !isConfigured()) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      pushSnapshot().catch(err => writeStatus({ message: 'Auto backup failed: ' + (err.message || err) }));
    }, 15000);
  }

  function patchPersistence() {
    const DB = global.OOSData;
    if (!DB || DB.__cloudPatched) return;
    DB.__cloudPatched = true;
    const originalPersist = DB.persist && DB.persist.bind(DB);
    if (!originalPersist) return;
    DB.persist = function () {
      const out = originalPersist();
      scheduleAutoPush();
      return out;
    };
  }

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
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  function modal(title, subtitle) {
    const wrap = h('div', { class: 'modal' });
    const back = h('div', { class: 'modal-back', on: { click: () => wrap.remove() } });
    const panel = h('div', { class: 'modal-panel product-modal' });
    panel.appendChild(h('div', { class: 'eyebrow' }, ['Cloud sync']));
    panel.appendChild(h('h3', { style: { marginTop: '6px' } }, [title]));
    if (subtitle) panel.appendChild(h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '6px' } }, [subtitle]));
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    return { wrap, panel, close: () => wrap.remove() };
  }

  function toast(message, type) {
    if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(message, type || 'good');
    else console.log(message);
  }

  function showSetupModal() {
    const c = readConfig();
    const m = modal('Configure Appwrite Cloud', 'Use the Appwrite Education plan from GitHub Student Developer Pack for authenticated cloud backup and device sync.');
    const endpoint = h('input', { class: 'input', type: 'url', placeholder: 'https://cloud.appwrite.io or https://<region>.cloud.appwrite.io', value: c.endpoint });
    const projectId = h('input', { class: 'input', type: 'text', placeholder: 'Project ID', value: c.projectId });
    const databaseId = h('input', { class: 'input', type: 'text', placeholder: 'Database ID, e.g. openingos', value: c.databaseId });
    const collectionId = h('input', { class: 'input', type: 'text', placeholder: 'Collection ID, e.g. snapshots', value: c.collectionId });
    const documentId = h('input', { class: 'input', type: 'text', placeholder: 'Remote document ID', value: c.documentId || 'openingos_default' });
    [endpoint, projectId, databaseId, collectionId, documentId].forEach(input => input.style.marginTop = '8px');
    const help = h('div', { class: 'panel', style: { padding: '12px 14px', marginTop: '12px' } }, [
      h('strong', {}, ['Required collection attributes: ']),
      'kind, schema, clientVersion, updatedAt, payload. See APPWRITE_SETUP.md in the zip.'
    ]);
    m.panel.appendChild(endpoint);
    m.panel.appendChild(projectId);
    m.panel.appendChild(databaseId);
    m.panel.appendChild(collectionId);
    m.panel.appendChild(documentId);
    m.panel.appendChild(help);
    m.panel.appendChild(h('div', { class: 'row', style: { marginTop: '14px', gap: '8px', justifyContent: 'flex-end' } }, [
      h('button', { class: 'btn', on: { click: () => m.close() } }, ['Cancel']),
      h('button', { class: 'btn btn-primary', on: { click: () => {
        writeConfig({ endpoint: endpoint.value, projectId: projectId.value, databaseId: databaseId.value, collectionId: collectionId.value, documentId: documentId.value });
        m.close();
        toast('Cloud sync configured', 'good');
        if (global.OOSApp) global.OOSApp.go('settings');
      } } }, ['Save configuration']),
    ]));
    setTimeout(() => endpoint.focus(), 30);
  }

  function showAuthModal(mode) {
    const signup = mode === 'signup';
    const m = modal(signup ? 'Create cloud account' : 'Sign in to cloud sync', signup ? 'This creates an Appwrite account inside your configured project.' : 'Sign in with your Appwrite email/password account.');
    const name = h('input', { class: 'input', type: 'text', placeholder: 'Name', value: (global.OOSProfiles && global.OOSProfiles.active && (global.OOSProfiles.active() || {}).name) || '' });
    const email = h('input', { class: 'input', type: 'email', placeholder: 'Email address', autocomplete: 'email' });
    const password = h('input', { class: 'input', type: 'password', placeholder: 'Password', autocomplete: signup ? 'new-password' : 'current-password' });
    [name, email, password].forEach(i => i.style.marginTop = '8px');
    if (signup) m.panel.appendChild(name);
    m.panel.appendChild(email);
    m.panel.appendChild(password);
    const status = h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '10px' } }, ['Password is sent directly to your configured Appwrite endpoint; OpeningOS does not store it.']);
    m.panel.appendChild(status);
    m.panel.appendChild(h('div', { class: 'row', style: { marginTop: '14px', gap: '8px', justifyContent: 'flex-end' } }, [
      h('button', { class: 'btn', on: { click: () => m.close() } }, ['Cancel']),
      h('button', { class: 'btn btn-primary', on: { click: async () => {
        try {
          if (!isConfigured()) throw new Error('Configure Appwrite first.');
          status.textContent = signup ? 'Creating account...' : 'Signing in...';
          if (signup) await signUp(name.value, email.value, password.value);
          else await signIn(email.value, password.value);
          m.close();
          toast('Cloud sync signed in', 'good');
          if (global.OOSApp) global.OOSApp.go('settings');
        } catch (err) {
          status.textContent = err.message || String(err);
          status.style.color = 'var(--bad)';
        }
      } } }, [signup ? 'Create account' : 'Sign in']),
    ]));
    setTimeout(() => (signup ? name : email).focus(), 30);
  }

  function addCloudSettings() {
    if (!global.OOSViews || !global.OOSViews.renderSettings || global.OOSViews.__cloudSettingsPatched) return;
    global.OOSViews.__cloudSettingsPatched = true;
    const original = global.OOSViews.renderSettings;
    global.OOSViews.renderSettings = function (app) {
      original(app);
      renderCloudSettingsPatch(app);
    };
  }

  function renderCloudSettingsPatch(app) {
    const layout = app.querySelector('.settings-grid');
    if (!layout || app.querySelector('#settings-cloud')) return;
    const side = layout.querySelector('.settings-side');
    const main = layout.children[1];
    if (side) {
      const link = h('a', { href: '#settings-cloud', on: { click: e => {
        e.preventDefault();
        side.querySelectorAll('a').forEach(a => a.classList.remove('is-active'));
        e.currentTarget.classList.add('is-active');
        const target = document.getElementById('settings-cloud');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } } }, ['Cloud Sync']);
      side.appendChild(link);
    }
    if (!main) return;
    const c = readConfig();
    const s = readStatus();
    const group = h('div', { class: 'setting-group', id: 'settings-cloud' });
    group.appendChild(h('h3', {}, ['Cloud Sync']));
    group.appendChild(h('div', { class: 'setting-row' }, [
      h('div', {}, [
        h('div', { class: 'label' }, ['Appwrite backup/sync']),
        h('div', { class: 'desc' }, [isConfigured() ? ('Configured: ' + c.endpoint + ' · document ' + c.documentId) : 'Not configured. Local-first still works fully offline.']),
      ]),
      h('span', { class: 'pill ' + (isConfigured() ? 'pill-good' : 'pill-warn') }, [isConfigured() ? 'Configured' : 'Setup needed']),
    ]));
    group.appendChild(h('div', { class: 'setting-row' }, [
      h('div', {}, [
        h('div', { class: 'label' }, ['Account']),
        h('div', { class: 'desc' }, [s.accountEmail ? ('Signed in as ' + s.accountEmail) : 'Sign in after configuring Appwrite.']),
      ]),
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
        h('button', { class: 'btn btn-sm', on: { click: () => showSetupModal() } }, ['Configure']),
        h('button', { class: 'btn btn-sm', on: { click: () => showAuthModal('signup') } }, ['Sign up']),
        h('button', { class: 'btn btn-sm', on: { click: () => showAuthModal('signin') } }, ['Sign in']),
        h('button', { class: 'btn btn-sm', on: { click: async () => { try { await signOut(); toast('Signed out', 'good'); global.OOSApp.go('settings'); } catch (err) { toast(err.message || 'Sign out failed', 'warn'); } } } }, ['Sign out']),
      ]),
    ]));
    group.appendChild(h('div', { class: 'setting-row' }, [
      h('div', {}, [
        h('div', { class: 'label' }, ['Manual cloud backup']),
        h('div', { class: 'desc' }, ['Push local data to cloud, or pull the remote snapshot onto this browser. Pull replaces the active profile.']),
      ]),
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
        h('button', { class: 'btn btn-sm btn-primary', on: { click: async () => { try { await pushSnapshot(); toast('Cloud backup saved', 'good'); global.OOSApp.go('settings'); } catch (err) { toast(err.message || 'Backup failed', 'warn'); } } } }, ['Push to cloud']),
        h('button', { class: 'btn btn-sm', on: { click: async () => { try { if (!confirm('Pull cloud backup and replace this active local profile?')) return; await pullSnapshot(); toast('Cloud backup restored', 'good'); global.OOSApp.go('today'); } catch (err) { toast(err.message || 'Restore failed', 'warn'); } } } }, ['Pull from cloud']),
      ]),
    ]));
    group.appendChild(h('div', { class: 'setting-row' }, [
      h('div', {}, [
        h('div', { class: 'label' }, ['Auto backup']),
        h('div', { class: 'desc' }, ['When enabled, OpeningOS pushes an encrypted-transport JSON snapshot after local changes. Sensitive prep leaves the browser only when you turn this on.']),
      ]),
      h('div', { class: 'toggle' + (c.autoBackup ? ' on' : ''), role: 'switch', tabindex: '0', 'aria-checked': c.autoBackup ? 'true' : 'false', on: { click: e => {
        const next = e.currentTarget.classList.toggle('on');
        e.currentTarget.setAttribute('aria-checked', next ? 'true' : 'false');
        writeConfig({ autoBackup: next });
        toast(next ? 'Auto backup enabled' : 'Auto backup disabled', 'good');
        scheduleAutoPush();
      } } }),
    ]));
    group.appendChild(h('div', { class: 'setting-row' }, [
      h('div', {}, [
        h('div', { class: 'label' }, ['Last cloud activity']),
        h('div', { class: 'desc' }, [
          'Push: ' + (s.lastPushAt || 'never') + ' · Pull: ' + (s.lastPullAt || 'never') + (s.message ? ' · ' + s.message : ''),
        ]),
      ]),
      h('button', { class: 'btn btn-sm', on: { click: async () => { try { const account = await testConnection(); toast('Connected as ' + (account.email || account.name || 'user'), 'good'); global.OOSApp.go('settings'); } catch (err) { toast(err.message || 'Connection test failed', 'warn'); } } } }, ['Test connection']),
    ]));
    main.appendChild(group);
  }

  global.OOSCloud = {
    readConfig,
    writeConfig,
    readStatus,
    isConfigured,
    signUp,
    signIn,
    signOut,
    currentAccount,
    pushSnapshot,
    pullSnapshot,
    testConnection,
    scheduleAutoPush,
    showSetupModal,
    showAuthModal,
  };

  patchPersistence();
  addCloudSettings();
})(window);
