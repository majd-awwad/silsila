/**
 * A demo class (marked demo: true) so the teacher screen is meaningful before real sessions exist.
 * Built from typical child phrasings run through the offline brain. Never mixed silently with real data:
 * the teacher screen labels it and can hide it.
 */
import type { BrainContext, ExperimentRun, Session } from '../contracts';
import { heuristicDiagnose } from '../brain/heuristic';
import { outcomeMatches } from '../brain/predictions';
import { EXPERIMENTS } from '../lesson/condensation';

const ROWS: [string, string, number, number, boolean][] = [
  // pseudonym, first explanation, pre, post, taught Noor
  ['نجمة', 'المي بتنزّ من الكاسة لبرّا', 1, 4, true],
  ['قمر', 'الثلج بيذوب وبيطلع من الكاسة', 0, 3, true],
  ['غيمة', 'الكاسة بتعرق زيّنا', 1, 3, true],
  ['زيتونة', 'المي بتطلع من جوا الكاسة من ثقوب صغيرة', 1, 4, true],
  ['برق', 'البرد نفسه بيصير مي', 0, 2, false],
  ['نسمة', 'من الهوا', 2, 4, true],
  ['شمس', 'الثلج ذاب ونزّ', 0, 3, true],
  ['موجة', 'ما بعرف بتطلع لحالها', 0, 2, false],
  ['سنبلة', 'المي بتنزّ من الزجاج', 1, 3, true],
  ['لؤلؤة', 'حدا رشّ عليها مي', 1, 4, true],
  ['ريحانة', 'المي بتطلع من فوق وبتنزل', 1, 3, true],
  ['ياسمين', 'الكاسة بتعرق من البرد', 0, 3, true],
  ['نخلة', 'المي بتتسرب من الكاسة', 1, 2, false],
  ['فراشة', 'من نفس الناس', 1, 3, true],
  ['حبق', 'الثلج بيذوب وبيطلع', 0, 4, true],
  ['مطر', 'في مي بالهوا بتروح ع الكاسة', 2, 4, true],
];

export function demoClass(): Session[] {
  const t0 = Date.parse('2026-11-24T09:00:00+02:00');
  return ROWS.map(([pseudonym, text, pre, post, caught], i) => {
    const ctx: BrainContext = { phase: 'explain', previous: [], experiments: [] };
    const d = heuristicDiagnose(text, ctx);
    const at = t0 + i * 90_000;
    const experiments: ExperimentRun[] = [];
    if (d.model && d.best_experiment) {
      const e = d.best_experiment, p = d.model.predictions[e];
      experiments.push({ exp: e, predicted: p, real: EXPERIMENTS[e].real, contradicted: !outcomeMatches(e, p), at: at + 120_000 });
    }
    return {
      id: `demo-${i}`, pseudonym, grade: 4, startedAt: at, finishedAt: at + 14 * 60_000,
      pre: { answers: [], score: pre, total: 4 }, post: { answers: [], score: post, total: 4 },
      explanations: [{ text, at: at + 60_000, diagnosis: d }],
      experiments,
      teach: { turns: caught ? 1 : 2, caught, quote: caught ? 'الهوا الناشف فيه مي أقل فبيطلع نقط أقل' : '' },
      demo: true,
    };
  });
}
