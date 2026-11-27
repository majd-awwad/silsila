import { describe, expect, it } from 'vitest';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { plan } from '../src/brain/planner';
import { experimentConditions } from '../src/brain/world';
import { getPack } from '../src/packs';

const pack = getPack('condensation');
const diagnose = (text: string, lang: 'ar' | 'en' = 'ar') => heuristicDiagnose(pack, text, { pack: pack.id, lang, previous: [] });
describe('manual condensation regressions and variants', () => {
  it.each(['أنا بفكر إنه البرد نفسه بتحول لمي لما الكاسة تكون باردة كثير.', 'البرودة نفسها تحول لماء'])('identifies coldness as the proposed source', (line) => {
    const d = diagnose(line);
    expect(d.ideas.map((idea) => idea.id)).toContain('cold_itself');
    expect(plan(pack, [{ key: 'cold', ideas: ['cold_itself'], model: d.model, learners: 1 }]).recommended?.id).toBe('E_dry');
  });
  it('gives one distinct link for each grounded scientific step', () => {
    const d = diagnose('المي اللي بالهوا بتكون بخار، ولما تلمس الكاسة الباردة بتبرد وبتتحول لنقط مي.');
    expect(d.status).toBe('correct');
    expect(d.chain).toHaveLength(3);
    expect(new Set(d.chain).size).toBe(3);
  });
  it.each([
    ['يمكن المي بتتسرب من جوّا الكاسة، بس الزجاج بمنع اللون الأزرق إنه يطلع معها.', 'ar'],
    ['Water leaks out through the glass, but the glass keeps the blue dye inside.', 'en'],
  ] as const)('runs the refined hypothesis instead of repeating generic leakage', (line, lang) => {
    const d = diagnose(line, lang);
    expect(d.model?.path).toBe('filters_dye');
    expect(pack.kidOutcome(d.model!, experimentConditions(pack, pack.experiments[0].id))).toBe('drops');
    expect(plan(pack, [{ key: 'refined', ideas: ['inside_water'], model: d.model, learners: 1 }]).recommended?.id).toBe('E_empty');
  });
  it('does not treat the mere mention of vapor as a complete explanation', () => {
    expect(diagnose('يمكن في بخار، ما بعرف شو بيصير.').status).toBe('partial');
  });
});
