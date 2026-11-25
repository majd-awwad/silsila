import { describe, expect, it } from 'vitest';
import type { BrainContext } from '../src/contracts';
import { Diagnosis } from '../src/contracts';
import { heuristicChallenge, heuristicDiagnose, heuristicTeach, heuristicTransfer, normaliseArabic } from '../src/brain/heuristic';
import { guardNoor, normaliseDiagnosis } from '../src/brain/normalise';
import { compare, conditionsFor, pickBestPreset, survivesAll } from '../src/brain/world';
import { PACK_LIST, getPack } from '../src/packs';

const cond = getPack('condensation');
const evap = getPack('evaporation');
const ctx = (pack = 'condensation'): BrainContext => ({ pack, phase: 'explain', previous: [], experiments: [] });

describe('deterministic engine: invariants every pack must keep', () => {
  for (const pack of PACK_LIST) {
    it(`${pack.id}: the scientific model survives every preset`, () => {
      expect(survivesAll(pack, pack.correctModel)).toBe(true);
    });
    it(`${pack.id}: every wrong idea has at least one experiment that breaks it`, () => {
      const correct = pack.correctModel.sources[0];
      for (const s of Object.keys(pack.sources).filter((x) => x !== correct)) {
        const path = Object.keys(pack.paths)[0];
        expect(pickBestPreset(pack, { sources: [s], path, requires: [] }), `${pack.id}/${s}`).not.toBeNull();
      }
    });
    it(`${pack.id}: the baseline matches what the child sees (no contradiction before any change)`, () => {
      const correct = pack.correctModel.sources[0];
      for (const s of Object.keys(pack.sources).filter((x) => x !== correct && x !== 'cold_itself')) {
        const m = { sources: [s], path: Object.keys(pack.paths)[0], requires: [] };
        expect(compare(pack, m, conditionsFor(pack)).contradicted, `${pack.id}/${s}`).toBe(false);
      }
    });
  }
  it('condensation: colouring the water breaks the leaking idea', () => {
    const m = { sources: ['inside_water'], path: 'through_wall', requires: [] };
    expect(compare(cond, m, conditionsFor(cond, { contents: 'blue' }))).toEqual({ kid: 'blue', real: 'drops', contradicted: true });
  });
  it('condensation: for melting ice + leaking, picks the experiment that breaks both parts', () => {
    expect(pickBestPreset(cond, { sources: ['ice', 'inside_water'], path: 'through_wall', requires: [] })?.id).toBe('E_empty');
  });
  it('evaporation: a lid breaks "the glass drinks it", darkness breaks "the sun pulls it"', () => {
    expect(pickBestPreset(evap, { sources: ['glass_drinks'], path: 'into_glass', requires: [] })?.id).toBe('V_lid');
    expect(pickBestPreset(evap, { sources: ['sun_pulls'], path: 'up_to_air', requires: ['sun'] })?.id).toBe('V_dark');
  });
});

describe('normalise', () => {
  it('turns garbage into a valid diagnosis instead of crashing', () => {
    const d = normaliseDiagnosis(cond, { status: 'banana', sources: ['x'], chain: 7 }, 'hi', ctx(), 'ai');
    expect(Diagnosis.safeParse(d).success).toBe(true);
    expect(d.status).toBe('clarify');
  });
  it('the experiment is chosen in code, whatever the model says', () => {
    const d = normaliseDiagnosis(cond, { status: 'model', sources: ['inside_water'], path: 'through_wall', best_experiment: 'E_cover', noor: 'شو بتتوقّع؟', confidence: 0.8 }, 'المي بتنز', ctx(), 'ai');
    expect(d.best_experiment).toBe('E_color');
  });
  it('low confidence → confirm with the child instead of assuming', () => {
    const d = normaliseDiagnosis(cond, { status: 'model', sources: ['inside_water'], path: 'through_wall', caption: 'هيك إنت شايفها: المي بتنز.', confidence: 0.2 }, 'يمكن', ctx(), 'ai');
    expect(d.status).toBe('clarify');
    expect(d.noor).toContain('لأتأكد');
  });
  it('fills the child chain from the idea when the model leaves it out, and marks the wrong step', () => {
    const d = normaliseDiagnosis(cond, { status: 'model', sources: ['inside_water'], path: 'through_wall', confidence: 0.8 }, 'x', ctx(), 'ai');
    expect(d.child_chain.length).toBeGreaterThan(1);
    expect(d.wrong_step).toBe(1);
  });
});

describe('answer guard', () => {
  it('blocks Noor from saying the answer word before the child does', () => {
    expect(guardNoor(cond, 'هاد اسمه تكاثف بخار الماء', ['المي بتنز'], 'model')).not.toContain('تكاثف');
  });
  it('allows it once the child used the word', () => {
    expect(guardNoor(cond, 'يعني البخار بيبرد؟', ['في بخار بالهوا'], 'model')).toBe('يعني البخار بيبرد؟');
  });
});

describe('offline fallback', () => {
  it('normalises stretched and variant letters', () => {
    expect(normaliseArabic('الكاااسة بتنززز')).toBe('الكاسه بتنز');
  });
  it('understands common phrasings in both packs', () => {
    expect(heuristicDiagnose(cond, 'المي بتنزّ من الكاسة لبرّا', ctx()).model?.sources).toContain('inside_water');
    expect(heuristicDiagnose(cond, 'ما بعرف', ctx()).status).toBe('clarify');
    expect(heuristicDiagnose(cond, 'في مي بالهوا بتبرد ع الكاسة وبتصير نقط', ctx()).status).toBe('correct');
    expect(heuristicDiagnose(evap, 'الشمس بتسحب المي', ctx('evaporation')).model?.sources).toContain('sun_pulls');
    expect(heuristicDiagnose(evap, 'لما المي تسخن بتتبخر وبتطير بالهوا', ctx('evaporation')).status).toBe('correct');
  });
  it('the clarify questions get more concrete each time', () => {
    const c1 = heuristicDiagnose(cond, 'امم', ctx());
    const c2 = heuristicDiagnose(cond, 'امم', { ...ctx(), previous: [{ text: 'امم', caption: '', status: 'clarify' }] });
    expect(c1.noor).not.toBe(c2.noor);
  });
  it('checks the teach-back', () => {
    expect(heuristicTeach(cond, 'لا، رح يطلع نقط أقل لأنه الهوا الناشف فيه مي أقل').caught).toBe(true);
    expect(heuristicTeach(cond, 'آه أكثر').caught).toBe(false);
  });
  it('Noor answers the challenge only from what the child taught, and asks for what is missing', () => {
    expect(heuristicChallenge(cond, ['في مي بالهوا بتبرد ع الكاسة وبتصير نقط']).missing).toEqual([]);
    const partial = heuristicChallenge(cond, ['المي بتجي من الهوا']);
    expect(partial.missing.length).toBeGreaterThan(0);
    expect(partial.ask).not.toBe('');
  });
  it('scores the transfer explanation', () => {
    expect(heuristicTransfer(cond, 'في مي بالهوا بالليل بتبرد على العشب البارد وبتصير نقط').score).toBe(3);
  });
});
