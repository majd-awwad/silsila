/**
 * سلسلة — العقود بين أجزاء المشروع. مصدر الحقيقة الوحيد.
 * أي تغيير هون بينحكى فيه بالجروب قبل الدمج (شوف CLAUDE.md).
 *
 * The contracts are concept-agnostic: a ConceptPack (src/packs) supplies the vocabulary
 * (idea parts, paths, variables, outcomes). Ids are strings here and validated against the pack.
 *
 * brain  → writes Diagnosis, TeachResult, ChallengeResult, TransferResult
 * world  → (deterministic) computes outcomes for any Conditions
 * scene  → reads ChildModel + Conditions
 * flow   → writes ExperimentRun, Session
 * store / teacher → read Session
 */
import { z } from 'zod';

export const CHAIN_IDS = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;
export const ChainId = z.enum(CHAIN_IDS);
export type ChainId = z.infer<typeof ChainId>;
export const LinkState = z.enum(['ok', 'missing', 'wrong', 'unknown']);
export type LinkState = z.infer<typeof LinkState>;

/** Which of the pack's three science steps the child expressed, from their words only. */
export const Rubric = z.object({
  s1: z.union([z.literal(0), z.literal(1)]),
  s2: z.union([z.literal(0), z.literal(1)]),
  s3: z.union([z.literal(0), z.literal(1)]),
});
export type Rubric = z.infer<typeof Rubric>;
export const RUBRIC_KEYS = ['s1', 's2', 's3'] as const;

/** A set of experiment variables: variable id → option id (both from the pack). */
export const Conditions = z.record(z.string(), z.string());
export type Conditions = z.infer<typeof Conditions>;

/** The child's idea as the 3D mirror draws it (not the truth). */
export const ChildModel = z.object({
  sources: z.array(z.string()).min(1).max(2),
  path: z.string(),
  /** conditions the child believes are needed, e.g. ['cold'] or ['sun'] */
  requires: z.array(z.string()).max(3),
});
export type ChildModel = z.infer<typeof ChildModel>;

export const DiagnosisStatus = z.enum(['model', 'correct', 'clarify', 'offtopic']);
export type DiagnosisStatus = z.infer<typeof DiagnosisStatus>;

export const Diagnosis = z.object({
  pack: z.string(),
  status: DiagnosisStatus,
  /** «هيك إنت شايفها: …» — empty for clarify/offtopic */
  caption: z.string(),
  model: ChildModel.nullable(),
  /** the child's own causal story, 2–4 short steps in their words (Mental Model Engine) */
  child_chain: z.array(z.string()).max(4),
  /** index into child_chain of the step that is scientifically wrong, or null */
  wrong_step: z.number().int().min(0).max(3).nullable(),
  chain: z.record(ChainId, LinkState),
  broken_link: ChainId.nullable(),
  /** preset id of the experiment whose real result breaks this idea */
  best_experiment: z.string().nullable(),
  noor: z.string(),
  rubric: Rubric,
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
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

/** Noor tries a NEW phenomenon using only what the child taught her. */
export const ChallengeResult = z.object({
  answer: z.string(),
  /** science steps (0..2) the child's teaching did not cover */
  missing: z.array(z.number().int().min(0).max(2)),
  /** what Noor asks the child to explain more, or '' */
  ask: z.string(),
  source: z.enum(['ai', 'fallback']),
});
export type ChallengeResult = z.infer<typeof ChallengeResult>;

/** The child explains another new phenomenon on their own (transfer). */
export const TransferResult = z.object({
  rubric: Rubric,
  score: z.number().int().min(0).max(3),
  noor: z.string(),
  source: z.enum(['ai', 'fallback']),
});
export type TransferResult = z.infer<typeof TransferResult>;

export const ExperimentRun = z.object({
  /** preset id if the child picked a preset, null for a custom combination */
  preset: z.string().nullable(),
  cond: Conditions,
  predicted: z.string(),
  real: z.string(),
  contradicted: z.boolean(),
  at: z.number(),
});
export type ExperimentRun = z.infer<typeof ExperimentRun>;

export const Explanation = z.object({ text: z.string(), at: z.number(), diagnosis: Diagnosis });
export type Explanation = z.infer<typeof Explanation>;

export const QuizResult = z.object({ answers: z.array(z.number()), score: z.number(), total: z.number() });
export type QuizResult = z.infer<typeof QuizResult>;

/** One child's whole journey. Pseudonym only, no real names, no audio. */
export const Session = z.object({
  id: z.string(),
  pack: z.string(),
  pseudonym: z.string(),
  grade: z.number().int().min(1).max(12),
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  pre: QuizResult.nullable(),
  post: QuizResult.nullable(),
  explanations: z.array(Explanation),
  experiments: z.array(ExperimentRun),
  teach: z.object({ turns: z.number(), caught: z.boolean(), quote: z.string() }).nullable(),
  challenge: z.object({ answer: z.string(), missing: z.array(z.number()), resolved: z.boolean() }).nullable().default(null),
  transfer: z.object({ text: z.string(), rubric: Rubric, score: z.number() }).nullable().default(null),
  classCode: z.string().nullable().default(null),
  quick: z.boolean().default(false),
  demo: z.boolean().default(false),
});
export type Session = z.infer<typeof Session>;

/** Context the brain needs on every call (calls are stateless). */
export const BrainContext = z.object({
  pack: z.string(),
  phase: z.enum(['explain', 'teach']),
  previous: z.array(z.object({ text: z.string(), caption: z.string(), status: DiagnosisStatus })).max(8),
  experiments: z.array(ExperimentRun).max(12),
});
export type BrainContext = z.infer<typeof BrainContext>;

export const DiagnoseRequest = z.object({ text: z.string().min(1).max(600), context: BrainContext });
export type DiagnoseRequest = z.infer<typeof DiagnoseRequest>;

/** What a class member's device posts to the live class map. */
export const ClassEntry = z.object({
  id: z.string(),
  pseudonym: z.string(),
  pack: z.string(),
  at: z.number(),
  firstSources: z.array(z.string()),
  firstCaption: z.string(),
  brokenLink: ChainId.nullable(),
  bestExperiment: z.string().nullable(),
  understood: z.boolean(),
  taught: z.boolean(),
  transferScore: z.number().nullable(),
});
export type ClassEntry = z.infer<typeof ClassEntry>;

export const ActivityPlan = z.object({
  title: z.string(),
  goal: z.string(),
  materials: z.array(z.string()).max(8),
  steps: z.array(z.object({ minutes: z.number(), title: z.string(), detail: z.string() })).min(2).max(6),
  check: z.string(),
  source: z.enum(['ai', 'fallback']),
});
export type ActivityPlan = z.infer<typeof ActivityPlan>;
