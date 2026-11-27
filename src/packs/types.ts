/**
 * Concept Pack v2: everything that makes one lesson, as data + two pure outcome functions.
 * The engine (src/brain), the screens and the server are shared; a new concept = a new pack + a 2D scene
 * in src/scenes. All child-facing text is bilingual: Palestinian Arabic (`ar`) and simple English (`en`).
 *
 * Rules every pack must keep (tests/packs.test.ts checks them):
 *  - exactly one idea has `correct: true`, and `correctModel` survives every experiment;
 *  - every other idea is contradicted by at least one experiment;
 *  - `kidOutcome` and `realOutcome` are pure and return a key of `outcomes`;
 *  - every experiment's `choices` contain the real outcome;
 *  - authored child-facing hints/questions never contain `answerWords` (except `hints[3]`, the guided one).
 */
import type { ChainId, ChildModel, Conditions, L } from '../contracts';
import type { ResourceId } from './resources';

export type Subject = 'science' | 'math';

/** One way a learner can think about the phenomenon (the scientific idea is one of them). */
export interface Idea {
  /** short name for chips and maps */
  label: L;
  /** «هيك إنت شايفها: …» authored restatement of the idea (never model-written) */
  mirror: L;
  /** what the learner probably noticed */
  observation: L;
  /** the hidden reasoning assumption */
  assumption: L;
  /** what they conclude from it */
  conclusion: L;
  /** their causal story, 2–4 very short steps in their logic */
  story: L[];
  /** index into story of the first wrong step; null for the scientific idea */
  wrongStep: number | null;
  correct?: boolean;
  /** which concept node this idea gets wrong (null for the scientific idea) */
  breaks: ChainId | null;
  /** the hypothesis the scene and the engine run for this idea */
  model: ChildModel;
  /** one concrete teacher move that investigates this idea */
  intervention: L;
  /** English description for the language model */
  ai: string;
}

export interface Variable {
  id: string;
  label: L;
  options: { id: string; label: L }[];
}

export interface Experiment {
  id: string;
  name: L;
  short: L;
  /** only the variables that differ from the baseline */
  change: Conditions;
  /** the prediction question shown BEFORE the result (must not reveal it) */
  question: L;
  /** outcome ids offered as predictions (must include the real one, at least 2) */
  choices: string[];
  /** classroom execution time */
  minutes: number;
  materials: ResourceId[];
  safety: { adult: boolean; note: L };
  minGrade: number;
  /** concept nodes this experiment investigates */
  targets: ChainId[];
  /** Real World Bridge: the same test with physical materials */
  home: { steps: L[]; record: L; reflect: L[] };
}

export interface ConceptNode {
  label: L;
  ai: string;
  /** knowledge-graph edges: concept nodes this one builds on */
  needs: ChainId[];
}

export interface Question {
  id: string;
  q: L;
  options: L[];
  correct: number;
  node?: ChainId;
}

/** A foundational idea the lesson builds on. Suspected from evidence, confirmed only by asking. */
export interface Prerequisite {
  id: string;
  label: L;
  why: L;
  supports: ChainId[];
  /** suspect this gap when the learner shows one of these ideas, or misses all of these steps (0..2) */
  suspect: { ideas: string[]; missingSteps: number[] };
  /** two short verification questions */
  verify: [Question, Question];
  remedy: { title: L; minutes: number; steps: L[] };
  recheck: Question;
}

export interface Step {
  /** the scientific step, shown only after discovery or to teacher/judge */
  text: L;
  /** which concept node expressing this step is evidence for */
  node: ChainId;
  /** offline detection in the learner's words (Arabic is tested after normaliseArabic; English lowercased) */
  test: RegExp;
  /** Noor's own sentence for this step; used ONLY after the learner taught it to her */
  noorSays: L;
  /** Noor's question when the step is missing; must not reveal the step */
  noorAsks: L;
}

/** Offline keyword rule → idea. Matching phrases that are negated by the learner do not count. */
export interface Rule {
  re: RegExp;
  idea: string;
  /** skip this rule when this also matches anywhere in the text */
  unless?: RegExp;
}

export type ActivityType = 'experiment' | 'discussion' | 'game' | 'peer' | 'worksheet' | 'escape' | 'assessment';

export interface ActivityTemplate {
  type: ActivityType;
  title: L;
  goal: L;
  grouping: L;
  materials: ResourceId[];
  steps: { minutes: number; title: L; detail: L }[];
  teacher: L;
  check: L;
  adapt: L;
}

export interface Curriculum {
  /** true only when checked against the printed book */
  verified: boolean;
  /** book, unit, lesson, pages; or why it is not verified */
  note: L;
}

export interface ConceptPack {
  id: string;
  subject: Subject;
  title: L;
  /** the mysterious phenomenon, as Noor asks it */
  question: L;
  grades: [number, number];
  curriculum: Curriculum;
  objectives: { id: string; text: L; nodes: ChainId[] }[];
  concepts: Record<ChainId, ConceptNode>;
  prerequisites: Prerequisite[];
  /** the scientific/mathematical reference model behind realOutcome, with its limits and sources */
  reference: { model: L; limits: L; sources: { title: string; url?: string }[] };

  ideas: Record<string, Idea>;
  paths: Record<string, { label: L; ai: string }>;
  requires: Record<string, { label: L; ai: string }>;
  correctModel: ChildModel;
  steps: [Step, Step, Step];

  variables: Variable[];
  baseline: Conditions;
  experiments: Experiment[];
  outcomes: Record<string, L>;
  /** what the learner's idea predicts under these conditions (deterministic) */
  kidOutcome(model: ChildModel, cond: Conditions): string;
  /** the reference model (deterministic) */
  realOutcome(cond: Conditions): string;
  /** is the predicted outcome close enough to reality not to count as contradicted? default: equal */
  matches?(predicted: string, real: string): boolean;
  /** optional exact reading shown with the result (e.g. shadow height, area) */
  measure?(cond: Conditions): L | null;
  /** has a 3D mirror scene (otherwise only the 2D scene) */
  scene3d?: 'condensation' | 'evaporation';

  noor: {
    greeting: L;
    /** after the learner's idea is understood: invite them to predict and test it */
    invite: L;
    afterContradiction: L;
    afterMatch: L;
    sameResult: L;
    /** praise for a complete explanation, asking to be taught */
    praise: L;
    /** praise for what is right in a partial explanation, asking for more */
    partial: L;
    contradiction: L;
    offtopic: L;
    /** the idea is valid but cannot be simulated here */
    unsupported: L;
  };
  /** progressive scaffolding: neutral reflection → attention → focused clue → guided instruction */
  hints: [L, L, L, L];
  /** controlled clarification questions, from open to concrete; must not reveal the answer */
  clarify: { id: string; q: L; ai: string }[];
  /** words that give the answer away; Noor must not say them before the learner does */
  answerWords: RegExp;
  teach: {
    /** Noor's planted mistake */
    planted: L;
    /** English: why the planted claim is wrong */
    truth: string;
    /** offline: the reply rejects the mistake with a reason */
    accept: RegExp;
    /** offline: the reply agrees with the mistake */
    reject: RegExp;
    thanks: L;
    confused: L;
  };
  /** Noor attempts a new phenomenon using only the steps the learner taught */
  challenge: { phenomenon: L; solved: L };
  /** the learner's own new situation: free explanation + one checked question */
  transfer: { prompt: L; check: Question };
  rules: Rule[];
  samples: L[];
  preTest: Question[];
  postTest: Question[];
  /** by idea id, plus '_default' and '_enrich' */
  activities: Record<string, ActivityTemplate>;
}
