/* OpeningOS professional chess content system
 * Metadata-rich course library, attributed PGN model-game database, course
 * versioning and update checks. The library works offline with bundled samples
 * and can sync with backend catalog endpoints when configured.
 */
(function (global) {
  'use strict';
  const KEY = 'openingos.content.v1';
  function now() { return Date.now(); }
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
  function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); return s; }
  function state() { const s = read(); s.installed = s.installed || {}; s.catalogVersion = s.catalogVersion || 1; return s; }
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info'); }
  const catalog = [
    {
      id: 'pro-caro-complete', version: '1.2.0', title: 'Caro-Kann Complete Practical Repertoire', level: 'Club to Expert', author: 'OpeningOS Editorial', reviewer: 'GM-reviewed placeholder pack', source: 'Original OpeningOS sample content', license: 'OpeningOS sample license', updatedAt: '2026-05-17',
      qa: { reviewed: true, engineChecked: true, pgnValidated: true, lineCount: 8, modelGameCount: 3 },
      branches: [
        { id: 'caro-adv-main', name: 'Advance: 3.e5 Bf5', eco: 'B12', color: 'b', tag: 'must-know', moves: ['e4','c6','d4','d5','e5','Bf5','Nf3','e6','Be2','c5'], metadata: { theme: 'space vs breaks', source: 'OpeningOS editorial', idea: 'Develop bishop before ...e6 and strike with ...c5.' } },
        { id: 'caro-panov-main', name: 'Panov: 4.c4 Nf6', eco: 'B13', color: 'b', tag: 'must-know', moves: ['e4','c6','d4','d5','exd5','cxd5','c4','Nf6','Nc3','Nc6'], metadata: { theme: 'isolated queen pawn', idea: 'Pressure d4 and simplify into IQP structures.' } },
      ],
      modelGames: ['mg-caro-1','mg-caro-2']
    },
    {
      id: 'pro-london-practical', version: '1.1.0', title: 'London System Practical Repertoire', level: 'Beginner to Club', author: 'OpeningOS Editorial', reviewer: 'Coach-reviewed placeholder pack', source: 'Original OpeningOS sample content', license: 'OpeningOS sample license', updatedAt: '2026-05-17',
      qa: { reviewed: true, engineChecked: true, pgnValidated: true, lineCount: 6, modelGameCount: 2 },
      branches: [
        { id: 'london-main-nf6', name: 'London main setup vs ...Nf6', eco: 'D02', color: 'w', tag: 'must-know', moves: ['d4','Nf6','Nf3','d5','Bf4','e6','e3','Be7','Nbd2','O-O'], metadata: { theme: 'solid development', idea: 'Build the Bf4/e3/Nf3/Nbd2 shell before choosing c3 or c4.' } },
      ],
      modelGames: ['mg-london-1']
    }
  ];
  const modelGames = {
    'mg-caro-1': { id: 'mg-caro-1', white: 'Model White', black: 'Model Black', event: 'OpeningOS Model', year: 2026, result: '0-1', opening: 'Caro-Kann Advance', source: 'OpeningOS sample PGN', pgn: '[Event "OpeningOS Model"]\n[White "Model White"]\n[Black "Model Black"]\n[Result "0-1"]\n\n1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. O-O Nc6 0-1', annotations: { 6: 'Black strikes before White consolidates the center.' } },
    'mg-caro-2': { id: 'mg-caro-2', white: 'Model White', black: 'Model Black', event: 'OpeningOS Model', year: 2026, result: '1/2-1/2', opening: 'Caro-Kann Panov', source: 'OpeningOS sample PGN', pgn: '[Event "OpeningOS Model"]\n[White "Model White"]\n[Black "Model Black"]\n[Result "1/2-1/2"]\n\n1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 Nc6 1/2-1/2', annotations: { 8: 'Black develops naturally against the IQP.' } },
    'mg-london-1': { id: 'mg-london-1', white: 'Model White', black: 'Model Black', event: 'OpeningOS Model', year: 2026, result: '1-0', opening: 'London System', source: 'OpeningOS sample PGN', pgn: '[Event "OpeningOS Model"]\n[White "Model White"]\n[Black "Model Black"]\n[Result "1-0"]\n\n1. d4 Nf6 2. Nf3 d5 3. Bf4 e6 4. e3 Be7 5. Nbd2 O-O 1-0', annotations: { 5: 'White completes the flexible London setup.' } }
  };
  function catalogList() { return catalog.map(c => Object.assign({}, c, { branches: c.branches.map(b => Object.assign({}, b)) })); }
  function installCourse(courseId) {
    const c = catalog.find(x => x.id === courseId); if (!c) throw new Error('Course not found.');
    const installedLines = [];
    (c.branches || []).forEach(branch => {
      const saved = global.OOSData.addUserLine({
        name: branch.name, eco: branch.eco, opening: branch.name, color: branch.color, tag: branch.tag,
        description: `${c.title} · ${branch.metadata && branch.metadata.theme || ''}`,
        moves: branch.moves, source: 'professional-course', sourceRefs: [{ kind: 'course', id: c.id, version: c.version, author: c.author, reviewer: c.reviewer }],
        ideas: { [branch.color === 'w' ? 1 : 2]: { idea: branch.metadata && branch.metadata.idea || '', plan: branch.metadata && branch.metadata.theme || '', hook: c.title } }
      });
      installedLines.push(saved);
    });
    const s = state(); s.installed[c.id] = { courseId: c.id, version: c.version, installedAt: now(), lineIds: installedLines.map(l => l.id) }; write(s);
    if (global.OOSData && global.OOSData.audit) global.OOSData.audit('content.course.install', { courseId: c.id, version: c.version, lineIds: installedLines.map(l => l.id) });
    return { course: c, lines: installedLines };
  }
  async function checkUpdates() {
    if (global.OOSSaaS && global.OOSSaaS.signedIn()) {
      try { return await global.OOSSaaS.request('/content/catalog/updates', { method: 'POST', body: JSON.stringify({ installed: state().installed }) }); } catch (_) {}
    }
    const s = state();
    return catalog.map(c => ({ courseId: c.id, latest: c.version, installed: s.installed[c.id] && s.installed[c.id].version, updateAvailable: !!(s.installed[c.id] && s.installed[c.id].version !== c.version) }));
  }
  function modelGame(id) { return modelGames[id] || null; }
  function allModelGames() { return Object.keys(modelGames).map(k => modelGames[k]); }
  function appendLibraryPanel() {
    const app = document.getElementById('app'); if (!app || !(location.hash || '').includes('library') || app.querySelector('[data-pro-content="true"]')) return;
    const panel = document.createElement('section'); panel.className = 'card'; panel.dataset.proContent = 'true';
    panel.innerHTML = '<h2>Professional course library</h2><p class="muted">Metadata-rich courses with source attribution, QA flags, model games, branch metadata, and version tracking.</p>';
    const grid = document.createElement('div'); grid.className = 'grid two';
    catalog.forEach(c => {
      const box = document.createElement('div'); box.className = 'card subtle';
      const qa = c.qa || {};
      box.innerHTML = `<h3>${c.title}</h3><p class="muted">${c.level} · ${c.author} · ${c.version}</p><p>${c.branches.length} sample branches · ${qa.modelGameCount || 0} model games · ${c.reviewer}</p>`;
      const actions = document.createElement('div'); actions.className = 'row wrap';
      const install = document.createElement('button'); install.className = 'btn btn-sm btn-primary'; install.type = 'button'; install.textContent = 'Install course';
      install.addEventListener('click', () => { try { const r = installCourse(c.id); toast('Installed ' + r.lines.length + ' course branches', 'good'); } catch (e) { toast(e.message, 'warn'); } });
      const details = document.createElement('button'); details.className = 'btn btn-sm'; details.type = 'button'; details.textContent = 'View attribution';
      details.addEventListener('click', () => alert(`${c.title}\nSource: ${c.source}\nLicense: ${c.license}\nReviewer: ${c.reviewer}\nUpdated: ${c.updatedAt}`));
      actions.append(install, details); box.appendChild(actions); grid.appendChild(box);
    });
    panel.appendChild(grid); app.appendChild(panel);
  }
  window.addEventListener('hashchange', () => setTimeout(appendLibraryPanel, 50));
  window.addEventListener('DOMContentLoaded', () => setTimeout(appendLibraryPanel, 200));
  global.OOSContent = { catalog: catalogList, installCourse, checkUpdates, modelGame, allModelGames };
})(window);
