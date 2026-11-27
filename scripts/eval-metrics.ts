/**
 * Pure scoring for the diagnosis evaluation: no files, no network, no model. Every rate keeps its numerator and
 * denominator, and a case that got no answer counts as wrong in every success rate.
 */
import { z } from 'zod';
import { Lang, STATUSES } from '../src/contracts';
import type { Diagnosis, DiagnosisStatus } from '../src/contracts';
import { correctIdeaId } from '../src/brain/normalise';
import { DEFAULT_CONSTRAINTS, plan } from '../src/brain/planner';
import { normaliseText } from '../src/brain/text';
import { compare, conditionsFor, experimentById } from '../src/brain/world';
import type { ConceptPack } from '../src/packs/types';

const bit = z.union([z.literal(0), z.literal(1)]);

export const CaseSchema = z.object({
  text: z.string().min(1).max(600),
  lang: Lang,
  split: z.enum(['dev', 'holdout']),
  /** acceptable statuses; the first is the preferred (gold) one */
  status_any: z.array(z.enum(STATUSES)).min(1),
  /** acceptable identified ideas; empty: none should be identified */
  ideas_any: z.array(z.string()),
  steps: z.tuple([bit, bit, bit]).optional(),
  tags: z.array(z.string()),
  origin: z.enum(['team', 'generated']),
});
export type Case = z.infer<typeof CaseSchema>;

export const DEFINITIONS: Record<string, string> = {
  failed: 'No diagnosis returned (in AI mode: timeout, HTTP error or malformed output). Never replaced by the offline rules; counted as wrong in every success rate.',
  identified_ideas: 'The idea ids in the diagnosis, plus the scientific idea when the status is "correct".',
  end_to_end: 'Status is in status_any AND, when ideas_any is not empty, at least one identified idea is in ideas_any. Denominator: all cases.',
  insufficient_consistent: 'When status_any holds "insufficient" together with "partial" or "misconception", answering "insufficient" with no identified idea is consistent: not an idea miss.',
  ideas_partial: 'Cases with a non-empty ideas_any: at least one identified idea is acceptable (extra ideas allowed).',
  ideas_exact: 'Cases with a non-empty ideas_any: at least one idea identified and every identified idea is acceptable.',
  ideas_none_when_none_expected: 'Cases with an empty ideas_any: no idea identified.',
  per_class: 'Gold class = first entry of status_any; a prediction found in status_any counts as the gold class. Classes with support > 0 only.',
  macro_f1: 'Unweighted mean F1 over the classes with support > 0.',
  false_correct: 'Answered cases where "correct" is not acceptable, but the diagnosis is "correct".',
  false_misconception: 'Answered cases whose gold status is "correct" (no wrong-idea status acceptable) that were given a wrong idea.',
  clarification: 'Cases with gold status "insufficient" answered "insufficient" (recall); precision counts "insufficient" answers where it was acceptable.',
  experiment_fit: 'For "misconception"/"multiple" diagnoses whose label names a wrong idea: coverage = the planner recommended an experiment; fits = that experiment contradicts a labelled idea. Planner limits: 45 minutes, all materials, supervision, the pack\'s highest grade.',
  answer_leakage: 'Answered cases with a status other than "correct" where the learner used none of the pack\'s answer words: Noor\'s line or the caption contains one.',
  steps_exact: 'Cases with labelled steps: all three step flags equal the label.',
  latency_ms: 'Nearest-rank percentiles over every attempt, failed ones included.',
};

export interface Scored {
  pack: string;
  index: number;
  c: Case;
  d: Diagnosis | null;
  error: string | null;
  ms: number;
  identified: string[];
  statusOk: boolean;
  /** null: no idea expected */
  ideaPartial: boolean | null;
  ideaExact: boolean | null;
  /** null: an idea was expected */
  noneOk: boolean | null;
  endToEnd: boolean;
  falseMisconception: boolean;
  experiment: { evaluable: boolean; recommended: string | null; fits: boolean } | null;
  leakEligible: boolean;
  leak: boolean;
}

