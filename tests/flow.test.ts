import { describe, expect, it } from 'vitest';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { eventsOf } from '../src/brain/records';
import { experimentConditions } from '../src/brain/world';
import { brainContext } from '../src/flow/derive';
import { journeyReducer, startJourney } from '../src/flow/journey';
import type { Action, Journey } from '../src/flow/journey';
import { getPack } from '../src/packs';

const pack = getPack('condensation');
const start = (quick: boolean) => startJourney(pack, { id: 'local', alias: 'نجمة', grade: 4, lang: 'ar', quick, at: 1 });
const run = (journey: Journey, ...actions: Action[]) => actions.reduce((s, a) => journeyReducer(pack, s, a), journey);
const next = { type: 'continue', at: 2 } as const;
const steps = [{ met: false, evidence: '' }, { met: false, evidence: '' }, { met: false, evidence: '' }];

describe('lesson flow', () => {
  it('captures the first explanation before exposing assessment choices and records uncertainty without a guess', () => {
    const entry = run(start(false), next);
    expect(entry.step).toBe('phenomenon');
    const thinking = run(entry, next);
    const text = 'المي بتنز من الكاسة';
    const diagnosis = heuristicDiagnose(pack, text, brainContext(pack, thinking.record, 'ar'));
    const pre = run(thinking, { type: 'explained', text, diagnosis, at: 4 }, next);
    expect(pre.step).toBe('pretest');
    const answers = pack.preTest.map((q, i) => i ? q.correct : -1);
    const shown = run(pre, { type: 'quiz', answers, at: 5 });
    expect(shown.record.events.map((e) => e.type)).toEqual(['explain', 'quiz']);
    expect(eventsOf(shown.record, 'quiz')[0].answers[0]).toBe(-1);
    expect(eventsOf(shown.record, 'quiz')[0].score).toBe(pack.preTest.length - 1);
  });

  it.each([true, false])('tests a hypothesis, teaches Noor and completes a new-situation assessment (quick=%s)', (quick) => {
    let journey = run(start(quick), next);
    journey = run(journey, next);
    expect(journey.step).toBe('explain');
    const text = 'المي بتنز من الكاسة';
    const diagnosis = heuristicDiagnose(pack, text, brainContext(pack, journey.record, 'ar'));
    journey = run(journey, { type: 'explained', text, diagnosis, at: 4 }, next);
    expect(brainContext(pack, journey.record, 'ar').previous).toHaveLength(1);
    if (!quick) journey = run(journey, { type: 'quiz', answers: pack.preTest.map((q) => q.correct), at: 5 });
    if (journey.step === 'prereq') journey = run(journey, { type: 'toTest' });
    const test = pack.experiments[0];
    journey = run(journey, { type: 'choose', experimentId: test.id, cond: experimentConditions(pack, test.id) });
    expect(journey.step).toBe('predict');
    expect(eventsOf(journey.record, 'observe')).toHaveLength(0);
    journey = run(journey, { type: 'predict', outcome: test.choices[0], at: 5 }, next, { type: 'toTeach' });
    expect(journey.step).toBe('teach');
    journey = run(journey, { type: 'taught', text: 'جرّب بكاسة فاضية', result: { caught: true, steps, source: 'fallback' }, at: 6 }, next);
    expect(journey.step).toBe('challenge');
    journey = run(journey, next, { type: 'transferred', text: 'ندى', result: { steps, source: 'fallback' } },
      { type: 'check', choice: pack.transfer.check.correct, at: 7 });
    expect(eventsOf(journey.record, 'transfer')[0].choiceCorrect).toBe(true);
    if (!quick) {
      expect(journey.step).toBe('posttest');
      journey = run(journey, { type: 'quiz', answers: pack.postTest.map((q) => q.correct), at: 8 });
    }
    expect(journey.step).toBe('summary');
    expect(eventsOf(journey.record, 'quiz')).toHaveLength(quick ? 0 : 2);
  });
});

it('offers teaching after an independently correct quick explanation with no correction experiment', () => {
  const journey = run(start(true), next, next);
  const text = 'Water vapour in the air touches the cold glass, cools, and turns into droplets.';
  const diagnosis = heuristicDiagnose(pack, text, brainContext(pack, journey.record, 'en'));
  expect(diagnosis.status).toBe('correct');
  const nextScreen = run(journey, { type: 'explained', text, diagnosis, at: 4 }, next);
  expect(nextScreen.step).toBe('teach');
  expect(eventsOf(nextScreen.record, 'observe')).toHaveLength(0);
});
