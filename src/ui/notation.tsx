import { Fragment, type ReactNode } from 'react';

const FIG: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };

/** Replace piece letters with figurines: "Nxe5" → "♘xe5", "e8=Q" → "e8=♕". */
export function figurine(san: string): string {
  return san.replace(/^[KQRBN]/, (c) => FIG[c] ?? c).replace(/=([QRBN])/, (_, c: string) => `=${FIG[c] ?? c}`);
}

/** Move number prefix for a ply index (0 = White's first move). */
export function moveNumber(ply: number, first: boolean): string {
  const n = Math.floor(ply / 2) + 1;
  if (ply % 2 === 0) return `${n}.`;
  return first ? `${n}…` : '';
}

export function spokenMove(san: string): string {
  const names: Record<string, string> = { K: 'King ', Q: 'Queen ', R: 'Rook ', B: 'Bishop ', N: 'Knight ' };
  if (san.startsWith('O-O-O')) return 'long castle';
  if (san.startsWith('O-O')) return 'castle';
  return san.replace(/^[KQRBN]/, (c) => names[c] ?? c).replace('x', ' takes ').replace('+', ' check').replace('#', ' mate');
}

interface MoveTextProps {
  moves: readonly string[];
  /** Ply index of moves[0]. */
  startPly?: number;
  /** Number of plies currently shown on the board (0..moves.length). */
  cursor?: number;
  onSelect?: (plies: number) => void;
  /** Per-move class, e.g. marking the deviation. */
  markFor?: (index: number) => string | undefined;
  /** Placeholder shown after the last move, e.g. "?" in a drill. */
  trailing?: ReactNode;
  className?: string;
  label?: string;
}

/**
 * Moves set like a chess book: "1.e4 e5 2.♘f3 ♘c6". Each move is a button
 * when selectable so the line can be stepped through with the keyboard.
 */
export function MoveText({ moves, startPly = 0, cursor, onSelect, markFor, trailing, className, label }: MoveTextProps) {
  return (
    <p className={`movetext ${className ?? ''}`} aria-label={label}>
      {moves.map((san, i) => {
        const ply = startPly + i;
        const num = moveNumber(ply, i === 0);
        const active = cursor !== undefined && cursor === i + 1;
        const cls = ['mv', active ? 'is-current' : '', markFor?.(i) ?? ''].filter(Boolean).join(' ');
        const body = <span className="san">{figurine(san)}</span>;
        return (
          <Fragment key={i}>
            {num && <span className={ply % 2 === 0 ? 'num' : 'num num-black'}>{num}</span>}
            {onSelect ? (
              <button type="button" className={cls} aria-current={active ? 'step' : undefined} aria-label={`${num} ${spokenMove(san)}`} onClick={() => onSelect(i + 1)}>
                {body}
              </button>
            ) : (
              <span className={cls}>{body}</span>
            )}{' '}
          </Fragment>
        );
      })}
      {trailing !== undefined && (
        <>
          {(startPly + moves.length) % 2 === 0 ? <span className="num">{Math.floor((startPly + moves.length) / 2) + 1}.</span> : moves.length === 0 ? <span className="num num-black">{Math.floor((startPly + moves.length) / 2) + 1}…</span> : null}
          <span className="mv mv-trailing">{trailing}</span>
        </>
      )}
    </p>
  );
}
