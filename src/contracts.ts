/**
 * سلسلة — the contracts between the parts of the project. Single source of truth.
 *
 *   packs  (src/packs)  vocabulary, deterministic outcome functions, authored text
 *   brain  (src/brain)  turns words into a validated Diagnosis; plans experiments; derives evidence; room rules
 *   api    (api/)       AI calls and the live classroom, using the same pure brain functions
 *   ui     (src/features) reads these types only
 *
 * The language model interprets language. It never computes outcomes, never ranks experiments and never
 * writes the lines Noor says to a child: those come from the packs and the deterministic engine.
 */
import { z } from 'zod';

export const Lang = z.enum(['ar', 'en']);
export type Lang = z.infer<typeof Lang>;
export type L = { ar: string; en: string };

export const CHAIN_IDS = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;
export const ChainId = z.enum(CHAIN_IDS);
export type ChainId = z.infer<typeof ChainId>;

/** A set of experiment variables: variable id → option id (both from the pack). */
export const Conditions = z.record(z.string(), z.string());
export type Conditions = z.infer<typeof Conditions>;

/** The hypothesis the engine can run: the learner's idea, not the truth. */
export const ChildModel = z.object({
  sources: z.array(z.string()).min(1).max(2),
  path: z.string(),
  requires: z.array(z.string()).max(3),
});
export type ChildModel = z.infer<typeof ChildModel>;

/* ───────────────────────── diagnosis ───────────────────────── */

export const STATUSES = [
  'correct', // all three scientific steps, no misconception
  'partial', // some steps, no misconception
  'misconception', // one identified idea that differs from the reference model
  'multiple', // two or more such ideas
  'insufficient', // not enough evidence: ask, never guess
  'contradictory', // says an idea and its opposite
  'offtopic',
  'unsupported', // a real idea this pack cannot simulate
] as const;
export const DiagnosisStatus = z.enum(STATUSES);
export type DiagnosisStatus = z.infer<typeof DiagnosisStatus>;

export const StepEvidence = z.object({ met: z.boolean(), evidence: z.string() });
export type StepEvidence = z.infer<typeof StepEvidence>;

export const Diagnosis = z.object({
  pack: z.string(),
  lang: Lang,
  status: DiagnosisStatus,
  /** identified ideas, each with the learner's own words as evidence */
  ideas: z.array(z.object({ id: z.string(), evidence: z.string() })).max(3),
  /** ideas the learner explicitly rejected («مش من جوّا») */
  rejected: z.array(z.string()),
  /** which of the pack's three scientific steps the learner expressed */
  steps: z.array(StepEvidence).length(3),
  /** hypothesis to simulate; null when there is nothing safe to draw */
  model: ChildModel.nullable(),
  /** the learner's causal story as short steps */
  chain: z.array(z.string()).max(4),
  /** index into chain of the step to investigate */
  wrongStep: z.number().int().min(0).max(3).nullable(),
  /** authored restatement of their idea, '' when nothing was identified */
  caption: z.string(),
  /** Noor's next line (authored pack text) */
  noor: z.string(),
  clarifyId: z.string().nullable(),
  /** evidence sufficiency, deliberately not a probability */
  evidence: z.enum(['none', 'weak', 'clear']),
  source: z.enum(['ai', 'fallback']),
  /** why the offline rules answered instead of the model */
  fallbackReason: z.enum(['no_key', 'ai_error', 'network', 'offline_mode']).optional(),
});
export type Diagnosis = z.infer<typeof Diagnosis>;

/* ───────────────────────── learner record ───────────────────────── */

const at = z.number();

/**
 * One learner's journey is an event log. Learning DNA, Thinking Replay, class insights and the teacher's
 * reports are all derived from it, for individual lessons and for the live classroom alike.
 */
