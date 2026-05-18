/* OpeningOS — Cloud control center UI. Injects a cloud/accounts panel into Settings. */
(function (global) {
  'use strict';
  function el(tag, attrs, children) {
    const n = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(k => {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs[k]).forEach(ev => n.addEventListener(ev, attrs[k][ev]));
      else if (k in n) n[k] = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (Array.isArray(children) ? children : [children]).filter(x => x !== null && x !== undefined).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || ''); else alert(msg); }
  function input(label, type, value) { return el('label', { class: 'field' }, [el('span', { text: label }), el('input', { type: type || 'text', value: value || '' })]); }
  async function safe(fn, ok) { try { const out = await fn(); if (ok) toast(ok, 'good'); return out; } catch (err) { toast(err.message || String(err), 'warn'); } }
  function showModal() {
    const API = global.OOSEnterpriseAPI; if (!API) return toast('Enterprise API layer is not loaded', 'warn');
    const cfg = API.cfg(); const tok = API.tokens();
    const modal = el('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true' }, []);
    const base = input('Connection URL', 'url', cfg.baseUrl || '');
    const email = input('Email', 'email', '');
    const pass = input('Password', 'password', '');
    const name = input('Display name', 'text', (global.OOSProfiles.active() || {}).name || '');
    const resetToken = input('Reset token', 'text', '');
    const workspaceName = input('Workspace name', 'text', 'My coaching workspace');
    const inviteEmail = input('Student email', 'email', '');
    const inviteToken = input('Invitation token', 'text', '');
    const shareTarget = input('Line ID to share', 'text', (global.OOSData.lines()[0] || {}).id || '');
    const analysisFen = input('FEN for engine/explorer', 'text', global.OOSData.duePositions()[0]?.fen || new global.Chess().fen());
    const status = el('pre', { class: 'codebox', text: tok.accessToken ? 'Signed in locally with cloud token.' : 'Not signed in to cloud.' });
    function refreshStatus(x) { status.textContent = typeof x === 'string' ? x : JSON.stringify(x, null, 2); }
    const panel = el('div', { class: 'modal-card wide' }, [
      el('div', { class: 'modal-head' }, [el('div', {}, [el('h2', { text: 'OpeningOS Cloud Center' }), el('p', { class: 'muted', text: 'Account, cloud sync, coach workspaces, sharing, imports and analysis jobs.' })]), el('button', { class: 'icon-btn', 'aria-label': 'Close', on: { click: () => modal.remove() } }, ['×'])]),
      el('div', { class: 'grid two' }, [
        el('section', { class: 'card' }, [el('h3', { text: 'Cloud account' }), base, email, pass, name,
          el('div', { class: 'row wrap' }, [
            el('button', { class: 'btn btn-primary', on: { click: () => safe(() => { API.saveCfg({ baseUrl: base.querySelector('input').value }); return API.signUp(email.querySelector('input').value, pass.querySelector('input').value, name.querySelector('input').value); }, 'Account created').then(refreshStatus) } }, ['Sign up']),
            el('button', { class: 'btn', on: { click: () => safe(() => { API.saveCfg({ baseUrl: base.querySelector('input').value }); return API.login(email.querySelector('input').value, pass.querySelector('input').value); }, 'Signed in').then(refreshStatus) } }, ['Log in']),
            el('button', { class: 'btn', on: { click: () => safe(() => API.oauthStart('github')) } }, ['GitHub OAuth']),
            el('button', { class: 'btn', on: { click: () => safe(() => API.oauthStart('google')) } }, ['Google OAuth']),
            el('button', { class: 'btn', on: { click: () => safe(() => API.logout(), 'Signed out').then(refreshStatus) } }, ['Log out'])
          ]),
          resetToken,
          el('div', { class: 'row wrap' }, [el('button', { class: 'btn btn-sm', on: { click: () => safe(() => API.requestPasswordReset(email.querySelector('input').value), 'Reset email queued') } }, ['Request password reset']), el('button', { class: 'btn btn-sm', on: { click: () => safe(() => API.confirmPasswordReset(resetToken.querySelector('input').value, pass.querySelector('input').value), 'Password reset') } }, ['Confirm reset'])])
        ]),
        el('section', { class: 'card' }, [el('h3', { text: 'Cloud sync' }), el('p', { class: 'muted', text: 'Save and restore your repertoire across devices.' }), el('div', { class: 'row wrap' }, [
          el('button', { class: 'btn', on: { click: () => safe(() => API.pushSnapshot(), 'Cloud saved').then(refreshStatus) } }, ['Save to cloud']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.pullSnapshot(), 'Cloud restored').then(refreshStatus) } }, ['Restore from cloud']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.pushGraph(), 'Workspace saved').then(refreshStatus) } }, ['Save repertoire map']),
          el('button', { class: 'btn', on: { click: () => { API.saveCfg({ autoSync: !API.cfg().autoSync }); toast('Auto-sync ' + (API.cfg().autoSync ? 'enabled' : 'disabled')); } } }, ['Toggle auto-sync'])
        ])]),
        el('section', { class: 'card' }, [el('h3', { text: 'Coach collaboration' }), workspaceName, inviteEmail, inviteToken, el('div', { class: 'row wrap' }, [
          el('button', { class: 'btn', on: { click: () => safe(() => API.createWorkspace(workspaceName.querySelector('input').value), 'Workspace created').then(refreshStatus) } }, ['Create workspace']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.listWorkspaces()).then(refreshStatus) } }, ['List workspaces']),
          el('button', { class: 'btn', on: { click: async () => { const ws = await API.listWorkspaces(); const id = ws.workspaces?.[0]?.id; return safe(() => API.inviteStudent(id, inviteEmail.querySelector('input').value, 'student'), 'Invitation sent').then(refreshStatus); } } }, ['Invite student']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.acceptInvitation(inviteToken.querySelector('input').value), 'Invitation accepted').then(refreshStatus) } }, ['Accept invite'])
        ])]),
        el('section', { class: 'card' }, [el('h3', { text: 'Sharing, imports, analysis, billing' }), shareTarget, analysisFen, el('div', { class: 'row wrap' }, [
          el('button', { class: 'btn', on: { click: () => safe(() => API.createShare('line', shareTarget.querySelector('input').value, { visibility: 'unlisted', permission: 'clone' }), 'Share created').then(refreshStatus) } }, ['Create share URL']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.createImportJob('lichess', { username: prompt('Lichess username') || '', max: 25 }), 'Lichess import queued').then(refreshStatus) } }, ['Queue Lichess import']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.createImportJob('chesscom', { username: prompt('Chess.com username') || '', months: 3 }), 'Chess.com import queued').then(refreshStatus) } }, ['Queue Chess.com import']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.createAnalysisJob('engine', { fen: analysisFen.querySelector('input').value, depth: 12 }), 'Engine job queued').then(refreshStatus) } }, ['Queue engine job']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.billingCheckout('pro')).then(refreshStatus) } }, ['Upgrade Pro']),
          el('button', { class: 'btn', on: { click: () => safe(() => API.billingPortal()).then(refreshStatus) } }, ['Billing portal'])
        ])])
      ]), status
    ]);
    modal.appendChild(panel); document.body.appendChild(modal); setTimeout(() => base.querySelector('input').focus(), 30);
  }
  function injectButton() {
    if (document.getElementById('saasCenterBtn')) return;
    const app = document.getElementById('app'); if (!app || document.body.dataset.view !== 'settings') return;
    const target = app.querySelector('.settings-grid, .page, .view') || app.firstElementChild;
    if (!target) return;
    const card = el('section', { class: 'card assurance-panel' }, [el('h3', { text: 'Cloud Center' }), el('p', { class: 'muted', text: 'Connect your account, cloud sync, coach workspaces, sharing and imports.' }), el('button', { id: 'saasCenterBtn', class: 'btn btn-primary', on: { click: showModal } }, ['Open Cloud Center'])]);
    target.appendChild(card);
  }
  const obs = new MutationObserver(injectButton);
  window.addEventListener('DOMContentLoaded', () => { obs.observe(document.body, { childList: true, subtree: true }); injectButton(); });
  global.OOSCloudUI = { showModal, injectButton };
})(window);