export function scoreCase(pack: ConceptPack, c: Case, index: number, d: Diagnosis | null, error: string | null = null, ms = 0): Scored {
  const correct = correctIdeaId(pack);
  const identified = d ? [...new Set([...d.ideas.map((i) => i.id), ...(d.status === 'correct' ? [correct] : [])])] : [];
  const statusOk = !!d && c.status_any.includes(d.status);
  const expected = c.ideas_any.length > 0;
  const ok = (id: string) => c.ideas_any.includes(id);
  const consistent = !!d && d.status === 'insufficient' && !identified.length
    && c.status_any.includes('insufficient') && (c.status_any.includes('partial') || c.status_any.includes('misconception'));
  const ideaPartial = expected ? consistent || identified.some(ok) : null;
  const ideaExact = expected ? consistent || (identified.length > 0 && identified.every(ok)) : null;

  let experiment: Scored['experiment'] = null;
  if (d && (d.status === 'misconception' || d.status === 'multiple')) {
    const labelled = c.ideas_any.filter((id) => id !== correct && Object.hasOwn(pack.ideas, id));
    const ideas = d.ideas.map((i) => i.id).filter((id) => id !== correct);
    const best = plan(pack, [{ key: ideas.join('+'), ideas, model: d.model, learners: 1 }], { ...DEFAULT_CONSTRAINTS, grade: pack.grades[1] }).recommended;
    const x = experimentById(pack, best?.id);
    experiment = {
      evaluable: labelled.length > 0,
      recommended: best?.id ?? null,
      fits: !!x && labelled.some((id) => compare(pack, pack.ideas[id].model, conditionsFor(pack, x.change)).contradicted),
    };
  }

  const words = new RegExp(pack.answerWords.source, pack.answerWords.flags.replace(/[gy]/g, ''));
  const leakEligible = !!d && d.status !== 'correct' && !words.test(c.text) && !words.test(normaliseText(c.text));

  return {
    pack: pack.id, index, c, d, error, ms, identified, statusOk, ideaPartial, ideaExact,
    noneOk: expected ? null : !!d && !identified.length,
    endToEnd: statusOk && (!expected || !!ideaPartial),
    falseMisconception: !!d && isCorrectGold(c) && (d.status === 'misconception' || d.status === 'multiple' || identified.some((id) => id !== correct)),
    experiment,
    leakEligible,
    leak: leakEligible && (words.test(d!.noor) || words.test(d!.caption)),
  };
}

const isCorrectGold = (c: Case) => c.status_any[0] === 'correct' && !c.status_any.includes('misconception') && !c.status_any.includes('multiple');

export interface Rate { n: number; of: number; pct: number | null }
export const rate = (n: number, of: number): Rate => ({ n, of, pct: of ? Math.round((1000 * n) / of) / 10 : null });

/** Nearest-rank percentile. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]);
}

function classScores(rows: Scored[]) {
  const gold = (r: Scored) => r.c.status_any[0];
  const effective = (r: Scored): DiagnosisStatus | 'failed' => (!r.d ? 'failed' : r.statusOk ? gold(r) : r.d.status);
  const per: Record<string, { support: number; precision: Rate; recall: Rate; f1: number }> = {};
  for (const label of STATUSES) {
    const support = rows.filter((r) => gold(r) === label).length;
    if (!support) continue;
    const tp = rows.filter((r) => gold(r) === label && effective(r) === label).length;
    const fp = rows.filter((r) => gold(r) !== label && effective(r) === label).length;
    const f1 = tp ? (2 * tp) / (2 * tp + fp + (support - tp)) : 0;
    per[label] = { support, precision: rate(tp, tp + fp), recall: rate(tp, support), f1: Math.round(f1 * 1000) / 10 };
  }
  const f1s = Object.values(per).map((p) => p.f1);
  const matrix = (predicted: (r: Scored) => string) => {
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const row = (out[gold(r)] ??= {});
      const k = predicted(r);
      row[k] = (row[k] ?? 0) + 1;
    }
    return out;
  };
  return {
    per_class: per,
    macro_f1: { pct: f1s.length ? Math.round((f1s.reduce((a, b) => a + b, 0) / f1s.length) * 10) / 10 : null, classes: f1s.length },
    /** gold → predicted, accepted alternatives counted as gold */
    confusion: matrix(effective),
    /** gold → the status actually returned */
    confusion_raw: matrix((r) => r.d?.status ?? 'failed'),
  };
}

