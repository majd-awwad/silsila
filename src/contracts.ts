/**
 * سلسلة — العقود بين أجزاء المشروع. مصدر الحقيقة الوحيد.
 * أي تغيير هون بينحكى فيه بالجروب قبل الدمج (شوف CLAUDE.md).
 *
 * brain  → يكتب ChildModel, Diagnosis, TeachResult
 * scene  → يقرأ ChildModel ويعرض ExperimentId
 * flow   → يكتب ExperimentRun, Session
 * store / teacher → يقرأ Session
 */
import { z } from 'zod';

/* ---------- vocabulary the AI composes a child's idea from ---------- */
export const SOURCE_IDS = [
  'inside_water', 'ice', 'air_vapor', 'cold_itself',
  'glass_itself', 'spill_from_above', 'people_breath', 'appears_magic',
] as const;
export const Source = z.enum(SOURCE_IDS);
export type Source = z.infer<typeof Source>;

export const PATH_IDS = ['through_wall', 'over_rim', 'from_air', 'appears_on_surface', 'falls_from_above'] as const;
export const Path = z.enum(PATH_IDS);
export type Path = z.infer<typeof Path>;

export const EXPERIMENT_IDS = ['E_color', 'E_empty', 'E_cover', 'E_warm', 'E_dry'] as const;
export const ExperimentId = z.enum(EXPERIMENT_IDS);
export type ExperimentId = z.infer<typeof ExperimentId>;
/** 'base' = the plain cold glass, no intervention. */
export type SceneExperiment = ExperimentId | 'base';

export const Outcome = z.enum(['blue', 'clear', 'none', 'drops', 'fewer']);
export type Outcome = z.infer<typeof Outcome>;

export const CHAIN_IDS = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;
export const ChainId = z.enum(CHAIN_IDS);
export type ChainId = z.infer<typeof ChainId>;
export const LinkState = z.enum(['ok', 'missing', 'wrong', 'unknown']);
export type LinkState = z.infer<typeof LinkState>;

export const Rubric = z.object({
  vapor_in_air: z.union([z.literal(0), z.literal(1)]),
  cooling: z.union([z.literal(0), z.literal(1)]),
  turns_to_drops: z.union([z.literal(0), z.literal(1)]),
});
export type Rubric = z.infer<typeof Rubric>;

export const Predictions = z.object({
  E_color: z.enum(['blue', 'clear', 'none']),
  E_empty: z.enum(['drops', 'none']),
  E_cover: z.enum(['drops', 'none']),
  E_warm: z.enum(['drops', 'fewer', 'none']),
  E_dry: z.enum(['drops', 'fewer', 'none']),
});
export type Predictions = z.infer<typeof Predictions>;

/** What the 3D mirror draws: the child's idea, not the truth. */
export const ChildModel = z.object({
  sources: z.array(Source).min(1).max(2),
  path: Path,
  needs_cold: z.boolean(),
  predictions: Predictions,
});
export type ChildModel = z.infer<typeof ChildModel>;

export const DiagnosisStatus = z.enum(['model', 'correct', 'clarify', 'offtopic']);
export type DiagnosisStatus = z.infer<typeof DiagnosisStatus>;

export const Diagnosis = z.object({
  status: DiagnosisStatus,
  /** «هيك إنت شايفها: …» — empty for clarify/offtopic */
  caption: z.string(),
  model: ChildModel.nullable(),
  chain: z.record(ChainId, LinkState),
  broken_link: ChainId.nullable(),
  best_experiment: ExperimentId.nullable(),
  /** Noor's next line: 1–2 sentences, ends with a question, never reveals the answer early */
  noor: z.string(),
  rubric: Rubric,
  confidence: z.number().min(0).max(1),
  /** exact words from the child the diagnosis rests on */
  evidence: z.string(),
  /** where this came from, shown honestly in the UI */
  source: z.enum(['ai', 'fallback']),
});
export type Diagnosis = z.infer<typeof Diagnosis>;

export const TeachResult = z.object({
  caught: z.boolean(),
  noor: z.string(),
  rubric: Rubric,
  source: z.enum(['ai', 'fallback']),
});
export type TeachResult = z.infer<typeof TeachResult>;

export const ExperimentRun = z.object({
  exp: ExperimentId,
  predicted: Outcome,
  real: Outcome,
  contradicted: z.boolean(),
  at: z.number(),
});
export type ExperimentRun = z.infer<typeof ExperimentRun>;

export const Explanation = z.object({
  text: z.string(),
  at: z.number(),
  diagnosis: Diagnosis,
});
export type Explanation = z.infer<typeof Explanation>;

export const QuizResult = z.object({
  answers: z.array(z.number()),
  score: z.number(),
  total: z.number(),
});
export type QuizResult = z.infer<typeof QuizResult>;

/** One child's whole journey. Pseudonym only, no real names, no audio. */
export const Session = z.object({
  id: z.string(),
  pseudonym: z.string(),
  grade: z.number().int().min(1).max(12),
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  pre: QuizResult.nullable(),
  post: QuizResult.nullable(),
  explanations: z.array(Explanation),
  experiments: z.array(ExperimentRun),
  teach: z.object({ turns: z.number(), caught: z.boolean(), quote: z.string() }).nullable(),
  demo: z.boolean().default(false),
});
export type Session = z.infer<typeof Session>;

/** Context the brain needs on every call (calls are stateless). */
export interface BrainContext {
  phase: 'explain' | 'teach';
  previous: { text: string; caption: string; status: DiagnosisStatus }[];
  experiments: ExperimentRun[];
}

export const DiagnoseRequest = z.object({
  text: z.string().min(1).max(600),
  context: z.object({
    phase: z.enum(['explain', 'teach']),
    previous: z.array(z.object({ text: z.string(), caption: z.string(), status: DiagnosisStatus })).max(8),
    experiments: z.array(ExperimentRun).max(10),
  }),
});
export type DiagnoseRequest = z.infer<typeof DiagnoseRequest>;
