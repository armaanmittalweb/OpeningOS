/* OpeningOS — PGN parser
 * Parses [tag] header pairs, comment blocks {...}, NAGs ($1-$255),
 * variations (...), and SAN moves. Returns an array of games, each with
 * { headers, moves, result }.
 *
 * Move tree representation:
 *   moves: [ { san, comment?, nag?, variations: [ [moves...], ... ] }, ... ]
 *
 * For OpeningOS imports we usually flatten the mainline; variations are kept
 * in case future work surfaces them.
 */
(function (global) {
  'use strict';

  function parse(input) {
    const text = input.replace(/\r\n/g, '\n');
    const games = [];
    let pos = 0;

    while (pos < text.length) {
      // Skip whitespace between games
      while (pos < text.length && /\s/.test(text[pos])) pos++;
      if (pos >= text.length) break;

      const game = parseGame();
      if (game) games.push(game);
      else pos++; // safety: avoid infinite loop on garbage
    }

    return games;

    function parseGame() {
      const headers = parseHeaders();
      const { moves, result } = parseMovetext();
      if (!moves.length && !Object.keys(headers).length) return null;
      return { headers, moves, result };
    }

    function parseHeaders() {
      const headers = {};
      while (pos < text.length) {
        skipWs();
        if (text[pos] !== '[') break;
        pos++; // consume [
        // Tag name
        let name = '';
        while (pos < text.length && /[A-Za-z0-9_]/.test(text[pos])) name += text[pos++];
        skipWs();
        if (text[pos] !== '"') {
          // Malformed; bail out of this header.
          while (pos < text.length && text[pos] !== ']') pos++;
          if (text[pos] === ']') pos++;
          continue;
        }
        pos++; // consume opening "
        let value = '';
        while (pos < text.length && text[pos] !== '"') {
          if (text[pos] === '\\' && text[pos + 1]) { value += text[pos + 1]; pos += 2; }
          else value += text[pos++];
        }
        if (text[pos] === '"') pos++;
        // Closing ]
        while (pos < text.length && text[pos] !== ']') pos++;
        if (text[pos] === ']') pos++;
        headers[name] = value;
      }
      return headers;
    }

    function parseMovetext() {
      // Returns { moves: [...mainline], result: '1-0'|'0-1'|'1/2-1/2'|'*'|null }
      const moves = parseMoveList();
      let result = null;
      // Result token may already have been consumed by parseMoveList — check
      // by seeing the last entry.
      if (moves._result) { result = moves._result; delete moves._result; }
      return { moves, result };
    }

    function parseMoveList() {
      const list = [];
      while (pos < text.length) {
        skipWs();
        const ch = text[pos];
        if (ch === undefined) break;
        if (ch === ')') return list; // end of variation
        if (ch === '[') break;       // start of next game's headers
        if (ch === '{') {
          const c = parseComment();
          if (list.length) list[list.length - 1].comment = (list[list.length - 1].comment || '') + c;
          continue;
        }
        if (ch === ';') {
          // line comment to end of line
          let c = '';
          pos++; while (pos < text.length && text[pos] !== '\n') c += text[pos++];
          if (list.length) list[list.length - 1].comment = (list[list.length - 1].comment || '') + c.trim();
          continue;
        }
        if (ch === '(') {
          pos++; // consume (
          const variation = parseMoveList();
          if (text[pos] === ')') pos++; // consume )
          if (list.length) {
            (list[list.length - 1].variations = list[list.length - 1].variations || []).push(variation);
          }
          continue;
        }
        if (/\d/.test(ch)) {
          // Could be move number ("1.", "1...") or result ("1-0", "1/2-1/2").
          const slice = text.slice(pos);
          const resultMatch = slice.match(/^(1-0|0-1|1\/2-1\/2)/);
          if (resultMatch) {
            list._result = resultMatch[1];
            pos += resultMatch[1].length;
            return list;
          }
          // Move number like "12." or "12..." — consume digits + dots.
          while (pos < text.length && /[\d.]/.test(text[pos])) pos++;
          continue;
        }
        if (ch === '*') { list._result = '*'; pos++; return list; }
        if (ch === '$') {
          // NAG
          pos++; let num = '';
          while (pos < text.length && /\d/.test(text[pos])) num += text[pos++];
          if (list.length) list[list.length - 1].nag = parseInt(num, 10);
          continue;
        }
        if (/[a-zA-Z0-9!?+#=O-]/.test(ch)) {
          // SAN token. Read until whitespace or special.
          let san = '';
          while (pos < text.length && /[a-zA-Z0-9!?+#=O\-]/.test(text[pos])) san += text[pos++];
          // Strip trailing !? and # markers but keep them on the token for chess.js.
          if (san) list.push({ san });
          continue;
        }
        // Unknown char — skip.
        pos++;
      }
      return list;
    }

    function parseComment() {
      // Assumes current char is '{'
      pos++; // consume {
      let depth = 1; let out = '';
      while (pos < text.length && depth > 0) {
        const ch = text[pos];
        if (ch === '{') { depth++; out += ch; pos++; continue; }
        if (ch === '}') { depth--; pos++; if (depth === 0) break; out += ch; continue; }
        out += ch; pos++;
      }
      return out.trim();
    }

    function skipWs() {
      while (pos < text.length && /\s/.test(text[pos])) pos++;
    }
  }

  // Convert a parsed game's mainline to a flat SAN array, validated against
  // chess.js for legality. Returns { sanMoves, illegalAt? } where illegalAt is
  // the ply (1-indexed) of the first illegal move, if any.
  function mainlineSan(game, ChessCtor) {
    const chess = new (ChessCtor || global.Chess)();
    const sanMoves = [];
    for (let i = 0; i < game.moves.length; i++) {
      const move = game.moves[i];
      const m = chess.move(move.san, { sloppy: true });
      if (!m) return { sanMoves, illegalAt: i + 1, badSan: move.san };
      sanMoves.push(m.san);
    }
    return { sanMoves };
  }

  // Best-effort opening name from headers.Eco / headers.Opening.
  function openingFromHeaders(headers) {
    return {
      eco: headers && headers.ECO || '?',
      opening: headers && (headers.Opening || headers.Variation) || 'Imported line',
      white: headers && headers.White || 'White',
      black: headers && headers.Black || 'Black',
      event: headers && headers.Event || 'Imported',
      result: headers && headers.Result || '*',
    };
  }

  global.OOSPgn = { parse, mainlineSan, openingFromHeaders };
})(window);
