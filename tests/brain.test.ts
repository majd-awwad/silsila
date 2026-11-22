import { describe, expect, it } from 'vitest';
import type { BrainContext } from '../src/contracts';
import { Diagnosis } from '../src/contracts';
import { heuristicDiagnose, heuristicTeach } from '../src/brain/heuristic';
import { guardNoor, normaliseDiagnosis } from '../src/brain/normalise';
import { derivePredictions, outcomeMatches, pickBestExperiment } from '../src/brain/predictions';
import { NOOR } from '../src/lesson/condensation';

const ctx: BrainContext = { phase: 'explain', previous: [], experiments: [] };

describe('predictions', () => {
  it('a leaking-water idea predicts blue drops, so colouring the water breaks it', () => {
    const p = derivePredictions({ sources: ['inside_water'], path: 'through_wall', needs_cold: false });
    expect(p.E_color).toBe('blue');
    expect(outcomeMatches('E_color', p.E_color)).toBe(false);
  });
  it('the correct idea survives every experiment', () => {
    const p = derivePredictions({ sources: ['air_vapor'], path: 'from_air', needs_cold: true });
    for (const e of ['E_color', 'E_empty', 'E_cover', 'E_warm', 'E_dry'] as const) expect(outcomeMatches(e, p[e])).toBe(true);
  });
  it('picks an experiment not run yet', () => {
    const model = { sources: ['inside_water' as const], path: 'through_wall' as const, needs_cold: false, predictions: derivePredictions({ sources: ['inside_water'], path: 'through_wall', needs_cold: false }) };
    expect(pickBestExperiment(model)).toBe('E_color');
    expect(pickBestExperiment(model, [{ exp: 'E_color', predicted: 'blue', real: 'clear', contradicted: true, at: 0 }])).toBe('E_empty');
  });
});

describe('normalise', () => {
  it('turns garbage into a valid diagnosis instead of crashing', () => {
    const d = normaliseDiagnosis({ status: 'banana', sources: ['x'], chain: 7 }, 'hi', ctx, 'ai');
    expect(Diagnosis.safeParse(d).success).toBe(true);
    expect(d.status).toBe('clarify');
  });
  it('replaces a best experiment that does not actually break the idea', () => {
    const d = normaliseDiagnosis({ status: 'model', sources: ['inside_water'], path: 'through_wall', best_experiment: 'E_cover', noor: 'شو بتتوقّع؟' }, 'المي بتنز', ctx, 'ai');
    expect(d.best_experiment).toBe('E_color');
  });
});

describe('answer guard', () => {
  it('blocks Noor from saying the answer word before the child does', () => {
    expect(guardNoor('هاد اسمه تكاثف بخار الماء', ['المي بتنز'], 'model')).toBe(NOOR.safeFallback);
  });
  it('allows it once the child used the word', () => {
    expect(guardNoor('يعني البخار بيبرد؟', ['في بخار بالهوا'], 'model')).toBe('يعني البخار بيبرد؟');
  });
});

describe('offline fallback', () => {
  it('understands common phrasings', () => {
    expect(heuristicDiagnose('المي بتنزّ من الكاسة لبرّا', ctx).model?.sources).toContain('inside_water');
    expect(heuristicDiagnose('الكاسة بتعرق', ctx).model?.sources).toContain('glass_itself');
    expect(heuristicDiagnose('ما بعرف', ctx).status).toBe('clarify');
    expect(heuristicDiagnose('في مي بالهوا بتبرد ع الكاسة وبتصير نقط', ctx).status).toBe('correct');
  });
  it('checks the teach-back', () => {
    expect(heuristicTeach('لا، رح يطلع نقط أقل لأنه الهوا الناشف فيه مي أقل').caught).toBe(true);
    expect(heuristicTeach('آه أكثر').caught).toBe(false);
  });
});
