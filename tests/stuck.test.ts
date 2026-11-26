import { describe, expect, it } from 'vitest';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { parseLooseJson } from '../src/brain/server';
import { contradictedCount, initialState, reducer, STUCK_AFTER } from '../src/flow/machine';
import type { State } from '../src/flow/machine';
import { reveals } from '../src/mode';
import { getPack, PACK_LIST } from '../src/packs';
import { entryFromSession } from '../src/brain/classInsights';

const ctx = (id: string) => ({ pack: id, phase: 'explain' as const, previous: [], experiments: [] });
const run = (n: number, contradicted = true) => ({ preset: null, cond: { x: String(n) }, predicted: 'a', real: 'b', contradicted, at: n });
const wrongIdea: Record<string, string> = { condensation: 'المي بتنز من الكاسة', evaporation: 'المي بتخلص لحالها' };

function labState(packId: string): State {
  const pack = getPack(packId);
  let s = reducer(initialState, { type: 'START', pack: packId, pseudonym: 'نجمة', grade: 4, classCode: null, quick: true });
  s = reducer(s, { type: 'DIAGNOSED', text: wrongIdea[packId], diag: heuristicDiagnose(pack, wrongIdea[packId], ctx(packId)) });
  expect(s.lab).toBe('explain');
  return s;
}

describe('Noor explains when the child is stuck (decision of 25/11)', () => {
  for (const pack of PACK_LIST) {
    it(`${pack.id}: after ${STUCK_AFTER} different experiments that change nothing, Noor explains once`, () => {
      let s = labState(pack.id);
      for (let i = 1; i < STUCK_AFTER; i++) {
        s = reducer(s, { type: 'EXPERIMENT_RESULT', run: run(i), verdict: 'v', noor: 'ask again' });
        expect(s.session?.scaffolded).toBe(false);
        expect(s.messages.at(-1)?.text).toBe('ask again');
      }
      s = reducer(s, { type: 'EXPERIMENT_RESULT', run: run(STUCK_AFTER), verdict: 'v', noor: 'ask again' });
      expect(s.session?.scaffolded).toBe(true);
      expect(s.messages.at(-1)?.text).toBe(pack.noor.reveal);
      // the lab stays open: the child retells it in their own words; Noor does not repeat herself
      expect(s.lab).toBe('explain');
      const again = reducer(s, { type: 'EXPERIMENT_RESULT', run: run(STUCK_AFTER + 1), verdict: 'v', noor: 'ask again' });
      expect(again.messages.filter((m) => m.text === pack.noor.reveal)).toHaveLength(1);
    });
  }

  it('the same experiment repeated does not count as progress towards "stuck"', () => {
    expect(contradictedCount([run(1), run(1), run(1)])).toBe(1);
    expect(contradictedCount([run(1), run(2, false), run(3)])).toBe(2);
  });

  it('a child who already explains it correctly is never scaffolded', () => {
    const pack = getPack('condensation');
    let s = reducer(initialState, { type: 'START', pack: pack.id, pseudonym: 'نجمة', grade: 4, classCode: null, quick: true });
    s = reducer(s, { type: 'DIAGNOSED', text: 'ok', diag: heuristicDiagnose(pack, 'في مي بالهوا بتبرد ع الكاسة وبتصير نقط', ctx(pack.id)) });
    expect(s.lab).toBe('teach');
    for (let i = 1; i <= 4; i++) s = reducer(s, { type: 'EXPERIMENT_RESULT', run: run(i), verdict: 'v' });
    expect(s.session?.scaffolded).toBe(false);
  });

  it('teaching Noor fails 3 times → Noor explains, flags the child for the teacher, and moves to her challenge', () => {
    const pack = getPack('condensation');
    let s = reducer(initialState, { type: 'START', pack: pack.id, pseudonym: 'نجمة', grade: 4, classCode: null, quick: true });
    s = reducer(s, { type: 'DIAGNOSED', text: 'ok', diag: heuristicDiagnose(pack, 'في مي بالهوا بتبرد ع الكاسة وبتصير نقط', ctx(pack.id)) });
    const miss = { caught: false, noor: 'لسا محتارة', rubric: { s1: 0 as const, s2: 0 as const, s3: 0 as const }, source: 'fallback' as const };
    for (let i = 1; i < STUCK_AFTER; i++) {
      s = reducer(s, { type: 'TAUGHT', text: 'مش عارف', result: miss });
      expect(s.lab).toBe('teach');
      expect(s.session?.scaffolded).toBe(false);
    }
    s = reducer(s, { type: 'TAUGHT', text: 'مش عارف', result: miss });
    expect(s.lab).toBe('challenge');
    expect(s.session?.scaffolded).toBe(true);
    expect(s.messages.some((m) => m.text === pack.noor.reveal)).toBe(true);
    expect(s.teachings.join(' ')).toContain(pack.scienceChain[0]);
    expect(entryFromSession(s.session!).needsHelp).toBe(true);
  });
});

describe('child mode vs judge mode', () => {
  it('child mode keeps the scientific chain and the engine hidden while the child is still explaining', () => {
    const r = reveals({ judge: false, lab: 'explain', contradicted: false });
    expect(r).toEqual({ science: false, wrongStep: false, engine: false });
  });
  it('the wrong step appears only after an experiment showed it, the science chain only after the child fixed their idea', () => {
    expect(reveals({ judge: false, lab: 'explain', contradicted: true })).toEqual({ science: false, wrongStep: true, engine: false });
    expect(reveals({ judge: false, lab: 'teach', contradicted: true })).toEqual({ science: true, wrongStep: true, engine: false });
  });
  it('the engine (table, confidence, best experiment) is never shown to a child', () => {
    for (const lab of ['explain', 'teach', 'challenge', 'transfer', 'done']) expect(reveals({ judge: false, lab, contradicted: true }).engine).toBe(false);
  });
  it('judge mode shows everything', () => {
    expect(reveals({ judge: true, lab: 'explain', contradicted: false })).toEqual({ science: true, wrongStep: true, engine: true });
  });
});

describe('model output parsing', () => {
  it('accepts plain JSON, fenced JSON and JSON with chatter around it', () => {
    expect(parseLooseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseLooseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseLooseJson('Here you go: {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
  });
  it('rejects text with no JSON', () => {
    expect(parseLooseJson('sorry, I cannot')).toBeNull();
    expect(parseLooseJson('{broken')).toBeNull();
  });
});
