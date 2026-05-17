/* OpeningOS — product-grade local features
 * Manual line creation/editing, backup/restore, line actions, and repair modals.
 * This layer intentionally stays local-first; BACKEND_MIGRATION.md covers the
 * SaaS backend path for auth/sync/coach sharing.
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
      else if (k === 'html') node.textContent = attrs[k];
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

  function closeModal(wrap) { if (wrap && wrap.parentNode) wrap.remove(); }

  function modal(title, subtitle, opts) {
    const wrap = h('div', { class: 'modal' });
    const back = h('div', { class: 'modal-back', on: { click: () => closeModal(wrap) } });
    const panel = h('div', { class: 'modal-panel product-modal' });
    panel.appendChild(h('div', { class: 'eyebrow' }, [opts && opts.eyebrow || 'OpeningOS']));
    panel.appendChild(h('h3', { style: { marginTop: '6px' } }, [title]));
    if (subtitle) panel.appendChild(h('p', { class: 'muted', style: { marginTop: '6px', fontSize: '13px' } }, [subtitle]));
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    return { wrap, panel, close: () => closeModal(wrap) };
  }

  function movesFromText(text) {
    return String(text || '')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/;[^\n]*/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\d+\.(?:\.\.)?/g, ' ')
      .replace(/1-0|0-1|1\/2-1\/2|\*/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function validateMoves(moves) {
    const chess = new global.Chess();
    const legal = [];
    for (let i = 0; i < moves.length; i++) {
      const before = chess.fen();
      const m = chess.move(moves[i], { sloppy: true });
      if (!m) return { ok: false, legal, badSan: moves[i], illegalAt: i + 1, fenBefore: before };
      legal.push(m.san);
    }
    return { ok: true, legal, finalFen: chess.fen() };
  }

  function trainableCount(moves, color) {
    const chess = new global.Chess();
    let n = 0;
    for (let i = 0; i < moves.length; i++) {
      if (chess.turn() === color) n++;
      if (!chess.move(moves[i], { sloppy: true })) break;
    }
    return n;
  }

  function showLineWizard(existingLine, onDone) {
    const DB = global.OOSData;
    const editing = existingLine && existingLine.id;
    const reps = DB.repertoires();
    const initialMoves = existingLine && existingLine.moves ? existingLine.moves.join(' ') : '';
    const m = modal(editing ? 'Edit repertoire line' : 'Create repertoire line',
      editing ? 'Change metadata or moves. Practice cards and notes are kept when possible.' : 'Add theory manually. Every move where it is your turn becomes a trainable card.',
      { eyebrow: editing ? 'Line editor' : 'Manual builder' });

    const form = h('div', { class: 'product-form' });
    const name = h('input', { class: 'input', type: 'text', placeholder: 'Line name, e.g. Caro-Kann Advance main line', value: existingLine?.name || '' });
    const eco = h('input', { class: 'input', type: 'text', placeholder: 'ECO, e.g. B12', value: existingLine?.eco || '?' });
    const opening = h('input', { class: 'input', type: 'text', placeholder: 'Opening family', value: existingLine?.opening || existingLine?.name || '' });
    const desc = h('textarea', { class: 'input', placeholder: 'Short description / source / practical note', rows: 2 });
    desc.value = existingLine?.description || '';
    const color = h('select', { class: 'input' }, [
      h('option', { value: 'w', selected: (existingLine?.color || 'w') === 'w' }, ['I play White']),
      h('option', { value: 'b', selected: existingLine?.color === 'b' }, ['I play Black']),
    ]);
    const rep = h('select', { class: 'input' }, reps.map(r => h('option', { value: r.id, selected: existingLine?.repId === r.id }, [r.name])));
    const tag = h('select', { class: 'input' }, [
      ['must-know','Must know'], ['nice-to-know','Nice to know'], ['surprise','Surprise weapon'],
      ['investigate','Investigate'], ['tournament','Tournament prep'], ['avoid','Avoid']
    ].map(([v,l]) => h('option', { value: v, selected: (existingLine?.tag || 'nice-to-know') === v }, [l])));
    const moves = h('textarea', { class: 'input mono', rows: 6, placeholder: 'Paste SAN moves: 1.e4 c6 2.d4 d5 3.e5 Bf5 ...' });
    moves.value = initialMoves;
    const status = h('div', { class: 'import-status muted' }, ['Enter moves to validate the line.']);

    const row1 = h('div', { class: 'product-grid two' }, [
      h('label', {}, [h('span', { class: 'label' }, ['Name']), name]),
      h('label', {}, [h('span', { class: 'label' }, ['ECO']), eco]),
      h('label', {}, [h('span', { class: 'label' }, ['Opening']), opening]),
      h('label', {}, [h('span', { class: 'label' }, ['Your color']), color]),
      h('label', {}, [h('span', { class: 'label' }, ['Folder']), rep]),
      h('label', {}, [h('span', { class: 'label' }, ['Priority']), tag]),
    ]);
    form.appendChild(row1);
    form.appendChild(h('label', {}, [h('span', { class: 'label' }, ['Description']), desc]));
    form.appendChild(h('label', {}, [h('span', { class: 'label' }, ['Moves']), moves]));
    form.appendChild(status);

    const validate = () => {
      const parsed = movesFromText(moves.value);
      if (!parsed.length) { status.textContent = 'No moves yet.'; status.className = 'import-status muted'; return null; }
      const v = validateMoves(parsed);
      if (!v.ok) {
        status.className = 'import-status bad';
        status.textContent = `Illegal move at ply ${v.illegalAt}: ${v.badSan}. Fix the move before saving.`;
        return null;
      }
      const cnt = trainableCount(v.legal, color.value);
      status.className = 'import-status good';
      status.textContent = `${v.legal.length} legal half-moves · ${cnt} trainable ${cnt === 1 ? 'card' : 'cards'} for ${color.value === 'w' ? 'White' : 'Black'}.`;
      return v.legal;
    };
    ['input', 'change'].forEach(ev => { moves.addEventListener(ev, validate); color.addEventListener(ev, validate); });

    const actions = h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } }, [
      h('button', { class: 'btn', on: { click: () => m.close() } }, ['Cancel']),
      editing ? h('button', { class: 'btn btn-danger', on: { click: () => {
        if (!confirm(`Delete "${existingLine.name}"? Games using it will become unmatched.`)) return;
        DB.deleteUserLine(existingLine.id);
        m.close();
        global.OOSApp.toast('Line deleted', 'good');
        global.OOSApp.go('repertoire');
      } } }, ['Delete']) : null,
      h('button', { class: 'btn btn-primary', on: { click: () => {
        const legal = validate();
        if (!legal) return;
        if (!name.value.trim()) { name.focus(); return global.OOSApp.toast('Give the line a name', 'warn'); }
        const payload = {
          name: name.value.trim(), eco: eco.value.trim() || '?', opening: opening.value.trim() || name.value.trim(),
          color: color.value, tag: tag.value, repId: rep.value, description: desc.value.trim(), moves: legal,
        };
        const saved = editing ? DB.updateUserLine(existingLine.id, payload) : DB.addUserLine(payload);
        m.close();
        global.OOSApp.toast(editing ? 'Line updated' : 'Line created', 'good');
        global.OOSApp.go('repertoire', { lineId: saved.id });
        if (onDone) onDone(saved);
      } } }, [editing ? 'Save changes' : 'Create line']),
    ]);
    m.panel.appendChild(form);
    m.panel.appendChild(actions);
    setTimeout(() => { name.focus(); validate(); }, 30);
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportLine(lineId) {
    const pgn = global.OOSData.exportLinePgn(lineId);
    if (!pgn) return global.OOSApp.toast('Could not export this line', 'warn');
    downloadText('openingos-line.pgn', pgn, 'application/x-chess-pgn');
    global.OOSApp.toast('Line PGN exported', 'good');
  }

  function showBackupRestore() {
    const DB = global.OOSData;
    const m = modal('Backup and restore', 'Export every local profile object you need to move devices or keep a safety copy.', { eyebrow: 'Data safety' });
    const file = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    const body = h('div', { class: 'stack', style: { marginTop: '14px' } }, [
      h('div', { class: 'panel', style: { padding: '12px 14px' } }, [
        h('strong', {}, ['Export includes: ']),
        'lines, games, notes, arrows, SRS, review events, students, assignments, settings, and local profile metadata.'
      ]),
      h('div', { class: 'row', style: { gap: '8px', justifyContent: 'flex-end' } }, [
        h('button', { class: 'btn', on: { click: () => m.close() } }, ['Close']),
        h('button', { class: 'btn', on: { click: () => file.click() } }, ['Import backup…']),
        h('button', { class: 'btn btn-primary', on: { click: () => {
          const snapshot = DB.exportAll ? DB.exportAll() : DB.exportSnapshot();
          downloadText('openingos-full-backup.json', JSON.stringify(snapshot, null, 2), 'application/json');
          global.OOSApp.toast('Full backup exported', 'good');
        } } }, ['Export full backup']),
      ]),
      file,
    ]);
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!confirm('Restore this backup into the current profile? Current local data in this profile will be replaced.')) return;
          if (DB.importAll) DB.importAll(data); else DB.importSnapshot(data);
          m.close();
          global.OOSApp.toast('Backup restored', 'good');
          global.OOSApp.go('today');
        } catch (err) { global.OOSApp.toast(err.message || 'Invalid backup', 'warn'); }
      };
      reader.readAsText(f);
    });
    m.panel.appendChild(body);
  }

  function showCompareMove(card, feedback) {
    const m = modal('Compare moves', 'Your move was legal. This view compares it with your saved repertoire move.', { eyebrow: 'Move comparison' });
    m.panel.appendChild(h('div', { class: 'dev-cmp', style: { marginTop: '14px' } }, [
      h('div', { class: 'col' }, [h('div', { class: 'lbl' }, ['Prepared']), h('div', { class: 'mv', style: { color: 'var(--good)' } }, [feedback.expected || card.move]), h('div', { class: 'muted mono', style: { fontSize: '11px' } }, [(feedback.expectedFen || '').split(' ').slice(0, 4).join(' ')])]),
      h('div', { class: 'col' }, [h('div', { class: 'lbl' }, ['Played']), h('div', { class: 'mv', style: { color: 'var(--warn)' } }, [feedback.played]), h('div', { class: 'muted mono', style: { fontSize: '11px' } }, [(feedback.playedFen || '').split(' ').slice(0, 4).join(' ')])]),
    ]));
    m.panel.appendChild(h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [
      h('button', { class: 'btn btn-primary', on: { click: () => m.close() } }, ['Close'])
    ]));
  }


  function repairDeviation(kind, gameId) {
    const DB = global.OOSData;
    const game = (DB.importedGames ? DB.importedGames() : []).find(g => g.id === gameId);
    if (!game) return global.OOSApp.toast('Game not found', 'warn');
    if (kind === 'line-from-game') {
      const line = DB.createLineFromGame ? DB.createLineFromGame(game.id) : null;
      if (!line) return global.OOSApp.toast('Could not create a line from this game', 'warn');
      global.OOSApp.toast('Line created from game', 'good');
      global.OOSApp.go('repertoire', { lineId: line.id });
      return;
    }
    global.OOSApp.toast('Repair action completed', 'good');
  }

  // Patch/extend public view helpers after views.js has created OOSViews.
  global.OOSViews = Object.assign(global.OOSViews || {}, {
    showLineWizard,
    exportLine,
    showBackupRestore,
    showCompareMove,
    repairDeviation,
  });
})(window);
