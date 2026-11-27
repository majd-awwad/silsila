/** Invariants every concept pack must keep. Run: npx vitest run tests/packs.test.ts */
import { describe, expect, it } from 'vitest';
import { compare, conditionsFor, survivesAll, validConditions } from '../src/brain/world';
import { findHits, normaliseText } from '../src/brain/text';
import { CHAIN_IDS } from '../src/contracts';
import type { L } from '../src/contracts';
import { PACK_LIST, getPack } from '../src/packs';
import { RESOURCE_IDS } from '../src/packs/resources';
import type { ConceptPack } from '../src/packs/types';

/** every cartesian combination of the pack's variables */
function allConditions(pack: ConceptPack) {
  return pack.variables.reduce<Record<string, string>[]>(
    (acc, v) => acc.flatMap((c) => v.options.map((o) => ({ ...c, [v.id]: o.id }))), [{}],
  );
}

/** every {ar,en} pair anywhere in the pack */
function texts(x: unknown, path = 'pack', out: [string, L][] = []): [string, L][] {
  if (!x || typeof x !== 'object' || x instanceof RegExp) return out;
  const o = x as Record<string, unknown>;
  if ('ar' in o && 'en' in o) out.push([path, o as unknown as L]);
  else for (const [k, v] of Object.entries(o)) texts(v, `${path}.${k}`, out);
  return out;
}

