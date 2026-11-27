/**
 * Resuming a lesson after a refresh. The learner record (IndexedDB) is the lesson; a small pointer remembers the
 * record id and the open screen. A pointer can be older than its record (the tab closed between two writes), so
 * resuming checks the screen against what the record says already happened. A locked prediction stays locked.
 */
import { z } from 'zod';
import { Conditions, LearnerRecord, StepEvidence } from '../contracts';
import { lastEvent } from '../brain/records';
import { conditionsFor, experimentById, validConditions } from '../brain/world';
import type { ConceptPack } from '../packs/types';
import { gapTask } from './gaps';
import { STEPS } from './journey';
import type { Journey, Step } from './journey';

export const Pointer = z.object({
  v: z.literal(1),
  recordId: z.string().min(1),
  pack: z.string(),
  step: z.enum(STEPS),
  quick: z.boolean(),
  /** how many events the record had when this screen was saved */
  seen: z.number().int().min(0),
  experimentId: z.string().nullable(),
  cond: Conditions,
  pending: z.object({ text: z.string(), steps: z.array(StepEvidence).length(3), source: z.enum(['ai', 'fallback']) }).nullable(),
  /** a copy of the record, only when the device database could not store it */
  record: LearnerRecord.optional(),
});
export type Pointer = z.infer<typeof Pointer>;

export const toPointer = (j: Journey, withRecord = false): Pointer => ({
  v: 1, recordId: j.record.id, pack: j.record.pack, step: j.step, quick: j.quick, seen: j.record.events.length,
  experimentId: j.experimentId, cond: j.cond, pending: j.pending,
  ...(withRecord ? { record: j.record } : {}),
});

export function parsePointer(raw: string | null | undefined): Pointer | null {
  if (!raw) return null;
  try {
    const p = Pointer.safeParse(JSON.parse(raw));
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

/** The screen the record itself points to, when the saved screen cannot be right. */
function repaired(pack: ConceptPack, r: LearnerRecord, p: Pointer): Step {
  const { step, quick } = p;
  /** the record moved on after this pointer was written */
  const stale = r.events.length > p.seen;
  const has = (type: LearnerRecord['events'][number]['type']) => r.events.some((e) => e.type === type);
  const last = r.events.at(-1);
  const quizDone = (kind: 'pre' | 'post') => r.events.some((e) => e.type === 'quiz' && e.kind === kind);
  switch (step) {
    case 'pretest': return quizDone('pre') ? 'phenomenon' : 'pretest';
    case 'understood': case 'clarify': return has('explain') ? step : 'explain';
    case 'prereq': return !has('explain') ? 'explain' : gapTask(pack, r) ? 'prereq' : 'hypothesis';
    // the prediction was already recorded: show its result, never ask again
    case 'predict': return stale && last?.type === 'observe' ? 'reveal' : 'predict';
    case 'reveal': case 'reflect': case 'revise': return has('observe') ? step : 'hypothesis';
    case 'guided': return has('assist') ? 'guided' : 'hypothesis';
    case 'challenge': return lastEvent(r, 'challenge') ? 'challenge' : 'teach';
    case 'check':
      if (stale && last?.type === 'transfer') return quick || quizDone('post') ? 'summary' : 'posttest';
      return p.pending ? 'check' : 'transfer';
    case 'posttest': return quizDone('post') ? 'summary' : 'posttest';
    default: return step;
  }
}

export function resumeJourney(pack: ConceptPack, record: LearnerRecord, pointer: Pointer): Journey {
  const experimentId = experimentById(pack, pointer.experimentId)?.id ?? null;
  const cond = validConditions(pack, pointer.cond) ? pointer.cond : conditionsFor(pack);
  const step = repaired(pack, record, pointer);
  return { record, step, quick: pointer.quick, experimentId, cond, pending: step === 'check' ? pointer.pending : null };
}
