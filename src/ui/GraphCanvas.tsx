import { useMemo, type KeyboardEvent } from 'react';
import type { Color, NativeRepertoireGraph } from '../domain/graph';
import { heat, type Heat, type SchedulingState } from '../domain/fsrs';
import { cardId, transpositionIds } from '../domain/repertoire';
import { layoutGraph } from './graphLayout';
import { figurine } from './notation';

interface Props {
  graph: NativeRepertoireGraph;
  color: Color;
  sched: Record<string, SchedulingState>;
  selected: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
  now?: number;
}

export const HEAT_LABEL: Record<Heat, string> = { new: 'New', fresh: 'Comfortable', soon: 'Due soon', due: 'Due', overdue: 'Overdue' };

/**
 * The repertoire as a position graph. Positions where it is your move are
 * practice cards, coloured by how due they are; the small dots are your
 * opponent's turns. A ring marks positions reached by more than one move order.
 */
export function GraphCanvas({ graph, color, sched, selected, onSelect, compact = false, now = Date.now() }: Props) {
  const layout = useMemo(() => layoutGraph(graph, compact ? { gap: 58, row: 56, pad: 28 } : {}), [graph, compact]);
  const merges = useMemo(() => transpositionIds(graph), [graph]);
  const children = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of layout.edges) m.set(e.from, [...(m.get(e.from) ?? []), e.to]);
    return m;
  }, [layout]);
  const parentsOf = (id: string) => layout.edges.filter((e) => e.to === id).map((e) => e.from);

  const onKey = (e: KeyboardEvent, id: string) => {
    const n = layout.nodes.get(id);
    if (!n) return;
    const layer = layout.layers[n.depth] ?? [];
    const i = layer.indexOf(id);
    let target: string | undefined;
    if (e.key === 'ArrowUp') target = parentsOf(id)[0];
    else if (e.key === 'ArrowDown') target = children.get(id)?.[0];
    else if (e.key === 'ArrowLeft') target = layer[i - 1];
    else if (e.key === 'ArrowRight') target = layer[i + 1];
    else if (e.key === 'Enter' || e.key === ' ') target = id;
    if (!target) return;
    e.preventDefault();
    onSelect(target);
    requestAnimationFrame(() => document.querySelector<SVGGElement>(`[data-node="${CSS.escape(target)}"]`)?.focus());
  };

  const r = compact ? 6 : 7.5;
  return (
    <svg className="graph" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label="Position graph">
      <g className="graph-edges">
        {layout.edges.map((e) => {
          const a = layout.nodes.get(e.from);
          const b = layout.nodes.get(e.to);
          if (!a || !b) return null;
          const my = (a.y + b.y) / 2;
          const merge = merges.has(e.to);
          return (
            <g key={e.id}>
              <path d={`M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`} className={merge ? 'edge edge-merge' : 'edge'} />
              <text x={(a.x + b.x) / 2} y={my + 4} className="edge-label" textAnchor="middle">
                {figurine(e.san)}
              </text>
            </g>
          );
        })}
      </g>
      {[...layout.nodes.values()].map((n) => {
        const pos = graph.positions[n.id];
        if (!pos) return null;
        const mine = pos.sideToMove === color && (children.get(n.id)?.length ?? 0) > 0;
        const h = heat(sched[cardId(color, n.id)], now);
        const isMerge = merges.has(n.id);
        const label = `${n.depth === 0 ? 'Start position' : `Position after ply ${n.depth}`}${mine ? `, your move, ${HEAT_LABEL[h]}` : ', opponent to move'}${isMerge ? ', transposition' : ''}`;
        return (
          <g
            key={n.id}
            data-node={n.id}
            className={`node${selected === n.id ? ' is-selected' : ''}`}
            transform={`translate(${n.x} ${n.y})`}
            tabIndex={selected === n.id || (!selected && n.depth === 0) ? 0 : -1}
            role="button"
            aria-label={label}
            aria-pressed={selected === n.id}
            onClick={() => onSelect(n.id)}
            onKeyDown={(e) => onKey(e, n.id)}
          >
            <circle r={16} className="node-hit" />
            {isMerge && <circle r={r + 5} className="node-merge" />}
            {selected === n.id && <circle r={r + (isMerge ? 9 : 5)} className="node-sel" />}
            {mine ? <circle r={r} className={`node-card heat-${h}`} /> : <circle r={n.depth === 0 ? r - 2 : 3.5} className="node-opp" />}
            {isMerge && !compact && (
              <text x={r + 12} y={4} className="node-note">
                transposition
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function HeatLegend() {
  return (
    <ul className="legend" aria-label="Legend">
      {(['new', 'fresh', 'soon', 'due', 'overdue'] as const).map((h) => (
        <li key={h}>
          <svg width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="6" className={`node-card heat-${h}`} />
          </svg>
          {HEAT_LABEL[h]}
        </li>
      ))}
      <li>
        <svg width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="3.5" className="node-opp" />
        </svg>
        Opponent to move
      </li>
      <li>
        <svg width="20" height="20" aria-hidden="true">
          <circle cx="10" cy="10" r="8.5" className="node-merge" />
          <circle cx="10" cy="10" r="4" className="node-card heat-fresh" />
        </svg>
        Transposition
      </li>
    </ul>
  );
}
