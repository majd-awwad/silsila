/**
 * The individual lesson as a pure reducer: (pack, state, action) → state. No fetches, no timers, no storage.
 * The learner's event log (LearnerRecord) is the only record of what happened; the state adds just enough to know
 * which screen is open. Screens do the async language calls and dispatch the results.
 *
 *   meet → pretest? → phenomenon → explain ⇄ clarify → understood → prereq?
 *   → hypothesis → predict (locks) → reveal → reflect ⇄ revise / guided
 *   → teach → challenge → transfer → check → posttest? → summary
 *
 * Every screen has a way forward. Nothing here shows a result before a prediction is locked.
 */
import type { Conditions, Diagnosis, Lang, LearnerEvent, LearnerRecord, TeachResult, TransferResult } from '../contracts';
import { addEvent, lastEvent, newRecord } from '../brain/records';
import { compare, conditionsFor, experimentById, experimentConditions, experimentFor, sameConditions, validConditions } from '../brain/world';
import type { ConceptPack } from '../packs/types';
import {
  GUIDED_LEVEL, STUCK_AFTER, TEACHER_LEVEL, canAnswerChallenge, choicesFor, currentDiagnosis, gotGuidance, nextHelp, noorAttempt,
  observations, openHelp, recommendExperiment, shouldGuide, teachFailures, teachTries,
} from './derive';
import { gapTask } from './gaps';

export const STEPS = [
  'meet', 'pretest', 'phenomenon', 'explain', 'clarify', 'understood', 'prereq', 'hypothesis', 'predict', 'reveal', 'reflect',
  'revise', 'guided', 'teach', 'challenge', 'transfer', 'check', 'posttest', 'summary',
] as const;
export type Step = (typeof STEPS)[number];

/** A new-situation explanation waiting for its check question. */
export type PendingTransfer = { text: string } & TransferResult;

export interface Journey {
  record: LearnerRecord;
  step: Step;
  /** skip the questions before and after the lesson */
  quick: boolean;
  /** the experiment on the stage; null = the learner's own combination */
  experimentId: string | null;
  cond: Conditions;
  pending: PendingTransfer | null;
}

type At = { at: number };
export type Action =
  | { type: 'continue' } & At
  | { type: 'quiz'; answers: number[] } & At
  | { type: 'explained'; text: string; diagnosis: Diagnosis } & At
  | { type: 'reword' }
  | { type: 'prereqAnswer'; choice: number } & At
  | { type: 'remedyDone' } & At
  /** open the experiment bench, optionally on a given experiment */
  | { type: 'toTest'; experimentId?: string }
  | { type: 'choose'; experimentId: string | null; cond: Conditions }
  /** go back and pick another experiment, before the prediction is locked */
  | { type: 'unchoose' }
  | { type: 'predict'; outcome: string } & At
  | { type: 'note'; text: string }
  | { type: 'toRevise' }
  | { type: 'toTeach' }
  | { type: 'toSummary' }
  | { type: 'help' } & At
  | { type: 'askTeacher' } & At
  | { type: 'taught'; text: string; result: TeachResult } & At
  | { type: 'challengeAnswer'; text: string; result: TeachResult } & At
  | { type: 'transferred'; text: string; result: TransferResult }
  | { type: 'check'; choice: number } & At
  | { type: 'physical'; experimentId: string; observation: string; matched: boolean | null } & At;

export function startJourney(
  pack: ConceptPack, input: { id: string; alias: string; grade: number; lang: Lang; quick: boolean; at: number },
): Journey {
  const record = newRecord({ id: input.id, pack: pack.id, alias: input.alias.trim().slice(0, 20), grade: input.grade, lang: input.lang, at: input.at });
  return { record, step: 'meet', quick: input.quick, experimentId: null, cond: conditionsFor(pack), pending: null };
}

const go = (s: Journey, step: Step): Journey => ({ ...s, step });
const add = (s: Journey, ...events: LearnerEvent[]): Journey => ({ ...s, record: events.reduce(addEvent, s.record) });
const finish = (s: Journey, at: number): Journey =>
  ({ ...s, step: 'summary', record: { ...s.record, finishedAt: s.record.finishedAt ?? at } });
const score = (answers: number[], correct: number[]) => correct.filter((c, i) => answers[i] === c).length;

function toTest(pack: ConceptPack, s: Journey, experimentId?: string): Journey {
  const x = experimentById(pack, experimentId) ?? recommendExperiment(pack, s.record);
  return { ...s, step: 'hypothesis', experimentId: x?.id ?? null, cond: conditionsFor(pack, x?.change) };
}

