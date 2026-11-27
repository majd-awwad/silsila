/**
 * Turns whatever the language model (or the offline rules) extracted into a validated Diagnosis.
 * Nothing from the model reaches the screen without passing through here:
 *  - an idea or a scientific step counts only with a quote that really appears in the learner's words;
 *  - the status is derived by code from that evidence, never taken from the model;
 *  - every line Noor says is authored pack text, so the model cannot give the answer away;
 *  - the learner's causal chain is dropped if it introduces answer words the learner did not use.
 */
import type { BrainContext, ChildModel, Diagnosis, DiagnosisStatus, Lang, StepEvidence, TeachResult, TransferResult } from '../contracts';
import { Diagnosis as DiagnosisSchema } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { OFF_TOPIC, normaliseText, quoteIn } from './text';

/** What the model (or the offline rules) is asked to extract. All of it is untrusted. */
export interface RawDiagnosis {
  /** answer · unclear (vague, don't know) · offtopic · unsupported (a real idea outside the list) */
  relevance?: unknown;
  /** true when the learner asserts an idea and its opposite */
  contradiction?: unknown;
  /** [{id, evidence}] — evidence is copied from the learner's words */
  ideas?: unknown;
  /** idea ids the learner explicitly rejected */
  rejected?: unknown;
  /** [{met, evidence}] × 3 */
  steps?: unknown;
  /** the learner's causal story, 2–4 short steps in their logic */
  chain?: unknown;
  wrong_step?: unknown;
  clarify_id?: unknown;
}

type Obj = Record<string, unknown>;
const asObj = (x: unknown): Obj => (x && typeof x === 'object' ? (x as Obj) : {});
const asList = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export const correctIdeaId = (pack: ConceptPack): string =>
  Object.keys(pack.ideas).find((id) => pack.ideas[id].correct) ?? pack.correctModel.sources[0];

export function normaliseSteps(raw: unknown, text: string): StepEvidence[] {
  const list = asList(raw);
  return [0, 1, 2].map((i) => {
    const s = asObj(list[i]);
    const evidence = String(s.evidence ?? '').trim().slice(0, 160);
    const met = (s.met === true || s.met === 1) && quoteIn(text, evidence);
    return { met, evidence: met ? evidence : '' };
  });
}

export interface NormaliseMeta { source: 'ai' | 'fallback'; fallbackReason?: Diagnosis['fallbackReason'] }

