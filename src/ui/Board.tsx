import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Chess, type Square } from 'chess.js';
import { PIECE_PATHS } from './piecePaths';

export type Orientation = 'w' | 'b';
export interface Arrow {
  from: string;
  to: string;
  tone: 'expected' | 'played' | 'engine';
}

interface BoardProps {
  fen: string;
  orientation?: Orientation;
  lastMove?: { from: string; to: string } | null;
  /** Return true if the move was accepted. Omit for a read-only board. */
  onMove?: ((from: string, to: string, promotion?: string) => boolean) | undefined;
  /** Only allow moving pieces of this colour. */
  movable?: 'w' | 'b' | 'both';
  arrows?: Arrow[];
  marks?: Record<string, 'good' | 'bad' | 'hint'>;
  label: string;
  coordinates?: boolean;
}

const FILES = 'abcdefgh';
// Glyph box centre in font units (see piecePaths.ts); scale fits ~78% of a square.
const PIECE_T = 'translate(0.5 0.53) scale(0.00092 -0.00092) translate(-500 -360)';

function squareXY(sq: string, o: Orientation): [number, number] {
  const f = FILES.indexOf(sq[0] ?? 'a');
  const r = Number(sq[1] ?? 1) - 1;
  return o === 'w' ? [f, 7 - r] : [7 - f, r];
}

function xyToSquare(x: number, y: number, o: Orientation): string | null {
  if (x < 0 || y < 0 || x >= 8 || y >= 8) return null;
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  return o === 'w' ? `${FILES[fx]}${8 - fy}` : `${FILES[7 - fx]}${fy + 1}`;
}

function Piece({ type, color }: { type: string; color: 'w' | 'b' }) {
  const p = PIECE_PATHS[type];
  if (!p) return null;
  return color === 'w' ? (
    <g transform={PIECE_T}>
      <path d={p.solid} className="pc-w-fill" />
      <path d={p.outline} className="pc-w-line" />
    </g>
  ) : (
    <g transform={PIECE_T}>
      <path d={p.solid} className="pc-b-fill" />
    </g>
  );
}

