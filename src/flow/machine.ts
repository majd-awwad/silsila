/**
 * The lesson as a small state machine. Pure: no fetches, no timers, no 3D.
 *   welcome → pretest → lab → posttest → summary        (quick mode for judges skips the two tests)
 *   lab: explain ⇄ experiments → teach (Noor's planted mistake) → challenge (Noor explains a new
 *        phenomenon from the child's teaching only) → transfer (the child explains a new phenomenon) → done
 * Screens dispatch actions; the Lab screen does the async brain calls and dispatches the results.
 */
import type { BrainContext, ChallengeResult, ChildModel, Conditions, Diagnosis, ExperimentRun, QuizResult, Session, TeachResult, TransferResult } from '../contracts';
import { getPack } from '../packs';
import { newSession } from '../store/sessions';

export type Phase = 'welcome' | 'pretest' | 'lab' | 'posttest' | 'summary';
export type LabPhase = 'explain' | 'teach' | 'challenge' | 'transfer' | 'done';
export interface Msg { id: number; who: 'noor' | 'kid' | 'sys' | 'verdict' | 'challenge'; text: string; ok?: boolean }

export interface State {
  phase: Phase;
  lab: LabPhase;
  session: Session | null;
  messages: Msg[];
  diag: Diagnosis | null;
  model: ChildModel | null;
  cond: Conditions;
  busy: boolean;
  msgSeq: number;
  /** what the child said while teaching Noor (her only knowledge in the challenge) */
  teachings: string[];
  challengeTries: number;
}

export type Action =
  | { type: 'START'; pack: string; pseudonym: string; grade: number; classCode: string | null; quick: boolean }
  | { type: 'PRE_DONE'; result: QuizResult }
  | { type: 'NOOR'; text: string }
  | { type: 'SYS'; text: string }
  | { type: 'CHILD_SAID'; text: string }
  | { type: 'BUSY'; busy: boolean }
  | { type: 'DIAGNOSED'; text: string; diag: Diagnosis }
  | { type: 'SET_COND'; cond: Conditions }
  | { type: 'EXPERIMENT_RESULT'; run: ExperimentRun; verdict: string; noor?: string }
  | { type: 'TAUGHT'; text: string; result: TeachResult }
  | { type: 'CHALLENGED'; result: ChallengeResult; childText?: string }
  | { type: 'TRANSFERRED'; text: string; result: TransferResult }
  | { type: 'TO_POST' }
  | { type: 'POST_DONE'; result: QuizResult }
  | { type: 'RESTART' };

/**
 * A child who is still stuck after this many tries is not left to struggle: Noor explains it gently,
 * the child retells it in their own words, and the teacher sees "needs follow-up" (decision of 25/11:
 * we never want the child to give up on the lesson).
 */
export const STUCK_AFTER = 3;

/** How many different experiments have already contradicted the child's idea. */
export function contradictedCount(runs: ExperimentRun[]): number {
  return new Set(runs.filter((r) => r.contradicted).map((r) => JSON.stringify(Object.entries(r.cond).sort()))).size;
}

/** Teaching Noor failed STUCK_AFTER times in a row (this turn included)? */
export function teachStuck(turnsBefore: number, caught: boolean): boolean {
  return !caught && turnsBefore + 1 >= STUCK_AFTER;
}

export const initialState: State = {
  phase: 'welcome', lab: 'explain', session: null, messages: [], diag: null, model: null, cond: {}, busy: false, msgSeq: 0,
  teachings: [], challengeTries: 0,
};

function push(s: State, who: Msg['who'], text: string, ok?: boolean): State {
  return { ...s, msgSeq: s.msgSeq + 1, messages: [...s.messages, { id: s.msgSeq + 1, who, text, ok }] };
}
function withSession(s: State, f: (x: Session) => Session): State {
  return s.session ? { ...s, session: f(s.session) } : s;
}
const packOf = (s: State) => getPack(s.session?.pack);

function enterLab(s: State): State {
  const pack = packOf(s);
  return push({ ...s, phase: 'lab', lab: 'explain', cond: { ...pack.baseline } }, 'noor', pack.noor.greeting);
}

