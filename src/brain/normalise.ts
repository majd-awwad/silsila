/**
 * Turns whatever the model (or the fallback) returned into a valid result for the pack.
 * Nothing from the model reaches the screen without passing through here.
 */
import type { ActivityPlan, BrainContext, ChainId, ChallengeResult, ChildModel, Diagnosis, DiagnosisStatus, LinkState, Rubric, TeachResult, TransferResult } from '../contracts';
import { CHAIN_IDS, Diagnosis as DiagnosisSchema, DiagnosisStatus as StatusSchema } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { pickBestPreset } from './world';

type Raw = Record<string, unknown>;

/** Noor must never give the answer away before the child does. */
export function guardNoor(pack: ConceptPack, noor: string, childTexts: string[], status: DiagnosisStatus): string {
  const line = (noor || '').trim();
  const fallback = pack.noor.clarifyLadder[0];
  if (!line) return fallback;
  if (status === 'correct') return line;
  const childSaid = childTexts.some((t) => pack.answerWords.test(t));
  if (!childSaid && pack.answerWords.test(line)) return 'فهمت عليك! يلا نجرّب بالمختبر: شو بتتوقّع يصير لو غيّرنا إشي؟';
  return line.length > 260 ? line.slice(0, 260).replace(/\s+\S*$/, '') + '؟' : line;
}

const bit = (x: unknown): 0 | 1 => (x === 1 || x === true || x === '1' ? 1 : 0);
export function normaliseRubric(r: unknown): Rubric {
  const o = (r && typeof r === 'object' ? r : {}) as Raw;
  return { s1: bit(o.s1), s2: bit(o.s2), s3: bit(o.s3) };
}

function normaliseChain(c: unknown): Record<ChainId, LinkState> {
  const o = (c && typeof c === 'object' ? c : {}) as Raw;
  const out = {} as Record<ChainId, LinkState>;
  for (const id of CHAIN_IDS) {
    const v = o[id];
    out[id] = v === 'ok' || v === 'missing' || v === 'wrong' ? v : 'unknown';
  }
  return out;
}

const shortLine = (s: unknown) => String(s ?? '').trim().slice(0, 70);

export function normaliseDiagnosis(pack: ConceptPack, raw: Raw, childText: string, ctx: BrainContext, source: 'ai' | 'fallback'): Diagnosis {
  let status: DiagnosisStatus = StatusSchema.safeParse(raw.status).success ? (raw.status as DiagnosisStatus) : 'clarify';
  const conf = Number(raw.confidence);
  const confidence = Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5;
  let caption = String(raw.caption ?? '').slice(0, 200);
  const childTexts = [childText, ...ctx.previous.map((p) => p.text)];
  const clarifiesSoFar = ctx.previous.filter((p) => p.status === 'clarify').length;

  const srcs = (Array.isArray(raw.sources) ? raw.sources : []).filter((s): s is string => typeof s === 'string' && s in pack.sources).slice(0, 2);
  const path = typeof raw.path === 'string' && raw.path in pack.paths ? raw.path : Object.keys(pack.paths)[0];
  const requires = (Array.isArray(raw.requires) ? raw.requires : []).filter((s): s is string => typeof s === 'string' && s in pack.requires).slice(0, 2);

  let noor = String(raw.noor ?? '');
  // Unsure about an idea → confirm instead of assuming (ChatGPT review, problem 3)
  if (status === 'model' && confidence < 0.4) {
    status = 'clarify';
    noor = caption ? `بس لأتأكد إني فهمت: ${caption.replace('هيك إنت شايفها: ', '').replace(/\.$/, '')}؟` : pack.noor.clarifyLadder[Math.min(2, clarifiesSoFar)];
    caption = '';
  }
  if ((status === 'clarify' || status === 'offtopic') && !noor.trim()) noor = pack.noor.clarifyLadder[Math.min(2, clarifiesSoFar)];

  let model: ChildModel | null = null;
  if (status === 'correct') model = pack.correctModel;
  else if (status === 'model') model = { sources: srcs.length ? srcs : [Object.keys(pack.sources).at(-1)!], path, requires };

  // the child's own causal chain (Mental Model Engine)
  let childChain = (Array.isArray(raw.child_chain) ? raw.child_chain : []).map(shortLine).filter(Boolean).slice(0, 4);
  let wrongStep: number | null = Number.isInteger(raw.wrong_step) ? (raw.wrong_step as number) : null;
  if (model && childChain.length < 2) {
    const part = pack.sources[model.sources[0]];
    childChain = [...part.story];
    wrongStep = part.wrongStep;
  }
  if (!model) { childChain = []; wrongStep = null; }
  if (status === 'correct') wrongStep = null;
  if (wrongStep !== null && (wrongStep < 0 || wrongStep >= childChain.length)) wrongStep = null;

  // the experiment that breaks the idea is chosen by the deterministic engine, never the model
  const best = status === 'model' && model ? pickBestPreset(pack, model, ctx.experiments)?.id ?? null : null;

  const chain = normaliseChain(raw.chain);
  let broken = CHAIN_IDS.includes(raw.broken_link as ChainId) ? (raw.broken_link as ChainId) : null;
  if (status === 'correct') broken = null;
  else if (!broken) broken = CHAIN_IDS.find((c) => chain[c] === 'missing' || chain[c] === 'wrong') ?? null;

  const diag: Diagnosis = {
    pack: pack.id,
    status,
    caption: model ? caption : '',
    model,
    child_chain: childChain,
    wrong_step: wrongStep,
    chain,
    broken_link: broken,
    best_experiment: best,
    noor: guardNoor(pack, noor, childTexts, status),
    rubric: normaliseRubric(raw.rubric),
    confidence,
    evidence: String(raw.evidence ?? '').slice(0, 160),
    source,
  };
  return DiagnosisSchema.parse(diag);
}

