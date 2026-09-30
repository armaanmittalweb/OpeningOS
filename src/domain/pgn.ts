/** Minimal PGN / move-text parsing. Legality is checked later by replay(). */

export interface ParsedPgn {
  headers: Record<string, string>;
  moves: string[];
}

const RESULT = /^(1-0|0-1|1\/2-1\/2|\*)$/;

/** Split PGN movetext (or a loose list like "e4 e5 Nf3") into SAN tokens. */
export function parseMoveText(text: string): string[] {
  let body = text.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  // Strip (possibly nested) variations.
  let prev = '';
  while (prev !== body) {
    prev = body;
    body = body.replace(/\([^()]*\)/g, ' ');
  }
  return body
    .replace(/\$\d+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.(\.\.)?/, '').replace(/^…/, '').replace(/[!?]+$/, ''))
    .filter((t) => t.length > 0 && !RESULT.test(t) && !/^\d+\.*$/.test(t));
}

export function parsePgn(pgn: string): ParsedPgn {
  const headers: Record<string, string> = {};
  const lines = pgn.replace(/\r/g, '').split('\n');
  const moveLines: string[] = [];
  for (const line of lines) {
    const m = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/.exec(line);
    if (m && m[1] !== undefined && m[2] !== undefined) headers[m[1]] = m[2].replace(/\\"/g, '"');
    else moveLines.push(line);
  }
  return { headers, moves: parseMoveText(moveLines.join(' ')) };
}

/** Split a multi-game PGN file into single games. */
export function splitPgnGames(text: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let seenMoves = false;
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const isHeader = /^\s*\[/.test(line);
    if (isHeader && seenMoves) {
      out.push(current.join('\n'));
      current = [];
      seenMoves = false;
    }
    if (!isHeader && line.trim()) seenMoves = true;
    current.push(line);
  }
  if (current.join('').trim()) out.push(current.join('\n'));
  return out;
}
