/**
 * Offline fallback: understands common child phrasings by the pack's keyword rules, in the same contract as the AI.
 * It exists so the demo never stops, not to replace the AI. Its eval score is the floor the AI must beat.
 */
import type { BrainContext, ChallengeResult, Diagnosis, Rubric, TransferResult } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { normaliseDiagnosis } from './normalise';
import { pickBestPreset } from './world';

/** Normalise Palestinian-Arabic child writing: diacritics, letter variants, stretched letters, spacing. */
export function normaliseArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function rubricFor(pack: ConceptPack, t: string): Rubric {
  const r = pack.correctRule;
  const a = r.s1.test(t), b = r.s2.test(t), c = r.s3.test(t);
  return { s1: a ? 1 : 0, s2: a && b ? 1 : 0, s3: a && c ? 1 : 0 };
}

const UNSURE = /ما بعرف|مش عارف|مش متاكد|بعرفش|ما بعرفش|مش فاهم|ولا اشي/;

export function heuristicDiagnose(pack: ConceptPack, text: string, ctx: BrainContext): Diagnosis {
  const t = normaliseArabic(text);
  const rubric = rubricFor(pack, t);
  const clarifies = ctx.previous.filter((p) => p.status === 'clarify').length;
  const ladder = pack.noor.clarifyLadder[Math.min(2, clarifies)];
  const correctStory = pack.sources[pack.correctModel.sources[0]].story;

  if (rubric.s1 && rubric.s2 && rubric.s3) {
    return normaliseDiagnosis(pack, {
      status: 'correct', caption: `هيك إنت شايفها: ${pack.scienceChain.join('، ')}.`,
      child_chain: correctStory, wrong_step: null,
      chain: { C1: 'ok', C2: 'ok', C3: 'ok', C4: 'ok', C5: 'unknown' }, broken_link: null,
      noor: 'واو! شرحك فيه كل الخطوات. بتعلّمني إنت هلأ؟', rubric, confidence: 0.6, evidence: text.slice(0, 60),
    }, text, ctx, 'fallback');
  }

  if (UNSURE.test(t) && !/لحالها/.test(t)) {
    return normaliseDiagnosis(pack, { status: 'clarify', noor: ladder, rubric, confidence: 0.4 }, text, ctx, 'fallback');
  }

  const rule = pack.keywordRules.find((r) => r.re.test(t) && !(r.unless && r.unless.test(t)));
  if (!rule) {
    return normaliseDiagnosis(pack, { status: 'clarify', noor: ladder, rubric, confidence: 0.3 }, text, ctx, 'fallback');
  }

  const correctSource = pack.correctModel.sources[0];
  const isCorrectSource = rule.sources.includes(correctSource);
  const model = { sources: rule.sources.slice(0, 2), path: rule.path, requires: rule.requires ?? [] };
  const best = pickBestPreset(pack, model, ctx.experiments);
  const part = pack.sources[model.sources[0]];
  // which link breaks: no source idea → C2; right source but no mechanism → C3 (condensation) / C4 (speed) handled by AI
  const broken = isCorrectSource ? 'C3' : 'C2';
  return normaliseDiagnosis(pack, {
    status: 'model',
    caption: 'هيك إنت شايفها: ' + rule.caption,
    ...model,
    child_chain: part.story, wrong_step: part.wrongStep,
    chain: { C1: 'unknown', C2: isCorrectSource ? 'ok' : 'missing', C3: isCorrectSource ? 'missing' : 'unknown', C4: 'unknown', C5: 'unknown' },
    broken_link: broken,
    noor: best ? `فهمت عليك! طيب يلا نجرّب بالمختبر: ${best.name}. شو بتتوقّع يصير؟` : 'فهمت عليك! يلا نجرّب بالمختبر: شو بتتوقّع يصير لو غيّرنا إشي؟',
    rubric, confidence: 0.55, evidence: text.slice(0, 60),
  }, text, ctx, 'fallback');
}

export function heuristicTeach(pack: ConceptPack, text: string) {
  const t = normaliseArabic(text);
  const caught = pack.teachCaught.test(t) && !/اكثر/.test(t.replace(/مش اكثر|لا اكثر|مش رح يطلع اكثر/, ''));
  return { caught, noor: caught ? pack.noor.caughtThanks : pack.noor.stillConfused, rubric: rubricFor(pack, t) };
}

/** Noor answers the challenge from the union of what the child expressed while teaching/explaining. */
export function heuristicChallenge(pack: ConceptPack, teachings: string[]): Omit<ChallengeResult, 'source'> {
  const r = rubricFor(pack, normaliseArabic(teachings.join(' ')));
  const missing = (['s1', 's2', 's3'] as const).map((k, i) => (r[k] ? -1 : i)).filter((i) => i >= 0);
  if (!missing.length) return { answer: pack.challenge.correctAnswer, missing: [], ask: '' };
  return {
    answer: `اممم… من اللي علّمتني: ${pack.scienceChain.filter((_, i) => !missing.includes(i)).join('، ') || 'ما عندي معلومات كافية'}. بس في إشي ناقص عندي.`,
    missing,
    ask: `ما علّمتني: ${pack.scienceChain[missing[0]]}؟ كيف بيصير هاد؟`,
  };
}

export function heuristicTransfer(pack: ConceptPack, text: string): Omit<TransferResult, 'source'> {
  const rubric = rubricFor(pack, normaliseArabic(text));
  const score = rubric.s1 + rubric.s2 + rubric.s3;
  return {
    rubric, score,
    noor: score === 3 ? 'برافو! طبّقت نفس الفكرة على ظاهرة جديدة. هيك العلماء بيفكروا!' : `حلو! فهمت منك جزء. بس لسا بدي أعرف: ${pack.scienceChain[(['s1', 's2', 's3'] as const).findIndex((k) => !rubric[k])]}؟`,
  };
}