function enterTransfer(s: State): State {
  const pack = packOf(s);
  return push({ ...s, lab: 'transfer' }, 'noor', `${pack.noor.transferIntro} ${pack.transfer.question}`);
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'START': {
      const session = { ...newSession(a.pack, a.pseudonym, a.grade), classCode: a.classCode, quick: a.quick };
      const next: State = { ...initialState, phase: 'pretest', session };
      return a.quick ? enterLab(next) : next;
    }
    case 'PRE_DONE':
      return enterLab(withSession(s, (x) => ({ ...x, pre: a.result })));
    case 'NOOR':
      return push(s, 'noor', a.text);
    case 'SYS':
      return push(s, 'sys', a.text);
    case 'CHILD_SAID': {
      const next = push(s, 'kid', a.text);
      return s.lab === 'teach' || s.lab === 'challenge' ? { ...next, teachings: [...s.teachings, a.text] } : next;
    }
    case 'BUSY':
      return { ...s, busy: a.busy };
    case 'DIAGNOSED': {
      let next = withSession({ ...s, busy: false }, (x) => ({ ...x, explanations: [...x.explanations, { text: a.text, at: Date.now(), diagnosis: a.diag }] }));
      const drawable = a.diag.status === 'model' || a.diag.status === 'correct';
      if (drawable) next = { ...next, diag: a.diag, model: a.diag.model };
      else if (next.diag) next = { ...next, diag: { ...next.diag, rubric: a.diag.rubric } };
      if (a.diag.status === 'correct') next = { ...next, lab: 'teach', teachings: [a.text] };
      return push(next, 'noor', a.diag.noor);
    }
    case 'SET_COND':
      return { ...s, cond: a.cond };
    case 'EXPERIMENT_RESULT': {
      let next = push(withSession(s, (x) => ({ ...x, experiments: [...x.experiments, a.run] })), 'verdict', a.verdict, !a.run.contradicted);
      const stuck = s.lab === 'explain' && !s.session?.scaffolded && s.diag?.status !== 'correct'
        && contradictedCount(next.session?.experiments ?? []) >= STUCK_AFTER;
      if (stuck) return push(withSession(next, (x) => ({ ...x, scaffolded: true })), 'noor', packOf(s).noor.reveal);
      if (a.noor) next = push(next, 'noor', a.noor);
      return next;
    }
    case 'TAUGHT': {
      const stuck = teachStuck(s.session?.teach?.turns ?? 0, a.result.caught);
      let next = withSession({ ...s, busy: false }, (x) => ({
        ...x, teach: { turns: (x.teach?.turns ?? 0) + 1, caught: a.result.caught, quote: a.result.caught ? a.text : x.teach?.quote ?? '' },
        scaffolded: x.scaffolded || stuck,
      }));
      if (stuck) {
        // Noor explains the correction herself; her challenge then rests on what she was just told
        next = push({ ...next, teachings: [...s.teachings, packOf(s).scienceChain.join('، ')] }, 'noor', packOf(s).noor.reveal);
      } else next = push(next, 'noor', a.result.noor);
      if (a.result.caught || stuck) next = push({ ...next, lab: 'challenge' }, 'noor', `${packOf(s).noor.challengeIntro} ${packOf(s).challenge.phenomenon}`);
      return next;
    }
    case 'CHALLENGED': {
      const tries = s.challengeTries + 1;
      const resolved = a.result.missing.length === 0;
      let next = withSession({ ...s, busy: false, challengeTries: tries }, (x) => ({ ...x, challenge: { answer: a.result.answer, missing: a.result.missing, resolved } }));
      next = push(next, 'challenge', a.result.answer, resolved);
      if (!resolved && tries < 3) return push(next, 'noor', a.result.ask);
      if (!resolved) next = push(next, 'noor', 'شكراً! هلأ صار عندي فكرة أوضح.');
      return enterTransfer(next);
    }
    case 'TRANSFERRED': {
      const next = withSession({ ...s, busy: false, lab: 'done' }, (x) => ({ ...x, transfer: { text: a.text, rubric: a.result.rubric, score: a.result.score } }));
      return push(next, 'noor', a.result.noor);
    }
    case 'TO_POST':
      return s.session?.quick
        ? withSession({ ...s, phase: 'summary' }, (x) => ({ ...x, finishedAt: Date.now() }))
        : { ...s, phase: 'posttest' };
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
    pack: s.session?.pack ?? 'condensation',
    phase: s.lab === 'explain' ? 'explain' : 'teach',
    previous: ex.slice(-6).map((e) => ({ text: e.text, caption: e.diagnosis.caption, status: e.diagnosis.status })),
    experiments: (s.session?.experiments ?? []).slice(-12),
  };
}
