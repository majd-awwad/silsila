/**
 * Concept Pack: everything that makes one lesson. The engine, brain and screens are shared;
 * a new concept = a new pack (+ a scene behaviour in src/scene/behaviours if it needs new visuals).
 * All child-facing text is Palestinian Arabic.
 */
import type { ChainId, ChildModel, Conditions } from '../contracts';

export interface IdeaPart {
  label: string;
  /** how the child's causal story usually goes for this idea (fallback for child_chain) */
  story: string[];
  /** index into story of the wrong step, or null if this is the scientific idea */
  wrongStep: number | null;
  /** description for the AI prompt (English) */
  ai: string;
}

export interface VariableDef {
  id: string;
  label: string;
  options: { id: string; label: string }[];
}

export interface Preset {
  id: string;
  name: string;
  short: string;
  /** only the variables that differ from the pack's baseline */
  change: Conditions;
  home: string;
  safety: string;
}

export interface QuizQuestion { q: string; options: string[]; correct: number; link: ChainId }

export interface KeywordRule {
  re: RegExp;
  /** skip this rule when this also matches */
  unless?: RegExp;
  sources: string[];
  path: string;
  requires?: string[];
  caption: string;
}

export interface ActivityTemplate {
  title: string;
  goal: string;
  materials: string[];
  steps: { minutes: number; title: string; detail: string }[];
  check: string;
}

export interface ConceptPack {
  id: string;
  title: string;
  subject: string;
  grades: string;
  /** where this lesson comes from in the Palestinian curriculum (checked against the printed book) */
  curriculum: { book: string; unit: string; lesson: string; pages: string; note?: string };
  question: string;
  /** scene behaviour id in src/scene/behaviours */
  scene: 'condensation' | 'evaporation';

  /** vocabulary the AI composes a child's idea from */
  sources: Record<string, IdeaPart>;
  paths: Record<string, { label: string; ai: string }>;
  requires: Record<string, { label: string; ai: string }>;
  correctModel: ChildModel;

  /** three causal steps of the scientific explanation (rubric s1..s3) */
  scienceChain: [string, string, string];
  chain: Record<ChainId, { label: string; ai: string }>;

  variables: VariableDef[];
  baseline: Conditions;
  presets: Preset[];
  outcomes: Record<string, string>;
  /** what the child's idea predicts under these conditions (deterministic) */
  kidOutcome(model: ChildModel, cond: Conditions): string;
  /** what really happens (deterministic, from the science) */
  realOutcome(cond: Conditions): string;
  /** is the kid's predicted outcome close enough to reality not to count as broken? */
  matches(kid: string, real: string): boolean;

  noor: {
    greeting: string;
    planted: string;
    /** for the AI: why the planted claim is wrong */
    plantedTruth: string;
    afterContradiction: string;
    afterMatch: string;
    sameResult: string;
    clarifyLadder: [string, string, string];
    caughtThanks: string;
    stillConfused: string;
    challengeIntro: string;
    transferIntro: string;
    /** Noor's gentle explanation when the child is stuck after STUCK_AFTER tries (pack content, never model-written) */
    reveal: string;
  };
  /** words that give the answer away; Noor must not say them before the child does */
  answerWords: RegExp;
  /** Noor's challenge: a new phenomenon Noor explains using only the child's teaching */
  challenge: { phenomenon: string; correctAnswer: string };
  /** the child's own transfer question */
  transfer: { question: string };

  /** detects the full correct idea in the offline fallback */
  correctRule: { s1: RegExp; s2: RegExp; s3: RegExp };
  teachCaught: RegExp;
  keywordRules: KeywordRule[];
  samplePhrases: string[];
  preTest: QuizQuestion[];
  postTest: QuizQuestion[];
  /** teacher activity fallback, by the most common wrong idea (source id) */
  activities: Record<string, ActivityTemplate>;
}
