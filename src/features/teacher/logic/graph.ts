/** Lays a pack's concept graph out in columns: each concept sits after everything it builds on. */
import type { ChainId } from '../../../contracts';
import { CHAIN_IDS } from '../../../contracts';
import type { ConceptPack } from '../../../packs/types';

export interface GraphNode { id: ChainId; col: number; row: number }
export interface GraphLayout {
  nodes: GraphNode[];
  /** from the foundation to the concept that needs it */
  edges: { from: ChainId; to: ChainId }[];
  cols: number;
  rows: number;
}

export function conceptLayout(concepts: ConceptPack['concepts']): GraphLayout {
  const depth = new Map<ChainId, number>();
  // longest path to a root; `seen` guards against a cycle in authored data
  const depthOf = (id: ChainId, seen: Set<ChainId>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const needs = (concepts[id]?.needs ?? []).filter((n) => n !== id && concepts[n]);
    const d = needs.length ? 1 + Math.max(...needs.map((n) => depthOf(n, seen))) : 0;
    seen.delete(id);
    depth.set(id, d);
    return d;
  };
  const ids = CHAIN_IDS.filter((id) => concepts[id]);
  const used = new Map<number, number>();
  const nodes = ids.map((id) => {
    const col = depthOf(id, new Set());
    const row = used.get(col) ?? 0;
    used.set(col, row + 1);
    return { id, col, row };
  });
  const edges = ids.flatMap((to) => concepts[to].needs.filter((n) => n !== to && concepts[n]).map((from) => ({ from, to })));
  return {
    nodes, edges,
    cols: nodes.length ? Math.max(...nodes.map((n) => n.col)) + 1 : 0,
    rows: used.size ? Math.max(...used.values()) : 0,
  };
}
