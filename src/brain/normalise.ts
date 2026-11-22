/**
 * Turns whatever the model (or the fallback) returned into a valid Diagnosis.
 * Nothing from the model reaches the screen without passing through here.
 */
import type { BrainContext, ChainId, ChildModel, Diagnosis, DiagnosisStatus, LinkState, Rubric, TeachResult } from '../contracts';
import { CHAIN_IDS, Diagnosis as DiagnosisSchema, DiagnosisStatus as StatusSchema, Path, Source } from '../contracts';
import { NOOR } from '../lesson/condensation';
import { derivePredictions, isExperimentId, outcomeMatches, pickBestExperiment } from './predictions';

type Raw = Record<string, unknown>;

const ANSWER_WORDS = /بخار|تكاثف|يتكاثف|بتتكاثف|التكثف|تكثّف|condens|vapou?r/i;

/** Noor must never give the answer away before the child gets there. */
export function guardNoor(noor: string, childTexts: string[], status: DiagnosisStatus): string {
  const line = (noor || '').trim();
  if (!line) return NOOR.safeFallback;
  if (status === 'correct') return line;
  const childSaid = childTexts.some((t) => ANSWER_WORDS.test(t));
  if (!childSaid && ANSWER_WORDS.test(line)) return NOOR.safeFallback;
  return line.length > 260 ? line.slice(0, 260).replace(/\s+\S*$/, '') + '؟' : line;
}

function bit(x: unknown): 0 | 1 {
  return x === 1 || x === true || x === '1' ? 1 : 0;
}
export function normaliseRubric(r: unknown): Rubric {
  const o = (r && typeof r === 'object' ? r : {}) as Raw;
  return { vapor_in_air: bit(o.vapor_in_air), cooling: bit(o.cooling), turns_to_drops: bit(o.turns_to_drops) };
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

export function normaliseDiagnosis(raw: Raw, childText: string, ctx: BrainContext, source: 'ai' | 'fallback'): Diagnosis {
  const status: DiagnosisStatus = StatusSchema.safeParse(raw.status).success ? (raw.status as DiagnosisStatus) : 'clarify';
  const srcs = (Array.isArray(raw.sources) ? raw.sources : [])
    .filter((s): s is Source => Source.safeParse(s).success)
    .slice(0, 2);
  const path = Path.safeParse(raw.path).success ? (raw.path as Path) : 'appears_on_surface';

  let model: ChildModel | null = null;
  if (status === 'model' || status === 'correct') {
    const parts = { sources: srcs.length ? srcs : (['appears_magic'] as Source[]), path, needs_cold: raw.needs_cold === true };
    const derived = derivePredictions(parts);
    const p = (raw.predictions && typeof raw.predictions === 'object' ? raw.predictions : {}) as Raw;
    const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
    model = {
      ...parts,
      predictions: {
        E_color: pick(p.E_color, ['blue', 'clear', 'none'] as const, derived.E_color),
        E_empty: pick(p.E_empty, ['drops', 'none'] as const, derived.E_empty),
        E_cover: pick(p.E_cover, ['drops', 'none'] as const, derived.E_cover),
        E_warm: pick(p.E_warm, ['drops', 'fewer', 'none'] as const, derived.E_warm),
        E_dry: pick(p.E_dry, ['drops', 'fewer', 'none'] as const, derived.E_dry),
      },
    };
  }

  // The best experiment must actually break the idea; if the model's choice doesn't, pick one in code.
  let best = isExperimentId(raw.best_experiment) ? raw.best_experiment : null;
  if (status !== 'model' || !model) best = null;
  else if (!best || outcomeMatches(best, model.predictions[best])) best = pickBestExperiment(model, ctx.experiments);

  const chain = normaliseChain(raw.chain);
  let broken = CHAIN_IDS.includes(raw.broken_link as ChainId) ? (raw.broken_link as ChainId) : null;
  if (status === 'correct') broken = null;
  else if (!broken) broken = CHAIN_IDS.find((c) => chain[c] === 'missing' || chain[c] === 'wrong') ?? null;

  const conf = Number(raw.confidence);
  const childTexts = [childText, ...ctx.previous.map((p) => p.text)];
  const diag: Diagnosis = {
    status,
    caption: status === 'model' || status === 'correct' ? String(raw.caption ?? '').slice(0, 200) : '',
    model,
    chain,
    broken_link: broken,
    best_experiment: best,
    noor: guardNoor(String(raw.noor ?? ''), childTexts, status),
    rubric: normaliseRubric(raw.rubric),
    confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
    evidence: String(raw.evidence ?? '').slice(0, 160),
    source,
  };
  return DiagnosisSchema.parse(diag);
}

export function normaliseTeach(raw: Raw, source: 'ai' | 'fallback'): TeachResult {
  return {
    caught: raw.caught === true,
    noor: String(raw.noor ?? '').trim() || (raw.caught === true ? NOOR.thanks : NOOR.stillConfused),
    rubric: normaliseRubric(raw.rubric),
    source,
  };
}
