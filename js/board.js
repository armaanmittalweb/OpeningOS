/* OpeningOS — Chess board component
 * SVG-based, board-first. Smooth piece animations, click + drag input,
 * last-move highlight, legal-move targets, coordinates, flip, promotion picker.
 * Wraps chess.js for legality.
 */
(function (global) {
  'use strict';

  const PIECE_GLYPH = {
    p: '\u265F', n: '\u265E', b: '\u265D', r: '\u265C', q: '\u265B', k: '\u265A',
  };
  const FILES = ['a','b','c','d','e','f','g','h'];

  function squareToFR(sq) {
    return { file: sq.charCodeAt(0) - 97, rank: parseInt(sq[1], 10) };
  }
  function frToXY(file, rank, flipped) {
    const col = flipped ? 7 - file : file;
    const row = flipped ? rank - 1 : 8 - rank;
    return { x: col * 10, y: row * 10 };
  }
  function xyToSquare(x, y, flipped) {
    const col = Math.floor(x / 10);
    const row = Math.floor(y / 10);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const file = flipped ? 7 - col : col;
    const rank = flipped ? row + 1 : 8 - row;
    return FILES[file] + rank;
  }

  class ChessBoard {
    constructor(host, options = {}) {
      this.host = host;
      this.opts = Object.assign({
        fen: 'start',
        orientation: 'white',     // 'white' | 'black'
        interactive: true,
        showCoords: true,
        onMove: null,             // (move) => void  — called after legal move applied
        onAttemptMove: null,      // (move, ctx) => boolean | 'reject' — return false to block
        onAnnotate: null,         // ({fen, arrows}) => void  — called when arrows change
        annotations: [],          // pre-existing arrows/circles to render
      }, options);

      this.chess = new global.Chess();
      if (this.opts.fen && this.opts.fen !== 'start') {
        this.chess.load(this.opts.fen);
      }
      this.flipped = this.opts.orientation === 'black';
      this.selected = null;
      this.lastMove = null;
      this.legalTargets = [];
      this.dragState = null;
      this.rightDrag = null;
      this.shake = false;
      this.annotations = (this.opts.annotations || []).slice();

      this._build();
      this._render();
    }

    /* --- Public API ----------------------------------------------------- */
    setFen(fen) {
      this.chess.load(fen);
      this.selected = null;
      this.legalTargets = [];
      this.lastMove = null;
      this._render();
    }
    setOrientation(o) {
      this.flipped = o === 'black';
      this._render();
    }
    flip() { this.flipped = !this.flipped; this._render(); }
    move(san) {
      const m = this.chess.move(san, { sloppy: true });
      if (m) {
        this.lastMove = { from: m.from, to: m.to };
        this.selected = null; this.legalTargets = [];
        this._render();
      }
      return m;
    }
    setLastMove(from, to) { this.lastMove = (from && to) ? { from, to } : null; this._render(); }
    fen() { return this.chess.fen(); }
    turn() { return this.chess.turn(); }
    setInteractive(on) { this.opts.interactive = !!on; this._render(); }
    setAnnotations(list) { this.annotations = (list || []).slice(); this._renderArrows(); }
    clearAnnotations() { this.annotations = []; this._renderArrows(); if (this.opts.onAnnotate) this.opts.onAnnotate({ fen: this.fen(), arrows: [] }); }
    shakeIt() {
      this.shake = true;
      this.svg.classList.add('cb-shake');
      setTimeout(() => { this.shake = false; this.svg.classList.remove('cb-shake'); }, 400);
    }
    destroy() { this.host.innerHTML = ''; }

    /* --- Build skeleton ------------------------------------------------- */
    _build() {
      this.host.classList.add('chess-board');
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 80 80');
      svg.setAttribute('xmlns', NS);
      this.svg = svg;

      // Layers
      this.gSquares = document.createElementNS(NS, 'g');
      this.gHints = document.createElementNS(NS, 'g');
      this.gPieces = document.createElementNS(NS, 'g');
      this.gCoords = document.createElementNS(NS, 'g');
      this.gArrows = document.createElementNS(NS, 'g'); // user annotations
      this.gOverlay = document.createElementNS(NS, 'g'); // promotion etc

      svg.appendChild(this.gSquares);
      svg.appendChild(this.gHints);
      svg.appendChild(this.gPieces);
      svg.appendChild(this.gCoords);
      svg.appendChild(this.gArrows);
      svg.appendChild(this.gOverlay);

      this.host.innerHTML = '';
      this.host.appendChild(svg);

      // Pointer events for click + drag
      svg.addEventListener('pointerdown', e => this._onPointerDown(e));
      svg.addEventListener('pointermove', e => this._onPointerMove(e));
      svg.addEventListener('pointerup', e => this._onPointerUp(e));
      svg.addEventListener('pointercancel', () => this._cancelDrag());
      svg.addEventListener('contextmenu', e => e.preventDefault());
    }

    /* --- Render --------------------------------------------------------- */
    _render() {
      this._renderSquares();
      this._renderHints();
      this._renderPieces();
      this._renderCoords();
      this._renderArrows();
    }

    _renderSquares() {
      const NS = 'http://www.w3.org/2000/svg';
      this.gSquares.innerHTML = '';
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const isLight = (row + col) % 2 === 0;
          const file = this.flipped ? 7 - col : col;
          const rank = this.flipped ? row + 1 : 8 - row;
          const sq = FILES[file] + rank;

          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', col * 10);
          r.setAttribute('y', row * 10);
          r.setAttribute('width', 10);
          r.setAttribute('height', 10);
          r.setAttribute('fill', isLight ? 'var(--sq-light)' : 'var(--sq-dark)');
          r.classList.add('cb-square');
          r.dataset.square = sq;

          // Last-move highlight
          if (this.lastMove && (sq === this.lastMove.from || sq === this.lastMove.to)) {
            r.setAttribute('fill', isLight ? 'var(--sq-light-hl)' : 'var(--sq-dark-hl)');
          }
          // Selected
          if (sq === this.selected) {
            r.setAttribute('fill', isLight ? 'var(--sq-light-hl)' : 'var(--sq-dark-hl)');
          }
          this.gSquares.appendChild(r);
        }
      }
    }

    _renderHints() {
      const NS = 'http://www.w3.org/2000/svg';
      this.gHints.innerHTML = '';
      this.legalTargets.forEach(t => {
        const { x, y } = frToXY(t.fileF, t.rankR, this.flipped);
        if (t.capture) {
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', x + 5);
          c.setAttribute('cy', y + 5);
          c.setAttribute('r', 4.6);
          c.setAttribute('class', 'cb-target-capture');
          this.gHints.appendChild(c);
        } else {
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', x + 5);
          c.setAttribute('cy', y + 5);
          c.setAttribute('r', 1.6);
          c.setAttribute('class', 'cb-target');
          this.gHints.appendChild(c);
        }
      });
    }

    _renderPieces() {
      const NS = 'http://www.w3.org/2000/svg';
      // Reuse existing piece nodes by square so transitions can animate moves.
      const board = this.chess.board(); // 8x8 from rank 8 down to rank 1
      const wantPieces = {}; // sq -> {color, type}
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const cell = board[r][f];
          if (cell) {
            const sq = FILES[f] + (8 - r);
            wantPieces[sq] = cell;
          }
        }
      }

      // Track existing nodes
      const existing = {};
      Array.from(this.gPieces.children).forEach(node => {
        const sq = node.dataset.square;
        existing[sq] = node;
      });

      // Remove pieces that no longer exist on the board
      Object.keys(existing).forEach(sq => {
        if (!wantPieces[sq]) {
          existing[sq].remove();
        }
      });

      // Add or update remaining pieces
      Object.keys(wantPieces).forEach(sq => {
        const p = wantPieces[sq];
        const { file, rank } = squareToFR(sq);
        const { x, y } = frToXY(file, rank, this.flipped);

        let node = existing[sq];
        const desired = `${p.color}${p.type}`;
        if (node && node.dataset.piece !== desired) {
          // Square has different piece (capture/promotion). Remove and re-add.
          node.remove();
          node = null;
        }
        if (!node) {
          node = document.createElementNS(NS, 'g');
          node.classList.add('cb-piece');
          node.classList.add(p.color === 'w' ? 'w' : 'b');
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', 5);
          t.setAttribute('y', 7.6);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-size', 8.4);
          t.textContent = PIECE_GLYPH[p.type];
          node.appendChild(t);
          this.gPieces.appendChild(node);
        }
        node.dataset.square = sq;
        node.dataset.piece = desired;
        node.setAttribute('transform', `translate(${x} ${y})`);
      });
    }

    _renderCoords() {
      const NS = 'http://www.w3.org/2000/svg';
      this.gCoords.innerHTML = '';
      if (!this.opts.showCoords) return;
      // Files along bottom row, ranks along left column
      for (let i = 0; i < 8; i++) {
        const file = this.flipped ? 7 - i : i;
        const rank = this.flipped ? i + 1 : 8 - i;
        const sqLight = (7 + file) % 2 === 0; // bottom row coloration
        // file letter (bottom)
        const ft = document.createElementNS(NS, 'text');
        ft.setAttribute('x', i * 10 + 8.35);
        ft.setAttribute('y', 78.55);
        ft.setAttribute('class', 'cb-coord cb-file-coord');
        ft.setAttribute('text-anchor', 'middle');
        ft.setAttribute('dominant-baseline', 'middle');
        ft.setAttribute('fill', sqLight ? '#70806e' : '#f3f6ef');
        ft.textContent = FILES[file];
        this.gCoords.appendChild(ft);

        // rank number (left)
        const sqLightL = (i + 0) % 2 === 0;
        const rt = document.createElementNS(NS, 'text');
        rt.setAttribute('x', 1.55);
        rt.setAttribute('y', i * 10 + 1.75);
        rt.setAttribute('class', 'cb-coord cb-rank-coord');
        rt.setAttribute('text-anchor', 'middle');
        rt.setAttribute('dominant-baseline', 'middle');
        rt.setAttribute('fill', sqLightL ? '#70806e' : '#f3f6ef');
        rt.textContent = rank;
        this.gCoords.appendChild(rt);
      }
    }

    _renderArrows() {
      const NS = 'http://www.w3.org/2000/svg';
      this.gArrows.innerHTML = '';
      const palette = {
        green:  '#91b89f',
        red:    '#d97a7a',
        yellow: '#d9b27a',
        blue:   '#7aa3d9',
      };
      this.annotations.forEach(ann => {
        const color = palette[ann.color] || palette.green;
        if (ann.kind === 'circle' || (ann.from === ann.to)) {
          // Circle on a square
          const sq = ann.to || ann.from;
          if (!sq) return;
          const { file, rank } = squareToFR(sq);
          const { x, y } = frToXY(file, rank, this.flipped);
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', x + 5);
          c.setAttribute('cy', y + 5);
          c.setAttribute('r', 4.4);
          c.setAttribute('fill', 'none');
          c.setAttribute('stroke', color);
          c.setAttribute('stroke-width', '0.7');
          c.setAttribute('opacity', '0.85');
          this.gArrows.appendChild(c);
        } else {
          // Arrow from -> to
          const from = squareToFR(ann.from);
          const to = squareToFR(ann.to);
          const a = frToXY(from.file, from.rank, this.flipped);
          const b = frToXY(to.file, to.rank, this.flipped);
          const ax = a.x + 5, ay = a.y + 5, bx = b.x + 5, by = b.y + 5;
          // shorten the line a bit so the arrowhead doesn't overshoot
          const dx = bx - ax, dy = by - ay;
          const len = Math.hypot(dx, dy);
          const ux = dx / len, uy = dy / len;
          const sx = ax + ux * 1.2, sy = ay + uy * 1.2;
          const ex = bx - ux * 2.4, ey = by - uy * 2.4;
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', sx); line.setAttribute('y1', sy);
          line.setAttribute('x2', ex); line.setAttribute('y2', ey);
          line.setAttribute('stroke', color);
          line.setAttribute('stroke-width', '1.4');
          line.setAttribute('stroke-linecap', 'round');
          line.setAttribute('opacity', '0.85');
          this.gArrows.appendChild(line);
          // Arrow head
          const head = document.createElementNS(NS, 'polygon');
          const hx = bx - ux * 0.6, hy = by - uy * 0.6;
          const px = -uy, py = ux;
          const p1 = `${hx},${hy}`;
          const p2 = `${ex - px * 1.6},${ey - py * 1.6}`;
          const p3 = `${ex + px * 1.6},${ey + py * 1.6}`;
          head.setAttribute('points', `${p1} ${p2} ${p3}`);
          head.setAttribute('fill', color);
          head.setAttribute('opacity', '0.85');
          this.gArrows.appendChild(head);
        }
      });
    }

    /* --- Interaction ---------------------------------------------------- */
    _eventToBoardXY(e) {
      const rect = this.svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 80;
      const y = ((e.clientY - rect.top) / rect.height) * 80;
      return { x, y };
    }

    _onPointerDown(e) {
      // Right-click handles annotations regardless of `interactive` flag.
      if (e.button === 2) {
        const { x, y } = this._eventToBoardXY(e);
        const sq = xyToSquare(x, y, this.flipped);
        if (!sq) return;
        this.svg.setPointerCapture(e.pointerId);
        this.rightDrag = { from: sq, fromXY: { x, y }, pointerId: e.pointerId };
        e.preventDefault();
        return;
      }
      if (!this.opts.interactive) return;
      const { x, y } = this._eventToBoardXY(e);
      const sq = xyToSquare(x, y, this.flipped);
      if (!sq) return;
      const piece = this.chess.get(sq);

      // If we have a selected piece and clicked target, try move
      if (this.selected && this.selected !== sq) {
        const target = this.legalTargets.find(t => t.square === sq);
        if (target) {
          this._tryMove(this.selected, sq);
          return;
        }
      }

      if (piece && piece.color === this.chess.turn()) {
        this.selected = sq;
        this._computeLegalTargets(sq);
        this._renderSquares();
        this._renderHints();

        // Begin drag
        const node = this._pieceNodeAt(sq);
        if (node) {
          this.svg.setPointerCapture(e.pointerId);
          this.dragState = {
            from: sq, node, pointerId: e.pointerId,
            startX: x, startY: y,
          };
          node.classList.add('dragging');
        }
      } else {
        this.selected = null;
        this.legalTargets = [];
        this._renderSquares();
        this._renderHints();
      }
    }

    _onPointerMove(e) {
      if (this.rightDrag) return; // no live preview yet
      if (!this.dragState) return;
      const { x, y } = this._eventToBoardXY(e);
      const node = this.dragState.node;
      node.setAttribute('transform', `translate(${x - 5} ${y - 5})`);
    }

    _onPointerUp(e) {
      if (this.rightDrag) {
        const { x, y } = this._eventToBoardXY(e);
        const target = xyToSquare(x, y, this.flipped);
        const from = this.rightDrag.from;
        try { this.svg.releasePointerCapture(this.rightDrag.pointerId); } catch (_) {}
        this.rightDrag = null;
        if (!target) return;
        // Determine arrow color from modifier keys: shift=red, alt=blue, ctrl=yellow, default=green
        const color = e.shiftKey ? 'red' : e.altKey ? 'blue' : e.ctrlKey ? 'yellow' : 'green';
        const ann = (target === from)
          ? { kind: 'circle', from, to: from, color }
          : { kind: 'arrow',  from, to: target, color };
        // Toggle (add or remove if present)
        const existingIdx = this.annotations.findIndex(a =>
          a.from === ann.from && a.to === ann.to && a.kind === ann.kind && a.color === ann.color
        );
        if (existingIdx >= 0) this.annotations.splice(existingIdx, 1);
        else this.annotations.push(ann);
        this._renderArrows();
        if (this.opts.onAnnotate) this.opts.onAnnotate({ fen: this.fen(), arrows: this.annotations.slice() });
        return;
      }
      if (!this.dragState) return;
      const { x, y } = this._eventToBoardXY(e);
      const target = xyToSquare(x, y, this.flipped);
      const from = this.dragState.from;
      this.dragState.node.classList.remove('dragging');
      try { this.svg.releasePointerCapture(this.dragState.pointerId); } catch (_) {}
      this.dragState = null;

      if (!target || target === from) {
        // snap back
        this._renderPieces();
        return;
      }
      const ok = this.legalTargets.find(t => t.square === target);
      if (!ok) {
        this._renderPieces();
        this.selected = null; this.legalTargets = [];
        this._renderSquares(); this._renderHints();
        return;
      }
      this._tryMove(from, target);
    }

    _cancelDrag() {
      if (this.dragState) {
        this.dragState.node.classList.remove('dragging');
        this.dragState = null;
        this._renderPieces();
      }
    }

    _pieceNodeAt(sq) {
      return Array.from(this.gPieces.children).find(n => n.dataset.square === sq);
    }

    _computeLegalTargets(sq) {
      const moves = this.chess.moves({ square: sq, verbose: true });
      this.legalTargets = moves.map(m => {
        const { file, rank } = squareToFR(m.to);
        return {
          square: m.to,
          fileF: file, rankR: rank,
          capture: !!m.captured || m.flags.includes('e'),
          promotion: m.promotion,
        };
      });
    }

    _tryMove(from, to) {
      // Detect promotion
      const verbose = this.chess.moves({ square: from, verbose: true });
      const matches = verbose.filter(m => m.to === to);
      if (matches.length === 0) return;
      let promotion;
      if (matches.some(m => m.promotion)) {
        // Product alpha: auto-queen promotions until the promotion picker is expanded
        promotion = 'q';
      }
      const moveObj = { from, to };
      if (promotion) moveObj.promotion = promotion;

      // External interceptor (e.g., practice mode wants to validate against repertoire)
      if (this.opts.onAttemptMove) {
        const decision = this.opts.onAttemptMove({ from, to, promotion }, this);
        if (decision === false) {
          this.selected = null; this.legalTargets = [];
          this._renderSquares(); this._renderHints();
          this._renderPieces();
          return;
        }
      }

      const m = this.chess.move(moveObj);
      if (!m) return;
      // Sound effects
      if (global.OOSAudio) {
        if (m.flags && (m.flags.includes('c') || m.flags.includes('e'))) global.OOSAudio.capture();
        else global.OOSAudio.move();
        if (this.chess.in_check && this.chess.in_check()) global.OOSAudio.check();
      }
      this.lastMove = { from: m.from, to: m.to };
      this.selected = null;
      this.legalTargets = [];
      // Annotations cleared on a move (per Lichess UX convention)
      this.annotations = [];
      this._render();
      if (this.opts.onMove) this.opts.onMove(m, this);
    }
  }

  global.OOSBoard = ChessBoard;
})(window);
