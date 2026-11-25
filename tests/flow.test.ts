import { describe, expect, it } from 'vitest';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { brainContext, initialState, reducer } from '../src/flow/machine';
import { getPack } from '../src/packs';

const pack = getPack('condensation');
const ctx = { pack: pack.id, phase: 'explain' as const, previous: [], experiments: [] };
const start = { type: 'START' as const, pack: pack.id, pseudonym: 'نجمة', grade: 4, classCode: null, quick: false };
const ok = { s1: 1 as const, s2: 1 as const, s3: 1 as const };

describe('lesson flow', () => {
  it('walks welcome → pretest → lab with one greeting', () => {
    let s = reducer(initialState, start);
    expect(s.phase).toBe('pretest');
    s = reducer(s, { type: 'PRE_DONE', result: { answers: [0, 0, 0, 0], score: 1, total: 4 } });
    expect(s.phase).toBe('lab');
    expect(s.cond).toEqual(pack.baseline);
    expect(s.messages.filter((m) => m.who === 'noor')).toHaveLength(1);
  });
  it('quick mode (judges) skips both tests', () => {
    let s = reducer(initialState, { ...start, quick: true, classCode: 'ABCD' });
    expect(s.phase).toBe('lab');
    expect(s.session?.classCode).toBe('ABCD');
    s = reducer(s, { type: 'TO_POST' });
    expect(s.phase).toBe('summary');
  });
  it('explain → teach → challenge → transfer → done', () => {
    let s = reducer(reducer(initialState, start), { type: 'PRE_DONE', result: { answers: [], score: 0, total: 4 } });
    s = reducer(s, { type: 'DIAGNOSED', text: 'x', diag: heuristicDiagnose(pack, 'المي بتنز من الكاسة', ctx) });
    expect(s.lab).toBe('explain');
    expect(s.diag?.child_chain.length).toBeGreaterThan(1);
    s = reducer(s, { type: 'DIAGNOSED', text: 'y', diag: heuristicDiagnose(pack, 'في مي بالهوا بتبرد ع الكاسة وبتصير نقط', ctx) });
    expect(s.lab).toBe('teach');
    expect(brainContext(s).previous).toHaveLength(2);
    s = reducer(s, { type: 'CHILD_SAID', text: 'أقل' });
    s = reducer(s, { type: 'TAUGHT', text: 'أقل', result: { caught: true, noor: 'شكراً', rubric: ok, source: 'fallback' } });
    expect(s.lab).toBe('challenge');
    expect(s.teachings).toContain('أقل');
    s = reducer(s, { type: 'CHALLENGED', result: { answer: 'جواب', missing: [1], ask: 'كيف؟', source: 'fallback' } });
    expect(s.lab).toBe('challenge');
    s = reducer(s, { type: 'CHALLENGED', result: { answer: 'جواب كامل', missing: [], ask: '', source: 'fallback' } });
    expect(s.lab).toBe('transfer');
    expect(s.session?.challenge?.resolved).toBe(true);
    s = reducer(s, { type: 'TRANSFERRED', text: 'ندى', result: { rubric: ok, score: 3, noor: 'برافو', source: 'fallback' } });
    expect(s.lab).toBe('done');
    expect(s.session?.transfer?.score).toBe(3);
  });
});
