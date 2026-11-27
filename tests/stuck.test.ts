import { describe, expect, it } from 'vitest';
import { addEvent, eventsOf } from '../src/brain/records';
import { parseLooseJson } from '../src/brain/server';
import { STUCK_AFTER, gotGuidance, stuckCount } from '../src/flow/derive';
import { journeyReducer, startJourney } from '../src/flow/journey';
import { reveals } from '../src/mode';
import { PACK_LIST, getPack } from '../src/packs';
import type { ConceptPack } from '../src/packs/types';

const start = (pack: ConceptPack) => startJourney(pack, { id: 'p1', alias: 'نجمة', grade: 4, quick: true, lang: 'ar', at: 0 });
const result = (n: number, contradicted = true) => ({
  type: 'observe' as const, at: n, experimentId: null, cond: { x: String(n) },
  predicted: 'a', hypothesis: contradicted ? 'a' : 'b', real: 'b', note: '',
});

describe('guided explanation', () => {
  for (const pack of PACK_LIST) {
    it(pack.id + ' guides after three different contradictions, once', () => {
      const s = start(pack);
      const record = [1, 2, 3].reduce((r, n) => addEvent(r, result(n)), s.record);
      const next = journeyReducer(pack, { ...s, step: 'reveal', record }, { type: 'continue', at: 4 });
      expect(next.step).toBe('guided');
      expect(gotGuidance(next.record)).toBe(true);
      const repeated = journeyReducer(pack, { ...next, step: 'reveal', record: addEvent(next.record, result(5)) }, { type: 'continue', at: 6 });
      expect(repeated.step).toBe('reflect');
      expect(eventsOf(repeated.record, 'assist')).toHaveLength(1);
    });
  }
  it('counts only distinct experiments with contradictory evidence', () => {
    const pack = getPack('condensation');
    const { record } = start(pack);
    expect(stuckCount(pack, [1, 1, 1].reduce((r, n) => addEvent(r, result(n)), record))).toBe(1);
    expect(stuckCount(pack, [result(1), result(2, false), result(3)].reduce(addEvent, record))).toBe(2);
    expect(journeyReducer(pack, { ...start(pack), step: 'reveal', record }, { type: 'continue', at: 4 }).step).toBe('reflect');
  });
  it('records guidance after repeated unsuccessful replies to Noor', () => {
    const pack = getPack('condensation');
    let s = { ...start(pack), step: 'teach' as const } as ReturnType<typeof start>;
    for (let i = 0; i < STUCK_AFTER; i++) {
      expect(gotGuidance(s.record)).toBe(false);
      s = journeyReducer(pack, s, { type: 'taught', at: i, text: 'مش عارف', result: { caught: false, steps: [], source: 'fallback' } });
    }
    expect(s.step).toBe('teach');
    expect(gotGuidance(s.record)).toBe(true);
  });
});

describe('child and judge views', () => {
  it('shows a child a marked link only after their own experiment contradicts it', () => {
    expect(reveals({ judge: false, contradicted: false })).toEqual({ science: false, wrongStep: false, engine: false });
    expect(reveals({ judge: false, contradicted: true })).toEqual({ science: false, wrongStep: true, engine: false });
  });
  it('shows the reasoning panel in judge mode', () => {
    expect(reveals({ judge: true, contradicted: false })).toEqual({ science: true, wrongStep: true, engine: true });
  });
});

describe('provider response parsing', () => {
  it('accepts plain, fenced and embedded JSON', () => {
    expect(parseLooseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseLooseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseLooseJson('Here you go: {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
  });
  it('rejects missing or invalid JSON', () => {
    expect(parseLooseJson('sorry, I cannot')).toBeNull();
    expect(parseLooseJson('{broken')).toBeNull();
  });
});
