import type { ChildModel, ExperimentId, ExperimentRun, Outcome, Path, Predictions, Source } from '../contracts';
import { EXPERIMENT_IDS } from '../contracts';
import { EXPERIMENTS } from '../lesson/condensation';

/** Does what the child's idea predicts survive what really happens? */
export function outcomeMatches(exp: ExperimentId, predicted: Outcome): boolean {
  const real = EXPERIMENTS[exp].real;
  if (exp === 'E_color') return predicted === 'clear';
  // "fewer" in reality: an idea that says "none" is close enough to not be contradicted
  if (real === 'fewer') return predicted === 'fewer' || predicted === 'none';
  return predicted === real;
}

/**
 * What the child's idea implies, worked out in code from its parts.
 * Used when the AI leaves a prediction out, and by the offline fallback.
 */
export function derivePredictions(m: { sources: Source[]; path: Path; needs_cold: boolean }): Predictions {
  const s = new Set(m.sources);
  const onlyInside = m.sources.length > 0 && m.sources.every((x) => x === 'inside_water' || x === 'ice');
  return {
    E_color: s.has('inside_water') ? 'blue' : 'clear',
    E_empty: onlyInside ? 'none' : 'drops',
    E_cover: m.path === 'over_rim' && onlyInside ? 'none' : 'drops',
    E_warm: m.needs_cold || s.has('cold_itself') || s.has('air_vapor') || s.has('ice') ? 'none' : 'drops',
    E_dry: s.has('air_vapor') ? 'fewer' : 'drops',
  };
}

const PRIORITY: ExperimentId[] = ['E_color', 'E_empty', 'E_warm', 'E_cover', 'E_dry'];

/** The experiment whose real result breaks this idea, preferring ones not run yet. */
export function pickBestExperiment(model: ChildModel, done: ExperimentRun[] = []): ExperimentId | null {
  const breaks = PRIORITY.filter((e) => !outcomeMatches(e, model.predictions[e]));
  const fresh = breaks.find((e) => !done.some((d) => d.exp === e));
  return fresh ?? breaks[0] ?? null;
}

export function isExperimentId(x: unknown): x is ExperimentId {
  return typeof x === 'string' && (EXPERIMENT_IDS as readonly string[]).includes(x);
}

/** The scientifically correct model, used for the real world and after the child gets it. */
export const CORRECT_MODEL: ChildModel = {
  sources: ['air_vapor'],
  path: 'from_air',
  needs_cold: true,
  predictions: { E_color: 'clear', E_empty: 'drops', E_cover: 'drops', E_warm: 'none', E_dry: 'fewer' },
};
