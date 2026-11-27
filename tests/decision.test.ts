/** Quick check: the decision comes only from the class's own evidence and never forces an experiment. */
import { describe, expect, it } from 'vitest';
import { normaliseDiagnosis } from '../src/brain/normalise';
import { addEvent, newRecord } from '../src/brain/records';
import { quickDecision } from '../src/features/teacher/logic/decision';
import type { LearnerRecord } from '../src/contracts';
import { getPack } from '../src/packs';

const pack = getPack('fractions');
const wrong = Object.keys(pack.ideas).filter((id) => !pack.ideas[id].correct);
const learner = (id: string, ideaId: string | null, text = `words of ${id}`): LearnerRecord => {
  const r = newRecord({ id, pack: pack.id, alias: id, grade: 5, lang: 'en' });
  if (!ideaId) return r;
  const d = normaliseDiagnosis(pack, { relevance: 'answer', ideas: [{ id: ideaId, evidence: text }], steps: [] }, text, { pack: pack.id, lang: 'en', previous: [] }, { source: 'fallback' });
  return addEvent(r, { type: 'explain', at: 1, phase: 'initial', text, diagnosis: d });
};

describe('quick-check decision', () => {
  it('says what to explain again and for whom, from the biggest group of the same idea', () => {
    const d = quickDecision(pack, [learner('a', wrong[0]), learner('b', wrong[0]), learner('c', wrong[1]), learner('d', null)]);
    expect(d.total).toBe(4);
    expect(d.explained).toBe(3);
    expect(d.waiting).toBe(1);
    expect(d.headline?.count).toBe(2);
    expect(d.items.find((i) => i.id === `idea:${wrong[0]}`)?.members.sort()).toEqual(['a', 'b']);
    // every line is authored pack text
    expect(d.headline?.what.ar).toContain(pack.ideas[wrong[0]].label.ar);
  });

  it('has no headline when nobody needs help yet', () => {
    expect(quickDecision(pack, []).headline).toBeNull();
    expect(quickDecision(pack, [learner('x', null)]).headline).toBeNull();
  });
});

describe('planner weights shown to the teacher', () => {
  it('are the ones the approved vision states: reach 40, coverage 25, disagreement 20, objective 10, time 5', async () => {
    const { WEIGHTS } = await import('../src/brain/planner');
    expect(WEIGHTS).toEqual({ reach: 0.4, coverage: 0.25, disagreement: 0.2, objective: 0.1, time: 0.05 });
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('ties and Arabic counts', () => {
  it('lists every tied group and never picks one at random', () => {
    const d = quickDecision(pack, [learner('a', wrong[0]), learner('b', wrong[1])]);
    expect(d.headline?.tied.map((i) => i.id).sort()).toEqual([`idea:${wrong[0]}`, `idea:${wrong[1]}`].sort());
    expect(d.headline?.count).toBe(1);
    expect(d.headline?.what.ar).toContain('تعادل');
    // the same learners in another order give the same answer
    const e = quickDecision(pack, [learner('b', wrong[1]), learner('a', wrong[0])]);
    expect(e.headline?.tied.map((i) => i.id).sort()).toEqual(d.headline?.tied.map((i) => i.id).sort());
  });

  it('offers a shared question only when one experiment challenges all the tied ideas', async () => {
    const { compare, conditionsFor } = await import('../src/brain/world');
    const d = quickDecision(pack, [learner('a', wrong[0]), learner('b', wrong[1])]);
    const shared = pack.experiments.find((x) => wrong.slice(0, 2).every((id) => compare(pack, pack.ideas[id].model, conditionsFor(pack, x.change)).contradicted));
    expect(d.headline?.next ?? null).toEqual(shared?.question ?? null);
  });

  it('is a single answer when one group is bigger', () => {
    const d = quickDecision(pack, [learner('a', wrong[0]), learner('b', wrong[0]), learner('c', wrong[1])]);
    expect(d.headline?.tied).toEqual([]);
  });

  it('agrees the Arabic count with the noun', async () => {
    const { learnersLabel } = await import('../src/features/teacher/logic/labels');
    const n = (v: number) => String(v);
    expect([1, 2, 3, 10, 11].map((c) => learnersLabel('ar', c, n))).toEqual(['طالب واحد', 'طالبين', '3 طلاب', '10 طلاب', '11 طالب']);
    expect(learnersLabel('en', 1, n)).toBe('1 learner');
  });
});
