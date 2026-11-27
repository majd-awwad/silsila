/**
 * The deterministic engine. The language model only interprets the learner's words into a hypothesis;
 * every experiment result, in both worlds, is computed here from the pack's rules.
 */
import type { ChildModel, Conditions } from '../contracts';
import type { ConceptPack, Experiment } from '../packs/types';

export function conditionsFor(pack: ConceptPack, change: Conditions = {}): Conditions {
  return { ...pack.baseline, ...change };
}

export function experimentById(pack: ConceptPack, id: string | null | undefined): Experiment | null {
  return pack.experiments.find((x) => x.id === id) ?? null;
}

export function experimentConditions(pack: ConceptPack, id: string): Conditions {
  return conditionsFor(pack, experimentById(pack, id)?.change ?? {});
}

/** Do these conditions use only variables and options the pack supports? */
export function validConditions(pack: ConceptPack, cond: Conditions): boolean {
  return pack.variables.every((v) => v.options.some((o) => o.id === cond[v.id]));
}

export interface Comparison {
  /** what the learner's idea predicts */
  kid: string;
  /** what the reference model says */
  real: string;
  /** the experiment breaks the idea */
  contradicted: boolean;
}

export const outcomeMatches = (pack: ConceptPack, predicted: string, real: string): boolean =>
  pack.matches ? pack.matches(predicted, real) : predicted === real;

export function compare(pack: ConceptPack, model: ChildModel, cond: Conditions): Comparison {
  const kid = pack.kidOutcome(model, cond);
  const real = pack.realOutcome(cond);
  return { kid, real, contradicted: !outcomeMatches(pack, kid, real) };
}

export function sameConditions(a: Conditions, b: Conditions): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

/** The named experiment equal to these conditions, if any. */
export function experimentFor(pack: ConceptPack, cond: Conditions): Experiment | null {
  return pack.experiments.find((x) => sameConditions(conditionsFor(pack, x.change), cond)) ?? null;
}

/** Is this the scientific model on everything the pack can test? */
export function survivesAll(pack: ConceptPack, model: ChildModel): boolean {
  return [{}, ...pack.experiments.map((x) => x.change)].every((c) => !compare(pack, model, conditionsFor(pack, c)).contradicted);
}
