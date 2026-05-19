/* OpeningOS — premium product experience layer
 * This file turns the deployed app into one cohesive chess product shell:
 * a clean workspace layout, trusted cloud sync indicators, player-focused
 * dashboard cards, a premium repertoire workspace, reliable import progress,
 * and beta-ready trust/account surfaces. It intentionally avoids exposing
 * deployment plumbing to normal users.
 */
(function (global) {
  'use strict';

  const BUILD_VERSION = '2026.05.18-product-beta';
  const SYNC_KEYS = {
    local: 'oos.trust.localSavedAt',
    cloud: 'oos.trust.cloudSyncedAt',
    conflict: 'oos.trust.conflictWarning',
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function safe(v) { return String(v == null ? '' : v); }
  function escapeHtml(v) {
    return safe(v).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }
  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'dataset') Object.keys(v).forEach(d => node.dataset[d] = v[d]);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'on') Object.keys(v).forEach(ev => node.addEventListener(ev, v[ev]));
      else node.setAttribute(k, v === true ? '' : String(v));
    });
    (Array.isArray(children) ? children : [children]).filter(x => x != null && x !== false).forEach(child => node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));
    return node;
  }
  function fmtRelative(ts) {
    if (!ts) return 'not yet';
    const diff = Math.max(0, Date.now() - Number(ts));
    if (diff < 15_000) return 'just now';
    if (diff < 60_000) return Math.round(diff / 1000) + ' sec ago';
    if (diff < 3_600_000) return Math.round(diff / 60_000) + ' min ago';
    if (diff < 86_400_000) return Math.round(diff / 3_600_000) + ' hr ago';
    return Math.round(diff / 86_400_000) + ' days ago';
  }
  function signedIn() { return !!(global.OOSAuthBridge && global.OOSAuthBridge.signedIn && global.OOSAuthBridge.signedIn()); }
  function authUser() { try { return (global.OOSAuthBridge && global.OOSAuthBridge.authState && global.OOSAuthBridge.authState().user) || null; } catch (_) { return null; } }
  function profileName() { try { return (global.OOSProfiles && global.OOSProfiles.active && global.OOSProfiles.active().name) || 'Workspace'; } catch (_) { return 'Workspace'; } }
  function setLocalSaved() { try { localStorage.setItem(SYNC_KEYS.local, String(Date.now())); updateTrustPill(); } catch (_) {} }
  function setCloudSynced() { try { localStorage.setItem(SYNC_KEYS.cloud, String(Date.now())); localStorage.removeItem(SYNC_KEYS.conflict); updateTrustPill(); } catch (_) {} }
  function getLocalSaved() { return Number(localStorage.getItem(SYNC_KEYS.local) || 0); }
  function getCloudSynced() { return Number(localStorage.getItem(SYNC_KEYS.cloud) || 0); }
  function conflictMessage() { return localStorage.getItem(SYNC_KEYS.conflict) || ''; }

  function friendlyError(err) {
    if (global.OOSAuthBridge && global.OOSAuthBridge.friendlyError) return global.OOSAuthBridge.friendlyError(err);
    const raw = err && err.message ? err.message : String(err || 'Something went wrong.');
    if (/rate|429/i.test(raw)) return 'The chess site is rate limiting requests. Try again in a few minutes.';
    if (/private|404|not found/i.test(raw)) return 'That profile is unavailable or private.';
    if (/failed to fetch|network/i.test(raw)) return 'Network request failed. Check your connection and try again.';
    return raw.replace(/^Error:\s*/i, '');
  }

  function patchPersistence() {
    if (!global.OOSData || global.OOSData.__productPersistPatched) return;
    const original = global.OOSData.persist;
    if (typeof original === 'function') {
      global.OOSData.persist = function patchedPersist() {
        const out = original.apply(this, arguments);
        setLocalSaved();
        return out;
      };
      global.OOSData.__productPersistPatched = true;
    }
  }

  async function pushCloudSync() {
    if (!signedIn()) {
      if (global.OOSAuthBridge && global.OOSAuthBridge.show) global.OOSAuthBridge.show({ onDone: () => pushCloudSync().catch(() => {}) });
      return;
    }
    const pill = $('#syncTrustPill');
    if (pill) pill.dataset.state = 'busy';
    try {
      if (global.OOSSaaS && global.OOSSaaS.pushSnapshot) await global.OOSSaaS.pushSnapshot();
      if (global.OOSSaaS && global.OOSSaaS.graphPush) await global.OOSSaaS.graphPush().catch(() => {});
      if (global.OOSEnterpriseAPI && global.OOSEnterpriseAPI.pushSnapshot) await global.OOSEnterpriseAPI.pushSnapshot().catch(() => {});
      setCloudSynced();
      if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast('Cloud sync complete', 'good');
    } catch (err) {
      localStorage.setItem(SYNC_KEYS.conflict, friendlyError(err));
      if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(friendlyError(err), 'bad');
      updateTrustPill();
    } finally {
      if (pill) delete pill.dataset.state;
    }
  }

  function mountProductShell() {
    document.body.classList.add('oos-product-shell');
    if (!$('.app-sidebar')) {
      const items = [
        ['today', 'Today', 'Daily plan'],
        ['repertoire', 'Repertoire', 'Opening workspace'],
        ['practice', 'Practice', 'Review queue'],
        ['games', 'Games', 'Import and repair'],
        ['insights', 'Insights', 'Progress map'],
        ['library', 'Library', 'Starter lines'],
        ['coach', 'Coach', 'Assignments'],
        ['settings', 'Settings', 'Account and data'],
      ];
      const aside = h('aside', { class: 'app-sidebar', 'aria-label': 'OpeningOS workspace navigation' }, [
        h('div', { class: 'sidebar-section-title', text: 'Workspace' }),
        ...items.map(([view, label, desc]) => h('a', { href: '#' + view, class: 'sidebar-link', dataset: { nav: view } }, [
          h('span', { class: 'sidebar-dot', 'aria-hidden': 'true' }),
          h('span', { class: 'sidebar-text' }, [h('strong', { text: label }), h('small', { text: desc })]),
        ])),
        h('div', { class: 'sidebar-footer' }, [
          h('button', { class: 'btn btn-sm btn-primary', type: 'button', on: { click: () => global.OOSApp && global.OOSApp.openImport && global.OOSApp.openImport() } }, ['Import games']),
          h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => global.OOSViews && global.OOSViews.showLineCreationWizard && global.OOSViews.showLineCreationWizard(() => global.OOSApp.go('repertoire')) } }, ['Add line']),
        ]),
      ]);
      const main = $('#app');
      if (main && main.parentNode) main.parentNode.insertBefore(aside, main);
    }
    const cmd = $('#cmdTrigger span');
    if (cmd) cmd.textContent = 'Search openings or actions';
    mountTrustPill();
    mountFeedbackButton();
    updateActiveSidebar();
  }

  function updateActiveSidebar() {
    const view = document.body.dataset.view || (location.hash || '#today').slice(1) || 'today';
    $all('.sidebar-link').forEach(a => {
      const on = a.dataset.nav === view;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function mountTrustPill() {
    const right = $('.topnav-right');
    if (!right || $('#syncTrustPill')) return;
    const pill = h('button', { id: 'syncTrustPill', class: 'sync-trust-pill', type: 'button', title: 'Sync status', on: { click: () => pushCloudSync() } }, [
      h('span', { class: 'sync-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'sync-copy', text: 'Saved locally' }),
      h('small', { class: 'sync-meta', text: 'Sync' }),
    ]);
    right.insertBefore(pill, right.firstChild);
    updateTrustPill();
  }

  function updateTrustPill() {
    const pill = $('#syncTrustPill');
    if (!pill) return;
    const local = getLocalSaved();
    const cloud = getCloudSynced();
    const conflict = conflictMessage();
    const copy = $('.sync-copy', pill);
    const meta = $('.sync-meta', pill);
    pill.classList.toggle('is-online', signedIn());
    pill.classList.toggle('has-conflict', !!conflict);
    if (conflict) {
      copy.textContent = 'Sync needs attention';
      meta.textContent = 'Retry';
      pill.title = conflict;
    } else if (signedIn()) {
      copy.textContent = cloud ? 'Cloud synced' : 'Cloud connected';
      meta.textContent = cloud ? fmtRelative(cloud) : 'Sync now';
      pill.title = 'Saved locally ' + fmtRelative(local) + '. Cloud sync ' + fmtRelative(cloud) + '.';
    } else {
      copy.textContent = local ? 'Saved on this device' : 'Ready';
      meta.textContent = signedIn() ? 'Cloud' : 'Sign in';
      pill.title = 'Sign in to protect this repertoire across devices.';
    }
  }

  function mountFeedbackButton() {
    if ($('#feedbackButton')) return;
    const btn = h('button', { id: 'feedbackButton', class: 'feedback-button', type: 'button', on: { click: showFeedbackDialog } }, ['Feedback']);
    document.body.appendChild(btn);
  }
  function showFeedbackDialog() {
    const wrap = h('div', { class: 'modal product-feedback-modal' }, [
      h('div', { class: 'modal-back', on: { click: () => wrap.remove() } }),
      h('div', { class: 'modal-panel product-feedback-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send feedback' }, [
        h('div', { class: 'eyebrow', text: 'Beta feedback' }),
        h('h3', { text: 'Help improve OpeningOS' }),
        h('p', { class: 'muted', text: 'Tell us what felt confusing, broken, or useful. Your report is stored locally so you can copy it into GitHub issues or send it to the team.' }),
        h('textarea', { id: 'feedbackText', class: 'input', placeholder: 'What happened? What did you expect?', style: 'min-height:120px;margin-top:12px' }),
        h('div', { class: 'row', style: 'margin-top:12px;justify-content:flex-end;gap:8px;flex-wrap:wrap' }, [
          h('button', { class: 'btn', type: 'button', on: { click: () => wrap.remove() } }, ['Cancel']),
          h('button', { class: 'btn btn-primary', type: 'button', on: { click: () => {
            const text = $('#feedbackText', wrap).value.trim();
            const payload = { at: new Date().toISOString(), view: document.body.dataset.view, build: BUILD_VERSION, text };
            const list = JSON.parse(localStorage.getItem('oos.feedback.items') || '[]');
            list.push(payload); localStorage.setItem('oos.feedback.items', JSON.stringify(list.slice(-50)));
            if (navigator.clipboard && text) navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
            wrap.remove(); if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast('Feedback saved and copied.', 'good');
          } } }, ['Save feedback'])
        ])
      ])
    ]);
    document.body.appendChild(wrap);
    setTimeout(() => $('#feedbackText', wrap).focus(), 30);
  }

  function decorateToday(app) {
    if (!app || $('.today-command-center', app)) return;
    const DB = global.OOSData;
    if (!DB) return;
    const due = DB.duePositions ? DB.duePositions() : [];
    const weak = DB.weakPositions ? DB.weakPositions() : [];
    const games = DB.importedGames ? DB.importedGames() : [];
    const mistakes = DB.mistakes ? DB.mistakes(100) : [];
    const weakLine = weak[0] && (weak[0].name || (DB.line(weak[0].lineId) || {}).name);
    const recentGame = games.find(g => DB.deepReviewGame && ((DB.deepReviewGame(g).moments || []).length));
    const review = recentGame && DB.deepReviewGame(recentGame);
    const firstMoment = review && review.moments && review.moments[0];
    const repairCards = (review && review.moments || []).map(m => m.cardId && DB.position(m.cardId)).filter(Boolean);
    const center = h('section', { class: 'today-command-center' }, [
      h('div', { class: 'command-card primary' }, [
        h('span', { class: 'command-kicker', text: 'Next best action' }),
        h('h2', { text: due.length ? `${due.length} positions due today` : 'You are caught up today' }),
        h('p', { text: due.length ? `${Math.max(6, Math.round(due.length * 0.6))} minute review. Start with the positions most likely to appear in your games.` : 'Import games, add a new line, or run a warmup set.' }),
        h('button', { class: 'btn btn-primary', type: 'button', on: { click: () => global.OOSApp.go('practice') } }, [due.length ? 'Start daily review' : 'Open practice'])
      ]),
      h('div', { class: 'command-card' }, [
        h('span', { class: 'command-kicker', text: 'Weakest line' }),
        h('strong', { text: weakLine || 'No weak line yet' }),
        h('p', { text: weakLine ? 'This line has the highest lapse/low-stability signal.' : 'Practice a few sessions and OpeningOS will identify weak spots.' }),
        h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => global.OOSApp.startWeakDrill() } }, ['Drill weak lines'])
      ]),
      h('div', { class: 'command-card' }, [
        h('span', { class: 'command-kicker', text: 'Game repair' }),
        h('strong', { text: firstMoment ? firstMoment.message : (games.length ? 'No urgent repair found' : 'No games imported yet') }),
        h('p', { text: firstMoment ? `${firstMoment.repeated || 0} repeat(s). ${firstMoment.relevance ? firstMoment.relevance.message : 'Review this position now.'}` : (games.length ? 'Your latest matched games look clean.' : 'Import Chess.com or Lichess games to find real prep gaps.') }),
        h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => repairCards.length ? global.OOSViews.startSessionWith(repairCards, { mode: 'repair' }) : global.OOSApp.openImport() } }, [repairCards.length ? 'Practice repair set' : 'Import games'])
      ]),
      h('div', { class: 'command-card trust' }, [
        h('span', { class: 'command-kicker', text: 'Repertoire safety' }),
        h('strong', { text: signedIn() ? 'Cloud sync connected' : 'Saved locally' }),
        h('p', { text: signedIn() ? `Last cloud sync: ${fmtRelative(getCloudSynced())}. Saved locally: ${fmtRelative(getLocalSaved())}.` : 'Create an account to protect this repertoire across devices.' }),
        h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => signedIn() ? pushCloudSync() : global.OOSAuthBridge.show({ onDone: () => updateTrustPill() }) } }, [signedIn() ? 'Sync now' : 'Sign in'])
      ])
    ]);
    const root = $('.today', app) || app.firstElementChild || app;
    root.insertBefore(center, root.children[1] || null);
  }

  function currentLineFromRepertoire(app) {
    const DB = global.OOSData;
    if (!DB) return null;
    const title = $('.line-header h2', app);
    const name = title && title.textContent.trim();
    return (DB.lines && DB.lines({ includeRetired: true }).find(l => l.name === name)) || (DB.lines && DB.lines()[0]) || null;
  }
  function currentPlyFromRepertoire(app) {
    const current = $('.moves .san.is-current', app);
    if (!current) return 0;
    let ply = 0;
    $all('.moves .san', app).some((n, i) => { if (n === current) { ply = i + 1; return true; } return false; });
    return ply;
  }
  function decorateRepertoire(app) {
    if (!app || $('.premium-repertoire-head', app)) return;
    const DB = global.OOSData;
    const line = currentLineFromRepertoire(app);
    if (!line || !DB) return;
    const ply = currentPlyFromRepertoire(app);
    const card = DB.cardAtLinePly ? DB.cardAtLinePly(line.id, ply) : null;
    const head = h('section', { class: 'premium-repertoire-head' }, [
      h('div', {}, [
        h('span', { class: 'command-kicker', text: 'Repertoire workspace' }),
        h('h1', { text: line.name }),
        h('p', { text: 'Study the position, edit the branch, capture the idea, then practice from the exact move.' })
      ]),
      h('div', { class: 'position-action-bar' }, [
        h('button', { class: 'btn btn-primary btn-sm', type: 'button', on: { click: () => {
          const cards = DB.cardsFromLine ? DB.cardsFromLine(line.id, ply) : DB.positionsForLine(line.id);
          global.OOSViews.startSessionWith(cards, { mode: 'from-position' });
        } } }, ['Practice from here']),
        h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => showPositionMenu(line, ply, card) } }, ['Position actions']),
        h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => showIdeaEditor(line, card || (DB.positionsForLine(line.id)[0])) } }, ['Edit idea'])
      ])
    ]);
    const layout = $('.rep-layout', app);
    if (layout && layout.parentNode) layout.parentNode.insertBefore(head, layout);
    const surgery = $('.line-surgery .eyebrow', app);
    if (surgery && /Graph/i.test(surgery.textContent)) surgery.textContent = 'Position tools';
    $all('.line-surgery .muted', app).forEach(n => {
      n.textContent = n.textContent.replace(/Insert\/remove moves, create real branch lines, split continuations, mark retired, or merge known transpositions\./, 'Add replies, variations, ideas, or practice changes from this exact position.');
      n.textContent = n.textContent.replace(/Create an editable copy to change this curated line\./, 'Create your own editable copy to customize this line.');
      n.textContent = n.textContent.replace(/Merge with a transposed line:/, 'Transposition options:');
    });
  }

  function showPositionMenu(line, ply, card) {
    const DB = global.OOSData;
    const wrap = h('div', { class: 'modal position-menu-modal' });
    function close() { wrap.remove(); }
    function ask(title, placeholder, cb) {
      close();
      const w = h('div', { class: 'modal' }, [
        h('div', { class: 'modal-back', on: { click: () => w.remove() } }),
        h('div', { class: 'modal-panel compact-action-panel' }, [
          h('h3', { text: title }),
          h('input', { class: 'input', id: 'pmInput', placeholder }),
          h('div', { class: 'row', style: 'justify-content:flex-end;gap:8px;margin-top:12px' }, [
            h('button', { class: 'btn', type: 'button', on: { click: () => w.remove() } }, ['Cancel']),
            h('button', { class: 'btn btn-primary', type: 'button', on: { click: () => { const v = $('#pmInput', w).value.trim(); if (v) cb(v); w.remove(); } } }, ['Save'])
          ])
        ])
      ]);
      document.body.appendChild(w); setTimeout(() => $('#pmInput', w).focus(), 20);
    }
    const actions = [
      ['Practice from here', () => { const cards = DB.cardsFromLine(line.id, ply); close(); global.OOSViews.startSessionWith(cards, { mode: 'from-position' }); }],
      ['Add opponent reply', () => ask('Add opponent reply from this position', 'Move, e.g. ...c5 or Nc3', san => { const b = DB.addOpponentReplyFromPosition(line.id, ply, san, { name: line.name + ' — ' + san + ' reply' }); global.OOSApp.go('repertoire', { lineId: b.id, ply: ply + 1 }); })],
      ['Add side variation', () => ask('Add side variation', 'Moves after this position, e.g. c4 Nc6', moves => { const b = DB.addSideVariation(line.id, ply, moves, { name: line.name + ' variation from ply ' + ply }); global.OOSApp.go('repertoire', { lineId: b.id, ply }); })],
      [card && DB.positionFlag(card.id).critical ? 'Unmark critical' : 'Mark critical', () => { if (card) DB.markPositionCritical(card.id, !DB.positionFlag(card.id).critical, 'Marked from workspace menu'); close(); global.OOSApp.go('repertoire', { lineId: line.id, ply }); }],
      ['Add idea', () => { close(); showIdeaEditor(line, card); }],
      ['Split line from here', () => { const b = DB.splitLineFromPly(line.id, ply, { truncateOriginal: false }); close(); global.OOSApp.go('repertoire', { lineId: b.id, ply }); }],
      [line.status === 'retired' ? 'Restore line' : 'Retire branch', () => { DB.setLineRetired(line.id, line.status !== 'retired', line.status !== 'retired' ? 'Retired from workspace menu' : 'Restored from workspace menu'); close(); global.OOSApp.go('repertoire', { lineId: line.id, ply }); }],
      ['Show transpositions', () => { close(); showTranspositions(line, card); }]
    ];
    wrap.append(
      h('div', { class: 'modal-back', on: { click: close } }),
      h('div', { class: 'modal-panel position-menu-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Position actions' }, [
        h('div', { class: 'eyebrow', text: 'Position actions' }),
        h('h3', { text: line.name + (ply ? ' · ply ' + ply : '') }),
        h('div', { class: 'position-menu-grid' }, actions.map(([label, run]) => h('button', { class: 'position-action-tile', type: 'button', on: { click: run } }, [h('strong', { text: label }), h('small', { text: actionHint(label) })]))),
      ])
    );
    document.body.appendChild(wrap);
  }
  function actionHint(label) {
    if (/Practice/.test(label)) return 'Start a review queue from this exact position.';
    if (/reply/.test(label)) return 'Create a branch for what opponents actually play.';
    if (/variation/.test(label)) return 'Store a side line without damaging the main line.';
    if (/critical|Unmark/.test(label)) return 'Flag the position for priority review.';
    if (/idea/.test(label)) return 'Capture the reason, plan and memory hook.';
    if (/Split/.test(label)) return 'Turn this continuation into its own branch.';
    if (/Retire|Restore/.test(label)) return 'Manage your repertoire lifecycle.';
    return 'Find matching positions in other lines.';
  }
  function showIdeaEditor(line, card) {
    const DB = global.OOSData;
    if (!card) return global.OOSApp.toast('Select a trainable position first.', 'warn');
    const data = DB.ideaCardFor ? DB.ideaCardFor(card.id) : {};
    const wrap = h('div', { class: 'modal idea-editor-modal' });
    const fields = [
      ['idea', 'Idea', 'Why is this move played?'],
      ['plan', 'Plan', 'What plan, pawn break, or piece setup follows?'],
      ['hook', 'Memory hook', 'A short phrase that makes it stick'],
      ['mistake', 'Common mistake', 'What should you avoid here?'],
      ['sourceRef', 'Source', 'Coach note, book, game, database, etc.'],
    ];
    const inputs = {};
    const panel = h('div', { class: 'modal-panel idea-editor-panel', role: 'dialog', 'aria-modal': 'true' }, [
      h('div', { class: 'eyebrow', text: 'Idea card' }),
      h('h3', { text: line.name + ' · ' + (card.move || 'position') }),
      h('p', { class: 'muted', text: 'These notes attach to the position, so they can follow transpositions.' }),
      ...fields.map(([key, label, ph]) => {
        const ta = h('textarea', { class: 'input', placeholder: ph });
        ta.value = data[key] || '';
        inputs[key] = ta;
        return h('label', { class: 'idea-full-field' }, [h('span', { text: label }), ta]);
      }),
      h('div', { class: 'row', style: 'justify-content:flex-end;gap:8px;margin-top:12px' }, [
        h('button', { class: 'btn', type: 'button', on: { click: () => wrap.remove() } }, ['Cancel']),
        h('button', { class: 'btn btn-primary', type: 'button', on: { click: () => { const patch = {}; Object.keys(inputs).forEach(k => patch[k] = inputs[k].value.trim()); DB.setIdeaCard(card.id, patch); wrap.remove(); global.OOSApp.toast('Idea card saved.', 'good'); global.OOSApp.go('repertoire', { lineId: line.id, ply: card.ply }); } } }, ['Save idea card'])
      ])
    ]);
    wrap.append(h('div', { class: 'modal-back', on: { click: () => wrap.remove() } }), panel);
    document.body.appendChild(wrap);
  }
  function showTranspositions(line, card) {
    const DB = global.OOSData;
    const list = card && DB.transpositionsFor ? DB.transpositionsFor(card.fen, line.id) : [];
    const wrap = h('div', { class: 'modal' }, [
      h('div', { class: 'modal-back', on: { click: () => wrap.remove() } }),
      h('div', { class: 'modal-panel' }, [
        h('div', { class: 'eyebrow', text: 'Transpositions' }),
        h('h3', { text: list.length ? 'This position appears elsewhere' : 'No transpositions found yet' }),
        list.length ? h('div', { class: 'stack', style: 'margin-top:12px;gap:8px' }, list.map(t => h('button', { class: 'pm-row', type: 'button', on: { click: () => { wrap.remove(); global.OOSApp.go('repertoire', { lineId: t.lineId, ply: t.ply - 1 }); } } }, [h('span', { class: 'pm-row-name', text: t.lineName }), h('span', { class: 'pm-row-role', text: 'ply ' + t.ply })]))) : h('p', { class: 'muted', text: 'As your repertoire grows, OpeningOS will show matching positions reached by different move orders.' })
      ])
    ]);
    document.body.appendChild(wrap);
  }

  function importProgressNode() {
    const steps = ['Connecting', 'Fetching games', 'Parsing games', 'Matching games', 'Finding deviations', 'Ready'];
    const box = h('div', { class: 'import-progress-box' }, steps.map((s, i) => h('div', { class: 'import-step', dataset: { step: i } }, [h('span', { class: 'import-step-dot' }), h('span', { text: s })])));
    box.setStep = (idx, msg) => {
      $all('.import-step', box).forEach((n, i) => { n.classList.toggle('is-done', i < idx); n.classList.toggle('is-active', i === idx); });
      if (msg) box.setAttribute('aria-label', msg);
    };
    return box;
  }

  function showImportWizard(onSubmit, opts) {
    opts = opts || {};
    const DB = global.OOSData;
    const wrap = h('div', { class: 'modal product-import-modal' });
    const panel = h('div', { class: 'modal-panel product-import-panel wide' });
    let source = opts.source || 'chesscom';
    let games = [];
    function close() { wrap.remove(); }
    function renderStart() {
      panel.innerHTML = '';
      panel.append(
        h('div', { class: 'eyebrow', text: 'Game import' }),
        h('h3', { text: 'Turn your real games into opening prep' }),
        h('p', { class: 'muted', text: 'Fetch public Chess.com or Lichess games, match them to your repertoire, and create repair positions from deviations.' })
      );
      const tabs = h('div', { class: 'choice-row product-source-tabs' }, [
        ['chesscom', 'Chess.com'], ['lichess', 'Lichess'], ['pgn', 'Paste PGN']
      ].map(([id, label]) => h('button', { class: source === id ? 'is-active' : '', type: 'button', on: { click: () => { source = id; renderStart(); } } }, [label])));
      panel.appendChild(tabs);
      if (source === 'pgn') {
        const ta = h('textarea', { class: 'input import-pgn-box', placeholder: '[Event "..."]\n1. e4 c6 2. d4 d5 ...' });
        panel.appendChild(ta);
        panel.appendChild(importActions(() => {
          const text = ta.value.trim();
          if (!text) return setMessage('Paste a PGN first.', 'warn');
          runImport(async progress => parsePgnBundle(text, progress));
        }));
      } else {
        const user = h('input', { class: 'input', placeholder: source === 'chesscom' ? 'Chess.com username' : 'Lichess username', autocomplete: 'off' });
        const max = h('input', { class: 'input', type: 'number', value: '25', min: '1', max: '100' });
        panel.append(
          h('div', { class: 'import-fields' }, [h('label', {}, [h('span', { text: 'Username' }), user]), h('label', {}, [h('span', { text: 'Games' }), max])]),
          h('p', { class: 'muted import-help', text: 'Public profiles only. OpeningOS uses cloud import when signed in and browser import as a fallback.' }),
          importActions(() => {
            const username = user.value.trim();
            if (!username) return setMessage('Enter a username.', 'warn');
            runImport(progress => fetchAndParseRemote(source, username, Number(max.value || 25), progress));
          })
        );
        setTimeout(() => user.focus(), 30);
      }
    }
    function importActions(run) {
      return h('div', { class: 'row import-actions', style: 'justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap' }, [
        h('button', { class: 'btn', type: 'button', on: { click: close } }, ['Cancel']),
        h('button', { class: 'btn btn-primary', type: 'button', on: { click: run } }, ['Import games'])
      ]);
    }
    function setMessage(msg, kind) {
      let n = $('.import-message', panel);
      if (!n) { n = h('div', { class: 'import-message' }); panel.appendChild(n); }
      n.className = 'import-message ' + (kind || ''); n.textContent = msg;
    }
    async function runImport(loader) {
      panel.innerHTML = '';
      panel.append(h('div', { class: 'eyebrow', text: 'Import progress' }), h('h3', { text: 'Fetching and reviewing games' }));
      const progress = importProgressNode(); panel.appendChild(progress);
      try {
        games = await loader(progress);
        progress.setStep(3, 'Matching games');
        const saved = addImportedGames(games);
        progress.setStep(4, 'Finding deviations');
        const stats = summarizeImportedGames(saved);
        progress.setStep(5, 'Ready');
        renderResult(saved, stats);
      } catch (err) {
        renderImportError(friendlyError(err));
      }
    }
    async function fetchAndParseRemote(kind, username, max, progress) {
      progress.setStep(0, 'Connecting');
      await new Promise(r => setTimeout(r, 120));
      progress.setStep(1, 'Fetching games');
      let raw;
      if (global.OOSAccountGateway && global.OOSAccountGateway.signedIn && global.OOSAccountGateway.signedIn() && global.OOSAccountGateway.importGames) raw = await global.OOSAccountGateway.importGames(kind, username, max);
      else raw = kind === 'lichess' ? await global.OOSApi.lichessUserGames(username, max) : await global.OOSApi.chesscomUserGames(username, max);
      progress.setStep(2, 'Parsing games');
      return normalizeRemoteGames(raw, username, kind);
    }
    async function parsePgnBundle(text, progress) {
      progress.setStep(2, 'Parsing PGN');
      const parsed = global.OOSPgn.parse(text);
      return parsed.map(p => ({ parsed: p, pgn: p.raw || text, source: 'pgn' }));
    }
    function normalizeRemoteGames(raw, username, kind) {
      const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.games) ? raw.games : []);
      const out = [];
      arr.forEach(g => {
        const pgn = g && g.pgn ? String(g.pgn) : '';
        if (!pgn) return;
        try { global.OOSPgn.parse(pgn).forEach(parsed => out.push({ parsed, pgn, source: kind, username })); }
        catch (_) {}
      });
      if (!out.length) throw new Error('No parseable games were returned. The profile may be private, empty, or temporarily unavailable.');
      return out;
    }
    function hashPgn(pgn) {
      let hsh = 0; for (let i = 0; i < pgn.length; i++) hsh = ((hsh << 5) - hsh + pgn.charCodeAt(i)) | 0;
      return Math.abs(hsh).toString(36);
    }
    function addImportedGames(items) {
      const saved = [];
      items.forEach(item => {
        const hds = global.OOSPgn.openingFromHeaders(item.parsed.headers || {});
        const username = String(item.username || '').toLowerCase();
        const white = String(hds.white || '').toLowerCase();
        const black = String(hds.black || '').toLowerCase();
        const color = username && black === username ? 'b' : 'w';
        const vs = color === 'w' ? hds.black : hds.white;
        const result = hds.result === '1-0' ? (color === 'w' ? 'w' : 'l') : hds.result === '0-1' ? (color === 'b' ? 'w' : 'l') : 'd';
        const game = DB.addUserGame({
          id: 'imp_' + hashPgn(item.pgn), source: item.source, site: item.source === 'lichess' ? 'Lichess' : item.source === 'chesscom' ? 'Chess.com' : 'PGN',
          pgn: item.pgn, vs: vs || 'Opponent', yourColor: color, result,
          played: hds.date || 'imported', timeControl: (item.parsed.headers && item.parsed.headers.TimeControl) || '?', opening: hds.opening || '', status: 'imported'
        });
        saved.push(game);
      });
      return saved;
    }
    function summarizeImportedGames(saved) {
      let matched = 0, deviations = 0, unmatched = 0;
      saved.forEach(g => {
        if (g.lineId) matched++; else unmatched++;
        const r = DB.deepReviewGame ? DB.deepReviewGame(g) : null;
        deviations += r && r.moments ? r.moments.length : 0;
      });
      return { matched, deviations, unmatched, failed: Math.max(0, games.length - saved.length) };
    }
    function renderResult(saved, stats) {
      panel.appendChild(h('div', { class: 'import-result-grid' }, [
        stat('Imported', saved.length), stat('Matched', stats.matched), stat('Deviations', stats.deviations), stat('Unmatched', stats.unmatched)
      ]));
      panel.appendChild(h('p', { class: 'muted', text: stats.deviations ? 'OpeningOS found repair moments. Review them in Games or practice the repair set now.' : 'Games imported. Match unmatched games to repertoire lines to unlock deeper review.' }));
      const repairCards = [];
      saved.forEach(g => { const r = DB.deepReviewGame ? DB.deepReviewGame(g) : null; (r && r.moments || []).forEach(m => { const c = m.cardId && DB.position(m.cardId); if (c) repairCards.push(c); }); });
      panel.appendChild(h('div', { class: 'row', style: 'justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px' }, [
        h('button', { class: 'btn', type: 'button', on: { click: () => { close(); global.OOSApp.go('games'); } } }, ['Review games']),
        repairCards.length ? h('button', { class: 'btn btn-primary', type: 'button', on: { click: () => { close(); global.OOSViews.startSessionWith(repairCards, { mode: 'repair' }); } } }, ['Practice repair set']) : null,
        h('button', { class: 'btn btn-ghost', type: 'button', on: { click: renderStart } }, ['Import more'])
      ].filter(Boolean)));
      onSubmit && onSubmit({ games: saved, stats });
    }
    function stat(label, value) { return h('div', { class: 'import-stat' }, [h('strong', { text: String(value) }), h('span', { text: label })]); }
    function renderImportError(msg) {
      panel.innerHTML = '';
      panel.append(h('div', { class: 'eyebrow', text: 'Import failed' }), h('h3', { text: 'We could not finish this import' }), h('p', { class: 'import-message warn', text: msg }), h('div', { class: 'row', style: 'justify-content:flex-end;gap:8px;margin-top:14px' }, [h('button', { class: 'btn', type: 'button', on: { click: close } }, ['Cancel']), h('button', { class: 'btn btn-primary', type: 'button', on: { click: renderStart } }, ['Try again'])]));
    }
    wrap.append(h('div', { class: 'modal-back', on: { click: close } }), panel);
    document.body.appendChild(wrap);
    renderStart();
  }

  function decorateGames(app) {
    if (!app || $('.games-coach-note', app)) return;
    const detail = $('.game-detail', app);
    if (!detail) return;
    const DB = global.OOSData;
    const activeTitle = $('.game-detail h3', app);
    const game = DB && DB.importedGames && DB.importedGames().find(g => activeTitle && activeTitle.textContent.includes(g.vs));
    if (!game || !DB.deepReviewGame) return;
    const review = DB.deepReviewGame(game);
    const moments = review.moments || [];
    const cards = moments.map(m => m.cardId && DB.position(m.cardId)).filter(Boolean);
    const note = h('section', { class: 'games-coach-note' }, [
      h('span', { class: 'command-kicker', text: 'Opening repair report' }),
      h('h3', { text: moments[0] ? playerMomentText(moments[0], game, DB.line(review.lineId)) : 'No urgent opening repair found' }),
      h('p', { text: moments[0] ? ((moments[0].repeated || 0) ? `This happened ${moments[0].repeated} time(s) before. ` : '') + (moments[0].relevance ? moments[0].relevance.message : 'Add this to practice or store the sideline.') : 'The game either stayed inside your saved repertoire or needs to be matched to a line first.' }),
      h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-top:10px' }, [
        cards.length ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', on: { click: () => global.OOSViews.startSessionWith(cards, { mode: 'repair' }) } }, ['Practice this repair set']) : null,
        h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => global.OOSApp.openImport() } }, ['Import more games'])
      ].filter(Boolean))
    ]);
    const pgn = $('.game-detail > .panel.mono', app);
    detail.insertBefore(note, pgn || detail.children[1] || null);
  }
  function playerMomentText(moment, game, line) {
    if (moment.kind === 'user-left-prep') return `You left your ${line ? line.name : 'opening'} prep on move ${Math.ceil(moment.ply / 2)}.`;
    if (moment.kind === 'opponent-sideline') return `Your opponent played an uncovered sideline on move ${Math.ceil(moment.ply / 2)}.`;
    return moment.message || `Opening moment from your game vs ${game.vs}.`;
  }

  function decorateSettings(app) {
    if (!app || $('.beta-trust-panel', app)) return;
    const DB = global.OOSData;
    const panel = h('section', { class: 'card beta-trust-panel' }, [
      h('div', { class: 'row-between' }, [
        h('div', {}, [h('div', { class: 'eyebrow', text: 'Trust and beta readiness' }), h('h3', { text: 'Account, data and product health' }), h('p', { class: 'muted', text: 'OpeningOS protects your prep locally first, then syncs it to your account when cloud sync is connected.' })]),
        h('span', { class: 'pill pill-info pill-plain', text: BUILD_VERSION })
      ]),
      h('div', { class: 'trust-grid' }, [
        trustItem('Account', signedIn() ? ((authUser() || {}).email || 'Signed in') : 'Not signed in'),
        trustItem('Local save', fmtRelative(getLocalSaved())),
        trustItem('Cloud sync', signedIn() ? fmtRelative(getCloudSynced()) : 'Connect account'),
        trustItem('Backup', 'Available anytime'),
      ]),
      h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-top:14px' }, [
        h('button', { class: 'btn btn-sm btn-primary', type: 'button', on: { click: () => signedIn() ? pushCloudSync() : global.OOSAuthBridge.show({ onDone: () => updateTrustPill() }) } }, [signedIn() ? 'Sync now' : 'Sign in']),
        h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => exportData() } }, ['Export data']),
        h('button', { class: 'btn btn-sm', type: 'button', on: { click: () => requestAccountDeletion() } }, ['Delete account data']),
        h('a', { class: 'btn btn-sm btn-ghost', href: 'PRIVACY.md', target: '_blank' }, ['Privacy']),
        h('a', { class: 'btn btn-sm btn-ghost', href: 'SECURITY.md', target: '_blank' }, ['Security'])
      ])
    ]);
    const root = app.firstElementChild || app;
    root.appendChild(panel);
    function trustItem(label, value) { return h('div', { class: 'trust-item' }, [h('span', { text: label }), h('strong', { text: value })]); }
    function exportData() {
      const snap = DB.exportAll ? DB.exportAll() : DB.exportSnapshot();
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'openingos-backup-' + new Date().toISOString().slice(0,10) + '.json'; a.click(); URL.revokeObjectURL(a.href);
    }
    async function requestAccountDeletion() {
      if (!signedIn()) return global.OOSApp.toast('Sign in first to request account deletion.', 'warn');
      if (!confirm('Request account deletion? Export your data first if you need a backup.')) return;
      try { await global.OOSAuthBridge.request('POST', '/account/delete', { reason: 'Requested from Settings' }); global.OOSApp.toast('Account deletion request queued.', 'good'); }
      catch (err) { global.OOSApp.toast(friendlyError(err), 'bad'); }
    }
  }

  function patchViews() {
    if (!global.OOSViews || global.OOSViews.__productExperiencePatched) return;
    const V = global.OOSViews;
    function wrapRender(name, decorator) {
      const original = V[name];
      if (typeof original !== 'function') return;
      V[name] = function patchedRender(app, opts) {
        const out = original.apply(this, arguments);
        try { decorator(app || $('#app'), opts || {}); } catch (err) { console.warn('[OpeningOS product decorator]', name, err); }
        updateActiveSidebar(); updateTrustPill();
        return out;
      };
    }
    wrapRender('renderToday', decorateToday);
    wrapRender('renderRepertoire', decorateRepertoire);
    wrapRender('renderGames', decorateGames);
    // Settings is now a single player-facing page; do not append beta/admin panels.
    // wrapRender('renderSettings', decorateSettings);
    V.showImportWizard = showImportWizard;
    V.openLichessFlow = function () { showImportWizard((r) => { if (r && r.games && global.OOSApp) global.OOSApp.go('games'); }, { source: 'lichess' }); };
    V.openChesscomFlow = function () { showImportWizard((r) => { if (r && r.games && global.OOSApp) global.OOSApp.go('games'); }, { source: 'chesscom' }); };
    V.__productExperiencePatched = true;
  }

  function patchAppNavigation() {
    if (!global.OOSApp || global.OOSApp.__productNavPatched) return;
    const originalGo = global.OOSApp.go;
    if (typeof originalGo === 'function') {
      global.OOSApp.go = function goPatched() {
        const out = originalGo.apply(this, arguments);
        setTimeout(() => { updateActiveSidebar(); updateTrustPill(); }, 20);
        return out;
      };
      global.OOSApp.__productNavPatched = true;
    }
  }

  function patchAuthText() {
    // Hide deployment plumbing from normal users, but do it safely. The old
    // implementation rewrote textContent for hundreds of nodes on every DOM
    // mutation, which could retrigger the observer and freeze the page.
    if (document.__oosProductAuthTextPatched) return;
    document.__oosProductAuthTextPatched = true;

    const patterns = [
      [/backend game imports/gi, 'reliable game imports'],
      [/backend imports/gi, 'cloud imports'],
      [/Backend API/gi, 'Connection settings'],
      [/Cloud server URL/gi, 'Connection URL'],
      [/Cloud server/gi, 'Connection'],
      [/Local profile only/gi, 'Offline workspace'],
      [/local-only/gi, 'offline'],
      [/SaaS/gi, 'Cloud']
    ];
    const selector = '.account-gateway label, .account-gateway span, .account-gateway p, .account-gateway button, .auth-shell label, .auth-shell span, .auth-shell p, .auth-shell button, .modal label, .modal span, .modal p, .modal button';
    let scheduled = false;

    function translate(text) {
      let out = String(text || '');
      patterns.forEach(([re, to]) => { out = out.replace(re, to); });
      return out;
    }
    function scan(root) {
      scheduled = false;
      $all(selector, root || document).forEach(n => {
        if (!n.childNodes || n.childNodes.length !== 1 || n.firstChild.nodeType !== 3) return;
        const before = n.textContent || '';
        const after = translate(before);
        if (after !== before) n.textContent = after;
      });
    }
    function schedule(root) {
      if (scheduled) return;
      scheduled = true;
      const run = () => scan(root || document);
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 800 });
      else setTimeout(run, 120);
    }

    scan(document);
    const mo = new MutationObserver(mutations => {
      if (mutations.some(m => Array.from(m.addedNodes || []).some(n => n.nodeType === 1))) schedule(document);
    });
    mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    mountProductShell();
    patchPersistence();
    patchViews();
    patchAppNavigation();
    patchAuthText();
    updateTrustPill();
    // Lightweight health refresh only. View decorators are installed once and
    // run from render/navigation wrappers; repeatedly patching every few seconds
    // made the page feel heavy on slower devices.
    setInterval(() => { updateTrustPill(); }, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.OOSProductExperience = { BUILD_VERSION, pushCloudSync, updateTrustPill, showImportWizard, showIdeaEditor };
})(window);
