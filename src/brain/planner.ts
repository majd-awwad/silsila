/**
 * The Intelligent Experiment Planner: an explicit algorithm, no language model.
 *
 * Given the hypotheses present (one learner's, or a whole class's) and the teaching constraints, it
 *  1. removes experiments that are unsafe or infeasible (time, materials, supervision, grade, excluded);
 *  2. computes what every hypothesis predicts and what the reference model says;
 *  3. ranks experiments by a transparent weighted score;
 *  4. builds a short complementary sequence when one experiment cannot reach every idea.
 *
 * `entropyBits` is the predictive outcome entropy H(Y) = −Σ p(y) log₂ p(y) of the outcomes the learners'
 * hypotheses predict. If exactly one hypothesis were true and each predicted deterministically, H(Y) would
 * equal the expected information gain about which one; here the reference model is known, so it measures how
 * much the class disagrees (what makes discussion worthwhile). The score is a planning heuristic and has not
 * been validated as a measure of learning effectiveness.
 */
import type { ChildModel, PlanConstraints, PlanPrediction, PlanResult, RankedExperiment, RejectReason } from '../contracts';
import type { ConceptPack, Experiment } from '../packs/types';
import { compare, conditionsFor, survivesAll } from './world';

export interface Hypothesis {
  /** group key */
  key: string;
  /** idea ids in this hypothesis (empty when there is nothing testable) */
  ideas: string[];
  model: ChildModel | null;
  learners: number;
}

export const WEIGHTS = { reach: 0.4, coverage: 0.25, disagreement: 0.2, objective: 0.1, time: 0.05 } as const;

export const DEFAULT_CONSTRAINTS: PlanConstraints = { minutes: 45, resources: null, grade: 5, supervision: true, objective: null, exclude: [] };

export function entropy(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const h = weights.filter((w) => w > 0).reduce((s, w) => s - (w / total) * Math.log2(w / total), 0);
  return h < 1e-12 ? 0 : h;
}

export function rejectReasons(x: Experiment, c: PlanConstraints): RejectReason[] {
  const why: RejectReason[] = [];
  if (c.exclude.includes(x.id)) why.push('excluded');
  if (c.mode === 'digital') return why;
  if (x.minutes > c.minutes) why.push('time');
  if (c.resources && x.materials.some((m) => !c.resources!.includes(m))) why.push('materials');
  if (x.safety.adult && !c.supervision) why.push('safety');
  if (x.minGrade > c.grade) why.push('grade');
  return why;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export function plan(pack: ConceptPack, hypotheses: Hypothesis[], constraints: PlanConstraints = DEFAULT_CONSTRAINTS): PlanResult {
  const total = hypotheses.reduce((s, h) => s + h.learners, 0);
  const testableList = hypotheses.filter((h) => h.model && h.learners > 0);
  const testable = testableList.reduce((s, h) => s + h.learners, 0);
  const wrongIdeas = [...new Set(testableList.filter((h) => !survivesAll(pack, h.model!)).flatMap((h) => h.ideas))]
    .filter((id) => pack.ideas[id] && !pack.ideas[id].correct);

  const rejected: PlanResult['rejected'] = [];
  const feasible: Experiment[] = [];
  for (const x of pack.experiments) {
    const reasons = rejectReasons(x, constraints);
    if (reasons.length) rejected.push({ id: x.id, reasons });
    else feasible.push(x);
  }

  const objectiveNodes = pack.objectives.find((o) => o.id === constraints.objective)?.nodes;
  const brokenNodes = new Set(wrongIdeas.map((id) => pack.ideas[id].breaks).filter(Boolean));

  const ranked: RankedExperiment[] = feasible.map((x) => {
    const cond = conditionsFor(pack, x.change);
    const real = pack.realOutcome(cond);
    const predictions: PlanPrediction[] = testableList.map((h) => {
      const c = compare(pack, h.model!, cond);
      return { key: h.key, ideas: h.ideas, outcome: c.kid, learners: h.learners, contradicted: c.contradicted };
    });
    const reached = predictions.filter((p) => p.contradicted).reduce((s, p) => s + p.learners, 0);
    const byOutcome = new Map<string, number>();
    for (const p of predictions) byOutcome.set(p.outcome, (byOutcome.get(p.outcome) ?? 0) + p.learners);
    const entropyBits = entropy([...byOutcome.values()]);
    const refutes = wrongIdeas.filter((id) => compare(pack, pack.ideas[id].model, cond).contradicted);
    const parts = {
      reach: testable ? reached / testable : 0,
      disagreement: clamp(entropyBits / Math.log2(Math.max(2, x.choices.length))),
      coverage: wrongIdeas.length ? refutes.length / wrongIdeas.length : 0,
      objective: objectiveNodes
        ? (x.targets.some((n) => objectiveNodes.includes(n)) ? 1 : 0)
        : (brokenNodes.size ? x.targets.filter((n) => brokenNodes.has(n)).length / x.targets.length : 0),
      time: clamp(1 - x.minutes / constraints.minutes),
    };
    const score = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + WEIGHTS[k] * parts[k], 0);
    return { id: x.id, score: Math.round(score * 1000) / 1000, parts, entropyBits: Math.round(entropyBits * 1000) / 1000, reached, refutes, predictions, real, minutes: x.minutes };
  });
  ranked.sort((a, b) => b.score - a.score || a.minutes - b.minutes);

  // greedy complementary sequence: most not-yet-reached ideas (weighted by learners) within the time left
  const weightOf = (id: string) => testableList.filter((h) => h.ideas.includes(id)).reduce((s, h) => s + h.learners, 0);
  const sequence: string[] = [];
  const left = new Set(wrongIdeas);
  let time = constraints.minutes;
  while (left.size && sequence.length < 3) {
    const next = ranked
      .filter((r) => !sequence.includes(r.id) && r.minutes <= time)
      .map((r) => ({ r, gain: r.refutes.filter((id) => left.has(id)).reduce((s, id) => s + weightOf(id), 0) }))
      .filter((c) => c.gain > 0)
      .sort((a, b) => b.gain - a.gain || b.r.score - a.r.score)[0];
    if (!next) break;
    sequence.push(next.r.id);
    time -= next.r.minutes;
    next.r.refutes.forEach((id) => left.delete(id));
  }

  const uncovered = wrongIdeas.filter((id) => !ranked.some((r) => r.refutes.includes(id)));
  // prefer an experiment that actually contradicts someone
  const useful = ranked.find((r) => r.reached > 0) ?? null;

  let mode: PlanResult['mode'];
  if (!total || !testable) mode = 'ask';
  else if (!wrongIdeas.length) mode = testable * 2 >= total ? 'enrich' : 'ask';
  else if (useful) mode = 'experiment';
  else mode = ranked.length ? 'ask' : 'none';

  return { mode, recommended: mode === 'experiment' ? useful : null, ranked, rejected, sequence, uncovered, testable, total };
}