export const LearnerEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('explain'), at, phase: z.enum(['initial', 'clarify', 'revise']), text: z.string(), diagnosis: Diagnosis }),
  /** the learner's own prediction, locked before the result is shown */
  z.object({ type: z.literal('predict'), at, experimentId: z.string().nullable(), cond: Conditions, outcome: z.string() }),
  z.object({
    type: z.literal('observe'), at, experimentId: z.string().nullable(), cond: Conditions,
    /** the reference model's result */
    real: z.string(),
    /** what the learner predicted, and what their idea predicts */
    predicted: z.string().nullable(), hypothesis: z.string().nullable(),
    note: z.string().default(''),
    predictionReason: z.string().max(300).optional(),
  }),
  z.object({ type: z.literal('prereq'), at, prereqId: z.string(), questionId: z.string(), correct: z.boolean(), phase: z.enum(['verify', 'recheck']) }),
  z.object({ type: z.literal('remedy'), at, prereqId: z.string(), reflection: z.string().max(300).optional() }),
  /** scaffolding received: 1 reflection · 2 attention · 3 clue · 4 guided instruction · 5 ask the teacher */
  z.object({ type: z.literal('assist'), at, level: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal('teach'), at, text: z.string(), caught: z.boolean(), steps: z.array(StepEvidence).length(3), source: z.enum(['ai', 'fallback']) }),
  /** Noor's attempt: which steps she knew from the learner's teaching */
  z.object({ type: z.literal('challenge'), at, known: z.array(z.boolean()).length(3), solved: z.boolean() }),
  z.object({
    type: z.literal('transfer'), at, text: z.string(), steps: z.array(StepEvidence).length(3),
    choice: z.number().int().nullable(), choiceCorrect: z.boolean().nullable(), source: z.enum(['ai', 'fallback']),
  }),
  z.object({ type: z.literal('quiz'), at, kind: z.enum(['pre', 'post']), answers: z.array(z.number()), score: z.number(), total: z.number() }),
  /** Real World Bridge: what they saw with physical materials */
  z.object({ type: z.literal('physical'), at, experimentId: z.string(), observation: z.string(), matched: z.boolean().nullable() }),
]);
export type LearnerEvent = z.infer<typeof LearnerEvent>;
export type EventOf<T extends LearnerEvent['type']> = Extract<LearnerEvent, { type: T }>;

/** Pseudonym only: no real names, no audio. */
export const LearnerRecord = z.object({
  id: z.string(),
  pack: z.string(),
  alias: z.string(),
  grade: z.number().int().min(1).max(12),
  lang: Lang,
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  classCode: z.string().nullable(),
  /** built-in sample data, always labelled on screen */
  sample: z.boolean(),
  events: z.array(LearnerEvent).max(200),
});
export type LearnerRecord = z.infer<typeof LearnerRecord>;

/* ───────────────────────── experiment planner ───────────────────────── */

export interface PlanConstraints {
  mode?: ExperimentMode;
  /** lesson time left, minutes */
  minutes: number;
  /** available material ids; null = no restriction */
  resources: string[] | null;
  grade: number;
  /** an adult can supervise */
  supervision: boolean;
  /** pack objective id, or null */
  objective: string | null;
  /** experiments already run or rejected by the teacher */
  exclude: string[];
}

export interface PlanPrediction {
  /** hypothesis group key */
  key: string;
  ideas: string[];
  outcome: string;
  learners: number;
  contradicted: boolean;
}

export interface RankedExperiment {
  id: string;
  /** 0..1 planning heuristic. NOT a measure of learning effectiveness. */
  score: number;
  /** the weighted parts of the score, each 0..1 */
  parts: { reach: number; disagreement: number; coverage: number; objective: number; time: number };
  /** predictive outcome entropy H(Y) over the class's hypotheses, in bits */
  entropyBits: number;
  /** learners whose idea predicts something else than the reference model */
  reached: number;
  /** idea ids this experiment can contradict */
  refutes: string[];
  predictions: PlanPrediction[];
  real: string;
  minutes: number;
}

