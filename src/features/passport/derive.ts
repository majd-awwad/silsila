/**
 * The learning passport: what the lessons done on THIS device showed, concept by concept, across the six packs, with the
 * review path that follows from the prerequisite map. Pure and local: nothing is sent anywhere, nothing is a mark.
 */
import { gapsOf, learningDNA } from '../../brain/evidence';
import type { NodeStatus } from '../../brain/evidence';
import { eventsOf } from '../../brain/records';
import { CHAIN_IDS } from '../../contracts';
import type { ChainId, L, LearnerRecord } from '../../contracts';
import { PACK_LIST } from '../../packs';
import { foundationLink } from '../../packs/links';
import type { ConceptPack } from '../../packs/types';

export interface PassportConcept { id: ChainId; label: L; status: NodeStatus }
export interface PassportPack {
  pack: ConceptPack;
  /** lessons of this pack done on this device */
  attempts: number;
  lastAt: number;
  /** the latest lesson reached its summary; otherwise it was left unfinished */
  finished: boolean;
  concepts: PassportConcept[];
}
export interface ReviewStep { pack: ConceptPack; reason: L; part: L | null; fromPack: ConceptPack | null }

/** A record counts when it is real (not the labelled sample) and has an explanation in it. */
export const isEvidence = (r: LearnerRecord): boolean => !r.sample && eventsOf(r, 'explain').length > 0;

const latestOf = (records: LearnerRecord[], packId: string): LearnerRecord | null =>
  records.filter((r) => r.pack === packId && isEvidence(r)).sort((a, b) => a.startedAt - b.startedAt).at(-1) ?? null;

export function passportOf(records: LearnerRecord[]): PassportPack[] {
  return PACK_LIST.flatMap((pack) => {
    const latest = latestOf(records, pack.id);
    if (!latest) return [];
    const dna = learningDNA(pack, latest);
    return [{
      pack, attempts: records.filter((r) => r.pack === pack.id && isEvidence(r)).length, lastAt: latest.startedAt, finished: latest.finishedAt !== null,
      concepts: CHAIN_IDS.map((id) => ({ id, label: pack.concepts[id].label, status: dna[id].status })),
    }];
  });
}

/** What to review next, from the evidence: a confirmed or persisting foundation first, otherwise an idea that still needs review. */
export function reviewPath(records: LearnerRecord[]): ReviewStep[] {
  const steps: ReviewStep[] = [];
  for (const p of passportOf(records)) {
    const latest = latestOf(records, p.pack.id)!;
    for (const gap of gapsOf(p.pack, latest)) {
      if (gap.status !== 'confirmed' && gap.status !== 'persisting') continue;
      const pre = p.pack.prerequisites.find((x) => x.id === gap.id)!;
      const link = foundationLink(p.pack.id, gap.id);
      steps.push({
        pack: p.pack, reason: pre.label, part: link?.part ?? null,
        fromPack: link?.source ? PACK_LIST.find((x) => x.id === link.source) ?? null : null,
      });
    }
    const weak = p.concepts.filter((c) => c.status === 'misconception');
    if (weak.length && !steps.some((s) => s.pack.id === p.pack.id)) steps.push({ pack: p.pack, reason: weak[0].label, part: null, fromPack: null });
  }
  return steps;
}
