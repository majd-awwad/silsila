/**
 * Quick check: what the teacher should do next, from the class's own evidence. It answers three questions:
 * what to explain again, for which group, and which question or activity comes next. Nothing here is invented:
 * every line comes from the pack's authored text for the idea, gap or step that the learners' words showed.
 */
import { interventionGroups } from '../../../brain/classInsights';
import type { GroupKind } from '../../../brain/classInsights';
import { initialDiagnosis } from '../../../brain/records';
import type { L, LearnerRecord } from '../../../contracts';
import type { ConceptPack } from '../../../packs/types';

export interface DecisionItem {
  id: string;
  kind: GroupKind;
  /** what this group needs */
  title: L;
  /** aliases (private to the teacher) */
  members: string[];
  /** what to do with them */
  move: L;
  /** a question to ask next (the prediction question of the experiment that tests their idea) */
  question: L | null;
  /** the activity that tests it, only a suggestion */
  activity: L | null;
}

export interface QuickDecision {
  explained: number;
  total: number;
  waiting: number;
  items: DecisionItem[];
  /** the one-line answer: what to explain again and for whom; null when nobody needs it */
  headline: { what: L; count: number; next: L | null } | null;
}

const NEEDS_HELP: GroupKind[] = ['gap', 'idea', 'clarify', 'followup'];

export function quickDecision(pack: ConceptPack, records: LearnerRecord[]): QuickDecision {
  const mine = records.filter((r) => r.pack === pack.id);
  const explained = mine.filter((r) => initialDiagnosis(r)).length;
  const alias = new Map(mine.map((r) => [r.id, r.alias]));
  const items: DecisionItem[] = interventionGroups(pack, mine).map((g) => {
    const x = g.experimentId ? pack.experiments.find((e) => e.id === g.experimentId) ?? null : null;
    return {
      id: g.id, kind: g.kind, title: g.title, members: g.members.map((id) => alias.get(id) ?? ''), move: g.move,
      question: x?.question ?? null, activity: x?.name ?? null,
    };
  });
  const top = items.filter((i) => NEEDS_HELP.includes(i.kind)).sort((a, b) => b.members.length - a.members.length)[0];
  return {
    explained, total: mine.length, waiting: mine.length - explained, items,
    headline: top ? { what: top.title, count: top.members.length, next: top.question ?? top.move } : null,
  };
}
