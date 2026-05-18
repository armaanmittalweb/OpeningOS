/* OpeningOS — views
 * Renders Today, Repertoire, Practice, Games, Insights into #app.
 */
(function (global) {
  'use strict';

  // Tiny DOM helper
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.textContent = attrs[k];
      else if (k === 'on') {
        for (const ev in attrs.on) node.addEventListener(ev, attrs.on[ev]);
      } else if (k === 'data') {
        for (const d in attrs.data) node.dataset[d] = attrs.data[d];
      } else if (k === 'style') {
        Object.assign(node.style, attrs.style);
      } else if (k in node) {
        node[k] = attrs[k];
      } else {
        node.setAttribute(k, attrs[k]);
      }
    }
    if (!Array.isArray(children)) children = [children];
    children.forEach(c => {
      if (c == null || c === false) return;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  function icon(path, size = 16) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('fill', 'currentColor');
    p.setAttribute('d', path);
    svg.appendChild(p);
    return svg;
  }
  const ICONS = {
    arrow: 'M9 6l6 6-6 6',
    play:  'M8 5v14l11-7z',
    book:  'M4 5h12a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3V5zm0 0v13a3 3 0 0 0 3 3',
    map:   'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zm6-2v14m6-12v14',
    flag:  'M5 21V4h11l-1 4 1 4H7v9H5z',
    bolt:  'M11 21h-1l1-7H7.5L13 3h1l-1 7h3.5L11 21z',
    fix:   'M14.7 6.3l3 3-9 9H5.7v-3l9-9zm1.4-1.4l1.6-1.6a2 2 0 0 1 2.8 2.8L18.9 7.7l-2.8-2.8z',
    add:   'M12 5v14M5 12h14',
    flip:  'M16 6l4 4-4 4M4 14h13M8 18l-4-4 4-4M20 10H7',
    chev:  'M9 6l6 6-6 6',
    upload:'M12 4v12m0-12l-4 4m4-4l4 4M5 20h14',
    trophy:'M7 4h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 16v3h3v2H8v-2h3v-3a5 5 0 0 1-2.7-3H8a4 4 0 0 1-4-4V6h3V4z',
    sparkle:'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z',
    target:'M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm0 4a5 5 0 1 0 5 5h-2a3 3 0 1 1-3-3V7z',
    check: 'M5 13l4 4L19 7',
    x:     'M6 6l12 12M18 6L6 18',
  };

  // ----------------------------------------------------------------------
  // TODAY
  // ----------------------------------------------------------------------
  function renderToday(app) {
    app.innerHTML = '';
    const DB = global.OOSData;
    const due = DB.duePositions();
    const weak = DB.weakPositions();
    const isTour = DB.isTournament();
    const games = DB.importedGames();
    const lines = DB.lines({ includeRetired: true });
    const recentGame = games.find(g => DB.detectDeviationForGame(g));
    const dev = recentGame ? DB.detectDeviationForGame(recentGame) : null;
    const health = DB.repertoireHealth();

    const root = el('div', { class: 'today' });

    if (isTour) {
      root.appendChild(el('div', { class: 'tournament-banner' }, [
        el('div', { class: 'tb-icon' }, [icon(ICONS.trophy, 22)]),
        el('div', { class: 'tb-text' }, [
          el('div', { class: 'tb-title' }, ['Tournament mode is active']),
          el('div', { class: 'tb-meta' }, ['Focus on confidence, not expansion. New theory is hidden, weak critical positions prioritized.']),
        ]),
        el('button', { class: 'btn btn-sm', on: { click: () => { DB.setTournament(false); renderToday(app); document.body.dataset.tournament = 'false'; document.getElementById('tournamentBtn').setAttribute('aria-pressed', 'false'); } } }, ['Exit']),
      ]));
    }

    const profile = global.OOSProfiles && global.OOSProfiles.active();
    const userName = profile ? profile.name : 'there';
    const hour = new Date().getHours();
    const greet = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    // ---- EMPTY STATE: brand-new profile, no lines yet ------------------
    if (lines.length === 0) {
      root.appendChild(el('div', { class: 'today-hero' }, [
        el('div', { class: 'greeting' }, [`${greet}, ${userName}.`]),
        el('h1', {}, ['Welcome to ', el('span', { class: 'accent' }, ['OpeningOS']), '.']),
        el('div', { class: 'subtitle muted', style: { marginTop: '6px', fontSize: '14px' } }, [
          'Your repertoire is empty. Pick how you want to start — you can mix and match later.',
        ]),
      ]));

      const grid = el('div', { class: 'today-grid' });

      grid.appendChild(makeStartCard({
        eyebrow: 'Start fast', icon: ICONS.book, pill: { kind: 'good', label: 'Recommended' },
        title: 'Choose a starter repertoire',
        body: 'Pick a curated course (London, Caro-Kann, Italian, KID, French, Najdorf) and clone it into your repertoire in one click.',
        cta: 'Open library', span: 8,
        onClick: () => global.OOSApp.go('library'),
      }));

      grid.appendChild(makeStartCard({
        eyebrow: 'Bring your work', icon: ICONS.upload, pill: null,
        title: 'Import a PGN',
        body: 'Paste a Lichess study, a Chess.com game, or any PGN file. We parse it, validate every move, and turn it into trainable cards.',
        cta: 'Import PGN', span: 4,
        onClick: () => global.OOSApp.openImport(),
      }));

      grid.appendChild(makeStartCard({
        eyebrow: 'Public APIs', icon: ICONS.fix, pill: null,
        title: 'Pull from Lichess or Chess.com',
        body: 'Type your username — we fetch your last games over the public API and surface the deviations from your prep.',
        cta: 'Connect account', span: 6,
        onClick: () => global.OOSViews.openLichessFlow(),
      }));

      grid.appendChild(makeStartCard({
        eyebrow: 'Build manually', icon: ICONS.add, pill: null,
        title: 'Add a line by hand',
        body: 'Step through moves on a board (or type SAN / paste PGN), name the line, and save it directly to a folder.',
        cta: 'Open the line wizard', span: 6,
        onClick: () => global.OOSViews.showLineCreationWizard(() => global.OOSApp.go('repertoire')),
      }));

      root.appendChild(grid);
      app.appendChild(root);
      return;
    }

    // ---- POPULATED STATE ----------------------------------------------
    const focusLine = weak[0] || due[0];
    const focusName = focusLine ? focusLine.name : (lines[0] ? lines[0].name : 'your repertoire');

    const heroTitle = due.length > 0
      ? ['Your ', el('span', { class: 'accent' }, [focusName]), ' needs attention today.']
      : ['You\'re ', el('span', { class: 'accent' }, ['caught up']), '. Add theory or warm up.'];

    root.appendChild(el('div', { class: 'today-hero' }, [
      el('div', { class: 'greeting' }, [`${greet}, ${userName}.`]),
      el('h1', {}, heroTitle),
    ]));

    const grid = el('div', { class: 'today-grid' });

    // Card 1: Today's practice
    grid.appendChild(el('div', {
      class: 'card card-hover today-card span-8 action-card',
      on: { click: () => global.OOSApp.go('practice') },
    }, [
      el('div', { class: 'ac-head' }, [
        el('div', { class: 'icon' }, [icon(ICONS.play, 18)]),
        due.length > 0
          ? el('span', { class: 'pill pill-good' }, ['Ready'])
          : el('span', { class: 'pill pill-info' }, ['Caught up']),
      ]),
      el('div', {}, [
        el('div', { class: 'eyebrow' }, ["Today's practice"]),
        el('div', { class: 'ac-stat' }, [String(due.length)]),
        el('div', { class: 'ac-meta' }, [
          due.length > 0
            ? `positions due · ${Math.max(5, Math.round(due.length * 0.5))} min session · focus: `
            : 'nothing due — strengthen weak lines or learn new theory · ',
          el('span', { class: 'mono' }, [focusName]),
        ]),
      ]),
      el('div', { class: 'ac-cta' }, [
        el('span', {}, [due.length > 0 ? 'Start review' : 'Open practice']),
        icon(ICONS.arrow, 16),
      ]),
    ]));

    // Card 2: Repertoire health
    const healthBars = el('div', { class: 'stack' },
      health.slice(0, 3).map(h => el('div', { class: 'health-row' }, [
        el('div', {}, [
          el('div', { class: 'label' }, [h.name]),
          el('div', { class: 'health-bar' }, [el('span', { style: { width: h.pct + '%' } })]),
        ]),
        el('div', { class: 'value' }, [h.pct + '%']),
      ]))
    );

    grid.appendChild(el('div', {
      class: 'card today-card span-4 action-card',
      on: { click: () => global.OOSApp.go('insights') },
    }, [
      el('div', { class: 'ac-head' }, [
        el('div', { class: 'icon' }, [icon(ICONS.map, 18)]),
      ]),
      el('div', {}, [
        el('div', { class: 'eyebrow' }, ['Repertoire health']),
        el('div', { class: 'ac-title', style: { marginTop: '4px' } }, ['How stable is your prep?']),
      ]),
      healthBars,
      el('div', { class: 'ac-cta' }, [
        el('span', {}, ['View map']),
        icon(ICONS.arrow, 16),
      ]),
    ]));

    // Card 3: Recent game issue (only if a game with deviation exists)
    if (recentGame && dev) {
      const lineMeta = DB.line(recentGame.lineId);
      grid.appendChild(el('div', {
        class: 'card today-card span-6 action-card',
        on: { click: () => global.OOSApp.go('games') },
      }, [
        el('div', { class: 'ac-head' }, [
          el('div', { class: 'icon' }, [icon(ICONS.fix, 18)]),
          el('span', { class: 'pill pill-bad' }, ['Deviation']),
        ]),
        el('div', {}, [
          el('div', { class: 'eyebrow' }, ['Recent game']),
          el('div', { class: 'ac-title' }, [
            `You left your repertoire on move ${Math.ceil(dev.ply / 2)}`,
          ]),
          el('div', { class: 'ac-meta', style: { marginTop: '6px' } }, [
            `vs ${recentGame.vs} · ${lineMeta ? lineMeta.name : 'imported game'}`,
          ]),
          el('div', { class: 'ac-meta mono', style: { marginTop: '2px' } }, [
            `prepared: ${dev.expected}  ·  played: ${dev.played}`,
          ]),
        ]),
        el('div', { class: 'ac-cta' }, [
          el('span', {}, ['Fix this line']),
          icon(ICONS.arrow, 16),
        ]),
      ]));
    } else if (games.length === 0) {
      // Show "Import games" suggestion instead.
      grid.appendChild(makeStartCard({
        eyebrow: 'Improve from real play', icon: ICONS.upload, pill: null,
        title: 'No games imported yet',
        body: 'Pull your last games from Lichess or Chess.com — we highlight where your real play left your prep so you can fix it.',
        cta: 'Import games', span: 6,
        onClick: () => global.OOSApp.openImport(),
      }));
    }

    // Card 4: Weak lines
    grid.appendChild(el('div', {
      class: 'card today-card span-6 action-card',
      on: { click: () => global.OOSApp.startWeakDrill() },
    }, [
      el('div', { class: 'ac-head' }, [
        el('div', { class: 'icon' }, [icon(ICONS.target, 18)]),
        el('span', { class: weak.length ? 'pill pill-warn' : 'pill pill-good' }, [`${weak.length} weak`]),
      ]),
      el('div', {}, [
        el('div', { class: 'eyebrow' }, ['Drill weak lines']),
        el('div', { class: 'ac-title' }, ['Repair the positions you keep missing']),
        el('div', { class: 'ac-meta', style: { marginTop: '6px' } }, [
          weak.length > 0
            ? `Top miss: ${weak[0].name} after ${weak[0].historyBefore || 'start'}`
            : 'No weak positions yet. Practice a few cards to populate this.',
        ]),
      ]),
      el('div', { class: 'ac-cta' }, [
        el('span', {}, [weak.length ? 'Drill weak now' : 'Open practice']),
        icon(ICONS.arrow, 16),
      ]),
    ]));

    // Card 5: Repertoire summary
    if (!isTour) {
      grid.appendChild(el('div', {
        class: 'card today-card span-12 action-card',
        on: { click: () => global.OOSApp.go('repertoire') },
      }, [
        el('div', { class: 'row-between' }, [
          el('div', { class: 'row' }, [
            el('div', { class: 'icon', style: { width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-3)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } }, [icon(ICONS.book, 20)]),
            el('div', {}, [
              el('div', { class: 'eyebrow' }, ['Repertoire']),
              el('div', { class: 'ac-title' }, [`${lines.length} line${lines.length === 1 ? '' : 's'}, ${DB.allPositions().length} position${DB.allPositions().length === 1 ? '' : 's'} covered`]),
              el('div', { class: 'ac-meta', style: { marginTop: '2px' } }, ['Add a line, paste PGN, or polish ideas in your existing lines.']),
            ]),
          ]),
          el('div', { class: 'row' }, [
            el('button', { class: 'btn', on: { click: (e) => { e.stopPropagation(); global.OOSApp.openImport(); } } }, [icon(ICONS.upload, 14), 'Import PGN']),
            el('button', { class: 'btn btn-primary' }, ['Open repertoire']),
          ]),
        ]),
      ]));
    }

    root.appendChild(grid);
    app.appendChild(root);
  }

  // Helper to build "start fast" cards on the empty Today.
  function makeStartCard({ eyebrow, icon: ic, title, body, cta, pill, span, onClick }) {
    return el('div', {
      class: `card card-hover today-card span-${span || 6} action-card`,
      on: { click: onClick },
    }, [
      el('div', { class: 'ac-head' }, [
        el('div', { class: 'icon' }, [icon(ic, 18)]),
        pill ? el('span', { class: `pill pill-${pill.kind}` }, [pill.label]) : null,
      ]),
      el('div', {}, [
        el('div', { class: 'eyebrow' }, [eyebrow]),
        el('div', { class: 'ac-title' }, [title]),
        el('div', { class: 'ac-meta', style: { marginTop: '6px' } }, [body]),
      ]),
      el('div', { class: 'ac-cta' }, [
        el('span', {}, [cta]),
        icon(ICONS.arrow, 16),
      ]),
    ]);
  }

  // ----------------------------------------------------------------------
  // REPERTOIRE
  // ----------------------------------------------------------------------
  let repState = { selectedLineId: null, currentPly: 0, board: null };

  function renderRepertoire(app, opts = {}) {
    const DB = global.OOSData;
    const lines = DB.lines();

    app.innerHTML = '';

    if (!lines.length) {
      const ev = el('div', { class: 'empty large card', style: { maxWidth: '640px', margin: '40px auto' } }, [
        el('div', { class: 'icon' }, [icon(ICONS.book, 22)]),
        el('h3', {}, ['Your repertoire is empty']),
        el('p', {}, ['Start with one opening. Pick a curated starter, paste a PGN, or build a line manually.']),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn btn-primary', on: { click: () => global.OOSApp.go('library') } }, ['Choose starter repertoire']),
          el('button', { class: 'btn', on: { click: () => global.OOSApp.openImport() } }, [icon(ICONS.upload, 14), 'Paste PGN']),
          el('button', { class: 'btn', on: { click: () => global.OOSViews.showLineCreationWizard(() => global.OOSApp.go('repertoire')) } }, ['Create manually']),
        ]),
      ]);
      app.appendChild(ev);
      return;
    }

    if (!repState.selectedLineId || opts.lineId) {
      repState.selectedLineId = opts.lineId || lines[0].id;
      repState.currentPly = opts.ply != null ? opts.ply : 0;
    }

    const layout = el('div', { class: 'rep-layout' });

    // ---- Folder tree ---------------------------------------------------
    const folders = el('aside', { class: 'rep-folders' });
    DB.repertoires().forEach(rep => {
      const repLines = lines.filter(l => l.repId === rep.id);
      const grp = el('div', { class: 'rep-folder-group' }, [
        el('h4', {}, [rep.name]),
        ...repLines.map(line => el('div', {
          class: 'rep-line' + (line.id === repState.selectedLineId ? ' is-active' : ''),
          on: { click: () => { repState.selectedLineId = line.id; repState.currentPly = 0; renderRepertoire(app); } },
        }, [
          el('span', {}, [line.name, line.status === 'retired' ? ' · retired' : (line.parentLineId ? ' · branch' : '')]),
          el('span', { class: 'count' }, [String(DB.positionsForLine(line.id).length)]),
        ])),
      ]);
      folders.appendChild(grp);
    });
    folders.appendChild(el('button', {
      class: 'btn btn-sm', style: { width: '100%', marginTop: '12px' },
      on: { click: () => global.OOSViews.showLineCreationWizard(() => global.OOSApp.go('repertoire')) },
    }, [icon(ICONS.add, 12), 'Add line']));

    // ---- Main editor ---------------------------------------------------
    const line = DB.line(repState.selectedLineId);
    const positions = DB.positionsForLine(line.id);
    const main = el('div', { class: 'rep-main' });

    main.appendChild(el('label', { class: 'mobile-line-picker' }, [
      el('span', { class: 'label' }, ['Current line']),
      el('select', {
        class: 'input',
        value: line.id,
        on: { change: (e) => { repState.selectedLineId = e.target.value; repState.currentPly = 0; renderRepertoire(app); } },
      }, lines.map(l => el('option', { value: l.id, selected: l.id === line.id }, [l.name + ' · ' + (l.color === 'w' ? 'White' : 'Black')]))),
    ]));

    main.appendChild(el('div', { class: 'line-header' }, [
      el('div', {}, [
        el('div', { class: 'eyebrow' }, [line.eco + ' · ' + line.opening + ' · plays as ' + (line.color === 'w' ? 'White' : 'Black')]),
        el('h2', { style: { marginTop: '4px' } }, [line.name]),
        el('div', { class: 'subtitle' }, [line.description]),
      ]),
      el('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
        buildLineQualityMeter(DB.lineQuality(line.id)),
        el('div', { class: 'line-tags', style: { flexDirection: 'column', alignItems: 'flex-end', gap: '4px' } }, [
          el('span', { class: 'pill ' + tagPillClass(line.tag) }, [tagLabel(line.tag)]),
          el('span', { class: 'pill pill-info pill-plain' }, [String(positions.length) + ' prep moves']),
        ]),
        el('div', { class: 'row line-actions', style: { gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
          (DB.isUserLine && DB.isUserLine(line.id))
            ? el('button', { class: 'btn btn-sm', on: { click: () => showLineCreationWizard(() => global.OOSApp.go('repertoire', { lineId: line.id }), line) } }, ['Edit'])
            : el('button', { class: 'btn btn-sm', on: { click: () => { const copy = DB.duplicateLine(line.id); if (copy) { global.OOSApp.toast('Created an editable copy', 'good'); global.OOSApp.go('repertoire', { lineId: copy.id }); } } } }, ['Customize copy']),
          (DB.isUserLine && DB.isUserLine(line.id))
            ? el('button', { class: 'btn btn-sm', on: { click: () => { const copy = DB.duplicateLine(line.id); if (copy) { global.OOSApp.toast('Duplicated line', 'good'); global.OOSApp.go('repertoire', { lineId: copy.id }); } } } }, ['Duplicate'])
            : null,
          DB.getSetting && DB.getSetting('aiSummaries', false) && global.OOSAnalysis
            ? el('button', { class: 'btn btn-sm', on: { click: () => showLineSummaryDialog(line) } }, ['AI/local summary'])
            : null,
          (DB.isUserLine && DB.isUserLine(line.id))
            ? el('button', { class: 'btn btn-sm btn-ghost', on: { click: () => { if (confirm('Delete "' + line.name + '" from this profile? Imported games will become unmatched.')) { DB.deleteUserLine(line.id); global.OOSApp.toast('Line deleted', 'good'); repState.selectedLineId = null; global.OOSApp.go('repertoire'); } } } }, ['Delete'])
            : null,
        ].filter(Boolean)),
      ]),
    ]));

    // Editor grid: board + (move tree + idea card)
    const grid = el('div', { class: 'editor-grid' });

    const boardWrap = el('div', { class: 'stack' });
    const boardHost = el('div', { class: 'chess-board full' });
    boardWrap.appendChild(boardHost);

    const boardActions = el('div', { class: 'row', style: { gap: '8px' } }, [
      el('button', { class: 'btn btn-sm', on: { click: () => repState.board && repState.board.flip() } }, [icon(ICONS.flip, 12), 'Flip']),
      el('button', { class: 'btn btn-sm', on: { click: () => stepMove(-1) } }, ['◀ Prev']),
      el('button', { class: 'btn btn-sm', on: { click: () => stepMove(1) } }, ['Next ▶']),
      el('button', { class: 'btn btn-sm btn-primary', style: { marginLeft: 'auto' }, on: { click: () => {
        const cards = DB.cardsFromLine ? DB.cardsFromLine(line.id, repState.currentPly) : DB.positionsForLine(line.id);
        global.OOSViews.startSessionWith(cards, { mode: 'daily' });
      } } }, [icon(ICONS.bolt, 12), 'Practice from here']),
    ]);
    boardWrap.appendChild(boardActions);

    grid.appendChild(boardWrap);

    // Right column: move tree + idea card
    const right = el('div', { class: 'stack' });

    // Move tree
    const moveTreeNode = el('div', { class: 'move-tree' }, [
      el('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, ['Main line']),
      el('div', { class: 'moves' }, buildMoveTokens(line.moves, repState.currentPly, (i) => { repState.currentPly = i; renderRepertoire(app); })),
    ]);
    right.appendChild(moveTreeNode);
    right.appendChild(buildLineSurgeryPanel(line, repState.currentPly));

    // Idea card for current ply
    const card = positionAtPly(line, repState.currentPly);
    if (card) {
      right.appendChild(buildIdeaCard(card, line));
    } else {
      right.appendChild(el('div', { class: 'idea-card empty' }, [
        el('div', { class: 'icon' }, [icon(ICONS.book, 22)]),
        el('h3', {}, ['Starting position']),
        el('p', {}, ['Step into the line to see the idea cards for each prep position.']),
      ]));
    }

    grid.appendChild(right);
    main.appendChild(grid);

    // Scroll-anchored bottom: progress strip
    const positionsBar = el('div', { class: 'panel', style: { padding: '12px 16px' } }, [
      el('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, ['Progress in this line']),
      el('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } },
        positions.map(p => {
          const srs = DB.srs(p.id);
          let cls = 'cov-cell';
          if (!srs || srs.stability < 1.5 || srs.lapses >= 2) cls += ' s-weak';
          else if (srs.stability < 4) cls += ' s-medium';
          else cls += ' s-strong';
          return el('div', {
            class: cls,
            style: { width: '24px', aspectRatio: '1', position: 'relative' },
            title: `Move ${p.ply}: ${p.move}`,
            on: { click: () => { repState.currentPly = p.ply - 1; renderRepertoire(app); } },
          });
        })),
    ]);
    main.appendChild(positionsBar);

    // ---- Aside: notes / metadata --------------------------------------
    const aside = el('aside', { class: 'rep-aside' });
    aside.appendChild(el('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, ['Notes']));

    const noteData = card ? DB.notesFor(card.id) : { type: 'idea', text: '', tags: [] };

    // Type chips
    const noteTypes = [
      { v: 'idea',    label: 'Idea' },
      { v: 'warning', label: 'Warning' },
      { v: 'memory',  label: 'Memory hint' },
      { v: 'plan',    label: 'Plan' },
      { v: 'tactical',label: 'Tactical' },
      { v: 'coach',   label: 'Coach' },
    ];
    const typesRow = el('div', { class: 'note-types' });
    noteTypes.forEach(t => {
      typesRow.appendChild(el('span', {
        class: 'note-type' + (noteData.type === t.v ? ' is-active' : ''),
        on: { click: () => {
          if (!card) return;
          DB.setNote(card.id, { type: t.v });
          renderRepertoire(app);
        } },
      }, [t.label]));
    });
    aside.appendChild(typesRow);

    let noteSaveTimer = null;
    const noteStatus = el('div', {
      style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '4px', minHeight: '14px' },
    }, ['']);
    const noteInput = el('textarea', {
      class: 'input',
      placeholder: card ? `${noteTypes.find(t => t.v === noteData.type)?.label || 'Note'}: write what matters here…` : 'Step to a position to add a note.',
      disabled: !card,
      on: {
        input: (e) => {
          if (!card) return;
          // Debounce: defer save until 800ms of no typing, so history doesn't
          // explode with one snapshot per keystroke.
          noteStatus.textContent = 'Saving…';
          if (noteSaveTimer) clearTimeout(noteSaveTimer);
          const text = e.target.value;
          noteSaveTimer = setTimeout(() => {
            DB.setNote(card.id, { text });
            noteStatus.textContent = 'Saved';
            setTimeout(() => { if (noteStatus.textContent === 'Saved') noteStatus.textContent = ''; }, 1400);
          }, 800);
        },
        blur: (e) => {
          if (!card) return;
          if (noteSaveTimer) clearTimeout(noteSaveTimer);
          DB.setNote(card.id, { text: e.target.value });
          noteStatus.textContent = 'Saved';
          setTimeout(() => { if (noteStatus.textContent === 'Saved') noteStatus.textContent = ''; }, 1400);
        },
      },
    });
    noteInput.value = noteData.text || '';
    aside.appendChild(noteInput);
    aside.appendChild(noteStatus);

    // Markdown preview + version history (only shown if we have a card)
    if (card) {
      const noteFooter = el('div', { class: 'row', style: { marginTop: '6px', gap: '6px' } });
      noteFooter.appendChild(el('button', {
        class: 'btn btn-sm btn-ghost',
        on: { click: () => {
          const previewWrap = aside.querySelector('.note-preview');
          if (previewWrap) { previewWrap.remove(); return; }
          const pv = document.createElement('div');
          pv.className = 'note-preview';
          // Use the safe DOM-fragment renderer — avoids any innerHTML on user data.
          if (global.OOSMarkdown && global.OOSMarkdown.renderToFragment) {
            pv.appendChild(global.OOSMarkdown.renderToFragment(noteInput.value));
          } else {
            pv.textContent = noteInput.value;
          }
          aside.insertBefore(pv, noteFooter);
        } },
      }, ['Preview']));
      const histCount = (noteData.history || []).length;
      if (histCount > 0) {
        noteFooter.appendChild(el('button', {
          class: 'btn btn-sm btn-ghost',
          on: { click: () => openHistoryDialog(card.id) },
        }, [`History (${histCount})`]));
      }
      aside.appendChild(noteFooter);
    }

    // Tags row
    if (card) {
      const tagSuggestions = ['pawn-break', 'trap', 'must-know', 'endgame', 'memory-hook', 'coach', 'tournament'];
      const tagsRow = el('div', { class: 'note-tags' });
      tagSuggestions.forEach(t => {
        const active = (noteData.tags || []).includes(t);
        tagsRow.appendChild(el('span', {
          class: 'note-tag' + (active ? ' is-active' : ''),
          style: active ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : {},
          on: { click: () => {
            const tags = (noteData.tags || []).slice();
            if (active) tags.splice(tags.indexOf(t), 1); else tags.push(t);
            DB.setNote(card.id, { tags });
            renderRepertoire(app);
          } },
        }, ['#' + t]));
      });
      aside.appendChild(tagsRow);
    }

    aside.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '20px', marginBottom: '8px' } }, ['Real games']));
    aside.appendChild(el('div', { class: 'panel', style: { padding: '12px' } }, [
      el('div', { class: 'mono', style: { fontSize: '12px', color: 'var(--text-2)' } }, ['Times this line appeared: ' + lineGameCount(line.id)]),
      el('div', { style: { marginTop: '6px' } }, [
        el('a', { href: '#games', class: 'mono', style: { color: 'var(--accent)', fontSize: '12px' }, on: { click: (e) => { e.preventDefault(); global.OOSApp.go('games', { lineId: line.id }); } } }, ['View games →']),
      ]),
    ]));

    layout.appendChild(folders);
    layout.appendChild(main);
    layout.appendChild(aside);
    app.appendChild(layout);

    // Mount the board now that DOM is in place.
    const fenAtPly = computeFenAtPly(line, repState.currentPly);
    repState.board = new global.OOSBoard(boardHost, {
      fen: fenAtPly,
      orientation: line.color === 'b' ? 'black' : 'white',
      interactive: false,
      annotations: DB.arrowsFor(fenAtPly),
      showCoords: DB.getSetting('coords', true),
      onAnnotate: ({ fen, arrows }) => {
        DB.state.arrows[fen] = arrows.slice();
        DB.persist();
      },
    });

    function stepMove(delta) {
      const next = Math.max(0, Math.min(line.moves.length, repState.currentPly + delta));
      if (next !== repState.currentPly) { repState.currentPly = next; renderRepertoire(app); }
    }
  }

  function tagLabel(t) {
    return ({
      'must-know': 'Must know',
      'nice-to-know': 'Nice to know',
      'surprise': 'Surprise weapon',
      'avoid': 'Avoid',
      'investigate': 'Investigate',
      'coach': 'Coach assigned',
      'tournament': 'Tournament prep',
    })[t] || 'Tracked';
  }

  function tagPillClass(t) {
    return ({
      'must-know':    'pill-good',
      'nice-to-know': 'pill-info',
      'surprise':     'pill-warn',
      'avoid':        'pill-bad',
      'investigate':  'pill-warn',
      'coach':        'pill-info',
      'tournament':   'pill-warn',
    })[t] || 'pill-plain';
  }


  function showLineSummaryDialog(line) {
    const DB = global.OOSData;
    const summary = global.OOSAnalysis.summarizeLine(line, DB.positionsForLine(line.id));
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel' });
    panel.appendChild(el('div', { class: 'eyebrow' }, ['AI/local summary']));
    panel.appendChild(el('h3', {}, [summary.title]));
    panel.appendChild(el('p', { class: 'muted', style: { marginTop: '8px', fontSize: '13px' } }, [summary.summary]));
    if (summary.memoryHooks && summary.memoryHooks.length) panel.appendChild(el('div', { class: 'panel', style: { padding: '10px 12px', marginTop: '10px' } }, [
      el('div', { class: 'eyebrow' }, ['Memory hooks']),
      el('div', { style: { fontSize: '13px', marginTop: '6px' } }, [summary.memoryHooks.join(' · ')]),
    ]));
    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } }, [
      el('button', { class: 'btn', on: { click: () => wrap.remove() } }, ['Close']),
      el('button', { class: 'btn btn-primary', on: { click: () => { copyText(JSON.stringify(summary, null, 2)); global.OOSApp.toast('Summary copied.', 'good'); } } }, ['Copy']),
    ]));
    back.addEventListener('click', () => wrap.remove());
    wrap.appendChild(back); wrap.appendChild(panel); document.body.appendChild(wrap);
  }

  function buildLineQualityMeter(score) {
    return el('div', { class: 'lq-meter', title: 'Line quality score (0–100)' }, [
      el('div', { class: 'ring', style: { '--val': score } }, [el('span', {}, [String(score)])]),
      el('div', {}, [
        el('div', { style: { fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' } }, ['Line quality']),
        el('div', { style: { fontSize: '12.5px', color: 'var(--text-1)' } }, [
          score >= 75 ? 'Strong — keep maintaining' : score >= 50 ? 'Good — fill the gaps' : 'Needs work — add ideas',
        ]),
      ]),
    ]);
  }

  function lineGameCount(lineId) {
    return global.OOSData.importedGames().filter(g => g.lineId === lineId).length;
  }

  function announceMove(text) {
    if (!global.OOSData || !global.OOSData.getSetting('screenReaderMoves', false)) return;
    let live = document.getElementById('oosMoveAnnouncer');
    if (!live) {
      live = document.createElement('div');
      live.id = 'oosMoveAnnouncer';
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = text;
  }

  function displayMove(san) {
    const notation = global.OOSData && global.OOSData.getSetting ? global.OOSData.getSetting('notation', 'san') : 'san';
    if (notation === 'figurine') {
      return String(san || '').replace(/^K/, '♔').replace(/^Q/, '♕').replace(/^R/, '♖').replace(/^B/, '♗').replace(/^N/, '♘');
    }
    if (notation === 'lan') return String(san || '').replace(/[+#?!]+/g, '');
    return san;
  }

  function buildMoveTokens(moves, currentPly, onClick) {
    const tokens = [];
    for (let i = 0; i < moves.length; i++) {
      const moveNum = Math.floor(i / 2) + 1;
      if (i % 2 === 0) tokens.push(el('span', { class: 'move-num' }, [`${moveNum}.`]));
      const cls = 'san' + (i + 1 === currentPly ? ' is-current' : '');
      tokens.push(el('span', { class: cls, title: moves[i], on: { click: () => onClick(i + 1) } }, [displayMove(moves[i])]));
    }
    return tokens;
  }


  function buildLineSurgeryPanel(line, currentPly) {
    const DB = global.OOSData;
    const editable = DB.isUserLine && DB.isUserLine(line.id);
    const currentCard = positionAtPly(line, currentPly);
    const trans = currentCard ? DB.transpositionsFor(currentCard.fen, line.id) : [];
    const inputId = 'insertMove_' + line.id;
    const replyId = 'replyMove_' + line.id;
    const varId = 'variationMoves_' + line.id;
    const kids = [];
    kids.push(el('div', { class: 'eyebrow' }, ['Graph editor']));
    kids.push(el('p', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' } }, [
      editable ? 'Insert/remove moves, create real branch lines, split continuations, mark retired, or merge known transpositions.' : 'Create an editable copy to change this curated line.'
    ]));
    if (!editable) {
      kids.push(el('button', { class: 'btn btn-sm', style: { marginTop: '8px' }, on: { click: () => { const copy = DB.duplicateLine(line.id); global.OOSApp.go('repertoire', { lineId: copy.id, ply: currentPly }); } } }, ['Customize copy']));
      return el('div', { class: 'panel line-surgery' }, kids);
    }
    kids.push(el('div', { class: 'row surgery-row', style: { gap: '6px', marginTop: '10px', flexWrap: 'wrap' } }, [
      el('input', { id: inputId, class: 'input input-sm', placeholder: 'Move to insert, e.g. Nf3', style: { flex: '1', minWidth: '160px' } }),
      el('button', { class: 'btn btn-sm', on: { click: () => {
        const inp = document.getElementById(inputId); const san = inp && inp.value.trim();
        if (!san) return global.OOSApp.toast('Enter a move to insert.', 'warn');
        const res = DB.insertMoveAt(line.id, currentPly, san);
        if (!res || !res.ok) return global.OOSApp.toast((res && res.error) || 'Could not insert move.', 'bad');
        global.OOSApp.toast(res.truncatedAt ? 'Inserted, but later illegal moves were trimmed.' : 'Move inserted.', res.truncatedAt ? 'warn' : 'good');
        global.OOSApp.go('repertoire', { lineId: line.id, ply: currentPly + 1 });
      } } }, ['Insert here']),
      currentPly > 0 ? el('button', { class: 'btn btn-sm btn-ghost', on: { click: () => {
        if (!confirm('Remove move ' + currentPly + ' from this line? Later illegal moves may be trimmed.')) return;
        const res = DB.removeMoveAt(line.id, currentPly);
        if (!res || !res.ok) return global.OOSApp.toast((res && res.error) || 'Could not remove move.', 'bad');
        global.OOSApp.toast(res.truncatedAt ? 'Move removed; later illegal moves were trimmed.' : 'Move removed.', res.truncatedAt ? 'warn' : 'good');
        global.OOSApp.go('repertoire', { lineId: line.id, ply: Math.max(0, currentPly - 1) });
      } } }, ['Remove current']) : null,
    ].filter(Boolean)));
    kids.push(el('div', { class: 'row surgery-row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, [
      el('input', { id: replyId, class: 'input input-sm', placeholder: 'Opponent reply from here', style: { flex: '1', minWidth: '160px' } }),
      el('button', { class: 'btn btn-sm', on: { click: () => {
        const inp = document.getElementById(replyId); const san = inp && inp.value.trim();
        if (!san) return global.OOSApp.toast('Enter the opponent reply.', 'warn');
        const branch = DB.addOpponentReplyFromPosition(line.id, currentPly, san, { name: line.name + ' — ' + san + ' sideline' });
        if (!branch) return global.OOSApp.toast('Could not create reply branch.', 'bad');
        global.OOSApp.toast('Opponent reply branch created.', 'good');
        global.OOSApp.go('repertoire', { lineId: branch.id, ply: currentPly + 1 });
      } } }, ['Add reply branch']),
    ]));
    kids.push(el('textarea', { id: varId, class: 'input', placeholder: 'Side variation moves after current position, e.g. ... c5 Nc3 Nc6', style: { minHeight: '58px', marginTop: '8px' } }));
    kids.push(el('div', { class: 'row surgery-row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn btn-sm', on: { click: () => {
        const ta = document.getElementById(varId); const text = ta && ta.value.trim();
        if (!text) return global.OOSApp.toast('Paste variation moves first.', 'warn');
        const branch = DB.addSideVariation(line.id, currentPly, text, { name: line.name + ' variation from ply ' + currentPly });
        if (!branch) return global.OOSApp.toast('Could not create variation.', 'bad');
        global.OOSApp.toast('Side variation branch created.', 'good');
        global.OOSApp.go('repertoire', { lineId: branch.id, ply: currentPly });
      } } }, ['Create side variation']),
      el('button', { class: 'btn btn-sm', on: { click: () => {
        const branch = DB.splitLineFromPly(line.id, currentPly, { truncateOriginal: false });
        if (!branch) return global.OOSApp.toast('Could not split line.', 'bad');
        global.OOSApp.toast('Split branch created.', 'good');
        global.OOSApp.go('repertoire', { lineId: branch.id, ply: currentPly });
      } } }, ['Split from here']),
      el('button', { class: 'btn btn-sm ' + (line.status === 'retired' ? '' : 'btn-ghost'), on: { click: () => {
        const on = line.status !== 'retired';
        DB.setLineRetired(line.id, on, on ? 'Retired by user' : 'Restored by user');
        global.OOSApp.toast(on ? 'Line retired — hidden from practice.' : 'Line restored.', 'good');
        global.OOSApp.go('repertoire', { lineId: line.id, ply: currentPly });
      } } }, [line.status === 'retired' ? 'Restore line' : 'Retire line']),
    ]));
    if (trans.length) {
      kids.push(el('div', { class: 'mini-transpositions', style: { marginTop: '10px' } }, [
        el('div', { class: 'muted', style: { fontSize: '12px', marginBottom: '6px' } }, ['Merge with a transposed line:']),
        ...trans.slice(0, 3).map(t => el('button', { class: 'btn btn-sm', style: { marginRight: '6px', marginBottom: '6px' }, on: { click: () => {
          DB.mergeLineWithTransposition(line.id, t.lineId);
          global.OOSApp.toast('Merged and retired duplicate transposition line.', 'good');
          global.OOSApp.go('repertoire', { lineId: t.lineId, ply: t.ply - 1 });
        } } }, [t.lineName + ' · ply ' + t.ply]))
      ]));
    }
    const branches = DB.lineBranches ? DB.lineBranches(line.id) : [];
    if (branches.length) {
      kids.push(el('div', { class: 'branch-list', style: { marginTop: '10px' } }, [
        el('div', { class: 'muted', style: { fontSize: '12px', marginBottom: '6px' } }, ['Branches from this line:']),
        ...branches.map(b => el('a', { href: '#repertoire', class: 'branch-link mono', on: { click: (e) => { e.preventDefault(); global.OOSApp.go('repertoire', { lineId: b.id, ply: b.branchFromPly || 0 }); } } }, [b.name]))
      ]));
    }
    return el('div', { class: 'panel line-surgery' }, kids);
  }

  function positionAtPly(line, ply) {
    const positions = global.OOSData.positionsForLine(line.id);
    return positions.find(p => p.ply === ply) || null;
  }

  function computeFenAtPly(line, ply) {
    const c = new global.Chess();
    for (let i = 0; i < ply; i++) {
      c.move(line.moves[i], { sloppy: true });
    }
    return c.fen();
  }

  function buildIdeaCard(card, line) {
    const DB = global.OOSData;
    const srs = DB.srs(card.id);
    const flag = DB.positionFlag ? DB.positionFlag(card.id) : {};
    const ideaCard = DB.ideaCardFor ? DB.ideaCardFor(card.id) : card;
    let status = 'Stable';
    let pillClass = 'pill-good';
    if (!srs || srs.stability < 1.5 || srs.lapses >= 2) { status = 'Weak'; pillClass = 'pill-bad'; }
    else if (srs.stability < 4) { status = 'Learning'; pillClass = 'pill-warn'; }

    const transpositions = DB.transpositionsFor(card.fen, card.lineId);
    const editable = DB.isUserLine && DB.isUserLine(line.id);

    function textField(label, key, placeholder) {
      return el('label', { class: 'idea-edit-field' }, [
        el('span', { class: 'lbl' }, [label]),
        el('textarea', {
          class: 'input',
          placeholder,
          value: ideaCard[key] || '',
          on: { blur: (e) => { if (DB.setIdeaCard) DB.setIdeaCard(card.id, { [key]: e.target.value }); } },
        }),
      ]);
    }

    const body = [
      el('div', { class: 'row-between' }, [
        el('h3', {}, [el('span', { class: 'dot' }), `${line.color === 'w' ? 'White' : 'Black'} to play — move ${Math.ceil(card.ply / 2)}`]),
        el('span', { class: 'pill ' + pillClass }, [status]),
      ]),
      el('div', { class: 'idea-row' }, [
        el('div', { class: 'lbl' }, ['Move']),
        el('div', { class: 'val mono', style: { fontSize: '20px', fontWeight: '600' } }, [displayMove(card.move)]),
      ]),
      (ideaCard.idea || card.idea) ? el('div', { class: 'idea-row' }, [el('div', { class: 'lbl' }, ['Idea']), el('div', { class: 'val' }, [ideaCard.idea || card.idea])]) : null,
      (ideaCard.plan || card.plan) ? el('div', { class: 'idea-row' }, [el('div', { class: 'lbl' }, ['Plan']), el('div', { class: 'val' }, [ideaCard.plan || card.plan])]) : null,
      (ideaCard.hook || card.hook) ? el('div', { class: 'idea-row' }, [el('div', { class: 'lbl' }, ['Memory hook']), el('div', { class: 'val memory' }, ['"' + (ideaCard.hook || card.hook) + '"'])]) : null,
      (ideaCard.mistake || card.mistake) ? el('div', { class: 'idea-row' }, [el('div', { class: 'lbl' }, ['Common mistake']), el('div', { class: 'val' }, [ideaCard.mistake || card.mistake])]) : null,
      flag.critical ? el('div', { class: 'warn-banner compact', style: { marginTop: '10px' } }, [icon(ICONS.target, 13), el('span', {}, ['Critical position', flag.reason ? ' — ' + flag.reason : ''])]) : null,
      transpositions.length ? el('div', { class: 'idea-row' }, [
        el('div', { class: 'lbl' }, ['Also occurs in']),
        el('div', { class: 'val', style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          transpositions.slice(0, 4).map(t => el('a', {
            href: '#repertoire', class: 'mono', style: { color: 'var(--accent)', fontSize: '12.5px' },
            on: { click: (e) => { e.preventDefault(); global.OOSApp.go('repertoire', { lineId: t.lineId, ply: t.ply - 1 }); } },
          }, [`${t.lineName} · ply ${t.ply}`]))
        ),
      ]) : null,
      el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', marginTop: '12px' } }, [
        el('button', { class: 'btn btn-sm ' + (flag.critical ? 'is-active' : ''), on: { click: () => {
          DB.markPositionCritical(card.id, !flag.critical, !flag.critical ? 'Marked from idea card' : '');
          global.OOSApp.toast(!flag.critical ? 'Marked critical.' : 'Critical flag removed.', 'good');
          global.OOSApp.go('repertoire', { lineId: line.id, ply: card.ply });
        } } }, [flag.critical ? '✓ Critical' : 'Mark critical']),
        editable ? el('button', { class: 'btn btn-sm', on: { click: () => { const share = DB.createShareSnapshot('line', line.id); copyText(JSON.stringify(share.payload, null, 2)); global.OOSApp.toast('Share snapshot copied.', 'good'); } } }, ['Copy share snapshot']) : null,
      ].filter(Boolean)),
    ].filter(Boolean);

    if (editable) {
      body.push(el('details', { class: 'idea-edit', open: false }, [
        el('summary', {}, ['Edit idea card fields']),
        textField('Idea', 'idea', 'Why is this move played?'),
        textField('Plan', 'plan', 'What plan or pawn break follows?'),
        textField('Memory hook', 'hook', 'Short phrase that makes it stick'),
        textField('Common mistake', 'mistake', 'What should the user avoid?'),
        textField('Source reference', 'sourceRef', 'Book / coach / database / game source'),
        textField('Model game', 'modelGame', 'Related model game or PGN reference'),
        el('div', { class: 'muted', style: { fontSize: '11.5px', marginTop: '6px' } }, ['Fields save on blur and are attached to the normalized position, so transpositions can reuse the same idea.']),
      ]));
    }

    return el('div', { class: 'idea-card' }, body);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
  }

  function openHistoryDialog(noteId) {
    const DB = global.OOSData;
    const note = DB.notesFor(noteId);
    const history = note.history || [];
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel' });
    panel.appendChild(el('div', { class: 'eyebrow' }, ['Note history']));
    panel.appendChild(el('h3', { style: { marginTop: '6px' } }, [`${history.length} previous version${history.length === 1 ? '' : 's'}`]));
    if (!history.length) {
      panel.appendChild(el('p', { class: 'muted', style: { fontSize: '13px', marginTop: '8px' } }, ['No history yet. Edits will be tracked here.']));
    } else {
      const list = el('div', { class: 'stack', style: { marginTop: '12px', gap: '8px' } });
      history.forEach((h, i) => {
        const when = new Date(h.at).toLocaleString();
        list.appendChild(el('div', { class: 'panel', style: { padding: '10px 12px' } }, [
          el('div', { class: 'row-between' }, [
            el('div', { class: 'mono', style: { fontSize: '11.5px', color: 'var(--text-2)' } }, [when]),
            el('button', { class: 'btn btn-sm', on: { click: () => {
              DB.restoreNote(noteId, i); wrap.remove();
              const app = document.getElementById('app');
              global.OOSApp.go('repertoire');
              global.OOSApp.toast('Restored earlier version', 'good');
            } } }, ['Restore']),
          ]),
          el('div', { style: { fontSize: '12.5px', color: 'var(--text-1)', marginTop: '6px', whiteSpace: 'pre-wrap' } }, [h.text || '(empty)']),
        ]));
      });
      panel.appendChild(list);
    }
    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [
      el('button', { class: 'btn', on: { click: () => wrap.remove() } }, ['Close']),
    ]));
    back.addEventListener('click', () => wrap.remove());
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }

  // ----------------------------------------------------------------------
  // PRACTICE
  // ----------------------------------------------------------------------
  let practiceCtx = null; // { session, board, mode, feedback, hint, conceptOpen }

  const PRACTICE_MODES = [
    { id: 'daily',     name: 'Daily review',  desc: 'Cards due today',         icon: 'play' },
    { id: 'weak',      name: 'Weak only',     desc: 'High miss rate',          icon: 'target' },
    { id: 'learn',     name: 'Learn new',     desc: 'See idea, then play',     icon: 'book' },
    { id: 'blind',     name: 'Blind recall',  desc: 'No hints. Tournament prep.', icon: 'fix' },
    { id: 'speed',     name: 'Speed drill',   desc: '8s per move',             icon: 'bolt' },
    { id: 'classical', name: 'Classical',     desc: '"Why this move?"',        icon: 'sparkle' },
    { id: 'warmup',    name: 'Warmup',        desc: '5 must-know cards',       icon: 'trophy' },
  ];

  function renderPractice(app, opts = {}) {
    practiceCtx = practiceCtx || {};
    if (!practiceCtx.session || opts.fresh) {
      practiceCtx = {};
      renderPracticePre(app, opts);
      return;
    }
    renderPracticeActive(app);
  }

  function renderPracticePre(app, opts = {}) {
    const DB = global.OOSData;
    const allPositions = DB.allPositions();
    const due = DB.duePositions();
    const weak = DB.weakPositions();
    const isTour = DB.isTournament();
    const focusName = (weak[0] || due[0] || allPositions[0] || {}).name || 'your repertoire';

    // Default mode: Settings can override normal days; tournament still prefers warmup.
    const selectedMode = practiceCtx._mode || (isTour ? 'warmup' : DB.getSetting('defaultPracticeMode', 'daily'));
    practiceCtx._mode = selectedMode;

    app.innerHTML = '';
    const root = el('div', { class: 'practice-pre' });

    // Brand-new profile, nothing to practice yet.
    if (allPositions.length === 0) {
      root.appendChild(el('div', { class: 'empty large' }, [
        el('div', { class: 'icon' }, [icon(ICONS.book, 22)]),
        el('h3', {}, ['Nothing to practice yet']),
        el('p', {}, ['Add a line first — clone a starter from the Library, paste a PGN, or import games. Once you have lines, every position becomes a trainable card.']),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn btn-primary', on: { click: () => global.OOSApp.go('library') } }, ['Open library']),
          el('button', { class: 'btn', on: { click: () => global.OOSApp.openImport() } }, [icon(ICONS.upload, 14), 'Import PGN']),
          el('button', { class: 'btn', on: { click: () => global.OOSViews.showLineCreationWizard(() => global.OOSApp.go('practice', { fresh: true })) } }, ['Build manually']),
        ]),
      ]));
      app.appendChild(root);
      return;
    }

    root.appendChild(el('div', { class: 'eyebrow' }, [isTour ? 'Tournament warmup' : "Today's review"]));
    root.appendChild(el('h1', {}, [`${due.length} position${due.length === 1 ? '' : 's'} ready`]));
    root.appendChild(el('div', { class: 'subtitle' }, [
      isTour
        ? 'Confidence pass. Focus on must-know and weak critical positions only.'
        : due.length > 0
          ? 'A short, focused session — not a marathon.'
          : 'You\'re caught up. Switch modes to keep building.',
    ]));

    root.appendChild(el('div', { class: 'stats' }, [
      el('div', { class: 'stat' }, [
        el('div', { class: 'num' }, [String(Math.min(25, due.length))]),
        el('div', { class: 'lbl' }, ['Due']),
      ]),
      el('div', { class: 'stat' }, [
        el('div', { class: 'num' }, [String(allPositions.length)]),
        el('div', { class: 'lbl' }, ['Total']),
      ]),
      el('div', { class: 'stat' }, [
        el('div', { class: 'num' }, [String(weak.length)]),
        el('div', { class: 'lbl' }, ['Weak']),
      ]),
    ]));

    root.appendChild(el('div', { class: 'focus-row' }, [
      icon(ICONS.target, 14),
      el('span', { class: 'muted' }, ['Focus:']),
      el('span', { class: 'mono' }, [focusName]),
    ]));

    // Mode picker
    root.appendChild(el('div', { class: 'eyebrow', style: { textAlign: 'left', marginBottom: '8px' } }, ['Choose a mode']));
    const picker = el('div', { class: 'mode-picker' });
    PRACTICE_MODES.forEach(m => {
      const active = m.id === selectedMode;
      if (isTour && (m.id === 'learn' || m.id === 'classical')) return;
      picker.appendChild(el('div', {
        class: 'mode-chip' + (active ? ' is-active' : ''),
        on: { click: () => { practiceCtx._mode = m.id; renderPracticePre(app, opts); } },
      }, [
        el('div', { class: 'mc-name' }, [icon(ICONS[m.icon], 12), m.name]),
        el('div', { class: 'mc-meta' }, [m.desc]),
      ]));
    });
    root.appendChild(picker);

    const resume = DB.activeSession && DB.activeSession();
    root.appendChild(el('div', { class: 'actions' }, [
      resume ? el('button', {
        class: 'btn btn-lg',
        on: { click: () => { const ses = global.OOSPractice.PracticeSession.fromSnapshot(resume); if (ses) { practiceCtx = { session: ses, mode: resume.mode || 'daily', feedback: null, hint: null, conceptOpen: false, conceptResult: null, mounted: false, timerLeft: 0, timerHandle: null }; renderPracticeActive(app); } } },
      }, ['Resume saved session']) : null,
      el('button', {
        class: 'btn btn-primary btn-lg',
        on: { click: () => startSession(app, pickCardsForMode(selectedMode), { mode: selectedMode }) },
      }, [icon(ICONS.play, 14), startButtonLabel(selectedMode)]),
      el('button', {
        class: 'btn btn-lg',
        on: { click: () => global.OOSApp.go('repertoire') },
      }, ['Open repertoire']),
    ].filter(Boolean)));

    app.appendChild(root);
  }

  function startButtonLabel(mode) {
    return ({
      daily: 'Start review',
      weak: 'Drill weak now',
      learn: 'Learn new theory',
      blind: 'Start blind drill',
      speed: 'Start speed drill',
      classical: 'Start classical drill',
      warmup: 'Start warmup',
    })[mode] || 'Start';
  }

  function pickCardsForMode(mode) {
    const DB = global.OOSData;
    const due = DB.duePositions();
    const weak = DB.weakPositions();
    const all = DB.allPositions();
    const newCards = all.filter(p => {
      const c = DB.srs(p.id);
      return !c || (c.reps || 0) === 0;
    });
    switch (mode) {
      case 'weak':    return weak.length ? weak : due;
      // Learn-new should genuinely target cards the user has never reviewed.
      case 'learn':   return newCards.length ? newCards : all;
      case 'blind':   return due.length ? due : all;
      case 'speed':   return due.length ? due : all;
      case 'classical': return due.length ? due : all;
      // Warmup: must-know lines first, then any reviewed-stable cards as fallback.
      case 'warmup': {
        const must = all.filter(p => {
          const ln = DB.line(p.lineId);
          return ln && ln.tag === 'must-know';
        });
        if (must.length) return must.slice(0, 5);
        const stable = all.filter(p => {
          const c = DB.srs(p.id);
          return c && c.stability >= 4 && c.lapses === 0;
        });
        return stable.slice(0, 5).length ? stable.slice(0, 5) : all.slice(0, 5);
      }
      case 'daily':
      default:        return due;
    }
  }

  function startSession(app, cards, options = {}) {
    if (!cards || cards.length === 0) {
      global.OOSApp.toast('No cards available for this mode', 'warn');
      return;
    }
    practiceCtx = {
      session: new global.OOSPractice.PracticeSession(cards, options),
      mode: options.mode || 'daily',
      feedback: null,
      hint: null,
      conceptOpen: false,
      conceptResult: null,
      mounted: false,
      timerLeft: 0,
      timerHandle: null,
    };
    renderPracticeActive(app);
  }

  function renderPracticeActive(app) {
    const ctx = practiceCtx;
    if (ctx.session.isComplete()) return renderPracticeComplete(app);

    if (ctx.mounted && ctx.sideEl && ctx.cardId === ctx.session.current().id) {
      ctx.board.setInteractive(!ctx.feedback);
      ctx.sideEl.innerHTML = '';
      buildSidePanel(app, ctx.sideEl);
      return;
    }
    mountPracticeView(app);
  }

  function mountPracticeView(app) {
    const ctx = practiceCtx;
    const card = ctx.session.current();
    const prog = ctx.session.progress();

    // Stop any running timer from previous card
    if (ctx.timerHandle) { clearInterval(ctx.timerHandle); ctx.timerHandle = null; }

    app.innerHTML = '';
    const root = el('div', { class: 'practice-active' });

    const left = el('div', { class: 'practice-board-wrap', style: { position: 'relative' } });
    left.appendChild(el('div', { class: 'practice-prompt' }, [
      el('div', { class: 'row', style: { gap: '8px' } }, [
        el('span', { class: 'pill pill-info pill-plain' }, [card.eco]),
        el('span', { class: 'pill pill-plain' }, [modeLabel(ctx.mode)]),
        el('span', { class: 'who' }, [
          'You are ',
          el('span', { class: 'you' }, [card.color === 'w' ? 'White' : 'Black']),
          '.',
        ]),
      ]),
      el('div', { class: 'progress' }, [`${prog.current} / ${prog.total}`]),
    ]));
    const boardHost = el('div', { class: 'chess-board', 'aria-label': `Chess position. ${card.color === 'w' ? 'White' : 'Black'} to move. After ${card.historyBefore || 'starting position'}.` });
    left.appendChild(boardHost);

    // Timer ribbon for speed mode
    if (ctx.mode === 'speed') {
      const timer = el('div', { class: 'practice-timer' }, ['8.0s']);
      left.appendChild(timer);
      ctx.timerEl = timer;
      ctx.timerLeft = 8.0;
      ctx.timerHandle = setInterval(() => {
        ctx.timerLeft -= 0.1;
        if (ctx.timerEl) {
          ctx.timerEl.textContent = ctx.timerLeft.toFixed(1) + 's';
          if (ctx.timerLeft < 3) ctx.timerEl.classList.add('urgent');
        }
        if (ctx.timerLeft <= 0) {
          clearInterval(ctx.timerHandle); ctx.timerHandle = null;
          // Force "Again" grade on timeout
          ctx.feedback = { kind: 'timeout', expected: card.move, played: '(timeout)', message: 'Time up — review sooner.', idea: card.idea, durationMs: ctx.session.elapsedForCard ? ctx.session.elapsedForCard() : 0 };
          ctx.board && ctx.board.shakeIt();
          ctx.board.setInteractive(false);
          buildSidePanelInPlace(app);
        }
      }, 100);
    }

    root.appendChild(left);

    const side = el('div', { class: 'practice-side' });
    root.appendChild(side);
    app.appendChild(root);

    ctx.board = new global.OOSBoard(boardHost, {
      fen: card.fen,
      orientation: card.color === 'b' ? 'black' : 'white',
      interactive: true,
      annotations: global.OOSData.arrowsFor(card.fen),
      showCoords: global.OOSData.getSetting('coords', true),
      onAnnotate: ({ fen, arrows }) => {
        global.OOSData.state.arrows[fen] = arrows.slice();
        global.OOSData.persist();
      },
      onMove: (move) => onPracticeMove(app, move),
    });
    ctx.mounted = true;
    ctx.sideEl = side;
    ctx.cardId = card.id;
    buildSidePanel(app, side);
  }

  function modeLabel(mode) {
    const m = PRACTICE_MODES.find(x => x.id === mode);
    return m ? m.name : 'Practice';
  }

  function buildSidePanel(app, side) {
    const ctx = practiceCtx;
    const card = ctx.session.current();
    side.appendChild(el('div', { class: 'eyebrow' }, ['Position']));
    side.appendChild(el('div', { class: 'mono', style: { fontSize: '12px', color: 'var(--text-1)' } }, [
      card.name + ' — ' + (card.historyBefore || 'starting position'),
    ]));

    // In learn-new mode: show idea card BEFORE the move is required.
    if (ctx.mode === 'learn' && !ctx.feedback && !ctx.learnRevealed) {
      side.appendChild(buildLearnPreview(app, card));
      return;
    }

    if (ctx.feedback) {
      // Concept question (classical mode) — only after a correct move and not yet asked.
      if (ctx.mode === 'classical' && ctx.feedback.kind === 'correct' && card.plan && !ctx.conceptResult) {
        side.appendChild(buildConceptQuestion(app, card));
      } else {
        side.appendChild(buildFeedbackPanel(ctx.feedback, card));
        side.appendChild(buildPostFeedbackActions(app, ctx.feedback, card));
        side.appendChild(buildGradeRow());
        side.appendChild(el('div', { class: 'muted', style: { fontSize: '11.5px', textAlign: 'center', marginTop: '4px' } }, ['Press 1–4 to grade · N for note · Space to continue']));
      }
    } else {
      const promptText = ctx.mode === 'blind'
        ? 'Recall the move. No hints in blind mode.'
        : 'Make your move on the board. Use Hint if stuck.';
      const showHint = ctx.mode !== 'blind';
      side.appendChild(el('div', { class: 'stack', style: { marginTop: '4px' } }, [
        el('div', { class: 'muted', style: { fontSize: '13px' } }, [promptText]),
        ctx.hint ? el('div', { class: 'hint-line' }, [icon(ICONS.sparkle, 14), ctx.hint.text]) : null,
        el('div', { class: 'row', style: { gap: '8px', marginTop: '12px' } }, [
          showHint ? el('button', { class: 'btn btn-sm', on: { click: () => { ctx.hint = ctx.session.nextHint(); buildSidePanelInPlace(app); } } }, [icon(ICONS.sparkle, 12), 'Hint']) : null,
          el('button', { class: 'btn btn-sm', on: { click: () => skipCard(app) } }, ['Skip']),
          el('button', { class: 'btn btn-sm btn-ghost', style: { marginLeft: 'auto' }, on: { click: () => endSession(app) } }, ['End session']),
        ]),
      ]));
    }
  }

  function buildLearnPreview(app, card) {
    return el('div', { class: 'stack', style: { marginTop: '4px' } }, [
      el('div', { class: 'idea-card', style: { padding: '14px' } }, [
        el('h3', { style: { marginBottom: '10px' } }, [
          el('span', { class: 'dot' }), `Learn: ${card.move}`,
        ]),
        card.idea ? el('div', { class: 'idea-row' }, [
          el('div', { class: 'lbl' }, ['Idea']),
          el('div', { class: 'val' }, [card.idea]),
        ]) : null,
        card.plan ? el('div', { class: 'idea-row' }, [
          el('div', { class: 'lbl' }, ['Plan']),
          el('div', { class: 'val' }, [card.plan]),
        ]) : null,
        card.hook ? el('div', { class: 'idea-row' }, [
          el('div', { class: 'lbl' }, ['Memory hook']),
          el('div', { class: 'val memory' }, ['"' + card.hook + '"']),
        ]) : null,
      ]),
      el('button', {
        class: 'btn btn-primary',
        on: { click: () => { practiceCtx.learnRevealed = true; buildSidePanelInPlace(app); } },
      }, ['Got it — now play the move']),
    ]);
  }

  function buildConceptQuestion(app, card) {
    // Build a quick concept question from the card data.
    const q = makeConceptQuestion(card);
    const ctx = practiceCtx;
    return el('div', { class: 'concept-q' }, [
      el('div', { class: 'q' }, [q.q]),
      el('div', { class: 'options' },
        q.options.map((opt, i) => el('button', {
          class: 'opt' + (ctx.conceptResult ? (opt.correct ? ' right' : (ctx.conceptPick === i ? ' wrong' : '')) : '') + (ctx.conceptResult ? ' disabled' : ''),
          on: { click: () => {
            ctx.conceptPick = i;
            ctx.conceptResult = opt.correct ? 'right' : 'wrong';
            buildSidePanelInPlace(app);
          } },
        }, [opt.label])),
      ),
      ctx.conceptResult ? el('div', { class: 'row', style: { marginTop: '14px', gap: '8px' } }, [
        el('div', { class: 'muted', style: { fontSize: '12.5px', flex: '1' } }, [
          ctx.conceptResult === 'right' ? 'Right idea — that proves you understand the position.' : 'The plan is the soul of opening prep. Review the idea card.',
        ]),
        el('button', { class: 'btn btn-sm btn-primary', on: { click: () => { ctx.conceptResult = null; ctx.conceptPick = null; buildSidePanelInPlace(app); } } }, ['Continue to grade']),
      ]) : null,
    ]);
  }

  function makeConceptQuestion(card) {
    // Heuristic generator. For real product, store these per card.
    if (card.move && /^[a-h]\d|^[a-h]x|c[345]|f[346]|e[346]|b[345]|g[345]/.test(card.move)) {
      return {
        q: `What's the strategic theme behind ${card.move}?`,
        options: [
          { label: card.plan || 'Build pressure on the centre and prepare a thematic break.', correct: true },
          { label: 'Trade pieces and head for an endgame.', correct: false },
          { label: 'Sacrifice for a kingside attack.', correct: false },
          { label: 'Castle queenside immediately.', correct: false },
        ],
      };
    }
    return {
      q: `Why is ${card.move} the right move here?`,
      options: [
        { label: card.idea || 'It develops a piece toward the centre with concrete purpose.', correct: true },
        { label: 'It threatens an immediate tactic.', correct: false },
        { label: 'It blocks the opponent from castling.', correct: false },
        { label: 'It prepares a queenside expansion.', correct: false },
      ],
    };
  }

  function buildPostFeedbackActions(app, fb, card) {
    const isCorrectish = fb.kind === 'correct' || fb.kind === 'correct-alt' || fb.kind === 'correct-transposition';
    if (isCorrectish) {
      return el('div', { class: 'fb-actions', style: { marginTop: '10px' } }, [
        el('button', { class: 'btn btn-sm', on: { click: () => showFullLineDialog(card) } }, ['Show full line']),
        el('button', { class: 'btn btn-sm', on: { click: () => { global.OOSApp.go('repertoire', { lineId: card.lineId, ply: card.ply - 1 }); global.OOSApp.toast('Open the Notes panel on the right.', 'info'); } } }, [icon(ICONS.add, 12), 'Add note']),
        el('button', { class: 'btn btn-sm', on: { click: () => { if (practiceCtx && practiceCtx.session && practiceCtx.session.markGuessed) practiceCtx.session.markGuessed(); global.OOSApp.toast('Marked guessed — review sooner', 'info'); global.OOSApp.applyGrade(2); } } }, ['I guessed — review sooner']),
      ]);
    }
    // Wrong-move actions: every button persists state.
    const meta = global.OOSData.cardMetaFor(card.id);
    const altSans = (meta.alternates || []).map(a => typeof a === 'string' ? a : a.san);
    const isAlreadyAlt = altSans.some(a => String(a || '').replace(/[+#?!]+/g, '') === String(fb.played || '').replace(/[+#?!]+/g, ''));
    const isConfusing = !!meta.confusing;
    return el('div', { class: 'fb-actions', style: { marginTop: '10px' } }, [
      el('button', { class: 'btn btn-sm', on: { click: () => tryAgain(app) } }, ['Try again']),
      el('button', {
        class: 'btn btn-sm' + (isAlreadyAlt ? ' is-active' : ''),
        on: { click: () => {
          if (isAlreadyAlt) {
            global.OOSData.removeAlternate(card.id, fb.played);
            global.OOSApp.toast(`Removed ${fb.played} from alternates`, 'info');
          } else {
            if (global.OOSData.addAlternateToCard) global.OOSData.addAlternateToCard(card.id, fb.played, fb.playedFen || '');
            else global.OOSData.addAlternate(card.id, fb.played);
            global.OOSApp.toast(`${fb.played} accepted as alternate. Checking quality…`, 'good');
            if (global.OOSData.validateAlternateForCard) global.OOSData.validateAlternateForCard(card.id, fb.played, fb.playedFen || '').then(result => {
              const label = result.verdict === 'good' ? 'validated as playable' : result.verdict === 'risky' ? 'marked risky' : 'saved as unverified';
              global.OOSApp.toast(`Alternate ${label}: ${result.reason || result.source || ''}`.trim(), result.verdict === 'risky' ? 'warn' : 'info');
            });
          }
          buildSidePanelInPlace(app);
        } },
      }, [isAlreadyAlt ? '✓ Alternate saved' : 'Accept as alternate']),
      el('button', { class: 'btn btn-sm', on: { click: () => showCompareMovesDialog(card, fb) } }, ['Compare moves']),
      el('button', {
        class: 'btn btn-sm' + (isConfusing ? ' is-active' : ''),
        on: { click: () => {
          global.OOSData.setConfusing(card.id, !isConfusing);
          global.OOSApp.toast(isConfusing ? 'Cleared "confusing" flag' : 'Marked as confusing — will surface in Insights.', 'info');
          buildSidePanelInPlace(app);
        } },
      }, [isConfusing ? '✓ Confusing' : 'Mark as confusing']),
    ]);
  }

  function showFullLineDialog(card) {
    const DB = global.OOSData;
    const line = DB.line(card.lineId);
    if (!line) return global.OOSApp.toast('No line context.', 'warn');
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel' });
    panel.appendChild(el('div', { class: 'eyebrow' }, ['Full line']));
    panel.appendChild(el('h3', {}, [line.name]));
    panel.appendChild(el('div', { class: 'mono', style: { marginTop: '12px', padding: '12px', background: 'var(--bg-2)', borderRadius: 'var(--r-1)', fontSize: '13px', lineHeight: '1.9' } },
      line.moves.map((m, i) => {
        const isCurrent = i + 1 === card.ply;
        const moveNum = i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : '';
        return el('span', {
          style: { color: isCurrent ? 'var(--accent)' : 'var(--text-1)', fontWeight: isCurrent ? '600' : '400' },
        }, [moveNum + m + ' ']);
      })
    ));
    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [
      el('button', { class: 'btn', on: { click: () => wrap.remove() } }, ['Close']),
    ]));
    back.addEventListener('click', () => wrap.remove());
    wrap.appendChild(back); wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }

  function showCompareMovesDialog(card, fb) {
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel' });
    panel.appendChild(el('div', { class: 'eyebrow' }, ['Compare moves']));
    panel.appendChild(el('h3', {}, [`${fb.expected} vs ${fb.played}`]));
    panel.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' } }, [
      el('div', { class: 'panel', style: { padding: '12px 14px' } }, [
        el('div', { class: 'eyebrow' }, ['Prepared']),
        el('div', { class: 'mono', style: { fontSize: '20px', fontWeight: 600, color: 'var(--good)', marginTop: '4px' } }, [fb.expected]),
        card.idea ? el('div', { style: { fontSize: '12.5px', color: 'var(--text-1)', marginTop: '8px' } }, [card.idea]) : null,
        card.plan ? el('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginTop: '6px' } }, [card.plan]) : null,
      ]),
      el('div', { class: 'panel', style: { padding: '12px 14px' } }, [
        el('div', { class: 'eyebrow' }, ['You played']),
        el('div', { class: 'mono', style: { fontSize: '20px', fontWeight: 600, color: 'var(--bad)', marginTop: '4px' } }, [fb.played]),
        card.mistake ? el('div', { style: { fontSize: '12.5px', color: 'var(--text-1)', marginTop: '8px' } }, [card.mistake]) : el('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' } }, ['Legal but outside your repertoire.']),
      ]),
    ]));
    panel.appendChild(el('div', { class: 'muted', style: { fontSize: '12px', marginTop: '12px' } }, [
      'Tip: if you decide ', fb.played, ' is genuinely playable for you, click "Accept as alternate" to add it to this card.',
    ]));
    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [
      el('button', { class: 'btn', on: { click: () => wrap.remove() } }, ['Close']),
    ]));
    back.addEventListener('click', () => wrap.remove());
    wrap.appendChild(back); wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }

  function tryAgain(app) {
    const ctx = practiceCtx;
    if (!ctx) return;
    const card = ctx.session.current();
    ctx.feedback = null;
    ctx.hint = null;
    // Reset board to original FEN
    if (ctx.board) {
      ctx.board.setFen(card.fen);
      ctx.board.setInteractive(true);
    }
    buildSidePanelInPlace(app);
  }

  function buildSidePanelInPlace(app) {
    const ctx = practiceCtx;
    if (!ctx.sideEl) return;
    ctx.sideEl.innerHTML = '';
    buildSidePanel(app, ctx.sideEl);
  }

  function skipCard(app) {
    const ctx = practiceCtx;
    if (ctx.timerHandle) { clearInterval(ctx.timerHandle); ctx.timerHandle = null; }
    const card = ctx.session.current();
    // Skip = "Again" for SRS purposes. Persist it once.
    if (card) global.OOSData.grade(card.id, 1, { mode: ctx.mode, skipped: true, outcome: 'skipped', durationMs: ctx.session.elapsedForCard ? ctx.session.elapsedForCard() : 0 });
    ctx.session.grade(1, { outcome: 'skipped', durationMs: ctx.session.elapsedForCard ? ctx.session.elapsedForCard() : 0 });
    ctx.feedback = null;
    ctx.hint = null;
    ctx.mounted = false;
    ctx.learnRevealed = false;
    if (ctx.session.isComplete()) return renderPracticeComplete(app);
    renderPracticeActive(app);
  }

  function buildFeedbackPanel(fb, card) {
    const isCorrectish = fb.kind === 'correct' || fb.kind === 'correct-alt' || fb.kind === 'correct-transposition';
    if (isCorrectish) {
      const head = fb.kind === 'correct' ? `Correct: ${card.move}` : fb.kind === 'correct-alt' ? `Accepted alternate: ${fb.played}` : `Transposition accepted: ${fb.played}`;
      return el('div', { class: 'feedback correct' }, [
        el('div', { class: 'head' }, [icon(ICONS.check, 14), head]),
        el('div', { class: 'body' }, [
          card.idea ? el('span', {}, [card.idea]) : el('span', {}, ['Right repertoire move.']),
        ]),
      ]);
    }
    if (fb.kind === 'correct-alt') {
      return el('div', { class: 'feedback correct' }, [
        el('div', { class: 'head' }, [icon(ICONS.check, 14), `Accepted alternate: ${fb.played}`]),
        el('div', { class: 'body' }, [
          `Your prep move is ${card.move}, but you've added ${fb.played} as an accepted alternate.`,
        ]),
      ]);
    }
    if (fb.kind === 'correct-transposition') {
      return el('div', { class: 'feedback correct' }, [
        el('div', { class: 'head' }, [icon(ICONS.check, 14), `Same position: ${fb.played}`]),
        el('div', { class: 'body' }, [
          `${fb.played} reaches the same position as ${card.move} — that's a transposition, not a deviation.`,
        ]),
      ]);
    }
    const reveal = global.OOSData.getSetting('revealOnWrong', true) !== false;
    return el('div', { class: 'feedback wrong' }, [
      el('div', { class: 'head' }, [icon(ICONS.x, 14), fb.kind === 'legal-known-position' ? 'Legal, but not this prep' : fb.kind === 'outside-prep' ? 'Outside your repertoire' : 'Not your prepared move']),
      el('div', { class: 'body' }, reveal ? [
        'You played ', el('span', { class: 'mono' }, [fb.played]),
        '. Your prepared move is ', el('span', { class: 'mono' }, [fb.expected]),
        card.idea ? ' — ' + card.idea : '.',
        fb.knownLines && fb.knownLines.length ? ' It also appears in: ' + fb.knownLines.join(', ') + '.' : '',
      ] : [
        'You played ', el('span', { class: 'mono' }, [fb.played]),
        '. Reveal is off in Settings, so try again or use Compare moves when ready.',
      ]),
    ]);
  }

  function buildGradeRow() {
    const grades = [
      { g: 1, name: 'Again', key: '1' },
      { g: 2, name: 'Hard',  key: '2' },
      { g: 3, name: 'Good',  key: '3' },
      { g: 4, name: 'Easy',  key: '4' },
    ];
    return el('div', { class: 'grade-row' },
      grades.map(({ g, name, key }) => el('button', {
        class: 'grade-btn',
        data: { grade: String(g) },
        on: { click: () => global.OOSApp.applyGrade(g) },
      }, [
        el('span', { class: 'name' }, [name]),
        el('span', { class: 'key' }, [key]),
      ]))
    );
  }

  function onPracticeMove(app, move) {
    const ctx = practiceCtx;
    if (!ctx.session) return;
    if (ctx.timerHandle) { clearInterval(ctx.timerHandle); ctx.timerHandle = null; }
    const card = ctx.session.current();
    const cardMeta = card ? global.OOSData.cardMetaFor(card.id) : null;
    const attemptedFen = ctx.board ? ctx.board.fen() : null;
    const result = ctx.session.evaluate(move.san, attemptedFen, cardMeta);
    ctx.feedback = result;
    announceMove(`You played ${move.san}. ${result.message || ''}`);
    if (!['correct','correct-alt','correct-transposition'].includes(result.kind)) {
      // Persist wrong/outside-prep move so the user can review the pattern later.
      if (card) global.OOSData.recordWrongMove(card.id, move.san);
      ctx.board && ctx.board.shakeIt();
      if (global.OOSAudio) global.OOSAudio.wrong();
    } else if (result.kind === 'correct' || result.kind === 'correct-alt' || result.kind === 'correct-transposition') {
      if (global.OOSAudio) global.OOSAudio.correct();
    }
    renderPracticeActive(app);
  }

  function applyGrade(g) {
    const ctx = practiceCtx;
    if (!ctx || !ctx.session || !ctx.feedback) return;
    const card = ctx.session.current();
    const fbKind = ctx.feedback.kind;
    const isCorrectish = fbKind === 'correct' || fbKind === 'correct-alt' || fbKind === 'correct-transposition';
    let actual = g;
    if (!isCorrectish && g >= 3) actual = 1;
    if (isCorrectish && ctx.session.hintUsed() && g >= 3) actual = 2;
    // Slight downgrade if it was an alternate/transposition rather than the
    // exact prep move — encourages users to consolidate the canonical move.
    if ((fbKind === 'correct-alt' || fbKind === 'correct-transposition') && g === 4) actual = 3;
    global.OOSData.grade(card.id, actual, {
      mode: ctx.mode,
      result: fbKind,
      outcome: isCorrectish ? 'correct' : fbKind,
      played: ctx.feedback.played,
      expected: ctx.feedback.expected,
      hintUsed: ctx.session.hintUsed(),
      guessed: ctx.session.guessed || false,
      durationMs: ctx.feedback.durationMs || (ctx.session.elapsedForCard ? ctx.session.elapsedForCard() : 0),
      conceptResult: ctx.conceptResult || null,
    });
    const done = ctx.session.grade(actual, { outcome: isCorrectish ? 'correct' : fbKind, guessed: ctx.session.guessed || false, durationMs: ctx.feedback.durationMs || (ctx.session.elapsedForCard ? ctx.session.elapsedForCard() : 0) });
    ctx.feedback = null;
    ctx.hint = null;
    ctx.mounted = false;
    ctx.cardId = null;
    ctx.learnRevealed = false;
    ctx.conceptResult = null;
    ctx.conceptPick = null;
    if (ctx.timerHandle) { clearInterval(ctx.timerHandle); ctx.timerHandle = null; }
    const app = document.getElementById('app');
    if (done) renderPracticeComplete(app); else renderPracticeActive(app);
  }

  function endSession(app) {
    if (practiceCtx && practiceCtx.timerHandle) { clearInterval(practiceCtx.timerHandle); }
    if (global.OOSData && global.OOSData.clearActiveSession) global.OOSData.clearActiveSession();
    practiceCtx = {};
    renderPracticePre(app);
  }

  function renderPracticeComplete(app) {
    const DB = global.OOSData;
    const session = practiceCtx.session;
    const total = session.results.length;
    const correct = session.results.filter(r => r.grade >= 3).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const minutes = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));

    practiceCtx = {};
    app.innerHTML = '';
    const root = el('div', { class: 'practice-pre' });
    root.appendChild(el('div', { class: 'eyebrow' }, ['Session complete']));
    root.appendChild(el('h1', {}, [`${correct}/${total} stronger`]));
    root.appendChild(el('div', { class: 'subtitle' }, [
      `${pct}% on prep moves · ${minutes} minute${minutes === 1 ? '' : 's'} · review queue updated.`,
    ]));
    root.appendChild(el('div', { class: 'stats' }, [
      el('div', { class: 'stat' }, [el('div', { class: 'num' }, [String(correct)]), el('div', { class: 'lbl' }, ['Correct'])]),
      el('div', { class: 'stat' }, [el('div', { class: 'num' }, [String(total - correct)]), el('div', { class: 'lbl' }, ['To repeat'])]),
      el('div', { class: 'stat' }, [el('div', { class: 'num' }, [String(DB.duePositions().length)]), el('div', { class: 'lbl' }, ['Still due'])]),
    ]));
    root.appendChild(el('div', { class: 'actions' }, [
      el('button', { class: 'btn btn-primary btn-lg', on: { click: () => global.OOSApp.go('today') } }, ['Back to today']),
      el('button', { class: 'btn btn-lg', on: { click: () => renderPracticePre(app) } }, ['Another session']),
    ]));
    app.appendChild(root);
  }

  // ----------------------------------------------------------------------
  // GAMES
  // ----------------------------------------------------------------------
  let gamesState = { selected: null, importing: false };

  function renderGames(app, opts = {}) {
    const DB = global.OOSData;
    const games = DB.importedGames();
    if (!gamesState.selected) gamesState.selected = games[0]?.id;
    if (opts.gameId) gamesState.selected = opts.gameId;

    app.innerHTML = '';
    const root = el('div', {});
    root.appendChild(el('div', { class: 'row-between', style: { marginBottom: '20px' } }, [
      el('div', {}, [
        el('div', { class: 'eyebrow' }, ['Games']),
        el('h2', { style: { marginTop: '4px' } }, ['Imported games and deviations']),
        el('div', { class: 'muted', style: { marginTop: '4px', fontSize: '13px' } }, [
          'Import from Lichess, Chess.com, or paste PGN. We highlight where your real games left your prep.',
        ]),
      ]),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn', on: { click: () => global.OOSApp.openImport() } }, [icon(ICONS.upload, 12), 'Import PGN']),
      ]),
    ]));

    if (!games.length) {
      root.appendChild(el('div', { class: 'empty large card' }, [
        el('div', { class: 'icon' }, [icon(ICONS.upload, 22)]),
        el('h3', {}, ['No games imported yet']),
        el('p', {}, ['Import your games to discover where your opening prep breaks in real play.']),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn btn-primary', on: { click: () => global.OOSApp.openImport() } }, [icon(ICONS.upload, 14), 'Import PGN']),
          el('button', { class: 'btn', on: { click: () => global.OOSViews.openLichessFlow() } }, ['Connect Lichess']),
          el('button', { class: 'btn', on: { click: () => global.OOSViews.openChesscomFlow() } }, ['Connect Chess.com']),
        ]),
      ]));
      app.appendChild(root);
      return;
    }

    const layout = el('div', { class: 'games-layout' });

    // Game list
    const list = el('div', { class: 'games-list' });
    list.appendChild(el('div', { class: 'glh' }, [
      el('div', { class: 'eyebrow' }, [`${games.length} games`]),
      el('span', { class: 'muted', style: { fontSize: '12px' } }, ['Sorted by recent']),
    ]));
    games.forEach(g => {
      const dev = DB.detectDeviationForGame(g);
      const lineMeta = DB.line(g.lineId);
      const openingLabel = lineMeta ? lineMeta.name : 'Unmatched opening';
      list.appendChild(el('div', {
        class: 'game-item' + (g.id === gamesState.selected ? ' is-active' : ''),
        on: { click: () => { gamesState.selected = g.id; renderGames(app); } },
      }, [
        el('div', { class: 'game-result ' + g.result }, [g.result === 'w' ? '+' : g.result === 'l' ? '−' : '=']),
        el('div', { class: 'game-meta' }, [
          el('div', { class: 'opening', style: lineMeta ? null : { color: 'var(--text-2)', fontStyle: 'italic' } }, [openingLabel]),
          el('div', { class: 'vs' }, [`vs ${g.vs} (${g.vsRating}) · ${g.site} · ${g.played}`]),
        ]),
        el('div', { class: 'game-flags' }, [
          !lineMeta
            ? el('span', { class: 'pill pill-info pill-plain' }, ['unmatched'])
            : dev
              ? el('span', { class: 'pill ' + (dev.isUser ? 'pill-bad' : 'pill-warn') + ' pill-plain' }, [
                  dev.isUser ? `you @ ${Math.ceil(dev.ply / 2)}` : `opp @ ${Math.ceil(dev.ply / 2)}`,
                ])
              : el('span', { class: 'pill pill-good pill-plain' }, ['on book']),
        ]),
      ]));
    });
    layout.appendChild(list);

    // Detail
    const game = games.find(g => g.id === gamesState.selected) || games[0];
    const dev = DB.detectDeviationForGame(game);
    const deep = DB.deepReviewGame ? DB.deepReviewGame(game) : { matches: [], deviations: dev ? [dev] : [], moments: [] };
    const lineMeta = DB.line(game.lineId || (deep.matches[0] && deep.matches[0].lineId));
    const detailTitle = lineMeta ? `${lineMeta.name} · vs ${game.vs}` : `Unmatched opening · vs ${game.vs}`;

    const detail = el('div', { class: 'game-detail' });
    detail.appendChild(el('div', { class: 'row-between' }, [
      el('div', {}, [
        el('h3', {}, [detailTitle]),
        el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '2px' } }, [
          `${game.timeControl} · ${game.site} · ${game.played} · you played ${game.yourColor === 'w' ? 'White' : 'Black'}`,
        ]),
      ]),
      el('span', { class: 'pill ' + (game.result === 'w' ? 'pill-good' : game.result === 'l' ? 'pill-bad' : 'pill-info') }, [
        game.result === 'w' ? 'You won' : game.result === 'l' ? 'You lost' : 'Drew',
      ]),
    ]));

    // Mini PGN
    detail.appendChild(el('div', { class: 'panel mono', style: { padding: '12px 14px', marginTop: '14px', fontSize: '12.5px', color: 'var(--text-1)', overflowX: 'auto' } }, [
      formatPgn(game.pgn),
    ]));
    detail.appendChild(buildGameAnalysisPanel(game, deep));

    if (!lineMeta) {
      // Unmatched game — offer actions, no fake "stayed on book" or deviation.
      detail.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '20px' } }, ['Unmatched']));
      detail.appendChild(el('div', { class: 'panel', style: { padding: '14px 16px', marginTop: '4px' } }, [
        el('div', { style: { fontSize: '13px', color: 'var(--text-1)' } }, ['No repertoire line matches this game yet. You can convert it, match it manually, or ignore the opening phase.']),
        el('div', { class: 'row', style: { marginTop: '12px', gap: '8px', flexWrap: 'wrap' } }, [
          el('button', { class: 'btn btn-sm btn-primary', on: { click: () => convertGameToLine(game, app) } }, [icon(ICONS.add, 12), 'Create line from this game']),
          el('button', { class: 'btn btn-sm', on: { click: () => matchGameToLineDialog(game, app) } }, ['Match to existing line']),
          el('button', { class: 'btn btn-sm btn-ghost', on: { click: () => { DB.updateUserGame(game.id, { status: 'ignored', lineId: null }); DB.setGameStatus(game.id, { status: 'ignored' }); renderGames(app); } } }, ['Ignore opening']),
        ]),
      ]));
    } else if (!game.lineId || !DB.line(game.lineId)) {
      detail.appendChild(el('div', { class: 'panel', style: { padding: '14px', marginTop: '20px' } }, [
        el('div', { style: { fontWeight: 600 } }, ['This game is not matched to a repertoire line yet.']),
        el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '6px' } }, ['Create a line from the game, then review deviations against it.']),
        el('div', { class: 'row', style: { marginTop: '12px', gap: '8px' } }, [
          el('button', { class: 'btn btn-sm btn-primary', on: { click: () => global.OOSViews.repairDeviation('line-from-game', game.id, 1) } }, ['Create line from game']),
          el('button', { class: 'btn btn-sm', on: { click: () => global.OOSApp.openImport() } }, ['Import another PGN']),
        ]),
      ]));
    } else if ((deep.deviations || []).filter(d => !DB.isDeviationIgnored(game.id, d.ply)).length) {
      detail.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '20px' } }, ['Opening review']));
      (deep.deviations || []).filter(d => !DB.isDeviationIgnored(game.id, d.ply)).slice(0, 5).forEach((d, idx) => detail.appendChild(buildDeviationCard(Object.assign({ number: idx + 1 }, d), game, lineMeta, app)));
    } else {
      detail.appendChild(el('div', { class: 'panel', style: { padding: '14px', marginTop: '20px' } }, [
        el('div', { class: 'row' }, [
          icon(ICONS.check, 16),
          el('span', { style: { marginLeft: '8px' } }, ['Game stayed on book through your saved moves. Nice.']),
        ]),
      ]));
    }

    layout.appendChild(detail);
    root.appendChild(layout);
    app.appendChild(root);
  }

  function formatPgn(pgn) {
    // Insert a soft wrap after every 4 moves
    return pgn;
  }

  function convertGameToLine(game, app) {
    const DB = global.OOSData;
    const line = DB.createLineFromGame ? DB.createLineFromGame(game.id, {
      name: `From game vs ${game.vs}`,
      color: game.yourColor || 'w',
      tag: 'investigate',
      description: `Created from imported game played ${game.played}.`,
    }) : null;
    if (!line) return global.OOSApp.toast('Could not convert this PGN into a line.', 'bad');
    global.OOSApp.toast(`Created "${line.name}"`, 'good');
    renderGames(app);
  }

  function matchGameToLineDialog(game, app) {
    const DB = global.OOSData;
    const lines = DB.lines();
    if (!lines.length) {
      return showError('No lines yet', 'You need to create a line first. Use "Create line from this game" or open the Library.', [
        { label: 'OK', primary: true, run: () => {} },
      ]);
    }
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel' });
    panel.appendChild(el('div', { class: 'eyebrow' }, ['Match game to line']));
    panel.appendChild(el('h3', {}, ['Pick the repertoire line this game belongs to']));
    const list = el('div', { class: 'stack', style: { marginTop: '12px', gap: '4px' } });
    lines.forEach(l => {
      list.appendChild(el('button', {
        class: 'pm-row',
        on: { click: () => {
          game.lineId = l.id;
          game.status = 'matched';
          DB.persist();
          wrap.remove();
          global.OOSApp.toast(`Matched to ${l.name}`, 'good');
          renderGames(app);
        } },
      }, [
        el('span', { class: 'avatar', style: { background: 'var(--bg-3)', color: 'var(--accent)' } }, [l.eco || '?']),
        el('span', { class: 'pm-row-name' }, [l.name]),
        el('span', { class: 'pm-row-role' }, [l.color === 'w' ? 'White' : 'Black']),
      ]));
    });
    panel.appendChild(list);
    panel.appendChild(el('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, [
      el('button', { class: 'btn', on: { click: () => wrap.remove() } }, ['Cancel']),
    ]));
    back.addEventListener('click', () => wrap.remove());
    wrap.appendChild(back); wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }


  function buildGameAnalysisPanel(game, deep) {
    const matches = (deep && deep.matches) || [];
    const moments = (deep && deep.moments) || [];
    return el('div', { class: 'panel game-analysis', style: { padding: '12px 14px', marginTop: '12px' } }, [
      el('div', { class: 'row-between' }, [
        el('div', {}, [
          el('div', { class: 'eyebrow' }, ['Graph matching']),
          el('div', { class: 'muted', style: { fontSize: '12px', marginTop: '3px' } }, [matches.length ? 'Matched against every repertoire path and transposition node.' : 'No graph match found yet.']),
        ]),
        el('span', { class: 'pill pill-info pill-plain' }, [matches.length ? matches.length + ' candidates' : 'unmatched']),
      ]),
      matches.length ? el('div', { class: 'match-list', style: { marginTop: '10px' } }, matches.slice(0, 4).map(m => el('button', {
        class: 'match-chip',
        on: { click: () => { global.OOSData.matchGameToLine(game.id, m.lineId); global.OOSApp.toast('Game matched to ' + m.name, 'good'); global.OOSApp.go('games', { gameId: game.id }); } },
      }, [m.name + ' · prefix ' + m.prefix + ' · transpositions ' + m.transpositions]))) : null,
      moments.length ? el('div', { class: 'moment-list', style: { marginTop: '10px' } }, moments.slice(0, 4).map(m => el('div', { class: 'moment-row' }, [
        el('strong', {}, [m.kind || m.status || 'moment']),
        el('span', {}, [' — ' + (m.message || '')]),
        m.relevance ? el('span', { class: 'pill pill-plain ' + (m.relevance.label === 'high' ? 'pill-bad' : m.relevance.label === 'medium' ? 'pill-warn' : 'pill-info') }, [m.relevance.label]) : null,
      ]))) : null,
    ]);
  }

  function buildDeviationCard(dev, game, lineMeta, app) {
    const cardEl = el('div', { class: 'deviation-card' });
    cardEl.appendChild(el('div', { class: 'dev-head' }, [
      el('span', { class: 'dev-num' }, [String(dev.number || 1)]),
      el('div', {}, [
        el('div', { style: { fontWeight: 600 } }, [
          dev.isUser
            ? `You left your repertoire on move ${Math.ceil(dev.ply / 2)}`
            : `Opponent played a move not covered (move ${Math.ceil(dev.ply / 2)})`,
        ]),
        el('div', { class: 'muted', style: { fontSize: '12px', marginTop: '2px' } }, [
          dev.isUser ? 'A familiar position — but you chose a move outside your prep.' : 'A sideline you have not stored. Decide if it deserves a response.',
        ]),
      ]),
    ]));
    cardEl.appendChild(el('div', { class: 'dev-cmp' }, [
      el('div', { class: 'col' }, [
        el('div', { class: 'lbl' }, ['Prepared']),
        el('div', { class: 'mv', style: { color: 'var(--good)' } }, [dev.expected]),
      ]),
      el('div', { class: 'col' }, [
        el('div', { class: 'lbl' }, ['Played']),
        el('div', { class: 'mv', style: { color: dev.isUser ? 'var(--bad)' : 'var(--warn)' } }, [dev.played]),
      ]),
    ]));
    cardEl.appendChild(el('div', { class: 'dev-actions' }, [
      el('button', { class: 'btn btn-sm btn-primary', on: { click: () => {
        const cards = global.OOSData.cardsFromLine ? global.OOSData.cardsFromLine(lineMeta.id, dev.ply - 1) : global.OOSData.positionsForLine(lineMeta.id);
        global.OOSViews.startSessionWith(cards, { mode: 'daily' });
      } } }, [icon(ICONS.bolt, 12), 'Practice this position']),
      el('button', { class: 'btn btn-sm', on: { click: () => {
        if (dev.isUser) {
          const card = global.OOSData.cardAtLinePly(lineMeta.id, dev.ply);
          if (card) {
            let altFen = '';
            try {
              const ch = new global.Chess();
              if (dev.fenBefore) ch.load(dev.fenBefore);
              const mv = ch.move(dev.played, { sloppy: true });
              altFen = mv ? ch.fen() : '';
            } catch (e) {}
            if (global.OOSData.addAlternateToCard) global.OOSData.addAlternateToCard(card.id, dev.played, altFen);
            else global.OOSData.addAlternate(card.id, dev.played);
            global.OOSData.setGameStatus(game.id, { status: 'repaired', repairedAt: Date.now() });
            global.OOSApp.toast(`${dev.played} saved as an alternate for this position`, 'good');
            renderGames(app);
          }
        } else {
          const newLine = global.OOSData.addOpponentReplyFromPosition(lineMeta.id, dev.ply - 1, dev.played, {
            name: `${lineMeta.name} — sideline ${dev.played}`,
            description: `Opponent sideline from game vs ${game.vs}. Add your response next.`,
          });
          global.OOSData.setGameStatus(game.id, { status: 'sideline-added', sidelineLineId: newLine.id, repairedAt: Date.now() });
          global.OOSApp.toast('Created an investigate line for this opponent sideline', 'good');
          global.OOSApp.go('repertoire', { lineId: newLine.id });
        }
      } } }, [dev.isUser ? 'Add as alternate' : 'Add sideline line']),
      el('button', { class: 'btn btn-sm', on: { click: () => { global.OOSData.ignoreDeviation(game.id, dev); global.OOSApp.toast('Sideline ignored for this game', 'good'); renderGames(app); } } }, ['Ignore sideline']),
      el('button', { class: 'btn btn-sm btn-ghost', on: { click: () => global.OOSApp.go('repertoire', { lineId: lineMeta.id, ply: dev.ply - 1 }) } }, ['Open in repertoire']),
    ]));
    return cardEl;
  }

  // ----------------------------------------------------------------------
  // INSIGHTS
  // ----------------------------------------------------------------------
  let insightsTab = 'coverage';

  function renderInsights(app) {
    const DB = global.OOSData;
    const positions = DB.allPositions();
    const due = DB.duePositions();
    const weak = DB.weakPositions();
    const games = DB.importedGames();
    const stable = positions.filter(p => {
      const c = DB.srs(p.id);
      return c && c.stability >= 5 && c.lapses === 0;
    }).length;
    const totalDeviations = games.reduce((acc, g) => acc + (DB.detectDeviationForGame(g) ? 1 : 0), 0);

    app.innerHTML = '';
    const root = el('div', {});
    root.appendChild(el('div', { style: { marginBottom: '20px' } }, [
      el('div', { class: 'eyebrow' }, ['Insights']),
      el('h2', { style: { marginTop: '4px' } }, ['How your prep is actually doing']),
      el('div', { class: 'muted', style: { marginTop: '4px', fontSize: '13px' } }, [
        'Actionable signals only. Vanity metrics live elsewhere.',
      ]),
    ]));

    if (positions.length === 0) {
      root.appendChild(el('div', { class: 'empty large card' }, [
        el('div', { class: 'icon' }, [icon(ICONS.map, 22)]),
        el('h3', {}, ['No data to show yet']),
        el('p', {}, ['Insights kick in once you have lines and have practiced a few times. Add a line first.']),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn btn-primary', on: { click: () => global.OOSApp.go('library') } }, ['Open library']),
          el('button', { class: 'btn', on: { click: () => global.OOSApp.openImport() } }, [icon(ICONS.upload, 14), 'Import PGN']),
        ]),
      ]));
      app.appendChild(root);
      return;
    }

    const bloatPct = positions.length ? Math.round((1 - (stable / positions.length)) * 100) : 0;

    const metrics = el('div', { class: 'insights-grid' });
    metrics.appendChild(metricCard('Stable positions', `${stable}/${positions.length}`, 'var(--good)', '', ''));
    metrics.appendChild(metricCard('Due now', String(due.length), 'var(--accent)', `${weak.length} weak`, ''));
    metrics.appendChild(metricCard('Real-game relevance', `${games.length} game${games.length === 1 ? '' : 's'}`, 'var(--info)', `${totalDeviations} deviation${totalDeviations === 1 ? '' : 's'}`, ''));
    metrics.appendChild(metricCard('Bloat (unstable %)', bloatPct + '%', 'var(--warn)', bloatPct < 30 ? 'Healthy' : 'High', ''));
    root.appendChild(metrics);

    // Tabs: Coverage / Tree / Table / Timeline
    root.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '24px', marginBottom: '8px' } }, ['Repertoire map']));
    const tabs = el('div', { class: 'tabs' });
    [
      { id: 'coverage', label: 'Coverage' },
      { id: 'tree',     label: 'Tree' },
      { id: 'table',    label: 'Table' },
      { id: 'timeline', label: 'Timeline' },
    ].forEach(t => {
      tabs.appendChild(el('button', {
        class: insightsTab === t.id ? 'is-active' : '',
        on: { click: () => { insightsTab = t.id; renderInsights(app); } },
      }, [t.label]));
    });
    root.appendChild(tabs);

    if (insightsTab === 'coverage') {
      const grid = el('div', { class: 'coverage-grid' });
      positions.forEach(p => {
        const srs = DB.srs(p.id);
        let status = 'medium';
        if (!srs) status = 'empty';
        else if (srs.stability >= 5 && srs.lapses === 0) status = 'strong';
        else if (srs.lapses >= 2 || srs.stability < 1.5) status = 'weak';
        grid.appendChild(el('div', {
          class: 'cov-cell s-' + status,
          on: { click: () => global.OOSApp.go('repertoire', { lineId: p.lineId, ply: p.ply - 1 }) },
        }, [
          el('div', { class: 'cov-tip' }, [`${p.name} · ${p.move} (${status})`]),
        ]));
      });
      root.appendChild(grid);
    } else if (insightsTab === 'tree') {
      root.appendChild(buildTreeView());
    } else if (insightsTab === 'table') {
      root.appendChild(buildLineTable());
    } else if (insightsTab === 'timeline') {
      root.appendChild(buildTimeline());
    }

    root.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '24px', marginBottom: '8px' } }, ['Weakest positions']));
    const table = el('div', { class: 'weak-list' });
    table.appendChild(el('div', { class: 'weak-row head' }, [
      el('div', { class: 'name' }, ['Position']),
      el('div', { class: 'num' }, ['Lapses']),
      el('div', { class: 'num' }, ['Miss %']),
      el('div', { class: 'num' }, ['Last seen']),
    ]));
    weak.slice(0, 8).forEach(p => {
      const srs = DB.srs(p.id);
      table.appendChild(el('div', {
        class: 'weak-row',
        on: { click: () => global.OOSApp.go('repertoire', { lineId: p.lineId, ply: p.ply - 1 }) },
        style: { cursor: 'pointer' },
      }, [
        el('div', { class: 'name' }, [
          p.name,
          el('span', { class: 'sub' }, [`After ${p.historyBefore || 'start'} → ${p.move}`]),
        ]),
        el('div', { class: 'num' }, [String(srs?.lapses || 0)]),
        el('div', { class: 'num' }, [Math.round((srs?.missRate || 0) * 100) + '%']),
        el('div', { class: 'num' }, ['2d ago']),
      ]));
    });
    if (weak.length === 0) {
      table.appendChild(el('div', { class: 'empty', style: { padding: '32px' } }, [
        el('h3', {}, ['No weak positions']),
        el('p', {}, ['Your repertoire is calm. Keep the queue light.']),
      ]));
    }
    root.appendChild(table);

    app.appendChild(root);
  }

  function buildTreeView() {
    const DB = global.OOSData;
    const wrap = el('div', { class: 'tree-canvas' });
    DB.lines().forEach(line => {
      const positions = DB.positionsForLine(line.id);
      // Header
      wrap.appendChild(el('div', { class: 'tree-line', style: { color: 'var(--text-1)', fontWeight: 600, marginTop: '6px' } }, [
        line.name + '  ',
        el('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--text-3)' } }, [`(${positions.length} positions)`]),
      ]));
      // Sequence with prep status
      const tokens = [];
      let mainline = '  └ ';
      const moves = line.moves;
      for (let i = 0; i < moves.length; i++) {
        const ply = i + 1;
        const moveNum = (i % 2 === 0) ? `${Math.floor(i/2)+1}.` : '';
        const pos = positions.find(p => p.ply === ply);
        let cls = 'san';
        if (pos) {
          const srs = DB.srs(pos.id);
          if (!srs || srs.stability < 1.5 || srs.lapses >= 2) cls = 'san is-weak';
          else if (srs.due <= Date.now()) cls = 'san is-due';
        }
        mainline += `${moveNum} `;
        tokens.push({ cls, text: moves[i] });
      }
      const lineEl = el('div', { class: 'tree-line' }, [mainline]);
      let buf = '';
      for (let i = 0; i < moves.length; i++) {
        const moveNum = (i % 2 === 0) ? `${Math.floor(i/2)+1}.` : '';
        const ply = i + 1;
        const pos = positions.find(p => p.ply === ply);
        let cls = 'san';
        if (pos) {
          const srs = DB.srs(pos.id);
          if (!srs || srs.stability < 1.5 || srs.lapses >= 2) cls = 'san is-weak';
          else if (srs.due <= Date.now()) cls = 'san is-due';
        }
        if (moveNum) lineEl.appendChild(el('span', { class: 'ply' }, [moveNum + ' ']));
        lineEl.appendChild(el('span', { class: cls }, [moves[i] + ' ']));
      }
      wrap.appendChild(el('div', { class: 'tree-line', style: { color: 'var(--text-3)', marginTop: '4px' } }, ['  └ ']));
      wrap.appendChild(lineEl);
    });
    wrap.appendChild(el('div', { style: { marginTop: '12px', fontSize: '11.5px', color: 'var(--text-2)', fontFamily: 'var(--font-ui)' } }, [
      el('span', { class: 'pill pill-bad pill-plain', style: { marginRight: '6px' } }, ['weak']),
      el('span', { class: 'pill pill-warn pill-plain', style: { marginRight: '6px' } }, ['due']),
      el('span', { class: 'pill pill-good pill-plain' }, ['stable']),
    ]));
    return wrap;
  }

  function buildLineTable() {
    const DB = global.OOSData;
    const rows = DB.lineTable();
    const t = el('div', { class: 'weak-list' });
    t.appendChild(el('div', { class: 'weak-row head', style: { gridTemplateColumns: '1.4fr 70px 70px 80px 90px' } }, [
      el('div', { class: 'name' }, ['Opening']),
      el('div', { class: 'num' }, ['Due']),
      el('div', { class: 'num' }, ['Weak']),
      el('div', { class: 'num' }, ['Real games']),
      el('div', { class: 'num' }, ['Confidence']),
    ]));
    rows.forEach(r => {
      const quality = DB.lineQuality(r.line.id);
      t.appendChild(el('div', {
        class: 'weak-row',
        style: { gridTemplateColumns: '1.4fr 70px 70px 80px 90px', cursor: 'pointer' },
        on: { click: () => global.OOSApp.go('repertoire', { lineId: r.line.id }) },
      }, [
        el('div', { class: 'name' }, [
          r.line.name,
          el('span', { class: 'sub' }, [`${r.line.eco} · quality ${quality}/100`]),
        ]),
        el('div', { class: 'num' }, [String(r.due)]),
        el('div', { class: 'num' }, [String(r.weak)]),
        el('div', { class: 'num' }, [String(r.realGames)]),
        el('div', { class: 'num', style: { color: r.confidence >= 70 ? 'var(--good)' : r.confidence >= 40 ? 'var(--warn)' : 'var(--bad)' } }, [r.confidence + '%']),
      ]));
    });
    return t;
  }

  function buildTimeline() {
    const DB = global.OOSData;
    const wrap = el('div', { class: 'timeline' });
    DB.timeline().forEach(t => {
      wrap.appendChild(el('div', { class: 'timeline-item k-' + t.kind }, [
        el('div', { class: 'dot' }),
        el('div', { class: 'when' }, [t.at]),
        el('div', { class: 'what' }, [t.text]),
      ]));
    });
    return wrap;
  }

  function metricCard(label, num, color, delta, dir) {
    return el('div', { class: 'metric' }, [
      el('div', { class: 'num', style: { color } }, [num]),
      el('div', { class: 'lbl' }, [label]),
      el('div', { class: 'delta ' + dir }, [delta]),
    ]);
  }

  // ----------------------------------------------------------------------
  // IMPORT MODAL (PGN)
  // ----------------------------------------------------------------------
  function showImport(onSubmit) {
    const wrap = el('div', { class: 'cmd-palette' });
    const back = el('div', { class: 'cmd-backdrop' });
    const panel = el('div', { class: 'cmd-panel', style: { padding: '20px' } });

    panel.appendChild(el('div', { class: 'eyebrow' }, ['Import PGN']));
    panel.appendChild(el('h3', { style: { marginTop: '6px', fontSize: '16px' } }, ['Paste a game or repertoire']));
    panel.appendChild(el('p', { class: 'muted', style: { fontSize: '13px', margin: '6px 0 14px' } }, [
      'We\'ll detect deviations from your existing lines. For demo, the parsed game will be added to the Games view.',
    ]));
    const ta = el('textarea', { class: 'input', placeholder: '1.e4 c6 2.d4 d5 3.e5 Bf5 ...' });
    panel.appendChild(ta);
    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } }, [
      el('button', { class: 'btn', on: { click: close } }, ['Cancel']),
      el('button', { class: 'btn btn-primary', on: { click: () => { onSubmit && onSubmit(ta.value); close(); } } }, ['Import']),
    ]));

    function close() { wrap.remove(); }
    back.addEventListener('click', close);
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    setTimeout(() => ta.focus(), 60);
  }

  // ----------------------------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------------------------
  function renderSettings(app) {
    const DB = global.OOSData;
    app.innerHTML = '';
    const root = el('div', {});

    root.appendChild(el('div', { style: { marginBottom: '20px' } }, [
      el('div', { class: 'eyebrow' }, ['Settings']),
      el('h2', { style: { marginTop: '4px' } }, ['Personalize how OpeningOS feels']),
      el('div', { class: 'muted', style: { marginTop: '4px', fontSize: '13px' } }, [
        'Settings are stored locally in this browser only. Your repertoire is private by default.',
      ]),
    ]));

    const layout = el('div', { class: 'settings-grid' });

    const side = el('div', { class: 'settings-side' });
    [
      { id: 'appearance', label: 'Appearance' },
      { id: 'board',      label: 'Board' },
      { id: 'practice',   label: 'Practice' },
      { id: 'a11y',       label: 'Accessibility' },
      { id: 'privacy',    label: 'Privacy' },
      { id: 'data',       label: 'Data' },
    ].forEach((s, i) => {
      side.appendChild(el('a', {
        href: '#settings-' + s.id,
        class: i === 0 ? 'is-active' : '',
        on: { click: (e) => {
          // Don't let the hash change leak into the global router.
          e.preventDefault();
          side.querySelectorAll('a').forEach(a => a.classList.remove('is-active'));
          e.currentTarget.classList.add('is-active');
          const target = document.getElementById('settings-' + s.id);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } },
      }, [s.label]));
    });
    layout.appendChild(side);

    const main = el('div', {});

    main.appendChild(buildSettingsGroup('Appearance', 'settings-appearance', [
      toggleSetting('Light theme', 'theme', 'light', 'dark', 'Easier on bright days. Dark by default.'),
      toggleSetting('High contrast', 'highContrast', true, false, 'Boost contrast for low-vision use.'),
      choiceSetting('Font size', 'fontSize', [
        { v: 'small',  label: 'Small'  },
        { v: 'normal', label: 'Normal' },
        { v: 'large',  label: 'Large'  },
      ]),
    ]));

    main.appendChild(buildSettingsGroup('Board', 'settings-board', [
      toggleSetting('Show coordinates', 'coords', true, false, 'Files (a–h) and ranks (1–8) on board edges.'),
      choiceSetting('Notation', 'notation', [
        { v: 'san',      label: 'SAN' },
        { v: 'lan',      label: 'LAN' },
        { v: 'figurine', label: 'Figurine' },
      ]),
      choiceSetting('Board size', 'boardSize', [
        { v: 'small',  label: 'Small'  },
        { v: 'medium', label: 'Medium' },
        { v: 'large',  label: 'Large'  },
      ]),
      choiceSetting('Piece set', 'piecesSet', [
        { v: 'classic', label: 'Classic'  },
        { v: 'merida',  label: 'Merida'   },
        { v: 'wood',    label: 'Wood'     },
      ]),
    ]));

    main.appendChild(buildSettingsGroup('Practice', 'settings-practice', [
      toggleSetting('Sound effects', 'sound', true, false, 'Click sound on moves. Off by default.'),
      toggleSetting('Reveal answer after wrong move', 'revealOnWrong', true, true, 'Show the prepared move when you miss.'),
      choiceSetting('Default mode', 'defaultPracticeMode', [
        { v: 'daily',     label: 'Daily' },
        { v: 'weak',      label: 'Weak only' },
        { v: 'classical', label: 'Classical' },
      ]),
    ]));

    main.appendChild(buildSettingsGroup('Accessibility', 'settings-a11y', [
      toggleSetting('Reduced motion', 'reducedMotion', true, false, 'Disable animations and shake feedback.'),
      toggleSetting('Screen-reader move announcements', 'screenReaderMoves', true, false, 'Speak last move on each ply.'),
      toggleSetting('Color-blind safe statuses', 'cbSafe', true, false, 'Use shapes + icons in addition to color.'),
    ]));

    main.appendChild(buildSettingsGroup('Privacy', 'settings-privacy', [
      el('div', { class: 'setting-row' }, [
        el('div', {}, [
          el('div', { class: 'label' }, ['Default visibility']),
          el('div', { class: 'desc' }, ['Repertoires, notes, and games default to private. AI features off until you enable them.']),
        ]),
        el('span', { class: 'pill pill-good' }, ['Private']),
      ]),
      toggleSetting('Allow AI to summarize PGNs', 'aiSummaries', true, false, 'Off by default. Will be marked as AI-generated when on.'),
      toggleSetting('Allow shared studies via link', 'sharingEnabled', true, false, 'Lets you create unlisted share URLs.'),
    ]));

    main.appendChild(buildSettingsGroup('Data', 'settings-data', [
      el('div', { class: 'setting-row' }, [
        el('div', {}, [
          el('div', { class: 'label' }, ['Export everything']),
          el('div', { class: 'desc' }, ['Download a complete local backup: profiles, repertoires, games, notes, SRS, card metadata, arrows, assignments, settings, and review history.']),
        ]),
        el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [el('button', { class: 'btn btn-sm', on: { click: () => exportData() } }, ['Export JSON']), el('button', { class: 'btn btn-sm', on: { click: () => global.OOSViews.showBackupRestore() } }, ['Backup / Restore'])]),
      ]),
      el('div', { class: 'setting-row' }, [
        el('div', {}, [
          el('div', { class: 'label' }, ['Import backup']),
          el('div', { class: 'desc' }, ['Restore a JSON backup created from OpeningOS. This replaces the active profile data.']),
        ]),
        el('button', { class: 'btn btn-sm', on: { click: () => importBackup() } }, ['Import JSON']),
      ]),
      el('div', { class: 'setting-row' }, [
        el('div', {}, [
          el('div', { class: 'label' }, ['Storage health']),
          el('div', { class: 'desc' }, ['Check IndexedDB/local cache quota before importing large PGNs.']),
        ]),
        el('button', { class: 'btn btn-sm', on: { click: async () => {
          const est = global.OOSStore && await global.OOSStore.estimateStorage();
          const mb = n => Math.round((Number(n || 0) / 1024 / 1024) * 10) / 10;
          global.OOSApp.toast(est ? `Storage used ${mb(est.usage)}MB of ${mb(est.quota)}MB` : 'Storage estimate unavailable', 'info');
        } } }, ['Check quota']),
      ]),
      el('div', { class: 'setting-row' }, [
        el('div', {}, [
          el('div', { class: 'label' }, ['Reset local data']),
          el('div', { class: 'desc' }, ["Wipe this profile\'s local repertoire, games, notes, and progress."]),
        ]),
        el('button', { class: 'btn btn-sm', on: { click: () => { if (confirm('Reset all local data for this profile?')) { DB.reset(); global.OOSApp.toast('Local data reset', 'good'); global.OOSApp.go('today'); } } } }, ['Reset…']),
      ]),
    ]));

    layout.appendChild(main);
    root.appendChild(layout);
    app.appendChild(root);
  }

  function buildSettingsGroup(title, id, rows) {
    return el('div', { class: 'setting-group', id }, [
      el('h3', {}, [title]),
      ...rows.filter(Boolean),
    ]);
  }

  function toggleSetting(label, key, onValue, offValue, desc) {
    const DB = global.OOSData;
    const current = DB.getSetting(key, offValue);
    const isOn = current === onValue;
    return el('div', { class: 'setting-row' }, [
      el('div', {}, [
        el('div', { class: 'label' }, [label]),
        desc ? el('div', { class: 'desc' }, [desc]) : null,
      ]),
      el('div', {
        class: 'toggle' + (isOn ? ' on' : ''), role: 'switch', tabindex: '0',
        'aria-checked': isOn ? 'true' : 'false',
        on: {
          click: (e) => {
            const next = e.currentTarget.classList.toggle('on');
            DB.setSetting(key, next ? onValue : offValue);
            e.currentTarget.setAttribute('aria-checked', next ? 'true' : 'false');
            applyLiveSetting(key, next ? onValue : offValue);
          },
          keydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          },
        },
      }),
    ]);
  }

  function choiceSetting(label, key, options) {
    const DB = global.OOSData;
    const current = DB.getSetting(key, options[0].v);
    const row = el('div', { class: 'setting-row' }, [
      el('div', {}, [
        el('div', { class: 'label' }, [label]),
      ]),
      el('div', { class: 'choice-row' },
        options.map(o => el('button', {
          class: o.v === current ? 'is-active' : '',
          on: { click: () => {
            DB.setSetting(key, o.v);
            applyLiveSetting(key, o.v);
            row.querySelectorAll('.choice-row button').forEach(b => b.classList.remove('is-active'));
            row.querySelectorAll('.choice-row button').forEach(b => {
              if (b.textContent === o.label) b.classList.add('is-active');
            });
          } },
        }, [o.label])),
      ),
    ]);
    return row;
  }

  function applyLiveSetting(key, value) {
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value);
      global.OOSApp.toast(`Theme: ${value}`, 'good');
    }
    if (key === 'highContrast') {
      document.documentElement.setAttribute('data-contrast', value === true ? 'high' : 'normal');
    }
    if (key === 'reducedMotion') {
      document.documentElement.setAttribute('data-reduced-motion', value === true ? 'true' : 'false');
    }
    if (key === 'fontSize') {
      document.documentElement.setAttribute('data-fontsize', value);
    }
    if (key === 'boardSize') {
      document.documentElement.setAttribute('data-board-size', value);
    }
    if (key === 'piecesSet') {
      document.documentElement.setAttribute('data-pieces', value);
    }
    if (key === 'cbSafe') {
      document.documentElement.setAttribute('data-cb-safe', value === true ? 'true' : 'false');
    }
    if (key === 'boardSize') {
      document.documentElement.setAttribute('data-board-size', value);
    }
    if (key === 'coords') {
      document.documentElement.setAttribute('data-coords', value === true ? 'true' : 'false');
      global.OOSApp.toast('Coordinates preference saved', 'good');
    }
    if (key === 'notation') {
      global.OOSApp.toast('Notation preference saved', 'good');
      global.OOSApp.go('repertoire');
    }
    if (key === 'cbSafe') {
      document.documentElement.setAttribute('data-cb-safe', value === true ? 'true' : 'false');
    }
    if (key === 'sound' && global.OOSAudio) {
      global.OOSAudio.setEnabled(value === true);
      if (value === true) global.OOSAudio.click();
    }
  }

  function exportData() {
    const DB = global.OOSData;
    const snapshot = DB.exportSnapshot ? DB.exportSnapshot() : { state: DB.state };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `openingos-backup-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    global.OOSApp.toast('Exported complete OpeningOS backup', 'good');
  }

  function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const snapshot = JSON.parse(String(reader.result || '{}'));
          if (!confirm('Restore this backup into the active profile? This replaces current local data for this profile.')) return;
          global.OOSData.importSnapshot(snapshot);
          applyLiveSetting('theme', global.OOSData.getSetting('theme', 'dark'));
          applyLiveSetting('highContrast', global.OOSData.getSetting('highContrast', false));
          applyLiveSetting('reducedMotion', global.OOSData.getSetting('reducedMotion', false));
          applyLiveSetting('fontSize', global.OOSData.getSetting('fontSize', 'normal'));
          applyLiveSetting('boardSize', global.OOSData.getSetting('boardSize', 'medium'));
          applyLiveSetting('piecesSet', global.OOSData.getSetting('piecesSet', 'classic'));
          applyLiveSetting('coords', global.OOSData.getSetting('coords', true));
          applyLiveSetting('cbSafe', global.OOSData.getSetting('cbSafe', false));
          global.OOSApp.toast('Backup restored', 'good');
          global.OOSApp.go('today');
        } catch (err) {
          showError('Backup import failed', err.message || String(err), [{ label: 'OK', primary: true, run: () => {} }]);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // ----------------------------------------------------------------------
  // LIBRARY
  // ----------------------------------------------------------------------
  function renderLibrary(app) {
    const DB = global.OOSData;
    app.innerHTML = '';
    const root = el('div', {});

    root.appendChild(el('div', { style: { marginBottom: '20px' } }, [
      el('div', { class: 'eyebrow' }, ['Library']),
      el('h2', { style: { marginTop: '4px' } }, ['Curated starters & model games']),
      el('div', { class: 'muted', style: { marginTop: '4px', fontSize: '13px' } }, [
        'Practical starter lines and instructive model games. Clone a starter, then edit it into your personal repertoire.',
      ]),
    ]));

    root.appendChild(el('div', { class: 'eyebrow', style: { marginBottom: '12px' } }, ['Starter repertoires']));
    const grid = el('div', { class: 'library-grid' });
    DB.library().forEach(course => {
      grid.appendChild(el('div', { class: 'lib-card' }, [
        el('div', { class: 'lib-head' }, [
          el('div', {}, [
            el('div', { class: 'lib-name' }, [course.name]),
            el('div', { class: 'lib-author' }, [course.author + ' · ECO ' + course.eco]),
          ]),
          el('div', { class: 'lib-rating' }, [
            icon('M12 2l3 7h7l-5.7 4.3 2.1 7L12 16l-6.4 4.3 2.1-7L2 9h7z', 14),
            el('span', {}, [course.rating.toFixed(1)]),
            el('span', { style: { color: 'var(--text-3)' } }, [`(${course.reviews})`]),
          ]),
        ]),
        el('div', { class: 'lib-summary' }, [course.summary]),
        el('div', { class: 'lib-stats' }, [
          el('span', {}, [course.level]),
          el('span', {}, [`${course.lines} lines`]),
          el('span', {}, [`${course.positions} positions`]),
          el('span', {}, [course.eta]),
        ]),
        el('div', { class: 'lib-tags' }, course.tags.map(t => el('span', { class: 'pill pill-plain' }, [t]))),
        el('div', { class: 'row', style: { gap: '8px' } }, [
          el('button', { class: 'btn btn-sm btn-primary', on: { click: () => cloneCourse(course) } }, ['Clone starter pack']),
          el('button', { class: 'btn btn-sm', on: { click: () => previewCourse(course) } }, ['Preview']),
        ]),
      ]));
    });
    root.appendChild(grid);

    root.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '32px', marginBottom: '12px' } }, ['Model games']));
    const mgList = el('div', { class: 'panel' });
    DB.modelGames().forEach((g, i) => {
      mgList.appendChild(el('div', {
        class: 'student-row',
        style: { gridTemplateColumns: '40px 1.4fr 1fr 80px auto' },
      }, [
        el('div', { class: 'student-avatar', style: { background: 'var(--bg-3)', color: 'var(--accent)' } }, [String(i + 1)]),
        el('div', {}, [
          el('div', { class: 'name' }, [g.white + ' — ' + g.black]),
          el('div', { class: 'meta', style: { fontSize: '11.5px', color: 'var(--text-2)', marginTop: '2px' } }, [g.event + ' · ' + g.moves + ' moves']),
        ]),
        el('div', { class: 'mono', style: { fontSize: '12px', color: 'var(--text-2)' } }, [DB.line(g.line) ? DB.line(g.line).name : g.line]),
        el('div', { class: 'mono' }, [g.result]),
        el('button', { class: 'btn btn-sm btn-primary', on: { click: () => showModelGameTrainer(g) } }, ['Replay trainer']),
      ]));
    });
    root.appendChild(mgList);

    app.appendChild(root);
  }

  // Library helpers
  function starterPack(course) {
    const packs = {
      'lib-london': [
        { suffix: 'Mainline vs ...d5', color: 'w', moves: ['d4','d5','Nf3','Nf6','Bf4','e6','e3','c5','c3','Nc6','Nbd2','Bd6','Bg3','O-O'] },
        { suffix: "vs King's Indian setup", color: 'w', moves: ['d4','Nf6','Nf3','g6','Bf4','Bg7','e3','O-O','Be2','d6','O-O','Nbd7','h3'] },
        { suffix: 'vs early ...c5', color: 'w', moves: ['d4','Nf6','Nf3','c5','c3','e6','Bf4','b6','e3','Bb7','Nbd2','Be7'] },
      ],
      'lib-caro': [
        { suffix: 'Advance', color: 'b', moves: ['e4','c6','d4','d5','e5','Bf5','Nf3','e6','Be2','c5','Be3','cxd4','Nxd4','Ne7'] },
        { suffix: 'Exchange', color: 'b', moves: ['e4','c6','d4','d5','exd5','cxd5','Bd3','Nc6','c3','Nf6','Bf4','Bg4'] },
        { suffix: 'Panov', color: 'b', moves: ['e4','c6','d4','d5','exd5','cxd5','c4','Nf6','Nc3','e6','Nf3','Bb4'] },
        { suffix: 'Fantasy', color: 'b', moves: ['e4','c6','d4','d5','f3','e6','Nc3','Bb4','Be3','Ne7'] },
      ],
      'lib-italian': [
        { suffix: 'Giuoco Pianissimo', color: 'w', moves: ['e4','e5','Nf3','Nc6','Bc4','Bc5','d3','Nf6','c3','d6','O-O','O-O'] },
        { suffix: 'Two Knights', color: 'w', moves: ['e4','e5','Nf3','Nc6','Bc4','Nf6','d3','Be7','O-O','O-O','Re1','d6'] },
        { suffix: 'Evans starter', color: 'w', moves: ['e4','e5','Nf3','Nc6','Bc4','Bc5','b4','Bxb4','c3','Ba5','d4','d6'] },
      ],
      'lib-kid': [
        { suffix: 'Classical', color: 'b', moves: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','Nf3','O-O','Be2','e5','O-O','Nc6'] },
        { suffix: 'Fianchetto', color: 'b', moves: ['d4','Nf6','c4','g6','Nf3','Bg7','g3','O-O','Bg2','d6','O-O','Nbd7'] },
        { suffix: 'Saemisch', color: 'b', moves: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','f3','O-O','Be3','e5'] },
      ],
      'lib-french': [
        { suffix: 'Advance', color: 'b', moves: ['e4','e6','d4','d5','e5','c5','c3','Nc6','Nf3','Qb6'] },
        { suffix: 'Tarrasch', color: 'b', moves: ['e4','e6','d4','d5','Nd2','c5','exd5','exd5','Ngf3','Nc6'] },
        { suffix: 'Winawer', color: 'b', moves: ['e4','e6','d4','d5','Nc3','Bb4','e5','c5','a3','Bxc3+','bxc3','Ne7'] },
      ],
      'lib-najdorf': [
        { suffix: 'Mainline ...e5', color: 'b', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6','Be3','e5','Nb3','Be6'] },
        { suffix: 'English Attack', color: 'b', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6','Be3','e6','f3','b5'] },
        { suffix: '6.Bg5', color: 'b', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6','Bg5','e6','f4','Be7'] },
      ],
    };
    return packs[course.id] || [{ suffix: 'Starter', color: 'w', moves: ['e4','e5'] }];
  }

  function cloneCourse(course) {
    const DB = global.OOSData;
    const pack = starterPack(course);
    let first = null;
    pack.forEach((preset, idx) => {
      const line = DB.addUserLine({
        name: `${course.name} - ${preset.suffix}`,
        eco: course.eco || '?',
        opening: course.name,
        color: preset.color,
        tag: idx === 0 ? 'must-know' : 'nice-to-know',
        description: `${course.summary} Starter branch: ${preset.suffix}.`,
        moves: preset.moves,
        source: 'library-starter-pack',
      });
      if (!first) first = line;
    });
    global.OOSApp.toast(`Cloned ${pack.length} editable starter lines from "${course.name}"`, 'good');
    global.OOSApp.go('repertoire', { lineId: first && first.id });
  }

  function previewCourse(course) {
    showError('Preview ' + course.name,
      `Author: ${course.author}\nLevel: ${course.level}\nLines: ${course.lines}, positions: ${course.positions}\nETA: ${course.eta}\n\n${course.summary}`,
      [
        { label: 'Clone starter pack', primary: true, run: () => cloneCourse(course) },
        { label: 'Close' },
      ]);
  }

  function modelGameMoves(game) {
    const DB = global.OOSData;
    const related = DB.line(game.line);
    if (related && related.moves && related.moves.length) return related.moves.slice();
    const samples = {
      mg1: ['e4','c6','d4','d5','e5','Bf5','Nf3','e6','Be2','c5','O-O','Nc6','Be3','cxd4','Nxd4','Nge7'],
      mg2: ['d4','d5','Nf3','Nf6','Bf4','e6','e3','c5','c3','Nc6','Nbd2','Bd6','Bg3','O-O'],
      mg3: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','Nf3','O-O','Be2','e5','O-O','Nc6'],
    };
    return (samples[game.id] || ['e4','e5','Nf3','Nc6','Bc4','Bc5']).slice();
  }

  function showModelGameTrainer(game) {
    const moves = modelGameMoves(game);
    const wrap = el('div', { class: 'modal model-trainer-modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel modal-wide' });
    let ply = 0;
    let board = null;
    let drillMode = false;
    const boardHost = el('div', { class: 'chess-board model-board', 'aria-label': 'Model game replay board' });
    const moveText = el('div', { class: 'mono model-moves' });
    const status = el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '6px' } });

    function fenAt(n) {
      const c = new global.Chess();
      for (let i = 0; i < Math.min(n, moves.length); i++) c.move(moves[i], { sloppy: true });
      return c.fen();
    }
    function renderTrainer() {
      moveText.textContent = moves.map((m, i) => (i % 2 === 0 ? (Math.floor(i / 2) + 1) + '. ' : '') + (i < ply ? m : '…')).join(' ');
      status.textContent = ply >= moves.length ? 'Replay complete. Restart or add this as a repertoire line.' : drillMode ? 'Drill mode: guess the next model move on the board.' : 'Replay mode: reveal moves one by one.';
      if (!board) {
        board = new global.OOSBoard(boardHost, {
          fen: fenAt(ply), interactive: false, showCoords: global.OOSData.getSetting('coords', true),
          orientation: 'white',
          onMove: (move) => {
            const expected = moves[ply];
            if (String(move.san).replace(/[+#?!]+/g,'') === String(expected).replace(/[+#?!]+/g,'')) {
              ply += 1; global.OOSApp.toast('Model move found.', 'good'); board.setFen(fenAt(ply)); renderTrainer();
            } else {
              global.OOSApp.toast('Not the model move. Try again or reveal.', 'warn'); board.setFen(fenAt(ply));
            }
          }
        });
      } else {
        board.setFen(fenAt(ply));
        board.setInteractive(drillMode && ply < moves.length);
      }
    }

    panel.appendChild(el('div', { class: 'eyebrow' }, ['Model-game replay trainer']));
    panel.appendChild(el('h3', {}, [game.white + ' — ' + game.black]));
    panel.appendChild(el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '3px' } }, [game.event + ' · ' + game.result + ' · related: ' + game.line]));
    panel.appendChild(el('div', { class: 'model-trainer-grid', style: { marginTop: '12px' } }, [
      boardHost,
      el('div', { class: 'stack' }, [
        el('div', { class: 'panel', style: { padding: '12px' } }, [moveText, status]),
        el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [
          el('button', { class: 'btn btn-sm', on: { click: () => { ply = Math.max(0, ply - 1); renderTrainer(); } } }, ['Prev']),
          el('button', { class: 'btn btn-sm btn-primary', on: { click: () => { ply = Math.min(moves.length, ply + 1); renderTrainer(); } } }, ['Reveal next']),
          el('button', { class: 'btn btn-sm', on: { click: () => { drillMode = !drillMode; renderTrainer(); } } }, ['Toggle drill']),
          el('button', { class: 'btn btn-sm', on: { click: () => { ply = 0; renderTrainer(); } } }, ['Restart']),
        ]),
        el('button', { class: 'btn btn-primary', on: { click: () => {
          const line = global.OOSData.addUserLine({ name: 'Model: ' + game.white + ' - ' + game.black, opening: game.event, eco: '?', color: 'w', tag: 'model-game', description: 'Created from model-game trainer.', moves });
          global.OOSApp.toast('Model game added as editable line.', 'good'); wrap.remove(); global.OOSApp.go('repertoire', { lineId: line.id });
        } } }, ['Add as repertoire line']),
      ]),
    ]));
    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [el('button', { class: 'btn', on: { click: () => wrap.remove() } }, ['Close'])]));
    back.addEventListener('click', () => wrap.remove());
    wrap.appendChild(back); wrap.appendChild(panel); document.body.appendChild(wrap);
    renderTrainer();
  }

  // ----------------------------------------------------------------------
  // COACH
  // ----------------------------------------------------------------------
  function renderCoach(app) {
    const DB = global.OOSData;
    app.innerHTML = '';
    const root = el('div', {});

    const students = DB.students();
    const assignments = DB.assignments();
    const totalDue = assignments.filter(a => a.status !== 'done').length;
    const completedCount = assignments.filter(a => a.status === 'done').length;
    const completionPct = assignments.length ? Math.round((completedCount / assignments.length) * 100) : 0;

    root.appendChild(el('div', { class: 'row-between', style: { marginBottom: '20px' } }, [
      el('div', {}, [
        el('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, [
          el('div', { class: 'eyebrow' }, ['Coach']),
          el('span', { class: 'pill pill-info pill-plain', title: 'Stored on this device only' }, ['Local-only']),
        ]),
        el('h2', { style: { marginTop: '4px' } }, ['Your students']),
        el('div', { class: 'muted', style: { marginTop: '4px', fontSize: '13px' } }, [
          'Track student records and assignments locally. Real coach\u2194student syncing across devices needs a backend (see BACKEND_MIGRATION).',
        ]),
      ]),
      el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [
        el('button', { class: 'btn', on: { click: () => importAssignmentPackageDialog(app) } }, [icon(ICONS.upload, 14), 'Import assignment']),
        el('button', { class: 'btn btn-primary', on: { click: () => openAddStudentDialog(app) } }, [icon(ICONS.add, 14), 'Add student']),
      ]),
    ]));

    if (!students.length) {
      root.appendChild(el('div', { class: 'empty large card' }, [
        el('div', { class: 'icon' }, [icon(ICONS.target, 22)]),
        el('h3', {}, ['No students yet']),
        el('p', {}, ['Add your first student record to start tracking assignments and progress. Each student is a local tracking handle — they can install OpeningOS separately for their own profile.']),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn btn-primary', on: { click: () => openAddStudentDialog(app) } }, [icon(ICONS.add, 14), 'Add first student']),
        ]),
      ]));
      app.appendChild(root);
      return;
    }

    // KPI cards (real numbers)
    root.appendChild(el('div', { class: 'insights-grid', style: { marginBottom: '20px' } }, [
      metricCard('Active students',  String(students.length), 'var(--accent)', '', ''),
      metricCard('Assignments open',  String(totalDue), 'var(--info)', `${completedCount} done`, ''),
      metricCard('Avg completion',    completionPct + '%', 'var(--good)', '', ''),
      metricCard('Total assigned',    String(assignments.length), 'var(--warn)', '', ''),
    ]));

    root.appendChild(el('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, ['Students']));

    const list = el('div', { class: 'students-table' });
    list.appendChild(el('div', { class: 'student-row head' }, [
      el('div', {}, ['']),
      el('div', { class: 'name' }, ['Student']),
      el('div', {}, ['Rating']),
      el('div', {}, ['Completion']),
      el('div', {}, ['Weak line']),
      el('div', {}, ['']),
    ]));
    students.forEach(s => {
      const studentAssignments = assignments.filter(a => a.studentId === s.id);
      const studentDone = studentAssignments.filter(a => a.status === 'done').length;
      const completionRatio = studentAssignments.length ? studentDone / studentAssignments.length : 0;
      list.appendChild(el('div', { class: 'student-row' }, [
        el('div', { class: 'student-avatar' }, [s.avatar]),
        el('div', { class: 'name' }, [
          s.name,
          el('span', { class: 'meta' }, [`${studentAssignments.length} assigned · ${studentDone} done`]),
        ]),
        el('div', { class: 'mono' }, [s.rating ? String(s.rating) : '—']),
        el('div', {}, [
          el('div', { class: 'completion-bar' }, [el('span', { style: { width: Math.round(completionRatio * 100) + '%' } })]),
          el('div', { style: { fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' } }, [Math.round(completionRatio * 100) + '%']),
        ]),
        el('div', { class: 'muted', style: { fontSize: '12.5px' } }, [s.weakLine || '—']),
        el('div', { class: 'row', style: { gap: '4px' } }, [
          el('button', { class: 'btn btn-sm', on: { click: () => openAssignDialog(s) } }, ['Assign']),
          el('button', { class: 'btn btn-sm btn-ghost', on: { click: () => {
            if (confirm(`Remove ${s.name}? Their assignments will also be deleted.`)) {
              DB.removeStudent(s.id);
              renderCoach(app);
            }
          } } }, ['×']),
        ]),
      ]));
    });
    root.appendChild(list);

    // Recent assignments
    if (assignments.length) {
      root.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '24px', marginBottom: '8px' } }, ['Recent assignments']));
      const tbl = el('div', { class: 'students-table' });
      tbl.appendChild(el('div', { class: 'student-row head', style: { gridTemplateColumns: '1.1fr 1.4fr 100px 110px 110px 140px' } }, [
        el('div', {}, ['Student']),
        el('div', {}, ['Line']),
        el('div', {}, ['Mode']),
        el('div', {}, ['Due']),
        el('div', {}, ['Status']),
        el('div', {}, ['Actions']),
      ]));
      assignments.forEach(a => {
        const studentName = (students.find(s => s.id === a.studentId) || {}).name || 'unknown';
        const lineName = (DB.line(a.lineId) || {}).name || a.lineId;
        tbl.appendChild(el('div', {
          class: 'student-row',
          style: { gridTemplateColumns: '1.1fr 1.4fr 100px 110px 110px 140px' },
        }, [
          el('div', {}, [studentName]),
          el('div', { class: 'mono', style: { fontSize: '12.5px', color: 'var(--text-1)' } }, [lineName]),
          el('div', { class: 'mono', style: { fontSize: '12px' } }, [a.mode || 'Learn + Review']),
          el('div', { class: 'muted', style: { fontSize: '12px' } }, [a.due || '—']),
          el('div', {}, [
            el('button', {
              class: 'pill ' + (a.status === 'done' ? 'pill-good' : 'pill-warn'),
              style: { cursor: 'pointer', border: 'none', font: 'inherit' },
              on: { click: () => {
                DB.updateAssignment(a.id, { status: a.status === 'done' ? 'pending' : 'done' });
                renderCoach(app);
              } },
            }, [a.status]),
          ]),
          el('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } }, [
            el('button', { class: 'btn btn-sm', on: { click: () => exportAssignmentPackage(a.id) } }, ['Export']),
            el('button', { class: 'btn btn-sm btn-ghost', on: { click: () => { DB.removeAssignment(a.id); renderCoach(app); } } }, ['Remove']),
          ]),
        ]));
      });
      root.appendChild(tbl);
    }

    app.appendChild(root);
  }

  function openAddStudentDialog(app) {
    const DB = global.OOSData;
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel' });
    panel.appendChild(el('div', { class: 'eyebrow' }, ['New student']));
    panel.appendChild(el('h3', { style: { marginTop: '6px' } }, ['Add a student to your roster']));
    panel.appendChild(el('p', { class: 'muted', style: { fontSize: '13px', marginTop: '6px' } }, [
      'This is a local tracking record. The student can install OpeningOS separately to use it themselves.',
    ]));

    const nameInput = el('input', { class: 'input', type: 'text', placeholder: 'Student name', style: { marginTop: '14px' } });
    const ratingInput = el('input', { class: 'input', type: 'number', placeholder: 'Rating (optional)', style: { marginTop: '8px' } });
    const weakInput = el('input', { class: 'input', type: 'text', placeholder: 'Weak line (optional, e.g. "Caro-Kann Advance")', style: { marginTop: '8px' } });
    panel.appendChild(nameInput);
    panel.appendChild(ratingInput);
    panel.appendChild(weakInput);

    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } }, [
      el('button', { class: 'btn', on: { click: () => wrap.remove() } }, ['Cancel']),
      el('button', { class: 'btn btn-primary', on: { click: () => {
        const name = (nameInput.value || '').trim();
        if (!name) return global.OOSApp.toast('Enter a name', 'warn');
        DB.addStudent({
          name,
          rating: parseInt(ratingInput.value, 10) || 0,
          weakLine: (weakInput.value || '').trim(),
        });
        wrap.remove();
        renderCoach(app);
        global.OOSApp.toast(`Added ${name}`, 'good');
      } } }, ['Add student']),
    ]));

    back.addEventListener('click', () => wrap.remove());
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    setTimeout(() => nameInput.focus(), 60);
  }

  function openAssignDialog(student) {
    const DB = global.OOSData;
    const lines = DB.lines();
    let chosenLineId = lines[0] ? lines[0].id : null;
    let mode = 'Learn + Review';
    let due = 'Sunday';
    let message = '';

    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel' });
    panel.appendChild(el('div', { class: 'eyebrow' }, ['Assign']));
    panel.appendChild(el('h3', {}, [`Assign work to ${student.name}`]));
    panel.appendChild(el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '6px' } }, [`Rating ${student.rating} · last seen ${student.lastSeen}`]));

    panel.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '14px' } }, ['Line']));
    const lineSelect = el('div', { class: 'choice-row', style: { flexWrap: 'wrap' } });
    lines.forEach(line => {
      lineSelect.appendChild(el('button', {
        class: line.id === chosenLineId ? 'is-active' : '',
        on: { click: (e) => {
          chosenLineId = line.id;
          lineSelect.querySelectorAll('button').forEach(b => b.classList.remove('is-active'));
          e.currentTarget.classList.add('is-active');
        } },
      }, [line.name]));
    });
    panel.appendChild(lineSelect);

    panel.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '12px' } }, ['Practice mode']));
    const modeRow = el('div', { class: 'choice-row' });
    ['Learn + Review', 'Daily', 'Blind recall', 'Speed drill'].forEach((m, i) => {
      modeRow.appendChild(el('button', {
        class: i === 0 ? 'is-active' : '',
        on: { click: e => { mode = m; modeRow.querySelectorAll('button').forEach(b => b.classList.remove('is-active')); e.currentTarget.classList.add('is-active'); } },
      }, [m]));
    });
    panel.appendChild(modeRow);

    panel.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '12px' } }, ['Due']));
    const dueRow = el('div', { class: 'choice-row' });
    ['Tomorrow', 'Sunday', 'Next week', 'No deadline'].forEach((d, i) => {
      dueRow.appendChild(el('button', {
        class: d === due ? 'is-active' : '',
        on: { click: e => { due = d; dueRow.querySelectorAll('button').forEach(b => b.classList.remove('is-active')); e.currentTarget.classList.add('is-active'); } },
      }, [d]));
    });
    panel.appendChild(dueRow);

    const messageInput = el('textarea', { class: 'input', placeholder: 'Optional message — e.g. "focus on the …c5 break."', style: { marginTop: '14px', minHeight: '80px' } });
    messageInput.addEventListener('input', e => message = e.target.value);
    panel.appendChild(messageInput);

    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } }, [
      el('button', { class: 'btn', on: { click: () => wrap.remove() } }, ['Cancel']),
      el('button', { class: 'btn btn-primary', on: { click: () => {
        DB.addAssignment({
          studentId: student.id,
          lineId: chosenLineId,
          mode,
          due,
          message,
          status: 'pending',
        });
        wrap.remove();
        global.OOSApp.toast(`Assigned ${(DB.line(chosenLineId) || {}).name} to ${student.name}`, 'good');
        const app = document.getElementById('app');
        renderCoach(app);
      } } }, ['Send assignment']),
    ]));

    back.addEventListener('click', () => wrap.remove());
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }


  function downloadLocalFile(filename, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function safeFileName(text) {
    return String(text || 'openingos-assignment').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'openingos-assignment';
  }

  function exportAssignmentPackage(assignmentId) {
    const DB = global.OOSData;
    try {
      const pkg = DB.exportAssignmentPackage(assignmentId);
      const lineName = (pkg.line && pkg.line.name) || 'assignment';
      downloadLocalFile(safeFileName(lineName) + '-assignment.openingos.json', JSON.stringify(pkg, null, 2), 'application/json');
      global.OOSApp.toast('Assignment package exported', 'good');
    } catch (err) {
      global.OOSApp.toast(err.message || 'Could not export assignment', 'warn');
    }
  }

  function importAssignmentPackageDialog(app) {
    const input = el('input', { type: 'file', accept: 'application/json,.json,.openingos.json', style: { display: 'none' } });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const pkg = JSON.parse(reader.result);
          const result = global.OOSData.importAssignmentPackage(pkg);
          global.OOSApp.toast(`Imported coach assignment: ${result.line.name}`, 'good');
          renderCoach(app || document.getElementById('app'));
        } catch (err) {
          showError('Assignment import failed', err.message || 'The selected file was not an OpeningOS assignment package.', [
            { label: 'OK', primary: true, run: () => {} },
          ]);
        }
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  }

  // ----------------------------------------------------------------------
  // OPPONENT PREP
  // ----------------------------------------------------------------------
  let oppState = {
    source: 'lichess',          // 'lichess' | 'chesscom' | 'pgn'
    username: '',
    pgn: '',
    busy: false,
    error: null,
    report: null,               // computed analysis
    saved: [],                  // historical opponent reports kept in profile state
  };

  function renderOpponentPrep(app) {
    const DB = global.OOSData;
    app.innerHTML = '';
    const root = el('div', {});

    root.appendChild(el('div', { style: { marginBottom: '20px' } }, [
      el('div', { class: 'eyebrow' }, ['Opponent prep']),
      el('h2', { style: { marginTop: '4px' } }, ['Who are you facing next?']),
      el('div', { class: 'muted', style: { marginTop: '4px', fontSize: '13px' } }, [
        'Enter a Lichess or Chess.com username, or paste their PGN. We pull their public games and bucket by ECO/opening.',
      ]),
    ]));

    const form = el('div', { class: 'opp-form' });
    form.appendChild(el('div', { class: 'row' }, [
      el('span', { class: 'eyebrow' }, ['Source']),
      el('div', { class: 'choice-row' },
        [
          { v: 'lichess', label: 'Lichess' },
          { v: 'chesscom', label: 'Chess.com' },
          { v: 'pgn', label: 'PGN' },
        ].map(s => el('button', {
          class: oppState.source === s.v ? 'is-active' : '',
          on: { click: () => { oppState.source = s.v; renderOpponentPrep(app); } },
        }, [s.label])),
      ),
    ]));

    if (oppState.source === 'pgn') {
      const ta = el('textarea', { class: 'input', placeholder: 'Paste their PGN games here…', style: { marginTop: '12px', minHeight: '120px' } });
      ta.value = oppState.pgn;
      ta.addEventListener('input', e => oppState.pgn = e.target.value);
      form.appendChild(ta);
    } else {
      const username = el('input', { class: 'input', type: 'text', placeholder: oppState.source === 'lichess' ? 'Lichess username' : 'Chess.com username', style: { marginTop: '12px' } });
      username.value = oppState.username;
      username.addEventListener('input', e => oppState.username = e.target.value);
      form.appendChild(username);
    }

    const analyzeBtn = el('button', {
      class: 'btn btn-primary',
      on: { click: () => analyzeOpponent(app) },
    }, [oppState.busy ? 'Analyzing…' : 'Analyze games']);
    if (oppState.busy) analyzeBtn.disabled = true;
    form.appendChild(el('div', { class: 'row', style: { marginTop: '12px', gap: '10px' } }, [
      analyzeBtn,
      oppState.report ? el('button', { class: 'btn', on: { click: () => { oppState.report = null; renderOpponentPrep(app); } } }, ['Reset']) : null,
    ]));
    form.appendChild(el('div', { class: 'muted', style: { marginTop: '10px', fontSize: '12px' } }, [
      'Public profiles only. We call ',
      oppState.source === 'lichess' ? 'lichess.org' : oppState.source === 'chesscom' ? 'api.chess.com' : 'no remote service',
      ' directly from your browser — your data stays local.',
    ]));
    if (oppState.error) {
      form.appendChild(el('div', { class: 'warn-banner', style: { marginTop: '12px' } }, [
        icon(ICONS.x, 14),
        el('div', {}, [el('strong', {}, ['Error: ']), oppState.error]),
      ]));
    }
    root.appendChild(form);

    if (oppState.report) {
      root.appendChild(buildOpponentReport(oppState.report));
    }

    app.appendChild(root);
  }

  async function analyzeOpponent(app) {
    oppState.busy = true;
    oppState.error = null;
    renderOpponentPrep(app);
    try {
      let games = [];
      if (oppState.source === 'lichess') {
        if (!oppState.username.trim()) throw new Error('Enter a Lichess username.');
        const raw = await global.OOSApi.lichessUserGames(oppState.username.trim(), 50);
        raw.forEach(g => { try { games = games.concat(global.OOSPgn.parse(g.pgn)); } catch (_) {} });
      } else if (oppState.source === 'chesscom') {
        if (!oppState.username.trim()) throw new Error('Enter a Chess.com username.');
        const raw = await global.OOSApi.chesscomUserGames(oppState.username.trim(), 50);
        raw.forEach(g => { try { games = games.concat(global.OOSPgn.parse(g.pgn)); } catch (_) {} });
      } else {
        if (!oppState.pgn.trim()) throw new Error('Paste at least one PGN game.');
        games = global.OOSPgn.parse(oppState.pgn);
      }
      if (!games.length) throw new Error('No games could be parsed.');

      const report = computeOpponentReport(games, oppState.username || 'Opponent');
      oppState.report = report;
      oppState.busy = false;
      renderOpponentPrep(app);
    } catch (err) {
      oppState.busy = false;
      oppState.error = err.message || String(err);
      renderOpponentPrep(app);
    }
  }

  // Compute an opponent report from parsed PGN games. Buckets by ECO.
  function computeOpponentReport(games, name) {
    const username = (name || '').toLowerCase();
    let asWhite = 0, asBlack = 0;
    const ecoBuckets = {};   // ecoKey -> { eco, opening, count, asWhite, asBlack, results }
    const firstMoves = {};   // 'e4' -> count (when opponent has White)

    games.forEach(g => {
      const headers = g.headers || {};
      const result = headers.Result || '*';
      const ecoKey = (headers.ECO || '?') + ' · ' + (headers.Opening || headers.Variation || 'Unnamed');
      const eco = headers.ECO || '?';
      const opening = headers.Opening || headers.Variation || 'Unnamed';
      const white = (headers.White || '').toLowerCase();
      const black = (headers.Black || '').toLowerCase();
      const isOppWhite = username && white.includes(username);
      const isOppBlack = username && black.includes(username);
      if (isOppWhite) asWhite++;
      if (isOppBlack) asBlack++;

      // First-move tally when opponent has White
      const firstSan = (g.moves[0] && g.moves[0].san) || '';
      if (isOppWhite && firstSan) {
        firstMoves[firstSan] = (firstMoves[firstSan] || 0) + 1;
      }

      const bucket = ecoBuckets[ecoKey] || { eco, opening, count: 0, asWhite: 0, asBlack: 0, w: 0, l: 0, d: 0 };
      bucket.count++;
      if (isOppWhite) bucket.asWhite++;
      if (isOppBlack) bucket.asBlack++;
      if (result === '1-0') (isOppWhite ? bucket.w++ : bucket.l++);
      else if (result === '0-1') (isOppBlack ? bucket.w++ : bucket.l++);
      else if (result === '1/2-1/2') bucket.d++;
      ecoBuckets[ecoKey] = bucket;
    });

    const total = games.length;
    const buckets = Object.entries(ecoBuckets)
      .map(([key, b]) => ({
        key, eco: b.eco, opening: b.opening, count: b.count, frequency: b.count / total,
        asWhite: b.asWhite, asBlack: b.asBlack,
        results: { w: b.w, l: b.l, d: b.d },
      }))
      .sort((a, b) => b.count - a.count);

    // First-move dominance string
    const fm = Object.entries(firstMoves).sort((a, b) => b[1] - a[1]);
    const topFirst = fm.length ? `${fm[0][0]} (${Math.round(fm[0][1] / Math.max(1, asWhite) * 100)}%)` : null;

    // Compute "your confidence" per bucket: look up if any of our lines have
    // matching ECO, then average their stability/lapses health.
    const DB = global.OOSData;
    const ourLines = DB.lines();
    buckets.forEach(b => {
      const matching = ourLines.filter(l => l.eco === b.eco);
      if (!matching.length) { b.yourConfidence = 0; b.action = 'Prepare'; return; }
      let totalStable = 0, totalPositions = 0;
      matching.forEach(l => {
        const positions = DB.positionsForLine(l.id);
        positions.forEach(p => {
          const c = DB.srs(p.id);
          totalPositions++;
          if (c && c.stability >= 4 && c.lapses === 0) totalStable++;
        });
      });
      b.yourConfidence = totalPositions ? totalStable / totalPositions : 0;
      b.action = b.yourConfidence >= 0.6 ? 'Review' : b.yourConfidence >= 0.3 ? 'Prepare' : 'Prepare';
      if (b.frequency < 0.04) b.action = 'Optional';
    });

    // Build a 35-min plan: top 3 prepared + 1 review + 1 trap check
    const plan = [];
    const prep = buckets.filter(b => b.action === 'Prepare').slice(0, 2);
    const review = buckets.filter(b => b.action === 'Review').slice(0, 1);
    if (review[0]) plan.push({ mins: 10, task: `Review ${review[0].opening} (${review[0].eco})` });
    if (prep[0])   plan.push({ mins: 10, task: `Prepare against ${prep[0].opening} — weak coverage` });
    if (prep[1])   plan.push({ mins: 10, task: `Backup line vs ${prep[1].opening}` });
    plan.push({ mins: 5,  task: 'Trap check on common transpositions' });

    return {
      name, total,
      asWhite, asBlack,
      topFirst,
      buckets,
      plan,
      generatedAt: Date.now(),
    };
  }

  function buildOpponentReport(report) {
    const root = el('div', {});

    root.appendChild(el('div', { class: 'panel', style: { padding: '16px 20px', marginTop: '20px', marginBottom: '20px' } }, [
      el('div', { class: 'row-between' }, [
        el('div', {}, [
          el('div', { style: { fontSize: '17px', fontWeight: 600 } }, [`Opponent: ${report.name}`]),
          el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '2px' } }, [
            `${report.total} games analyzed · ${report.asWhite} as White · ${report.asBlack} as Black`,
          ]),
        ]),
        report.topFirst
          ? el('span', { class: 'pill pill-warn' }, [`Most-played first move: ${report.topFirst}`])
          : el('span', { class: 'pill pill-info' }, ['Mixed first moves']),
      ]),
    ]));

    const grid = el('div', { class: 'opp-result' });

    const coverage = el('div', {});
    coverage.appendChild(el('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, ['Their openings vs your coverage']));
    const table = el('div', { class: 'opp-table' });
    table.appendChild(el('div', { class: 'opp-row head' }, [
      el('div', {}, ['Opening']),
      el('div', {}, ['Their freq']),
      el('div', {}, ['Your conf']),
      el('div', {}, ['Action']),
    ]));
    report.buckets.slice(0, 8).forEach(b => {
      const actionPill = b.action === 'Prepare' ? 'pill-bad' : b.action === 'Review' ? 'pill-warn' : 'pill-info';
      table.appendChild(el('div', { class: 'opp-row' }, [
        el('div', {}, [
          (b.eco !== '?' ? b.eco + ' · ' : '') + b.opening,
          el('div', { class: 'opp-bar' }, [el('span', { style: { width: Math.round(b.frequency * 100) + '%' } })]),
          el('div', { class: 'muted', style: { fontSize: '11px', marginTop: '2px' } }, [
            `${b.count} games · ${b.results.w}W ${b.results.l}L ${b.results.d}D`,
          ]),
        ]),
        el('div', { class: 'mono' }, [Math.round(b.frequency * 100) + '%']),
        el('div', {}, [
          el('div', { class: 'mono' }, [Math.round((b.yourConfidence || 0) * 100) + '%']),
          el('div', { class: 'opp-bar opp-conf' }, [el('span', { style: { width: Math.round((b.yourConfidence || 0) * 100) + '%' } })]),
        ]),
        el('span', { class: 'pill ' + actionPill + ' pill-plain' }, [b.action]),
      ]));
    });
    coverage.appendChild(table);
    grid.appendChild(coverage);

    // Plan
    const planSide = el('div', {});
    planSide.appendChild(el('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, ['Recommended 35-min prep']));
    const plan = el('div', { class: 'opp-plan' });
    report.plan.forEach(step => {
      plan.appendChild(el('div', { class: 'opp-plan-row' }, [
        el('div', { class: 'mins' }, [step.mins + 'm']),
        el('div', {}, [step.task]),
      ]));
    });
    planSide.appendChild(plan);

    const rareCount = report.buckets.filter(b => b.frequency < 0.04).length;
    if (rareCount > 0) {
      planSide.appendChild(el('div', { class: 'warn-banner', style: { marginTop: '12px' } }, [
        icon(ICONS.target, 14),
        el('div', {}, [
          el('strong', {}, ['Anti-overprep: ']),
          `${rareCount} opening${rareCount === 1 ? '' : 's'} appeared in less than 4% of games. Don't spend much time there.`,
        ]),
      ]));
    }
    planSide.appendChild(el('div', { class: 'row', style: { marginTop: '12px', gap: '8px' } }, [
      el('button', { class: 'btn btn-primary', on: { click: () => {
        // Persist the opponent report into profile state so it survives reload.
        const DB = global.OOSData;
        DB.state.opponentReports = DB.state.opponentReports || [];
        DB.state.opponentReports.unshift(Object.assign({}, oppState.report, { savedAt: Date.now() }));
        DB.state.opponentReports = DB.state.opponentReports.slice(0, 10);
        DB.persist();
        global.OOSApp.toast('Opponent report saved to this profile', 'good');
      } } }, ['Save profile']),
      el('button', { class: 'btn', on: { click: () => global.OOSApp.go('practice') } }, ['Open practice']),
    ]));
    grid.appendChild(planSide);

    root.appendChild(grid);
    return root;
  }

  // ----------------------------------------------------------------------
  // MULTI-STEP ONBOARDING
  // ----------------------------------------------------------------------
  let onboardState = { step: 0, goal: null, level: null, white: null, black: null, importChoice: null };

  function renderOnboarding() {
    const card = document.getElementById('onboardCard');
    if (!card) return;
    card.classList.add('wide');
    card.innerHTML = '';

    const steps = ['Goal', 'Level', 'Openings', 'Import', 'Plan'];
    const progress = el('div', { class: 'onboard-progress' },
      steps.map((_, i) => el('span', { class: i <= onboardState.step ? 'done' : '' }))
    );
    card.appendChild(progress);

    const content = el('div', {});
    switch (onboardState.step) {
      case 0: content.appendChild(stepGoal()); break;
      case 1: content.appendChild(stepLevel()); break;
      case 2: content.appendChild(stepOpenings()); break;
      case 3: content.appendChild(stepImport()); break;
      case 4: content.appendChild(stepPlan()); break;
    }
    card.appendChild(content);

    const foot = el('div', { class: 'onboard-foot' });
    foot.appendChild(el('button', {
      class: 'btn btn-ghost' + (onboardState.step === 0 ? '' : ''),
      style: { visibility: onboardState.step === 0 ? 'hidden' : 'visible' },
      on: { click: () => { onboardState.step--; renderOnboarding(); } },
    }, ['← Back']));
    foot.appendChild(el('button', {
      class: 'btn btn-primary',
      on: { click: () => {
        if (onboardState.step < 4) { onboardState.step++; renderOnboarding(); }
        else finishOnboarding();
      } },
    }, [onboardState.step === 4 ? 'Open my plan' : 'Continue']));
    card.appendChild(foot);
  }

  function pickerGroup(label, options, selected, onPick) {
    return el('div', {}, [
      el('h2', {}, [label]),
      el('div', { class: 'onboard-options' },
        options.map(o => el('button', {
          class: 'onboard-opt' + (selected === o.v ? ' is-active' : ''),
          on: { click: () => { onPick(o.v); renderOnboarding(); } },
        }, [
          el('div', { style: { fontWeight: 600 } }, [o.label]),
          o.desc ? el('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' } }, [o.desc]) : null,
        ])),
      ),
    ]);
  }

  function stepGoal() {
    return pickerGroup("What brings you to OpeningOS?", [
      { v: 'first',     label: 'Build my first repertoire', desc: 'Start from scratch with curated lines.' },
      { v: 'memorize',  label: 'Memorize an existing PGN',  desc: 'I have material — help me remember it.' },
      { v: 'tournament',label: 'Prepare for a tournament',  desc: 'Confidence, not new theory.' },
      { v: 'fix',       label: 'Fix opening mistakes',      desc: 'Import games and repair the problems.' },
      { v: 'coach',     label: 'Coach my students',         desc: 'Assign and track student progress.' },
      { v: 'opponent',  label: 'Analyze an opponent',       desc: 'Their lines, my coverage, my plan.' },
    ], onboardState.goal, v => onboardState.goal = v);
  }

  function stepLevel() {
    return pickerGroup('What level should we tune the UI for?', [
      { v: 'beginner', label: 'Beginner',     desc: '800–1400 · friendly, low complexity' },
      { v: 'club',     label: 'Club',         desc: '1400–2000 · productive, structured' },
      { v: 'advanced', label: 'Advanced',     desc: '2000+ · powerful, dense' },
      { v: 'titled',   label: 'Titled / Coach', desc: 'Full power, no guard rails' },
    ], onboardState.level, v => onboardState.level = v);
  }

  function stepOpenings() {
    return el('div', {}, [
      pickerGroup('What do you play as White?', [
        { v: 'e4',  label: '1.e4' },
        { v: 'd4',  label: '1.d4' },
        { v: 'c4',  label: '1.c4' },
        { v: 'Nf3', label: '1.Nf3' },
        { v: '?',   label: "I don't know yet" },
      ], onboardState.white, v => onboardState.white = v),
      el('div', { style: { marginTop: '20px' } }, [
        pickerGroup('Against 1.e4 with Black?', [
          { v: 'e5',     label: '1...e5' },
          { v: 'sicilian', label: 'Sicilian' },
          { v: 'french', label: 'French' },
          { v: 'caro',   label: 'Caro-Kann' },
          { v: 'pirc',   label: 'Pirc/Modern' },
          { v: '?',      label: "I don't know yet" },
        ], onboardState.black, v => onboardState.black = v),
      ]),
    ]);
  }

  function stepImport() {
    return pickerGroup('Bring your existing material?', [
      { v: 'lichess',  label: 'Connect Lichess',  desc: 'We\'ll import your last 100 games.' },
      { v: 'chesscom', label: 'Connect Chess.com', desc: 'Public games via PubAPI.' },
      { v: 'pgn',      label: 'Upload PGN',       desc: 'A study or PGN file from elsewhere.' },
      { v: 'skip',     label: 'Skip for now',     desc: "We'll seed you with a starter plan." },
    ], onboardState.importChoice, v => onboardState.importChoice = v);
  }

  function stepPlan() {
    const days = [
      'Day 1 — learn the core line',
      'Day 2 — review and add the common sideline',
      'Day 3 — practice weak positions',
      'Day 4 — import your last 5 games',
      'Day 5 — repair mistakes from those games',
      'Day 6 — walk through one model game',
      'Day 7 — test yourself in tournament-warmup mode',
    ];
    return el('div', {}, [
      el('h2', {}, ['Your first 7-day plan']),
      el('div', { class: 'muted', style: { marginBottom: '14px', fontSize: '13px' } }, [
        'Tuned for ', el('strong', {}, [onboardState.level || 'club']), '.',
        ' Goal: ', el('strong', {}, [onboardState.goal || 'first']), '.',
        ' We\'ll keep your daily session under 15 minutes.',
      ]),
      el('div', { class: 'panel', style: { padding: '14px 18px' } },
        days.map(d => el('div', { class: 'opp-plan-row' }, [
          el('div', { class: 'mins', style: { color: 'var(--text-2)' } }, [d.split(' — ')[0]]),
          el('div', {}, [d.split(' — ')[1]]),
        ]))
      ),
    ]);
  }

  function finishOnboarding() {
    global.OOSData.setOnboarded();
    document.getElementById('onboard').hidden = true;
    global.OOSApp.toast('Plan ready — see you on Today', 'good');
    global.OOSApp.go('today');
  }

  // ----------------------------------------------------------------------
  // MANUAL LINE CREATION WIZARD
  // ----------------------------------------------------------------------
  // 4-step wizard: meta -> moves -> validate -> save.
  function showLineCreationWizard(onSubmit, existingLine) {
    const DB = global.OOSData;
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel wide' });
    let step = 0;

    // State. existingLine turns the wizard into a real edit flow.
    const isEdit = !!existingLine;
    const meta = {
      name: existingLine ? existingLine.name : '',
      color: existingLine ? existingLine.color : 'w',
      folder: existingLine ? (existingLine.repId || (existingLine.color === 'b' ? 'rep-b-e4' : 'rep-w')) : 'rep-w',
      tag: existingLine ? (existingLine.tag || 'nice-to-know') : 'nice-to-know',
      eco: existingLine ? (existingLine.eco || '') : '',
      description: existingLine ? (existingLine.description || '') : '',
    };
    const repFolders = DB.repertoires();
    let moves = existingLine ? (existingLine.moves || []).slice() : []; // array of validated SAN
    let inputBuffer = ''; // typed SAN buffer
    let chess = rebuildChess(moves);
    let board = null;

    function close() { wrap.remove(); }
    back.addEventListener('click', close);
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    render();

    function render() {
      panel.innerHTML = '';
      panel.appendChild(buildProgress(step, ['Details', 'Moves', 'Review', 'Save']));
      if (step === 0) renderMeta();
      else if (step === 1) renderMoves();
      else if (step === 2) renderReview();
      else if (step === 3) renderSave();
    }

    function rebuildChess(moveList) {
      const c = new global.Chess();
      (moveList || []).forEach(m => c.move(m, { sloppy: true }));
      return c;
    }

    function buildProgress(active, labels) {
      return el('div', { class: 'onboard-progress', style: { marginBottom: '14px' } },
        labels.map((_, i) => el('span', { class: i <= active ? 'done' : '' })));
    }

    // ---- Step 0: meta ----------------------------------------------------
    function renderMeta() {
      panel.appendChild(el('div', { class: 'eyebrow' }, [isEdit ? 'Edit line' : 'New line']));
      panel.appendChild(el('h3', {}, [isEdit ? 'Update this repertoire line' : 'What are you building?']));

      panel.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '14px' } }, ['Name']));
      const nameInput = el('input', { class: 'input', type: 'text', placeholder: 'e.g. Caro-Kann — Advance, my main line' });
      nameInput.value = meta.name;
      nameInput.addEventListener('input', e => meta.name = e.target.value);
      panel.appendChild(nameInput);

      panel.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' } }, [
        el('div', {}, [
          el('div', { class: 'eyebrow', style: { marginBottom: '6px' } }, ['You play']),
          el('div', { class: 'choice-row' },
            [{ v: 'w', l: 'White' }, { v: 'b', l: 'Black' }].map(c => el('button', {
              class: meta.color === c.v ? 'is-active' : '',
              on: { click: e => {
                meta.color = c.v;
                meta.folder = c.v === 'w' ? 'rep-w' : 'rep-b-e4';
                render();
              } },
            }, [c.l])),
          ),
        ]),
        el('div', {}, [
          el('div', { class: 'eyebrow', style: { marginBottom: '6px' } }, ['Folder']),
          el('div', { class: 'choice-row', style: { flexWrap: 'wrap' } },
            repFolders.filter(r => r.color === meta.color).map(r => el('button', {
              class: meta.folder === r.id ? 'is-active' : '',
              on: { click: e => {
                meta.folder = r.id;
                render();
              } },
            }, [r.name.replace(/^Black vs /, '').replace(/^White /, '')])),
          ),
        ]),
      ]));

      panel.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '12px', marginBottom: '6px' } }, ['Label']));
      panel.appendChild(el('div', { class: 'choice-row', style: { flexWrap: 'wrap' } },
        [
          { v: 'must-know',    l: 'Must know' },
          { v: 'nice-to-know', l: 'Nice to know' },
          { v: 'surprise',     l: 'Surprise weapon' },
          { v: 'investigate',  l: 'Investigate' },
          { v: 'tournament',   l: 'Tournament prep' },
        ].map(t => el('button', {
          class: meta.tag === t.v ? 'is-active' : '',
          on: { click: e => {
            meta.tag = t.v;
            render();
          } },
        }, [t.l])),
      ));

      panel.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '12px', marginBottom: '6px' } }, ['ECO (optional)']));
      const ecoInput = el('input', { class: 'input', type: 'text', placeholder: 'e.g. B12', style: { width: '120px' } });
      ecoInput.value = meta.eco;
      ecoInput.addEventListener('input', e => meta.eco = e.target.value.toUpperCase().slice(0, 4));
      panel.appendChild(ecoInput);

      panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } }, [
        el('button', { class: 'btn', on: { click: close } }, ['Cancel']),
        el('button', { class: 'btn btn-primary', on: { click: () => {
          if (!meta.name.trim()) return global.OOSApp.toast('Give the line a name first', 'warn');
          step = 1; render();
        } } }, ['Continue']),
      ]));
    }

    // ---- Step 1: moves ---------------------------------------------------
    function renderMoves() {
      panel.appendChild(el('div', { class: 'eyebrow' }, ['Add moves']));
      panel.appendChild(el('h3', {}, [meta.name]));

      const layout = el('div', { style: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', marginTop: '12px' } });
      const boardHost = el('div', { class: 'chess-board' });
      layout.appendChild(boardHost);

      const right = el('div', {});

      // Move list
      right.appendChild(el('div', { class: 'eyebrow' }, ['Sequence so far']));
      const seq = el('div', {
        class: 'mono',
        style: { fontSize: '13px', lineHeight: '1.9', minHeight: '40px', padding: '10px 12px',
                 background: 'var(--bg-2)', border: '1px solid var(--line)',
                 borderRadius: 'var(--r-1)', marginTop: '4px', maxHeight: '160px', overflowY: 'auto' },
      });
      moves.forEach((m, i) => {
        const num = i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : '';
        const span = el('span', {}, [num + m + ' ']);
        seq.appendChild(span);
      });
      if (!moves.length) seq.appendChild(el('span', { class: 'muted' }, ['Make moves on the board, type SAN, or paste a PGN.']));
      right.appendChild(seq);

      // SAN input
      right.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '12px', marginBottom: '4px' } }, ['Type SAN']));
      const sanInput = el('input', { class: 'input', type: 'text', placeholder: 'e.g. Nf3, e4, O-O' });
      sanInput.value = inputBuffer;
      sanInput.addEventListener('input', e => inputBuffer = e.target.value);
      sanInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          tryAddSan(inputBuffer);
        }
      });
      right.appendChild(sanInput);

      // Quick paste PGN
      right.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '12px', marginBottom: '4px' } }, ['Or paste PGN moves']));
      const pgnInput = el('textarea', { class: 'input', placeholder: '1.e4 c6 2.d4 d5 3.e5 Bf5 ...', style: { minHeight: '60px' } });
      right.appendChild(pgnInput);
      right.appendChild(el('button', {
        class: 'btn btn-sm', style: { marginTop: '6px' },
        on: { click: () => { tryAddPgn(pgnInput.value); pgnInput.value = ''; } },
      }, ['Append moves']));

      // Controls
      right.appendChild(el('div', { class: 'row', style: { gap: '6px', marginTop: '14px', flexWrap: 'wrap' } }, [
        el('button', { class: 'btn btn-sm', on: { click: undoLastMove } }, ['◀ Undo']),
        el('button', { class: 'btn btn-sm btn-ghost', on: { click: clearMoves } }, ['Clear all']),
      ]));

      panel.appendChild(layout);

      panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'space-between' } }, [
        el('button', { class: 'btn', on: { click: () => { step = 0; render(); } } }, ['← Back']),
        el('button', {
          class: 'btn btn-primary',
          on: { click: () => {
            if (!moves.length) return global.OOSApp.toast('Add at least one move', 'warn');
            step = 2; render();
          } },
        }, ['Continue →']),
      ]));

      // Mount the board with current chess state
      board = new global.OOSBoard(boardHost, {
        fen: chess.fen(),
        orientation: meta.color === 'b' ? 'black' : 'white',
        interactive: true,
        showCoords: DB.getSetting('coords', true),
        onMove: (move) => {
          // Board has already applied the move internally; mirror into our `chess`.
          moves.push(move.san);
          chess.move(move.san, { sloppy: true });
          render();
        },
      });
    }

    function tryAddSan(raw) {
      const san = raw.trim();
      if (!san) return;
      const m = chess.move(san, { sloppy: true });
      if (!m) {
        global.OOSApp.toast(`Illegal here: ${san}`, 'warn');
        return;
      }
      moves.push(m.san);
      inputBuffer = '';
      render();
    }

    function tryAddPgn(text) {
      if (!text || !text.trim()) return;
      const tokens = text.replace(/\d+\./g, '').replace(/\{[^}]*\}/g, '').split(/\s+/).filter(Boolean);
      let added = 0, failed = null;
      tokens.forEach(tok => {
        if (failed) return;
        if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) return;
        const m = chess.move(tok, { sloppy: true });
        if (m) { moves.push(m.san); added++; }
        else { failed = tok; }
      });
      if (failed) global.OOSApp.toast(`Stopped at illegal move: ${failed}. Added ${added}.`, 'warn');
      else if (added) global.OOSApp.toast(`Added ${added} move${added === 1 ? '' : 's'}`, 'good');
      render();
    }

    function undoLastMove() {
      if (!moves.length) return;
      moves.pop();
      chess.undo();
      render();
    }

    function clearMoves() {
      moves = [];
      chess = new global.Chess();
      render();
    }

    // ---- Step 2: review --------------------------------------------------
    function renderReview() {
      // How many of the moves are user-side prep cards?
      const userColor = meta.color;
      const tempChess = new global.Chess();
      let userCardCount = 0;
      moves.forEach(m => {
        if (tempChess.turn() === userColor) userCardCount++;
        tempChess.move(m, { sloppy: true });
      });
      const reviewLoad = Math.max(1, Math.round(userCardCount * 0.4)); // rough first-week reviews

      panel.appendChild(el('div', { class: 'eyebrow' }, ['Review']));
      panel.appendChild(el('h3', {}, ['Looks good?']));

      panel.appendChild(el('div', { class: 'panel', style: { padding: '14px 16px', marginTop: '12px' } }, [
        el('div', { class: 'mono', style: { fontSize: '13px', lineHeight: '1.7' } },
          moves.map((m, i) => {
            const num = i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : '';
            return num + m + ' ';
          }).join('')
        ),
      ]));

      panel.appendChild(el('div', { class: 'row', style: { gap: '20px', marginTop: '14px', flexWrap: 'wrap' } }, [
        miniStat('Moves', String(moves.length)),
        miniStat('Trainable cards', String(userCardCount)),
        miniStat('First-week reviews ~', String(reviewLoad)),
        miniStat('Folder', repFolders.find(r => r.id === meta.folder)?.name || meta.folder),
        miniStat('Label', meta.tag),
      ]));

      // Anti-overload note for very long lines
      if (moves.length > 20) {
        panel.appendChild(el('div', { class: 'warn-banner', style: { marginTop: '12px' } }, [
          icon(ICONS.target, 14),
          el('div', {}, [el('strong', {}, ['Long line: ']),
            'Consider trimming to 14–18 plies for the canonical version. You can always add depth later.']),
        ]));
      }

      panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'space-between' } }, [
        el('button', { class: 'btn', on: { click: () => { step = 1; render(); } } }, ['← Back to moves']),
        el('button', {
          class: 'btn btn-primary',
          on: { click: () => { doSave(); step = 3; render(); } },
        }, [isEdit ? 'Save changes' : 'Save line']),
      ]));
    }

    function miniStat(label, value) {
      return el('div', {}, [
        el('div', { class: 'mono', style: { fontSize: '18px', fontWeight: 600, color: 'var(--accent)' } }, [value]),
        el('div', { class: 'muted', style: { fontSize: '11.5px' } }, [label]),
      ]);
    }

    // ---- Step 3: save ----------------------------------------------------
    let savedLine = null;

    function doSave() {
      try {
        const payload = {
          name: meta.name.trim(),
          eco: meta.eco || '?',
          opening: meta.name.trim(),
          color: meta.color,
          tag: meta.tag,
          repId: meta.folder,
          description: meta.description || (isEdit ? (existingLine.description || '') : 'Created manually'),
          moves: moves.slice(),
        };
        savedLine = isEdit ? DB.updateUserLine(existingLine.id, payload) : DB.addUserLine(payload);
      } catch (err) {
        global.OOSApp.toast('Save failed: ' + (err.message || err), 'bad');
      }
    }

    function renderSave() {
      panel.appendChild(el('div', { class: 'eyebrow' }, [isEdit ? 'Updated' : 'Saved']));
      panel.appendChild(el('h3', {}, [savedLine ? `${savedLine.name} is in your repertoire` : 'Saved.']));
      const positions = savedLine ? DB.positionsForLine(savedLine.id).length : 0;
      panel.appendChild(el('p', { class: 'muted', style: { fontSize: '13px', marginTop: '6px' } }, [
        `${positions} trainable card${positions === 1 ? '' : 's'} created. They are due immediately so you can start practicing.`,
      ]));
      panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', gap: '8px', justifyContent: 'flex-end' } }, [
        el('button', { class: 'btn', on: { click: () => {
          close();
          if (savedLine) global.OOSApp.go('repertoire', { lineId: savedLine.id });
        } } }, ['Open in repertoire']),
        el('button', { class: 'btn btn-primary', on: {
          click: () => {
            close();
            if (savedLine) {
              global.OOSViews.startSessionWith(DB.positionsForLine(savedLine.id));
            }
          },
        } }, [icon(ICONS.play, 12), 'Practice now']),
      ]));
      onSubmit && onSubmit({ line: savedLine });
    }
  }

  // ----------------------------------------------------------------------
  // SMART PGN IMPORT WIZARD (real)
  // ----------------------------------------------------------------------
  function showImportWizard(onSubmit) {
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel wide' });
    let source = 'pgn'; // 'pgn' | 'lichess' | 'chesscom'
    let pasted = '';
    let parsedGames = [];
    let chosenIndex = 0;
    let chosenColor = 'auto';
    let busy = false;

    renderStep0();

    function renderStep0() {
      panel.innerHTML = '';
      panel.appendChild(el('div', { class: 'eyebrow' }, ['Import games']));
      panel.appendChild(el('h3', {}, ['Bring your real games or theory']));
      panel.appendChild(el('p', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } }, [
        'PGN, Lichess, or Chess.com — signed-in accounts use the backend importer first, then we parse, validate, and queue the games locally.',
      ]));

      // Source tabs
      panel.appendChild(el('div', { class: 'choice-row', style: { marginTop: '14px' } },
        [
          { id: 'pgn',      label: 'Paste PGN' },
          { id: 'lichess',  label: 'Lichess username' },
          { id: 'chesscom', label: 'Chess.com username' },
        ].map(s => el('button', {
          class: source === s.id ? 'is-active' : '',
          on: { click: () => { source = s.id; renderStep0(); } },
        }, [s.label])),
      ));

      if (source === 'pgn') {
        const ta = el('textarea', { class: 'input', placeholder: '[Event "..."]\n1.e4 c6 2.d4 d5 ...', style: { marginTop: '12px' } });
        ta.value = pasted;
        ta.addEventListener('input', e => pasted = e.target.value);
        panel.appendChild(ta);
        panel.appendChild(actionsRow([
          { label: 'Cancel', run: close },
          { label: 'Parse PGN', primary: true, run: () => {
            if (!pasted.trim()) return global.OOSApp.toast('Paste a PGN first', 'warn');
            try { parsedGames = global.OOSPgn.parse(pasted); }
            catch (err) { return reportInvalid(err.message); }
            if (!parsedGames.length) return reportInvalid('No games found in this PGN.');
            renderStep1();
          } },
        ]));
        setTimeout(() => ta.focus(), 60);
      } else {
        const username = el('input', { class: 'input', type: 'text', placeholder: source === 'lichess' ? 'Lichess username' : 'Chess.com username', style: { marginTop: '12px' } });
        const max = el('input', { class: 'input', type: 'number', value: '20', min: '1', max: '50', style: { marginTop: '8px', width: '120px' } });
        panel.appendChild(username);
        panel.appendChild(el('div', { class: 'row', style: { gap: '8px', marginTop: '8px', alignItems: 'center' } }, [
          el('span', { class: 'muted', style: { fontSize: '12px' } }, ['Last']),
          max,
          el('span', { class: 'muted', style: { fontSize: '12px' } }, ['games']),
        ]));
        panel.appendChild(el('div', { class: 'muted', style: { fontSize: '12px', marginTop: '8px' } }, [
          'Public profiles only. Signed-in accounts use your OpeningOS backend securely fetches games in the background for reliability; offline users fall back to public browser APIs.',
        ]));
        const fetchBtn = el('button', { class: 'btn btn-primary', on: { click: async () => {
          const u = username.value.trim();
          if (!u) return global.OOSApp.toast('Enter a username', 'warn');
          if (busy) return;
          busy = true;
          fetchBtn.textContent = 'Fetching…';
          fetchBtn.disabled = true;
          try {
            const games = await fetchRemoteGames(source, u, parseInt(max.value, 10) || 20);
            // Convert to parsedGames using OOSPgn
            const all = [];
            games.forEach(g => {
              try {
                const parsed = global.OOSPgn.parse(g.pgn);
                parsed.forEach(p => all.push(p));
              } catch (_) {}
            });
            if (!all.length) return reportInvalid('No parseable games returned.');
            parsedGames = all;
            renderStep1();
          } catch (err) {
            reportInvalid(err.message);
          } finally {
            busy = false;
            fetchBtn.textContent = 'Fetch games';
            fetchBtn.disabled = false;
          }
        } } }, ['Fetch games']);
        panel.appendChild(actionsRow([
          { label: 'Cancel', run: close },
          { label: 'Fetch games', primary: true, custom: fetchBtn },
        ]));
        setTimeout(() => username.focus(), 60);
      }
    }

    async function fetchRemoteGames(sourceKind, username, maxGames) {
      const useServer = global.OOSAccountGateway && global.OOSAccountGateway.signedIn && global.OOSAccountGateway.signedIn() && global.OOSAccountGateway.importGames;
      if (useServer) {
        try {
          const serverGames = await global.OOSAccountGateway.importGames(sourceKind, username, maxGames);
          if (serverGames && serverGames.length) return serverGames;
        } catch (err) {
          global.OOSApp.toast('OpeningOS Cloud import failed, trying browser fallback: ' + (err.message || err), 'warn');
        }
      }
      return sourceKind === 'lichess'
        ? await global.OOSApi.lichessUserGames(username, maxGames)
        : await global.OOSApi.chesscomUserGames(username, maxGames);
    }

    function reportInvalid(msg) {
      close();
      showError("We couldn't read this import",
        msg + ' You can retry with a different paste, username, or fix the PGN.', [
          { label: 'Try again', primary: true, run: () => showImportWizard(onSubmit) },
          { label: 'Cancel', run: () => {} },
        ]);
    }

    function renderStep1() {
      const totalGames = parsedGames.length;
      // Validate the first game's mainline so we can show counts.
      let mainline = global.OOSPgn.mainlineSan(parsedGames[chosenIndex] || { moves: [] });
      let plies = mainline.sanMoves.length;
      const hdrs = global.OOSPgn.openingFromHeaders(parsedGames[chosenIndex].headers);

      panel.innerHTML = '';
      panel.appendChild(el('div', { class: 'eyebrow' }, ['Review import']));
      panel.appendChild(el('h3', {}, [`${totalGames} game${totalGames === 1 ? '' : 's'} parsed`]));
      panel.appendChild(el('div', { class: 'panel', style: { padding: '12px 14px', marginTop: '12px' } }, [
        el('div', { class: 'mono', style: { fontSize: '12.5px', color: 'var(--text-1)' } }, [
          `${hdrs.white} vs ${hdrs.black} · ${hdrs.event} · ${hdrs.result}`,
        ]),
        el('div', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' } }, [
          `ECO ${hdrs.eco}, ${plies} half-moves`,
          mainline.illegalAt ? ` · illegal at ply ${mainline.illegalAt} (${mainline.badSan})` : '',
        ]),
      ]));

      // Game picker if more than one
      if (totalGames > 1) {
        const sel = el('div', { class: 'choice-row', style: { marginTop: '8px', flexWrap: 'wrap' } });
        parsedGames.slice(0, 8).forEach((g, i) => {
          sel.appendChild(el('button', {
            class: chosenIndex === i ? 'is-active' : '',
            on: { click: () => { chosenIndex = i; renderStep1(); } },
          }, [`#${i + 1}`]));
        });
        if (totalGames > 8) sel.appendChild(el('span', { class: 'muted', style: { fontSize: '12px', alignSelf: 'center' } }, [`+${totalGames - 8} more`]));
        panel.appendChild(sel);
      }

      // What this becomes
      panel.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '14px' } }, ['Import as']));
      const opts = [
        { id: 'line',  label: 'Add as a new repertoire line', meta: `Creates a line with ${plies} half-moves.` },
        { id: 'game',  label: 'Add as imported game(s)',      meta: `${totalGames} game${totalGames === 1 ? '' : 's'} added to Games view for deviation review.` },
        { id: 'both',  label: 'Both — line + games',          meta: 'Most useful when importing your own analysis or training studies.' },
      ];
      let chosen = 'line';
      const optsEl = el('div', { class: 'import-options' });
      function rerenderOpts() {
        optsEl.innerHTML = '';
        opts.forEach(o => {
          optsEl.appendChild(el('button', {
            class: 'import-opt' + (chosen === o.id ? ' is-active' : ''),
            on: { click: () => { chosen = o.id; rerenderOpts(); } },
          }, [
            el('div', { class: 'key' }, [o.id[0].toUpperCase()]),
            el('div', {}, [
              el('div', { style: { fontWeight: 600 } }, [o.label]),
              el('div', { class: 'meta' }, [o.meta]),
            ]),
          ]));
        });
      }
      rerenderOpts();
      panel.appendChild(optsEl);

      // Color/side selector for line
      panel.appendChild(el('div', { class: 'eyebrow', style: { marginTop: '14px' } }, ['Your color in this line']));
      panel.appendChild(el('div', { class: 'choice-row' },
        [
          { v: 'auto',  label: 'Auto (use header)' },
          { v: 'w',     label: 'White' },
          { v: 'b',     label: 'Black' },
        ].map(c => el('button', {
          class: chosenColor === c.v ? 'is-active' : '',
          on: { click: (e) => { chosenColor = c.v; e.currentTarget.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('is-active')); e.currentTarget.classList.add('is-active'); } },
        }, [c.label])),
      ));

      // Anti-overload warning
      if (totalGames > 30 || plies > 60) {
        panel.appendChild(el('div', { class: 'warn-banner', style: { marginTop: '12px' } }, [
          icon(ICONS.target, 14),
          el('div', {}, [
            el('strong', {}, ['Heads up: ']),
            `Importing ${totalGames} games / ${plies}-move line may add many reviews. You can import a subset and add more later.`,
          ]),
        ]));
      }

      panel.appendChild(actionsRow([
        { label: '← Back', run: () => renderStep0() },
        { label: 'Import', primary: true, run: () => doImport(chosen) },
      ]));
    }

    function doImport(kind, allowPartial = false) {
      const DB = global.OOSData;
      const game = parsedGames[chosenIndex];
      const hdrs = global.OOSPgn.openingFromHeaders(game.headers);
      const mainline = global.OOSPgn.mainlineSan(game);
      let createdLine = null;
      let resolvedColor = chosenColor;
      if (resolvedColor === 'auto') {
        // Try to infer from headers vs current profile name; fallback white.
        const profileName = (global.OOSProfiles.active() || {}).name || '';
        const userIsWhite = profileName && (hdrs.white || '').toLowerCase().includes(profileName.toLowerCase());
        const userIsBlack = profileName && (hdrs.black || '').toLowerCase().includes(profileName.toLowerCase());
        resolvedColor = userIsBlack ? 'b' : (userIsWhite ? 'w' : 'w');
      }

      // If the parsed mainline is partial (illegal somewhere), block import
      // unless the user explicitly chose "valid prefix only".
      if (mainline.illegalAt && !allowPartial) {
        showError("This PGN has an illegal move",
          `Move ${mainline.illegalAt}: ${mainline.badSan} can't be played from the position before it. ${mainline.sanMoves.length} moves before that point are valid.`,
          [
            { label: 'Fix PGN', run: () => renderStep0() },
            { label: 'Import valid prefix only', primary: true, run: () => doImport(kind, true) },
            { label: 'Cancel', run: () => {} },
          ]);
        return;
      }
      if (kind === 'line' || kind === 'both') {
        if (!mainline.sanMoves.length) {
          return reportInvalid('Selected game has no legal moves.');
        }
        createdLine = DB.addUserLine({
          name: hdrs.opening,
          eco: hdrs.eco,
          opening: hdrs.opening,
          color: resolvedColor,
          tag: 'nice-to-know',
          description: `Imported from ${hdrs.event}`,
          moves: mainline.sanMoves,
        });
      }
      if (kind === 'game' || kind === 'both') {
        parsedGames.forEach(g => {
          const h = global.OOSPgn.openingFromHeaders(g.headers);
          const ml = global.OOSPgn.mainlineSan(g);
          // Opponent name flips with the user's color.
          const opponentName = resolvedColor === 'w' ? h.black : h.white;
          const inferredMatch = createdLine ? { lineId: createdLine.id } : DB.bestLineMatchForPgn(ml.sanMoves.join(' '));
          const matchedLineId = inferredMatch ? inferredMatch.lineId : null;
          DB.addUserGame({
            site: source === 'lichess' ? 'Lichess' : source === 'chesscom' ? 'Chess.com' : 'Imported',
            vs: opponentName || 'unknown',
            vsRating: 0,
            yourColor: resolvedColor,
            result: h.result === '1-0' ? (resolvedColor === 'w' ? 'w' : 'l')
                  : h.result === '0-1' ? (resolvedColor === 'b' ? 'w' : 'l') : 'd',
            played: 'imported just now',
            timeControl: g.headers.TimeControl || '?',
            pgn: ml.sanMoves.join(' '),
            // Allow null lineId — Games view handles unmatched games with a
            // "create line from this game" prompt.
            lineId: matchedLineId,
            matchedLineId,
            status: matchedLineId ? 'matched' : 'unmatched',
          });
        });
      }
      onSubmit && onSubmit({ line: createdLine, games: parsedGames });
      close();
    }
    function actionsRow(items) {
      return el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } },
        items.map(a => a.custom || el('button', {
          class: 'btn ' + (a.primary ? 'btn-primary' : ''),
          on: { click: a.run },
        }, [a.label])),
      );
    }

    function close() { wrap.remove(); }
    back.addEventListener('click', close);
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }

  // Convenience flows used by the FAB / today
  function openLichessFlow() {
    showImportWizard((r) => {
      if (r && r.line) global.OOSApp.toast(`Imported "${r.line.name}"`, 'good');
      const app = document.getElementById('app');
      // Refresh any open view
      if (app) { document.body.dataset.view && global.OOSApp.go(document.body.dataset.view); }
    });
    // Auto-pre-select Lichess tab
    setTimeout(() => {
      const cr = document.querySelector('.modal-panel .choice-row button:nth-child(2)');
      if (cr) cr.click();
    }, 80);
  }
  function openChesscomFlow() {
    showImportWizard((r) => {
      if (r && r.line) global.OOSApp.toast(`Imported "${r.line.name}"`, 'good');
      const app = document.getElementById('app');
      if (app) { document.body.dataset.view && global.OOSApp.go(document.body.dataset.view); }
    });
    setTimeout(() => {
      const cr = document.querySelector('.modal-panel .choice-row button:nth-child(3)');
      if (cr) cr.click();
    }, 80);
  }

  // ----------------------------------------------------------------------
  // ERROR / CONFIRM MODAL
  // ----------------------------------------------------------------------
  function showError(title, message, actions) {
    const wrap = el('div', { class: 'modal' });
    const back = el('div', { class: 'modal-back' });
    const panel = el('div', { class: 'modal-panel' });
    panel.appendChild(el('div', { class: 'eyebrow' }, ['Heads up']));
    panel.appendChild(el('h3', { style: { marginTop: '6px' } }, [title]));
    panel.appendChild(el('p', { class: 'muted', style: { marginTop: '6px', fontSize: '13px' } }, [message]));
    panel.appendChild(el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end', gap: '8px' } },
      (actions || [{ label: 'OK', primary: true, run: () => {} }]).map(a => el('button', {
        class: 'btn ' + (a.primary ? 'btn-primary' : ''),
        on: { click: () => { a.run && a.run(); close(); } },
      }, [a.label])),
    ));
    function close() { wrap.remove(); }
    back.addEventListener('click', close);
    wrap.appendChild(back);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }

  // ----------------------------------------------------------------------
  // EXPORT
  // ----------------------------------------------------------------------
  function startSessionWith(cards, options = {}) {
    const app = document.getElementById('app');
    document.body.dataset.view = 'practice';
    document.querySelectorAll('.primary-nav a').forEach(a => {
      a.classList.toggle('is-active', a.dataset.nav === 'practice');
    });
    history.replaceState(null, '', '#practice');
    if (!cards || !cards.length) {
      practiceCtx = {};
      renderPracticePre(app);
      return;
    }
    practiceCtx = {
      session: new global.OOSPractice.PracticeSession(cards, options),
      mode: options.mode || 'daily',
      feedback: null,
      hint: null,
      mounted: false,
    };
    renderPracticeActive(app);
  }

  global.OOSViews = {
    renderToday,
    renderRepertoire,
    renderPractice,
    renderGames,
    renderInsights,
    renderSettings,
    renderLibrary,
    renderCoach,
    renderOpponentPrep,
    renderOnboarding,
    showImport,
    showImportWizard,
    showLineCreationWizard,
    showError,
    applyGrade,
    startSessionWith,
    openLichessFlow,
    openChesscomFlow,
  };
})(window);
