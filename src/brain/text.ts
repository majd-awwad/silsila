/**
 * Language utilities shared by the offline rules and by the checks applied to model output.
 * Everything here is deterministic and covers Palestinian/Levantine child writing and simple English.
 */

/** Normalise Palestinian-Arabic child writing: diacritics, letter variants, stretched letters, spacing. */
export function normaliseArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/([^\d])\1{2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lower-case + Arabic normalisation. Pack rules and step tests are written against this form. */
export const normaliseText = (s: string): string =>
  normaliseArabic(s.toLowerCase().replace(/[’‘]/g, "'"));

const NEGATORS = new Set([
  'مش', 'مو', 'مب', 'ما', 'لا', 'ولا', 'مستحيل', 'ابدا', 'بدون', 'بلا', 'ليس', 'ليست', 'لم', 'لن', 'منها', 'مانو', 'مهو', 'مهي',
  'not', 'no', 'never', "doesn't", 'doesnt', "isn't", 'isnt', "don't", 'dont', 'cannot', "can't", 'cant', "won't", 'without', "didn't",
]);
NEGATORS.delete('منها');

/** «ما بنشوفها», «ما بعرف» negate seeing or knowing, not the idea that follows. */
const PERCEPTION = /^(ب|من|بن|بت|بي|ي|ت|ن|م)?(شوف|شاف|شايف|عرف|بعرف|لاحظ|بين)/;
const CLAUSE_BREAK = /[،,.؛;:!?؟\n]|(?:^|\s)(?:بس|لكن|بل|لانه?|لانها|عشان|but|because|rather)(?=\s)/g;

/** Is the match that starts at `index` (in normalised text) negated by the learner? */
export function isNegated(text: string, index: number): boolean {
  const before = text.slice(0, index);
  let start = 0;
  for (const m of before.matchAll(CLAUSE_BREAK)) start = m.index + m[0].length;
  const clause = before.slice(start);
  const tokens = clause.split(' ').filter(Boolean);
  // drop the partial word the match starts inside
  if (clause.length && !clause.endsWith(' ')) tokens.pop();
  const whole = text.slice(start + clause.lastIndexOf(' ') + 1).split(' ')[0] ?? '';
  // «مابتنزش»: Levantine circumfix negation written as one word
  if (/^ما.{2,}ش$/.test(whole)) return true;
  const window = tokens.slice(-3);
  return window.some((t, i) => {
    if (!NEGATORS.has(t)) return false;
    const next = window[i + 1] ?? whole;
    if (PERCEPTION.test(next)) return false;
    // «في ما بالهوا»: here «ما» is water, not "no"
    if (t === 'ما' && (window[i - 1] === 'في' || window[i - 1] === 'فيه')) return false;
    // «ما» after a connector like «لما» is a separate token and never reaches here
    return true;
  });
}

export interface Hit { affirmed: string | null; negated: string | null }

/** All matches of a rule, split into what the learner asserted and what they rejected. */
export function findHits(normalised: string, re: RegExp): Hit {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const hit: Hit = { affirmed: null, negated: null };
  for (const m of normalised.matchAll(g)) {
    if (!m[0]) continue;
    if (isNegated(normalised, m.index)) hit.negated ??= m[0];
    else hit.affirmed ??= m[0];
  }
  return hit;
}

/**
 * Did the learner really say this? Used to verify the model's evidence quotes: an idea or step counts only
 * when the quoted words appear in the learner's own text.
 */
export function quoteIn(text: string, quote: string): boolean {
  const clean = (s: string) => normaliseText(s).replace(/[«»"'`.,،؛;:!?؟()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  const q = clean(quote);
  return q.length >= 2 && clean(text).includes(q);
}

export const UNSURE = /ما ?بعرف|مش عارف|مش متاكد|بعرفش|مش فاهم|ولا اشي|لا اعرف|ما عندي فكره|i (do ?n'?t|dont) know|not sure|no idea|idk/;
export const OFF_TOPIC = /^(مرحبا|هاي|السلام عليكم|كيفك|صباح الخير|hello|hi|hey)\b|كره القدم|ماتش|بدي العب|ignore (all |the )?(previous|above)|system prompt|تجاهل (كل )?التعليمات/;
