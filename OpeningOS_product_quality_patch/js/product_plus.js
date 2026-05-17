/* OpeningOS — product completion patch
 * Bridges the remaining UI actions to durable local-first behavior.
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
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info'); }
  function normSan(s) { return String(s || '').replace(/[+#?!]+/g, '').trim(); }
  function closeModal(wrap) { if (wrap && wrap.parentNode) wrap.remove(); }
  function modal(title, subtitle) {
    const wrap = h('div', { class: 'modal product-modal-shell' });
    const back = h('div', { class: 'modal-back', on: { click: () => closeModal(wrap) } });
    const panel = h('div', { class: 'modal-panel product-modal' });
    panel.appendChild(h('div', { class: 'eyebrow' }, ['OpeningOS']));
    panel.appendChild(h('h3', { style: { marginTop: '6px' } }, [title]));
    if (subtitle) panel.appendChild(h('p', { class: 'muted', style: { marginTop: '6px', fontSize: '13px' } }, [subtitle]));
    wrap.appendChild(back); wrap.appendChild(panel); document.body.appendChild(wrap);
    return { wrap, panel, close: () => closeModal(wrap) };
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
  function safeFile(s) { return String(s || 'line').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'line'; }

  function ensureDbAliases() {
    const DB = global.OOSData;
    if (!DB || DB.__plusAliases) return;
    DB.__plusAliases = true;
    DB.markConfusing = DB.markConfusing || function (cardId, on) {
      if (this.markCardConfusing) return this.markCardConfusing(cardId, on ? 'Marked during practice' : '');
      if (this.setConfusing) return this.setConfusing(cardId, on);
    };
    DB.isDeviationIgnored = DB.isDeviationIgnored || function (gameId, ply) {
      const st = this.gameStatus ? this.gameStatus(gameId) : (this.state.gameStatus || {})[gameId] || {};
      return !!(st.ignored || (st.ignoredDeviations || []).some(d => d.ply === ply));
    };
  }

  function showLineDialog(lineId) {
    const DB = global.OOSData; const line = DB.line(lineId); if (!line) return;
    const pgn = DB.exportLinePgn ? DB.exportLinePgn(lineId) : line.moves.join(' ');
    const m = modal('Full line', 'Review, copy, or export the exact mainline stored in your repertoire.');
    m.panel.appendChild(h('div', { class: 'panel mono product-pgn-box', style: { padding: '12px', marginTop: '12px', whiteSpace: 'pre-wrap' } }, [pgn]));
    m.panel.appendChild(h('div', { class: 'row', style: { marginTop: '14px', gap: '8px', justifyContent: 'flex-end' } }, [
      h('button', { class: 'btn', on: { click: () => { if (navigator.clipboard) navigator.clipboard.writeText(pgn); toast('PGN copied', 'good'); } } }, ['Copy PGN']),
      h('button', { class: 'btn', on: { click: () => exportLinePgn(lineId) } }, ['Export PGN']),
      h('button', { class: 'btn btn-primary', on: { click: () => m.close() } }, ['Close']),
    ]));
  }

  function quickNote(cardId) {
    const DB = global.OOSData; const card = DB.position(cardId); if (!card) return;
    const existing = DB.notesFor(cardId);
    const m = modal('Add note', `${card.name} · ${card.historyBefore || 'starting position'} → ${card.move}`);
    const type = h('select', { class: 'input' }, ['idea','warning','memory','plan','tactical','coach'].map(v => h('option', { value: v, selected: (existing.type || 'idea') === v }, [v])));
    const ta = h('textarea', { class: 'input', rows: 6, placeholder: 'What should future-you remember here?' });
    ta.value = existing.text || '';
    m.panel.appendChild(h('div', { class: 'product-grid two', style: { marginTop: '12px' } }, [
      h('label', {}, [h('span', { class: 'label' }, ['Type']), type]),
      h('label', {}, [h('span', { class: 'label' }, ['Position']), h('input', { class: 'input mono', disabled: true, value: card.fen })]),
    ]));
    m.panel.appendChild(h('label', {}, [h('span', { class: 'label' }, ['Note']), ta]));
    m.panel.appendChild(h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } }, [
      h('button', { class: 'btn', on: { click: () => m.close() } }, ['Cancel']),
      h('button', { class: 'btn btn-primary', on: { click: () => { DB.setNote(cardId, { type: type.value, text: ta.value }); m.close(); toast('Note saved', 'good'); } } }, ['Save note']),
    ]));
    setTimeout(() => ta.focus(), 50);
  }

  function acceptAlternate(cardId, san, fen) {
    const DB = global.OOSData;
    if (DB.addAlternateToCard) DB.addAlternateToCard(cardId, san, fen || '');
    else if (DB.addAlternate) DB.addAlternate(cardId, san);
    toast(`${san} accepted as an alternate`, 'good');
  }

  function compareMoves(card, fb) {
    if (global.OOSViews.showCompareMove) return global.OOSViews.showCompareMove(card, fb);
    const m = modal('Compare moves', 'Prepared move vs the move you played.');
    m.panel.appendChild(h('div', { class: 'dev-cmp', style: { marginTop: '14px' } }, [
      h('div', { class: 'col' }, [h('div', { class: 'lbl' }, ['Prepared']), h('div', { class: 'mv', style: { color: 'var(--good)' } }, [fb.expected || card.move]), h('div', { class: 'muted' }, [card.idea || 'Saved repertoire move'])]),
      h('div', { class: 'col' }, [h('div', { class: 'lbl' }, ['Played']), h('div', { class: 'mv', style: { color: 'var(--warn)' } }, [fb.played || '—']), h('div', { class: 'muted' }, ['Legal but outside saved prep'])]),
    ]));
    m.panel.appendChild(h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [h('button', { class: 'btn btn-primary', on: { click: () => m.close() } }, ['Close'])]));
  }

  function markConfusing(cardId) {
    ensureDbAliases();
    global.OOSData.markConfusing(cardId, true);
    toast('Marked as confusing and tracked for review.', 'good');
  }

  function practiceFromLinePly(lineId, currentPly) {
    const DB = global.OOSData;
    const cards = DB.cardsFromLine ? DB.cardsFromLine(lineId, currentPly) : DB.positionsForLine(lineId).filter(p => p.ply > currentPly);
    if (!cards || !cards.length) return toast('No trainable cards from here.', 'info');
    global.OOSViews.startSessionWith(cards);
  }

  function duplicateLineFlow(lineId) {
    const copy = global.OOSData.duplicateLine(lineId);
    if (!copy) return toast('Could not duplicate this line', 'warn');
    toast('Line duplicated', 'good');
    global.OOSApp.go('repertoire', { lineId: copy.id });
  }
  function deleteLineFlow(lineId) {
    const line = global.OOSData.line(lineId); if (!line) return;
    if (!confirm(`Delete "${line.name}" and its practice cards? Imported games will remain, but become unmatched.`)) return;
    global.OOSData.deleteUserLine(lineId);
    toast('Line deleted', 'good');
    global.OOSApp.go('repertoire');
  }
  function exportLinePgn(lineId) {
    const line = global.OOSData.line(lineId); if (!line) return;
    const pgn = global.OOSData.exportLinePgn ? global.OOSData.exportLinePgn(lineId) : line.moves.join(' ');
    downloadText(safeFile(line.name) + '.pgn', pgn, 'application/x-chess-pgn');
    toast('Line exported', 'good');
  }

  function repairDeviation(action, gameId, ply) {
    ensureDbAliases();
    const DB = global.OOSData;
    const game = DB.importedGames().find(g => g.id === gameId); if (!game) return;
    const dev = (DB.deviationsForGame(game).find(d => d.ply === ply) || DB.detectDeviationForGame(game));
    if (!dev) return toast('No active deviation to repair.', 'info');
    const card = DB.cardAtLinePly ? DB.cardAtLinePly(game.lineId, dev.ply) : DB.positionsForLine(game.lineId).find(p => p.ply === dev.ply);
    if (action === 'practice') {
      if (card) return global.OOSViews.startSessionWith([card]);
      return toast('No trainable card at this ply yet.', 'info');
    }
    if (action === 'alternate') {
      if (card && dev.played) {
        const ch = new global.Chess(); if (dev.fenBefore) ch.load(dev.fenBefore); const mv = ch.move(dev.played, { sloppy: true });
        if (DB.addAlternateToCard) DB.addAlternateToCard(card.id, dev.played, mv ? ch.fen() : '');
        else DB.addAlternate(card.id, dev.played);
        return toast('Deviation saved as an accepted alternate.', 'good');
      }
      const line = DB.createLineFromGame(gameId);
      if (line) { toast('Created a line from this game.', 'good'); return global.OOSApp.go('repertoire', { lineId: line.id }); }
    }
    if (action === 'ignore') {
      DB.ignoreDeviation(gameId, dev);
      toast('Deviation ignored for this game.', 'good');
      return global.OOSApp.go('games', { gameId });
    }
    if (action === 'line-from-game') {
      const line = DB.createLineFromGame(gameId);
      if (!line) return toast('Could not create a line from this game.', 'warn');
      toast('Line created from game.', 'good');
      return global.OOSApp.go('repertoire', { lineId: line.id });
    }
  }

  function exportBackup() {
    const DB = global.OOSData;
    const snapshot = DB.exportAll ? DB.exportAll() : DB.exportSnapshot();
    downloadText('openingos-full-backup.json', JSON.stringify(snapshot, null, 2), 'application/json');
    toast('Full backup exported', 'good');
  }
  function importBackup() {
    const input = h('input', { type: 'file', accept: 'application/json,.json' });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!confirm('Import this backup into the current profile? Current profile data will be replaced.')) return;
          if (global.OOSData.importAll) global.OOSData.importAll(data); else global.OOSData.importSnapshot(data);
          toast('Backup imported', 'good');
          global.OOSApp.go('today');
        } catch (err) { toast(err.message || 'Invalid backup file', 'warn'); }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function applyLiveSetting(key, value) {
    const root = document.documentElement;
    if (key === 'theme') root.setAttribute('data-theme', value);
    if (key === 'highContrast') root.setAttribute('data-contrast', value ? 'high' : 'normal');
    if (key === 'reducedMotion') root.setAttribute('data-reduced-motion', value ? 'true' : 'false');
    if (key === 'fontSize') root.setAttribute('data-fontsize', value || 'normal');
    if (key === 'boardSize') root.setAttribute('data-board-size', value || 'medium');
    if (key === 'piecesSet') root.setAttribute('data-pieces', value || 'classic');
    if (key === 'cbSafe') root.setAttribute('data-cb-safe', value ? 'true' : 'false');
    if (key === 'coords') root.setAttribute('data-coords', value === false ? 'false' : 'true');
    if (key === 'sound' && global.OOSAudio) global.OOSAudio.setEnabled(value === true);
  }

  const DB = global.OOSData;
  if (DB && !DB.__settingsPlus) {
    DB.__settingsPlus = true;
    const origSet = DB.setSetting.bind(DB);
    DB.setSetting = function (key, value) { origSet(key, value); applyLiveSetting(key, value); };
    const origInit = DB.init.bind(DB);
    DB.init = function () { origInit(); const s = this.settings(); Object.keys(s || {}).forEach(k => applyLiveSetting(k, s[k])); ensureDbAliases(); };
  }

  // Keyboard support for custom role=switch toggles.
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute('role') === 'switch' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); t.click();
    }
  });

  global.OOSViews = Object.assign(global.OOSViews || {}, {
    showLineDialog,
    quickNote,
    acceptAlternate,
    compareMoves,
    markConfusing,
    practiceFromLinePly,
    duplicateLineFlow,
    deleteLineFlow,
    exportLinePgn,
    repairDeviation,
    exportBackup,
    importBackup,
  });
})(window);
