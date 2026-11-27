/** Small, pure readers of a learner's event log, shared by the lesson, the classroom and the teacher screens. */
import type { Diagnosis, EventOf, Lang, LearnerEvent, LearnerRecord } from '../contracts';
import type { ConceptPack } from '../packs/types';
import type { Hypothesis } from './planner';
import { correctIdeaId } from './normalise';
import { getPack } from '../packs';

export function newRecord(input: { id: string; pack: string; alias: string; grade: number; lang: Lang; classCode?: string | null; sample?: boolean; at?: number }): LearnerRecord {
  return {
    id: input.id, pack: input.pack, alias: input.alias, grade: input.grade, lang: input.lang,
    startedAt: input.at ?? Date.now(), finishedAt: null, classCode: input.classCode ?? null, sample: input.sample ?? false, events: [],
  };
}

export const addEvent = (r: LearnerRecord, e: LearnerEvent): LearnerRecord => ({ ...r, events: [...r.events, e].slice(-200) });

export const eventsOf = <T extends LearnerEvent['type']>(r: LearnerRecord, type: T): EventOf<T>[] =>
  r.events.filter((e): e is EventOf<T> => e.type === type);

export const lastEvent = <T extends LearnerEvent['type']>(r: LearnerRecord, type: T): EventOf<T> | null => eventsOf(r, type).at(-1) ?? null;

/**
 * The diagnosis the teacher chose, built from the automatic one. The words, evidence and source stay the learner's;
 * only the classification (status, idea, model, chain) changes.
 */
export function reviewedDiagnosis(d: Diagnosis, review: EventOf<'review'>): Diagnosis {
  const pack = getPack(d.pack);
  const correct = correctIdeaId(pack);
  const lang = d.lang;
  const keep = d.ideas[0]?.evidence ?? '';
  if (review.outcome === 'unclear') return { ...d, status: 'insufficient', ideas: [], rejected: [], model: null, chain: [], wrongStep: null, caption: '', evidence: 'none' };
  if (review.outcome === 'correct' || review.outcome === 'partial') {
    return {
      ...d, status: review.outcome, ideas: [{ id: correct, evidence: keep }], rejected: [], model: pack.correctModel,
      chain: review.outcome === 'correct' ? pack.steps.map((s) => s.text[lang]) : d.chain, wrongStep: null, caption: pack.ideas[correct].mirror[lang], evidence: 'clear',
    };
  }
  const idea = review.ideaId && pack.ideas[review.ideaId] && review.ideaId !== correct ? pack.ideas[review.ideaId] : null;
  if (!idea || !review.ideaId) return d;
  return {
    ...d, status: 'misconception', ideas: [{ id: review.ideaId, evidence: keep }], rejected: [], model: idea.model,
    chain: idea.story.map((s) => s[lang]), wrongStep: idea.wrongStep, caption: idea.mirror[lang], evidence: 'clear',
  };
}

/** The latest teacher review recorded after this explanation event, if any (by position, so same-tick events keep their order). */
export const reviewOf = (r: LearnerRecord, explain: EventOf<'explain'>): EventOf<'review'> | null =>
  r.events.slice(r.events.indexOf(explain) + 1).filter((e): e is EventOf<'review'> => e.type === 'review').at(-1) ?? null;

/** The learner's starting explanation (after any clarification, before any experiment), with the teacher's correction applied. */
export const initialDiagnosis = (r: LearnerRecord): Diagnosis | null => {
  const e = eventsOf(r, 'explain').filter((x) => x.phase !== 'revise').at(-1);
  if (!e) return null;
  const review = reviewOf(r, e);
  return review ? reviewedDiagnosis(e.diagnosis, review) : e.diagnosis;
};

/** The automatic diagnosis of the starting explanation, as the system produced it. */
export const autoInitialDiagnosis = (r: LearnerRecord): Diagnosis | null =>
  eventsOf(r, 'explain').filter((e) => e.phase !== 'revise').at(-1)?.diagnosis ?? null;

export const revisedDiagnosis = (r: LearnerRecord): Diagnosis | null =>
  eventsOf(r, 'explain').filter((e) => e.phase === 'revise').at(-1)?.diagnosis ?? null;

export const latestDiagnosis = (r: LearnerRecord): Diagnosis | null => {
  const e = lastEvent(r, 'explain');
  if (!e) return null;
  if (e.phase === 'revise') return e.diagnosis;
  const review = reviewOf(r, e);
  return review ? reviewedDiagnosis(e.diagnosis, review) : e.diagnosis;
};

export type GroupKey = 'correct' | 'partial' | 'contradictory' | 'unclear' | 'waiting' | string;

/** Learners with the same key share a hypothesis. Wrong ideas are keyed by their idea ids joined with «+». */
export function groupKey(pack: ConceptPack, d: Diagnosis | null): GroupKey {
  if (!d) return 'waiting';
  if (d.status === 'correct') return 'correct';
  if (d.status === 'partial') return 'partial';
  if (d.status === 'contradictory') return 'contradictory';
  if (d.status === 'misconception' || d.status === 'multiple') {
    const correct = correctIdeaId(pack);
    return d.ideas.map((i) => i.id).filter((id) => id !== correct).sort().join('+');
  }
  return 'unclear';
}

/** The hypotheses a planner needs, from each learner's latest (or initial) explanation. */
export function hypothesesOf(pack: ConceptPack, records: LearnerRecord[], which: 'initial' | 'latest' = 'latest'): Hypothesis[] {
  const out = new Map<string, Hypothesis>();
  for (const r of records) {
    const d = which === 'initial' ? initialDiagnosis(r) : latestDiagnosis(r);
    if (!d) continue;
    const key = groupKey(pack, d);
    const existing = out.get(key);
    if (existing) { existing.learners++; continue; }
    const correct = correctIdeaId(pack);
    const ideas = key === 'correct' || key === 'partial' ? [correct] : d.model ? d.ideas.map((i) => i.id).filter((id) => id !== correct) : [];
    out.set(key, { key, ideas, model: d.model, learners: 1 });
  }
  return [...out.values()].sort((a, b) => b.learners - a.learners);
}
