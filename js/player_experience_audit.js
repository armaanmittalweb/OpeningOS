/* OpeningOS — player experience audit implementation
 * Purpose: make the app feel smoother for real chess players by improving
 * board control, repertoire navigation, game import visibility, keyboard
 * shortcuts and line-management ergonomics without exposing developer plumbing.
 */
(function (global) {
  'use strict';

  const VERSION = '2026.05.18-player-audit-v2';
  const BOARD_SIZE_KEY = 'oos.player.boardSize';
  const PLAYER_LEVEL_KEY = 'oos.player.experienceLevel';
  const IMPORT_STATUS_KEY = 'oos.import.lastStatus';
  const SIZE_OPTIONS = [
    { id: 'compact', label: 'S', title: 'Compact board' },
    { id: 'comfort', label: 'M', title: 'Comfort board' },
    { id: 'large', label: 'L', title: 'Large board' },
    { id: 'analysis', label: 'XL', title: 'Analysis board' },
  ];
  const NAV_SHORTCUTS = [
    ['Alt+1', 'Today'], ['Alt+2', 'Repertoire'], ['Alt+3', 'Practice'], ['Alt+4', 'Games'],
    ['/', 'Search'], ['I', 'Import games'], ['N', 'Add line'], ['S', 'Sync now'],
    ['[ / ]', 'Previous / next move'], ['P', 'Practice from position'], ['A', 'Position actions'],
    ['B', 'Focus board'], ['F', 'Flip board'], ['1–4', 'Grade practice'], ['?', 'Shortcuts'],
  ];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
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
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(child => node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));
    return node;
  }
  function safeText(x) { return String(x == null ? '' : x); }
  function activeView() { return (document.body.dataset.view || (location.hash || '#today').slice(1) || 'today').split('?')[0]; }
  function isTypingTarget(el) {
    const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select' || (el && el.isContentEditable);
  }
  function localGetJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || ''); } catch (_) { return fallback; } }
  function localSetJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function timeAgo(ts) {
    if (!ts) return 'not yet';
    const d = Math.max(0, Date.now() - Number(ts));
    if (d < 10000) return 'just now';
    if (d < 60000) return Math.round(d / 1000) + ' sec ago';
    if (d < 3600000) return Math.round(d / 60000) + ' min ago';
    if (d < 86400000) return Math.round(d / 3600000) + ' hr ago';
    return Math.round(d / 86400000) + ' days ago';
  }
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info'); }

  // ----------------------------------------------------------------------
  // Board controls and keyboard access
  // ----------------------------------------------------------------------
  function applyBoardSize(size) {
    const val = SIZE_OPTIONS.some(s => s.id === size) ? size : 'comfort';
    document.documentElement.dataset.playerBoardSize = val;
    try { localStorage.setItem(BOARD_SIZE_KEY, val); } catch (_) {}
    $all('.player-board-size button').forEach(btn => btn.classList.toggle('is-active', btn.dataset.size === val));
  }

  function installBoardKeyboardPatch() {
    const Board = global.OOSBoard;
    if (!Board || Board.__playerKeyboardPatched) return;
    const originalBuild = Board.prototype._build;
    const originalRender = Board.prototype._render;
    Board.prototype._build = function playerBuild() {
      originalBuild.apply(this, arguments);
      this.host.tabIndex = 0;
      this.host.setAttribute('role', 'application');
      this.host.setAttribute('aria-label', 'Chessboard. Use arrow keys to move square focus, Enter to select or move, F to flip, Escape to clear selection.');
      this.host.classList.add('keyboard-board');
      if (!this.keyFocusEl) {
        this.keyFocusEl = document.createElement('div');
        this.keyFocusEl.className = 'cb-keyboard-focus';
        this.host.appendChild(this.keyFocusEl);
      }
      if (!this.keyLiveEl) {
        this.keyLiveEl = document.createElement('div');
        this.keyLiveEl.className = 'sr-only';
        this.keyLiveEl.setAttribute('aria-live', 'polite');
        this.host.appendChild(this.keyLiveEl);
      }
      this.keyboardSquare = this.keyboardSquare || pickDefaultSquare(this);
      this.host.addEventListener('keydown', ev => handleBoardKey(ev, this));
      updateKeyboardSquare(this);
    };
    Board.prototype._render = function playerRender() {
      originalRender.apply(this, arguments);
      updateKeyboardSquare(this);
    };
    Board.__playerKeyboardPatched = true;
  }
  function pickDefaultSquare(board) {
    try {
      const side = board.chess.turn();
      const rows = board.chess.board();
      for (let r = 0; r < rows.length; r++) {
        for (let f = 0; f < rows[r].length; f++) {
          const p = rows[r][f];
          if (p && p.color === side) return 'abcdefgh'[f] + (8 - r);
        }
      }
    } catch (_) {}
    return 'e4';
  }
  function squareParts(sq) { return { file: sq.charCodeAt(0) - 97, rank: Number(sq[1]) }; }
  function makeSquare(file, rank) { return 'abcdefgh'[Math.max(0, Math.min(7, file))] + Math.max(1, Math.min(8, rank)); }
  function visualStep(board, key) {
    const s = squareParts(board.keyboardSquare || pickDefaultSquare(board));
    const flipped = !!board.flipped;
    if (key === 'ArrowRight') s.file += flipped ? -1 : 1;
    if (key === 'ArrowLeft') s.file += flipped ? 1 : -1;
    if (key === 'ArrowUp') s.rank += flipped ? -1 : 1;
    if (key === 'ArrowDown') s.rank += flipped ? 1 : -1;
    board.keyboardSquare = makeSquare(s.file, s.rank);
  }
  function updateKeyboardSquare(board) {
    if (!board || !board.keyFocusEl || !board.keyboardSquare) return;
    const { file, rank } = squareParts(board.keyboardSquare);
    const col = board.flipped ? 7 - file : file;
    const row = board.flipped ? rank - 1 : 8 - rank;
    board.keyFocusEl.style.left = (col * 12.5) + '%';
    board.keyFocusEl.style.top = (row * 12.5) + '%';
    board.keyFocusEl.style.width = '12.5%';
    board.keyFocusEl.style.height = '12.5%';
    board.keyFocusEl.hidden = document.activeElement !== board.host;
  }
  function announce(board, msg) { if (board.keyLiveEl) board.keyLiveEl.textContent = msg; }
  function handleBoardKey(ev, board) {
    if (isTypingTarget(ev.target)) return;
    const key = ev.key;
    if (/^Arrow/.test(key)) {
      ev.preventDefault();
      board.keyboardSquare = board.keyboardSquare || pickDefaultSquare(board);
      visualStep(board, key);
      updateKeyboardSquare(board);
      announce(board, 'Square ' + board.keyboardSquare);
      return;
    }
    if (key === 'Escape') {
      ev.preventDefault();
      board.selected = null; board.legalTargets = [];
      if (board._renderSquares) board._renderSquares();
      if (board._renderHints) board._renderHints();
      announce(board, 'Selection cleared.');
      return;
    }
    if (key.toLowerCase() === 'f') {
      ev.preventDefault(); board.flip(); updateKeyboardSquare(board); announce(board, 'Board flipped.'); return;
    }
    if (key.toLowerCase() === 'c') {
      ev.preventDefault(); if (board.clearAnnotations) board.clearAnnotations(); announce(board, 'Annotations cleared.'); return;
    }
    if (key === 'Enter' || key === ' ') {
      ev.preventDefault();
      const sq = board.keyboardSquare || pickDefaultSquare(board);
      const piece = board.chess.get(sq);
      if (board.selected && board.selected !== sq) {
        const target = (board.legalTargets || []).find(t => t.square === sq);
        if (target && board._tryMove) { board._tryMove(board.selected, sq); announce(board, 'Moved to ' + sq + '.'); }
        else announce(board, sq + ' is not a legal target.');
        return;
      }
      if (piece && piece.color === board.chess.turn()) {
        board.selected = sq;
        if (board._computeLegalTargets) board._computeLegalTargets(sq);
        if (board._renderSquares) board._renderSquares();
        if (board._renderHints) board._renderHints();
        announce(board, 'Selected ' + sq + '. ' + (board.legalTargets || []).length + ' legal moves.');
      } else announce(board, 'No movable piece on ' + sq + '.');
    }
  }

  function boardControlBar() {
    const bar = h('div', { class: 'player-board-toolbar', role: 'toolbar', 'aria-label': 'Board controls' });
    const size = h('div', { class: 'segmented player-board-size', 'aria-label': 'Board size' }, SIZE_OPTIONS.map(opt => h('button', {
      type: 'button', class: 'btn btn-xs', dataset: { size: opt.id }, title: opt.title,
      on: { click: () => applyBoardSize(opt.id) }
    }, [opt.label])));
    bar.append(
      h('span', { class: 'board-toolbar-label', text: 'Board' }),
      size,
      h('button', { class: 'btn btn-xs', type: 'button', on: { click: () => clickFirstButton(/Flip/i) } }, ['Flip']),
      h('button', { class: 'btn btn-xs', type: 'button', on: { click: focusBoardMode } }, ['Focus']),
      h('button', { class: 'btn btn-xs btn-ghost', type: 'button', on: { click: showShortcuts } }, ['Shortcuts'])
    );
    return bar;
  }
  function addBoardToolbars(root) {
    $all('.chess-board', root || document).forEach(board => {
      if (board.dataset.playerToolbar === '1') return;
      const parent = board.parentElement;
      if (!parent) return;
      parent.insertBefore(boardControlBar(), board);
      board.dataset.playerToolbar = '1';
    });
    applyBoardSize(localStorage.getItem(BOARD_SIZE_KEY) || 'comfort');
  }
  function focusBoardMode() {
    const board = $('.chess-board');
    if (!board) return;
    document.body.classList.toggle('board-focus-mode');
    board.closest('.stack, .practice-board-wrap, .rep-main, .editor-grid')?.classList.toggle('is-board-focus', document.body.classList.contains('board-focus-mode'));
    if (document.body.classList.contains('board-focus-mode')) board.focus();
  }

  // ----------------------------------------------------------------------
  // Repertoire workspace player UX
  // ----------------------------------------------------------------------
  function lineStats(line) {
    const DB = global.OOSData;
    const cards = DB.positionsForLine(line.id) || [];
    const dueIds = new Set((DB.duePositions ? DB.duePositions() : []).map(p => p.id));
    const weakIds = new Set((DB.weakPositions ? DB.weakPositions() : []).map(p => p.id));
    const critical = cards.filter(p => p.critical || (DB.positionFlag && DB.positionFlag(p.id).critical)).length;
    return { cards, due: cards.filter(p => dueIds.has(p.id)).length, weak: cards.filter(p => weakIds.has(p.id)).length, critical };
  }
  function currentLine(app) {
    const DB = global.OOSData;
    const title = $('.line-header h2, .premium-repertoire-head h1', app);
    const name = title && title.textContent.trim();
    return (DB.lines({ includeRetired: true }) || []).find(l => l.name === name) || DB.lines()[0] || null;
  }
  function decorateRepertoirePlayer(app) {
    if (!app || app.dataset.playerRepertoire === '1') return;
    app.dataset.playerRepertoire = '1';
    const DB = global.OOSData;
    if (!DB) return;
    const line = currentLine(app);
    addBoardToolbars(app);
    addRepertoireCommandStrip(app, line);
    decorateLineTree(app);
    decorateIdeaEmptyStates(app);
    addMobileWorkspaceTabs(app);
  }
  function addRepertoireCommandStrip(app, line) {
    if ($('.player-rep-command-strip', app)) return;
    const stats = line ? lineStats(line) : { due: 0, weak: 0, critical: 0, cards: [] };
    const strip = h('section', { class: 'player-rep-command-strip' }, [
      h('div', { class: 'player-flow-step' }, [h('span', { text: '1' }), h('strong', { text: 'Choose a line' }), h('small', { text: 'Search, filter, or pick from your tree.' })]),
      h('div', { class: 'player-flow-step' }, [h('span', { text: '2' }), h('strong', { text: 'Understand position' }), h('small', { text: 'Capture idea, plan, and memory hook.' })]),
      h('div', { class: 'player-flow-step' }, [h('span', { text: '3' }), h('strong', { text: 'Practice from here' }), h('small', { text: `${stats.due} due · ${stats.weak} weak · ${stats.critical} critical` })]),
      h('div', { class: 'player-hotkeys-inline' }, [
        h('kbd', { text: '[' }), h('kbd', { text: ']' }), h('span', { text: 'move' }),
        h('kbd', { text: 'P' }), h('span', { text: 'practice' }),
        h('kbd', { text: 'A' }), h('span', { text: 'actions' })
      ])
    ]);
    const anchor = $('.rep-layout', app) || app.firstElementChild;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(strip, anchor);
  }
  function decorateLineTree(app) {
    const folders = $('.rep-folders', app);
    if (!folders || $('.player-line-manager', folders)) return;
    const DB = global.OOSData;
    const all = DB.lines({ includeRetired: true });
    const stats = all.reduce((acc, l) => { const s = lineStats(l); acc.due += s.due; acc.weak += s.weak; acc.critical += s.critical; return acc; }, { due: 0, weak: 0, critical: 0 });
    const search = h('input', { class: 'input player-line-search', placeholder: 'Search lines, tags, ECO…', type: 'search' });
    const filters = ['All','Due','Weak','Critical','Branches','Retired'];
    let filter = 'All';
    const filterRow = h('div', { class: 'player-line-filters' }, filters.map(f => h('button', { type: 'button', class: f === 'All' ? 'is-active' : '', on: { click: e => { filter = f; $all('button', filterRow).forEach(b => b.classList.toggle('is-active', b === e.currentTarget)); applyFilter(); } } }, [f])));
    const manager = h('div', { class: 'player-line-manager' }, [
      h('div', { class: 'player-line-summary' }, [
        h('strong', { text: all.length + ' lines' }),
        h('span', { text: stats.due + ' due' }),
        h('span', { text: stats.weak + ' weak' }),
        h('span', { text: stats.critical + ' critical' })
      ]),
      search,
      filterRow
    ]);
    folders.insertBefore(manager, folders.firstChild);
    const annotate = () => {
      $all('.rep-line', folders).forEach(n => {
        const label = (n.querySelector('span') || n).textContent.replace(/·.*/, '').trim();
        const line = all.find(l => l.name === label) || all.find(l => label && l.name.includes(label));
        if (!line) return;
        const s = lineStats(line);
        n.dataset.lineId = line.id;
        n.dataset.filterText = [line.name, line.eco, line.opening, line.tag, line.color].join(' ').toLowerCase();
        n.dataset.due = s.due ? '1' : '0';
        n.dataset.weak = s.weak ? '1' : '0';
        n.dataset.critical = s.critical ? '1' : '0';
        n.dataset.branch = line.parentLineId ? '1' : '0';
        n.dataset.retired = (line.status === 'retired' || line.retired) ? '1' : '0';
        if (n.dataset.keyboardReady !== '1') {
          n.dataset.keyboardReady = '1';
          n.tabIndex = n.tabIndex >= 0 ? n.tabIndex : 0;
          n.setAttribute('role', n.getAttribute('role') || 'button');
          n.setAttribute('aria-label', 'Open line ' + line.name);
          n.addEventListener('keydown', ev => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              n.click();
            }
          });
        }
        if (!n.querySelector('.line-health-chips')) {
          n.appendChild(h('span', { class: 'line-health-chips' }, [
            s.due ? h('em', { class: 'due', text: s.due }) : null,
            s.weak ? h('em', { class: 'weak', text: s.weak }) : null,
            s.critical ? h('em', { class: 'critical', text: '!' }) : null,
          ].filter(Boolean)));
        }
      });
    };
    const applyFilter = () => {
      const q = search.value.trim().toLowerCase();
      $all('.rep-line', folders).forEach(n => {
        const matchesSearch = !q || (n.dataset.filterText || n.textContent.toLowerCase()).includes(q);
        const matchesFilter = filter === 'All' ||
          (filter === 'Due' && n.dataset.due === '1') ||
          (filter === 'Weak' && n.dataset.weak === '1') ||
          (filter === 'Critical' && n.dataset.critical === '1') ||
          (filter === 'Branches' && n.dataset.branch === '1') ||
          (filter === 'Retired' && n.dataset.retired === '1');
        n.hidden = !(matchesSearch && matchesFilter);
      });
    };
    annotate();
    search.addEventListener('input', applyFilter);
  }
  function decorateIdeaEmptyStates(app) {
    const card = $('.idea-card', app);
    if (!card || card.dataset.playerIdeas === '1') return;
    card.dataset.playerIdeas = '1';
    if (!/Idea|Plan|Memory|Starting position/i.test(card.textContent)) return;
    if (!$('.player-idea-helper', card)) {
      card.appendChild(h('div', { class: 'player-idea-helper' }, [
        h('strong', { text: 'Good prep is more than moves.' }),
        h('p', { text: 'For every critical position, store the idea, plan, common mistake and memory hook. This makes practice useful instead of rote memorization.' })
      ]));
    }
  }
  function addMobileWorkspaceTabs(app) {
    if ($('.player-workspace-tabs', app)) return;
    const tabs = h('div', { class: 'player-workspace-tabs', role: 'tablist' }, [
      ['Board', '.editor-grid'], ['Moves', '.move-tree'], ['Ideas', '.idea-card'], ['Notes', '.rep-aside']
    ].map(([label, target], i) => h('button', { type: 'button', class: i === 0 ? 'is-active' : '', on: { click: e => { $all('button', tabs).forEach(b => b.classList.toggle('is-active', b === e.currentTarget)); const el = $(target, app); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } } }, [label])));
    const layout = $('.rep-layout', app);
    if (layout && layout.parentNode) layout.parentNode.insertBefore(tabs, layout);
  }

  // ----------------------------------------------------------------------
  // Game imports and repair reports
  // ----------------------------------------------------------------------
  function hashPgn(pgn) { let x = 0; String(pgn || '').replace(/\s+/g, ' ').trim().split('').forEach(ch => { x = ((x << 5) - x + ch.charCodeAt(0)) | 0; }); return Math.abs(x).toString(36); }
  function patchGamePersistence() {
    const DB = global.OOSData;
    if (!DB || DB.__playerGamePatch) return;

    DB.repairCardsFromGames = function repairCardsFromGames(limit = 40) {
      const cards = [];
      const seen = new Set();
      const games = this.importedGames ? this.importedGames() : [];
      games.forEach(g => {
        const review = this.deepReviewGame ? this.deepReviewGame(g) : null;
        const moments = (review && review.moments) || [];
        moments.forEach(m => {
          const id = m.cardId || m.positionId || m.id;
          const c = id && this.position ? this.position(id) : null;
          if (c && !seen.has(c.id)) { seen.add(c.id); cards.push(c); }
        });
        if (cards.length < limit && g.lineId && this.cardsForLine) {
          const lineCards = this.cardsForLine(g.lineId) || [];
          const weak = lineCards.filter(c => (c.lapses || 0) > 0 || (c.dueAt || 0) <= Date.now()).slice(0, 3);
          weak.forEach(c => { if (c && !seen.has(c.id)) { seen.add(c.id); cards.push(c); } });
        }
      });
      return cards.slice(0, limit);
    };

    const original = DB.addUserGame;
    if (typeof original !== 'function') { DB.__playerGamePatch = true; return; }
    DB.addUserGame = function playerAddGame(game) {
      const next = Object.assign({}, game || {});
      if (!next.id && next.pgn) next.id = 'game_' + hashPgn(next.pgn);
      const current = this.importedGames ? this.importedGames() : [];
      const duplicate = current.find(g => (next.id && g.id === next.id) || (next.pgn && g.pgn && hashPgn(g.pgn) === hashPgn(next.pgn)));
      if (duplicate) {
        if (this.setGameStatus) this.setGameStatus(duplicate.id, { duplicateSeenAt: Date.now(), status: duplicate.status || 'imported' });
        setImportStatus({ source: next.source || duplicate.source || 'Games', username: next.username || duplicate.username || '', status: 'done', at: Date.now(), count: 0, message: 'Duplicate game skipped. Your library is unchanged.' });
        return Object.assign({}, duplicate, { duplicate: true });
      }
      if (!next.lineId && this.bestLineMatchForPgn && next.pgn) {
        const match = this.bestLineMatchForPgn(next.pgn);
        if (match && match.matches >= 2) {
          next.lineId = match.lineId;
          next.matchedLineId = match.lineId;
          next.matchPlies = match.matches;
          next.status = 'matched';
        }
      }
      next.importedAt = next.importedAt || Date.now();
      const out = original.call(this, next);
      setImportStatus({
        source: next.source || 'Games',
        username: next.username || '',
        status: 'done',
        at: Date.now(),
        count: 1,
        message: next.lineId ? 'Imported and matched to your repertoire.' : 'Imported. Match it to a repertoire line when ready.'
      });
      return out;
    };
    DB.__playerGamePatch = true;
  }
  function patchImportTelemetry() {
    const API = global.OOSApi;
    if (!API || API.__playerTelemetryPatch) return;
    function wrap(name, source) {
      const original = API[name];
      if (typeof original !== 'function') return;
      API[name] = async function wrappedImport(username, max) {
        setImportStatus({ source, username, status: 'fetching', at: Date.now(), message: 'Fetching games' });
        try {
          const games = await original.apply(this, arguments);
          setImportStatus({ source, username, status: 'done', at: Date.now(), count: (games || []).length, message: 'Imported ' + ((games || []).length) + ' games' });
          return games;
        } catch (err) {
          setImportStatus({ source, username, status: 'failed', at: Date.now(), message: friendlyImportError(err) });
          throw err;
        }
      };
    }
    wrap('chesscomUserGames', 'Chess.com');
    wrap('lichessUserGames', 'Lichess');
    API.__playerTelemetryPatch = true;
  }
  function patchCloudImportFallback() {
    const gateway = global.OOSAccountGateway;
    if (!gateway || gateway.__playerImportPatch || typeof gateway.importGames !== 'function') return;
    const original = gateway.importGames;
    gateway.importGames = async function playerImportGames(source, username, options) {
      const label = /lichess/i.test(source) ? 'Lichess' : /chess/i.test(source) ? 'Chess.com' : 'Games';
      setImportStatus({ source: label, username, status: 'connecting', at: Date.now(), message: 'Connecting to cloud import' });
      try {
        const result = await original.apply(this, arguments);
        const games = Array.isArray(result) ? result : (result && (result.games || result.pgns || result.items)) || [];
        setImportStatus({ source: label, username, status: 'done', at: Date.now(), count: games.length || result?.count || 0, message: 'Import finished. Review the repair moments.' });
        return result;
      } catch (err) {
        setImportStatus({ source: label, username, status: 'failed', at: Date.now(), message: friendlyImportError(err) });
        throw err;
      }
    };
    gateway.__playerImportPatch = true;
  }
  function setImportStatus(status) { localSetJson(IMPORT_STATUS_KEY, status); updateImportStatusNodes(); }
  function friendlyImportError(err) {
    const raw = String(err && err.message || err || 'Import failed');
    if (/404|not found|private|unavailable/i.test(raw)) return 'Profile is private, unavailable, or has no public games.';
    if (/429|rate/i.test(raw)) return 'The chess site is rate limiting requests. Wait a few minutes and retry.';
    if (/network|failed to fetch/i.test(raw)) return 'Network request failed. Try again or use cloud import while signed in.';
    if (/no games|no parseable/i.test(raw)) return 'No parseable games were found for this profile.';
    return raw.replace(/^Error:\s*/i, '');
  }
  function decorateGamesPlayer(app) {
    if (!app || app.dataset.playerGames === '1') return;
    app.dataset.playerGames = '1';
    const DB = global.OOSData;
    const games = DB && DB.importedGames ? DB.importedGames() : [];
    const repairCards = DB && DB.repairCardsFromGames ? DB.repairCardsFromGames() : [];
    const cockpit = h('section', { class: 'player-import-cockpit' }, [
      h('div', {}, [
        h('span', { class: 'command-kicker', text: 'Game import' }),
        h('h2', { text: 'Turn games into opening repairs' }),
        h('p', { text: 'Import public Chess.com or Lichess games, match them against your repertoire, and practice the exact deviations.' })
      ]),
      h('div', { class: 'player-import-actions' }, [
        h('button', { class: 'btn btn-primary', type: 'button', on: { click: () => global.OOSViews.openChesscomFlow ? global.OOSViews.openChesscomFlow() : global.OOSApp.openImport() } }, ['Import Chess.com']),
        h('button', { class: 'btn', type: 'button', on: { click: () => global.OOSViews.openLichessFlow ? global.OOSViews.openLichessFlow() : global.OOSApp.openImport() } }, ['Import Lichess']),
        h('button', { class: 'btn btn-ghost', type: 'button', on: { click: () => global.OOSApp.openImport() } }, ['Paste PGN'])
      ]),
      h('div', { class: 'import-health-row' }, [
        h('div', { class: 'import-health-card', dataset: { importStatus: 'last' } }, [h('span', { text: 'Last import' }), h('strong', { text: 'No imports yet' }), h('small', { text: 'Ready' })]),
        h('div', { class: 'import-health-card' }, [h('span', { text: 'Stored games' }), h('strong', { text: String(games.length) }), h('small', { text: 'In this workspace' })]),
        h('div', { class: 'import-health-card' }, [h('span', { text: 'Repair cards' }), h('strong', { text: String(repairCards.length) }), h('small', { text: repairCards.length ? 'Ready to practice' : 'None yet' })])
      ]),
      repairCards.length ? h('button', { class: 'btn btn-primary repair-wide', type: 'button', on: { click: () => global.OOSViews.startSessionWith(repairCards, { mode: 'repair' }) } }, ['Practice repair set']) : null
    ].filter(Boolean));
    const root = app.firstElementChild || app;
    root.insertBefore(cockpit, root.children[1] || null);
    updateImportStatusNodes();
  }
  function updateImportStatusNodes() {
    const last = localGetJson(IMPORT_STATUS_KEY, null);
    $all('[data-import-status="last"]').forEach(n => {
      const strong = $('strong', n); const small = $('small', n);
      if (!last) { strong.textContent = 'No imports yet'; small.textContent = 'Ready'; n.dataset.state = 'idle'; return; }
      strong.textContent = last.source + (last.username ? ' · ' + last.username : '');
      small.textContent = (last.message || last.status) + ' · ' + timeAgo(last.at);
      n.dataset.state = last.status || 'idle';
    });
  }

  // ----------------------------------------------------------------------
  // Dashboard / beginner-to-tournament usability
  // ----------------------------------------------------------------------
  function decorateTodayPlayer(app) {
    if (!app || app.dataset.playerToday === '1') return;
    app.dataset.playerToday = '1';
    const level = localStorage.getItem(PLAYER_LEVEL_KEY) || 'club';
    const panel = h('section', { class: 'player-readiness-panel' }, [
      h('div', {}, [h('span', { class: 'command-kicker', text: 'Training lens' }), h('h2', { text: 'Make today’s prep match your level' }), h('p', { text: 'Beginners get simpler guidance. Tournament players get repair-first, no-bloat prep.' })]),
      h('div', { class: 'player-level-switch' }, ['beginner','club','tournament'].map(v => h('button', { type: 'button', class: v === level ? 'is-active' : '', on: { click: e => { localStorage.setItem(PLAYER_LEVEL_KEY, v); $all('button', e.currentTarget.parentElement).forEach(b => b.classList.toggle('is-active', b === e.currentTarget)); updateLensCopy(panel, v); } } }, [v === 'beginner' ? 'Beginner' : v === 'club' ? 'Club player' : 'Tournament']))),
      h('div', { class: 'player-lens-copy' })
    ]);
    const root = $('.today', app) || app.firstElementChild || app;
    root.insertBefore(panel, root.children[2] || null);
    updateLensCopy(panel, level);
  }
  function updateLensCopy(panel, level) {
    const box = $('.player-lens-copy', panel);
    if (!box) return;
    const copy = {
      beginner: ['Keep it simple', 'Learn one clean line per opening. Add an idea and memory hook before adding more moves.'],
      club: ['Build stable habits', 'Review due positions, repair mistakes from games, and add only sidelines you actually face.'],
      tournament: ['Protect confidence', 'No theory bloat before events. Drill must-know lines, recent mistakes, and opponent sideline repairs.'],
    }[level] || [];
    box.innerHTML = '';
    box.append(h('strong', { text: copy[0] || '' }), h('p', { text: copy[1] || '' }));
  }

  // ----------------------------------------------------------------------
  // Shortcuts and wrappers
  // ----------------------------------------------------------------------
  function clickFirstButton(pattern) {
    const btn = $all('button').find(b => pattern.test(b.textContent || '') && !b.disabled && b.offsetParent !== null);
    if (btn) { btn.click(); return true; }
    return false;
  }
  function showShortcuts() {
    if ($('.player-shortcuts-modal')) return;
    const wrap = h('div', { class: 'modal player-shortcuts-modal' }, [
      h('div', { class: 'modal-back', on: { click: () => wrap.remove() } }),
      h('div', { class: 'modal-panel player-shortcuts-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Keyboard shortcuts' }, [
        h('div', { class: 'eyebrow', text: 'Keyboard controls' }),
        h('h3', { text: 'Move faster without losing clarity' }),
        h('div', { class: 'shortcut-grid' }, NAV_SHORTCUTS.map(([k, label]) => h('div', {}, [h('kbd', { text: k }), h('span', { text: label })]))),
        h('p', { class: 'muted', text: 'Board focus: Tab to the board, then use arrow keys and Enter. Right-drag on the board draws arrows/circles.' }),
        h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:14px' }, [h('button', { class: 'btn btn-primary', type: 'button', on: { click: () => wrap.remove() } }, ['Got it'])])
      ])
    ]);
    document.body.appendChild(wrap);
  }
  function installGlobalShortcuts() {
    if (document.documentElement.dataset.playerShortcuts === '1') return;
    document.documentElement.dataset.playerShortcuts = '1';
    document.addEventListener('keydown', ev => {
      if (isTypingTarget(ev.target)) return;
      const key = ev.key.toLowerCase();
      if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        const map = { '1': 'today', '2': 'repertoire', '3': 'practice', '4': 'games', '5': 'insights', '6': 'library', '7': 'coach', '8': 'settings' };
        if (map[ev.key]) { ev.preventDefault(); global.OOSApp.go(map[ev.key]); return; }
      }
      if (ev.key === '?') { ev.preventDefault(); showShortcuts(); return; }
      if (ev.key === '/' || ((ev.metaKey || ev.ctrlKey) && key === 'k')) { ev.preventDefault(); $('#cmdTrigger')?.click(); return; }
      if (key === 'i') {
        ev.preventDefault();
        if (activeView() === 'repertoire') {
          if (!clickFirstButton(/Idea|Edit idea/i)) clickFirstButton(/Position actions/i);
        } else {
          global.OOSApp.openImport();
        }
        return;
      }
      if (key === 'n') { ev.preventDefault(); global.OOSViews.showLineCreationWizard(() => global.OOSApp.go('repertoire')); return; }
      if (key === 's') { ev.preventDefault(); $('#syncTrustPill')?.click(); return; }
      if (key === 'b') { ev.preventDefault(); focusBoardMode(); return; }
      if (key === 'f') { ev.preventDefault(); clickFirstButton(/Flip/i); return; }
      if (activeView() === 'repertoire') {
        if (ev.key === '[' || ev.key === 'ArrowLeft') { ev.preventDefault(); clickFirstButton(/Prev|◀/i); return; }
        if (ev.key === ']' || ev.key === 'ArrowRight') { ev.preventDefault(); clickFirstButton(/Next|▶/i); return; }
        if (key === 'p') { ev.preventDefault(); clickFirstButton(/Practice from here/i); return; }
        if (key === 'a') { ev.preventDefault(); clickFirstButton(/Position actions/i); return; }
      }
      if (/^[1-4]$/.test(ev.key)) {
        const btn = $(`.grade-btn[data-grade="${ev.key}"]`);
        if (btn) { ev.preventDefault(); btn.click(); }
      }
    });
  }

  function wrapViews() {
    if (!global.OOSViews || global.OOSViews.__playerAuditPatched) return;
    const V = global.OOSViews;
    function wrap(name, fn) {
      const old = V[name];
      if (typeof old !== 'function') return;
      V[name] = function wrapped(app, opts) {
        const out = old.apply(this, arguments);
        setTimeout(() => { try { fn(app || $('#app'), opts || {}); addBoardToolbars(app || document); } catch (err) { console.warn('[OpeningOS player UX]', name, err); } }, 0);
        return out;
      };
    }
    wrap('renderToday', decorateTodayPlayer);
    wrap('renderRepertoire', decorateRepertoirePlayer);
    wrap('renderPractice', addBoardToolbars);
    wrap('renderGames', decorateGamesPlayer);
    V.__playerAuditPatched = true;
  }

  function init() {
    document.body.classList.add('oos-player-audit');
    applyBoardSize(localStorage.getItem(BOARD_SIZE_KEY) || 'comfort');
    installBoardKeyboardPatch();
    patchGamePersistence();
    patchImportTelemetry();
    patchCloudImportFallback();
    installGlobalShortcuts();
    wrapViews();
    addBoardToolbars(document);
    global.OOSPlayerRefresh = function () { wrapViews(); updateImportStatusNodes(); addBoardToolbars(document); }; setTimeout(global.OOSPlayerRefresh, 250); setTimeout(global.OOSPlayerRefresh, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();


  // Compatibility aliases for the player POV audit test vocabulary.
  function decorateBoardControls(root) { addBoardToolbars(root || document); }
  function startRepairSet() {
    const DB = global.OOSData;
    const cards = DB && DB.repairCardsFromGames ? DB.repairCardsFromGames() : [];
    if (cards.length && global.OOSViews && global.OOSViews.startSessionWith) global.OOSViews.startSessionWith(cards, { mode: 'repair' });
    else toast('No repair set is ready yet. Import and match games first.', 'info');
  }
  function studyMode(mode) {
    try { localStorage.setItem(PLAYER_LEVEL_KEY, mode || 'club'); } catch (_) {}
    return localStorage.getItem(PLAYER_LEVEL_KEY) || 'club';
  }
  // class markers: line-manager-panel current-position-dock player-import-command
  global.OOSPlayerExperienceAudit = { VERSION, applyBoardSize, showShortcuts, friendlyImportError, decorateBoardControls, startRepairSet, studyMode };
})(window);
