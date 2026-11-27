/**
 * The teacher's intervention board for one room: it starts from the evidence-based suggestion
 * (interventionGroups) and becomes the teacher's own as soon as they edit it. Groups are temporary, live on this
 * device only, and are never ability labels.
 */
import type { InterventionGroup, GroupKind } from '../../../brain/classInsights';
import type { L } from '../../../contracts';
import { isObject, isStringList, readStored, removeStored, shortId, writeStored } from './storage';

export interface TeamGroup {
  id: string;
  kind: GroupKind | 'custom';
  title: L;
  /** what the teacher does with this group */
  move: L;
  experimentId: string | null;
  /** learner ids, each learner in at most one group */
  members: string[];
}

export interface GroupBoard {
  groups: TeamGroup[];
  edited: boolean;
  /** the suggestion the board started from, to notice when new evidence changes it */
  signature: string;
}

export const signatureOf = (suggested: InterventionGroup[]): string =>
  suggested.map((g) => `${g.id}:${[...g.members].sort().join(',')}`).sort().join('|');

export const boardFrom = (suggested: InterventionGroup[]): GroupBoard => ({
  groups: suggested.map((g) => ({ ...g, members: [...g.members] })),
  edited: false,
  signature: signatureOf(suggested),
});

/** Drops learners who left and any duplicate membership (first group wins). */
export function prune(board: GroupBoard, learnerIds: string[]): GroupBoard {
  const valid = new Set(learnerIds);
  const seen = new Set<string>();
  return {
    ...board,
    groups: board.groups.map((g) => ({ ...g, members: g.members.filter((m) => valid.has(m) && !seen.has(m) && !!seen.add(m)) })),
  };
}

/** Untouched boards follow the evidence; edited boards stay as the teacher left them. */
export const currentBoard = (saved: GroupBoard | null, suggested: InterventionGroup[], learnerIds: string[]): GroupBoard =>
  saved?.edited ? prune(saved, learnerIds) : boardFrom(suggested);

export const isOutdated = (board: GroupBoard, suggested: InterventionGroup[]): boolean =>
  board.edited && board.signature !== signatureOf(suggested);

export const unassigned = (board: GroupBoard, learnerIds: string[]): string[] => {
  const placed = new Set(board.groups.flatMap((g) => g.members));
  return learnerIds.filter((id) => !placed.has(id));
};

const edit = (board: GroupBoard, groups: TeamGroup[]): GroupBoard => ({ ...board, groups, edited: true });

/** Move a learner to a group, or out of every group with null. Unknown targets change nothing. */
export function moveLearner(board: GroupBoard, learnerId: string, groupId: string | null): GroupBoard {
  if (groupId !== null && !board.groups.some((g) => g.id === groupId)) return board;
  return edit(board, board.groups.map((g) => {
    const without = g.members.filter((m) => m !== learnerId);
    return { ...g, members: g.id === groupId ? [...without, learnerId] : without };
  }));
}

const NAME_LIMIT = 80;
const MOVE_LIMIT = 400;

export function renameGroup(board: GroupBoard, groupId: string, name: string): GroupBoard {
  const text = name.slice(0, NAME_LIMIT);
  return edit(board, board.groups.map((g) => (g.id === groupId ? { ...g, title: { ar: text, en: text } } : g)));
}

export function setMove(board: GroupBoard, groupId: string, move: string): GroupBoard {
  const text = move.slice(0, MOVE_LIMIT);
  return edit(board, board.groups.map((g) => (g.id === groupId ? { ...g, move: { ar: text, en: text } } : g)));
}

export function addGroup(board: GroupBoard, name: L, id = `custom:${shortId()}`): GroupBoard {
  return edit(board, [...board.groups, { id, kind: 'custom', title: name, move: { ar: '', en: '' }, experimentId: null, members: [] }]);
}

/** Its learners become unassigned; nobody is moved silently into another group. */
export const removeGroup = (board: GroupBoard, groupId: string): GroupBoard => edit(board, board.groups.filter((g) => g.id !== groupId));

/* ───────── on this device ───────── */

/** Keyed by creation time too, so a reset sample classroom (or a reused code) starts clean. */
export const boardKey = (code: string, createdAt: number): string => `silsila-groups-${code}-${createdAt}`;

const isL = (x: unknown): x is L => isObject(x) && typeof x.ar === 'string' && typeof x.en === 'string';

export function parseBoard(raw: unknown): GroupBoard | null {
  if (!isObject(raw) || !Array.isArray(raw.groups) || typeof raw.signature !== 'string') return null;
  const groups: TeamGroup[] = [];
  for (const g of raw.groups as unknown[]) {
    if (!isObject(g) || typeof g.id !== 'string' || typeof g.kind !== 'string' || !isL(g.title) || !isL(g.move) || !isStringList(g.members)) return null;
    groups.push({
      id: g.id, kind: g.kind as TeamGroup['kind'], title: g.title, move: g.move,
      experimentId: typeof g.experimentId === 'string' ? g.experimentId : null, members: g.members,
    });
  }
  return { groups, edited: raw.edited === true, signature: raw.signature };
}

export const loadBoard = (key: string): GroupBoard | null => parseBoard(readStored(key));
export const saveBoard = (key: string, board: GroupBoard): boolean => writeStored(key, board);
export const clearBoard = (key: string): void => removeStored(key);