export function normaliseTeach(pack: ConceptPack, raw: Raw, source: 'ai' | 'fallback'): TeachResult {
  const caught = raw.caught === true;
  return { caught, noor: String(raw.noor ?? '').trim() || (caught ? pack.noor.caughtThanks : pack.noor.stillConfused), rubric: normaliseRubric(raw.rubric), source };
}

export function normaliseChallenge(pack: ConceptPack, raw: Raw, source: 'ai' | 'fallback'): ChallengeResult {
  const missing = [...new Set((Array.isArray(raw.missing) ? raw.missing : []).filter((x): x is number => x === 0 || x === 1 || x === 2))].sort();
  return {
    answer: String(raw.answer ?? '').trim().slice(0, 300) || pack.challenge.correctAnswer,
    missing,
    ask: missing.length ? String(raw.ask ?? '').trim().slice(0, 200) || `بس ما فهمت منك: ${pack.scienceChain[missing[0]]}؟ كيف بيصير هاد؟` : '',
    source,
  };
}

export function normaliseTransfer(raw: Raw, source: 'ai' | 'fallback'): TransferResult {
  const rubric = normaliseRubric(raw.rubric);
  return { rubric, score: rubric.s1 + rubric.s2 + rubric.s3, noor: String(raw.noor ?? '').trim().slice(0, 300) || 'شكراً! حلو كثير.', source };
}

export function normaliseActivity(raw: Raw, fallback: Omit<ActivityPlan, 'source'>, source: 'ai' | 'fallback'): ActivityPlan {
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((s) => s as Raw)
    .map((s) => ({ minutes: Math.max(1, Math.min(15, Math.round(Number(s.minutes) || 3))), title: shortLine(s.title), detail: String(s.detail ?? '').slice(0, 260) }))
    .filter((s) => s.title && s.detail)
    .slice(0, 6);
  if (steps.length < 2 || !raw.title) return { ...fallback, source: 'fallback' };
  return {
    title: shortLine(raw.title),
    goal: String(raw.goal ?? '').slice(0, 200),
    materials: (Array.isArray(raw.materials) ? raw.materials : []).map(shortLine).filter(Boolean).slice(0, 8),
    steps,
    check: String(raw.check ?? '').slice(0, 200),
    source,
  };
}
