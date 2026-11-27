/**
 * Learning Gap Recovery as one small task at a time, shared by the individual lesson and the live classroom:
 * two verification questions → only if one fails, a short remedy → a recheck. A persisting gap never blocks.
 */
import type { LearnerRecord } from '../contracts';
import { gapsOf } from '../brain/evidence';
import { eventsOf } from '../brain/records';
import type { ConceptPack, Prerequisite, Question } from '../packs/types';

export type GapTask =
  | { kind: 'verify'; prereq: Prerequisite; question: Question; index: number }
  | { kind: 'remedy'; prereq: Prerequisite }
  | { kind: 'recheck'; prereq: Prerequisite; question: Question };

export function gapTask(pack: ConceptPack, record: LearnerRecord): GapTask | null {
  for (const gap of gapsOf(pack, record)) {
    if (gap.status !== 'suspected' && gap.status !== 'confirmed') continue;
    const prereq = pack.prerequisites.find((p) => p.id === gap.id);
    if (!prereq) continue;
    const index = prereq.verify.findIndex((q) => !gap.answers.some((a) => a.phase === 'verify' && a.questionId === q.id));
    if (index >= 0) return { kind: 'verify', prereq, question: prereq.verify[index], index };
    if (gap.status !== 'confirmed') continue;
    if (!eventsOf(record, 'remedy').some((e) => e.prereqId === prereq.id)) return { kind: 'remedy', prereq };
    return { kind: 'recheck', prereq, question: prereq.recheck };
  }
  return null;
}
