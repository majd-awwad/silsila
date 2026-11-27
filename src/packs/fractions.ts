/**
 * حزمة «ربع ولا تُمن؟» — رياضيات، الصفوف ٣–٥: مقارنة الكسور.
 *
 * What "amount" means in this pack (deterministic, integers only):
 *   amount = size of the whole × coloured share of that whole.
 *   - Whole sizes are integers in "half units": A is always 2; B is 2 (same), 4 (double) or 1 (half).
 *   - Equal cutting: the whole is cut into d pieces of weight 1, so n/d coloured pieces are really n/d.
 *   - Uneven cutting (whole B only): the first d−1 pieces weigh 2 and the last one weighs d+2 (total 3d).
 *     The first n pieces are coloured, so the real share is 2n/(3d): "1 of 4 pieces" is really 1/6.
 *     The pieces are counted like a fraction, but they are not that fraction, and the screen says so.
 *   Amounts are compared by cross-multiplication. No decimals anywhere.
 */
import type { ChildModel, Conditions, L } from '../contracts';
import type { ConceptPack } from './types';

type Out = 'a_more' | 'b_more' | 'equal';
export type Side = 'a' | 'b';

/** option id → [numerator, denominator] */
export const FRACTIONS: Record<string, readonly [number, number]> = {
  '1_2': [1, 2], '1_3': [1, 3], '1_4': [1, 4], '1_8': [1, 8], '2_4': [2, 4],
  '3_4': [3, 4], '2_8': [2, 8], '3_8': [3, 8], '4_8': [4, 8], '5_8': [5, 8],
};

/** size of a whole in half units (an integer factor): A is 2, B is 1, 2 or 4 */
export function wholeSize(c: Conditions, side: Side): number {
  if (side === 'a') return 2;
  return c.wholes === 'b_bigger' ? 4 : c.wholes === 'b_smaller' ? 1 : 2;
}

export const isUneven = (c: Conditions, side: Side): boolean => side === 'b' && c.cutting === 'unequal';

