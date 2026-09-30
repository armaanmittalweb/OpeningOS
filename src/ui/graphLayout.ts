import type { NativeRepertoireGraph } from '../domain/graph';

export interface LaidNode {
  id: string;
  x: number;
  y: number;
  depth: number;
}
export interface LaidEdge {
  id: string;
  from: string;
  to: string;
  san: string;
}
export interface Layout {
  nodes: Map<string, LaidNode>;
  edges: LaidEdge[];
  layers: string[][];
  width: number;
  height: number;
}

/**
 * Layered layout, top to bottom by ply. Within a layer, nodes sit at the mean
 * x of their parents (barycentre) and are then pushed apart to a minimum gap,
 * which keeps branches under their parents and makes merges easy to see.
 */
export function layoutGraph(g: NativeRepertoireGraph, opts: { gap?: number; row?: number; pad?: number } = {}): Layout {
  const gap = opts.gap ?? 76;
  const row = opts.row ?? 70;
  const pad = opts.pad ?? 40;
  const depthOf = (id: string) => {
    const d = g.positions[id]?.metadata?.depth;
    return typeof d === 'number' ? d : 0;
  };
  const parents = new Map<string, string[]>();
  const edges: LaidEdge[] = Object.values(g.move_edges).map((e) => {
    parents.set(e.toPositionId, [...(parents.get(e.toPositionId) ?? []), e.fromPositionId]);
    return { id: e.id, from: e.fromPositionId, to: e.toPositionId, san: e.san };
  });

  const layers: string[][] = [];
  for (const id of Object.keys(g.positions)) (layers[depthOf(id)] ??= []).push(id);
  const x = new Map<string, number>();

  layers.forEach((layer, d) => {
    if (!layer) {
      layers[d] = [];
      return;
    }
    const want = new Map<string, number>();
    for (const id of layer) {
      const px = (parents.get(id) ?? []).map((p) => x.get(p)).filter((v): v is number => v !== undefined);
      want.set(id, px.length ? px.reduce((a, b) => a + b, 0) / px.length : 0);
    }
    layer.sort((a, b) => (want.get(a) ?? 0) - (want.get(b) ?? 0) || a.localeCompare(b));
    // Sweep to enforce the gap, then re-centre on the barycentre mean.
    const pos: number[] = [];
    layer.forEach((id, i) => {
      const w = want.get(id) ?? 0;
      pos.push(i === 0 ? w : Math.max(w, (pos[i - 1] ?? 0) + gap));
    });
    const shift = layer.reduce((s, id, i) => s + ((want.get(id) ?? 0) - (pos[i] ?? 0)), 0) / layer.length;
    layer.forEach((id, i) => x.set(id, (pos[i] ?? 0) + shift));
  });

  const xs = [...x.values()];
  const minX = Math.min(0, ...xs);
  const maxX = Math.max(0, ...xs);
  const nodes = new Map<string, LaidNode>();
  layers.forEach((layer, d) =>
    layer.forEach((id) => nodes.set(id, { id, depth: d, x: (x.get(id) ?? 0) - minX + pad, y: d * row + pad })),
  );
  return { nodes, edges, layers, width: maxX - minX + pad * 2, height: Math.max(0, layers.length - 1) * row + pad * 2 };
}
