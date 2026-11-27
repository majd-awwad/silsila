/**
 * Pure readings of a class used by the control room and the projector: prediction tallies, how ideas moved
 * between the first and the revised explanation, and discussion prompts. Counts only what happened.
 */
import type { Aggregates, ChildModel, Lang, LearnerRecord, Phase } from '../../../contracts';
import { PHASES } from '../../../contracts';
import { atLeast, phaseIndex } from '../../../brain/room';
import { eventsOf } from '../../../brain/records';
import { correctIdeaId } from '../../../brain/normalise';
import type { ConceptPack } from '../../../packs/types';
import { groupShape, groupTitle, tr } from './labels';

/* ───────── phases ───────── */

export const nextPhase = (p: Phase): Phase | null => PHASES[phaseIndex(p) + 1] ?? null;
export const prevPhase = (p: Phase): Phase | null => PHASES[phaseIndex(p) - 1] ?? null;

/** The server refuses predict…discuss until the teacher has approved an experiment. */
export const needsExperiment = (p: Phase): boolean => atLeast(p, 'predict') && !atLeast(p, 'revise');

export interface Advance {
  target: Phase | null;
  /** the target cannot be entered yet */
  blocked: 'experiment' | null;
  /** learners who have not done the current phase's task */
  waiting: number;
}

export interface Counts { participants: number; explained: number; predicted: number; revised: number; transferred: number }

export function advanceFrom(phase: Phase, hasExperiment: boolean, c: Counts): Advance {
  const target = nextPhase(phase);
  const done = phase === 'explain' ? c.explained : phase === 'predict' ? c.predicted : phase === 'revise' ? c.revised : phase === 'transfer' ? c.transferred : null;
  return {
    target,
    blocked: target && needsExperiment(target) && !hasExperiment ? 'experiment' : null,
    waiting: done === null ? 0 : Math.max(0, c.participants - done),
  };
}

export type RoomTab = 'map' | 'plan' | 'test' | 'change' | 'learners' | 'gaps' | 'groups' | 'activity';

/** Where the teacher's attention belongs when the class moves to this phase. */
export function tabForPhase(p: Phase): RoomTab {
  if (!atLeast(p, 'recommend')) return 'map';
  if (!atLeast(p, 'predict')) return 'plan';
  if (!atLeast(p, 'revise')) return 'test';
  return 'change';
}

/* ───────── predictions ───────── */

/** Every choice of the experiment with how many learners locked it (zero included). */
export function predictionTally(pack: ConceptPack, records: LearnerRecord[], experimentId: string): { outcome: string; count: number }[] {
  const x = pack.experiments.find((e) => e.id === experimentId);
  const counts = new Map<string, number>((x?.choices ?? []).map((c) => [c, 0]));
  for (const r of records) {
    const p = eventsOf(r, 'predict').filter((e) => e.experimentId === experimentId).at(-1);
    if (p) counts.set(p.outcome, (counts.get(p.outcome) ?? 0) + 1);
  }
  return [...counts.entries()].map(([outcome, count]) => ({ outcome, count }));
}

/** The hypothesis to draw for a group, composed the same way the diagnosis composes it. */
export function modelForGroup(pack: ConceptPack, key: string, ideas: string[] = []): ChildModel | null {
  const shape = groupShape(key);
  if (shape === 'real' || shape === 'partial') return pack.correctModel;
  if (shape !== 'idea') return null;
  const ids = (ideas.length ? ideas : key.split('+')).filter((id) => pack.ideas[id] && !pack.ideas[id].correct);
  const parts = ids.slice(0, 2).map((id) => pack.ideas[id].model);
  if (!parts.length) return null;
  return {
    sources: [...new Set(parts.flatMap((m) => m.sources))].slice(0, 2),
    path: parts[0].path,
    requires: [...new Set(parts.flatMap((m) => m.requires))].slice(0, 3),
  };
}

/* ───────── before → after ───────── */

export type Change = 'reached' | 'kept' | 'partial' | 'persisting' | 'new_idea' | 'unresolved' | 'waiting';

