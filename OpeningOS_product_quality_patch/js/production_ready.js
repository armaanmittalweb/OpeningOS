/* OpeningOS — production-readiness layer
 * Adds deploy-grade safety utilities on top of the local-first product build.
 * This file intentionally avoids external dependencies so it works on GitHub Pages.
 */
(function (global) {
  'use strict';

  const VERSION = '0.7.0-enterprise-graph';
  const MIN_BACKUP_INTERVAL_MS = 1000 * 60 * 60 * 24 * 7;

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

  function toast(msg, kind) {
    if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info');
  }

  function safeFile(s) {
    return String(s || 'openingos').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'openingos';
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function closeModal(wrap) {
    if (wrap && wrap.parentNode) wrap.remove();
  }

  function modal(title, subtitle, opts) {
    const wrap = h('div', { class: 'modal production-modal-shell' });
    const back = h('div', { class: 'modal-back', on: { click: () => closeModal(wrap) } });
    const panel = h('div', { class: 'modal-panel production-modal', role: 'dialog', 'aria-modal': 'true' });
    panel.appendChild(h('div', { class: 'eyebrow' }, [(opts && opts.eyebrow) || 'OpeningOS']));
    panel.appendChild(h('h3', { style: { marginTop: '6px' } }, [title]));
    if (subtitle) panel.appendChild(h('p', { class: 'muted', style: { marginTop: '6px', fontSize: '13px' } }, [subtitle]));
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    const first = panel.querySelector('button,input,select,textarea,a[href]');
    if (first) setTimeout(() => first.focus(), 20);
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(wrap); });
    return { wrap, panel, close: () => closeModal(wrap) };
  }

  function bytes(str) {
    try { return new Blob([String(str || '')]).size; }
    catch (_) { return String(str || '').length; }
  }

  function allLocalStorageBytes() {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        n += bytes(key) + bytes(localStorage.getItem(key));
      }
    } catch (_) {}
    return n;
  }

  function humanBytes(n) {
    if (!isFinite(n)) return 'unknown';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  }

  function patchDataLayer() {
    const DB = global.OOSData;
    if (!DB || DB.__productionReadyPatched) return;
    DB.__productionReadyPatched = true;
    DB.productVersion = VERSION;

    DB.profileStorageBytes = function () {
      try { return bytes(JSON.stringify(this.state || {})); } catch (_) { return 0; }
    };

    DB.storageHealth = function () {
      const profileBytes = this.profileStorageBytes ? this.profileStorageBytes() : 0;
      const allBytes = allLocalStorageBytes();
      let risk = 'good';
      if (profileBytes > 4 * 1024 * 1024 || allBytes > 4.5 * 1024 * 1024) risk = 'danger';
      else if (profileBytes > 2.5 * 1024 * 1024 || allBytes > 3.5 * 1024 * 1024) risk = 'warn';
      return { profileBytes, allBytes, risk, profile: humanBytes(profileBytes), total: humanBytes(allBytes) };
    };

    DB.healthReport = function () {
      if (!this.state || !this.data) {
        return {
          version: VERSION,
          generatedAt: new Date().toISOString(),
          counts: { lines: 0, positions: 0, games: 0, due: 0, weak: 0, reviewEvents: 0, notes: 0, assignments: 0, students: 0, opponentReports: 0, unmatchedGames: 0, ignoredGames: 0 },
          storage: this.storageHealth(),
          lastBackupAt: 0,
          backupAgeMs: Infinity,
          issues: [],
          missingSrs: [],
          orphanSrs: [],
          orphanNotes: [],
          orphanMeta: [],
        };
      }
      const state = this.state || {};
      const lines = this.lines ? this.lines() : [];
      const positions = this.allPositions ? this.allPositions() : [];
      const games = this.importedGames ? this.importedGames() : [];
      const srs = state.srs || {};
      const cardMeta = state.cardMeta || {};
      const notes = state.notes || {};
      const missingSrs = positions.filter(p => !srs[p.id]).map(p => p.id);
      const positionIds = new Set(positions.map(p => p.id));
      const orphanSrs = Object.keys(srs).filter(k => !positionIds.has(k));
      const orphanNotes = Object.keys(notes).filter(k => k.indexOf('#') > 0 && !positionIds.has(k));
      const orphanMeta = Object.keys(cardMeta).filter(k => k.indexOf('#') > 0 && !positionIds.has(k));
      const unmatchedGames = games.filter(g => !g.lineId || g.status === 'unmatched').length;
      const ignoredGames = games.filter(g => (this.gameStatus && this.gameStatus(g.id).ignored) || g.status === 'ignored').length;
      const due = this.duePositions ? this.duePositions().length : 0;
      const weak = this.weakPositions ? this.weakPositions().length : 0;
      const lastBackupAt = Number(this.getSetting ? this.getSetting('lastBackupAt', 0) : 0) || 0;
      const backupAgeMs = lastBackupAt ? Date.now() - lastBackupAt : Infinity;
      const storage = this.storageHealth();
      const issues = [];
      if (missingSrs.length) issues.push({ kind: 'missing-srs', severity: 'warn', count: missingSrs.length, text: `${missingSrs.length} cards missing review state` });
      if (orphanSrs.length) issues.push({ kind: 'orphan-srs', severity: 'info', count: orphanSrs.length, text: `${orphanSrs.length} stale review records can be cleaned` });
      if (orphanNotes.length) issues.push({ kind: 'orphan-notes', severity: 'info', count: orphanNotes.length, text: `${orphanNotes.length} stale notes can be cleaned` });
      if (orphanMeta.length) issues.push({ kind: 'orphan-meta', severity: 'info', count: orphanMeta.length, text: `${orphanMeta.length} stale card metadata records can be cleaned` });
      if (unmatchedGames) issues.push({ kind: 'unmatched-games', severity: 'info', count: unmatchedGames, text: `${unmatchedGames} games are unmatched to repertoire lines` });
      if (backupAgeMs > MIN_BACKUP_INTERVAL_MS && (lines.length || games.length || positions.length)) issues.push({ kind: 'backup-due', severity: 'warn', count: 1, text: 'Backup recommended: your last backup is older than 7 days or missing' });
      if (storage.risk !== 'good') issues.push({ kind: 'storage', severity: storage.risk, count: 1, text: `Browser storage usage is ${storage.total}` });
      return {
        version: VERSION,
        generatedAt: new Date().toISOString(),
        counts: {
          lines: lines.length,
          positions: positions.length,
          games: games.length,
          due,
          weak,
          reviewEvents: (state.reviewEvents || []).length,
          notes: Object.keys(notes).length,
          assignments: (state.assignments || []).length,
          students: (state.students || []).length,
          opponentReports: (state.opponentReports || []).length,
          unmatchedGames,
          ignoredGames,
        },
        storage,
        lastBackupAt,
        backupAgeMs,
        issues,
        missingSrs,
        orphanSrs,
        orphanNotes,
        orphanMeta,
      };
    };

    DB.repairIntegrity = function () {
      const state = this.state || {};
      state.srs = state.srs || {};
      state.notes = state.notes || {};
      state.cardMeta = state.cardMeta || {};
      const report = this.healthReport();
      const now = Date.now();
      let repaired = 0;
      report.missingSrs.forEach(id => {
        state.srs[id] = { stability: 0, due: now, lapses: 0, missRate: 0, reps: 0, lastReview: 0 };
        repaired++;
      });
      report.orphanSrs.forEach(id => { delete state.srs[id]; repaired++; });
      report.orphanNotes.forEach(id => { delete state.notes[id]; repaired++; });
      report.orphanMeta.forEach(id => { delete state.cardMeta[id]; repaired++; });
      if (this.persist) this.persist();
      if (this.init) this.init();
      return { repaired, before: report, after: this.healthReport() };
    };

    DB.markBackupExported = function () {
      if (this.setSetting) this.setSetting('lastBackupAt', Date.now());
    };

    DB.exportPgnBundle = function () {
      const chunks = [];
      (this.lines ? this.lines() : []).forEach((line, i) => {
        if (this.exportLinePgn) chunks.push(this.exportLinePgn(line.id));
        else chunks.push(`[Event "OpeningOS repertoire"]\n[Opening "${String(line.name || '').replace(/"/g, "'")}"]\n[Result "*"]\n\n${(line.moves || []).join(' ')} *`);
        if (i !== (this.lines().length - 1)) chunks.push('\n\n');
      });
      return chunks.join('');
    };

    DB.exportCoachPackage = function (studentId) {
      const student = (this.students ? this.students() : []).find(s => s.id === studentId) || null;
      const assignments = (this.assignments ? this.assignments() : []).filter(a => !studentId || a.studentId === studentId);
      const referencedLineIds = Array.from(new Set(assignments.map(a => a.lineId).filter(Boolean)));
      const lines = referencedLineIds.map(id => this.line(id)).filter(Boolean).map(line => ({
        id: line.id,
        name: line.name,
        eco: line.eco,
        opening: line.opening,
        color: line.color,
        tag: line.tag,
        description: line.description,
        repId: line.repId,
        moves: (line.moves || []).slice(),
        pgn: this.exportLinePgn ? this.exportLinePgn(line.id) : '',
      }));
      return {
        schema: 'openingos-coach-package-v1',
        exportedAt: new Date().toISOString(),
        coachProfile: global.OOSProfiles && global.OOSProfiles.active ? global.OOSProfiles.active() : null,
        student,
        assignments,
        lines,
      };
    };

    DB.importCoachPackage = function (pkg) {
      if (!pkg || pkg.schema !== 'openingos-coach-package-v1') throw new Error('Not an OpeningOS coach package.');
      const idMap = {};
      (pkg.lines || []).forEach(line => {
        const created = this.addUserLine({
          name: line.name,
          eco: line.eco,
          opening: line.opening,
          color: line.color,
          tag: line.tag || 'coach',
          description: line.description || 'Imported from coach package',
          repId: line.repId,
          moves: line.moves || [],
          source: 'coach',
        });
        idMap[line.id] = created.id;
      });
      (pkg.assignments || []).forEach(a => {
        if (!this.addAssignment) return;
        this.addAssignment({
          studentId: 'self',
          lineId: idMap[a.lineId] || a.lineId,
          mode: a.mode || 'Daily',
          due: a.due || '',
          message: a.message || 'Imported from coach package',
          status: 'pending',
          progress: 0,
        });
      });
      return { lines: Object.keys(idMap).length, assignments: (pkg.assignments || []).length };
    };
  }

  function renderIssueList(report) {
    if (!report.issues.length) {
      return h('div', { class: 'panel production-health-ok' }, [
        h('strong', {}, ['Healthy']),
        h('p', { class: 'muted', style: { marginTop: '4px' } }, ['No integrity problems found. Keep exporting backups before important tournaments.'])
      ]);
    }
    return h('div', { class: 'stack production-issues' }, report.issues.map(issue => h('div', { class: 'panel production-issue ' + issue.severity }, [
      h('strong', {}, [issue.text]),
      h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '2px' } }, [issue.kind])
    ])));
  }

  function statCard(label, value, hint) {
    return h('div', { class: 'panel production-stat' }, [
      h('div', { class: 'muted', style: { fontSize: '12px' } }, [label]),
      h('strong', { style: { fontSize: '20px' } }, [String(value)]),
      hint ? h('div', { class: 'muted', style: { fontSize: '11px' } }, [hint]) : null,
    ]);
  }

  function showDataSafetyCenter() {
    patchDataLayer();
    const DB = global.OOSData;
    const m = modal('Data safety center', 'Back up, verify, repair, and export your preparation before you rely on it for serious games.', { eyebrow: 'Reliability' });

    function render() {
      const report = DB.healthReport();
      m.panel.querySelectorAll('.production-body').forEach(n => n.remove());
      const body = h('div', { class: 'production-body stack', style: { marginTop: '14px' } });
      body.appendChild(h('div', { class: 'product-grid four' }, [
        statCard('Lines', report.counts.lines, 'saved repertoires'),
        statCard('Cards', report.counts.positions, `${report.counts.due} due`),
        statCard('Games', report.counts.games, `${report.counts.unmatchedGames} unmatched`),
        statCard('Storage', report.storage.total, report.storage.risk === 'good' ? 'safe range' : 'watch size'),
      ]));
      body.appendChild(renderIssueList(report));
      const last = report.lastBackupAt ? new Date(report.lastBackupAt).toLocaleString() : 'never';
      body.appendChild(h('div', { class: 'panel', style: { padding: '12px 14px' } }, [
        h('strong', {}, ['Backup status: ']), last,
        h('div', { class: 'muted', style: { marginTop: '4px', fontSize: '12px' } }, ['OpeningOS stores a durable IndexedDB copy plus a localStorage cache. Export JSON before clearing browser data, changing devices, or playing important events.'])
      ]));
      const auditRows = DB.auditTrail ? DB.auditTrail(8) : [];
      const obsRows = global.OOSObservability && global.OOSObservability.list ? global.OOSObservability.list().slice(-8).reverse() : [];
      body.appendChild(h('details', { class: 'panel', style: { padding: '12px 14px' } }, [
        h('summary', {}, ['Recent audit and reliability events']),
        h('div', { class: 'audit-list', style: { marginTop: '10px' } }, (auditRows.length || obsRows.length) ? auditRows.concat(obsRows).slice(0, 12).map(ev => h('div', { class: 'audit-row' }, [
          h('strong', {}, [ev.action || ev.kind || 'event']),
          h('div', { class: 'muted' }, [new Date(ev.at || Date.now()).toLocaleString()])
        ])) : [h('div', { class: 'muted' }, ['No audit events yet.'])])
      ]));
      body.appendChild(h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
        h('button', { class: 'btn', on: { click: () => {
          const result = DB.repairIntegrity();
          toast(result.repaired ? `Repaired ${result.repaired} records` : 'No repair needed', result.repaired ? 'good' : 'info');
          render();
        } } }, ['Run integrity repair']),
        h('button', { class: 'btn', on: { click: () => {
          const pgn = DB.exportPgnBundle();
          if (!pgn.trim()) return toast('No repertoire lines to export yet', 'info');
          downloadText('openingos-repertoire-bundle.pgn', pgn, 'application/x-chess-pgn');
          toast('PGN bundle exported', 'good');
        } } }, ['Export PGN bundle']),
        h('button', { class: 'btn', on: { click: () => importBackupFile(render) } }, ['Import backup…']),
        h('button', { class: 'btn btn-primary', on: { click: () => {
          const snapshot = DB.exportAll ? DB.exportAll() : DB.exportSnapshot();
          DB.markBackupExported && DB.markBackupExported();
          const stamp = new Date().toISOString().slice(0, 10);
          downloadText(`openingos-full-backup-${stamp}.json`, JSON.stringify(snapshot, null, 2), 'application/json');
          toast('Full backup exported', 'good');
          render();
        } } }, ['Export full backup']),
      ]));
      m.panel.appendChild(body);
    }

    render();
  }

  function importBackupFile(onDone) {
    const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { input.remove(); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || '{}'));
          if (!confirm('Restore this backup into the active profile? Current data in this profile will be replaced.')) return;
          if (global.OOSData.importAll) global.OOSData.importAll(data); else global.OOSData.importSnapshot(data);
          toast('Backup restored', 'good');
          if (onDone) onDone();
          if (global.OOSApp && global.OOSApp.go) global.OOSApp.go('today');
        } catch (err) {
          toast(err.message || 'Invalid backup file', 'warn');
        } finally {
          input.remove();
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function showCoachPackageDialog(studentId) {
    patchDataLayer();
    const DB = global.OOSData;
    const students = DB.students ? DB.students() : [];
    const m = modal('Coach package', 'Export assignments and their lines as a portable file. Students can import it into their local OpeningOS profile.', { eyebrow: 'Coach workflow' });
    const select = h('select', { class: 'input' }, [h('option', { value: '' }, ['All students'])].concat(students.map(s => h('option', { value: s.id, selected: s.id === studentId }, [s.name]))));
    const file = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = DB.importCoachPackage(JSON.parse(String(reader.result || '{}')));
          toast(`Imported ${result.lines} lines and ${result.assignments} assignments`, 'good');
          m.close();
          if (global.OOSApp && global.OOSApp.go) global.OOSApp.go('coach');
        } catch (err) { toast(err.message || 'Could not import package', 'warn'); }
      };
      reader.readAsText(f);
    });
    m.panel.appendChild(h('label', { style: { display: 'block', marginTop: '12px' } }, [h('span', { class: 'label' }, ['Student']), select]));
    m.panel.appendChild(h('div', { class: 'panel', style: { marginTop: '12px', padding: '12px 14px' } }, ['For a backend SaaS version, coach packages become real student invitations and synced assignments. This local-first version uses portable files so coaches can still work reliably without accounts.']));
    m.panel.appendChild(h('div', { class: 'row', style: { marginTop: '14px', gap: '8px', justifyContent: 'flex-end' } }, [
      h('button', { class: 'btn', on: { click: () => m.close() } }, ['Close']),
      h('button', { class: 'btn', on: { click: () => file.click() } }, ['Import package…']),
      h('button', { class: 'btn btn-primary', on: { click: () => {
        const pkg = DB.exportCoachPackage(select.value || null);
        const name = (pkg.student && pkg.student.name) || 'all-students';
        downloadText(`openingos-coach-package-${safeFile(name)}.json`, JSON.stringify(pkg, null, 2), 'application/json');
        toast('Coach package exported', 'good');
      } } }, ['Export package']),
      file,
    ]));
  }

  function installStatusToasts() {
    let wired = false;
    function wire() {
      if (wired || !global.OOSApp) return;
      wired = true;
      window.addEventListener('online', () => toast('Back online', 'good'));
      window.addEventListener('offline', () => toast('Offline mode: local practice still works', 'warn'));
      setTimeout(() => {
        patchDataLayer();
        const DB = global.OOSData;
        if (!DB || !DB.healthReport) return;
        const report = DB.healthReport();
        const backupDue = report.issues.some(i => i.kind === 'backup-due');
        if (backupDue && (report.counts.lines || report.counts.games)) {
          toast('Backup recommended before serious use', 'warn');
        }
      }, 2500);
    }
    document.addEventListener('DOMContentLoaded', () => setTimeout(wire, 300));
    setTimeout(wire, 1000);
  }

  patchDataLayer();
  installStatusToasts();

  global.OOSProduction = {
    version: VERSION,
    patchDataLayer,
    showDataSafetyCenter,
    showCoachPackageDialog,
    humanBytes,
  };

  global.OOSViews = Object.assign(global.OOSViews || {}, {
    showDataSafetyCenter,
    showBackupRestore: showDataSafetyCenter,
    showCoachPackageDialog,
  });
})(window);
