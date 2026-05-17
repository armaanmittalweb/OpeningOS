/* OpeningOS — data layer
 * Seeds repertoires, builds position cards with FENs (using chess.js),
 * manages SRS state, sample games, and localStorage persistence.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'openingos.v1';

  // --- Seed repertoires --------------------------------------------------
  // Repertoire folders. Lines start empty — users add their own (manual, PGN
  // import, Library clone, or Lichess/Chess.com import).
  const SEED_REPERTOIRES = [
    { id: 'rep-w',    name: 'White repertoire',  color: 'w', parent: null, lines: [] },
    { id: 'rep-b-e4', name: 'Black vs 1.e4',     color: 'b', parent: null, lines: [] },
    { id: 'rep-b-d4', name: 'Black vs 1.d4',     color: 'b', parent: null, lines: [] },
    { id: 'rep-b-fl', name: 'Black vs flank',    color: 'b', parent: null, lines: [] },
  ];

  // No fake imported games. Real games arrive via the import wizard.
  const SEED_GAMES = [];

  // Curated starter repertoires for Library view
  const SEED_LIBRARY = [
    {
      id: 'lib-london',
      name: 'London System for White',
      level: 'Beginner',
      author: 'OpeningOS curated',
      rating: 4.8, reviews: 312,
      summary: 'A friendly, system-based White repertoire. Same setup against almost everything.',
      lines: 6, positions: 41, eta: '~2 weeks to learn',
      eco: 'D02', tags: ['system', 'low-theory'],
    },
    {
      id: 'lib-caro',
      name: 'Caro-Kann for Black',
      level: 'Club',
      author: 'OpeningOS curated',
      rating: 4.7, reviews: 218,
      summary: 'Solid response to 1.e4. Less theory than the Sicilian, more bite than the French.',
      lines: 8, positions: 73, eta: '~3 weeks to learn',
      eco: 'B12', tags: ['solid', 'positional'],
    },
    {
      id: 'lib-italian',
      name: 'Italian Game complete repertoire',
      level: 'Club',
      author: 'GM verified',
      rating: 4.9, reviews: 504,
      summary: 'Classical 1.e4 e5 weapon with rich middlegame play.',
      lines: 12, positions: 168, eta: '~6 weeks to learn',
      eco: 'C50', tags: ['classical', 'tactical'],
    },
    {
      id: 'lib-kid',
      name: "King's Indian for Black",
      level: 'Advanced',
      author: 'Coach Anand',
      rating: 4.6, reviews: 96,
      summary: 'Hypermodern setup vs 1.d4. Sharp kingside attacks.',
      lines: 10, positions: 142, eta: '~5 weeks to learn',
      eco: 'E60', tags: ['attacking', 'hypermodern'],
    },
    {
      id: 'lib-french',
      name: 'French Defence essentials',
      level: 'Club',
      author: 'OpeningOS curated',
      rating: 4.4, reviews: 167,
      summary: 'Pawn-chain warfare with clear plans for both sides.',
      lines: 7, positions: 89, eta: '~3 weeks to learn',
      eco: 'C00', tags: ['structural'],
    },
    {
      id: 'lib-najdorf',
      name: 'Sicilian Najdorf weapons',
      level: 'Advanced',
      author: 'GM verified',
      rating: 4.9, reviews: 712,
      summary: 'The sharpest Black response to 1.e4. Heavy theory, huge reward.',
      lines: 18, positions: 312, eta: '~3 months to learn',
      eco: 'B90', tags: ['sharp', 'high-theory'],
    },
  ];

  const SEED_MODEL_GAMES = [
    { id: 'mg1', white: 'Carlsen, M.', black: 'Anand, V.', event: 'WCh 2014', result: '1-0', line: 'caro-advance', moves: 41 },
    { id: 'mg2', white: 'Capablanca, J.', black: 'Tartakower, S.', event: 'New York 1924', result: '1-0', line: 'london-main', moves: 56 },
    { id: 'mg3', white: 'Kasparov, G.', black: 'Karpov, A.', event: 'WCh 1990', result: '1/2', line: 'kid-classical', moves: 67 },
  ];

  // Coach mode: students start empty. Coaches add their own student records
  // via the Coach view. Each record is a local handle the coach uses to track
  // assignments — actual student profiles are independent installs.
  const SEED_STUDENTS = [];

  // --- State -------------------------------------------------------------

  const PROFILE_STATE_SUFFIX = 'state';

  function loadState() {
    try {
      if (global.OOSProfiles && global.OOSProfiles.activeId()) {
        const v = global.OOSProfiles.load(PROFILE_STATE_SUFFIX);
        if (v) return v;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }
  function currentStateKey() {
    try {
      if (global.OOSProfiles && global.OOSProfiles.activeId()) return global.OOSProfiles.storageKey(PROFILE_STATE_SUFFIX);
    } catch (_) {}
    return STORAGE_KEY;
  }

  function saveState(s) {
    try {
      const key = currentStateKey();
      if (global.OOSProfiles && global.OOSProfiles.activeId()) global.OOSProfiles.save(PROFILE_STATE_SUFFIX, s);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      if (global.OOSStore && global.OOSStore.putState) global.OOSStore.putState(key, s).catch(() => {});
    } catch (_) {}
  }
  function resetState() {
    try {
      const k = currentStateKey();
      if (global.OOSProfiles && global.OOSProfiles.activeId()) {
        if (k) localStorage.removeItem(k);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      if (global.OOSStore && global.OOSStore.deleteState) global.OOSStore.deleteState(k).catch(() => {});
    } catch (_) {}
  }

  // Build position cards from a line by walking through the SAN moves.
  function buildPositionsForLine(line) {
    const chess = new global.Chess();
    const positions = [];
    for (let i = 0; i < line.moves.length; i++) {
      const ply = i + 1;
      const sanBefore = line.moves.slice(0, i).join(' ');
      const sideToMove = chess.turn();
      const userMoves = sideToMove === line.color;
      const fen = chess.fen();
      const moveSan = line.moves[i];
      const m = chess.move(moveSan, { sloppy: true });
      if (!m) {
        console.warn('Bad move in seed line', line.id, moveSan);
        break;
      }
      if (userMoves) {
        const idea = (line.ideas && line.ideas[ply]) || {};
        // Snapshot the FEN AFTER applying the prep move — used by practice
        // evaluation to detect transpositions reaching the same position
        // through a different SAN.
        const fenAfter = chess.fen();
        positions.push({
          id: `${line.id}#${ply}`,
          lineId: line.id,
          ply,
          fen,
          expectedFenAfter: fenAfter,
          move: moveSan,
          fromSquare: m.from,
          toSquare: m.to,
          side: sideToMove,
          historyBefore: sanBefore,
          opening: line.opening,
          name: line.name,
          eco: line.eco,
          color: line.color,
          idea: idea.idea || '',
          plan: idea.plan || '',
          hook: idea.hook || '',
          mistake: idea.mistake || '',
        });
      }
    }
    return positions;
  }

  function buildAll() {
    const all = { repertoires: [], lines: [], positions: [], byLine: {}, byId: {} };
    SEED_REPERTOIRES.forEach(rep => {
      all.repertoires.push({ id: rep.id, name: rep.name, color: rep.color });
      rep.lines.forEach(line => {
        const meta = {
          id: line.id, name: line.name, eco: line.eco, opening: line.opening,
          color: line.color, tag: line.tag, description: line.description,
          repId: rep.id, moves: line.moves,
        };
        all.lines.push(meta);
        const positions = buildPositionsForLine(line);
        all.positions = all.positions.concat(positions);
        all.byLine[line.id] = positions;
        positions.forEach(p => { all.byId[p.id] = p; });
      });
    });
    return all;
  }

  // Initialize SRS state for a fresh set of positions. Each new card starts
  // due immediately so the user can begin reviewing it right away.
  function initialSrs(positions) {
    const now = Date.now();
    const srs = {};
    positions.forEach(p => {
      srs[p.id] = {
        scheduler: 'fsrs-style-v1',
        stability: 0,
        difficulty: 5,
        retrievability: 1,
        scheduledDays: 0,
        due: now,        // due immediately when added
        lapses: 0,
        missRate: 0,
        reps: 0,
        lastReview: 0,
      };
    });
    return srs;
  }

  // Scheduler: prefer the FSRS-style module, fall back to the older simple model.
  function updateSrs(card, grade) {
    if (global.OOSFSRS && global.OOSFSRS.schedule) return global.OOSFSRS.schedule(card, grade);
    const now = Date.now();
    const old = card.stability || 1;
    let stability;
    let due;
    let lapses = card.lapses || 0;
    let missRate = card.missRate || 0;
    if (grade === 1) { // Again
      stability = Math.max(0.4, old * 0.4);
      due = now + 1000 * 60 * 10; // 10 minutes
      lapses += 1;
      missRate = Math.min(1, missRate * 0.7 + 0.3);
    } else if (grade === 2) { // Hard
      stability = Math.max(0.6, old * 1.2);
      due = now + 1000 * 60 * 60 * 12;
      missRate = missRate * 0.85 + 0.05;
    } else if (grade === 3) { // Good
      stability = Math.max(1, old * 2.2);
      due = now + 1000 * 60 * 60 * 24 * stability;
      missRate = missRate * 0.85;
    } else { // Easy = 4
      stability = Math.max(2, old * 3.4);
      due = now + 1000 * 60 * 60 * 24 * stability * 1.3;
      missRate = missRate * 0.7;
    }
    return {
      stability,
      due,
      lapses,
      missRate,
      reps: (card.reps || 0) + 1,
      lastReview: now,
    };
  }

  function isDue(srsCard) {
    return global.OOSFSRS && global.OOSFSRS.isDue ? global.OOSFSRS.isDue(srsCard) : (!srsCard || srsCard.due <= Date.now());
  }
  function isWeak(srsCard) {
    return global.OOSFSRS && global.OOSFSRS.isWeak ? global.OOSFSRS.isWeak(srsCard) : (srsCard && (srsCard.lapses >= 2 || srsCard.missRate >= 0.4));
  }

  function defaultSettings() {
    return {
      theme: 'dark',
      coords: true,
      notation: 'san',
      boardSize: 'medium',
      highContrast: false,
      reducedMotion: false,
      sound: false,
      piecesSet: 'classic',
      fontSize: 'normal',
      privacy: 'private',
      defaultPracticeMode: 'daily',
      revealOnWrong: true,
      screenReaderMoves: false,
      cbSafe: false,
      sharingEnabled: false,
      aiSummaries: false,
      storageBackend: 'indexeddb+cache',
      syncMode: 'manual',
    };
  }

  function repIdForColor(color) {
    return color === 'w' ? 'rep-w' : 'rep-b-e4';
  }

  // Normalize a FEN to its position-only form: piece-placement, side-to-move,
  // castling, en-passant. Strips halfmove + fullmove so transpositions reached
  // through different move orders compare equal.
  function normalizeFen(fen) {
    if (!fen) return '';
    const parts = String(fen).trim().split(/\s+/);
    return parts.slice(0, 4).join(' ');
  }

  function cleanPgnTokens(text) {
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

  function sameSan(a, b) {
    const norm = x => String(x || '').replace(/[+#?!]+/g, '').trim();
    return norm(a) === norm(b);
  }


  function activeLine(line) { return !line || line.status !== 'retired' && !line.retired && !line.mergedInto; }

  function moveNumberForPly(ply) { return Math.ceil(Number(ply || 1) / 2); }

  function validateMoveSequence(moves) {
    const chess = new global.Chess();
    const out = [];
    const errors = [];
    (moves || []).forEach((raw, idx) => {
      if (errors.length) return;
      const m = chess.move(raw, { sloppy: true });
      if (!m) errors.push({ ply: idx + 1, move: raw, fen: chess.fen(), message: 'Illegal move at ply ' + (idx + 1) });
      else out.push(m.san);
    });
    return { ok: errors.length === 0, moves: out, errors, fen: chess.fen() };
  }

  function truncateToLegal(moves) {
    const chess = new global.Chess();
    const legal = [];
    let firstIllegal = null;
    (moves || []).forEach((raw, idx) => {
      if (firstIllegal) return;
      const m = chess.move(raw, { sloppy: true });
      if (!m) firstIllegal = { ply: idx + 1, move: raw, fen: chess.fen() };
      else legal.push(m.san);
    });
    return { moves: legal, firstIllegal };
  }

  function buildGraphFromLines(lines, state) {
    const graph = {
      schema: 'openingos-graph-v1',
      builtAt: Date.now(),
      positions: {},
      move_edges: {},
      line_paths: {},
      annotations: state && state.annotations || {},
      indexes: { byFen: {}, byLine: {}, byEdge: {} },
    };
    function ensurePosition(fen, extra) {
      const key = normalizeFen(fen);
      if (!graph.positions[key]) {
        graph.positions[key] = Object.assign({ id: key, fen, fenKey: key, firstSeenAt: Date.now(), critical: false, sources: [] }, extra || {});
      } else {
        Object.assign(graph.positions[key], extra || {});
      }
      graph.indexes.byFen[key] = graph.positions[key].id;
      return graph.positions[key];
    }
    (lines || []).forEach(line => {
      const chess = new global.Chess();
      const path = { id: line.id, lineId: line.id, name: line.name, color: line.color, status: line.status || 'active', branchOf: line.parentLineId || null, branchFromPly: line.branchFromPly || null, nodeKeys: [], edgeIds: [] };
      ensurePosition(chess.fen(), { sideToMove: chess.turn(), sources: (line.sourceRefs || []).slice() });
      (line.moves || []).forEach((san, idx) => {
        const fromFen = chess.fen();
        const fromKey = normalizeFen(fromFen);
        const side = chess.turn();
        const m = chess.move(san, { sloppy: true });
        if (!m) return;
        const toFen = chess.fen();
        const toKey = normalizeFen(toFen);
        ensurePosition(fromFen, { sideToMove: side, sources: (line.sourceRefs || []).slice() });
        ensurePosition(toFen, { sideToMove: chess.turn(), sources: (line.sourceRefs || []).slice() });
        const edgeId = 'edge_' + hashKey(fromKey + '|' + m.san + '|' + toKey + '|' + line.id + '|' + (idx + 1));
        const annotation = ((state && state.edgeComments) || {})[edgeId] || {};
        graph.move_edges[edgeId] = {
          id: edgeId,
          lineId: line.id,
          from: fromKey,
          to: toKey,
          san: m.san,
          lan: m.from + m.to + (m.promotion || ''),
          ply: idx + 1,
          moveNumber: moveNumberForPly(idx + 1),
          side,
          source: line.source || 'user',
          sourceRefs: (line.sourceRefs || []).slice(),
          status: line.status || 'active',
          comment: annotation.comment || '',
          retired: !!line.retired || line.status === 'retired',
          variationOf: line.parentLineId || null,
        };
        path.nodeKeys.push(fromKey);
        path.edgeIds.push(edgeId);
        graph.indexes.byEdge[edgeId] = edgeId;
      });
      path.terminalFenKey = normalizeFen(chess.fen());
      path.nodeKeys.push(path.terminalFenKey);
      graph.line_paths[line.id] = path;
      graph.indexes.byLine[line.id] = path.edgeIds.slice();
    });
    return graph;
  }

  function hashKey(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }

  // Detect the first deviation in a game vs a known line.
  // Returns { ply, side, played, expected, fenBefore } or null.
  function pgnToTokens(pgn) {
    return String(pgn || '')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\d+\.\.\.|\d+\./g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .filter(t => !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  }

  function detectDeviation(pgn, line) {
    const moves = pgnToTokens(pgn);
    const gameChess = new global.Chess();
    const lineChess = new global.Chess();
    for (let i = 0; i < line.moves.length; i++) {
      const expected = line.moves[i];
      const playedRaw = moves[i];
      const fenBefore = gameChess.fen();
      const sideToMove = gameChess.turn();
      if (!playedRaw) return null;
      const playedMove = gameChess.move(playedRaw, { sloppy: true });
      const expectedMove = lineChess.move(expected, { sloppy: true });
      if (!playedMove || !expectedMove) {
        return { ply: i + 1, side: sideToMove, played: playedRaw, expected, fenBefore, isUser: sideToMove === line.color };
      }
      const played = playedMove.san;
      // Same SAN or same resulting normalized position counts as still in book.
      if (played !== expectedMove.san && normalizeFen(gameChess.fen()) !== normalizeFen(lineChess.fen())) {
        return {
          ply: i + 1,
          side: sideToMove,
          played,
          expected: expectedMove.san,
          fenBefore,
          isUser: sideToMove === line.color,
        };
      }
    }
    return null;
  }

  // Detect every deviation up to the end of the prep, plus the "out of book"
  // moment when prep runs out.
  function detectAllDeviations(pgn, line) {
    const moves = pgnToTokens(pgn);
    const gameChess = new global.Chess();
    const lineChess = new global.Chess();
    const events = [];
    for (let i = 0; i < Math.max(moves.length, line.moves.length); i++) {
      const expected = line.moves[i];
      const playedRaw = moves[i];
      const fenBefore = gameChess.fen();
      const sideToMove = gameChess.turn();
      if (!playedRaw && !expected) break;
      if (!playedRaw) { events.push({ kind: 'short-game', ply: i + 1, side: sideToMove, fenBefore }); break; }
      if (!expected) {
        const m = gameChess.move(playedRaw, { sloppy: true });
        events.push({ kind: 'out-of-book', ply: i + 1, side: sideToMove, played: m ? m.san : playedRaw, fenBefore });
        break;
      }
      const playedMove = gameChess.move(playedRaw, { sloppy: true });
      const expectedMove = lineChess.move(expected, { sloppy: true });
      if (!playedMove || !expectedMove || (playedMove.san !== expectedMove.san && normalizeFen(gameChess.fen()) !== normalizeFen(lineChess.fen()))) {
        events.push({
          kind: 'deviation', ply: i + 1, side: sideToMove,
          played: playedMove ? playedMove.san : playedRaw,
          expected: expectedMove ? expectedMove.san : expected,
          fenBefore, isUser: sideToMove === line.color,
        });
        break;
      }
    }
    return events;
  }

  // --- DB facade ----------------------------------------------------------
  const DB = {
    state: null,
    init() {
      // Seed repertoires + games are baseline; the active profile may have
      // additional user lines and games stored in state.userLines/userGames.
      const data = buildAll();
      const persisted = loadState();
      if (persisted && persisted.srs) {
        // Merge seed positions with any user-created ones, preserving SRS.
        const userLines = persisted.userLines || [];
        const userGames = persisted.userGames || [];
        // Materialize user lines into positions (and merge into data.byLine etc).
        userLines.forEach(line => {
          if (data.byLine[line.id]) return; // skip if same id already exists
          data.lines.push({
            id: line.id, name: line.name, eco: line.eco || '?', opening: line.opening || line.name,
            color: line.color, tag: line.tag || 'nice-to-know', description: line.description || '',
            repId: line.repId || repIdForColor(line.color), moves: line.moves, ideas: line.ideas || {}, source: line.source || '',
            status: line.status || 'active', retired: !!line.retired, parentLineId: line.parentLineId || null, branchFromPly: line.branchFromPly || null,
            branchFromFen: line.branchFromFen || '', branchType: line.branchType || '', mergedInto: line.mergedInto || null, mergeAt: line.mergeAt || null,
            sourceRefs: line.sourceRefs || [],
          });
          const positions = buildPositionsForLine(line);
          data.positions = data.positions.concat(positions);
          data.byLine[line.id] = positions;
          positions.forEach(p => { data.byId[p.id] = p; });
        });
        const srs = persisted.srs || {};
        data.positions.forEach(p => {
          if (!srs[p.id]) srs[p.id] = initialSrs([p])[p.id];
        });
        this.state = {
          srs,
          notes: persisted.notes || {},
          arrows: persisted.arrows || {},        // { fen: [{from,to,color}] }
          gameStatus: persisted.gameStatus || {},
          tournament: !!persisted.tournament,
          onboarded: !!persisted.onboarded,
          settings: Object.assign(defaultSettings(), persisted.settings || {}),
          userLines: userLines,
          userGames: userGames,
          assignments: persisted.assignments || [],   // coach assignments
          studentSync: persisted.studentSync || {},
          students: persisted.students || [],
          cardMeta: persisted.cardMeta || {},
          reviewEvents: persisted.reviewEvents || [],
          lineHistory: persisted.lineHistory || [],
          opponentReports: persisted.opponentReports || [],
          graph: persisted.graph || null,
          edgeComments: persisted.edgeComments || {},
          annotations: persisted.annotations || {},
          positionFlags: persisted.positionFlags || {},
          ideaCards: persisted.ideaCards || {},
          practiceSettings: persisted.practiceSettings || {},
          activeSession: persisted.activeSession || null,
          mistakes: persisted.mistakes || [],
          shareLinks: persisted.shareLinks || [],
          auditLog: persisted.auditLog || [],
          cloudConflicts: persisted.cloudConflicts || [],
        };
        // Rebuild games array from seed + user-added.
        this.games = SEED_GAMES.slice().concat(userGames);
      } else {
        // Fresh profile starts empty. The user adds their own lines/games.
        this.state = {
          srs: initialSrs(data.positions),
          notes: {},
          arrows: {},
          gameStatus: {},
          tournament: false,
          onboarded: false,
          settings: defaultSettings(),
          userLines: [],
          userGames: [],
          assignments: [],
          studentSync: {},
          students: [],
          cardMeta: {},
          reviewEvents: [],
          lineHistory: [],
          opponentReports: [],
          graph: null,
          edgeComments: {},
          annotations: {},
          positionFlags: {},
          ideaCards: {},
          practiceSettings: {},
          activeSession: null,
          mistakes: [],
          shareLinks: [],
          auditLog: [],
          cloudConflicts: [],
        };
        this.games = SEED_GAMES.slice();
        if (global.OOSStore && global.OOSStore.getState) this._hydrateFromIndexedDB(currentStateKey());
        else saveState(this.state);
      }
      this.data = data;
      this._rebuildCanonicalGraph();
      this._enrichPositionCards();
      this._buildPositionGraph();
    },

    _rebuildCanonicalGraph() {
      const lines = this.data && this.data.lines ? this.data.lines : [];
      this.graph = buildGraphFromLines(lines, this.state || {});
      if (this.state) this.state.graph = this.graph;
    },

    _enrichPositionCards() {
      if (!this.data || !this.data.positions) return;
      const flags = this.state.positionFlags || {};
      const ideaCards = this.state.ideaCards || {};
      this.data.positions.forEach(card => {
        const key = normalizeFen(card.fen);
        const flag = flags[card.id] || flags[key] || {};
        const idea = ideaCards[card.id] || ideaCards[key] || {};
        card.critical = !!flag.critical;
        card.retired = !!flag.retired;
        card.idea = idea.idea !== undefined ? idea.idea : card.idea;
        card.plan = idea.plan !== undefined ? idea.plan : card.plan;
        card.hook = idea.hook !== undefined ? idea.hook : card.hook;
        card.mistake = idea.mistake !== undefined ? idea.mistake : card.mistake;
        card.modelGame = idea.modelGame || card.modelGame || '';
        card.sourceRef = idea.sourceRef || card.sourceRef || '';
      });
    },

    _buildPositionGraph() {
      // Index every position by NORMALIZED FEN -> [{lineId, ply, lineName}].
      // We strip halfmove + fullmove counters so the same position via
      // different move orders maps to the same key.
      const graph = new Map();
      this.data.positions.forEach(p => {
        const key = normalizeFen(p.fen);
        const arr = graph.get(key) || [];
        arr.push({ lineId: p.lineId, ply: p.ply, lineName: p.name });
        graph.set(key, arr);
      });
      this._fenGraph = graph;
    },

    // Find other lines/positions that pass through this exact position
    // (compared by piece-placement + side + castling + en-passant only).
    transpositionsFor(fen, excludeLineId) {
      if (!this._fenGraph) return [];
      const all = this._fenGraph.get(normalizeFen(fen)) || [];
      return all.filter(x => x.lineId !== excludeLineId);
    },

    persist() { saveState(this.state); },
    audit(action, details = {}) {
      const ev = {
        id: 'aud_' + Math.random().toString(36).slice(2, 9),
        profileId: global.OOSProfiles && global.OOSProfiles.activeId ? global.OOSProfiles.activeId() : 'local',
        action,
        details,
        at: Date.now(),
      };
      this.state.auditLog = this.state.auditLog || [];
      this.state.auditLog.push(ev);
      this.state.auditLog = this.state.auditLog.slice(-1000);
      if (global.OOSStore && global.OOSStore.appendAudit) global.OOSStore.appendAudit(ev).catch(() => {});
      return ev;
    },
    auditTrail(limit = 100) {
      const local = (this.state && this.state.auditLog || []).slice(-limit).reverse();
      return local;
    },
    reset() { resetState(); this.init(); },
    _hydrateFromIndexedDB(key) {
      if (this.__idbHydrating || !global.OOSStore || !global.OOSStore.getState) return;
      this.__idbHydrating = true;
      global.OOSStore.getState(key).then(stored => {
        this.__idbHydrating = false;
        if (stored && stored.srs) {
          if (global.OOSProfiles && global.OOSProfiles.activeId()) global.OOSProfiles.save(PROFILE_STATE_SUFFIX, stored);
          else localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
          this.audit && this.audit('storage.hydrated_from_indexeddb', { key });
          this.init();
          if (global.OOSApp && global.OOSApp.go) {
            const route = global.OOSApp.route ? global.OOSApp.route() : 'today';
            global.OOSApp.go(route);
          }
        } else {
          saveState(this.state);
        }
      }).catch(() => {
        this.__idbHydrating = false;
        saveState(this.state);
      });
    },

    // Queries
    repertoires() { return this.data.repertoires; },
    lines(opts = {}) {
      const all = this.data.lines || [];
      return opts.includeRetired ? all : all.filter(activeLine);
    },
    line(id) { return this.data.lines.find(l => l.id === id); },
    positionsForLine(id) { return this.data.byLine[id] || []; },
    cardsFromLine(id, fromPly = 0) { return this.positionsForLine(id).filter(p => p.ply >= Math.max(1, fromPly || 1)); },
    position(id) { return this.data.byId[id]; },
    allPositions(opts = {}) {
      if (opts.includeRetired) return this.data.positions;
      return this.data.positions.filter(p => activeLine(this.line(p.lineId)) && !p.retired);
    },

    duePositions() {
      return this.allPositions().filter(p => isDue(this.state.srs[p.id]));
    },
    weakPositions() {
      return this.allPositions().filter(p => isWeak(this.state.srs[p.id]));
    },
    srs(id) { return this.state.srs[id]; },
    grade(id, g, extra = {}) {
      const before = Object.assign({}, this.state.srs[id] || {});
      const card = this.state.srs[id] || {};
      this.state.srs[id] = updateSrs(card, g);
      this.state.reviewEvents = this.state.reviewEvents || [];
      const event = Object.assign({
        id: 'rev_' + Math.random().toString(36).slice(2, 9),
        cardId: id,
        lineId: (this.position(id) || {}).lineId || null,
        grade: g,
        at: Date.now(),
        before,
        after: this.state.srs[id],
        durationMs: extra.durationMs || 0,
        guessed: !!extra.guessed,
        outcome: extra.outcome || '',
      }, extra);
      this.state.reviewEvents.push(event);
      this.state.reviewEvents = this.state.reviewEvents.slice(-5000);
      if (g === 1 || extra.outcome === 'wrong' || extra.outcome === 'illegal') {
        this.state.mistakes = this.state.mistakes || [];
        this.state.mistakes.push({ id: 'mis_' + Math.random().toString(36).slice(2, 9), cardId: id, lineId: event.lineId, played: extra.played || '', expected: extra.expected || '', at: event.at, durationMs: event.durationMs, outcome: event.outcome });
        this.state.mistakes = this.state.mistakes.slice(-1000);
      }
      this.audit('review', { cardId: id, lineId: event.lineId, grade: g, outcome: event.outcome });
      this.persist();
      return this.state.srs[id];
    },
    reviewEvents(limit = 200) {
      const ev = this.state.reviewEvents || [];
      return ev.slice(Math.max(0, ev.length - limit)).reverse();
    },

    // Per-card metadata (alternates, confusing flag, wrong-move history).
    cardMetaFor(id) { return this.state.cardMeta && this.state.cardMeta[id] || { alternates: [], confusing: false, wrongMoves: [] }; },
    addAlternate(cardId, sanMove) {
      return this.addAlternateToCard(cardId, sanMove, '');
    },
    removeAlternate(cardId, sanMove) {
      const meta = this.state.cardMeta && this.state.cardMeta[cardId];
      if (!meta) return;
      meta.alternates = (meta.alternates || []).filter(m => {
        const san = typeof m === 'string' ? m : m.san;
        return !sameSan(san, sanMove);
      });
      this.persist();
      return meta;
    },
    setConfusing(cardId, on) {
      this.state.cardMeta = this.state.cardMeta || {};
      const meta = this.state.cardMeta[cardId] || { alternates: [], confusing: false, wrongMoves: [] };
      meta.confusing = !!on;
      this.state.cardMeta[cardId] = meta;
      this.persist();
    },
    recordWrongMove(cardId, sanMove) {
      this.state.cardMeta = this.state.cardMeta || {};
      const meta = this.state.cardMeta[cardId] || { alternates: [], confusing: false, wrongMoves: [] };
      meta.wrongMoves = meta.wrongMoves || [];
      meta.wrongMoves.push({ san: sanMove, at: Date.now() });
      meta.wrongMoves = meta.wrongMoves.slice(-20);
      this.state.cardMeta[cardId] = meta;
      this.persist();
    },
    alternatesForCard(cardId) {
      const meta = this.cardMetaFor(cardId);
      return (meta.alternates || []).map(a => typeof a === 'string' ? { san: a, fen: '', fenKey: '' } : a);
    },
    addAlternateToCard(cardId, sanMove, fen) {
      this.state.cardMeta = this.state.cardMeta || {};
      const meta = this.state.cardMeta[cardId] || { alternates: [], confusing: false, wrongMoves: [] };
      const list = (meta.alternates || []).map(a => typeof a === 'string' ? { san: a, fen: '', fenKey: '' } : a);
      const key = normalizeFen(fen || '');
      if (!list.some(a => sameSan(a.san, sanMove) || (key && a.fenKey === key))) {
        list.push({ san: sanMove, fen: fen || '', fenKey: key, addedAt: Date.now(), source: 'user', validation: 'unverified' });
      }
      meta.alternates = list;
      this.state.cardMeta[cardId] = meta;
      this.persist();
      return meta;
    },
    validateAlternateForCard(cardId, sanMove, fen) {
      const card = this.position(cardId);
      if (!card || !global.OOSAnalysis || !global.OOSAnalysis.validateMoveWithExplorer) return Promise.resolve({ verdict: 'unknown', reason: 'No validation engine available.' });
      return global.OOSAnalysis.validateMoveWithExplorer(card.fen, sanMove).then(result => {
        const meta = this.cardMetaFor(cardId);
        const key = normalizeFen(fen || '');
        meta.alternates = (meta.alternates || []).map(a => {
          const obj = typeof a === 'string' ? { san: a, fen: '', fenKey: '' } : a;
          if (sameSan(obj.san, sanMove) || (key && obj.fenKey === key)) {
            return Object.assign({}, obj, { validation: result.verdict || 'unknown', validationReason: result.reason || '', validationAt: Date.now(), validationSource: result.source || 'local' });
          }
          return obj;
        });
        this.state.cardMeta[cardId] = meta;
        this.audit('alternate.validated', { cardId, sanMove, verdict: result.verdict, source: result.source });
        this.persist();
        return result;
      }).catch(err => ({ verdict: 'unknown', reason: err && err.message || 'Validation failed.' }));
    },
    markCardConfusing(cardId, reason) {
      this.setConfusing(cardId, true);
      const meta = this.cardMetaFor(cardId);
      meta.confusingReason = reason || 'Marked during practice';
      meta.updatedAt = Date.now();
      this.state.cardMeta[cardId] = meta;
      this.persist();
      return meta;
    },

    notesFor(id) { return this.state.notes[id] || { type: 'idea', text: '', tags: [], history: [] }; },
    setNote(id, payload) {
      const existing = this.state.notes[id] || { type: 'idea', text: '', tags: [], history: [] };
      // If the text is changing meaningfully, snapshot the previous version
      // into history (de-duped, capped to 10 entries).
      if (payload.text !== undefined && payload.text !== existing.text && existing.text) {
        existing.history = existing.history || [];
        const last = existing.history[0];
        const oldEnough = !existing.updatedAt || (Date.now() - existing.updatedAt) > 5000;
        if (oldEnough && (!last || last.text !== existing.text)) {
          existing.history.unshift({ text: existing.text, type: existing.type, at: Date.now() });
          existing.history = existing.history.slice(0, 10);
        }
      }
      this.state.notes[id] = Object.assign({}, existing, payload, { updatedAt: Date.now() });
      this.persist();
    },
    restoreNote(id, index) {
      const n = this.state.notes[id];
      if (!n || !n.history || !n.history[index]) return;
      const snap = n.history[index];
      // Rotate current text to history before restoring
      n.history.unshift({ text: n.text, type: n.type, at: Date.now() });
      n.text = snap.text;
      n.type = snap.type;
      n.history.splice(index + 1, 1);
      this.persist();
    },

    // Right-click annotations on the board (arrows + circles).
    arrowsFor(fen) { return this.state.arrows[fen] || []; },
    addArrow(fen, arrow) {
      const list = this.state.arrows[fen] ? this.state.arrows[fen].slice() : [];
      // Toggle: if same arrow already exists, remove it.
      const idx = list.findIndex(a =>
        a.from === arrow.from && a.to === arrow.to && a.kind === arrow.kind
      );
      if (idx >= 0) list.splice(idx, 1);
      else list.push(arrow);
      this.state.arrows[fen] = list;
      this.persist();
    },
    clearArrows(fen) { delete this.state.arrows[fen]; this.persist(); },

    setTournament(on) { this.state.tournament = !!on; this.persist(); },
    isTournament() { return !!this.state.tournament; },

    setOnboarded() { this.state.onboarded = true; this.persist(); },
    isOnboarded() { return !!this.state.onboarded; },

    setSetting(key, value) {
      this.state.settings = this.state.settings || {};
      this.state.settings[key] = value;
      this.persist();
    },
    getSetting(key, fallback) {
      const s = this.state.settings || {};
      return s[key] === undefined ? fallback : s[key];
    },
    settings() { return Object.assign({}, this.state.settings || {}); },
    normalizedFen(fen) { return normalizeFen(fen); },

    importedGames() { return this.games; },
    detectDeviationForGame(g) {
      if (!g) return null;
      const st = this.gameStatus(g.id);
      if (st.status === 'ignored' || st.ignored) return null;
      const line = this.line(g.lineId);
      if (!line) return null;
      const dev = detectDeviation(g.pgn, line);
      if (!dev) return null;
      dev.gameId = g.id;
      const ignored = (st.ignoredDeviations || []).some(x => x.ply === dev.ply && x.played === dev.played);
      return ignored ? null : dev;
    },
    // Detect ALL deviations in a game (for fuller game review).
    deviationsForGame(g) {
      if (!g || this.gameStatus(g.id).ignored) return [];
      const line = this.line(g.lineId);
      if (!line) return [];
      return detectAllDeviations(g.pgn, line).map(d => Object.assign(d, { gameId: g.id }));
    },

    // Add a user-created game to the active profile.
    addUserGame(game) {
      const id = game.id || ('g_' + Math.random().toString(36).slice(2, 9));
      const matched = game.lineId || (this.bestLineMatchForPgn ? (this.bestLineMatchForPgn(game.pgn || '') || {}).lineId : null) || null;
      const full = Object.assign({ id, played: 'just now', site: 'Imported', vs: 'unknown', vsRating: 0, yourColor: 'w', result: 'd', timeControl: '?', lineId: matched, status: matched ? 'matched' : 'unmatched' }, game, { id });
      if (!full.lineId) full.status = 'unmatched';
      this.state.userGames = this.state.userGames || [];
      const existing = this.state.userGames.find(g => g.id === id);
      if (existing) Object.assign(existing, full);
      else this.state.userGames.push(full);
      const gameExisting = this.games.find(g => g.id === id);
      if (gameExisting) Object.assign(gameExisting, full);
      else this.games.push(full);
      this.persist();
      return full;
    },
    updateUserGame(id, patch) {
      const lists = [this.state.userGames || [], this.games || []];
      let found = null;
      lists.forEach(list => {
        const g = list.find(x => x.id === id);
        if (g) { Object.assign(g, patch); found = g; }
      });
      this.persist();
      return found;
    },
    removeUserGame(id) {
      this.state.userGames = (this.state.userGames || []).filter(g => g.id !== id);
      this.games = (this.games || []).filter(g => g.id !== id);
      if (this.state.gameStatus) delete this.state.gameStatus[id];
      this.persist();
    },
    setGameStatus(id, patch) {
      this.state.gameStatus = this.state.gameStatus || {};
      this.state.gameStatus[id] = Object.assign({}, this.state.gameStatus[id] || {}, patch);
      const g = (this.games || []).find(x => x.id === id);
      if (g && patch.status) g.status = patch.status;
      this.persist();
      return this.state.gameStatus[id];
    },
    gameStatus(id) { return (this.state.gameStatus || {})[id] || {}; },
    ignoreDeviation(gameId, dev) {
      if (!dev) return null;
      const st = this.gameStatus(gameId);
      const list = (st.ignoredDeviations || []).slice();
      if (!list.some(x => x.ply === dev.ply && x.played === dev.played)) {
        list.push({ ply: dev.ply, played: dev.played, expected: dev.expected, at: Date.now() });
      }
      return this.setGameStatus(gameId, { ignoredDeviations: list, status: 'reviewed' });
    },
    isDeviationIgnored(gameId, ply) {
      const st = this.gameStatus(gameId);
      return (st.ignoredDeviations || []).some(x => x.ply === ply) || st.status === 'ignored';
    },
    cardsFromLine(lineId, currentPly = 0) {
      const start = Math.max(1, Number(currentPly || 0) + 1);
      const cards = (this.data.byLine[lineId] || []).filter(p => p.ply >= start);
      return cards.length ? cards : (this.data.byLine[lineId] || []).slice();
    },
    cardAtLinePly(lineId, ply) {
      return (this.data.byLine[lineId] || []).find(p => p.ply === ply) || null;
    },
    normalizeFen(fen) { return normalizeFen(fen); },
    bestLineMatchForPgn(pgn) {
      const moves = cleanPgnTokens(pgn);
      if (!moves.length) return null;
      let best = null;
      this.data.lines.forEach(line => {
        let matches = 0;
        for (let i = 0; i < Math.min(moves.length, line.moves.length); i++) {
          if (!sameSan(moves[i], line.moves[i])) break;
          matches++;
        }
        if (!best || matches > best.matches) best = { lineId: line.id, matches, total: line.moves.length };
      });
      return best && best.matches > 0 ? best : null;
    },
    matchGameToLine(gameId, lineId) {
      const line = this.line(lineId);
      if (!line) return null;
      return this.updateUserGame(gameId, { lineId, status: 'matched' });
    },
    createLineFromGame(gameId, opts = {}) {
      const g = (this.games || []).find(x => x.id === gameId);
      if (!g) return null;
      const moves = cleanPgnTokens(g.pgn);
      if (!moves.length) return null;
      const line = this.addUserLine({
        name: opts.name || `${g.vs || 'Imported game'} line`,
        eco: opts.eco || '?',
        opening: opts.opening || 'Imported game',
        color: opts.color || g.yourColor || 'w',
        tag: opts.tag || 'investigate',
        description: opts.description || `Created from game vs ${g.vs || 'opponent'}`,
        moves,
      });
      this.updateUserGame(gameId, { lineId: line.id, status: 'matched' });
      return line;
    },
    addAlternateForDeviation(gameId) {
      const g = (this.games || []).find(x => x.id === gameId);
      const dev = this.detectDeviationForGame(g);
      if (!g || !dev || !dev.isUser) return null;
      const cardId = `${g.lineId}#${dev.ply}`;
      const ch = new global.Chess();
      if (dev.fenBefore) ch.load(dev.fenBefore);
      const m = ch.move(dev.played, { sloppy: true });
      return this.addAlternateToCard(cardId, dev.played, m ? ch.fen() : '');
    },

    // Add a user-created line. Materialize positions into the in-memory data.
    addUserLine(line) {
      const id = line.id || ('line_' + Math.random().toString(36).slice(2, 8));
      const newLine = {
        id,
        name: line.name || 'New line',
        eco: line.eco || '?',
        opening: line.opening || line.name || 'New line',
        color: line.color || 'w',
        tag: line.tag || 'nice-to-know',
        description: line.description || '',
        repId: line.repId || repIdForColor(line.color || 'w'),
        moves: (line.moves || []).slice(),
        ideas: line.ideas || {},
        source: line.source || 'user',
        status: line.status || 'active',
        retired: !!line.retired,
        parentLineId: line.parentLineId || null,
        branchFromPly: line.branchFromPly || null,
        branchFromFen: line.branchFromFen || '',
        branchType: line.branchType || '',
        mergedInto: line.mergedInto || null,
        mergeAt: line.mergeAt || null,
        sourceRefs: line.sourceRefs || [],
        createdAt: line.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      this.state.userLines = this.state.userLines || [];
      const existing = this.state.userLines.find(l => l.id === id);
      if (existing) Object.assign(existing, newLine);
      else this.state.userLines.push(newLine);
      // Materialize into in-memory data
      this.data.lines = (this.data.lines || []).filter(l => l.id !== id);
      this.data.positions = (this.data.positions || []).filter(p => p.lineId !== id);
      delete this.data.byLine[id];
      Object.keys(this.data.byId || {}).forEach(k => { if ((this.data.byId[k] || {}).lineId === id) delete this.data.byId[k]; });
      this.data.lines.push(newLine);
      const positions = buildPositionsForLine(newLine);
      this.data.positions = this.data.positions.concat(positions);
      this.data.byLine[id] = positions;
      positions.forEach(p => {
        this.data.byId[p.id] = p;
        if (!this.state.srs[p.id]) this.state.srs[p.id] = initialSrs([p])[p.id];
      });
      this.state.lineHistory = this.state.lineHistory || [];
      this.state.lineHistory.push({ at: Date.now(), action: 'add', lineId: id, name: newLine.name });
      this.state.lineHistory = this.state.lineHistory.slice(-200);
      this._buildPositionGraph();
      this.persist();
      return newLine;
    },
    isUserLine(id) { return (this.state.userLines || []).some(l => l.id === id); },
    updateUserLine(id, patch) {
      const line = (this.state.userLines || []).find(l => l.id === id);
      if (!line) return null;
      const beforeMoves = (line.moves || []).join(' ');
      Object.assign(line, patch, { updatedAt: Date.now() });
      if (patch.moves) line.moves = patch.moves.slice();
      this.state.lineHistory = this.state.lineHistory || [];
      this.state.lineHistory.push({
        at: Date.now(), action: beforeMoves !== (line.moves || []).join(' ') ? 'edit-moves' : 'edit',
        lineId: id, name: line.name
      });
      this.state.lineHistory = this.state.lineHistory.slice(-200);
      this.persist();
      this.init();
      return this.line(id);
    },
    deleteUserLine(id) {
      const line = (this.state.userLines || []).find(l => l.id === id);
      if (!line) return false;
      this.state.userLines = (this.state.userLines || []).filter(l => l.id !== id);
      Object.keys(this.state.srs || {}).forEach(k => { if (k.startsWith(id + '#')) delete this.state.srs[k]; });
      Object.keys(this.state.notes || {}).forEach(k => { if (k.startsWith(id + '#')) delete this.state.notes[k]; });
      Object.keys(this.state.cardMeta || {}).forEach(k => { if (k.startsWith(id + '#')) delete this.state.cardMeta[k]; });
      (this.state.userGames || []).forEach(g => { if (g.lineId === id) { g.lineId = null; g.status = 'unmatched'; } });
      this.state.assignments = (this.state.assignments || []).filter(a => a.lineId !== id);
      this.state.lineHistory = this.state.lineHistory || [];
      this.state.lineHistory.push({ at: Date.now(), action: 'delete', lineId: id, name: line.name });
      this.persist();
      this.init();
      return true;
    },
    duplicateLine(id) {
      const src = this.line(id);
      if (!src) return null;
      return this.addUserLine({
        name: src.name + ' copy', eco: src.eco, opening: src.opening, color: src.color,
        tag: src.tag, description: src.description, repId: src.repId, moves: (src.moves || []).slice(),
        ideas: src.ideas || {}, sourceRefs: src.sourceRefs || [], status: 'active',
      });
    },
    exportLinePgn(id) {
      const line = this.line(id);
      if (!line) return '';
      const safe = x => String(x || '').replace(/"/g, "'");
      const headers = [
        `[Event "OpeningOS repertoire"]`,
        `[Site "OpeningOS"]`,
        `[Opening "${safe(line.opening || line.name)}"]`,
        `[ECO "${safe(line.eco || '?')}"]`,
        `[Result "*"]`,
      ];
      const moves = [];
      for (let i = 0; i < (line.moves || []).length; i += 2) {
        moves.push(`${Math.floor(i / 2) + 1}. ${line.moves[i]}${line.moves[i + 1] ? ' ' + line.moves[i + 1] : ''}`);
      }
      return headers.join('\n') + '\n\n' + moves.join(' ') + ' *';
    },


    graphSnapshot() { return this.graph ? deepCopy(this.graph) : buildGraphFromLines(this.data.lines, this.state); },
    lineBranches(lineId) { return this.lines({ includeRetired: true }).filter(l => l.parentLineId === lineId); },
    isLineRetired(lineId) { const l = this.line(lineId); return !!(l && (l.status === 'retired' || l.retired || l.mergedInto)); },
    setLineRetired(lineId, retired = true, reason = '') {
      const line = (this.state.userLines || []).find(l => l.id === lineId);
      if (!line) return null;
      line.status = retired ? 'retired' : 'active';
      line.retired = !!retired;
      line.retiredAt = retired ? Date.now() : null;
      line.retiredReason = reason || line.retiredReason || '';
      this.state.lineHistory = this.state.lineHistory || [];
      this.state.lineHistory.push({ at: Date.now(), action: retired ? 'retire' : 'restore', lineId, name: line.name, reason });
      this.audit(retired ? 'line.retire' : 'line.restore', { lineId, reason });
      this.persist(); this.init();
      return this.line(lineId);
    },
    setEdgeComment(lineId, ply, comment) {
      const graph = this.graphSnapshot();
      const path = graph.line_paths[lineId];
      if (!path) return null;
      const edgeId = path.edgeIds[Number(ply || 1) - 1];
      if (!edgeId) return null;
      this.state.edgeComments = this.state.edgeComments || {};
      this.state.edgeComments[edgeId] = Object.assign({}, this.state.edgeComments[edgeId] || {}, { comment: String(comment || ''), updatedAt: Date.now() });
      this.audit('edge.comment', { lineId, ply, edgeId });
      this.persist(); this.init();
      return this.state.edgeComments[edgeId];
    },
    insertMoveAt(lineId, index, san) {
      const line = (this.state.userLines || []).find(l => l.id === lineId);
      if (!line) return { ok: false, error: 'Only editable user lines can be changed.' };
      const idx = Math.max(0, Math.min(Number(index || 0), (line.moves || []).length));
      const draft = (line.moves || []).slice();
      draft.splice(idx, 0, san);
      const normalized = truncateToLegal(draft);
      if (normalized.firstIllegal) {
        if (normalized.firstIllegal.ply <= idx + 1) return { ok: false, error: 'Inserted move is illegal at this position.', illegal: normalized.firstIllegal };
        line.moves = normalized.moves;
        line.truncatedAt = normalized.firstIllegal;
      } else line.moves = normalized.moves;
      line.updatedAt = Date.now();
      this.state.lineHistory = this.state.lineHistory || [];
      this.state.lineHistory.push({ at: Date.now(), action: 'insert-move', lineId, name: line.name, ply: idx + 1, san });
      this.audit('line.insertMove', { lineId, ply: idx + 1, san });
      this.persist(); this.init();
      return { ok: true, line: this.line(lineId), truncatedAt: normalized.firstIllegal || null };
    },
    removeMoveAt(lineId, ply) {
      const line = (this.state.userLines || []).find(l => l.id === lineId);
      if (!line) return { ok: false, error: 'Only editable user lines can be changed.' };
      const idx = Number(ply || 1) - 1;
      if (idx < 0 || idx >= (line.moves || []).length) return { ok: false, error: 'Move not found.' };
      const removed = line.moves[idx];
      const draft = line.moves.slice();
      draft.splice(idx, 1);
      const normalized = truncateToLegal(draft);
      line.moves = normalized.moves;
      line.updatedAt = Date.now();
      line.truncatedAt = normalized.firstIllegal || null;
      this.state.lineHistory = this.state.lineHistory || [];
      this.state.lineHistory.push({ at: Date.now(), action: 'remove-move', lineId, name: line.name, ply, removed });
      this.audit('line.removeMove', { lineId, ply, removed });
      this.persist(); this.init();
      return { ok: true, line: this.line(lineId), removed, truncatedAt: normalized.firstIllegal || null };
    },
    splitLineFromPly(lineId, ply, opts = {}) {
      const src = this.line(lineId);
      if (!src) return null;
      const split = Math.max(0, Math.min(Number(ply || 0), (src.moves || []).length));
      const prefix = (src.moves || []).slice(0, split);
      const continuation = (src.moves || []).slice(split);
      const branch = this.addUserLine({
        name: opts.name || `${src.name} branch from ply ${split}`,
        eco: src.eco, opening: src.opening, color: src.color, tag: opts.tag || 'investigate', repId: src.repId,
        description: opts.description || `Split from ${src.name} at ply ${split}.`,
        moves: prefix.concat(continuation),
        parentLineId: src.id,
        branchFromPly: split,
        branchFromFen: this.fenAtPly(src.id, split),
        branchType: 'split',
        source: 'split-line',
      });
      if (opts.truncateOriginal && this.isUserLine(src.id)) this.updateUserLine(src.id, { moves: prefix, splitTo: branch.id });
      this.audit('line.split', { lineId, ply: split, branchId: branch.id });
      return branch;
    },
    addSideVariation(lineId, ply, variationMoves, opts = {}) {
      const src = this.line(lineId);
      if (!src) return null;
      const split = Math.max(0, Math.min(Number(ply || 0), (src.moves || []).length));
      const prefix = (src.moves || []).slice(0, split);
      const added = Array.isArray(variationMoves) ? variationMoves : cleanPgnTokens(variationMoves);
      const validated = truncateToLegal(prefix.concat(added));
      const branch = this.addUserLine({
        name: opts.name || `${src.name} variation at ply ${split}`,
        eco: src.eco, opening: src.opening, color: src.color, tag: opts.tag || 'investigate', repId: src.repId,
        description: opts.description || `Side variation from ${src.name} after ${split} plies.`,
        moves: validated.moves,
        parentLineId: src.id,
        branchFromPly: split,
        branchFromFen: this.fenAtPly(src.id, split),
        branchType: opts.branchType || 'side-variation',
        source: opts.source || 'side-variation',
      });
      this.audit('line.sideVariation', { lineId, ply: split, branchId: branch.id });
      return branch;
    },
    addOpponentReplyFromPosition(lineId, ply, san, opts = {}) {
      return this.addSideVariation(lineId, ply, [san].concat(opts.continuation || []), Object.assign({ branchType: 'opponent-reply', tag: 'investigate', source: 'opponent-reply' }, opts));
    },
    mergeLineWithTransposition(lineId, targetLineId, opts = {}) {
      const src = (this.state.userLines || []).find(l => l.id === lineId);
      const target = this.line(targetLineId);
      if (!src || !target) return null;
      let match = null;
      const srcCards = this.positionsForLine(src.id);
      const targetCards = this.positionsForLine(target.id);
      srcCards.some(a => targetCards.some(b => {
        if (normalizeFen(a.fen) === normalizeFen(b.fen)) { match = { sourcePly: a.ply, targetPly: b.ply, fenKey: normalizeFen(a.fen) }; return true; }
        return false;
      }));
      src.mergedInto = target.id;
      src.mergeAt = match || opts.mergeAt || null;
      src.status = opts.retire === false ? src.status || 'active' : 'retired';
      src.retired = src.status === 'retired';
      src.updatedAt = Date.now();
      this.state.lineHistory = this.state.lineHistory || [];
      this.state.lineHistory.push({ at: Date.now(), action: 'merge-transposition', lineId, targetLineId, match });
      this.audit('line.mergeTransposition', { lineId, targetLineId, match });
      this.persist(); this.init();
      return this.line(lineId);
    },
    fenAtPly(lineId, ply) {
      const line = this.line(lineId); if (!line) return '';
      const chess = new global.Chess();
      for (let i = 0; i < Math.min(Number(ply || 0), (line.moves || []).length); i++) {
        const m = chess.move(line.moves[i], { sloppy: true });
        if (!m) break;
      }
      return chess.fen();
    },
    markPositionCritical(cardId, critical = true, reason = '') {
      const card = this.position(cardId);
      const key = card ? normalizeFen(card.fen) : cardId;
      this.state.positionFlags = this.state.positionFlags || {};
      this.state.positionFlags[key] = Object.assign({}, this.state.positionFlags[key] || {}, { critical: !!critical, reason, updatedAt: Date.now() });
      if (card) this.state.positionFlags[card.id] = this.state.positionFlags[key];
      this.audit(critical ? 'position.critical' : 'position.uncritical', { cardId, fenKey: key, reason });
      this.persist(); this.init();
      return this.state.positionFlags[key];
    },
    positionFlag(cardId) {
      const card = this.position(cardId);
      const key = card ? normalizeFen(card.fen) : cardId;
      return (this.state.positionFlags || {})[cardId] || (this.state.positionFlags || {})[key] || {};
    },
    ideaCardFor(cardId) {
      const card = this.position(cardId);
      const key = card ? normalizeFen(card.fen) : cardId;
      const stored = (this.state.ideaCards || {})[cardId] || (this.state.ideaCards || {})[key] || {};
      return Object.assign({ idea: card && card.idea || '', plan: card && card.plan || '', hook: card && card.hook || '', mistake: card && card.mistake || '', modelGame: '', sourceRef: '' }, stored);
    },
    setIdeaCard(cardId, patch) {
      const card = this.position(cardId);
      const key = card ? normalizeFen(card.fen) : cardId;
      this.state.ideaCards = this.state.ideaCards || {};
      const next = Object.assign({}, this.ideaCardFor(cardId), patch || {}, { updatedAt: Date.now() });
      this.state.ideaCards[key] = next;
      if (card) this.state.ideaCards[card.id] = next;
      this.audit('position.ideaCard', { cardId, fenKey: key, fields: Object.keys(patch || {}) });
      this.persist(); this.init();
      return next;
    },
    setPracticeSetting(lineId, key, value) {
      this.state.practiceSettings = this.state.practiceSettings || {};
      this.state.practiceSettings[lineId] = Object.assign({}, this.state.practiceSettings[lineId] || {}, { [key]: value, updatedAt: Date.now() });
      this.persist(); return this.state.practiceSettings[lineId];
    },
    practiceSetting(lineId) { return Object.assign({ maxNew: 12, mode: this.getSetting('defaultPracticeMode', 'daily'), revealOnWrong: this.getSetting('revealOnWrong', true) }, (this.state.practiceSettings || {})[lineId] || {}); },
    saveActiveSession(snapshot) { this.state.activeSession = snapshot || null; this.persist(); },
    activeSession() { return this.state.activeSession || null; },
    clearActiveSession() { this.state.activeSession = null; this.persist(); },
    mistakes(limit = 100) { const m = this.state.mistakes || []; return m.slice(Math.max(0, m.length - limit)).reverse(); },
    matchGameToRepertoire(pgn) {
      const moves = cleanPgnTokens(pgn);
      const gameChess = new global.Chess();
      const gameKeys = [normalizeFen(gameChess.fen())];
      moves.forEach(tok => { const m = gameChess.move(tok, { sloppy: true }); if (m) gameKeys.push(normalizeFen(gameChess.fen())); });
      const matches = this.lines().map(line => {
        const path = this.graph && this.graph.line_paths ? this.graph.line_paths[line.id] : null;
        const keys = path ? path.nodeKeys : [];
        let prefix = 0; let transpositions = 0;
        for (let i = 0; i < Math.min(gameKeys.length, keys.length); i++) {
          if (gameKeys[i] === keys[i]) prefix++;
          else break;
        }
        gameKeys.forEach((k, i) => { if (keys.includes(k) && i >= prefix) transpositions++; });
        const score = prefix * 10 + transpositions * 3 - Math.abs((line.moves || []).length - moves.length) * 0.05;
        return { lineId: line.id, name: line.name, prefix, transpositions, score, total: keys.length };
      }).filter(x => x.prefix > 1 || x.transpositions > 0).sort((a,b) => b.score - a.score);
      return matches.slice(0, 8);
    },
    deepReviewGame(game) {
      if (!game) return { matches: [], deviations: [], moments: [] };
      const matches = this.matchGameToRepertoire(game.pgn || '');
      const best = game.lineId ? { lineId: game.lineId } : matches[0];
      const line = best ? this.line(best.lineId) : null;
      const deviations = line ? detectAllDeviations(game.pgn, line).map(d => Object.assign(d, { gameId: game.id, lineId: line.id })) : [];
      const moments = [];
      deviations.forEach(d => {
        const card = this.cardAtLinePly(line.id, d.ply);
        const s = card ? this.srs(card.id) : null;
        const repeated = this.mistakes(500).filter(m => m.cardId === (card && card.id)).length;
        moments.push({
          kind: d.isUser ? 'user-left-prep' : 'opponent-sideline',
          severity: d.isUser ? (s && s.reps ? 'forgot-trained-card' : 'new-gap') : 'coverage-gap',
          ply: d.ply, played: d.played, expected: d.expected, cardId: card && card.id, repeated,
          relevance: this.estimateSidelineRelevance(line.id, d),
          message: d.isUser ? `You left your prepared line on ply ${d.ply}.` : `Opponent played a sideline on ply ${d.ply}.`,
        });
      });
      if (!deviations.length && line && global.OOSAnalysis) moments.push(Object.assign({ kind: 'prep-quality' }, global.OOSAnalysis.openingQualityHeuristic(game, line, deviations)));
      return { gameId: game.id, matches, lineId: line && line.id, deviations, moments };
    },
    estimateSidelineRelevance(lineId, dev) {
      const games = (this.games || []).filter(g => g.lineId === lineId);
      const count = games.filter(g => (this.deviationsForGame(g) || []).some(d => d.ply === dev.ply && sameSan(d.played, dev.played))).length;
      if (count >= 3) return { label: 'high', count, message: 'Repeated in your games — add or study this.' };
      if (count === 2) return { label: 'medium', count, message: 'Seen twice — worth a lightweight response.' };
      return { label: 'low', count, message: 'Rare so far — ignore unless opponent-specific.' };
    },
    createShareSnapshot(scope = 'line', id = null) {
      const payload = scope === 'line' && id ? { line: this.line(id), cards: this.positionsForLine(id), notes: this.positionsForLine(id).reduce((a,c)=>{ if(this.state.notes[c.id]) a[c.id]=this.state.notes[c.id]; return a; }, {}) } : this.exportSnapshot();
      const share = { id: 'share_' + Math.random().toString(36).slice(2, 9), scope, targetId: id, createdAt: Date.now(), privacy: this.getSetting('privacy', 'private'), payload };
      this.state.shareLinks = this.state.shareLinks || [];
      this.state.shareLinks.unshift(share);
      this.state.shareLinks = this.state.shareLinks.slice(0, 50);
      this.audit('share.create', { scope, id });
      this.persist(); return share;
    },
    shareLinks() { return (this.state.shareLinks || []).slice(); },

    // Coach assignments (demo: stored against the active profile).
    assignments() { return (this.state.assignments || []).slice(); },
    addAssignment(a) {
      const full = Object.assign({
        id: 'asg_' + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(),
        status: 'pending',
        progress: 0,
      }, a);
      this.state.assignments = this.state.assignments || [];
      this.state.assignments.push(full);
      this.persist();
      return full;
    },


    // Coach/student exchange packs. These make coach workflows usable even
    // before a cloud backend exists: a coach exports assignments + referenced
    // lines, and the student imports the JSON pack into their own profile.
    exportCoachPack(studentId = null) {
      const students = this.students ? this.students() : [];
      const selectedStudent = studentId ? students.find(s => s.id === studentId) || null : null;
      const assignments = (this.state.assignments || []).filter(a => !studentId || a.studentId === studentId);
      const lineIds = Array.from(new Set(assignments.map(a => a.lineId).filter(Boolean)));
      const lines = lineIds.map(id => this.line(id)).filter(Boolean).map(line => ({
        id: line.id,
        name: line.name,
        eco: line.eco || '?',
        opening: line.opening || line.name,
        color: line.color || 'w',
        tag: line.tag || 'coach',
        description: line.description || '',
        repId: line.repId || repIdForColor(line.color || 'w'),
        moves: (line.moves || []).slice(),
        ideas: Object.assign({}, line.ideas || {}),
        source: line.source || 'coach-pack',
      }));
      const noteIds = Object.keys(this.state.notes || {}).filter(id => lineIds.some(lineId => id.indexOf(lineId + '#') === 0));
      const notes = {};
      noteIds.forEach(id => { notes[id] = this.state.notes[id]; });
      return {
        schema: 'openingos-coach-pack-v1',
        exportedAt: new Date().toISOString(),
        coachProfile: global.OOSProfiles && global.OOSProfiles.active ? global.OOSProfiles.active() : null,
        student: selectedStudent,
        assignments: assignments.map(a => Object.assign({}, a)),
        lines,
        notes,
      };
    },
    importCoachPack(pack) {
      if (!pack || pack.schema !== 'openingos-coach-pack-v1') throw new Error('This is not a valid OpeningOS coach pack.');
      const idMap = {};
      const importedLines = [];
      (pack.lines || []).forEach(line => {
        const existing = this.line(line.id);
        const newId = existing ? ('line_pack_' + Math.random().toString(36).slice(2, 9)) : line.id;
        const saved = this.addUserLine(Object.assign({}, line, {
          id: newId,
          tag: line.tag || 'coach',
          source: 'coach-pack',
          description: line.description || `Imported from coach pack${pack.coachProfile && pack.coachProfile.name ? ' by ' + pack.coachProfile.name : ''}`,
        }));
        idMap[line.id] = saved.id;
        importedLines.push(saved);
      });
      Object.keys(pack.notes || {}).forEach(oldId => {
        let newId = oldId;
        Object.keys(idMap).forEach(oldLineId => {
          if (oldId.indexOf(oldLineId + '#') === 0) newId = idMap[oldLineId] + oldId.slice(oldLineId.length);
        });
        this.state.notes[newId] = Object.assign({}, pack.notes[oldId], { importedAt: Date.now(), source: 'coach-pack' });
      });
      const importedAssignments = [];
      (pack.assignments || []).forEach(a => {
        const mappedLineId = idMap[a.lineId] || a.lineId;
        if (!mappedLineId) return;
        importedAssignments.push(this.addAssignment({
          studentId: 'self',
          lineId: mappedLineId,
          mode: a.mode || 'Learn + Review',
          due: a.due || 'No deadline',
          message: a.message || '',
          status: 'pending',
          source: 'coach-pack',
          coachName: pack.coachProfile && pack.coachProfile.name || 'Coach',
          importedAt: Date.now(),
        }));
      });
      this.persist();
      this.init();
      return { lines: importedLines, assignments: importedAssignments };
    },
    activeAssignments() {
      return (this.state.assignments || []).filter(a => a.status !== 'done');
    },
    cardsForAssignment(assignmentId) {
      const a = (this.state.assignments || []).find(x => x.id === assignmentId);
      if (!a || !a.lineId) return [];
      return this.positionsForLine(a.lineId);
    },
    updateAssignment(id, patch) {
      const a = (this.state.assignments || []).find(x => x.id === id);
      if (!a) return;
      Object.assign(a, patch);
      this.persist();
    },
    removeAssignment(id) {
      this.state.assignments = (this.state.assignments || []).filter(x => x.id !== id);
      this.persist();
    },

    exportSnapshot() {
      const profiles = global.OOSProfiles && global.OOSProfiles.list ? global.OOSProfiles.list() : [];
      const profileStates = {};
      profiles.forEach(p => {
        try {
          const key = 'openingos.v2.' + p.id + '.' + PROFILE_STATE_SUFFIX;
          const raw = localStorage.getItem(key);
          if (raw) profileStates[p.id] = JSON.parse(raw);
        } catch (_) {}
      });
      const active = global.OOSProfiles && global.OOSProfiles.active ? global.OOSProfiles.active() : null;
      if (active && !profileStates[active.id]) profileStates[active.id] = JSON.parse(JSON.stringify(this.state || {}));
      return {
        schema: 'openingos-local-v4-graph',
        exportedAt: new Date().toISOString(),
        activeProfile: active,
        profiles,
        profileStates,
        graph: this.graphSnapshot ? this.graphSnapshot() : null,
        state: JSON.parse(JSON.stringify(this.state || {})),
        storage: { backend: 'indexeddb+local-cache', indexedDb: !!global.indexedDB },
      };
    },
    importSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid backup file.');
      const incoming = snapshot.state || snapshot;
      if (!incoming || typeof incoming !== 'object') throw new Error('Backup has no state object.');
      const next = Object.assign({
        srs: {}, notes: {}, arrows: {}, gameStatus: {}, tournament: false, onboarded: true,
        settings: defaultSettings(), userLines: [], userGames: [], assignments: [], studentSync: {},
        students: [], cardMeta: {}, reviewEvents: [], lineHistory: [], opponentReports: [],
        graph: null, edgeComments: {}, annotations: {}, positionFlags: {}, ideaCards: {}, practiceSettings: {},
        activeSession: null, mistakes: [], shareLinks: [], auditLog: [], cloudConflicts: [],
      }, incoming);
      if (!Array.isArray(next.userLines)) next.userLines = [];
      if (!Array.isArray(next.userGames)) next.userGames = [];
      if (!next.srs || typeof next.srs !== 'object') next.srs = {};
      this.state = next;
      this.persist();
      this.init();
      return true;
    },
    exportAll() { return this.exportSnapshot(); },
    importAll(payload) { return this.importSnapshot(payload); },
    saveOpponentReport(report) {
      this.state.opponentReports = this.state.opponentReports || [];
      const full = Object.assign({ id: 'opp_' + Math.random().toString(36).slice(2, 8), savedAt: Date.now() }, report);
      this.state.opponentReports.unshift(full);
      this.state.opponentReports = this.state.opponentReports.slice(0, 25);
      this.persist();
      return full;
    },

    exportAssignmentPackage(assignmentId) {
      const assignment = (this.state.assignments || []).find(a => a.id === assignmentId);
      if (!assignment) throw new Error('Assignment not found.');
      const line = this.line(assignment.lineId);
      if (!line) throw new Error('Assignment line not found.');
      const cards = this.positionsForLine(line.id);
      const notesByPly = {};
      cards.forEach(card => {
        const note = this.state.notes && this.state.notes[card.id];
        if (note) notesByPly[card.ply] = JSON.parse(JSON.stringify(note));
      });
      return {
        schema: 'openingos-assignment-v1',
        exportedAt: new Date().toISOString(),
        coachProfile: global.OOSProfiles && global.OOSProfiles.active ? global.OOSProfiles.active() : null,
        assignment: JSON.parse(JSON.stringify(assignment)),
        line: JSON.parse(JSON.stringify(line)),
        notesByPly,
      };
    },
    importAssignmentPackage(pkg) {
      if (!pkg || pkg.schema !== 'openingos-assignment-v1' || !pkg.line || !pkg.assignment) {
        throw new Error('This is not a valid OpeningOS assignment package.');
      }
      const src = pkg.line;
      const line = this.addUserLine({
        name: src.name ? src.name + ' (coach assigned)' : 'Coach assigned line',
        eco: src.eco || '?',
        opening: src.opening || src.name || 'Coach assignment',
        color: src.color || 'w',
        tag: src.tag || 'must-know',
        description: src.description || 'Imported coach assignment.',
        repId: src.repId || repIdForColor(src.color || 'w'),
        moves: (src.moves || []).slice(),
        ideas: src.ideas || {},
        source: 'coach-assignment',
      });
      const notesByPly = pkg.notesByPly || {};
      Object.keys(notesByPly).forEach(ply => {
        const card = this.cardAtLinePly(line.id, Number(ply));
        if (card) {
          const copy = JSON.parse(JSON.stringify(notesByPly[ply]));
          copy.updatedAt = Date.now();
          this.state.notes[card.id] = copy;
        }
      });
      let self = (this.state.students || []).find(s => s.id === 'self');
      if (!self) {
        self = { id: 'self', name: 'My coach assignments', rating: 0, weakLine: '', lastSeen: 'local', avatar: 'M' };
        this.state.students = this.state.students || [];
        this.state.students.unshift(self);
      }
      const imported = this.addAssignment({
        studentId: 'self',
        lineId: line.id,
        mode: pkg.assignment.mode || 'Learn + Review',
        due: pkg.assignment.due || 'No deadline',
        message: pkg.assignment.message || '',
        status: 'pending',
        importedFromCoach: (pkg.coachProfile && pkg.coachProfile.name) || 'Coach',
      });
      this.persist();
      return { line, assignment: imported };
    },

    library() { return SEED_LIBRARY.slice(); },
    modelGames() { return SEED_MODEL_GAMES.slice(); },
    students() { return (this.state.students || []).slice(); },
    addStudent(s) {
      const full = Object.assign({
        id: 's_' + Math.random().toString(36).slice(2, 8),
        rating: 0,
        dueAssigned: 0,
        completion: 0,
        weakLine: '',
        lastSeen: 'just added',
        avatar: (s.name || '?').trim()[0]?.toUpperCase() || '?',
      }, s);
      this.state.students = this.state.students || [];
      this.state.students.push(full);
      this.persist();
      return full;
    },
    updateStudent(id, patch) {
      const list = this.state.students || [];
      const s = list.find(x => x.id === id);
      if (!s) return;
      Object.assign(s, patch);
      this.persist();
    },
    removeStudent(id) {
      this.state.students = (this.state.students || []).filter(x => x.id !== id);
      // Also drop assignments for that student
      this.state.assignments = (this.state.assignments || []).filter(a => a.studentId !== id);
      this.persist();
    },

    // Line quality score 0..100 based on idea-density, practice maturity,
    // miss rate, real-game appearances, and length sanity.
    lineQuality(lineId) {
      const line = this.line(lineId);
      if (!line) return 0;
      const positions = this.data.byLine[lineId];
      if (!positions || !positions.length) return 0;
      let s = 0;
      // Idea density (max 25)
      const withIdeas = positions.filter(p => p.idea).length;
      s += Math.min(25, Math.round((withIdeas / positions.length) * 25));
      // Practice maturity (max 25)
      let stable = 0;
      positions.forEach(p => {
        const c = this.state.srs[p.id];
        if (c && c.stability >= 4 && c.lapses === 0) stable++;
      });
      s += Math.min(25, Math.round((stable / positions.length) * 25));
      // Low miss rate (max 20)
      let avgMiss = 0; let n = 0;
      positions.forEach(p => { const c = this.state.srs[p.id]; if (c) { avgMiss += c.missRate || 0; n++; } });
      const missRate = n ? avgMiss / n : 0;
      s += Math.round((1 - Math.min(1, missRate)) * 20);
      // Real-game appearances (max 20)
      const games = this.games.filter(g => g.lineId === lineId).length;
      s += Math.min(20, games * 8);
      // Length sanity: 5..18 plies is "right-sized" (max 10)
      const plies = line.moves.length;
      if (plies >= 5 && plies <= 18) s += 10;
      else if (plies < 5) s += 4;
      else s += Math.max(0, 10 - Math.floor((plies - 18) / 2));
      return Math.min(100, s);
    },

    // Aggregations for insights
    coverage() {
      const buckets = this.data.lines.map(line => {
        const positions = this.data.byLine[line.id];
        let strong = 0, weak = 0;
        positions.forEach(p => {
          const c = this.state.srs[p.id];
          if (!c) return;
          if (c.stability >= 5 && c.lapses === 0) strong++;
          else if (c.lapses >= 2 || c.stability < 1.5) weak++;
        });
        const ratio = positions.length ? strong / positions.length : 0;
        let status = 'medium';
        if (ratio >= 0.7) status = 'strong';
        else if (ratio < 0.4) status = 'weak';
        return { line, total: positions.length, strong, weak, ratio, status };
      });
      return buckets;
    },

    // Per-line table summary used by Insights "Table" tab.
    lineTable() {
      return this.data.lines.map(line => {
        const positions = this.data.byLine[line.id];
        let due = 0, weak = 0;
        positions.forEach(p => {
          const c = this.state.srs[p.id];
          if (!c) return;
          if (isDue(c)) due++;
          if (isWeak(c)) weak++;
        });
        const stable = positions.filter(p => {
          const c = this.state.srs[p.id];
          return c && c.stability >= 4 && c.lapses === 0;
        }).length;
        const confidence = positions.length ? Math.round((stable / positions.length) * 100) : 0;
        const realGames = this.games.filter(g => g.lineId === line.id).length;
        return { line, lines: 1, due, weak, realGames, confidence };
      });
    },

    // Demo timeline events
    timeline() {
      // Derive a real activity timeline from the actual state.
      const events = [];
      const userLines = this.state.userLines || [];
      userLines.slice(-10).reverse().forEach(line => {
        events.push({
          at: 'recently',
          kind: 'add',
          text: `Added ${line.name} (${line.moves.length} half-moves)`,
        });
      });
      const games = (this.state.userGames || []).slice(-10).reverse();
      games.forEach(g => {
        events.push({
          at: g.played || 'recently',
          kind: 'fix',
          text: `Imported game vs ${g.vs} — ${g.result === 'w' ? 'won' : g.result === 'l' ? 'lost' : 'drew'}`,
        });
      });
      const assignments = (this.state.assignments || []).slice(-5);
      assignments.forEach(a => {
        const studentName = (this.students().find(s => s.id === a.studentId) || {}).name || 'student';
        const lineName = (this.line(a.lineId) || {}).name || 'a line';
        events.push({
          at: 'recently',
          kind: 'note',
          text: `Coach assigned "${lineName}" to ${studentName}`,
        });
      });
      return events;
    },

    repertoireHealth() {
      const lines = this.data.lines;
      return lines.map(line => {
        const positions = this.data.byLine[line.id];
        const stable = positions.filter(p => {
          const c = this.state.srs[p.id];
          return c && c.stability >= 4 && c.lapses === 0;
        }).length;
        const pct = positions.length ? Math.round(stable / positions.length * 100) : 0;
        return { id: line.id, name: line.name, pct };
      });
    },
  };

  global.OOSData = DB;
})(window);