const TESTABLE_FROM: Step[] = ['explain', 'clarify', 'understood', 'prereq', 'hypothesis', 'predict', 'reveal', 'reflect', 'revise', 'guided', 'teach', 'summary'];
const NO_HELP: Step[] = ['meet', 'pretest', 'predict', 'posttest', 'summary'];

export function journeyReducer(pack: ConceptPack, s: Journey, a: Action): Journey {
  const r = s.record;
  switch (a.type) {
    case 'continue':
      switch (s.step) {
        case 'meet': return go(s, !s.quick && pack.preTest.length ? 'pretest' : 'phenomenon');
        case 'phenomenon': return go(s, 'explain');
        // a partial idea is enough to start testing, if the learner prefers not to add to it
        case 'clarify': return lastEvent(r, 'explain')?.diagnosis.model ? go(s, 'understood') : s;
        case 'understood': {
          const last = lastEvent(r, 'explain');
          if (!last) return go(s, 'explain');
          if (last.phase !== 'revise' && gapTask(pack, r)) return go(s, 'prereq');
          const status = currentDiagnosis(r)?.status;
          // an idea that is already complete after testing goes on to teaching; otherwise it gets a test
          if (observations(r).length && (status === 'correct' || status === 'partial')) return go(s, 'teach');
          return toTest(pack, s);
        }
        case 'reveal':
          if (shouldGuide(pack, r)) return go(add(s, { type: 'assist', at: a.at, level: GUIDED_LEVEL }), 'guided');
          return go(s, 'reflect');
        case 'teach': {
          const n = noorAttempt(pack, r);
          return go(add(s, { type: 'challenge', at: a.at, known: n.known, solved: n.solved }), 'challenge');
        }
        case 'challenge': return go(s, 'transfer');
        default: return s;
      }

    case 'quiz': {
      const kind = s.step === 'pretest' ? 'pre' : s.step === 'posttest' ? 'post' : null;
      if (!kind) return s;
      const questions = kind === 'pre' ? pack.preTest : pack.postTest;
      const next = add(s, { type: 'quiz', at: a.at, kind, answers: a.answers, score: score(a.answers, questions.map((q) => q.correct)), total: questions.length });
      return kind === 'pre' ? go(next, 'phenomenon') : finish(next, a.at);
    }

    case 'explained': {
      if (!['explain', 'clarify', 'revise', 'guided'].includes(s.step)) return s;
      const tested = observations(r).length > 0;
      const phase = tested && currentDiagnosis(r) ? 'revise' : lastEvent(r, 'explain') ? 'clarify' : 'initial';
      const next = add(s, { type: 'explain', at: a.at, phase, text: a.text.slice(0, 600), diagnosis: a.diagnosis });
      if (!a.diagnosis.model) return go(next, 'clarify');
      // a partial explanation is asked once for its missing link before the first test
      const askedBefore = r.events.some((e) => e.type === 'explain' && e.diagnosis.status === 'partial');
      if (a.diagnosis.status === 'partial' && !tested && !askedBefore) return go(next, 'clarify');
      return go(next, 'understood');
    }

    case 'reword': {
      if (s.step !== 'understood') return s;
      return go(s, lastEvent(r, 'explain')?.phase === 'revise' ? 'revise' : 'explain');
    }

    case 'prereqAnswer': {
      const task = s.step === 'prereq' ? gapTask(pack, r) : null;
      if (!task || task.kind === 'remedy') return s;
      const next = add(s, {
        type: 'prereq', at: a.at, prereqId: task.prereq.id, questionId: task.question.id,
        correct: a.choice === task.question.correct, phase: task.kind,
      });
      return gapTask(pack, next.record) ? next : toTest(pack, next);
    }

    case 'remedyDone': {
      const task = s.step === 'prereq' ? gapTask(pack, r) : null;
      return task?.kind === 'remedy' ? add(s, { type: 'remedy', at: a.at, prereqId: task.prereq.id }) : s;
    }

    case 'toTest':
      return TESTABLE_FROM.includes(s.step) ? toTest(pack, s, a.experimentId) : s;

    case 'choose': {
      if (s.step !== 'hypothesis') return s;
      const named = experimentById(pack, a.experimentId);
      if (named) return { ...s, step: 'predict', experimentId: named.id, cond: experimentConditions(pack, named.id) };
      // the learner's own combination: it must use the pack's variables and change something
      if (!validConditions(pack, a.cond)) return s;
      const same = experimentFor(pack, a.cond);
      if (!same && sameConditions(a.cond, conditionsFor(pack))) return s;
      return { ...s, step: 'predict', experimentId: same?.id ?? null, cond: { ...a.cond } };
    }

    case 'unchoose':
      return s.step === 'predict' ? go(s, 'hypothesis') : s;

    case 'predict': {
      if (s.step !== 'predict' || !choicesFor(pack, s.experimentId).includes(a.outcome)) return s;
      const model = currentDiagnosis(r)?.model ?? null;
      const real = pack.realOutcome(s.cond);
      return go(add(s,
        { type: 'predict', at: a.at, experimentId: s.experimentId, cond: s.cond, outcome: a.outcome },
        {
          type: 'observe', at: a.at, experimentId: s.experimentId, cond: s.cond, real, note: '',
          predicted: a.outcome, hypothesis: model ? compare(pack, model, s.cond).kid : null,
        },
      ), 'reveal');
    }

    case 'note': {
      if (s.step !== 'reveal' && s.step !== 'reflect') return s;
      const i = r.events.map((e) => e.type).lastIndexOf('observe');
      if (i < 0) return s;
      const note = a.text.slice(0, 300);
      return { ...s, record: { ...r, events: r.events.map((e, j) => (j === i && e.type === 'observe' ? { ...e, note } : e)) } };
    }

    case 'toRevise':
      return observations(r).length && ['reflect', 'reveal', 'hypothesis', 'understood', 'teach', 'summary'].includes(s.step) ? go(s, 'revise') : s;

    case 'toTeach':
      return observations(r).length && ['reflect', 'reveal', 'understood', 'revise', 'guided', 'clarify', 'hypothesis', 'summary'].includes(s.step)
        ? go(s, 'teach') : s;

    case 'toSummary':
      return r.finishedAt ? go(s, 'summary') : s;

    case 'help': {
      if (NO_HELP.includes(s.step)) return s;
      const help = nextHelp(r);
      if (help.locked || (help.level === TEACHER_LEVEL && openHelp(r) === TEACHER_LEVEL)) return s;
      return add(s, { type: 'assist', at: a.at, level: help.level });
    }

    case 'askTeacher':
      return openHelp(r) === TEACHER_LEVEL ? s : add(s, { type: 'assist', at: a.at, level: TEACHER_LEVEL });

    case 'taught': {
      if (s.step !== 'teach') return s;
      const next = add(s, { type: 'teach', at: a.at, text: a.text.slice(0, 600), caught: a.result.caught, steps: a.result.steps, source: a.result.source });
      // after repeated tries: guided help once, then the learner says it in their own words
      return !a.result.caught && teachFailures(next.record) >= STUCK_AFTER && !gotGuidance(next.record)
        ? add(next, { type: 'assist', at: a.at, level: GUIDED_LEVEL }) : next;
    }

    case 'challengeAnswer': {
      if (s.step !== 'challenge' || !canAnswerChallenge(r)) return s;
      // this reply adds knowledge for Noor; it is not another correction of her planted mistake
      const caught = teachTries(r).some((e) => e.caught);
      const taught = add(s, { type: 'teach', at: a.at, text: a.text.slice(0, 600), caught, steps: a.result.steps, source: a.result.source });
      const n = noorAttempt(pack, taught.record);
      return add(taught, { type: 'challenge', at: a.at, known: n.known, solved: n.solved });
    }

    case 'transferred':
      return s.step === 'transfer' ? { ...s, step: 'check', pending: { text: a.text.slice(0, 600), steps: a.result.steps, source: a.result.source } } : s;

    case 'check': {
      if (s.step !== 'check' || !s.pending) return s;
      const { text, steps, source } = s.pending;
      const next = add({ ...s, pending: null }, {
        type: 'transfer', at: a.at, text, steps, source, choice: a.choice, choiceCorrect: a.choice === pack.transfer.check.correct,
      });
      const asked = r.events.some((e) => e.type === 'quiz' && e.kind === 'post');
      return s.quick || asked || !pack.postTest.length ? finish(next, a.at) : go(next, 'posttest');
    }

    case 'physical':
      return s.step === 'summary'
        ? add(s, { type: 'physical', at: a.at, experimentId: a.experimentId, observation: a.observation.slice(0, 600), matched: a.matched })
        : s;
  }
}