export type RejectReason = 'time' | 'materials' | 'safety' | 'grade' | 'excluded';

export interface PlanResult {
  /** experiment: run one · enrich: everyone is there · ask: not enough to plan · none: nothing feasible */
  mode: 'experiment' | 'enrich' | 'ask' | 'none';
  recommended: RankedExperiment | null;
  /** feasible experiments, best first */
  ranked: RankedExperiment[];
  rejected: { id: string; reasons: RejectReason[] }[];
  /** complementary experiments that together reach the most ideas within the time */
  sequence: string[];
  /** present ideas that no feasible experiment can contradict */
  uncovered: string[];
  /** learners with a testable idea / all learners considered */
  testable: number;
  total: number;
}

/* ───────────────────────── live classroom ───────────────────────── */

export const PHASES = [
  'lobby', // waiting for participants
  'explain', // each learner explains privately
  'map', // collective mind map
  'recommend', // the planner recommends an experiment
  'approve', // the teacher approves or changes it
  'predict', // private predictions
  'reveal', // locked predictions, aggregate shown
  'experiment', // shared experiment runs on the main screen
  'observe', // the result is shown
  'discuss', // peer discussion
  'revise', // independent revised explanation
  'transfer', // new situation
  'insight', // before → after, next steps
] as const;
export const Phase = z.enum(PHASES);
export type Phase = z.infer<typeof Phase>;

export const ExperimentMode = z.enum(['digital', 'physical', 'hybrid']);
export type ExperimentMode = z.infer<typeof ExperimentMode>;

export const RoomSettings = z.object({
  pack: z.string(),
  lang: Lang,
  grade: z.number().int().min(1).max(12),
  minutes: z.number().int().min(5).max(120),
  resources: z.array(z.string()).max(40),
  supervision: z.boolean(),
  objective: z.string().nullable(),
  mode: ExperimentMode.optional(),
  accessibility: z.array(z.enum(['visual', 'hearing', 'reading', 'motor'])).max(4).optional(),
});
export type RoomSettings = z.infer<typeof RoomSettings>;

export const RoomMeta = z.object({
  code: z.string(),
  settings: RoomSettings,
  createdAt: z.number(),
  expiresAt: z.number(),
  phase: Phase,
  phaseAt: z.number(),
  /** the approved shared experiment */
  experimentId: z.string().nullable(),
  approvalSource: z.enum(['recommended', 'manual']).optional(),
  /** experiments the teacher rejected */
  rejected: z.array(z.string()),
  /** experiments already run in this room, oldest first */
  done: z.array(z.string()),
  closed: z.boolean(),
  /** built-in sample classroom, always labelled on screen */
  sample: z.boolean(),
});
export type RoomMeta = z.infer<typeof RoomMeta>;

export const RoomParticipant = z.object({ id: z.string(), alias: z.string(), joinedAt: z.number(), lastSeenAt: z.number().optional(), record: LearnerRecord });
export type RoomParticipant = z.infer<typeof RoomParticipant>;

export const TeacherOp = z.discriminatedUnion('type', [
  z.object({ type: z.literal('phase'), phase: Phase, expectedPhase: Phase.optional(), expectedExperiment: z.string().nullable().optional() }),
  z.object({ type: z.literal('choose'), experimentId: z.string(), source: z.enum(['recommended', 'manual']).optional(), expectedPhase: Phase.optional() }),
  z.object({ type: z.literal('reject'), experimentId: z.string(), expectedPhase: Phase.optional() }),
  z.object({ type: z.literal('remove'), participantId: z.string() }),
  z.object({ type: z.literal('close') }),
]);
export type TeacherOp = z.infer<typeof TeacherOp>;