export function Board({ fen, orientation = 'w', lastMove, onMove, movable = 'both', arrows = [], marks = {}, label, coordinates = true }: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: string; x: number; y: number; moved: boolean } | null>(null);
  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);
  const board = chess.board();
  const turn = chess.turn();

  const canPick = (sq: string) => {
    if (!onMove) return false;
    const pc = chess.get(sq as Square);
    return !!pc && pc.color === turn && (movable === 'both' || movable === pc.color);
  };
  const targets = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to as string));
  }, [selected, chess]);

  const toBoard = (e: RPointerEvent): [number, number] => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return [-1, -1];
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [pt.x, pt.y];
  };

  const tryMove = (from: string, to: string) => {
    if (!onMove || from === to) return false;
    const piece = chess.get(from as Square);
    const promo = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined;
    const ok = onMove(from, to, promo);
    setSelected(null);
    return ok;
  };

  const onDown = (e: RPointerEvent) => {
    if (!onMove) return;
    const [x, y] = toBoard(e);
    const sq = xyToSquare(x, y, orientation);
    if (!sq) return;
    if (selected && targets.has(sq)) {
      tryMove(selected, sq);
      return;
    }
    if (canPick(sq)) {
      setSelected(sq);
      setDrag({ from: sq, x, y, moved: false });
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else {
      setSelected(null);
    }
  };
  const onMoveEvt = (e: RPointerEvent) => {
    if (!drag) return;
    const [x, y] = toBoard(e);
    setDrag({ ...drag, x, y, moved: drag.moved || Math.hypot(x - drag.x, y - drag.y) > 0.2 });
  };
  const onUp = (e: RPointerEvent) => {
    if (!drag) return;
    const [x, y] = toBoard(e);
    const sq = xyToSquare(x, y, orientation);
    if (drag.moved && sq && sq !== drag.from) tryMove(drag.from, sq);
    setDrag(null);
  };

  const pad = coordinates ? 0.42 : 0.04;
  const view = `${-pad} -0.04 ${8 + pad + 0.04} ${8 + pad + 0.04}`;

  return (
    <svg
      ref={svgRef}
      className={`board${onMove ? ' is-interactive' : ''}`}
      viewBox={view}
      role="img"
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMoveEvt}
      onPointerUp={onUp}
      onPointerCancel={() => setDrag(null)}
    >
      <defs>
        {(['expected', 'played', 'engine'] as const).map((t) => (
          <marker key={t} id={`ah-${t}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" className={`arrow-head arrow-${t}`} />
          </marker>
        ))}
      </defs>
      {Array.from({ length: 64 }, (_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);
        return <rect key={i} x={x} y={y} width="1" height="1" className={(x + y) % 2 === 0 ? 'sq-l' : 'sq-d'} />;
      })}
      {lastMove &&
        [lastMove.from, lastMove.to].map((sq) => {
          const [x, y] = squareXY(sq, orientation);
          return <rect key={`lm${sq}`} x={x} y={y} width="1" height="1" className="sq-last" />;
        })}
      {Object.entries(marks).map(([sq, kind]) => {
        const [x, y] = squareXY(sq, orientation);
        return <rect key={`mk${sq}`} x={x + 0.04} y={y + 0.04} width="0.92" height="0.92" className={`sq-mark sq-${kind}`} />;
      })}
      {selected &&
        (() => {
          const [x, y] = squareXY(selected, orientation);
          return <rect x={x} y={y} width="1" height="1" className="sq-selected" />;
        })()}
      <rect x="0" y="0" width="8" height="8" className="board-frame" />
      {board.flatMap((row, r) =>
        row.map((pc, f) => {
          if (!pc) return null;
          const sq = `${FILES[f]}${8 - r}`;
          if (drag?.moved && drag.from === sq) return null;
          const [x, y] = squareXY(sq, orientation);
          return (
            <g key={sq} transform={`translate(${x} ${y})`} className="pc">
              <Piece type={pc.type} color={pc.color} />
            </g>
          );
        }),
      )}
      {[...targets].map((sq) => {
        const [x, y] = squareXY(sq, orientation);
        const occupied = !!chess.get(sq as Square);
        return occupied ? (
          <circle key={`t${sq}`} cx={x + 0.5} cy={y + 0.5} r="0.46" className="target-ring" />
        ) : (
          <circle key={`t${sq}`} cx={x + 0.5} cy={y + 0.5} r="0.13" className="target-dot" />
        );
      })}
      {arrows.map((a, i) => {
        const [x1, y1] = squareXY(a.from, orientation);
        const [x2, y2] = squareXY(a.to, orientation);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const shorten = 0.32;
        return (
          <line
            key={`a${i}`}
            x1={x1 + 0.5}
            y1={y1 + 0.5}
            x2={x2 + 0.5 - (dx / len) * shorten}
            y2={y2 + 0.5 - (dy / len) * shorten}
            className={`arrow arrow-${a.tone}`}
            markerEnd={`url(#ah-${a.tone})`}
          />
        );
      })}
      {drag?.moved &&
        (() => {
          const pc = chess.get(drag.from as Square);
          return pc ? (
            <g transform={`translate(${drag.x - 0.5} ${drag.y - 0.5})`} className="pc pc-drag">
              <Piece type={pc.type} color={pc.color} />
            </g>
          ) : null;
        })()}
      {coordinates && (
        <g className="coords" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <text key={`f${i}`} x={i + 0.5} y={8.34} textAnchor="middle">
              {orientation === 'w' ? FILES[i] : FILES[7 - i]}
            </text>
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <text key={`r${i}`} x={-0.2} y={i + 0.6} textAnchor="middle">
              {orientation === 'w' ? 8 - i : i + 1}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
