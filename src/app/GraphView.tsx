import { useEffect, useState } from 'react';
import { incoming, outgoing, transpositionIds } from '../domain/repertoire';
import { formatInterval, heat } from '../domain/fsrs';
import { cardId } from '../domain/repertoire';
import { store, useDerived, useStore } from '../lib/store';
import { Board } from '../ui/Board';
import { EngineStrip } from '../ui/EngineStrip';
import { GraphCanvas, HEAT_LABEL, HeatLegend } from '../ui/GraphCanvas';
import { figurine, MoveText } from '../ui/notation';
import { builder, useBuilder } from './builder';
import { navigate } from './router';

export function GraphView() {
  const b = useBuilder();
  const lines = useStore((s) => s.data.lines);
  const sched = useStore((s) => s.data.cards);
  const { graphs, cards } = useDerived();
  const g = graphs[b.color];
  const start = Object.keys(g.positions)[0] ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected && g.positions[selected] ? selected : start;
  const merges = transpositionIds(g);

  useEffect(() => setSelected(null), [b.color]);

  const node = sel ? g.positions[sel] : undefined;
  const card = cards.find((c) => sel && c.id === cardId(b.color, sel));
  const orders = sel ? incoming(g, sel) : [];
  const pathsTo = sel
    ? Object.values(g.line_paths)
        .map((p) => {
          const i = p.nodeIds.indexOf(sel);
          return i < 0 ? null : p.edgeIds.slice(0, i).map((id) => g.move_edges[id]?.san ?? '');
        })
        .filter((p): p is string[] => !!p)
        .filter((p, i, all) => all.findIndex((q) => q.join(' ') === p.join(' ')) === i)
    : [];
  const s = card ? sched[card.id] : undefined;

  const hasLines = lines.some((l) => l.color === b.color);

  return (
    <div className="table table-wide">
      <section className="table-board" aria-label="Board">
        <Board fen={node?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} orientation={b.color} label="Selected position" />
        {node && (
          <div className="node-detail fade-in" key={sel}>
            {merges.has(sel ?? '') ? (
              <p>
                <strong>One position, {pathsTo.length} move orders.</strong> These lines transpose into the same node, so you only practise it once.
              </p>
            ) : null}
            {pathsTo.slice(0, 4).map((p) => (
              <MoveText key={p.join(' ')} moves={p} className="is-small" />
            ))}
            {card && (
              <p className="meta">
                Your move: {card.expected.map(figurine).join(', ')} · {HEAT_LABEL[heat(s)]}
                {s?.reps ? ` · interval ${formatInterval(s.scheduledDays ?? 0)}` : ''}
              </p>
            )}
            {!card && node && outgoing(g, node.id).length > 0 && <p className="meta">Opponent to move · {outgoing(g, node.id).length} prepared {outgoing(g, node.id).length === 1 ? 'reply' : 'replies'}</p>}
            <button
              type="button"
              className="link"
              onClick={() => {
                builder.load(pathsTo[0] ?? [], b.color);
                navigate('repertoire');
              }}
            >
              Open in the builder
            </button>
            {orders.length > 1 && <span className="sr-only">Reached from {orders.length} parent positions.</span>}
          </div>
        )}
        <EngineStrip fen={node?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} />
      </section>
      <section className="table-page" aria-labelledby="graph-title">
        <div className="page-head">
          <div className="seg" role="group" aria-label="Repertoire colour">
            {(['w', 'b'] as const).map((c) => (
              <button key={c} type="button" aria-pressed={b.color === c} onClick={() => builder.setColor(c)}>
                {c === 'w' ? 'White' : 'Black'}
              </button>
            ))}
          </div>
          <p className="meta">
            {Object.keys(g.positions).length} positions · {merges.size} {merges.size === 1 ? 'transposition' : 'transpositions'}
          </p>
        </div>
        <h1 id="graph-title" className="display">
          Position graph
        </h1>
        {hasLines ? (
          <>
            <p className="lede">Every node is a position, not a move order. Where two lines reach the same position, they merge.</p>
            <div className="graph-scroll" tabIndex={-1}>
              <GraphCanvas graph={g} color={b.color} sched={sched} selected={sel} onSelect={setSelected} />
            </div>
            <HeatLegend />
          </>
        ) : (
          <div className="empty">
            <p className="title">Nothing to draw yet.</p>
            <p className="lede">Add a few lines and they will appear here as a graph. Try 1.e4 e5 2.Nf3 and then 1.Nf3 e5 2.e4: both land on one node.</p>
            <div className="row">
              <button type="button" className="btn" onClick={() => store.loadDemo()}>
                Load the Italian Game demo
              </button>
              <button type="button" className="link" onClick={() => navigate('repertoire')}>
                Build a line
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