export const StudentOp = z.discriminatedUnion('type', [
  z.object({ type: z.literal('explain'), text: z.string().min(1).max(600) }),
  z.object({ type: z.literal('predict'), outcome: z.string().max(40) }),
  z.object({ type: z.literal('observe'), note: z.string().max(300) }),
  z.object({ type: z.literal('revise'), text: z.string().min(1).max(600) }),
  z.object({ type: z.literal('transfer'), text: z.string().min(1).max(600), choice: z.number().int().min(0).max(6).nullable() }),
  /** Learning Gap Recovery: answer a targeted verification (or recheck) question about a suspected prerequisite */
  z.object({ type: z.literal('prereq'), prereqId: z.string().max(40), questionId: z.string().max(40), choice: z.number().int().min(0).max(6) }),
  z.object({ type: z.literal('remedy'), prereqId: z.string().max(40) }),
]);
export type StudentOp = z.infer<typeof StudentOp>;

const Code = z.string().regex(/^[A-Z2-9]{6}$/);

/** POST /api/room */
export const RoomRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), settings: RoomSettings }),
  z.object({ action: z.literal('join'), code: Code, alias: z.string().max(20).optional() }),
  z.object({
    action: z.literal('view'), code: Code, role: z.enum(['teacher', 'student', 'screen']),
    teacherKey: z.string().max(80).optional(), participantId: z.string().max(60).optional(), key: z.string().max(80).optional(),
    /** the version the client already has: the server may answer {unchanged:true} */
    since: z.string().max(40).optional(),
  }),
  z.object({ action: z.literal('teacher'), code: Code, teacherKey: z.string().max(80), op: TeacherOp }),
  z.object({ action: z.literal('student'), code: Code, participantId: z.string().max(60), key: z.string().max(80), op: StudentOp }),
]);
export type RoomRequest = z.infer<typeof RoomRequest>;

export type RoomError =
  | 'bad_request' | 'no_room' | 'room_closed' | 'forbidden' | 'room_full' | 'wrong_phase'
  | 'locked' | 'rate_limited' | 'store_failed' | 'network';

export interface HypothesisGroup {
  key: string;
  ideas: string[];
  status: DiagnosisStatus | 'waiting';
  count: number;
  /** anonymous quotes in the learners' words; only in teacher view and during discussion */
  quotes: string[];
}

export interface PredictionTally { outcome: string; count: number }

export interface Aggregates {
  participants: number;
  explained: number;
  predicted: number;
  revised: number;
  transferred: number;
  /** from the map phase */
  groups: HypothesisGroup[] | null;
  /** from the reveal phase */
  predictions: PredictionTally[] | null;
  /** from the observe phase */
  result: { outcome: string; byGroup: { key: string; ideas: string[]; outcome: string; contradicted: boolean; count: number; model: ChildModel }[] } | null;
  /** from the discuss/revise phases on */
  revisedGroups: HypothesisGroup[] | null;
  /** in the insight phase: how many moved between initial and revised groups */
  transitions: { from: string; to: string; count: number }[] | null;
}

export interface TeacherRoomView { role: 'teacher'; version: string; meta: RoomMeta; participants: RoomParticipant[] }
export interface ScreenRoomView { role: 'screen'; version: string; meta: RoomMeta; agg: Aggregates }
export interface StudentRoomView { role: 'student'; version: string; meta: RoomMeta; me: RoomParticipant; agg: Aggregates }
export type RoomView = TeacherRoomView | ScreenRoomView | StudentRoomView;

/* ───────────────────────── AI endpoints ───────────────────────── */

export const BrainContext = z.object({
  pack: z.string(),
  lang: Lang,
  /** earlier explanations of this learner, oldest first */
  previous: z.array(z.object({ text: z.string(), status: DiagnosisStatus, ideas: z.array(z.string()) })).max(8),
});
export type BrainContext = z.infer<typeof BrainContext>;

/** POST /api/diagnose */
export const DiagnoseRequest = z.object({ text: z.string().min(1).max(600), context: BrainContext });
export type DiagnoseRequest = z.infer<typeof DiagnoseRequest>;

