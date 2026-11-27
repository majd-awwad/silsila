/** Small, pure readers of a learner's event log, shared by the lesson, the classroom and the teacher screens. */
import type { Diagnosis, EventOf, Lang, LearnerEvent, LearnerRecord } from '../contracts';
import type { ConceptPack } from '../packs/types';
import type { Hypothesis } from './planner';
import { correctIdeaId } from './normalise';

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

/** The learner's starting explanation (after any clarification, before any experiment). */
export const initialDiagnosis = (r: LearnerRecord): Diagnosis | null =>
  eventsOf(r, 'explain').filter((e) => e.phase !== 'revise').at(-1)?.diagnosis ?? null;

export const revisedDiagnosis = (r: LearnerRecord): Diagnosis | null =>
  eventsOf(r, 'explain').filter((e) => e.phase === 'revise').at(-1)?.diagnosis ?? null;

export const latestDiagnosis = (r: LearnerRecord): Diagnosis | null => lastEvent(r, 'explain')?.diagnosis ?? null;

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
