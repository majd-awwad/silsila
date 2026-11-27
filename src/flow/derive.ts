/**
 * Pure readers of a lesson's event log: what the learner's current idea is, whether they are stuck, which help
 * comes next, what Noor can say from what she was taught, and which experiment to offer. No fetches, no timers.
 * Everything about the world comes from the pack's deterministic functions.
 */
import type { BrainContext, Conditions, Diagnosis, EventOf, Lang, LearnerEvent, LearnerRecord, PlanResult } from '../contracts';
import { CHAIN_IDS } from '../contracts';
import { learningDNA } from '../brain/evidence';
import type { NodeStatus } from '../brain/evidence';
import { DEFAULT_CONSTRAINTS, plan } from '../brain/planner';
import { eventsOf, hypothesesOf, lastEvent, groupKey } from '../brain/records';
import { compare, conditionsFor, experimentById, outcomeMatches } from '../brain/world';
import type { ConceptPack, Experiment } from '../packs/types';

/**
 * A learner who is still stuck after this many different tries is not left to struggle: they get guided help once,
 * retell it in their own words, and the record shows it was assisted (decision of 25/11).
 */
export const STUCK_AFTER = 3;
/** unclear answers in a row before «try an experiment first» is offered */
export const SKIP_AFTER_UNCLEAR = 3;
/** how many times the learner may add to Noor's attempt before the lesson moves on */
export const CHALLENGE_RETRIES = 2;
export const GUIDED_LEVEL = 4;
export const TEACHER_LEVEL = 5;

/* ───────── the learner's idea ───────── */

/** The latest explanation that gave the engine something to run. Unclear answers never replace an idea. */
export function currentExplanation(r: LearnerRecord): EventOf<'explain'> | null {
  return eventsOf(r, 'explain').filter((e) => e.diagnosis.model).at(-1) ?? null;
}
export const currentDiagnosis = (r: LearnerRecord): Diagnosis | null => currentExplanation(r)?.diagnosis ?? null;

export const observations = (r: LearnerRecord) => eventsOf(r, 'observe');
/** The learner has seen something for themselves (a result) or has taught Noor. */
export const hasEvidence = (r: LearnerRecord) => r.events.some((e) => e.type === 'observe' || e.type === 'teach');

export const observationContradicts = (pack: ConceptPack, o: EventOf<'observe'>): boolean =>
  !!o.hypothesis && !outcomeMatches(pack, o.hypothesis, o.real);

/** Did an experiment run after this explanation show a result its idea does not predict? */
export function shownWrong(pack: ConceptPack, r: LearnerRecord, explanation: EventOf<'explain'>): boolean {
  const model = explanation.diagnosis.model;
  if (!model) return false;
  const from = r.events.indexOf(explanation);
  return from >= 0 && r.events.slice(from + 1).some((e) => e.type === 'observe' && compare(pack, model, e.cond).contradicted);
}

/** The record as a learner may see it: a link is marked only after their own experiment showed it. */
export const childSafeRecord = (pack: ConceptPack, r: LearnerRecord): LearnerRecord => ({
  ...r,
  events: r.events.map((e) => (e.type === 'explain' && !shownWrong(pack, r, e) ? { ...e, diagnosis: { ...e.diagnosis, wrongStep: null } } : e)),
});

export const conditionsKey = (c: Conditions) => JSON.stringify(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));

/** Different experiments that contradicted the idea since the explanation last changed. */
export function stuckCount(pack: ConceptPack, r: LearnerRecord): number {
  let idea: string | null = null;
  const tried = new Set<string>();
  for (const e of r.events) {
    if (e.type === 'explain' && e.diagnosis.model) {
      const key = groupKey(pack, e.diagnosis);
      if (key !== idea) { idea = key; tried.clear(); }
    } else if (e.type === 'observe' && observationContradicts(pack, e)) tried.add(conditionsKey(e.cond));
  }
  return tried.size;
}

/* ───────── teaching Noor ───────── */