/** POST /api/teach and /api/transfer */
export const AssessRequest = z.object({ pack: z.string(), lang: Lang, text: z.string().min(1).max(600) });
export type AssessRequest = z.infer<typeof AssessRequest>;

export const TeachResult = z.object({ caught: z.boolean(), steps: z.array(StepEvidence).length(3), source: z.enum(['ai', 'fallback']) });
export type TeachResult = z.infer<typeof TeachResult>;

export const TransferResult = z.object({ steps: z.array(StepEvidence).length(3), source: z.enum(['ai', 'fallback']) });
export type TransferResult = z.infer<typeof TransferResult>;

export const ACTIVITY_TYPES = ['experiment', 'discussion', 'game', 'peer', 'worksheet', 'escape', 'assessment'] as const;
export const ActivityKind = z.enum(ACTIVITY_TYPES);

/** POST /api/activity — counts only: no names and no learner quotes leave the teacher's device. */
export const ActivityRequest = z.object({
  pack: z.string(),
  lang: Lang,
  type: ActivityKind,
  minutes: z.number().int().min(5).max(90),
  grade: z.number().int().min(1).max(12),
  classSize: z.number().int().min(1).max(60),
  resources: z.array(z.string()).max(40),
  accessibility: z.string().max(300),
  objective: z.string().max(80).optional(),
  evidence: z.object({
    total: z.number().int().min(0).max(200),
    ideas: z.array(z.object({ id: z.string(), count: z.number().int().min(0).max(200) })).max(12),
    correct: z.number().int().min(0),
    partial: z.number().int().min(0),
    unclear: z.number().int().min(0),
    gaps: z.array(z.object({ id: z.string(), count: z.number().int().min(0) })).max(10),
  }),
});
export type ActivityRequest = z.infer<typeof ActivityRequest>;

export const ActivityPlan = z.object({
  title: z.string(),
  type: ActivityKind,
  /** why this suits this class now */
  why: z.string(),
  /** the learning problem it targets */
  target: z.string(),
  objective: z.string(),
  grouping: z.string(),
  materials: z.array(z.string()).max(12),
  minutes: z.number(),
  steps: z.array(z.object({ minutes: z.number(), title: z.string(), detail: z.string() })).min(2).max(8),
  teacher: z.string(),
  check: z.string(),
  adapt: z.string(),
  source: z.enum(['ai', 'fallback']),
});
export type ActivityPlan = z.infer<typeof ActivityPlan>;

/** POST /api/lesson — Adaptive Lesson Studio: a draft for the teacher to review, never executable content. */
export const LessonInput = z.object({
  lang: Lang,
  title: z.string().min(2).max(120),
  content: z.string().max(4000),
  subject: z.string().max(60),
  grade: z.number().int().min(1).max(12),
  objectives: z.string().max(800),
  minutes: z.number().int().min(5).max(120),
  resources: z.string().max(400),
  accessibility: z.string().max(300),
});
export type LessonInput = z.infer<typeof LessonInput>;

const lines = z.array(z.string()).max(10);
export const LessonDraft = z.object({
  title: z.string(),
  objectives: lines,
  concepts: lines,
  prerequisites: lines,
  misconceptions: z.array(z.object({ idea: z.string(), probe: z.string() })).max(8),
  questions: lines,
  experiments: z.array(z.object({ title: z.string(), steps: lines, materials: lines, safety: z.string() })).max(5),
  activities: z.array(z.object({ title: z.string(), minutes: z.number(), detail: z.string() })).max(8),
  assessment: lines,
  transfer: lines,
  guidance: lines,
  /** id of a fully supported pack that covers this topic, or null */
  matchedPack: z.string().nullable(),
  source: z.enum(['ai', 'fallback']),
});
export type LessonDraft = z.infer<typeof LessonDraft>;

export interface Health { ai: boolean; model: string | null; stt: boolean; tts: boolean; store: 'redis' | 'memory' | null; online: boolean }
