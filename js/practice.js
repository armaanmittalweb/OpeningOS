/* OpeningOS — practice engine
 * Presents due cards, evaluates legal moves against prepared moves,
 * accepted alternates, and transposition-equivalent resulting positions.
 * Sessions are resumable and track per-card time/guessed metadata.
 */
(function (global) {
  'use strict';

  const HINT_LADDER = [
    (card) => ({ level: 'strategic', text: card.idea ? `Hint: ${card.idea}` : 'Think about the strategic plan.' }),
    (card) => ({ level: 'piece', text: `Hint: move a ${pieceFromMove(card.move)}.` }),
    (card) => ({ level: 'square', text: `Hint: target square is ${card.toSquare}.` }),
    (card) => ({ level: 'full', text: `The move is ${card.move}.` }),
  ];

  function pieceFromMove(san) {
    const c = (san || '')[0];
    switch (c) {
      case 'N': return 'knight';
      case 'B': return 'bishop';
      case 'R': return 'rook';
      case 'Q': return 'queen';
      case 'K': return 'king';
      case 'O': return 'king';
      default: return 'pawn';
    }
  }

  function cleanSan(s) { return String(s || '').replace(/[+#?!]+/g, '').trim(); }

  function resultFen(fen, san) {
    const chess = new global.Chess(fen);
    const m = chess.move(san, { sloppy: true });
    return m ? { move: m, fen: chess.fen(), key: global.OOSData ? global.OOSData.normalizeFen(chess.fen()) : chess.fen() } : null;
  }

  class PracticeSession {
    constructor(cards, options = {}) {
      this.cards = cards.slice();
      this.opts = Object.assign({ shuffle: true, max: 25, sessionId: 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7) }, options);
      if (this.opts.shuffle) {
        for (let i = this.cards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
      }
      if (this.cards.length > this.opts.max) this.cards.length = this.opts.max;
      this.index = 0;
      this.hintIndex = -1;
      this.results = [];
      this.startedAt = Date.now();
      this.cardStartedAt = Date.now();
      this.guessed = false;
      this.persist();
    }

    static fromSnapshot(snapshot) {
      if (!snapshot || !snapshot.cardIds || !global.OOSData) return null;
      const cards = snapshot.cardIds.map(id => global.OOSData.position(id)).filter(Boolean);
      if (!cards.length) return null;
      const session = Object.create(PracticeSession.prototype);
      session.cards = cards;
      session.opts = Object.assign({ shuffle: false, max: cards.length }, snapshot.opts || {});
      session.index = Math.min(snapshot.index || 0, cards.length);
      session.hintIndex = snapshot.hintIndex || -1;
      session.results = snapshot.results || [];
      session.startedAt = snapshot.startedAt || Date.now();
      session.cardStartedAt = Date.now();
      session.guessed = !!snapshot.guessed;
      return session;
    }

    toSnapshot() {
      return {
        schema: 'openingos-practice-session-v1',
        sessionId: this.opts.sessionId,
        mode: this.opts.mode || 'daily',
        opts: this.opts,
        cardIds: this.cards.map(c => c.id),
        index: this.index,
        hintIndex: this.hintIndex,
        results: this.results,
        startedAt: this.startedAt,
        cardStartedAt: this.cardStartedAt,
        guessed: this.guessed,
        savedAt: Date.now(),
      };
    }

    persist() {
      if (global.OOSData && global.OOSData.saveActiveSession && !this.isComplete()) global.OOSData.saveActiveSession(this.toSnapshot());
    }

    current() { return this.cards[this.index]; }
    progress() { return { current: Math.min(this.index + 1, this.cards.length), total: this.cards.length }; }
    remaining() { return this.cards.length - this.index; }
    isComplete() { return this.index >= this.cards.length; }
    elapsedForCard() { return Math.max(0, Date.now() - (this.cardStartedAt || Date.now())); }

    evaluate(attemptedSan) {
      const card = this.current();
      if (!card) return null;
      const expected = resultFen(card.fen, card.move);
      const attempted = resultFen(card.fen, attemptedSan);
      const DB = global.OOSData;
      if (!attempted) {
        return { kind: 'illegal', expected: card.move, played: attemptedSan || '', message: 'Illegal move from this position.', idea: card.idea, durationMs: this.elapsedForCard() };
      }
      const alternates = DB && DB.alternatesForCard ? DB.alternatesForCard(card.id) : [];
      const exact = cleanSan(attempted.move.san) === cleanSan(card.move);
      const samePosition = expected && attempted.key === expected.key;
      const acceptedAlt = alternates.some(a => {
        const sanOk = cleanSan(a.san) === cleanSan(attempted.move.san);
        const fenOk = a.fenKey && a.fenKey === attempted.key;
        return sanOk || fenOk;
      });
      if (exact || samePosition || acceptedAlt) {
        return {
          kind: acceptedAlt && !exact ? 'correct-alt' : (samePosition && !exact ? 'correct-transposition' : 'correct'), expected: card.move, played: attempted.move.san,
          alternate: acceptedAlt && !exact,
          transposition: samePosition && !exact && !acceptedAlt,
          expectedFen: expected ? expected.fen : '', playedFen: attempted.fen,
          message: acceptedAlt ? `Accepted alternate: ${attempted.move.san}.` : samePosition && !exact ? `Correct by transposition: ${attempted.move.san}.` : `Correct: ${card.move}.`,
          idea: card.idea,
          durationMs: this.elapsedForCard(),
        };
      }
      let knownPosition = false;
      let knownLines = [];
      if (DB && DB.graphSnapshot) {
        const graph = DB.graphSnapshot();
        knownPosition = !!(graph.positions && graph.positions[attempted.key]);
        if (knownPosition) {
          knownLines = Object.values(graph.line_paths || {}).filter(p => (p.nodeKeys || []).includes(attempted.key)).map(p => p.name).slice(0, 3);
        }
      }
      const kind = knownPosition ? 'legal-known-position' : 'outside-prep';
      return {
        kind,
        expected: card.move,
        played: attempted.move.san,
        expectedFen: expected ? expected.fen : '', playedFen: attempted.fen,
        message: knownPosition ? `Legal and reaches a known repertoire position, but not this prepared reply.` : `Legal but outside your repertoire. Your prepared move is ${card.move}.`,
        idea: card.idea,
        knownLines,
        durationMs: this.elapsedForCard(),
      };
    }

    nextHint() {
      this.hintIndex = Math.min(this.hintIndex + 1, HINT_LADDER.length - 1);
      this.guessed = true;
      const fn = HINT_LADDER[this.hintIndex];
      this.persist();
      return fn(this.current());
    }
    hintUsed() { return this.hintIndex >= 0; }
    markGuessed() { this.guessed = true; this.persist(); }

    grade(g, extra = {}) {
      const card = this.current();
      const result = { id: card.id, grade: g, hintUsed: this.hintUsed(), guessed: this.guessed || !!extra.guessed, durationMs: extra.durationMs || this.elapsedForCard(), outcome: extra.outcome || '' };
      this.results.push(result);
      this.index += 1;
      this.hintIndex = -1;
      this.cardStartedAt = Date.now();
      this.guessed = false;
      if (this.isComplete()) {
        if (global.OOSData && global.OOSData.clearActiveSession) global.OOSData.clearActiveSession();
      } else this.persist();
      return this.isComplete();
    }
  }

  global.OOSPractice = { PracticeSession, HINT_LADDER, pieceFromMove, resultFen };
})(window);