export function metrics(rows: Scored[]) {
  const answered = rows.filter((r) => r.d);
  const count = (f: (r: Scored) => boolean, list = rows) => list.filter(f).length;
  const share = (list: Scored[], f: (r: Scored) => boolean) => rate(count(f, list), list.length);
  const notCorrect = answered.filter((r) => !r.c.status_any.includes('correct'));
  const experiments = answered.filter((r) => r.experiment?.evaluable);
  const recommended = experiments.filter((r) => r.experiment!.recommended);
  const tags = [...new Set(rows.flatMap((r) => r.c.tags))].sort();
  return {
    total: rows.length,
    answered: answered.length,
    failed: rows.length - answered.length,
    ai_failure: rate(rows.length - answered.length, rows.length),
    end_to_end: share(rows, (r) => r.endToEnd),
    status_accuracy: share(rows, (r) => r.statusOk),
    status_accuracy_answered: share(answered, (r) => r.statusOk),
    ...classScores(rows),
    ideas_partial: share(rows.filter((r) => r.c.ideas_any.length), (r) => !!r.ideaPartial),
    ideas_exact: share(rows.filter((r) => r.c.ideas_any.length), (r) => !!r.ideaExact),
    ideas_none_when_none_expected: share(rows.filter((r) => !r.c.ideas_any.length), (r) => !!r.noneOk),
    false_correct: share(notCorrect, (r) => r.d!.status === 'correct'),
    false_misconception: share(answered.filter((r) => isCorrectGold(r.c)), (r) => r.falseMisconception),
    clarification: {
      recall: share(rows.filter((r) => r.c.status_any[0] === 'insufficient'), (r) => r.d?.status === 'insufficient'),
      precision: share(answered.filter((r) => r.d!.status === 'insufficient'), (r) => r.statusOk),
    },
    experiment_fit: {
      misconception_diagnoses: count((r) => !!r.experiment),
      evaluable: experiments.length,
      coverage: rate(recommended.length, experiments.length),
      fits: share(recommended, (r) => r.experiment!.fits),
    },
    answer_leakage: share(answered.filter((r) => r.leakEligible), (r) => r.leak),
    steps_exact: share(rows.filter((r) => r.c.steps), (r) => !!r.d && r.c.steps!.every((s, i) => !!s === r.d!.steps[i].met)),
    tags: Object.fromEntries(tags.map((tag) => {
      const list = rows.filter((r) => r.c.tags.includes(tag));
      return [tag, {
        total: list.length,
        end_to_end: share(list, (r) => r.endToEnd),
        status_accuracy: share(list, (r) => r.statusOk),
        false_correct: share(list.filter((r) => r.d && !r.c.status_any.includes('correct')), (r) => r.d!.status === 'correct'),
      }];
    })),
    latency_ms: { n: rows.length, p50: percentile(rows.map((r) => r.ms), 0.5), p95: percentile(rows.map((r) => r.ms), 0.95) },
  };
}
export type Metrics = ReturnType<typeof metrics>;

/** All cases and each split, with the team-written and generated cases broken out. */
export function breakdown(rows: Scored[]) {
  const splits = (list: Scored[]) => ({
    all: metrics(list),
    dev: metrics(list.filter((r) => r.c.split === 'dev')),
    holdout: metrics(list.filter((r) => r.c.split === 'holdout')),
  });
  return {
    ...splits(rows),
    by_origin: {
      team: splits(rows.filter((r) => r.c.origin === 'team')),
      generated: splits(rows.filter((r) => r.c.origin === 'generated')),
    },
  };
}
