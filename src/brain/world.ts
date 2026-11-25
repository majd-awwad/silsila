/**
 * The deterministic engine. The AI only interprets the child's words into a ChildModel;
 * every experiment result, in both worlds, is computed here from the pack's rules.
 * No hallucinated physics, and every result is testable.
 */
import type { ChildModel, Conditions, ExperimentRun } from '../contracts';
import type { ConceptPack, Preset } from '../packs/types';

export function conditionsFor(pack: ConceptPack, change: Conditions = {}): Conditions {
  return { ...pack.baseline, ...change };
}

export function presetConditions(pack: ConceptPack, presetId: string): Conditions {
  const p = pack.presets.find((x) => x.id === presetId);
  return conditionsFor(pack, p?.change ?? {});
}

export interface Comparison {
  kid: string;
  real: string;
  /** the experiment breaks the child's idea */
  contradicted: boolean;
}

export function compare(pack: ConceptPack, model: ChildModel, cond: Conditions): Comparison {
  const kid = pack.kidOutcome(model, cond);
  const real = pack.realOutcome(cond);
  return { kid, real, contradicted: !pack.matches(kid, real) };
}

/**
 * Adaptive experiment selection: the preset whose real result breaks this idea.
 * When the idea has two parts (e.g. melting ice AND leaking water), prefer the experiment that breaks
 * every part at once, so the child cannot keep the other half. Then prefer ones not run yet.
 */
export function pickBestPreset(pack: ConceptPack, model: ChildModel, done: ExperimentRun[] = []): Preset | null {
  const scored = pack.presets
    .map((p, order) => {
      const cond = conditionsFor(pack, p.change);
      if (!compare(pack, model, cond).contradicted) return null;
      const partsBroken = model.sources.filter((s) => compare(pack, { ...model, sources: [s] }, cond).contradicted).length;
      const fresh = done.some((d) => d.preset === p.id) ? 0 : 1;
      return { p, key: fresh * 100 + partsBroken * 10 - order * 0.1 };
    })
    .filter((x): x is { p: Preset; key: number } => !!x)
    .sort((a, b) => b.key - a.key);
  return scored[0]?.p ?? null;
}

/** Same conditions? (used to recognise when a custom combination equals a preset) */
export function sameConditions(a: Conditions, b: Conditions): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

export function presetFor(pack: ConceptPack, cond: Conditions): Preset | null {
  return pack.presets.find((p) => sameConditions(conditionsFor(pack, p.change), cond)) ?? null;
}

/** Is this model (as interpreted) the scientific one? It survives every preset. */
export function survivesAll(pack: ConceptPack, model: ChildModel): boolean {
  return pack.presets.every((p) => !compare(pack, model, conditionsFor(pack, p.change)).contradicted);
}
