/**
 * Two ways to see the same lesson (decision of 25/11):
 *  - child mode (default): the child sees only THEIR OWN idea and chain. The scientific chain, the
 *    "what really happens" table and the hint about which experiment breaks the idea stay hidden, because
 *    showing them would give the answer away.
 *  - judge mode (?judge=1): everything is open, so the AI's reasoning can be inspected. ?judge=0 switches it off.
 * The choice is remembered on this device.
 */
const KEY = 'silsila-judge';

export function isJudgeMode(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('judge');
    if (q === '1') localStorage.setItem(KEY, '1');
    if (q === '0') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === '1';
  } catch {
    return new URLSearchParams(location.search).get('judge') === '1';
  }
}

/** What the child may see of the AI's reasoning, given where they are in the lesson. */
export function reveals(opts: { judge: boolean; lab: string; contradicted: boolean }) {
  const { judge, lab, contradicted } = opts;
  return {
    /** the scientific chain: only after the child has fixed their idea (or in judge mode) */
    science: judge || lab !== 'explain',
    /** mark the wrong step in the child's chain: only once an experiment has shown it (or in judge mode) */
    wrongStep: judge || contradicted || lab !== 'explain',
    /** the engine's table, confidence, broken-link grid, rubric, best-experiment button */
    engine: judge,
  };
}
