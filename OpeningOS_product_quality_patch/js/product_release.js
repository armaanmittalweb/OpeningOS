/* OpeningOS — deployment and coach-pack release layer
 * Adds student-friendly deployment trust UX and coach/student assignment packs.
 */
(function (global) {
  'use strict';

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
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info'); }
  function safeFile(s) { return String(s || 'openingos').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'openingos'; }
  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function modal(title, subtitle) {
    const wrap = h('div', { class: 'modal' });
    const back = h('div', { class: 'modal-back', on: { click: () => wrap.remove() } });
    const panel = h('div', { class: 'modal-panel product-modal' });
    panel.appendChild(h('div', { class: 'eyebrow' }, ['OpeningOS release']));
    panel.appendChild(h('h3', { style: { marginTop: '6px' } }, [title]));
    if (subtitle) panel.appendChild(h('p', { class: 'muted', style: { marginTop: '6px', fontSize: '13px' } }, [subtitle]));
    wrap.appendChild(back); wrap.appendChild(panel); document.body.appendChild(wrap);
    return { wrap, panel, close: () => wrap.remove() };
  }

  function exportCoachPack(studentId) {
    const DB = global.OOSData;
    if (!DB || !DB.exportCoachPack) return toast('Coach pack export is unavailable.', 'warn');
    const pack = DB.exportCoachPack(studentId || null);
    if (!pack.assignments || !pack.assignments.length) return toast('Create at least one assignment before exporting a coach pack.', 'warn');
    const who = pack.student && pack.student.name ? '-' + safeFile(pack.student.name) : '';
    downloadText('openingos-coach-pack' + who + '.json', JSON.stringify(pack, null, 2), 'application/json');
    toast('Coach pack exported. Send the JSON file to the student.', 'good');
  }

  function importCoachPack() {
    const DB = global.OOSData;
    if (!DB || !DB.importCoachPack) return toast('Coach pack import is unavailable.', 'warn');
    const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { input.remove(); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const pack = JSON.parse(String(reader.result || '{}'));
          const res = DB.importCoachPack(pack);
          input.remove();
          toast(`Imported ${res.lines.length} line(s) and ${res.assignments.length} assignment(s).`, 'good');
          if (global.OOSApp) global.OOSApp.go('today');
        } catch (err) {
          input.remove(); toast(err.message || 'Invalid coach pack.', 'warn');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function showTrustCenter() {
    const m = modal('Trust, privacy, and deployment status', 'This hosted build is designed as a reliable local-first product alpha. Your private prep stays in the browser unless you export/import files yourself.');
    const rows = [
      ['Private by default', 'Repertoires, notes, games, coach packs, and SRS progress are stored locally in this browser profile.'],
      ['Deployable on GitHub Pages', 'The repository includes CI checks and a Pages workflow. Push to main to publish.'],
      ['Coach/student without backend', 'Coach packs export assignments and referenced lines as JSON so students can import them independently.'],
      ['Backups matter', 'Use Settings → Backup / Restore before clearing browser data or changing devices.'],
      ['Backend-ready path', 'BACKEND_MIGRATION.md documents the SaaS upgrade for auth, cloud sync, teams, permissions, and billing.'],
    ];
    m.panel.appendChild(h('div', { class: 'stack', style: { marginTop: '14px' } }, rows.map(([title, body]) =>
      h('div', { class: 'trust-row' }, [h('strong', {}, [title]), h('span', {}, [body])])
    )));
    m.panel.appendChild(h('div', { class: 'row', style: { marginTop: '16px', justifyContent: 'flex-end', gap: '8px' } }, [
      h('button', { class: 'btn', on: { click: () => { if (global.OOSViews && global.OOSViews.showBackupRestore) global.OOSViews.showBackupRestore(); } } }, ['Backup / Restore']),
      h('button', { class: 'btn btn-primary', on: { click: () => m.close() } }, ['Done']),
    ]));
  }

  function appendAssignmentCard(app) {
    const DB = global.OOSData;
    if (!DB || !DB.activeAssignments) return;
    const assignment = DB.activeAssignments().find(a => a.studentId === 'self' || a.source === 'coach-pack');
    if (!assignment) return;
    const line = DB.line(assignment.lineId);
    if (!line) return;
    const target = app.querySelector('.today-grid');
    if (!target || target.querySelector('[data-assignment-card="true"]')) return;
    const card = h('div', { class: 'card today-card span-6 action-card assignment-card', 'data-assignment-card': 'true', on: { click: () => {
      const cards = DB.cardsForAssignment ? DB.cardsForAssignment(assignment.id) : DB.positionsForLine(line.id);
      if (global.OOSViews && global.OOSViews.startSessionWith) global.OOSViews.startSessionWith(cards, { mode: 'daily' });
    } } }, [
      h('div', { class: 'ac-head' }, [h('div', { class: 'icon' }, ['🎓']), h('span', { class: 'pill pill-info' }, ['Coach assigned'])]),
      h('div', {}, [
        h('div', { class: 'eyebrow' }, ['Assigned work']),
        h('div', { class: 'ac-title' }, [line.name]),
        h('div', { class: 'ac-meta', style: { marginTop: '6px' } }, [`${assignment.mode || 'Learn + Review'} · due ${assignment.due || 'No deadline'}`]),
        assignment.message ? h('div', { class: 'ac-meta', style: { marginTop: '2px' } }, [assignment.message]) : null,
      ]),
      h('div', { class: 'ac-cta' }, [h('span', {}, ['Start assignment']), h('span', {}, ['→'])]),
    ]);
    target.insertBefore(card, target.firstChild);
  }

  function appendCoachPackPanel(app) {
    const root = app.firstElementChild;
    if (!root || root.querySelector('.coach-pack-panel')) return;
    const students = global.OOSData.students ? global.OOSData.students() : [];
    const assignments = global.OOSData.assignments ? global.OOSData.assignments() : [];
    const panel = h('div', { class: 'card coach-pack-panel', style: { marginBottom: '18px' } }, [
      h('div', { class: 'row-between' }, [
        h('div', {}, [
          h('div', { class: 'eyebrow' }, ['Coach pack exchange']),
          h('h3', { style: { marginTop: '4px' } }, ['Share assignments without a backend']),
          h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } }, ['Export a JSON pack containing assigned lines and notes. The student imports it from the command palette or this screen.']),
        ]),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
          h('button', { class: 'btn btn-sm', on: { click: () => importCoachPack() } }, ['Import coach pack']),
          h('button', { class: 'btn btn-sm btn-primary', disabled: assignments.length === 0, on: { click: () => exportCoachPack(students[0] && students[0].id) } }, ['Export pack']),
        ]),
      ]),
    ]);
    root.insertBefore(panel, root.children[1] || null);
  }

  function installViewWrappers() {
    if (!global.OOSViews || global.OOSViews.__releaseWrapped) return;
    global.OOSViews.__releaseWrapped = true;
    const origToday = global.OOSViews.renderToday;
    const origCoach = global.OOSViews.renderCoach;
    global.OOSViews.renderToday = function (app) { origToday(app); appendAssignmentCard(app); };
    global.OOSViews.renderCoach = function (app) { origCoach(app); appendCoachPackPanel(app); };
  }

  // Expose tools before app.js boots; install wrappers on DOMContentLoaded too.
  global.OOSViews = Object.assign(global.OOSViews || {}, {
    exportCoachPack,
    importCoachPack,
    showTrustCenter,
  });
  installViewWrappers();
  document.addEventListener('DOMContentLoaded', installViewWrappers);
})(window);