/** relative size of every piece, in cutting order; the first `numerator` pieces are the coloured ones */
export function pieceWeights(c: Conditions, side: Side): number[] {
  const d = FRACTIONS[c[side]][1];
  if (!isUneven(c, side)) return Array<number>(d).fill(1);
  return [...Array<number>(d - 1).fill(2), d + 2];
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
function reduce(num: number, den: number): [number, number] {
  const g = gcd(num, den) || 1;
  return [num / g, den / g];
}

/** the real coloured share of this side's own whole, reduced */
export function colouredShare(c: Conditions, side: Side): [number, number] {
  const n = FRACTIONS[c[side]][0];
  const w = pieceWeights(c, side);
  return reduce(w.slice(0, n).reduce((s, x) => s + x, 0), w.reduce((s, x) => s + x, 0));
}

/** the coloured amount measured with whole A as the unit, reduced */
export function amountInA(c: Conditions, side: Side): [number, number] {
  const [num, den] = colouredShare(c, side);
  return reduce(num * wholeSize(c, side), den * wholeSize(c, 'a'));
}

const cmp = (a: number, b: number): Out => (a > b ? 'a_more' : a < b ? 'b_more' : 'equal');

function realOutcome(c: Conditions): Out {
  const [an, ad] = amountInA(c, 'a');
  const [bn, bd] = amountInA(c, 'b');
  return cmp(an * bd, bn * ad);
}

function kidOutcome(m: ChildModel, c: Conditions): Out {
  const wrong = m.sources.filter((s) => s !== 'equal_parts');
  if (!wrong.length) return realOutcome(c);
  const [na, da] = FRACTIONS[c.a];
  const [nb, db] = FRACTIONS[c.b];
  // "bigger bottom number, bigger fraction"; with the same bottom number the tops decide
  if (wrong.includes('bigger_denominator')) return da !== db ? cmp(da, db) : cmp(na, nb);
  // the two numbers are separate whole numbers
  if (wrong.includes('separate_numbers')) return m.path === 'add_numbers' ? cmp(na + da, nb + db) : cmp(na, nb);
  // these learners compare the fractions correctly but miss the whole's size and/or the uneven pieces
  const seesWhole = !wrong.includes('ignore_whole');
  const seesCut = !wrong.includes('unequal_ok');
  const view = (side: Side, n: number, d: number): [number, number] => {
    const [sn, sd] = seesCut ? colouredShare(c, side) : [n, d];
    return [sn * (seesWhole ? wholeSize(c, side) : 1), sd];
  };
  const [an, ad] = view('a', na, da);
  const [bn, bd] = view('b', nb, db);
  return cmp(an * bd, bn * ad);
}

/* ───────────── exact reading shown with the result ───────────── */

const arDigits = (s: string) => s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** "1/4", "1", or "1 + 1/4" for amounts above one whole */
function fractionText([num, den]: readonly [number, number], and: string): string {
  if (den === 1) return String(num);
  if (num < den) return `${num}/${den}`;
  return `${Math.floor(num / den)}${and}${num % den}/${den}`;
}

function measure(c: Conditions): L {
  const part = (side: Side): L => {
    const [n, d] = FRACTIONS[c[side]];
    const share = colouredShare(c, side);
    const nameAr = side === 'a' ? '(أ)' : '(ب)';
    const nameEn = side === 'a' ? 'A' : 'B';
    const ar = arDigits(fractionText(share, ' و'));
    const en = fractionText(share, ' and ');
    if (isUneven(c, side)) {
      return {
        ar: `${nameAr}: ملوّن ${arDigits(String(n))} من ${arDigits(String(d))} قطع، بس القطع مش قد بعض. قدّ الملوّن الحقيقي ${ar} من كلّه.`,
        en: `${nameEn}: ${n} of ${d} pieces coloured, but the pieces are not the same size. The coloured part is really ${en} of its whole.`,
      };
    }
    const same = share[0] === n && share[1] === d;
    return {
      ar: `${nameAr}: الملوّن ${same ? '' : `${arDigits(`${n}/${d}`)} = `}${ar} من كلّه.`,
      en: `${nameEn}: ${same ? '' : `${n}/${d} = `}${en} of its whole is coloured.`,
    };
  };
  const a = part('a');
  const b = part('b');
  if (c.wholes === 'same') return { ar: `${a.ar} ${b.ar} والكلّين قد بعض.`, en: `${a.en} ${b.en} Both wholes are the same size.` };
  const inA = amountInA(c, 'b');
  const bigger = c.wholes === 'b_bigger';
  return {
    ar: `${a.ar} ${b.ar} كل (ب) ${bigger ? 'قد كل (أ) مرّتين' : 'نص كل (أ)'}، فبقياس كل (أ) الملوّن بـ(ب) = ${arDigits(fractionText(inA, ' و'))}.`,
    en: `${a.en} ${b.en} Whole B is ${bigger ? 'twice' : 'half'} the size of whole A, so measured with whole A, B’s coloured part is ${fractionText(inA, ' and ')}.`,
  };
}

/* ───────────── offline language patterns (written against normaliseText output) ───────────── */

const any = (...parts: string[]) => new RegExp(parts.join('|'));

const START = '(?<![ء-ي])';
const END = '(?![ء-ي])';
/** one word that is not a negator, followed by a space */
const W = '(?:(?!(?:ما|مش|مو|لا|مب|not|no|never|dont|don\'t|doesn\'t|isn\'t) )[^ .!?؟]+ )';
const QUARTER = `(?:${START}[وف]?(?:بال|ال|لل)?ربع${END}|1 ?/ ?4|١ ?/ ?٤)`;
const EIGHTH = `(?:${START}[وف]?(?:بال|ال|لل)?(?:تمن|ثمن)${END}|1 ?/ ?8|١ ?/ ?٨)`;
const IS_AR = '(?: (?:هو|هي|دايما|اكيد|بيكون|بتكون|طبعا|يعني|رح يكون))*';
const IS_EN = '(?: (?:piece|slice|part|share))?(?: is| will be| would be|\'s)(?: always| definitely| really)?';
const BIG_AR = '(?:اكبر|اكتر|اكثر|ازيد)';
const SMALL_AR = '(?:اصغر|ازغر|اقل)';
const BIG_EN = '(?:bigger|larger|more|greater)';
const SMALL_EN = '(?:smaller|less)';
const NOT_COUNT = '(?! (?:قطع|اجزاء|حصص|عدد|pieces|parts|slices))';
/** «ربع البيتزا», «تمن الرغيف»: the thing the part was taken from */
const OF_AR = '(?: (?:ال)?(?:بيتزا|بيتزه|رغيف|لوح|قالب|كيكه|كعكه|شكل|حبه))?';

const quarterBigger = `${QUARTER}${OF_AR}${IS_AR} ${BIG_AR}${NOT_COUNT}|(?:quarter|fourth|1/4)${IS_EN} ${BIG_EN}${NOT_COUNT}`;
const quarterSmaller = `${QUARTER}${OF_AR}${IS_AR} ${SMALL_AR}${NOT_COUNT}|(?:quarter|fourth|1/4)${IS_EN} ${SMALL_EN}${NOT_COUNT}`;
const eighthBigger = `${EIGHTH}${OF_AR}${IS_AR} ${BIG_AR}${NOT_COUNT}|(?:eighth|1/8)${IS_EN} ${BIG_EN}${NOT_COUNT}`;
const eighthSmaller = `${EIGHTH}${OF_AR}${IS_AR} ${SMALL_AR}${NOT_COUNT}|(?:eighth|1/8)${IS_EN} ${SMALL_EN}${NOT_COUNT}`;
const partShrinks = [
  '(?:القطع|القطعه|الحصه|حصتك|حصه كل واحد|كل قطعه|كل جزء|كل حصه)(?: (?:بتصير|بتكون|بيصير|رح تكون|رح تصير|هي))* (?:اصغر|ازغر|بتصغر|صغرت)',
  'smaller (?:pieces|slices|parts|shares)',
  '(?:pieces|slices|parts|shares|each (?:piece|part|slice|share)) (?:get|gets|are|is|become|becomes|will be) (?:even )?smaller',
];
const morePartsSmaller = [
  `(?:كل ما|كلما|لما) ${W}{0,4}?(?:اكثر|اكتر|زاد|زادت|يزيد|تزيد|كثر|كثرت|كترت) ${W}{0,4}?(?:ال)?(?:اصغر|ازغر|بتصغر|بيصغر|تصغر|يصغر|صغرت|صغر)`,
  `(?:قطع|القطع|اجزاء|الاجزاء|حصص|ناس|اشخاص|اولاد) (?:اكثر|اكتر) ${W}{0,4}?(?:اصغر|ازغر|بتصغر|صغرت)`,
  `(?:اصغر|ازغر) (?:لانه|لانها|لان|عشان) ${W}{0,4}?(?:اكثر|اكتر)`,
  `(?:اكبر) (?:لانه|لانها|لان|عشان) ${W}{0,4}?(?:اقل)`,
  `(?:قطع|اجزاء|ناس) اقل ${W}{0,4}?(?:اكبر)`,
  `more (?:equal )?(?:pieces|parts|slices|people|shares|cuts) ${W}{0,6}?smaller`,
  'smaller because (?:[a-z]+ ){0,6}?more',
  `fewer (?:equal )?(?:pieces|parts|slices|people|shares) ${W}{0,6}?bigger`,
  'bigger because (?:[a-z]+ ){0,6}?fewer',
];
/** the learner says the reference comparison, so denominator or top-number words are part of a sound reason */
const SOUND_CLAIM = any(
  quarterBigger, eighthSmaller, ...partShrinks,
  '(?:فالكسر|فالقطعه|الكسر|القطعه|بيصير|بتصير) (?:اصغر|ازغر|اقل)', 'so (?:it(?:\'s| is) )?smaller',
);

const stepEqualParts = any(
  `${START}[وفلب]?(?:ال)?(?:قطع|اجزاء|حصص|اقسام)(?: (?:كلها|كلهم|لازم|تكون|يكونوا|يكونو|بتكون|هي|هن|هنه|كانت|بتطلع|تطلع))* (?:قد بعض|متساويه|متساويين|متساويات|بنفس الحجم|نفس الحجم|بنفس القد|نفس القد|زي بعض)`,
  `(?:قسمنا|بنقسم|نقسم|منقسم|مقسوم|مقسومه|انقسم|قسمه|تقسيم|قصينا|منقص|مقصوص|قسم)(?:ه|ها)? ${W}{0,4}?(?:بالتساوي|بالعدل|متساويه|متساويين|قد بعض)`,
  '(?<![a-z])(?<!(?:not|to) be )equal(?:[- ]sized)? (?:parts|pieces|shares|slices)',
  '(?:parts|pieces|shares|slices)(?: (?:are|must be|should be|need to be|have to be|are all|all))? (?:equal(?![a-z])|the same size)',
  `(?:split|cut|cuts|divide|divided|share|shared) ${W}{0,4}?(?:equally|into equal|fairly)`,
);
const stepMoreSmaller = any(...morePartsSmaller);
const stepSameWhole = any(
  '(?:نفس|بنفس) (?:ال)?(?:حجم|قد|قياس|كبر) (?:ال)?(?:كل|بيتزا|بيتزه|رغيف|لوح|قالب|كيكه|كعكه|شكل|حبه)',
  '(?:البيتزتين|الرغيفين|اللوحين|القالبين|الكيكتين|الكلين|الشكلين|الورقتين|الحبتين)(?: (?:لازم|يكونوا|يكونو|تكون|تكونوا|هنه|هني))* (?:قد بعض|متساويين|متساويتين|متساويات|نفس الحجم|بنفس الحجم|نفس القد|بنفس القد)',
  '(?:ال)?(?:كل|بيتزا|رغيف|لوح)(?: (?:لازم|يكون|تكون))+ (?:نفس الحجم|بنفس الحجم|نفس القد|قد بعض)',
  'حسب (?:حجم|قد|كبر) (?:ال)?(?:كل|بيتزا|رغيف|لوح|قالب|كيكه)',
  'same[- ]sized? (?:wholes?|pizzas?|bars?|cakes?|loaf|loaves|shapes?)',
  '(?:wholes?|pizzas?|bars?|cakes?|loaves)(?: (?:are|must be|should be|need to be|have to be))(?: both)? (?:the )?same size',
  'depends on (?:the )?size of (?:the )?(?:whole|pizza|bar|cake|loaf)',
  '(?:of|from) the same (?:whole|size (?:pizza|bar|cake|loaf))',
);

export const fractions: ConceptPack = {
  id: 'fractions',
  subject: 'math',
  title: { ar: 'ربع ولا تُمن؟', en: 'Quarter or eighth?' },
  question: {
    ar: 'عنا بيتزتين قد بعض. شو أكبر: ربع بيتزا ولا تُمن بيتزا؟ وليش؟',
    en: 'Two pizzas of one size. Which is more: one quarter of one, or one eighth of the other? Why?',
  },
  grades: [3, 5],
  curriculum: {
    verified: false,
    note: {
      ar: 'لسا ما راجعنا هالدرس مع كتاب الرياضيات الفلسطيني المطبوع.',
      en: 'Not yet checked against the printed Palestinian mathematics textbook.',
    },
  },
  objectives: [
    { id: 'o_meaning', text: { ar: 'أشرح الكسر: أجزاء قد بعض من كل واحد.', en: 'Explain a fraction as equal parts of one whole.' }, nodes: ['C1', 'C2', 'C3'] },
    { id: 'o_compare', text: { ar: 'أقارن كسرين بالرسم وأحكي ليش.', en: 'Compare two fractions with a drawing and say why.' }, nodes: ['C4'] },
    { id: 'o_whole', text: { ar: 'أنتبه لحجم الكل قبل ما أقارن.', en: 'Check the size of the whole before comparing.' }, nodes: ['C5'] },
  ],
  concepts: {
    C1: { label: { ar: 'الكل بينقسم لأجزاء', en: 'A whole splits into parts' }, ai: 'one whole can be split into parts', needs: [] },
    C2: { label: { ar: 'أجزاء متساوية', en: 'Equal parts' }, ai: 'a fraction needs the parts of the whole to be equal in size', needs: ['C1'] },
    C3: { label: { ar: 'معنى البسط والمقام', en: 'What the two numbers mean' }, ai: 'the denominator counts equal parts in the whole, the numerator counts the parts taken', needs: ['C2'] },
    C4: { label: { ar: 'أجزاء أكثر، جزء أصغر', en: 'More parts, smaller part' }, ai: 'the more equal parts a whole is cut into, the smaller each part', needs: ['C2', 'C3'] },
    C5: { label: { ar: 'نقارن بنفس الكل', en: 'Compare with same-size wholes' }, ai: 'fractions compare amounts only when the wholes are the same size', needs: ['C3', 'C4'] },
  },
  prerequisites: [
    {
      id: 'equal_sharing',
      label: { ar: 'القسمة العادلة', en: 'Fair sharing' },
      why: { ar: 'الكسر بيبدأ من قسمة عادلة للكل.', en: 'Fractions start from sharing a whole fairly.' },
      supports: ['C1', 'C2'],
      suspect: { ideas: ['unequal_ok'], missingSteps: [0] },
      verify: [
        {
          id: 'es_v1', node: 'C2',
          q: { ar: 'بدنا نقسم رغيف على ولدين بالعدل. أي قسمة بتزبط؟', en: 'We share a loaf fairly between two children. Which cut works?' },
          options: [
            { ar: 'قطعة كبيرة وقطعة صغيرة', en: 'One big piece and one small piece' },
            { ar: 'قطعتين قد بعض', en: 'Two pieces of the same size' },
            { ar: 'تلات قطع', en: 'Three pieces' },
          ],
          correct: 1,
        },
        {
          id: 'es_v2', node: 'C1',
          q: { ar: 'لوح شوكولاتة فيه ٦ مربّعات قد بعض، لتلات أولاد بالعدل. كم مربّع لكل ولد؟', en: 'A bar has 6 equal squares, shared fairly by 3 children. How many squares each?' },
          options: [{ ar: '١', en: '1' }, { ar: '٢', en: '2' }, { ar: '٣', en: '3' }],
          correct: 1,
        },
      ],
      remedy: {
        title: { ar: 'نقسم بالعدل', en: 'Share it fairly' },
        minutes: 5,
        steps: [
          { ar: 'اطوي ورقة نصّين، وبعدين نصّين كمان. حط القطع فوق بعض.', en: 'Fold a sheet in half, then in half again. Lay the parts on top of each other.' },
          { ar: 'قص ورقة ثانية لأربع قطع عشوائية وقارنهم.', en: 'Cut another sheet into four random pieces and compare them.' },
          { ar: 'احكي: بأي ورقة كل واحد بياخد قد الثاني؟', en: 'Say: with which sheet does everyone get as much as the others?' },
        ],
      },
      recheck: {
        id: 'es_r', node: 'C2',
        q: { ar: 'أي رسمة بتبيّن أرباع؟', en: 'Which drawing shows quarters?' },
        options: [
          { ar: '٤ قطع، وحدة منهم كبيرة', en: '4 pieces, one of them big' },
          { ar: '٤ قطع قد بعض', en: '4 pieces of the same size' },
          { ar: '٣ قطع قد بعض', en: '3 pieces of the same size' },
        ],
        correct: 1,
      },
    },
    {
      id: 'fraction_meaning',
      label: { ar: 'معنى البسط والمقام', en: 'What the two numbers mean' },
      why: { ar: 'المقارنة بدها نفهم العددين مع بعض، مش كل واحد لحاله.', en: 'To compare, the two numbers must be read together.' },
      supports: ['C3', 'C4', 'C5'],
      suspect: { ideas: ['separate_numbers', 'bigger_denominator'], missingSteps: [0, 1] },
      verify: [
        {
          id: 'fm_v1', node: 'C3',
          q: { ar: 'بالكسر ٣/٤، شو بيحكيلنا العدد ٤؟', en: 'In 3/4, what does the 4 tell us?' },
          options: [
            { ar: 'لكم جزء قد بعض قسمنا الكل', en: 'How many equal parts the whole has' },
            { ar: 'كم قطعة أخدنا', en: 'How many pieces we took' },
            { ar: 'قدّيش الكل تقيل', en: 'How heavy the whole is' },
          ],
          correct: 0,
        },
        {
          id: 'fm_v2', node: 'C3',
          q: { ar: 'قسمنا الكل ٨ قطع قد بعض وأخدنا ٣. شو الكسر؟', en: 'A whole has 8 equal pieces and we take 3. Which fraction is it?' },
          options: [{ ar: '٨/٣', en: '8/3' }, { ar: '٣/٨', en: '3/8' }, { ar: '٣/٥', en: '3/5' }],
          correct: 1,
        },
      ],
      remedy: {
        title: { ar: 'كسر من ورق', en: 'A paper fraction' },
        minutes: 5,
        steps: [
          { ar: 'اطوي شريط ورق لأربع أجزاء قد بعض.', en: 'Fold a paper strip into four equal parts.' },
          { ar: 'لوّن ٣ أجزاء، واكتب تحتهم ٣/٤.', en: 'Colour 3 parts and write 3/4 under them.' },
          { ar: 'أشّر بإصبعك: وين الـ٤؟ ووين الـ٣؟', en: 'Point with your finger: where is the 4? Where is the 3?' },
        ],
      },
      recheck: {
        id: 'fm_r', node: 'C3',
        q: { ar: 'بالكسر ٢/٣، شو بيحكيلنا العدد ٢؟', en: 'In 2/3, what does the 2 tell us?' },
        options: [
          { ar: 'أخدنا جزئين من التلاتة', en: 'We took two of the three parts' },
          { ar: 'قسمنا الكل جزئين', en: 'The whole has two parts' },
          { ar: 'في كلّين', en: 'There are two wholes' },
        ],
        correct: 0,
      },
    },
  ],
  reference: {
    model: {
      ar: 'الكسر n/d يعني: نقسم الكل لـd أجزاء قد بعض وناخد n منها. الكمية = حجم الكل × الكسر. إذا القطع مش قد بعض، عدد القطع لحاله ما بيعطي الكسر، فبنقيس قدّ الملوّن الحقيقي.',
      en: 'n/d means: cut the whole into d equal parts and take n of them. Amount = size of the whole × the fraction. With uneven pieces the count does not give the fraction, so the real coloured size is measured.',
    },
    limits: {
      ar: 'كسور أقل من واحد بس. حجم الكل (ب): نفس (أ) أو الضعف أو النص. القص المش متساوي على (ب) بس وبنمط ثابت: القطع الملوّنة فيه رفيعة (كل وحدة تلتين القطعة العادلة). بقصّ ثاني ممكن الملوّن يطلع أكبر.',
      en: 'Proper fractions only. Whole B is the same, double or half of A. The uneven cut applies to B only, with a fixed pattern: its coloured pieces are the thin ones (each two thirds of a fair piece). With another cut the coloured part could be larger instead.',
    },
    sources: [
      { title: 'Common Core State Standards for Mathematics — Grade 3, Number and Operations: Fractions (3.NF)' },
      { title: 'Siegler et al. (2010), Developing Effective Fractions Instruction for Kindergarten Through 8th Grade (IES What Works Clearinghouse practice guide)' },
    ],
  },

  ideas: {
    equal_parts: {
      label: { ar: 'أجزاء قد بعض من نفس الكل', en: 'Equal parts of the same whole' },
      mirror: {
        ar: 'هيك إنت شايفها: بنقسم كلّين قد بعض لقطع متساوية، واللي قطعه أكثر قطعته أصغر.',
        en: 'You see it like this: cut two same-size wholes into equal parts; the one with more parts has smaller parts.',
      },
      observation: { ar: 'لما نقص لقطع أكثر، كل قطعة بتصغر.', en: 'Cutting into more pieces makes each piece smaller.' },
      assumption: { ar: 'العدد اللي تحت بيحكي لكم قطعة قد بعض انقسم الكل.', en: 'The bottom number says how many equal pieces the whole has.' },
      conclusion: { ar: 'الربع أكبر من التُّمن لما الكلّين قد بعض.', en: 'A quarter is more than an eighth when the wholes match.' },
      story: [
        { ar: 'عنا كلّين قد بعض', en: 'Two wholes of one size' },
        { ar: 'كل واحد مقسوم قطع قد بعض', en: 'Each is cut into equal pieces' },
        { ar: 'قطع أكثر يعني قطعة أصغر', en: 'More pieces means a smaller piece' },
      ],
      wrongStep: null,
      correct: true,
      breaks: null,
      model: { sources: ['equal_parts'], path: 'by_size', requires: ['equal_cut', 'same_whole'] },
      intervention: {
        ar: 'اطلب منه يقنع زميله بمثال جديد، وإسأله: وإذا الكلّين مش قد بعض؟',
        en: 'Ask the learner to convince a classmate with a new example, then ask: what if the wholes differ?',
      },
      ai: 'correct idea: with same-size wholes cut into equal parts, more parts means each part is smaller, so 1/4 is more than 1/8',
    },
    bigger_denominator: {
      label: { ar: 'العدد اللي تحت أكبر، الكسر أكبر', en: 'Bigger bottom number, bigger fraction' },
      mirror: {
        ar: 'هيك إنت شايفها: ٨ أكبر من ٤، فالتُّمن أكبر من الربع.',
        en: 'You see it like this: 8 is bigger than 4, so one eighth is bigger than one quarter.',
      },
      observation: { ar: '٨ أكبر من ٤.', en: '8 is bigger than 4.' },
      assumption: { ar: 'العدد الأكبر بالكسر معناه إشي أكبر.', en: 'A bigger number in a fraction means a bigger amount.' },
      conclusion: { ar: 'التُّمن أكبر.', en: 'The eighth is bigger.' },
      story: [
        { ar: 'بطلّع على العدد اللي تحت', en: 'I look at the bottom number' },
        { ar: '٨ أكبر من ٤', en: '8 is bigger than 4' },
        { ar: 'إذن التُّمن أكبر', en: 'So the eighth is bigger' },
      ],
      wrongStep: 2,
      breaks: 'C4',
      model: { sources: ['bigger_denominator'], path: 'by_denominator', requires: [] },
      intervention: {
        ar: 'خلّيه يطوي ورقتين قد بعض: ٤ أجزاء و٨ أجزاء، ويحط قطعة فوق قطعة قبل ما يحكي أي رقم.',
        en: 'Have the learner fold two matching sheets into 4 and 8 parts and lay one piece on the other before using any numbers.',
      },
      ai: 'thinks a bigger denominator makes a bigger fraction, e.g. 1/8 is bigger than 1/4 because 8 is bigger than 4',
    },
    ignore_whole: {
      label: { ar: 'بس الكسر بيهم', en: 'Only the fraction matters' },
      mirror: {
        ar: 'هيك إنت شايفها: ربع هو ربع وين ما كان، وحجم البيتزا ما بيغيّر إشي.',
        en: 'You see it like this: a quarter is a quarter anywhere, and the size of the pizza changes nothing.',
      },
      observation: { ar: 'نفس الكسر مكتوب بنفس الأرقام.', en: 'The same fraction is written with the same numbers.' },
      assumption: { ar: 'الكسر لحاله بيحكي قدّيش الكمية.', en: 'The fraction alone tells the amount.' },
      conclusion: { ar: 'بنقدر نقارن بدون ما نشوف الكل.', en: 'We can compare without looking at the wholes.' },
      story: [
        { ar: 'بقرا الكسرين', en: 'I read both fractions' },
        { ar: 'ما بطلّع على حجم الكل', en: 'I do not look at the size of the wholes' },
        { ar: 'بقرّر من الأرقام بس', en: 'I decide from the numbers alone' },
      ],
      wrongStep: 1,
      breaks: 'C5',
      model: { sources: ['ignore_whole'], path: 'by_name', requires: ['equal_cut'] },
      intervention: {
        ar: 'حط قدّامه ربع رغيف كبير وربع رغيف صغير، وإسأله: أيهم بتختار إذا جوعان؟',
        en: 'Put a quarter of a big loaf next to a quarter of a small one and ask which the learner would pick when hungry.',
      },
      ai: 'thinks fractions can be compared without looking at the size of the wholes, e.g. a quarter is always the same amount',
    },
    separate_numbers: {
      label: { ar: 'عددين كل واحد لحاله', en: 'Two separate numbers' },
      mirror: {
        ar: 'هيك إنت شايفها: بتقارن الأعداد اللي فوق لحالها (أو بتجمع الأعداد) وبتقرّر مين أكبر.',
        en: 'You see it like this: you compare the top numbers on their own (or add the numbers) and decide which is bigger.',
      },
      observation: { ar: 'بالكسر في عددين.', en: 'A fraction has two numbers.' },
      assumption: { ar: 'كل عدد بينقرأ لحاله مثل أعداد العدّ.', en: 'Each number can be read alone, like a counting number.' },
      conclusion: { ar: 'إذا العددين اللي فوق نفس الإشي، فالكسرين قد بعض.', en: 'If the top numbers match, the fractions match.' },
      story: [
        { ar: 'بشوف أعداد منفصلة', en: 'I see separate numbers' },
        { ar: 'بقارن اللي فوق لحالهم', en: 'I compare the top numbers alone' },
        { ar: 'فوقهم ١ و١، فهم قد بعض', en: 'Both tops are 1, so they match' },
      ],
      wrongStep: 1,
      breaks: 'C3',
      model: { sources: ['separate_numbers'], path: 'compare_tops', requires: [] },
      intervention: {
        ar: 'خلّيه يلوّن الكسرين على شرايط قد بعض، ويحكي شو معنى كل عدد وهو بيأشّر على الرسمة.',
        en: 'Have the learner colour both fractions on matching strips and point to what each number means.',
      },
      ai: 'treats numerator and denominator as independent whole numbers, e.g. compares only the numerators or adds the numbers',
    },
    unequal_ok: {
      label: { ar: 'أي قطعة بتنحسب', en: 'Any piece counts' },
      mirror: {
        ar: 'هيك إنت شايفها: إذا في ٤ قطع، أي وحدة منهم اسمها ربع، حتى لو وحدة كبيرة ووحدة صغيرة.',
        en: 'You see it like this: with 4 pieces, any one of them is a quarter, even if one is big and one is small.',
      },
      observation: { ar: 'انقص الكل لأربع قطع.', en: 'The whole was cut into four pieces.' },
      assumption: { ar: 'المهم عدد القطع بس.', en: 'Only the number of pieces matters.' },
      conclusion: { ar: 'كل «١ من ٤» نفس الكمية.', en: 'Every “1 of 4” is the same amount.' },
      story: [
        { ar: 'بعدّ القطع', en: 'I count the pieces' },
        { ar: 'ما بطلّع على قدّ كل قطعة', en: 'I do not look at each piece’s size' },
        { ar: 'قطعة من ٤ اسمها ربع', en: 'One piece of 4 is a quarter' },
      ],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['unequal_ok'], path: 'by_count', requires: ['same_whole'] },
      intervention: {
        ar: 'قص ورقة لأربع قطع واضح إنها مش قد بعض، واعرض عليه أصغر وحدة: «هاي حصتك، ربع». شو رأيه؟',
        en: 'Cut a sheet into four clearly uneven pieces, offer the smallest as “your quarter”, and ask what the learner thinks.',
      },
      ai: 'thinks unequal pieces still count as equal fractions: any 1 of 4 pieces is a quarter',
    },
  },
  paths: {
    by_size: { label: { ar: 'بقارن قدّ الملوّن', en: 'Compare coloured sizes' }, ai: 'compares the real sizes of the coloured parts' },
    by_denominator: { label: { ar: 'بقارن العدد اللي تحت', en: 'Compare bottom numbers' }, ai: 'compares the denominators' },
    compare_tops: { label: { ar: 'بقارن العدد اللي فوق', en: 'Compare top numbers' }, ai: 'compares only the numerators' },
    add_numbers: { label: { ar: 'بجمع الأعداد', en: 'Add the numbers' }, ai: 'adds numerator and denominator and compares the sums' },
    by_name: { label: { ar: 'بقارن اسم الكسر بس', en: 'Compare fraction names' }, ai: 'compares the fraction names and ignores the size of the wholes' },
    by_count: { label: { ar: 'بعدّ القطع', en: 'Count the pieces' }, ai: 'counts pieces and ignores their sizes' },
  },
  requires: {
    same_whole: { label: { ar: 'بدها ننتبه لحجم الكل', en: 'Checks the size of the whole' }, ai: 'says the size of the whole matters' },
    equal_cut: { label: { ar: 'بدها قطع قد بعض', en: 'Needs equal pieces' }, ai: 'says the pieces must be equal in size' },
  },
  correctModel: { sources: ['equal_parts'], path: 'by_size', requires: ['equal_cut', 'same_whole'] },
  steps: [
    {
      node: 'C2',
      text: { ar: 'الكل مقسوم لأجزاء متساوية.', en: 'The whole is divided into equal parts.' },
      test: stepEqualParts,
      noorSays: { ar: 'الكل لازم يكون مقسوم قطع قد بعض.', en: 'The whole must be cut into equal pieces.' },
      noorAsks: { ar: 'لما نقسم الكل، كيف لازم تكون القطع؟', en: 'When we cut the whole, what should the pieces be like?' },
    },
    {
      node: 'C4',
      text: { ar: 'كل ما زاد عدد الأجزاء المتساوية، صغر كل جزء.', en: 'The more equal parts, the smaller each part.' },
      test: stepMoreSmaller,
      noorSays: { ar: 'كل ما زادت القطع، صغرت كل قطعة.', en: 'More pieces make each piece smaller.' },
      noorAsks: { ar: 'وإذا زدنا عدد القطع، شو بصير بكل قطعة؟', en: 'If we make more pieces, what happens to each piece?' },
    },
    {
      node: 'C5',
      text: { ar: 'بنقارن بكلّين من نفس الحجم.', en: 'Compare using wholes of the same size.' },
      test: stepSameWhole,
      noorSays: { ar: 'ولازم نقارن بكلّين قد بعض.', en: 'And we compare with wholes of the same size.' },
      noorAsks: { ar: 'شو لازم نتأكّد منه بالبيتزتين قبل ما نقارن؟', en: 'What should we check about the two pizzas before comparing?' },
    },
  ],

  variables: [
    {
      id: 'a', label: { ar: 'كسر (أ)', en: 'Fraction A' },
      options: [
        { id: '1_2', label: { ar: 'نص ١/٢', en: '1/2' } }, { id: '1_3', label: { ar: 'تلت ١/٣', en: '1/3' } },
        { id: '1_4', label: { ar: 'ربع ١/٤', en: '1/4' } }, { id: '1_8', label: { ar: 'تُمن ١/٨', en: '1/8' } },
        { id: '2_4', label: { ar: 'ربعين ٢/٤', en: '2/4' } }, { id: '3_4', label: { ar: 'تلات أرباع ٣/٤', en: '3/4' } },
        { id: '2_8', label: { ar: 'تُمنين ٢/٨', en: '2/8' } }, { id: '3_8', label: { ar: 'تلات أتمان ٣/٨', en: '3/8' } },
        { id: '4_8', label: { ar: 'أربع أتمان ٤/٨', en: '4/8' } }, { id: '5_8', label: { ar: 'خمس أتمان ٥/٨', en: '5/8' } },
      ],
    },
    {
      id: 'b', label: { ar: 'كسر (ب)', en: 'Fraction B' },
      options: [
        { id: '1_2', label: { ar: 'نص ١/٢', en: '1/2' } }, { id: '1_3', label: { ar: 'تلت ١/٣', en: '1/3' } },
        { id: '1_4', label: { ar: 'ربع ١/٤', en: '1/4' } }, { id: '1_8', label: { ar: 'تُمن ١/٨', en: '1/8' } },
        { id: '2_4', label: { ar: 'ربعين ٢/٤', en: '2/4' } }, { id: '3_4', label: { ar: 'تلات أرباع ٣/٤', en: '3/4' } },
        { id: '2_8', label: { ar: 'تُمنين ٢/٨', en: '2/8' } }, { id: '3_8', label: { ar: 'تلات أتمان ٣/٨', en: '3/8' } },
        { id: '4_8', label: { ar: 'أربع أتمان ٤/٨', en: '4/8' } }, { id: '5_8', label: { ar: 'خمس أتمان ٥/٨', en: '5/8' } },
      ],
    },
    {
      id: 'wholes', label: { ar: 'حجم الكلّين', en: 'Size of the wholes' },
      options: [
        { id: 'same', label: { ar: 'قد بعض', en: 'Same size' } },
        { id: 'b_bigger', label: { ar: 'كل (ب) قد (أ) مرّتين', en: 'Whole B is twice as big' } },
        { id: 'b_smaller', label: { ar: 'كل (ب) نص (أ)', en: 'Whole B is half as big' } },
      ],
    },
    {
      id: 'cutting', label: { ar: 'القصّ', en: 'Cutting' },
      options: [
        { id: 'equal', label: { ar: 'الاثنين قطع قد بعض', en: 'Both in equal pieces' } },
        { id: 'unequal', label: { ar: 'قطع (ب) مش قد بعض', en: 'B in uneven pieces' } },
      ],
    },
    {
      id: 'model', label: { ar: 'الرسمة', en: 'Drawing' },
      options: [
        { id: 'pizza', label: { ar: 'بيتزا', en: 'Pizza' } },
        { id: 'bar', label: { ar: 'لوح شوكولاتة', en: 'Chocolate bar' } },
        { id: 'line', label: { ar: 'خط أعداد', en: 'Number line' } },
      ],
    },
  ],
  baseline: { a: '1_4', b: '1_8', wholes: 'same', cutting: 'equal', model: 'pizza' },
  experiments: [
    {
      id: 'quarter_eighth',
      name: { ar: 'ربع ولا تُمن؟', en: 'A quarter or an eighth?' },
      short: { ar: 'ربع وتُمن', en: '1/4 and 1/8' },
      change: {},
      question: {
        ar: 'بيتزتين قد بعض. بنلوّن ربع من (أ) وتُمن من (ب). وين الملوّن أكثر؟',
        en: 'Two pizzas of one size. We colour a quarter of A and an eighth of B. Where is more coloured?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 7,
      materials: ['paper', 'scissors'],
      safety: { adult: false, note: { ar: 'استعملوا مقص آمن، وقصّوا بعيد عن الأصابع.', en: 'Use safety scissors and keep fingers clear.' } },
      minGrade: 3,
      targets: ['C2', 'C4'],
      home: {
        steps: [
          { ar: 'جيبوا ورقتين قد بعض.', en: 'Take two sheets of the same size.' },
          { ar: 'اطووا الأولى مرّتين لتصير ٤ أجزاء قد بعض.', en: 'Fold the first twice to make 4 equal parts.' },
          { ar: 'اطووا الثانية تلات مرّات لتصير ٨ أجزاء قد بعض.', en: 'Fold the second three times to make 8 equal parts.' },
          { ar: 'قصّوا قطعة من كل ورقة وحطّوهم فوق بعض.', en: 'Cut one part from each and lay them on top of each other.' },
        ],
        record: { ar: 'ارسموا القطعتين جنب بعض.', en: 'Draw the two pieces side by side.' },
        reflect: [
          { ar: 'أي قطعة غطّت الثانية؟', en: 'Which piece covered the other?' },
          { ar: 'كم قطعة طلعت من كل ورقة؟', en: 'How many pieces did each sheet make?' },
        ],
      },
    },
    {
      id: 'half_four_eighths',
      name: { ar: 'نص ولا أربع أتمان؟', en: 'A half or four eighths?' },
      short: { ar: 'نص و٤/٨', en: '1/2 and 4/8' },
      change: { a: '1_2', b: '4_8', model: 'bar' },
      question: {
        ar: 'لوحين شوكولاتة قد بعض. بدنا نص من (أ) وأربع أتمان من (ب). وين الشوكولاتة أكثر؟',
        en: 'Two bars of one size. We take one half of A and four eighths of B. Where is more chocolate?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 7,
      materials: ['paper', 'ruler', 'scissors'],
      safety: { adult: false, note: { ar: 'استعملوا مقص آمن.', en: 'Use safety scissors.' } },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          { ar: 'قصّوا شريطين ورق بنفس الطول.', en: 'Cut two paper strips of the same length.' },
          { ar: 'اطووا الأول نصّين، والثاني لتمن أجزاء قد بعض.', en: 'Fold the first in two and the second into eight equal parts.' },
          { ar: 'لوّنوا جزء من الأول وأربع أجزاء من الثاني.', en: 'Colour one part of the first and four parts of the second.' },
        ],
        record: { ar: 'ألصقوا الشريطين تحت بعض بالدفتر.', en: 'Glue the strips one under the other in your notebook.' },
        reflect: [
          { ar: 'وين بينتهي اللون بكل شريط؟', en: 'Where does the colour end on each strip?' },
          { ar: 'ليش الأرقام غير بس الرسمة هيك؟', en: 'The numbers differ: what does the picture show, and why?' },
        ],
      },
    },
    {
      id: 'same_top',
      name: { ar: 'تلات قطع وتلات قطع', en: 'Three pieces and three pieces' },
      short: { ar: '٣/٤ و٣/٨', en: '3/4 and 3/8' },
      change: { a: '3_4', b: '3_8' },
      question: {
        ar: 'من (أ) بناخد تلات أرباع، ومن (ب) تلات أتمان. وين الأكل أكثر؟',
        en: 'We take three quarters of A and three eighths of B. Where is more food?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 7,
      materials: ['paper', 'scissors'],
      safety: { adult: false, note: { ar: 'استعملوا مقص آمن.', en: 'Use safety scissors.' } },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          { ar: 'ارسموا دايرتين قد بعض وقصّوهم.', en: 'Draw and cut two circles of the same size.' },
          { ar: 'اطووا وحدة لأربع أجزاء والثانية لتمن.', en: 'Fold one into four parts and the other into eight.' },
          { ar: 'لوّنوا تلات أجزاء من كل دايرة وقارنوا.', en: 'Colour three parts of each and compare.' },
        ],
        record: { ar: 'صوّروا أو ارسموا الدايرتين.', en: 'Draw both circles.' },
        reflect: [
          { ar: 'عدد القطع الملوّنة نفسه. شو اللي غير؟', en: 'The number of coloured pieces matches. What does not?' },
        ],
      },
    },
    {
      id: 'three_quarters_five_eighths',
      name: { ar: 'تلات أرباع ولا خمس أتمان؟', en: 'Three quarters or five eighths?' },
      short: { ar: '٣/٤ و٥/٨', en: '3/4 and 5/8' },
      change: { a: '3_4', b: '5_8', model: 'bar' },
      question: {
        ar: 'لوحين قد بعض: تلات أرباع (أ) ولا خمس أتمان (ب)؟ وين أكثر؟',
        en: 'Two bars of one size: three quarters of A or five eighths of B. Which is more?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 8,
      materials: ['grid_paper', 'ruler', 'paper'],
      safety: { adult: false, note: { ar: 'ما في خطر، بس انتبهوا للمقص إذا استعملتوه.', en: 'No hazard; take care if you use scissors.' } },
      minGrade: 4,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          { ar: 'على ورق مربّعات ارسموا مستطيلين طول كل واحد ٨ مربّعات.', en: 'On grid paper draw two bars, each 8 squares long.' },
          { ar: 'قسموا الأول أرباع (كل ربع مربّعين) ولوّنوا تلاتة.', en: 'Mark quarters on the first (2 squares each) and colour three.' },
          { ar: 'بالثاني لوّنوا خمس مربّعات، كل مربّع تُمن.', en: 'On the second colour five squares, each one an eighth.' },
        ],
        record: { ar: 'اكتبوا كم مربّع ملوّن بكل مستطيل.', en: 'Write how many squares are coloured in each bar.' },
        reflect: [
          { ar: 'أي مستطيل لونه وصل أبعد؟', en: 'Which bar’s colour reaches farther?' },
          { ar: 'هل العدد الأكبر بالكسر كان هو الأكثر؟', en: 'Did the bigger numbers give the bigger amount?' },
        ],
      },
    },
    {
      id: 'third_quarter_line',
      name: { ar: 'تلت وربع على خط الأعداد', en: 'A third and a quarter on a number line' },
      short: { ar: '١/٣ و١/٤', en: '1/3 and 1/4' },
      change: { a: '1_3', b: '1_4', model: 'line' },
      question: {
        ar: 'خطّين بنفس الطول من ٠ لـ١. نقطة التلت ونقطة الربع: أي مسافة من الصفر أطول؟',
        en: 'Two lines of one length from 0 to 1. Which distance from 0 is longer: to one third or to one quarter?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 8,
      materials: ['string', 'ruler', 'paper'],
      safety: { adult: false, note: { ar: 'الخيط ما بينلف حوالين الرقبة أو الأصابع.', en: 'Never wrap the string around a neck or fingers.' } },
      minGrade: 3,
      targets: ['C4'],
      home: {
        steps: [
          { ar: 'قصّوا خيطين طول كل واحد ١٢ سم.', en: 'Cut two pieces of string, each 12 cm long.' },
          { ar: 'علّموا الأول لتلات أجزاء (كل ٤ سم) والثاني لأربع (كل ٣ سم).', en: 'Mark thirds on one (every 4 cm) and quarters on the other (every 3 cm).' },
          { ar: 'حطّوهم تحت بعض وقارنوا أول جزء من كل خيط.', en: 'Line them up and compare the first part of each.' },
        ],
        record: { ar: 'ارسموا الخطّين وأشّروا على النقطتين.', en: 'Draw both lines and mark the two points.' },
        reflect: [{ ar: 'أي علامة أقرب للصفر؟ ليش؟', en: 'Which mark is closer to zero? Why?' }],
      },
    },
    {
      id: 'bigger_whole',
      name: { ar: 'ربع صغيرة وربع كبيرة', en: 'A small quarter and a big quarter' },
      short: { ar: 'كل أكبر', en: 'Bigger whole' },
      change: { a: '1_4', b: '1_4', wholes: 'b_bigger' },
      question: {
        ar: 'بيتزا (ب) قد (أ) مرّتين. بناخد ربع من كل وحدة. وين الأكل أكثر؟',
        en: 'Pizza B is twice the size of A. We take a quarter of each. Where is more food?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 6,
      materials: ['paper', 'scissors'],
      safety: { adult: false, note: { ar: 'استعملوا مقص آمن.', en: 'Use safety scissors.' } },
      minGrade: 3,
      targets: ['C5'],
      home: {
        steps: [
          { ar: 'قصّوا ورقة كبيرة، وورقة ثانية نصّها.', en: 'Take a large sheet and another half its size.' },
          { ar: 'اطووا كل وحدة لأربع أجزاء قد بعض.', en: 'Fold each into four equal parts.' },
          { ar: 'قصّوا ربع من كل وحدة وقارنوا.', en: 'Cut a quarter from each and compare.' },
        ],
        record: { ar: 'ألصقوا الربعين جنب بعض.', en: 'Glue the two quarters side by side.' },
        reflect: [{ ar: 'الاثنين اسمهم ربع. هل بيغطّوا نفس المساحة؟ ليش؟', en: 'Both are called a quarter. Do they cover the same space? Why?' }],
      },
    },
    {
      id: 'small_quarter_big_eighth',
      name: { ar: 'ربع من صغيرة وتُمن من كبيرة', en: 'A quarter of a small one, an eighth of a big one' },
      short: { ar: 'ربع وتُمن كبير', en: 'Small 1/4, big 1/8' },
      change: { wholes: 'b_bigger', model: 'bar' },
      question: {
        ar: 'لوح (ب) قد لوح (أ) مرّتين. ربع من (أ) وتُمن من (ب): وين أكثر؟',
        en: 'Bar B is twice as long as bar A. A quarter of A and an eighth of B: which is more?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 8,
      materials: ['grid_paper', 'ruler', 'scissors'],
      safety: { adult: false, note: { ar: 'استعملوا مقص آمن.', en: 'Use safety scissors.' } },
      minGrade: 4,
      targets: ['C5', 'C4'],
      home: {
        steps: [
          { ar: 'قصّوا شريط طوله ٨ مربّعات، وشريط طوله ١٦ مربّع.', en: 'Cut a strip 8 squares long and one 16 squares long.' },
          { ar: 'قصّوا ربع القصير وتُمن الطويل.', en: 'Cut a quarter of the short one and an eighth of the long one.' },
          { ar: 'حطّوا القطعتين فوق بعض.', en: 'Lay the two pieces on top of each other.' },
        ],
        record: { ar: 'اكتبوا طول كل قطعة بالمربّعات.', en: 'Write each piece’s length in squares.' },
        reflect: [{ ar: 'شو لازم نعرف عن الكل قبل ما نقارن؟', en: 'What must we know about the wholes before comparing?' }],
      },
    },
    {
      id: 'uneven_quarter',
      name: { ar: 'قصّ مش عادل', en: 'An uneven cut' },
      short: { ar: 'قطع غير', en: 'Uneven cut' },
      change: { a: '1_4', b: '1_4', cutting: 'unequal' },
      question: {
        ar: '(أ) و(ب) كل واحد ٤ قطع، بس قطع (ب) مش قد بعض. قطعة ملوّنة من كل واحد: وين أكثر؟',
        en: 'A and B each have 4 pieces, but B’s pieces are uneven. One piece is coloured in each: where is more?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 6,
      materials: ['paper', 'scissors'],
      safety: { adult: false, note: { ar: 'استعملوا مقص آمن.', en: 'Use safety scissors.' } },
      minGrade: 3,
      targets: ['C2'],
      home: {
        steps: [
          { ar: 'جيبوا ورقتين قد بعض.', en: 'Take two matching sheets.' },
          { ar: 'اطووا وحدة لأربع أجزاء قد بعض.', en: 'Fold one into four equal parts.' },
          { ar: 'قصّوا الثانية أربع قطع: تلاتة رفاع ووحدة عريضة.', en: 'Cut the other into four pieces: three thin and one wide.' },
          { ar: 'قارنوا قطعة من الأولى بقطعة رفيعة من الثانية.', en: 'Compare a piece of the first with a thin piece of the second.' },
          { ar: 'جرّبوا كمان القطعة العريضة.', en: 'Then try the wide piece too.' },
        ],
        record: { ar: 'ارسموا القصّتين.', en: 'Draw both ways of cutting.' },
        reflect: [
          { ar: 'هل كل «قطعة من أربعة» نفس الكمية؟', en: 'Is every “piece out of four” the same amount?' },
          { ar: 'إيمتى بنقدر نسمّي القطعة ربع؟', en: 'When may we call a piece a quarter?' },
        ],
      },
    },
  ],
  outcomes: {
    a_more: { ar: 'الملوّن بـ(أ) أكثر', en: 'A has more coloured' },
    b_more: { ar: 'الملوّن بـ(ب) أكثر', en: 'B has more coloured' },
    equal: { ar: 'الاثنين نفس الكمية', en: 'Both have the same amount' },
  },
  kidOutcome,
  realOutcome,
  measure,

  noor: {
    greeting: {
      ar: 'أهلاً! أنا نور. قدّامنا بيتزتين قد بعض: بدي ربع من وحدة وتُمن من الثانية، وأنا جوعانة! وين الأكل أكثر؟ احكيلي بكلامك وبرسم فكرتك زي ما هي.',
      en: 'Hi! I am Noor. Here are two pizzas of one size: a quarter of one, an eighth of the other, and I am hungry! Where is more food? Tell me in your words and I will draw your idea as it is.',
    },
    invite: { ar: 'فهمت فكرتك! يلا نجرّبها. قبل ما نشوف، شو بتتوقّع؟', en: 'I got your idea! Let’s try it. Before we look, what do you predict?' },
    afterContradiction: {
      ar: 'شفت؟ اللي طلع غير اللي توقّعته الفكرة. في إشي لازم نعدّله. شو لاحظت؟',
      en: 'See? The result is not what the idea expected. Something needs fixing. What did you notice?',
    },
    afterMatch: { ar: 'هالمرة فكرتك صمدت! جرّب كسور ثانية، أو احكيلي إذا بدك تغيّرها.', en: 'Your idea held up this time! Try other fractions, or tell me if you want to change it.' },
    sameResult: {
      ar: 'فكرتك والحقيقة أعطوا نفس النتيجة، فهالتجربة ما بتفرّق بينهم. غيّر إشي وجرّب.',
      en: 'Your idea and reality gave one result, so this test cannot tell them apart. Change something and try.',
    },
    praise: { ar: 'شرحك مرتّب وكامل! بتعلّمني إنت هلأ؟', en: 'Your explanation is clear and complete! Will you teach me now?' },
    partial: { ar: 'حلو، فهمت منك إشي مهم! زيدني:', en: 'Nice, I learned something important from you! Tell me more:' },
    contradiction: { ar: 'سمعت منك فكرتين ما بيزبطوا مع بعض. أي وحدة بتقصد؟', en: 'I heard two ideas that do not fit together. Which one do you mean?' },
    offtopic: { ar: 'خلّينا نرجع لسؤالنا عن الربع والتُّمن. شو رأيك؟', en: 'Let’s go back to our quarter and eighth question. What do you think?' },
    unsupported: {
      ar: 'فكرة بتستاهل نفكّر فيها! بس ما بقدر أجرّبها هون. احكيلي شو بتعرف عن القطع لما نقص الكل.',
      en: 'That is worth thinking about! I cannot test it here. Tell me what you know about the pieces when we cut a whole.',
    },
  },
  hints: [
    { ar: 'قول بصوت عالي: شو معنى «ربع»؟ وشو معنى «تُمن»؟', en: 'Say it out loud: what does “a quarter” mean? What does “an eighth” mean?' },
    {
      ar: 'ارسم رغيفين قد بعض، وقصّ كل واحد حسب العدد اللي تحت. طلّع على قطعة وحدة من كل رسمة.',
      en: 'Draw two loaves of one size and cut each one by its bottom number. Look at one piece in each drawing.',
    },
    {
      ar: 'تخيّل رغيف انقسم بالعدل على ٤ أولاد، ونفس الرغيف على ٨ أولاد. بأي مرّة حصتك بتشبّعك أكثر؟',
      en: 'A loaf is shared fairly by 4 children, then the same loaf by 8. When does your share fill you up more?',
    },
    {
      ar: 'لما نقسم كلّين قد بعض لأجزاء متساوية، كل ما زادت الأجزاء صغرت كل قطعة. فالربع (قطعة من ٤) أكبر من التُّمن (قطعة من ٨).',
      en: 'When same-size wholes are cut into equal parts, more parts means each part is smaller. So a quarter (1 of 4) is bigger than an eighth (1 of 8).',
    },
  ],
  clarify: [
    { id: 'why', q: { ar: 'احكيلي أكثر: ليش اخترت هيك؟', en: 'Tell me more: why did you choose that?' }, ai: 'ask for the reason behind the choice' },
    { id: 'bottom', q: { ar: 'العدد اللي تحت بالكسر، شو بيحكيلنا برأيك؟', en: 'What do you think the bottom number of a fraction tells us?' }, ai: 'ask what the denominator means' },
    { id: 'pieces', q: { ar: 'تخيّل إنك قصّيت الرغيفين. كيف شكل قطعة من كل واحد؟', en: 'Imagine you cut both loaves. What does one piece from each look like?' }, ai: 'ask the learner to picture one piece of each' },
    { id: 'draw', q: { ar: 'إذا بدك ترسمها لنور، شو أول إشي بترسمه؟', en: 'If you drew it for Noor, what would you draw first?' }, ai: 'ask for a drawing description' },
  ],
  answerWords: /ربع\s+(?:هو\s+)?(?:[أا]كبر|[أا]كثر|[أا]كتر)|(?:تُ?من|ثُ?من)\s+(?:هو\s+)?(?:[أا]صغر|[أا]قل)|متساوي|[أا]صغر|بتصغر|صغرت|\bsmaller\b|\bequal\s+(?:parts?|pieces?|slices?|shares?)|(?:parts?|pieces?|slices?)\s+(?:are\s+)?equal\b|same[- ]sized?\s+wholes?|(?:quarter|fourth|1\/4)\s+is\s+(?:bigger|larger|more|greater)/i,
  teach: {
    planted: { ar: 'فهمت! يعني التُّمن أكبر من الربع، لأنه ٨ أكبر من ٤. صح؟', en: 'I get it! So one eighth is bigger than one quarter, because 8 is bigger than 4. Right?' },
    truth: 'With same-size wholes, cutting into 8 equal parts gives smaller parts than cutting into 4, so 1/8 is less than 1/4.',
    accept: new RegExp(
      '^(?=.*(?:(?<![ء-ي])(?:لا|لاا|لأ|غلط|خطا|مش|مو|العكس|بالعكس|ابدا)(?![ء-ي])|\\b(?:no|nope|not|wrong|incorrect|opposite|isn\'t|isnt)\\b|'
      + `${quarterBigger}|${eighthSmaller}))`
      + '(?=.*(?:قطع|قطعه|اجزاء|جزء|حصص|حصه|حصتك|اقسام|قسم|نقص|قص|ناس|اشخاص|اولاد|pieces?|parts?|slices?|shares?|people|children|split|cut|divid))',
    ),
    reject: new RegExp(
      '^\\s*(?:اه|ايوه|ايوا|نعم|صح|صحيح|مزبوط|مظبوط|مضبوط|اكيد(?! لا| مش)|yes|yeah|yep|right|correct|true)(?![ء-يa-z])|'
      + `(?<!(?:مش|مو) (?:صح )?(?:انه |ان )?)${EIGHTH}${OF_AR}${IS_AR} ${BIG_AR}${NOT_COUNT}|`
      + `(?<!(?:not|n't) (?:true )?(?:that )?(?:one |an |the )?)(?:eighth|1/8)${IS_EN} ${BIG_EN}${NOT_COUNT}`,
    ),
    thanks: {
      ar: 'آه! يعني لما نقسم نفس الإشي لقطع أكثر، كل قطعة بتصغر. فما بكفّي أطلّع على العدد لحاله. شكراً يا أستاذ!',
      en: 'Oh! Cutting one thing into more pieces makes each piece smaller, so the number alone is not enough. Thank you, teacher!',
    },
    confused: {
      ar: 'لسا محتارة… لو قسمنا رغيف لأربعة، ونفس الرغيف لتمانية، بأي مرّة بتاخد أكل أكثر؟ وليش؟',
      en: 'I am still puzzled… Share a loaf by four, then the same loaf by eight. When do you get more food, and why?',
    },
  },
  challenge: {
    phenomenon: {
      ar: 'لوحين شوكولاتة قد بعض. عمر أخد تلت من لوحه، وسلمى أخدت سُدس من لوحها. مين معه شوكولاتة أكثر؟ وليش؟',
      en: 'Two chocolate bars of one size. Omar takes a third of his; Salma takes a sixth of hers. Who has more chocolate, and why?',
    },
    solved: {
      ar: 'عمر معه أكثر: لوحه انقسم ٣ قطع قد بعض، ولوحها ٦. قطع أكثر يعني قطعة أصغر، واللوحين قد بعض.',
      en: 'Omar has more: his bar has 3 equal pieces and hers has 6. More pieces means a smaller piece, and the bars match.',
    },
  },
  transfer: {
    prompt: {
      ar: 'ليلى وسامي بيمشوا نفس الطريق للمدرسة. ليلى قطعت خُمسين من الطريق، وسامي قطع تلتين. مين قطع مسافة أكثر؟ اشرح كيف عرفت.',
      en: 'Layla and Sami walk the same road to school. Layla has walked two fifths of it and Sami two thirds. Who has gone farther? Explain how you know.',
    },
    check: {
      id: 'tr_road', node: 'C4',
      q: { ar: 'مين قطع مسافة أكثر؟', en: 'Who has gone farther?' },
      options: [
        { ar: 'ليلى (٢/٥)', en: 'Layla (2/5)' }, { ar: 'سامي (٢/٣)', en: 'Sami (2/3)' },
        { ar: 'الاثنين نفس المسافة', en: 'Both the same distance' },
      ],
      correct: 1,
    },
  },
  rules: [
    {
      idea: 'unequal_ok',
      unless: any(
        '(?:ما|مش) (?:بتكون|بيكون|بصير|بتصير|بيطلع|بنقدر نسميها) (?:ربع|نص|تمن)', '(?<![ء-ي])(?:مش|مو) (?:ربع|نص|تمن)',
        '(?<!(?:مش|مو) )لازم (?:ال)?(?:قطع|اجزاء|حصص)(?: تكون)? (?:قد بعض|متساويه)',
        '(?:isn\'?t|is not|can\'?t be|cannot be|won\'?t be|not) (?:a |an )?(?:quarter|fourth|half|eighth)',
      ),
      re: any(
        '(?:ال)?(?:قطع|اجزاء) (?:مش|مو) مهم (?:تكون )?(?:متساويه|قد بعض)',
        '(?:عادي|مقبول) (?:لو|اذا) (?:ال)?(?:قطع|اجزاء) (?:مش|مو) (?:قد بعض|متساويه)',
        "it(?: is|'s) (?:okay|ok|fine) if (?:the )?(?:pieces|parts|slices) are (?:different(?: sizes)?|unequal)",
        '(?:حتي لو|حتي اذا|ولو) (?:كانت |كانوا )?[وف]?(?:ال)?(?:قطع|اجزاء|حصص|قطعه) (?:مش|مو) (?:قد بعض|متساويه|متساويين|نفس القد|نفس الحجم|زي بعض)',
        '(?:مش مهم|مو مهم|ما بيهم|ما بيفرق|ما بفرق) (?:اذا |لو )?(?:قد |حجم )?(?:ال)?(?:قطع|اجزاء|حصص|قطعه)',
        '(?:مش|مو) (?:لازم|ضروري|شرط) (?:تكون |يكونوا |يكونو )?(?:ال)?(?:قطع|اجزاء|حصص)(?: (?:تكون|يكونوا|يكونو|بتكون))? (?:قد بعض|متساويه|متساويين|نفس القد|نفس الحجم|زي بعض)',
        '(?:ال)?(?:قطع|اجزاء|حصص) (?:مش|مو) (?:لازم|ضروري|شرط) (?:تكون |يكونوا |يكونو )?(?:قد بعض|متساويه|متساويين|نفس القد|نفس الحجم|زي بعض)',
        '(?<![ء-ي])اي (?:قطعه|وحده)(?: منهم)?(?: من (?:4|٤|اربعه|اربع|8|٨|تمانيه|تمن)(?: قطع)?)? (?:هي |بتكون |اسمها |يعني )?(?:ال)?(?:ربع|تمن)',
        'المهم (?:انه |ان |بس )?(?:عدد (?:ال)?(?:قطع|اجزاء|حصص)|(?:نعد|بنعد) (?:ال)?(?:قطع|اجزاء))',
        '(?:pieces|parts|slices|shares) (?:don\'?t|do not|doesn\'?t) (?:have|need) to be (?:equal|the same)',
        '(?:doesn\'?t|does not) matter (?:if|whether|that) (?:the )?(?:pieces|parts|slices|shares) (?:are )?(?:not )?(?:equal|different|unequal|the same)',
        'even if (?:the )?(?:pieces|parts|slices|shares) (?:are(?: not|n\'?t)?|aren\'?t) (?:equal|unequal|different|the same)',
        'any (?:piece|slice|part) (?:out )?of (?:4|four|8|eight) is (?:a |an )?(?:quarter|fourth|eighth)',
        '(?:only|just) the number of (?:pieces|parts|slices) matters',
        '(?:unequal|uneven|different[- ]sized) (?:pieces|parts) (?:are )?(?:still|also) ',
      ),
    },
    {
      idea: 'ignore_whole',
      re: any(
        `${START}[وف]?(?:ال)?ربع (?:هو |دايما |هو نفسه |يعني )?(?:ال)?ربع${END}`,
        '(?:حجم|قد|كبر) (?:ال)?(?:كل|بيتزا|بيتزه|رغيف|لوح|قالب|كيكه|كعكه|شكل|حبه)(?: نفسه)? (?:ما (?:بيفرق|بفرق|بتفرق|بيهم|بهم|بياثر|بتاثر)|(?:مش|مو) (?:مهم|فارق|مهمه)|مابيفرق)',
        '(?:مش مهم|مو مهم|ما بيهم|ما بيفرق|ما بفرق|بغض النظر عن|مهما كان) (?:قديش |قد ايش |شو )?(?:(?:حجم|قد|كبر) (?:ال)?(?:كل|بيتزا|بيتزه|رغيف|لوح|قالب|كيكه|كعكه|شكل|حبه)|الحجم)',
        'نفس الكسر (?:يعني |معناه |ف|فا )?(?:نفس (?:الكميه|القد|الحجم|الاشي)|قد بعض|متساويين)',
        '(?:size of (?:the )?(?:whole|pizza|bar|cake|loaf|shape)|(?:the )?(?:whole|pizza) size|the size) (?:doesn\'?t|does not|never) (?:really )?matters?',
        '(?:doesn\'?t|does not) matter (?:how (?:big|large)|what size) (?:the |each )?(?:whole|pizza|bar|cake|loaf|shape)',
        'a (?:quarter|fourth|half) is (?:always )?(?:just )?(?:a )?(?:quarter|fourth|half)',
        '(?:كل|جميع) (?:ال)?ارباع (?:قد بعض|متساويه)',
        'all (?:quarters|fourths) are (?:the same|equal)',
        'same fraction (?:means|is|so|=|gives)(?: (?:the|it is the|they are the))? same (?:amount|size)',
      ),
    },
    {
      idea: 'bigger_denominator',
      unless: SOUND_CLAIM,
      re: any(
        EIGHTH + ' (?:لانه|لان|عشان) (?:رقمه|عدده) ' + BIG_AR,
        'eighth because (?:eight|8) is (?:a )?(?:bigger|larger|higher) number',
        eighthBigger, quarterSmaller,
        `(?<![0-9٠-٩/])(?:8|٨|تمانيه|ثمانيه|تمنيه)${IS_AR} ${BIG_AR} من (?:ال)?(?:4|٤|اربعه|اربع)`,
        '(?<![0-9/])(?:8|eight) (?:is |are )?(?:bigger|larger|more|greater) than (?:4|four)',
        `(?:المقام|(?:الرقم|العدد) (?:اللي|الي) تحت|(?:الرقم|العدد) التحتاني)${IS_AR} ${BIG_AR}`,
        '(?:كل ما|كلما) (?:كبر|زاد) (?:المقام|الرقم|العدد)(?: (?:اللي|الي) تحت)? (?:بيكبر|كبر|بيزيد|زاد) (?:الكسر|الحصه|القطعه)',
        '(?:الرقم|العدد) (?:ال)?اكبر (?:يعني|معناه|هو) (?:كسر |الكسر )?اكبر',
        '(?:bigger|larger|greater|higher) (?:denominator|bottom number|number(?: on (?:the )?bottom)?) (?:means|makes|gives|so|is|=)(?: (?:a|the|it(?:\'s| is)))? (?:bigger|larger|more|greater)',
        '(?:denominator|bottom number) is (?:bigger|larger|greater|higher)',
      ),
    },
    {
      idea: 'separate_numbers',
      unless: SOUND_CLAIM,
      re: any(
        '(?:فوقهم|فوقهن) (?:نفس الرقم|نفس العدد|1|١|واحد)',
        `(?:فوقهم|فوقهن) ${W}{0,3}?(?:قد بعض|متساويين|متساوي)`,
        '(?:البسط|(?:الرقم|العدد) (?:اللي|الي) فوق|(?:الارقام|الاعداد) (?:اللي|الي) فوق)(?: (?:هو|هي))? (?:نفسه|نفسها|نفس الاشي|قد بعض|متساوي|متساويين)',
        'نفس البسط (?:يعني |ف|فا )?(?:قد بعض|متساويين|متساوي)',
        '(?:بقارن|قارنت|منقارن|بنقارن|بطلع علي|بشوف) (?:بس )?(?:الارقام|الرقم|الاعداد|العدد) (?:اللي|الي) فوق',
        '(?:بقارن|قارنت|منقارن|بنقارن) (?:بس )?البسط',
        '(?:بجمع|جمعت|بنجمع|منجمع|نجمع) (?:ال)?(?:ارقام|رقمين|اعداد|عددين|بسط|[0-9٠-٩])',
        '[0-9٠-٩] ?\\+ ?[0-9٠-٩]',
        '(?<![0-9٠-٩/])(?:5|٥|خمسه) (?:اكبر|اكتر|اكثر) من (?:ال)?(?:3|٣|تلاته|ثلاثه)(?![0-9٠-٩/])',
        '(?:رقمين|عددين) (?:لحالهم|منفصلين)',
        '(?:compare|compared|look at|looked at|only|just) (?:the )?(?:top numbers?|numerators?)',
        '(?:top numbers?|numerators?)(?: are| is)?(?: both)?(?: the)? same,?(?: so| and so| therefore)?(?: they(?:\'re| are))?(?: equal| the same)',
        '(?:add|added|adding) (?:up )?(?:the )?(?:two )?numbers',
        '[0-9] ?plus ?[0-9]',
        '(?<![0-9/])(?:5|five) is (?:bigger|larger|more|greater) than (?:3|three)',
        'two separate (?:whole )?numbers',
      ),
    },
    { idea: 'equal_parts', re: any(
        quarterBigger, eighthSmaller, ...partShrinks, ...morePartsSmaller,
        QUARTER + ',? (?:لانه|لان|عشان) (?:قطعته|حصته) ' + BIG_AR,
        QUARTER + '[،,]? (?:لانه|لان|عشان) لما (?:نقسم|قسمنا) (?:لاربعه|لاربع) (?:حصتك|قطعتك|القطعه) ' + BIG_AR,
      ) },
  ],
  samples: [
    { ar: 'الربع أكبر من التمن، لأنه كل ما قسمنا لقطع أكثر صارت القطعة أصغر', en: 'A quarter is bigger than an eighth because more equal pieces means each piece is smaller.' },
    { ar: 'التمن أكبر لأنه ٨ أكبر من ٤', en: 'One eighth is bigger because 8 is bigger than 4.' },
    { ar: 'ربع هو ربع، مش مهم حجم البيتزا', en: 'A quarter is a quarter, the size of the pizza doesn’t matter.' },
    { ar: 'الاثنين فوقهم ١، فهنّ قد بعض', en: 'The top numbers are the same so they are equal.' },
    { ar: 'حتى لو القطع مش قد بعض، قطعة من ٤ اسمها ربع', en: 'The pieces don’t have to be equal, any piece out of four is a quarter.' },
  ],
  preTest: [
    {
      id: 'pre1', node: 'C4',
      q: { ar: 'لوحين شوكولاتة قد بعض. وين أكثر: تلت لوح ولا سُدس لوح؟', en: 'Two bars of one size. Which is more: a third of one or a sixth of the other?' },
      options: [{ ar: 'التلت', en: 'The third' }, { ar: 'السُّدس', en: 'The sixth' }, { ar: 'قد بعض', en: 'The same' }],
      correct: 0,
    },
    {
      id: 'pre2', node: 'C2',
      q: { ar: 'ورقة انقصّت ٤ قطع: وحدة كبيرة وتلاتة صغار. هل القطعة الصغيرة ربع؟', en: 'A sheet is cut into 4 pieces: one big, three small. Is a small piece a quarter?' },
      options: [
        { ar: 'آه، لأنها وحدة من أربع', en: 'Yes, it is one of four' },
        { ar: 'لأ، لأن القطع مش قد بعض', en: 'No, the pieces are not the same size' },
        { ar: 'آه، لأنها صغيرة', en: 'Yes, because it is small' },
      ],
      correct: 1,
    },
    {
      id: 'pre3', node: 'C3',
      q: { ar: 'نص بيتزا ولا ربعين من نفس البيتزا. وين أكثر؟', en: 'Half a pizza or two quarters of the same pizza. Which is more?' },
      options: [{ ar: 'النص', en: 'The half' }, { ar: 'الربعين', en: 'The two quarters' }, { ar: 'قد بعض', en: 'The same' }],
      correct: 2,
    },
    {
      id: 'pre4', node: 'C5',
      q: { ar: 'ربع كيكة كبيرة وربع كيكة صغيرة. وين أكثر؟', en: 'A quarter of a big cake and a quarter of a small cake. Which is more?' },
      options: [{ ar: 'ربع الكبيرة', en: 'The big cake’s quarter' }, { ar: 'ربع الصغيرة', en: 'The small cake’s quarter' }, { ar: 'قد بعض', en: 'The same' }],
      correct: 0,
    },
  ],
  postTest: [
    {
      id: 'post1', node: 'C4',
      q: { ar: 'شريطين قد بعض. من الأول أخدنا خمس أسداس، ومن الثاني خمس أتساع. أي قطعة أطول؟', en: 'Two ribbons of one length. We take 5/6 of one and 5/9 of the other. Which part is longer?' },
      options: [{ ar: '٥/٦', en: '5/6' }, { ar: '٥/٩', en: '5/9' }, { ar: 'قد بعض', en: 'The same' }],
      correct: 0,
    },
    {
      id: 'post2', node: 'C2',
      q: { ar: 'حقل انقسم خمس قطع أرض مش قد بعض. هل كل قطعة هي خُمس الحقل؟', en: 'A field is split into five plots of different sizes. Is each plot one fifth of the field?' },
      options: [
        { ar: 'آه، لأنهم خمسة', en: 'Yes, there are five' },
        { ar: 'لأ، لأنهم مش قد بعض', en: 'No, they are not the same size' },
        { ar: 'بس أول قطعة', en: 'Only the first plot' },
      ],
      correct: 1,
    },
    {
      id: 'post3', node: 'C3',
      q: { ar: 'قنّينتين قد بعض: الأولى معبّاية تلات أرباعها، والثانية خمس أتمانها. أي وحدة فيها مي أكثر؟', en: 'Two matching bottles: one is 3/4 full, the other 5/8 full. Which holds more water?' },
      options: [{ ar: 'الأولى', en: 'The first' }, { ar: 'الثانية', en: 'The second' }, { ar: 'قد بعض', en: 'The same' }],
      correct: 0,
    },
    {
      id: 'post4', node: 'C5',
      q: { ar: 'نص علبة تمر صغيرة ونص علبة تمر كبيرة. وين التمر أكثر؟', en: 'Half of a small box of dates and half of a large box. Where are there more dates?' },
      options: [
        { ar: 'بنص الكبيرة', en: 'In half of the large box' },
        { ar: 'بنص الصغيرة', en: 'In half of the small box' },
        { ar: 'قد بعض لأن الثنتين نص', en: 'The same, both are halves' },
      ],
      correct: 0,
    },
  ],
  activities: {
    bigger_denominator: {
      type: 'experiment',
      title: { ar: 'كيكة لأربعة وكيكة لتمانية', en: 'One cake for four, one for eight' },
      goal: { ar: 'نشوف شو بصير بحصة الواحد لما يزيد عدد الأجزاء.', en: 'See what happens to one share as the number of parts grows.' },
      grouping: { ar: 'مجموعات من ٤', en: 'Groups of 4' },
      materials: ['paper', 'scissors'],
      steps: [
        { minutes: 3, title: { ar: 'توقّعوا', en: 'Predict' }, detail: { ar: 'كل طالب بيكتب: حصتك أكبر إذا الكيكة لأربعة ولا لتمانية؟ وليش؟', en: 'Each learner writes: is your share bigger with four people or eight? Why?' } },
        { minutes: 7, title: { ar: 'اطووا وقصّوا', en: 'Fold and cut' }, detail: { ar: 'دايرتين ورق قد بعض: وحدة ٤ أجزاء ووحدة ٨. حطّوا قطعة فوق قطعة.', en: 'Two matching paper circles: one in 4 parts, one in 8. Lay one piece on another.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'العدد ٨ أكبر، بس شو صار بالقطعة؟ شو بيحكيلنا العدد اللي تحت؟', en: '8 is the bigger number, but what happened to the piece? What does the bottom number tell us?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'قارنوا ١/٣ و١/٦ برسمة وجملة.', en: 'Compare 1/3 and 1/6 with a drawing and one sentence.' } },
      ],
      teacher: { ar: 'ما تصلّح بسرعة. خلّيهم يشوفوا القطعتين ويحكوا لحالهم.', en: 'Do not correct early. Let them compare the pieces and say it themselves.' },
      check: { ar: 'ليش ١/١٠ من رغيف أقل من ١/٥ منه، مع إنه ١٠ أكبر؟', en: 'Why is 1/10 of a loaf less than 1/5 of it, although 10 is bigger?' },
      adapt: { ar: 'للي بده دعم: قطع جاهزة للمقارنة. للمتقدّم: رتّبوا ١/٢ و١/٣ و١/٨.', en: 'Support: give pre-cut pieces. Stretch: order 1/2, 1/3 and 1/8.' },
    },
    ignore_whole: {
      type: 'discussion',
      title: { ar: 'ربع مين أكبر؟', en: 'Whose quarter is more?' },
      goal: { ar: 'نربط الكسر بحجم الكل اللي انأخد منه.', en: 'Connect a fraction to the size of its whole.' },
      grouping: { ar: 'أزواج', en: 'Pairs' },
      materials: ['paper', 'scissors', 'ruler'],
      steps: [
        { minutes: 3, title: { ar: 'موقف', en: 'Situation' }, detail: { ar: 'سامر أخد ربع رغيف صغير، ودانا ربع رغيف كبير. حكى سامر: «أخدنا قد بعض». مين معه؟', en: 'Samer took a quarter of a small loaf, Dana a quarter of a large one. Samer says they got the same. Who agrees?' } },
        { minutes: 7, title: { ar: 'جرّبوا', en: 'Try it' }, detail: { ar: 'ورقتين بحجمين، ربع من كل وحدة، وقارنوا. بعدين لاقوا متى ١/٨ من كبيرة بيساوي ١/٤ من صغيرة.', en: 'Two sheet sizes, a quarter of each. Then find when 1/8 of a large one matches 1/4 of a small one.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'شو لازم نعرف قبل ما نقول «قد بعض»؟', en: 'What must we know before saying “the same”?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'اكتبوا مثال: نص أقل من ربع.', en: 'Write an example where a half is less than a quarter.' } },
      ],
      teacher: { ar: 'أكّد إن الكسر لحاله بيحكي عن حصة من كل، وحجم الكل بيحدّد الكمية.', en: 'Stress that a fraction names a share of a whole; the whole’s size sets the amount.' },
      check: { ar: 'إيمتى بنقدر نقارن كسرين من الأرقام بس؟', en: 'When can two fractions be compared from the numbers alone?' },
      adapt: { ar: 'للي بده دعم: غرضين حقيقيين بحجمين. للمتقدّم: كل قد (أ) تلات مرّات.', en: 'Support: two real objects of different sizes. Stretch: a whole three times as big.' },
    },
    separate_numbers: {
      type: 'game',
      title: { ar: 'شرايط الكسور', en: 'Fraction strips' },
      goal: { ar: 'نقرا العددين مع بعض كأجزاء من كل.', en: 'Read the two numbers together as parts of a whole.' },
      grouping: { ar: 'مجموعات من ٣', en: 'Groups of 3' },
      materials: ['grid_paper', 'ruler', 'scissors'],
      steps: [
        { minutes: 4, title: { ar: 'نجهّز', en: 'Prepare' }, detail: { ar: 'شرايط بطول ٨ مربّعات: أنصاف وأرباع وأتمان.', en: 'Strips 8 squares long: halves, quarters and eighths.' } },
        { minutes: 6, title: { ar: 'لعبة مين أطول', en: 'Longer wins' }, detail: { ar: 'كل لاعب بيسحب بطاقة كسر، بيتوقّع، وبعدين بيحط الشرايط تحت بعض.', en: 'Each player draws a fraction card, predicts, then lines up the strips.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: '١/٤ و١/٨ فوقهم نفس العدد. ليش الشرايط مش نفس الطول؟', en: '1/4 and 1/8 share a top number. Why do the strips differ in length?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'ارسم ٣/٤ و٥/٨ وأشّر على الأطول.', en: 'Draw 3/4 and 5/8 and mark the longer one.' } },
      ],
      teacher: { ar: 'خلّي الطالب يأشّر على المعنى: «هاد العدد بيحكي كم جزء، وهاد كم أخدنا».', en: 'Have learners point: this number is how many parts, that one how many taken.' },
      check: { ar: 'ليش ما بيزبط نقول إن ٣/٤ و٣/٨ قد بعض؟', en: 'Why is it wrong to say 3/4 and 3/8 are the same?' },
      adapt: { ar: 'للي بده دعم: أنصاف وأرباع بس. للمتقدّم: زيدوا أتلات وأسداس.', en: 'Support: halves and quarters only. Stretch: add thirds and sixths.' },
    },
    unequal_ok: {
      type: 'worksheet',
      title: { ar: 'عادلة ولا لأ؟', en: 'Fair or not?' },
      goal: { ar: 'نتأكّد إن الأجزاء قد بعض قبل ما نسمّي الكسر.', en: 'Check the parts match before naming a fraction.' },
      grouping: { ar: 'فردي وبعدين أزواج', en: 'Solo, then pairs' },
      materials: ['paper', 'scissors', 'ruler'],
      steps: [
        { minutes: 4, title: { ar: 'صنّفوا', en: 'Sort' }, detail: { ar: 'رسومات أشكال مقسومة: أي وحدة فيها أرباع عن جد؟', en: 'Drawings of cut shapes: which really show quarters?' } },
        { minutes: 6, title: { ar: 'تأكّدوا بالقص', en: 'Check by cutting' }, detail: { ar: 'قصّوا قطع الرسمة المشكوك فيها وحطّوها فوق بعض.', en: 'Cut out the doubtful pieces and lay them on each other.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'لو أنا أخدت القطعة الرفيعة وإنت العريضة، هل أخدنا «ربع وربع»؟', en: 'If I get the thin piece and you the wide one, did we each get a quarter?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'قسّم مربّع لأرباع بطريقتين.', en: 'Split a square into quarters in two ways.' } },
      ],
      teacher: { ar: 'انتبه: قطع بشكل مختلف ممكن تكون نفس القدّ. المهم القدّ مش الشكل.', en: 'Note: different shapes can have the same size. Size matters, not shape.' },
      check: { ar: 'شو الشرط عشان القطعة تنحسب ربع؟', en: 'What must be true for a piece to be a quarter?' },
      adapt: { ar: 'للي بده دعم: ورق مربّعات للعدّ. للمتقدّم: أرباع بأشكال مختلفة ونفس القدّ.', en: 'Support: grid paper for counting. Stretch: same-size quarters with different shapes.' },
    },
    _default: {
      type: 'experiment',
      title: { ar: 'اطوي وقارن', en: 'Fold and compare' },
      goal: { ar: 'كل طالب بيقارن كسرين بالرسم وبيحكي ليش.', en: 'Every learner compares two fractions with a model and says why.' },
      grouping: { ar: 'أزواج', en: 'Pairs' },
      materials: ['paper', 'scissors'],
      steps: [
        { minutes: 3, title: { ar: 'توقّعوا', en: 'Predict' }, detail: { ar: 'ربع ولا تُمن؟ كل واحد بيكتب توقّعه وسببه.', en: 'Quarter or eighth? Each writes a prediction and a reason.' } },
        { minutes: 7, title: { ar: 'تلات تجارب', en: 'Three tests' }, detail: { ar: 'أجزاء ٤ و٨، وبعدين ورقة كبيرة وصغيرة، وبعدين قصّ مش عادل.', en: '4 and 8 parts, then a big and a small sheet, then an uneven cut.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'أي فكرة صمدت بالتلات تجارب؟', en: 'Which idea survived all three tests?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'جملة: كيف بعرف أي كسر أكبر؟', en: 'One sentence: how do I know which fraction is more?' } },
      ],
      teacher: { ar: 'اطلب سبب مع كل جواب، واقبل الرسم كدليل.', en: 'Ask for a reason with every answer and accept drawings as evidence.' },
      check: { ar: 'تلت ولا خُمس من نفس الرغيف؟ ليش؟', en: 'A third or a fifth of the same loaf? Why?' },
      adapt: { ar: 'للي بده دعم: أنصاف وأرباع. للمتقدّم: ٣/٤ و٥/٨.', en: 'Support: halves and quarters. Stretch: 3/4 and 5/8.' },
    },
    _enrich: {
      type: 'escape',
      title: { ar: 'خزنة الكسور', en: 'The fraction safe' },
      goal: { ar: 'نستعمل المقارنة بمواقف جديدة وكلّ بأحجام مختلفة.', en: 'Apply comparison to new cases with wholes of different sizes.' },
      grouping: { ar: 'مجموعات من ٤', en: 'Groups of 4' },
      materials: ['paper', 'grid_paper', 'ruler'],
      steps: [
        { minutes: 5, title: { ar: 'قفل ١', en: 'Lock 1' }, detail: { ar: 'رتّبوا ٥/٨ و١/٢ و٣/٤ من الأقل للأكثر، مع إثبات بالرسم.', en: 'Order 5/8, 1/2 and 3/4 from least to most, with a drawn proof.' } },
        { minutes: 5, title: { ar: 'قفل ٢', en: 'Lock 2' }, detail: { ar: 'صمّموا موقف فيه نص أقل من تلت.', en: 'Design a case where a half is less than a third.' } },
        { minutes: 5, title: { ar: 'قفل ٣', en: 'Lock 3' }, detail: { ar: 'لاقوا تلات كسور بنفس كمية ١/٢ وعلّموا غيركم.', en: 'Find three fractions with the same amount as 1/2 and teach another group.' } },
      ],
      teacher: { ar: 'المفتاح بينفتح بس إذا السبب واضح.', en: 'A lock opens only when the reason is clear.' },
      check: { ar: 'ليش ٢/٤ و٤/٨ نفس الكمية؟', en: 'Why are 2/4 and 4/8 the same amount?' },
      adapt: { ar: 'للي بده دعم: شرايط جاهزة. للمتقدّم: مقارنة بدون رسم مع تبرير.', en: 'Support: ready strips. Stretch: compare without drawing and justify.' },
    },
  },
};