export function normaliseDiagnosis(pack: ConceptPack, raw: RawDiagnosis, text: string, ctx: BrainContext, meta: NormaliseMeta): Diagnosis {
  const lang: Lang = ctx.lang;
  const correctId = correctIdeaId(pack);
  const rejected = [...new Set(asList(raw.rejected).filter((x): x is string => typeof x === 'string' && Object.hasOwn(pack.ideas, x)))];

  const seen = new Set<string>();
  const ideas = asList(raw.ideas)
    .map(asObj)
    .filter((i) => typeof i.id === 'string' && Object.hasOwn(pack.ideas, i.id))
    .map((i) => ({ id: i.id as string, evidence: String(i.evidence ?? '').trim().slice(0, 160) }))
    .filter((i) => quoteIn(text, i.evidence) && !seen.has(i.id) && !!seen.add(i.id))
    .slice(0, 3);
  const steps = normaliseSteps(raw.steps, text);

  const contradicted = raw.contradiction === true || ideas.some((i) => rejected.includes(i.id));
  const wrong = ideas.filter((i) => i.id !== correctId);
  const met = steps.filter((s) => s.met).length;
  const mentionsCorrect = ideas.some((i) => i.id === correctId);

  let status: DiagnosisStatus;
  if (contradicted) status = 'contradictory';
  else if (wrong.length >= 2) status = 'multiple';
  else if (wrong.length === 1) status = 'misconception';
  else if (met === 3) status = 'correct';
  else if (met > 0 || mentionsCorrect) status = 'partial';
  else if (raw.relevance === 'offtopic' || OFF_TOPIC.test(normaliseText(text))) status = 'offtopic';
  else if (raw.relevance === 'unsupported') status = 'unsupported';
  else status = 'insufficient';

  let model: ChildModel | null = null;
  if (status === 'correct' || status === 'partial') model = pack.correctModel;
  else if (status === 'misconception' || status === 'multiple') {
    const parts = wrong.slice(0, 2).map((i) => pack.ideas[i.id].model);
    model = {
      sources: [...new Set(parts.flatMap((m) => m.sources))].slice(0, 2),
      path: parts[0].path,
      requires: [...new Set(parts.flatMap((m) => m.requires))].slice(0, 3),
    };
  }

  const first = wrong[0] ? pack.ideas[wrong[0].id] : null;
  let caption = '';
  if (status === 'misconception' || status === 'multiple') caption = wrong.slice(0, 2).map((i) => pack.ideas[i.id].mirror[lang]).join(' ');
  else if (status === 'correct') caption = pack.ideas[correctId].mirror[lang];
  // In a partial explanation, show the learner's actual evidence before asking for the missing link.
  else if (status === 'partial') caption = [...new Set(steps.filter((s) => s.met).map((s) => s.evidence))].join(' · ');

  let noor: string;
  let clarifyId: string | null = null;
  if (status === 'misconception' || status === 'multiple') noor = pack.noor.invite[lang];
  else if (status === 'correct') noor = pack.noor.praise[lang];
  else if (status === 'partial') {
    const missing = steps.findIndex((s) => !s.met);
    noor = `${pack.noor.partial[lang]} ${pack.steps[Math.max(0, missing)].noorAsks[lang]}`;
  } else if (status === 'contradictory') noor = pack.noor.contradiction[lang];
  else if (status === 'offtopic') noor = pack.noor.offtopic[lang];
  else if (status === 'unsupported') noor = pack.noor.unsupported[lang];
  else {
    const asked = ctx.previous.filter((p) => p.status === 'insufficient').map(() => 1).length;
    const chosen = pack.clarify.find((c) => c.id === raw.clarify_id) ?? pack.clarify[Math.min(pack.clarify.length - 1, asked)];
    clarifyId = chosen.id;
    noor = chosen.q[lang];
  }

  // the learner's causal chain: theirs when grounded, otherwise the authored story of the identified idea
  const childSaysAnswer = pack.answerWords.test(text);
  let chain = asList(raw.chain).map((s) => String(s ?? '').trim().slice(0, 80)).filter(Boolean).slice(0, 4);
  if (!childSaysAnswer && chain.some((s) => pack.answerWords.test(s))) chain = [];
  let wrongStep: number | null = Number.isInteger(raw.wrong_step) ? (raw.wrong_step as number) : null;
  if (status === 'misconception' || status === 'multiple') {
    if (chain.length < 2 && first) {
      chain = first.story.map((s) => s[lang]);
      wrongStep = first.wrongStep;
    }
    if (wrongStep === null && first) wrongStep = Math.min(first.wrongStep ?? 0, chain.length - 1);
  } else if (status === 'correct' || status === 'partial') {
    if (chain.length < 2) chain = steps.filter((s) => s.met).map((s) => s.evidence).slice(0, 4);
    wrongStep = null;
  } else {
    chain = [];
    wrongStep = null;
  }
  if (wrongStep !== null && (wrongStep < 0 || wrongStep >= chain.length)) wrongStep = null;

  const words = text.trim().split(/\s+/).length;
  const evidence: Diagnosis['evidence'] = !ideas.length && !met ? 'none' : words < 3 || (!wrong.length && met === 1) ? 'weak' : 'clear';

  return DiagnosisSchema.parse({
    pack: pack.id, lang, status, ideas, rejected, steps, model, chain, wrongStep, caption, noor, clarifyId, evidence,
    source: meta.source, ...(meta.fallbackReason ? { fallbackReason: meta.fallbackReason } : {}),
  });
}

export function normaliseTeach(raw: Obj, text: string, source: 'ai' | 'fallback'): TeachResult {
  return { caught: raw.caught === true, steps: normaliseSteps(raw.steps, text), source };
}

export function normaliseTransfer(raw: Obj, text: string, source: 'ai' | 'fallback'): TransferResult {
  return { steps: normaliseSteps(raw.steps, text), source };
}
