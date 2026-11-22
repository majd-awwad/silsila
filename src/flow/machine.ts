/**
 * The lesson as a small state machine. Pure: no fetches, no timers, no 3D.
 *   welcome → pretest → lab(explain ⇄ experiment → teach → done) → posttest → summary
 * Screens dispatch actions; the Lab screen does the async brain calls and dispatches the results.
 */
import type { BrainContext, ChildModel, Diagnosis, ExperimentRun, QuizResult, SceneExperiment, Session, TeachResult } from '../contracts';
import { CORRECT_MODEL } from '../brain/predictions';
import { NOOR } from '../lesson/condensation';
import { newSession } from '../store/sessions';

export type Phase = 'welcome' | 'pretest' | 'lab' | 'posttest' | 'summary';
export type LabPhase = 'explain' | 'teach' | 'done';
export interface Msg { id: number; who: 'noor' | 'kid' | 'sys' | 'verdict'; text: string; ok?: boolean }

export interface State {
  phase: Phase;
  lab: LabPhase;
  session: Session | null;
  messages: Msg[];
  diag: Diagnosis | null;
  model: ChildModel | null;
  exp: SceneExperiment;
  busy: boolean;
  msgSeq: number;
}

export type Action =
  | { type: 'START'; pseudonym: string; grade: number }
  | { type: 'PRE_DONE'; result: QuizResult }
  | { type: 'NOOR'; text: string }
  | { type: 'SYS'; text: string }
  | { type: 'CHILD_SAID'; text: string }
  | { type: 'BUSY'; busy: boolean }
  | { type: 'DIAGNOSED'; text: string; diag: Diagnosis }
  | { type: 'EXPERIMENT'; exp: SceneExperiment }
  | { type: 'EXPERIMENT_RESULT'; run: ExperimentRun; verdict: string }
  | { type: 'TAUGHT'; text: string; result: TeachResult }
  | { type: 'TO_POST' }
  | { type: 'POST_DONE'; result: QuizResult }
  | { type: 'RESTART' };

export const initialState: State = {
  phase: 'welcome', lab: 'explain', session: null, messages: [], diag: null, model: null, exp: 'base', busy: false, msgSeq: 0,
};

function push(s: State, who: Msg['who'], text: string, ok?: boolean): State {
  return { ...s, msgSeq: s.msgSeq + 1, messages: [...s.messages, { id: s.msgSeq + 1, who, text, ok }] };
}

function withSession(s: State, f: (x: Session) => Session): State {
  return s.session ? { ...s, session: f(s.session) } : s;
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'START':
      return { ...initialState, phase: 'pretest', session: newSession(a.pseudonym, a.grade) };
    case 'PRE_DONE':
      return push(withSession({ ...s, phase: 'lab', lab: 'explain' }, (x) => ({ ...x, pre: a.result })), 'noor', NOOR.greeting);
    case 'NOOR':
      return push(s, 'noor', a.text);
    case 'SYS':
      return push(s, 'sys', a.text);
    case 'CHILD_SAID':
      return push(s, 'kid', a.text);
    case 'BUSY':
      return { ...s, busy: a.busy };
    case 'DIAGNOSED': {
      let next = withSession({ ...s, busy: false }, (x) => ({
        ...x, explanations: [...x.explanations, { text: a.text, at: Date.now(), diagnosis: a.diag }],
      }));
      const drawable = a.diag.status === 'model' || a.diag.status === 'correct';
      if (drawable) next = { ...next, diag: a.diag, model: a.diag.model, exp: 'base' };
      else if (next.diag) next = { ...next, diag: { ...next.diag, rubric: a.diag.rubric } };
      if (a.diag.status === 'correct') next = { ...next, lab: 'teach', model: CORRECT_MODEL };
      return push(next, 'noor', a.diag.noor);
    }
    case 'EXPERIMENT':
      return { ...s, exp: a.exp };
    case 'EXPERIMENT_RESULT':
      return push(withSession(s, (x) => ({ ...x, experiments: [...x.experiments, a.run] })), 'verdict', a.verdict, !a.run.contradicted);
    case 'TAUGHT': {
      let next = withSession({ ...s, busy: false }, (x) => ({
        ...x, teach: { turns: (x.teach?.turns ?? 0) + 1, caught: a.result.caught, quote: a.result.caught ? a.text : x.teach?.quote ?? '' },
      }));
      next = push(next, 'noor', a.result.noor);
      if (a.result.caught) next = { ...next, lab: 'done' };
      return next;
    }
    case 'TO_POST':
      return { ...s, phase: 'posttest' };
    case 'POST_DONE':
      return withSession({ ...s, phase: 'summary' }, (x) => ({ ...x, post: a.result, finishedAt: Date.now() }));
    case 'RESTART':
      return initialState;
  }
}

/** What the brain needs to know about this child so far. */
export function brainContext(s: State): BrainContext {
  const ex = s.session?.explanations ?? [];
  return {
    phase: s.lab === 'teach' ? 'teach' : 'explain',
    previous: ex.slice(-6).map((e) => ({ text: e.text, caption: e.diagnosis.caption, status: e.diagnosis.status })),
    experiments: s.session?.experiments ?? [],
  };
}
