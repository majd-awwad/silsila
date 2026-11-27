/** Geometry for the two class pictures: the idea map (a ring around the question) and the before→after flow. */
import { orderKeys } from '../logic/labels';

/* ───────── idea map ───────── */

export interface Point { x: number; y: number }

/** Above this many groups the ring would overlap, so the map falls back to a linked list. */
export const RING_LIMIT = 8;

/** Evenly spaced positions (percent of the canvas) around the centre, starting at the top. */
export function ringPositions(count: number, rx = 36, ry = 34): Point[] {
  if (count <= 0) return [];
  const start = count === 2 ? 180 : count === 4 ? -135 : -90;
  return Array.from({ length: count }, (_, i) => {
    const a = ((start + (360 / count) * i) * Math.PI) / 180;
    return { x: Math.round((50 + rx * Math.cos(a)) * 10) / 10, y: Math.round((50 + ry * Math.sin(a)) * 10) / 10 };
  });
}

/** Diameter of a group's bead: its area grows with the number of learners. */
export const beadSize = (count: number, max: number, smallest = 44, largest = 96): number =>
  Math.round(smallest + (largest - smallest) * Math.sqrt(Math.max(0, count) / Math.max(1, max)));

/* ───────── flow ───────── */

export interface Move { from: string; to: string; count: number }
export interface FlowNode { key: string; count: number; y0: number; y1: number }
export interface FlowLink {
  from: string; to: string; count: number;
  /** vertical extent at the starting and the arriving side */
  s0: number; s1: number; t0: number; t1: number;
}
export interface FlowLayout { height: number; from: FlowNode[]; to: FlowNode[]; links: FlowLink[]; total: number }

function side(moves: Move[], pick: 'from' | 'to'): { key: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const m of moves) totals.set(m[pick], (totals.get(m[pick]) ?? 0) + m.count);
  return [...totals.entries()].map(([key, count]) => ({ key, count })).sort(orderKeys);
}

/**
 * Node heights are proportional to learners (never smaller than `minNode`, so labels stay readable) and every
 * ribbon's thickness is proportional to the learners it carries. Totals are exactly the counts given.
 */
export function flowLayout(moves: Move[], options: { height: number; gap?: number; minNode?: number }): FlowLayout {
  const gap = options.gap ?? 14;
  const minNode = options.minNode ?? 44;
  const valid = moves.filter((m) => m.count > 0);
  const total = valid.reduce((s, m) => s + m.count, 0);
  if (!total) return { height: 0, from: [], to: [], links: [], total: 0 };
  const left = side(valid, 'from');
  const right = side(valid, 'to');
  const unit = Math.max(0, Math.min(...[left, right].map((s) => (options.height - gap * (s.length - 1)) / total)));
  const heightOf = (s: { count: number }[]) => s.reduce((h, n) => h + Math.max(minNode, n.count * unit), 0) + gap * (s.length - 1);
  const height = Math.max(options.height, heightOf(left), heightOf(right));
  const stack = (s: { key: string; count: number }[]): FlowNode[] => {
    let y = (height - heightOf(s)) / 2;
    return s.map((n) => {
      const h = Math.max(minNode, n.count * unit);
      const node = { ...n, y0: y, y1: y + h };
      y += h + gap;
      return node;
    });
  };
  const from = stack(left);
  const to = stack(right);
  const index = (nodes: FlowNode[], key: string) => nodes.findIndex((n) => n.key === key);
  // ribbons leave and arrive in the order of the opposite side, so they cross as little as possible
  const ordered = [...valid].sort((a, b) => index(from, a.from) - index(from, b.from) || index(to, a.to) - index(to, b.to));
  const cursor = (nodes: FlowNode[]) => new Map(nodes.map((n) => [n.key, n.y0 + (n.y1 - n.y0 - n.count * unit) / 2]));
  const sourceAt = cursor(from);
  const targetAt = cursor(to);
  const links = ordered.map((m) => {
    const s0 = sourceAt.get(m.from)!;
    const t0 = targetAt.get(m.to)!;
    sourceAt.set(m.from, s0 + m.count * unit);
    targetAt.set(m.to, t0 + m.count * unit);
    return { ...m, s0, s1: s0 + m.count * unit, t0, t1: t0 + m.count * unit };
  });
  return { height, from, to, links, total };
}

const f = (v: number) => Math.round(v * 10) / 10;

/** A filled ribbon between x = `sx` and x = `tx` (physical coordinates, so right-to-left is just a swap). */
export function ribbonPath(l: FlowLink, sx: number, tx: number): string {
  const mid = f((sx + tx) / 2);
  return `M${f(sx)} ${f(l.s0)}C${mid} ${f(l.s0)} ${mid} ${f(l.t0)} ${f(tx)} ${f(l.t0)}L${f(tx)} ${f(l.t1)}C${mid} ${f(l.t1)} ${mid} ${f(l.s1)} ${f(sx)} ${f(l.s1)}Z`;
}

/** The path one learner's dot travels: `at` is its place (0..1) across the ribbon's thickness. */
export function laneAt(l: FlowLink, at: number, sx: number, tx: number): string {
  const s = f(l.s0 + (l.s1 - l.s0) * at);
  const t = f(l.t0 + (l.t1 - l.t0) * at);
  const mid = f((sx + tx) / 2);
  return `M${f(sx)} ${s}C${mid} ${s} ${mid} ${t} ${f(tx)} ${t}`;
}
