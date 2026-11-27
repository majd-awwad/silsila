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
