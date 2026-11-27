/** The passport reads only real, local evidence and says nothing for lessons never done. */
import { describe, expect, it } from 'vitest';
import { normaliseDiagnosis } from '../src/brain/normalise';
import { addEvent, newRecord } from '../src/brain/records';
import { passportOf, reviewPath } from '../src/features/passport/derive';
import type { LearnerRecord } from '../src/contracts';
import { getPack } from '../src/packs';

const pack = getPack('condensation');
const record = (id: string, sample: boolean, ideaId: string | null): LearnerRecord => {
  const r = newRecord({ id, pack: pack.id, alias: id, grade: 5, lang: 'en', sample });
  if (!ideaId) return r;
  const text = `words ${id}`;
  const d = normaliseDiagnosis(pack, { relevance: 'answer', ideas: [{ id: ideaId, evidence: text }], steps: [] }, text, { pack: pack.id, lang: 'en', previous: [] }, { source: 'fallback' });
  return addEvent(r, { type: 'explain', at: 1, phase: 'initial', text, diagnosis: d });
};

describe('learning passport', () => {
  it('is empty without real evidence (no invented example data)', () => {
    expect(passportOf([])).toEqual([]);
    expect(passportOf([record('s', true, 'inside_water'), record('e', false, null)])).toEqual([]);
  });

  it('lists only the lessons done, with honest per-concept states', () => {
    const p = passportOf([record('a', false, 'inside_water')]);
    expect(p.map((x) => x.pack.id)).toEqual(['condensation']);
    expect(p[0].concepts.some((c) => c.status === 'misconception' || c.status === 'insufficient')).toBe(true);
    expect(p[0].concepts.every((c) => c.status !== 'demonstrated' && c.status !== 'transfer')).toBe(true);
  });

  it('suggests a review only from a confirmed or persisting foundation, or an idea seen', () => {
    expect(reviewPath([])).toEqual([]);
    const steps = reviewPath([record('a', false, 'inside_water')]);
    expect(steps.every((s) => s.pack.id === 'condensation')).toBe(true);
  });
});
