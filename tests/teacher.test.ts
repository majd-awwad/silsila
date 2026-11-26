import { describe, expect, it } from 'vitest';
import { entryFromSession, interventionGroups } from '../src/brain/classInsights';
import { PACK_LIST } from '../src/packs';
import { demoClass } from '../src/store/demoClass';

describe('curriculum anchors (checked against the printed book, 26/11)', () => {
  for (const pack of PACK_LIST) {
    it(`${pack.id} names its book, unit, lesson and pages`, () => {
      const c = pack.curriculum;
      expect(c.book).toContain('الصف الثالث');
      expect(c.unit.length).toBeGreaterThan(5);
      expect(c.lesson).toContain('دورة الماء');
      expect(c.pages).toMatch(/[٠-٩]/);
    });
  }
});

describe('intervention groups for the teacher', () => {
  for (const pack of PACK_LIST) {
    const entries = demoClass(pack.id).map(entryFromSession);

    it(`${pack.id}: groups share one wrong idea, never the correct one, and each has a move`, () => {
      const groups = interventionGroups(pack, entries);
      const ideaGroups = groups.filter((g) => g.kind === 'idea');
      expect(ideaGroups.length).toBeGreaterThan(0);
      for (const g of ideaGroups) {
        expect(g.source).not.toBe(pack.correctModel.sources[0]);
        expect(g.members.length).toBeGreaterThan(0);
        expect(g.move.length).toBeGreaterThan(10);
        if (g.experiment) expect(pack.presets.some((p) => p.id === g.experiment!.id)).toBe(true);
      }
    });

    it(`${pack.id}: nobody who already understood is put in a wrong-idea group`, () => {
      const groups = interventionGroups(pack, entries).filter((g) => g.kind === 'idea');
      const understood = new Set(entries.filter((e) => e.understood).map((e) => e.pseudonym));
      for (const g of groups) for (const m of g.members) expect(understood.has(m)).toBe(false);
    });

    it(`${pack.id}: same entries give the same groups (deterministic)`, () => {
      expect(interventionGroups(pack, entries)).toEqual(interventionGroups(pack, entries));
    });
  }

  it('children Noor had to help form their own group', () => {
    const pack = PACK_LIST[0];
    const base = demoClass(pack.id).map(entryFromSession);
    const entries = [{ ...base[0], needsHelp: true, understood: false, pseudonym: 'نجمة' }, ...base.slice(1)];
    const help = interventionGroups(pack, entries).find((g) => g.kind === 'help');
    expect(help?.members).toContain('نجمة');
  });
});

import { replaySteps } from '../src/brain/replay';

describe('Thinking Replay', () => {
  for (const pack of PACK_LIST) {
    it(`${pack.id}: replay starts with the child's first idea and shows each experiment`, () => {
      const sessions = demoClass(pack.id).filter((s) => s.experiments.length > 0);
      expect(sessions.length).toBeGreaterThan(0);
      for (const s of sessions) {
        const steps = replaySteps(pack, s);
        expect(steps[0].kind).toBe('idea');
        expect(steps.filter((x) => x.kind === 'test').length).toBe(s.experiments.length);
        for (const t of steps.filter((x) => x.kind === 'test')) expect(t.predicted && t.real).toBeTruthy();
      }
    });
  }

  it('a child Noor had to help sees that in the replay', () => {
    const pack = PACK_LIST[0];
    const s = { ...demoClass(pack.id)[0], scaffolded: true };
    expect(replaySteps(pack, s).some((x) => x.kind === 'noor' && x.title === 'نور ساعدتك')).toBe(true);
  });
});
