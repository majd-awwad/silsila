import { describe, expect, it } from 'vitest';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { brainContext, initialState, reducer } from '../src/flow/machine';

const ctx = { phase: 'explain' as const, previous: [], experiments: [] };

describe('lesson flow', () => {
  it('walks welcome → pretest → lab with one greeting', () => {
    let s = reducer(initialState, { type: 'START', pseudonym: 'نجمة', grade: 4 });
    expect(s.phase).toBe('pretest');
    s = reducer(s, { type: 'PRE_DONE', result: { answers: [0, 0, 0, 0], score: 1, total: 4 } });
    expect(s.phase).toBe('lab');
    expect(s.messages.filter((m) => m.who === 'noor')).toHaveLength(1);
  });
  it('a correct explanation moves the lab to teaching, and catching Noor finishes it', () => {
    let s = reducer(initialState, { type: 'START', pseudonym: 'قمر', grade: 4 });
    s = reducer(s, { type: 'PRE_DONE', result: { answers: [], score: 0, total: 4 } });
    s = reducer(s, { type: 'DIAGNOSED', text: 'x', diag: heuristicDiagnose('المي بتنز من الكاسة', ctx) });
    expect(s.lab).toBe('explain');
    expect(s.model?.sources).toContain('inside_water');
    s = reducer(s, { type: 'DIAGNOSED', text: 'y', diag: heuristicDiagnose('في مي بالهوا بتبرد ع الكاسة وبتصير نقط', ctx) });
    expect(s.lab).toBe('teach');
    expect(brainContext(s).previous).toHaveLength(2);
    s = reducer(s, { type: 'TAUGHT', text: 'أقل', result: { caught: true, noor: 'شكراً', rubric: { vapor_in_air: 1, cooling: 1, turns_to_drops: 1 }, source: 'fallback' } });
    expect(s.lab).toBe('done');
    expect(s.session?.teach?.caught).toBe(true);
  });
});
