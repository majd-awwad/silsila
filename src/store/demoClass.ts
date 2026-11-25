/**
 * Demo classes (marked demo: true) so the teacher screen is meaningful before real sessions exist.
 * Built from typical child phrasings run through the offline brain. Labelled as demo on screen, and can be hidden.
 */
import type { BrainContext, ExperimentRun, Session } from '../contracts';
import { heuristicDiagnose } from '../brain/heuristic';
import { compare, conditionsFor } from '../brain/world';
import { getPack } from '../packs';

type Row = [string, string, number, number, boolean, number];
// pseudonym, first explanation, pre, post, taught Noor, transfer score
const ROWS: Record<string, Row[]> = {
  condensation: [
    ['نجمة', 'المي بتنزّ من الكاسة لبرّا', 1, 4, true, 3], ['قمر', 'الثلج بيذوب وبيطلع من الكاسة', 0, 3, true, 2],
    ['غيمة', 'الكاسة بتعرق زيّنا', 1, 3, true, 2], ['زيتونة', 'المي بتطلع من جوا الكاسة من ثقوب صغيرة', 1, 4, true, 3],
    ['برق', 'البرد نفسه بيصير مي', 0, 2, false, 1], ['نسمة', 'من الهوا', 2, 4, true, 3],
    ['شمس', 'الثلج ذاب ونزّ', 0, 3, true, 2], ['موجة', 'ما بعرف بتطلع لحالها', 0, 2, false, 1],
    ['سنبلة', 'المي بتنزّ من الزجاج', 1, 3, true, 3], ['لؤلؤة', 'حدا رشّ عليها مي', 1, 4, true, 3],
    ['ريحانة', 'المي بتطلع من فوق وبتنزل', 1, 3, true, 2], ['ياسمين', 'الكاسة بتعرق من البرد', 0, 3, true, 2],
    ['نخلة', 'المي بتتسرب من الكاسة', 1, 2, false, 1], ['فراشة', 'من نفس الناس', 1, 3, true, 2],
    ['حبق', 'الثلج بيذوب وبيطلع', 0, 4, true, 3], ['مطر', 'في مي بالهوا بتروح ع الكاسة', 2, 4, true, 3],
  ],
  evaporation: [
    ['نجمة', 'الكاسة بتشرب المي', 1, 4, true, 3], ['قمر', 'الشمس بتسحب المي', 1, 3, true, 2],
    ['غيمة', 'المي بتنزّ من تحت', 0, 3, true, 2], ['زيتونة', 'الهوا بياخدها', 2, 4, true, 3],
    ['برق', 'المي بتختفي لحالها', 0, 2, false, 1], ['نسمة', 'الشمس بتسحبها لفوق', 1, 3, true, 2],
    ['شمس', 'الكاسة بتشربها', 0, 3, true, 2], ['موجة', 'حدا شربها', 1, 2, false, 1],
    ['سنبلة', 'المي بتصير بخار وبتطلع للهوا لما تسخن', 2, 4, true, 3], ['لؤلؤة', 'الشمس بتشفطها', 1, 3, true, 3],
  ],
};

export function demoClass(packId: string): Session[] {
  const pack = getPack(packId);
  const t0 = Date.parse('2026-11-24T09:00:00+02:00');
  return (ROWS[pack.id] ?? []).map(([pseudonym, text, pre, post, caught, tr], i) => {
    const ctx: BrainContext = { pack: pack.id, phase: 'explain', previous: [], experiments: [] };
    const d = heuristicDiagnose(pack, text, ctx);
    const at = t0 + i * 90_000;
    const experiments: ExperimentRun[] = [];
    const preset = pack.presets.find((p) => p.id === d.best_experiment);
    if (d.model && preset) {
      const cond = conditionsFor(pack, preset.change), c = compare(pack, d.model, cond);
      experiments.push({ preset: preset.id, cond, predicted: c.kid, real: c.real, contradicted: c.contradicted, at: at + 120_000 });
    }
    const explanations = [{ text, at: at + 60_000, diagnosis: d }];
    if (caught) {
      const fix = heuristicDiagnose(pack, pack.samplePhrases.at(-1)!, { ...ctx, previous: [{ text, caption: d.caption, status: d.status }] });
      explanations.push({ text: pack.samplePhrases.at(-1)!, at: at + 300_000, diagnosis: fix });
    }
    return {
      id: `demo-${pack.id}-${i}`, pack: pack.id, pseudonym, grade: 4, startedAt: at, finishedAt: at + 14 * 60_000,
      pre: { answers: [], score: pre, total: 4 }, post: { answers: [], score: post, total: 4 },
      explanations, experiments,
      teach: { turns: caught ? 1 : 2, caught, quote: caught ? 'لأ، رح يصير أقل' : '' },
      challenge: caught ? { answer: pack.challenge.correctAnswer, missing: [], resolved: true } : null,
      transfer: { text: '', rubric: { s1: tr > 0 ? 1 : 0, s2: tr > 1 ? 1 : 0, s3: tr > 2 ? 1 : 0 }, score: tr },
      classCode: null, quick: false, demo: true,
    };
  });
}
