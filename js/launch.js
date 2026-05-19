/* OpeningOS — launch readiness layer
 * Adds product-grade safety tools around the local-first app: data health,
 * backup reminders, share packs, coach assignment packs, and deployment status.
 */
(function (global) {
  'use strict';

  const PRODUCT_VERSION = '0.5.1-responsive-product';
  const BACKUP_WARN_DAYS = 7;

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

  function toast(message, kind) {
    if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(message, kind || 'info');
  }

  function safeFile(name) {
    return String(name || 'openingos')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'openingos';
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function modal(title, subtitle) {
    const wrap = h('div', { class: 'modal launch-modal' });
    const back = h('div', { class: 'modal-back', on: { click: () => wrap.remove() } });
    const panel = h('div', { class: 'modal-panel wide launch-panel' });
    panel.appendChild(h('div', { class: 'eyebrow' }, ['Product readiness']));
    panel.appendChild(h('h3', { style: { marginTop: '6px' } }, [title]));
    if (subtitle) panel.appendChild(h('p', { class: 'muted', style: { marginTop: '6px', fontSize: '13px' } }, [subtitle]));
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    return { wrap, panel, close: () => wrap.remove() };
  }

  function db() { return global.OOSData; }

  function profileName() {
    try { return (global.OOSProfiles.active() || {}).name || 'profile'; }
    catch (_) { return 'profile'; }
  }

  function lineNotesFor(line) {
    const DB = db();
    return (DB.positionsForLine(line.id) || []).map(p => ({
      ply: p.ply,
      note: DB.notesFor(p.id),
      meta: DB.cardMetaFor ? DB.cardMetaFor(p.id) : {},
    })).filter(x => (x.note && (x.note.text || (x.note.tags || []).length)) || (x.meta && ((x.meta.alternates || []).length || x.meta.confusing)));
  }

  function exportLinePack(lineIds) {
    const DB = db();
    const ids = lineIds && lineIds.length ? lineIds : DB.lines().map(l => l.id);
    const lines = ids.map(id => DB.line(id)).filter(Boolean).map(line => ({
      name: line.name,
      eco: line.eco,
      opening: line.opening,
      color: line.color,
      tag: line.tag,
      repId: line.repId,
      description: line.description || '',
      moves: (line.moves || []).slice(),
      source: 'share-pack',
      notesByPly: lineNotesFor(line),
    }));
    const pack = {
      schema: 'openingos-share-pack-v1',
      product: 'OpeningOS',
      productVersion: PRODUCT_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: profileName(),
      lines,
    };
    downloadJson('openingos-share-pack-' + Date.now() + '.json', pack);
    toast('Share pack exported', 'good');
    return pack;
  }

  function importLinePack(pack) {
    const DB = db();
    if (!pack || !Array.isArray(pack.lines)) throw new Error('This is not an OpeningOS share pack.');
    const created = [];
    pack.lines.forEach(src => {
      if (!Array.isArray(src.moves) || !src.moves.length) return;
      const line = DB.addUserLine({
        name: src.name || 'Imported line',
        eco: src.eco || '?',
        opening: src.opening || src.name || 'Imported line',
        color: src.color || 'w',
        tag: src.tag || 'nice-to-know',
        repId: src.repId || (src.color === 'b' ? 'rep-b-e4' : 'rep-w'),
        description: src.description || ('Imported from ' + (pack.exportedBy || 'share pack')),
        moves: src.moves,
        source: 'share-pack',
      });
      created.push(line);
      (src.notesByPly || []).forEach(n => {
        const card = DB.cardAtLinePly ? DB.cardAtLinePly(line.id, n.ply) : null;
        if (!card) return;
        if (n.note) DB.setNote(card.id, n.note);
        if (n.meta && n.meta.alternates && DB.addAlternateToCard) {
          n.meta.alternates.forEach(a => DB.addAlternateToCard(card.id, a.san || a, a.fen || ''));
        }
        if (n.meta && n.meta.confusing && DB.markCardConfusing) DB.markCardConfusing(card.id, n.meta.confusingReason || 'Imported confusing mark');
      });
    });
    return created;
  }

  function exportCoachPack() {
    const DB = db();
    const assignments = DB.assignments ? DB.assignments() : [];
    const lineIds = Array.from(new Set(assignments.map(a => a.lineId).filter(Boolean)));
    const lines = lineIds.map(id => DB.line(id)).filter(Boolean).map(line => ({
      localId: line.id,
      name: line.name,
      eco: line.eco,
      opening: line.opening,
      color: line.color,
      tag: line.tag,
      repId: line.repId,
      description: line.description || '',
      moves: (line.moves || []).slice(),
      notesByPly: lineNotesFor(line),
    }));
    const pack = {
      schema: 'openingos-coach-pack-v1',
      product: 'OpeningOS',
      productVersion: PRODUCT_VERSION,
      exportedAt: new Date().toISOString(),
      coach: profileName(),
      assignments: assignments.map(a => Object.assign({}, a)),
      lines,
    };
    downloadJson('openingos-coach-pack-' + safeFile(profileName()) + '.json', pack);
    toast('Coach assignment pack exported', 'good');
    return pack;
  }

  function importCoachPack(pack) {
    const DB = db();
    if (!pack || !Array.isArray(pack.lines)) throw new Error('This is not an OpeningOS coach pack.');
    const idMap = {};
    pack.lines.forEach(src => {
      const line = DB.addUserLine({
        name: src.name || 'Coach assigned line',
        eco: src.eco || '?',
        opening: src.opening || src.name || 'Coach assigned line',
        color: src.color || 'w',
        tag: src.tag || 'must-know',
        repId: src.repId || (src.color === 'b' ? 'rep-b-e4' : 'rep-w'),
        description: src.description || ('Assigned by ' + (pack.coach || 'coach')),
        moves: src.moves || [],
        source: 'coach-pack',
      });
      idMap[src.localId] = line.id;
      (src.notesByPly || []).forEach(n => {
        const card = DB.cardAtLinePly ? DB.cardAtLinePly(line.id, n.ply) : null;
        if (card && n.note) DB.setNote(card.id, n.note);
      });
    });
    (pack.assignments || []).forEach(a => {
      DB.addAssignment(Object.assign({}, a, {
        id: undefined,
        studentId: 'self',
        lineId: idMap[a.lineId] || a.lineId,
        status: 'pending',
        message: (a.message ? a.message + '\n\n' : '') + 'Imported from coach pack by ' + (pack.coach || 'coach'),
      }));
    });
    return Object.keys(idMap).length;
  }

  function chooseFile(callback) {
    const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { callback(JSON.parse(reader.result)); }
        catch (err) { toast(err.message || 'Invalid JSON file', 'warn'); }
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 2000);
  }

  function exportFullBackup() {
    const DB = db();
    const snapshot = DB.exportAll ? DB.exportAll() : DB.exportSnapshot();
    snapshot.productVersion = PRODUCT_VERSION;
    snapshot.deployment = deploymentInfo();
    downloadJson('openingos-full-backup-' + safeFile(profileName()) + '-' + new Date().toISOString().slice(0, 10) + '.json', snapshot);
    if (DB.setSetting) DB.setSetting('lastBackupAt', Date.now());
    toast('Full backup exported', 'good');
  }

  function importFullBackup() {
    chooseFile(data => {
      if (!confirm('Restore this backup into the current profile? Current local data in this profile will be replaced.')) return;
      const DB = db();
      if (DB.importAll) DB.importAll(data); else DB.importSnapshot(data);
      toast('Backup restored', 'good');
      if (global.OOSApp) global.OOSApp.go('today');
    });
  }

  function importSharePack() {
    chooseFile(data => {
      const lines = importLinePack(data);
      toast('Imported ' + lines.length + ' shared line' + (lines.length === 1 ? '' : 's'), 'good');
      if (lines[0] && global.OOSApp) global.OOSApp.go('repertoire', { lineId: lines[0].id });
    });
  }

  function importCoachPackFlow() {
    chooseFile(data => {
      const count = importCoachPack(data);
      toast('Imported coach pack with ' + count + ' line' + (count === 1 ? '' : 's'), 'good');
      if (global.OOSApp) global.OOSApp.go('practice');
    });
  }

  function deploymentInfo() {
    return {
      url: location.href,
      origin: location.origin,
      protocol: location.protocol,
      serviceWorker: !!(navigator.serviceWorker),
      standalone: !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
    };
  }

  function collectReadiness() {
    const DB = db();
    const lines = DB.lines ? DB.lines() : [];
    const cards = DB.allPositions ? DB.allPositions() : [];
    const due = DB.duePositions ? DB.duePositions() : [];
    const weak = DB.weakPositions ? DB.weakPositions() : [];
    const games = DB.importedGames ? DB.importedGames() : [];
    const students = DB.students ? DB.students() : [];
    const assignments = DB.assignments ? DB.assignments() : [];
    const settings = DB.settings ? DB.settings() : {};
    const lastBackupAt = settings.lastBackupAt || 0;
    const backupAgeDays = lastBackupAt ? Math.floor((Date.now() - lastBackupAt) / 86400000) : null;
    const warnings = [];
    if (!lines.length) warnings.push('Add at least one personal repertoire line before launch testing.');
    if (!cards.length) warnings.push('No trainable positions yet. Create/import a line first.');
    if (backupAgeDays == null) warnings.push('No backup has been exported from this profile yet.');
    else if (backupAgeDays >= BACKUP_WARN_DAYS) warnings.push('Backup is older than ' + BACKUP_WARN_DAYS + ' days. Export a fresh backup.');
    if (deploymentInfo().protocol === 'file:') warnings.push('Open through a web server or GitHub Pages, not file://, so the PWA can install.');
    return { lines, cards, due, weak, games, students, assignments, settings, lastBackupAt, backupAgeDays, warnings };
  }

  function stat(label, value, hint) {
    return h('div', { class: 'launch-stat' }, [
      h('div', { class: 'num' }, [String(value)]),
      h('div', { class: 'lbl' }, [label]),
      hint ? h('div', { class: 'hint' }, [hint]) : null,
    ]);
  }

  function showReliabilityCenter() {
    const m = modal('Reliability center', 'Use this before sharing the app with serious players or students. It checks data safety, portability, and deployment readiness.');
    const r = collectReadiness();
    const deploy = deploymentInfo();
    m.panel.appendChild(h('div', { class: 'launch-grid' }, [
      stat('Repertoire lines', r.lines.length, 'stored locally'),
      stat('Trainable cards', r.cards.length, r.due.length + ' due now'),
      stat('Imported games', r.games.length, r.weak.length + ' weak cards'),
      stat('Coach records', r.students.length, r.assignments.length + ' assignments'),
    ]));

    m.panel.appendChild(h('div', { class: 'panel launch-card' }, [
      h('div', { class: 'row-between' }, [
        h('div', {}, [
          h('strong', {}, ['Deployment status']),
          h('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '4px' } }, [
            deploy.protocol === 'https:' ? 'HTTPS deployment detected.' : deploy.protocol === 'file:' ? 'Local file mode detected.' : 'Local web-server mode detected.',
            ' Build ', PRODUCT_VERSION, '.'
          ]),
        ]),
        h('span', { class: 'pill ' + (deploy.protocol === 'https:' ? 'pill-good' : 'pill-warn') }, [deploy.protocol === 'https:' ? 'deploy-ready' : 'test mode']),
      ]),
    ]));

    if (r.warnings.length) {
      m.panel.appendChild(h('div', { class: 'warn-banner', style: { marginTop: '12px' } }, [
        h('div', {}, [
          h('strong', {}, ['Fix before serious use:']),
          h('ul', { style: { margin: '8px 0 0 18px', padding: '0' } }, r.warnings.map(w => h('li', {}, [w]))),
        ]),
      ]));
    } else {
      m.panel.appendChild(h('div', { class: 'success-banner', style: { marginTop: '12px' } }, ['No critical local-readiness warnings detected.']));
    }

    m.panel.appendChild(h('div', { class: 'launch-actions' }, [
      h('button', { class: 'btn btn-primary', on: { click: exportFullBackup } }, ['Export full backup']),
      h('button', { class: 'btn', on: { click: importFullBackup } }, ['Import backup']),
      h('button', { class: 'btn', on: { click: () => exportLinePack() } }, ['Export share pack']),
      h('button', { class: 'btn', on: { click: importSharePack } }, ['Import share pack']),
      h('button', { class: 'btn', on: { click: exportCoachPack } }, ['Export coach pack']),
      h('button', { class: 'btn', on: { click: importCoachPackFlow } }, ['Import coach pack']),
    ]));

    m.panel.appendChild(h('div', { class: 'muted', style: { marginTop: '12px', fontSize: '12px' } }, [
      'This build saves work locally and can sync with OpeningOS Cloud when signed in.'
    ]));
  }

  function appendLaunchPanel(app, view) {
    if (!app || app.querySelector('.launch-settings-panel')) return;
    const panel = h('div', { class: 'panel launch-settings-panel', style: { marginTop: '22px', padding: '16px 18px' } }, [
      h('div', { class: 'row-between' }, [
        h('div', {}, [
          h('div', { class: 'eyebrow' }, [view === 'coach' ? 'Assignment exchange' : 'Launch readiness']),
          h('h3', { style: { marginTop: '4px' } }, [view === 'coach' ? 'Move assignments between coach and students' : 'Reliability center']),
          h('p', { class: 'muted', style: { marginTop: '4px', fontSize: '13px' } }, [
            view === 'coach'
              ? 'Export a coach pack with assigned lines and notes. Students can import it into their own OpeningOS profile.'
              : 'Check backups, share packs, coach packs, local data health, and deployment status before giving users access.'
          ]),
        ]),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
          h('button', { class: 'btn btn-primary', on: { click: showReliabilityCenter } }, ['Open center']),
          view === 'coach' ? h('button', { class: 'btn', on: { click: exportCoachPack } }, ['Export coach pack']) : null,
          view === 'coach' ? h('button', { class: 'btn', on: { click: importCoachPackFlow } }, ['Import coach pack']) : null,
        ]),
      ]),
    ]);
    app.appendChild(panel);
  }

  function patchView(name, viewLabel) {
    if (!global.OOSViews || !global.OOSViews[name] || global.OOSViews[name].__launchPatched) return;
    const original = global.OOSViews[name];
    const wrapped = function (app, opts) {
      const out = original.apply(this, arguments);
      appendLaunchPanel(app || document.getElementById('app'), viewLabel);
      return out;
    };
    wrapped.__launchPatched = true;
    global.OOSViews[name] = wrapped;
  }

  function maybeBackupReminder() {
    // No blocking browser alert on startup. Backup/export is available from
    // Settings → Reliability center, while signed-in users have cloud sync.
    // Keep a marker so older cached sessions do not resurface the old prompt.
    try { localStorage.setItem('oos.launch.backupReminderDismissedAt', String(Date.now())); } catch (_) {}
    const DB = db();
    if (DB && DB.setSetting) DB.setSetting('backupReminderDismissedAt', Date.now());
    return;
  }

  function patchAfterBoot() {
    patchView('renderSettings', 'settings');
    patchView('renderCoach', 'coach');
    if (global.OOSData && global.OOSData.init && !global.OOSData.init.__launchPatched) {
      const orig = global.OOSData.init.bind(global.OOSData);
      const patched = function () { const out = orig(); setTimeout(maybeBackupReminder, 500); return out; };
      patched.__launchPatched = true;
      global.OOSData.init = patched;
    }
  }

  patchAfterBoot();
  document.addEventListener('DOMContentLoaded', patchAfterBoot);

  global.OOSLaunch = {
    version: PRODUCT_VERSION,
    showReliabilityCenter,
    exportFullBackup,
    importFullBackup,
    exportLinePack,
    importSharePack,
    exportCoachPack,
    importCoachPackFlow,
    collectReadiness,
  };
})(window);
