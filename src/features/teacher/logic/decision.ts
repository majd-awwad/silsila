/**
 * Quick check: what the teacher should do next, from the class's own evidence. It answers three questions:
 * what to explain again, for which group, and which question or activity comes next. Nothing here is invented:
 * every line comes from the pack's authored text for the idea, gap or step that the learners' words showed.
 */
import { interventionGroups } from '../../../brain/classInsights';
import type { GroupKind } from '../../../brain/classInsights';
import { initialDiagnosis } from '../../../brain/records';
import { compare, conditionsFor } from '../../../brain/world';
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
  /**
   * the one-line answer: what to explain again and for whom; null when nobody needs it.
   * `tied` lists every group when several are equally big: the teacher chooses, nothing is picked at random.
   */
  headline: { what: L; count: number; next: L | null; tied: DecisionItem[] } | null;
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
  const needs = items.filter((i) => NEEDS_HELP.includes(i.kind));
  const most = Math.max(0, ...needs.map((i) => i.members.length));
  const tied = needs.filter((i) => i.members.length === most);
  let headline: QuickDecision['headline'] = null;
  if (tied.length === 1) headline = { what: tied[0].title, count: most, next: tied[0].question ?? tied[0].move, tied: [] };
  else if (tied.length > 1) {
    headline = {
      what: { ar: 'تعادل: ' + tied.map((i) => i.title.ar).join(' · '), en: 'A tie: ' + tied.map((i) => i.title.en).join(' · ') },
      count: most, next: sharedQuestion(pack, tied), tied,
    };
  }
  return { explained, total: mine.length, waiting: mine.length - explained, items, headline };
}

/** One experiment's question that challenges every tied idea together, when the pack has such an experiment. */
function sharedQuestion(pack: ConceptPack, tied: DecisionItem[]): L | null {
  const ideas = tied.map((i) => (i.id.startsWith('idea:') ? pack.ideas[i.id.slice(5)] : null));
  if (ideas.some((i) => !i)) return null;
  const x = pack.experiments.find((e) => ideas.every((i) => compare(pack, i!.model, conditionsFor(pack, e.change)).contradicted));
  return x?.question ?? null;
}
