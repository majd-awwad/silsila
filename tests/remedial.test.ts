/** The next-lesson plan and follow-up cards come from the class's groups and the pack's own text. */
import { describe, expect, it } from 'vitest';
import { interventionGroups } from '../src/brain/classInsights';
import { normaliseDiagnosis } from '../src/brain/normalise';
import { addEvent, newRecord } from '../src/brain/records';
import { boardFrom } from '../src/features/teacher/logic/groups';
import { followUpCards, planAsText, remedialPlan } from '../src/features/teacher/logic/remedial';
import type { LearnerRecord } from '../src/contracts';
import { getPack } from '../src/packs';

const pack = getPack('condensation');
const wrong = Object.keys(pack.ideas).filter((id) => !pack.ideas[id].correct);
const learner = (id: string, ideaId: string): LearnerRecord => {
  const text = `words of ${id}`;
  const d = normaliseDiagnosis(pack, { relevance: 'answer', ideas: [{ id: ideaId, evidence: text }], steps: [] }, text, { pack: pack.id, lang: 'en', previous: [] }, { source: 'fallback' });
  return addEvent(newRecord({ id, pack: pack.id, alias: id, grade: 5, lang: 'en' }), { type: 'explain', at: 1, phase: 'initial', text, diagnosis: d });
};
const records = [learner('a', wrong[0]), learner('b', wrong[0]), learner('c', wrong[1])];
const board = boardFrom(interventionGroups(pack, records));

describe('remedial plan', () => {
  it('has the four parts with editable minutes, each tied to real groups and a real quote', () => {
    const plan = remedialPlan(pack, board, records, { review: 6, groups: 14, apply: 10, recheck: 10 });
    expect(plan.map((p) => p.id)).toEqual(['review', 'groups', 'apply', 'recheck']);
    expect(plan.reduce((s, p) => s + p.minutes, 0)).toBe(40);
    const groups = plan.find((p) => p.id === 'groups')!;
    expect(groups.learners).toBe(3);
    expect(groups.groupIds.length).toBeGreaterThan(1);
    expect(plan[0].evidence).toMatch(/^words of /);
    expect(plan[0].learners).toBe(2);
  });

  it('gives one card per group with a concept, the lesson and a check question', () => {
    const cards = followUpCards(pack, board);
    expect(cards.length).toBe(board.groups.length);
    for (const c of cards) {
      expect(c.lessonPack).toBe(pack.id);
      expect(c.concept.ar.length).toBeGreaterThan(0);
      expect(c.check?.options.length).toBeGreaterThan(1);
    }
  });

  it('copies as plain text with the total', () => {
    expect(planAsText(pack, remedialPlan(pack, board, records), 'en')).toContain('Next lesson plan (40 minutes)');
  });

  it('does not invent groups when nobody has explained', () => {
    const plan = remedialPlan(pack, boardFrom([]), []);
    expect(plan.find((p) => p.id === 'groups')!.lines).toEqual([]);
  });
});
