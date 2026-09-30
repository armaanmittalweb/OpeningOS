import type { RepLine } from '../domain/repertoire';
import type { GameRecord } from '../domain/review';

/** A small, sound Italian Game repertoire for White, used by the demo and /embed. */
export const DEMO_LINES: Array<Omit<RepLine, 'createdAt'>> = [
  { id: 'demo-giuoco', name: 'Giuoco Piano, slow c3', color: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O'] },
  { id: 'demo-two-knights', name: 'Two Knights, d3', color: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Be7', 'O-O', 'O-O', 'Re1', 'd6'] },
  { id: 'demo-hungarian', name: 'Hungarian Defence', color: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Be7', 'd4', 'd6', 'd5', 'Nb8'] },
  { id: 'demo-philidor', name: 'Philidor', color: 'w', moves: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Be7'] },
  { id: 'demo-reti-order', name: 'Réti move order', color: 'w', moves: ['Nf3', 'e5', 'e4', 'Nc6', 'Bc4'] },
];

export function demoLines(now = Date.now()): RepLine[] {
  return DEMO_LINES.map((l) => ({ ...l, moves: [...l.moves], createdAt: now }));
}

/** Two sample games so review works offline in the demo. */
export function demoGames(now = Date.now()): GameRecord[] {
  return [
    {
      id: 'demo-game-1', source: 'demo', white: 'You', black: 'Club opponent', userColor: 'w', result: '1-0', playedAt: now - 2 * 86_400_000,
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+', 'Bd2', 'Bxd2+', 'Nbxd2', 'd5'],
      opening: 'Italian Game: Giuoco Piano',
    },
    {
      id: 'demo-game-2', source: 'demo', white: 'You', black: 'Blitz opponent', userColor: 'w', result: '½-½', playedAt: now - 5 * 86_400_000,
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'],
      opening: 'Italian Game: Blackburne Shilling Gambit',
    },
    {
      id: 'demo-game-3', source: 'demo', white: 'You', black: 'Rapid opponent', userColor: 'w', result: '1-0', playedAt: now - 9 * 86_400_000,
      moves: ['Nf3', 'Nc6', 'e4', 'e5', 'Bc4', 'Nf6', 'd3', 'Be7', 'O-O', 'O-O', 'Re1', 'd6', 'c3', 'Na5'],
      opening: 'Italian Game: Two Knights (by transposition)',
    },
  ];
}