describe.each(PACK_LIST.map((p) => [p.id, p] as const))('pack %s', (_id, pack) => {
  it('has complete bilingual text', () => {
    const all = texts(pack);
    expect(all.length).toBeGreaterThan(60);
    for (const [path, t] of all) {
      expect(t.ar.trim(), `${path}.ar`).not.toBe('');
      expect(t.en.trim(), `${path}.en`).not.toBe('');
    }
  });

  it('has exactly one scientific idea, and it matches correctModel', () => {
    const correct = Object.entries(pack.ideas).filter(([, i]) => i.correct);
    expect(correct).toHaveLength(1);
    expect(pack.correctModel.sources).toContain(correct[0][0]);
    expect(correct[0][1].wrongStep).toBeNull();
    expect(correct[0][1].breaks).toBeNull();
  });

  it('has ideas with a valid hypothesis, story and broken concept', () => {
    for (const [id, idea] of Object.entries(pack.ideas)) {
      expect(idea.model.sources, id).toContain(id);
      for (const s of idea.model.sources) expect(Object.keys(pack.ideas), id).toContain(s);
      expect(Object.keys(pack.paths), id).toContain(idea.model.path);
      for (const r of idea.model.requires) expect(Object.keys(pack.requires), id).toContain(r);
      expect(idea.story.length, id).toBeGreaterThanOrEqual(2);
      if (!idea.correct) {
        expect(idea.wrongStep, id).not.toBeNull();
        expect(idea.wrongStep!, id).toBeLessThan(idea.story.length);
        expect(CHAIN_IDS, id).toContain(idea.breaks);
      }
    }
  });

  it('computes a known outcome for every combination of variables', () => {
    expect(validConditions(pack, pack.baseline)).toBe(true);
    for (const cond of allConditions(pack)) {
      expect(Object.keys(pack.outcomes)).toContain(pack.realOutcome(cond));
      for (const idea of Object.values(pack.ideas)) expect(Object.keys(pack.outcomes)).toContain(pack.kidOutcome(idea.model, cond));
    }
  });

  it('keeps the scientific model unbroken everywhere, and can break every other idea', () => {
    expect(survivesAll(pack, pack.correctModel)).toBe(true);
    for (const cond of allConditions(pack)) expect(compare(pack, pack.correctModel, cond).contradicted, JSON.stringify(cond)).toBe(false);
    for (const [id, idea] of Object.entries(pack.ideas)) {
      if (idea.correct) continue;
      const broken = pack.experiments.some((x) => compare(pack, idea.model, conditionsFor(pack, x.change)).contradicted);
      expect(broken, `no experiment contradicts ${id}`).toBe(true);
    }
  });

  it('has runnable experiments with fair predictions and a real-world version', () => {
    expect(pack.experiments.length).toBeGreaterThanOrEqual(4);
    for (const x of pack.experiments) {
      expect(validConditions(pack, conditionsFor(pack, x.change)), x.id).toBe(true);
      const real = pack.realOutcome(conditionsFor(pack, x.change));
      expect(x.choices, x.id).toContain(real);
      expect(new Set(x.choices).size, x.id).toBeGreaterThanOrEqual(2);
      for (const c of x.choices) expect(Object.keys(pack.outcomes), x.id).toContain(c);
      for (const m of x.materials) expect(RESOURCE_IDS, x.id).toContain(m);
      expect(x.minutes, x.id).toBeGreaterThan(0);
      expect(x.targets.length, x.id).toBeGreaterThan(0);
      expect(x.home.steps.length, x.id).toBeGreaterThan(0);
    }
    expect(new Set(pack.experiments.map((x) => x.id)).size).toBe(pack.experiments.length);
  });

  it('never gives the answer away in questions, clarifications or the first three hints', () => {
    const check = (t: L, where: string) => {
      expect(pack.answerWords.test(t.ar), `${where} ar: ${t.ar}`).toBe(false);
      expect(pack.answerWords.test(t.en), `${where} en: ${t.en}`).toBe(false);
    };
    check(pack.question, 'question');
    check(pack.noor.greeting, 'greeting');
    check(pack.noor.invite, 'invite');
    pack.hints.slice(0, 3).forEach((h, i) => check(h, `hint ${i}`));
    pack.clarify.forEach((c) => check(c.q, `clarify ${c.id}`));
    pack.steps.forEach((s, i) => check(s.noorAsks, `noorAsks ${i}`));
    pack.experiments.forEach((x) => check(x.question, `experiment ${x.id}`));
    Object.entries(pack.ideas).filter(([, i]) => !i.correct).forEach(([id, i]) => check(i.mirror, `mirror ${id}`));
    check(pack.transfer.prompt, 'transfer');
    check(pack.challenge.phenomenon, 'challenge');
  });

  it('has offline rules for every idea and understands its own sample sentences', () => {
    for (const id of Object.keys(pack.ideas)) expect(pack.rules.some((r) => r.idea === id), `no rule for ${id}`).toBe(true);
    for (const r of pack.rules) expect(Object.keys(pack.ideas)).toContain(r.idea);
    expect(pack.samples.length).toBeGreaterThanOrEqual(4);
    for (const s of pack.samples) {
      for (const text of [s.ar, s.en]) {
        const t = normaliseText(text);
        const found = pack.rules.some((r) => findHits(t, r.re).affirmed && !(r.unless && r.unless.test(t)))
          || pack.steps.some((st) => findHits(t, st.test).affirmed);
        expect(found, `sample not understood: ${text}`).toBe(true);
      }
    }
  });

  it('has a knowledge graph, prerequisites, assessment and activities', () => {
    for (const id of CHAIN_IDS) {
      expect(pack.concepts[id]).toBeTruthy();
      for (const n of pack.concepts[id].needs) expect(CHAIN_IDS).toContain(n);
    }
    expect(pack.prerequisites.length).toBeGreaterThanOrEqual(1);
    for (const p of pack.prerequisites) {
      for (const i of p.suspect.ideas) expect(Object.keys(pack.ideas)).toContain(i);
      for (const q of [...p.verify, p.recheck]) expect(q.correct).toBeLessThan(q.options.length);
      expect(p.remedy.steps.length).toBeGreaterThan(0);
    }
    expect(pack.objectives.length).toBeGreaterThan(0);
    expect(pack.clarify.length).toBeGreaterThanOrEqual(3);
    for (const q of [...pack.preTest, ...pack.postTest, pack.transfer.check]) expect(q.correct).toBeLessThan(q.options.length);
    expect(pack.preTest.length).toBeGreaterThanOrEqual(3);
    expect(pack.postTest.length).toBeGreaterThanOrEqual(3);
    for (const key of ['_default', '_enrich']) expect(pack.activities[key], key).toBeTruthy();
    for (const [id, a] of Object.entries(pack.activities)) {
      if (!id.startsWith('_')) expect(Object.keys(pack.ideas), id).toContain(id);
      expect(a.steps.length, id).toBeGreaterThanOrEqual(2);
    }
    expect(pack.reference.sources.length).toBeGreaterThan(0);
  });
});

describe('prerequisite map between lessons', () => {
  it('only points at lessons and foundations that exist', async () => {
    const { FOUNDATION_LINKS, PREREQUISITE_CHAINS } = await import('../src/packs/links');
    for (const l of FOUNDATION_LINKS) {
      expect(PACK_LIST.map((p) => p.id)).toContain(l.pack);
      expect(getPack(l.pack).prerequisites.map((p) => p.id)).toContain(l.prereqId);
      if (l.source) expect(PACK_LIST.map((p) => p.id)).toContain(l.source);
    }
    for (const c of PREREQUISITE_CHAINS) for (const s of c.steps) if (s.pack) expect(PACK_LIST.map((p) => p.id)).toContain(s.pack);
  });
});