/** Replies to Noor's planted mistake (answers during her challenge are not corrections of it). */
export function teachTries(r: LearnerRecord): EventOf<'teach'>[] {
  const out: EventOf<'teach'>[] = [];
  let before: LearnerEvent['type'] | null = null;
  for (const e of r.events) {
    if (e.type === 'teach' && before !== 'challenge') out.push(e);
    if (e.type !== 'assist') before = e.type;
  }
  return out;
}

/** Corrections that did not work since the last one that did. */
export function teachFailures(r: LearnerRecord): number {
  let n = 0;
  for (const e of teachTries(r)) n = e.caught ? 0 : n + 1;
  return n;
}

/** Which of the three steps the learner has actually expressed, in explanations or while teaching. */
export function knownSteps(r: LearnerRecord): boolean[] {
  return [0, 1, 2].map((i) => r.events.some((e) =>
    (e.type === 'explain' && !!e.diagnosis.steps[i]?.met) || (e.type === 'teach' && !!e.steps[i]?.met)));
}

export interface NoorAttempt {
  known: boolean[];
  solved: boolean;
  /** Noor's sentences for the steps the learner taught, and nothing else */
  says: string[];
  /** her question about the first step nobody told her */
  ask: string | null;
}

export function noorAttempt(pack: ConceptPack, r: LearnerRecord, lang: Lang = r.lang): NoorAttempt {
  const known = knownSteps(r);
  const missing = known.indexOf(false);
  return {
    known,
    solved: missing === -1,
    says: pack.steps.filter((_, i) => known[i]).map((s) => s.noorSays[lang]),
    ask: missing === -1 ? null : pack.steps[missing].noorAsks[lang],
  };
}

/** Attempts Noor has made in the challenge that is currently running. */
export function challengeAttempts(r: LearnerRecord): number {
  let n = 0;
  for (const e of r.events) {
    if (e.type === 'challenge') n++;
    else if (e.type !== 'teach' && e.type !== 'assist') n = 0;
  }
  return n;
}

export const canAnswerChallenge = (r: LearnerRecord): boolean => {
  const last = lastEvent(r, 'challenge');
  return !!last && !last.solved && challengeAttempts(r) <= CHALLENGE_RETRIES;
};

/* ───────── scaffolding ladder ───────── */

export const helpLevel = (r: LearnerRecord): number => eventsOf(r, 'assist').reduce((m, e) => Math.max(m, e.level), 0);
export const gotGuidance = (r: LearnerRecord): boolean => eventsOf(r, 'assist').some((e) => e.level === GUIDED_LEVEL);
/** help the learner is looking at: nothing has happened since it was given */
export function openHelp(r: LearnerRecord): number | null {
  const last = r.events.at(-1);
  return last?.type === 'assist' ? last.level : null;
}

/**
 * The next rung. Guided instruction says what the idea is, so it is locked until the learner has seen a result of
 * their own (or tried to teach Noor).
 */
export function nextHelp(r: LearnerRecord): { level: number; locked: boolean } {
  const level = Math.min(TEACHER_LEVEL, helpLevel(r) + 1);
  return { level, locked: level === GUIDED_LEVEL && !hasEvidence(r) };
}

export const shouldGuide = (pack: ConceptPack, r: LearnerRecord): boolean => stuckCount(pack, r) >= STUCK_AFTER && !gotGuidance(r);

export const unclearInARow = (r: LearnerRecord): number => {
  const ex = eventsOf(r, 'explain');
  let n = 0;
  while (n < ex.length && !ex[ex.length - 1 - n].diagnosis.model) n++;
  return n;
};

/** Should the app offer help before being asked? */
export function offerHelp(pack: ConceptPack, r: LearnerRecord, step: string): boolean {
  if (openHelp(r) !== null) return false;
  if (step === 'clarify') return unclearInARow(r) >= 2;
  if (step === 'teach') return teachFailures(r) >= 1;
  if (step === 'reflect') {
    // two tests in a row that could not tell the idea and the result apart
    const last = observations(r).slice(-2);
    const status = currentDiagnosis(r)?.status;
    return (status === 'misconception' || status === 'multiple') && last.length === 2
      && last.every((o) => o.hypothesis && !observationContradicts(pack, o));
  }
  return false;
}