/** How one learner's group moved between the first and the revised explanation. */
export function classifyChange(from: string, to: string): Change {
  const target = groupShape(to);
  if (target === 'waiting') return 'waiting';
  if (target === 'real') return from === 'correct' ? 'kept' : 'reached';
  if (target === 'partial') return 'partial';
  if (target === 'idea') {
    const before = groupShape(from) === 'idea' ? from.split('+') : [];
    return to.split('+').some((id) => before.includes(id)) ? 'persisting' : 'new_idea';
  }
  return 'unresolved';
}

export const CHANGE_ORDER: Change[] = ['reached', 'kept', 'partial', 'persisting', 'new_idea', 'unresolved', 'waiting'];

export const CHANGE_LABEL: Record<Change, { ar: string; en: string }> = {
  reached: { ar: 'وصلوا لشرح كامل', en: 'Reached a complete explanation' },
  kept: { ar: 'كان شرحهم كامل وضلّ', en: 'Complete before and after' },
  partial: { ar: 'شرح جزئي هلأ', en: 'Partial explanation now' },
  persisting: { ar: 'نفس الفكرة لسا موجودة', en: 'Same idea still present' },
  new_idea: { ar: 'فكرة ثانية بدها اختبار', en: 'A different idea to investigate' },
  unresolved: { ar: 'لسا مش واضح', en: 'Unresolved' },
  waiting: { ar: 'ما شرحوا من جديد', en: 'No revised explanation' },
};

export type ChangeTotals = Record<Change, number> & { total: number; revised: number };

export function changeTotals(transitions: NonNullable<Aggregates['transitions']>): ChangeTotals {
  const out: ChangeTotals = { reached: 0, kept: 0, partial: 0, persisting: 0, new_idea: 0, unresolved: 0, waiting: 0, total: 0, revised: 0 };
  for (const t of transitions) {
    const change = classifyChange(t.from, t.to);
    out[change] += t.count;
    out.total += t.count;
    if (change !== 'waiting') out.revised += t.count;
  }
  return out;
}

/* ───────── discussion ───────── */

export interface Prompt {
  key: string;
  title: string;
  contradicted: boolean | null;
  learners: number;
  question: string;
  /** a concrete move for the teacher (authored pack text) */
  move: string | null;
  quotes: string[];
}

/**
 * Questions that ask each group to connect its idea to what was observed. Before a result exists they ask for
 * evidence only, so nothing about the outcome is given away.
 */
export function discussionPrompts(
  pack: ConceptPack, groups: Aggregates['groups'], result: Aggregates['result'], lang: Lang,
): Prompt[] {
  const correct = correctIdeaId(pack);
  const outcome = (id: string) => pack.outcomes[id]?.[lang] ?? id;
  return (groups ?? []).filter((g) => g.key !== 'waiting').map((g) => {
    const found = result?.byGroup.find((x) => x.key === g.key) ?? null;
    const idea = g.ideas.filter((id) => id !== correct).map((id) => pack.ideas[id]).find(Boolean);
    let question: string;
    if (found && result) {
      question = found.contradicted
        ? tr(lang, `الفكرة توقّعت «${outcome(found.outcome)}» وشفنا «${outcome(result.outcome)}». شو لازم يتغيّر بالفكرة عشان تفسّر اللي صار؟`,
          `The idea predicted “${outcome(found.outcome)}” and we saw “${outcome(result.outcome)}”. What would the idea need to change to explain it?`)
        : tr(lang, `الفكرة صمدت بهالتجربة. أي جزء من الشرح توقّع «${outcome(result.outcome)}»؟ وهل في تجربة ممكن تتحدّاها؟`,
          `The idea held in this test. Which part of the explanation predicted “${outcome(result.outcome)}”? Is there a test that could challenge it?`);
    } else {
      question = tr(lang, 'شو الدليل اللي خلّاكم تفكّروا هيك؟ وكيف ممكن نتأكّد؟', 'What evidence made you think this? How could we check it?');
    }
    return {
      key: g.key,
      title: groupTitle(pack, g.key)[lang],
      contradicted: found ? found.contradicted : null,
      learners: g.count,
      question,
      move: idea ? idea.intervention[lang] : null,
      quotes: g.quotes,
    };
  });
}

export const closingQuestion = (lang: Lang): string =>
  tr(lang, 'أي فكرة بتفسّر كل اللي شفناه؟ وليش؟', 'Which idea explains everything we have seen, and why?');
