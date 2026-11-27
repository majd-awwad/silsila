/**
 * Offline rules: understand common child phrasings with the pack's keyword rules, handling negation, mixed and
 * contradictory explanations, in the same contract as the model. It keeps the lesson running without AI and is
 * always labelled on screen. Its evaluation score is the floor the model has to beat.
 */
import type { BrainContext, Diagnosis, TeachResult, TransferResult } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { correctIdeaId, normaliseDiagnosis, normaliseTeach, normaliseTransfer } from './normalise';
import type { NormaliseMeta, RawDiagnosis } from './normalise';
import { OFF_TOPIC, UNSURE, findHits, normaliseText } from './text';

/** The learner's own clause that contains the matched words (so evidence is shown as they wrote it). */
export function clauseOf(original: string, match: string): string {
  const parts = original.split(/(?<=[،,.؛;!?؟\n])/).map((p) => p.trim()).filter(Boolean);
  const clause = parts.find((p) => normaliseText(p).includes(match)) ?? original.trim();
  return clause.replace(/[،,.؛;!?؟]+$/, '').slice(0, 160);
}

export function extractSteps(pack: ConceptPack, text: string): { met: boolean; evidence: string }[] {
  const t = normaliseText(text);
  return pack.steps.map((s) => {
    const hit = findHits(t, s.test).affirmed;
    return hit ? { met: true, evidence: clauseOf(text, hit) } : { met: false, evidence: '' };
  });
}

export function extractRaw(pack: ConceptPack, text: string): RawDiagnosis {
  const t = normaliseText(text);
  const correctId = correctIdeaId(pack);
  const steps = extractSteps(pack, text);
  const allSteps = steps.every((s) => s.met);
  const stepMatches = pack.steps.map((s) => findHits(t, s.test).affirmed).filter((x): x is string => !!x);

  const ideas: { id: string; evidence: string }[] = [];
  const rejected = new Set<string>();
  const taken: string[] = [];
  for (const rule of pack.rules) {
    if (rule.unless && rule.unless.test(t)) continue;
    const hit = findHits(t, rule.re);
    if (hit.negated) rejected.add(rule.idea);
    const m = hit.affirmed;
    if (!m || ideas.some((i) => i.id === rule.idea)) continue;
    // the same words must not be counted as two different ideas: the earlier (more specific) rule wins
    if (taken.some((x) => x.includes(m) || m.includes(x))) continue;
    // a complete scientific explanation reuses words that generic rules look for
    if (allSteps && rule.idea !== correctId && stepMatches.some((x) => x.includes(m) || m.includes(x))) continue;
    taken.push(m);
    ideas.push({ id: rule.idea, evidence: clauseOf(text, m) });
  }

  const nothing = !ideas.length && !steps.some((s) => s.met);
  return {
    relevance: nothing && OFF_TOPIC.test(t) ? 'offtopic' : nothing || (UNSURE.test(t) && !ideas.length) ? 'unclear' : 'answer',
    contradiction: ideas.some((i) => rejected.has(i.id)),
    ideas,
    rejected: [...rejected],
    steps,
    chain: [],
    wrong_step: null,
    clarify_id: null,
  };
}

export function heuristicDiagnose(
  pack: ConceptPack, text: string, ctx: BrainContext, reason: NormaliseMeta['fallbackReason'] = 'offline_mode',
): Diagnosis {
  return normaliseDiagnosis(pack, extractRaw(pack, text), text, ctx, { source: 'fallback', fallbackReason: reason });
}

export function heuristicTeach(pack: ConceptPack, text: string): TeachResult {
  const t = normaliseText(text);
  const caught = pack.teach.accept.test(t) && !pack.teach.reject.test(t);
  return normaliseTeach({ caught, steps: extractSteps(pack, text) }, text, 'fallback');
}

export function heuristicTransfer(pack: ConceptPack, text: string): TransferResult {
  return normaliseTransfer({ steps: extractSteps(pack, text) }, text, 'fallback');
}