/* ───────── language calls ───────── */

/**
 * The text to analyse. A follow-up to a partial explanation is read together with what the learner already said,
 * so «the missing link» completes their own explanation instead of replacing it.
 */
export function explanationText(r: LearnerRecord, step: string, input: string): string {
  const said = input.trim();
  const last = lastEvent(r, 'explain');
  if (step !== 'clarify' || last?.diagnosis.status !== 'partial') return said;
  const joined = `${last.text.replace(/[.؟?!،,\s]+$/, '')}. ${said}`;
  return joined.length <= 600 ? joined : said;
}

export const brainContext = (pack: ConceptPack, r: LearnerRecord, lang: Lang): BrainContext => ({
  pack: pack.id,
  lang,
  previous: eventsOf(r, 'explain').slice(-8).map((e) => ({ text: e.text, status: e.diagnosis.status, ideas: e.diagnosis.ideas.map((i) => i.id) })),
});

/* ───────── experiments ───────── */

export function planFor(pack: ConceptPack, r: LearnerRecord): PlanResult {
  const current = currentExplanation(r);
  const hypotheses = current ? hypothesesOf(pack, [{ ...r, events: [current] }]) : [];
  const done = observations(r).flatMap((o) => (o.experimentId ? [o.experimentId] : []));
  return plan(pack, hypotheses, { ...DEFAULT_CONSTRAINTS, grade: r.grade, exclude: done });
}

/** The planner's choice; when it has none (idea already complete, or unclear), a test where something changes. */
export function recommendExperiment(pack: ConceptPack, r: LearnerRecord): Experiment | null {
  const result = planFor(pack, r);
  if (result.recommended) return experimentById(pack, result.recommended.id);
  const usual = pack.realOutcome(conditionsFor(pack));
  const pick = result.ranked.find((x) => x.real !== usual) ?? result.ranked[0];
  return pick ? experimentById(pack, pick.id) : null;
}

/** What the learner may predict: the experiment's choices, or every outcome for their own combination. */
export const choicesFor = (pack: ConceptPack, experimentId: string | null): string[] =>
  experimentById(pack, experimentId)?.choices ?? Object.keys(pack.outcomes);

/* ───────── after the lesson ───────── */

export interface NextSteps { recheck: Experiment | null; nextPack: ConceptPack | null }

export function nextSteps(pack: ConceptPack, r: LearnerRecord, packs: ConceptPack[]): NextSteps {
  const dna = learningDNA(pack, r);
  const weak: NodeStatus[] = ['misconception', 'insufficient', 'assisted', 'partial'];
  let recheck: Experiment | null = null;
  for (const status of weak) {
    for (const node of CHAIN_IDS) {
      if (dna[node].status !== status) continue;
      recheck ??= pack.experiments.find((x) => x.targets.includes(node) && x.minGrade <= r.grade) ?? null;
    }
  }
  const fits = (p: ConceptPack) => r.grade >= p.grades[0] && r.grade <= p.grades[1];
  const rank = (p: ConceptPack) => (p.subject === pack.subject ? 0 : 2) + (fits(p) ? 0 : 1);
  const at = packs.findIndex((p) => p.id === pack.id);
  const after = [...packs.slice(at + 1), ...packs.slice(0, Math.max(0, at))].filter((p) => p.id !== pack.id);
  const nextPack = [...after].sort((a, b) => rank(a) - rank(b))[0] ?? null;
  return { recheck, nextPack };
}

/** The experiment to repeat at home: the one that surprised the learner, else the last they ran. */
export function homeExperiment(pack: ConceptPack, r: LearnerRecord): Experiment | null {
  const named = observations(r).filter((o) => experimentById(pack, o.experimentId));
  const surprising = named.find((o) => observationContradicts(pack, o)) ?? named.at(-1);
  return experimentById(pack, surprising?.experimentId) ?? pack.experiments.find((x) => x.minGrade <= r.grade) ?? pack.experiments[0] ?? null;
}
