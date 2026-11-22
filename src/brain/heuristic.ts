/**
 * Offline fallback: understands common child phrasings by keywords, in the same contract as the AI.
 * It is deliberately simple. It exists so the demo never stops, not to replace the AI.
 * Its score on evals/utterances.json is the floor the AI must beat.
 */
import type { BrainContext, Diagnosis, Path, Source } from '../contracts';
import { EXPERIMENTS, NOOR } from '../lesson/condensation';
import { normaliseDiagnosis } from './normalise';
import { derivePredictions, pickBestExperiment } from './predictions';

const strip = (s: string) =>
  s
    .replace(/[ً-ْـ]/g, '') // tashkeel + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

export function heuristicDiagnose(text: string, ctx: BrainContext): Diagnosis {
  const t = strip(text);
  const has = (re: RegExp) => re.test(t);
  const air = has(/هوا|الجو|بخار|رطوب/);
  const cool = has(/برد|بارد|تبرد|بتبرد|تبريد/);
  const drops = has(/نقط|تتجمع|بتصير مي|بتتحول|تكاثف|بتتكثف/);
  const rubric = { vapor_in_air: air ? 1 : 0, cooling: air && cool ? 1 : 0, turns_to_drops: air && drops ? 1 : 0 } as const;

  if (air && cool && drops) {
    return normaliseDiagnosis(
      {
        status: 'correct',
        caption: 'هيك إنت شايفها: في مي بالهوا بتبرد ع الكاسة وبتصير نقط.',
        sources: ['air_vapor'], path: 'from_air', needs_cold: true,
        chain: { C1: 'ok', C2: 'ok', C3: 'ok', C4: 'ok', C5: 'unknown' },
        broken_link: null, best_experiment: null,
        noor: 'واو! حكيت إن الهوا فيه مي وإنها بتبرد ع الكاسة. بتعلّمني إنت هلأ؟',
        rubric, confidence: 0.6, evidence: text.slice(0, 60),
      },
      text, ctx, 'fallback',
    );
  }

  const unsure = has(/ما بعرف|مش عارف|مش متاكد|بعرفش|ما بعرفش/) && !has(/لحالها/);
  if (unsure) {
    return normaliseDiagnosis(
      { status: 'clarify', noor: 'عادي! طيب برأيك، المي اللي برّا هي نفس المي اللي جوّا الكاسة، ولا إجت من مكان ثاني؟', rubric, confidence: 0.4 },
      text, ctx, 'fallback',
    );
  }

  let src: Source[] = [];
  let path: Path = 'appears_on_surface';
  let cap = '';
  if (has(/ثلج|تلج|ذاب|بيذوب/)) { src.push('ice'); path = 'through_wall'; cap = 'الثلج بيذوب وبيطلع لبرّا من الكاسة.'; }
  if (has(/نز|تسرب|بتسرب|ترشح|يرشح|بيرشح|من جو|ثقوب|مسامات|بتعبر|طلعت من الكاس|بتطلع من الكاس|بتطلع من جو/)) {
    src.push('inside_water');
    path = has(/فوق|فاضت|طفحت|من الطرف/) ? 'over_rim' : 'through_wall';
    cap = path === 'over_rim' ? 'المي اللي جوّا بتطلع من فوق وبتنزل ع الكاسة.' : 'المي اللي جوّا بتطلع لبرّا من الزجاج.';
  }
  if (has(/عرق|بتبكي|بتدمع/)) { src = ['glass_itself']; path = 'appears_on_surface'; cap = 'الكاسة نفسها بتعرق زي الناس.'; }
  if (has(/البرد|البروده/) && !air && !src.length) { src = ['cold_itself']; cap = 'البرد نفسه بيتحول لمي.'; }
  if (has(/(^|\s)(رش|رشت|كب|كبت|انكب|انكبت|دلق)(\s|$|ها)|حدا/)) { src = ['spill_from_above']; path = 'falls_from_above'; cap = 'حدا رشّ أو كبّ مي ع الكاسة.'; }
  if (has(/(^|\s)(نفس|تنفس|نتنفس|بنتنفس|بيتنفسوا|نفخ)(\s|$)/)) { src = ['people_breath']; path = 'from_air'; cap = 'نفَس الناس بيلزق ع الكاسة.'; }
  if (has(/لحالها|سحر|من ولا اشي/)) { src = ['appears_magic']; cap = 'النقط بتطلع لحالها.'; }
  if (air && !src.length) { src = ['air_vapor']; path = 'from_air'; cap = 'في مي بالهوا بتروح ع الكاسة.'; }

  if (!src.length) {
    return normaliseDiagnosis(
      { status: 'clarify', noor: 'مش متأكدة إني فهمت. المي اللي برّا الكاسة، من وين إجت برأيك؟', rubric, confidence: 0.3 },
      text, ctx, 'fallback',
    );
  }

  const parts = { sources: src.slice(0, 2), path, needs_cold: src.includes('cold_itself') };
  const model = { ...parts, predictions: derivePredictions(parts) };
  const best = pickBestExperiment(model, ctx.experiments);
  const hasAir = src.includes('air_vapor');
  return normaliseDiagnosis(
    {
      status: 'model',
      caption: 'هيك إنت شايفها: ' + cap,
      ...model,
      chain: { C1: 'unknown', C2: hasAir ? 'ok' : 'missing', C3: hasAir && !cool ? 'missing' : 'unknown', C4: 'unknown', C5: 'unknown' },
      broken_link: hasAir ? 'C3' : 'C2',
      best_experiment: best,
      noor: best ? `فهمت عليك! طيب لو جرّبنا: ${EXPERIMENTS[best].name}، شو بتتوقّع يصير؟` : NOOR.safeFallback,
      rubric, confidence: 0.5, evidence: text.slice(0, 60),
    },
    text, ctx, 'fallback',
  );
}

export function heuristicTeach(text: string) {
  const t = strip(text);
  const caught = /اقل|قليل|ما بيطلع|ما في|ناشف.*(مي|بخار)|مي اقل/.test(t) && !/اكثر/.test(t.replace(/مش اكثر|لا اكثر/, ''));
  return { caught, noor: caught ? NOOR.thanks : NOOR.stillConfused, rubric: { vapor_in_air: 1, cooling: 1, turns_to_drops: 1 } as const };
}
