/**
 * Two ways to see the same lesson (decision of 25/11):
 *  - child mode (default): the learner sees only THEIR OWN idea and chain. The scientific steps, results of
 *    experiments they have not run, the planner's ranking and any mark on their chain stay hidden until their own
 *    evidence shows it, because showing them would give the answer away.
 *  - judge mode (?judge=1): the reasoning panel is available, so the system can be inspected. ?judge=0 switches it off.
 * The choice is remembered on this device.
 */
import { parseRoute } from './router';

const KEY = 'silsila-judge';

/** `query` is the route query (page query and hash query merged); read from the address when not given. */
export function isJudgeMode(query?: URLSearchParams): boolean {
  let asked: string | null = null;
  try {
    asked = (query ?? parseRoute(location.hash, location.search).query).get('judge');
    if (asked === '1') localStorage.setItem(KEY, '1');
    if (asked === '0') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === '1';
  } catch {
    return asked === '1';
  }
}

/** What may be shown of the system's reasoning, given what the learner has seen for themselves. */
export function reveals(opts: { judge: boolean; contradicted: boolean }) {
  const { judge, contradicted } = opts;
  return {
    /** mark the link to investigate in the learner's chain: only after their own experiment showed it */
    wrongStep: judge || contradicted,
    /** the pack's scientific steps in their authored wording */
    science: judge,
    /** planner ranking and scores, diagnosis internals, sample sentences */
    engine: judge,
  };
}
