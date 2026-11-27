/**
 * Concept pack: «ليش الظل بيكبر أو بيصغر مع إنه الغرض نفسه ما بيتغيّر؟» (shadow size), grades 3–6.
 * A small (point-like) light, a flat object and a screen on one axis:
 *   shadow height = object height × (light→screen) / (light→object)
 * Arabic offline patterns are written against normaliseText() output: ا for أإآ, ه for ة, ي for ى/ئ, و for ؤ.
 */
import type { ChildModel, Conditions, L } from '../contracts';
import type { ConceptPack } from './types';

type Out = 'bigger' | 'smaller' | 'same' | 'equals_object';

const t = (ar: string, en: string): L => ({ ar, en });
/** one regex from several readable alternatives (leftmost match wins, so one idea is counted once) */
const anyOf = (...parts: RegExp[]) => new RegExp(parts.map((p) => p.source).join('|'));

/* ───────────── geometry and deterministic worlds ───────────── */

/** centimetres behind each option id (also used by the 2D scene to draw to scale) */
export const SHADOW_CM = {
  /** light → object */
  light: { near: 20, mid: 40, far: 60 },
  /** object → screen */
  screen: { near: 20, mid: 40, far: 60 },
  /** object height */
  size: { small: 5, mid: 10, tall: 15 },
} as const;

const BASE = { d1: SHADOW_CM.light.mid, d2: SHADOW_CM.screen.mid, h: SHADOW_CM.size.mid };

export function shadowDims(c: Conditions): { d1: number; d2: number; h: number } {
  const pick = (table: Record<string, number>, id: string | undefined, fallback: number) => (id ? table[id] : undefined) ?? fallback;
  return {
    d1: pick(SHADOW_CM.light, c.light, BASE.d1),
    d2: pick(SHADOW_CM.screen, c.screen, BASE.d2),
    h: pick(SHADOW_CM.size, c.size, BASE.h),
  };
}

const geometry = (h: number, d1: number, d2: number) => (h * (d1 + d2)) / d1;

/** exact shadow height in cm */
export const shadowHeight = (c: Conditions): number => {
  const { d1, d2, h } = shadowDims(c);
  return geometry(h, d1, d2);
};

/** the shadow of the starting set-up: every outcome is relative to this */
export const BASE_SHADOW_CM = geometry(BASE.h, BASE.d1, BASE.d2);

const compared = (cm: number): Out => (cm > BASE_SHADOW_CM + 0.01 ? 'bigger' : cm < BASE_SHADOW_CM - 0.01 ? 'smaller' : 'same');

function realOutcome(c: Conditions): Out {
  return compared(shadowHeight(c));
}

function kidOutcome(m: ChildModel, c: Conditions): Out {
  const { d1, d2, h } = shadowDims(c);
  const wrong = m.sources.filter((s) => s !== 'light_geometry');
  if (!wrong.length) return realOutcome(c);
  if (wrong.includes('same_as_object')) return 'equals_object';
  /** "only the object counts": the shadow keeps the starting ratio to the object */
  const objectOnly = compared((h * BASE_SHADOW_CM) / BASE.h);
  if (wrong.includes('object_size_only')) return objectOnly;
  if (wrong.includes('light_distance_irrelevant') && wrong.includes('object_distance_irrelevant')) return objectOnly;
  switch (wrong[0]) {
    // sliding the object between a fixed light and a fixed screen changes nothing for this learner
    case 'object_distance_irrelevant':
      return d1 + d2 === BASE.d1 + BASE.d2 ? objectOnly : compared(geometry(h, d1, d2));
    // the light's distance is ignored (as if it never moved); object and screen still matter
    case 'light_distance_irrelevant':
      return compared(geometry(h, BASE.d1, d2));
    // the light's distance works backwards: farther light, bigger shadow
    case 'farther_light_bigger':
      return compared((geometry(h, BASE.d1, d2) * d1) / BASE.d1);
    default:
      return realOutcome(c);
  }
}

function measure(c: Conditions): L {
  const exact = shadowHeight(c);
  const cm = Math.round(exact * 10) / 10;
  const about = Math.abs(cm - exact) > 1e-9;
  return t(
    `طول الظل: ${about ? 'حوالي ' : ''}${cm.toLocaleString('ar-EG')} سم`,
    `Shadow height: ${about ? 'about ' : ''}${cm.toLocaleString('en-US')} cm`,
  );
}

/* ───────────── offline language patterns ───────────── */

// building blocks (normalised Arabic). «كل ما» is kept inside the match so it is not read as a negation.
const A = '[ء-ي]';
const PRE = `(?:(?:و|ف)?كل ?ما )?(?:(?<!${A})${A}{0,4}?)`;
// «تقريباً» (about) and «قريباً» (soon) are not «closer»
const CLOSER = `${PRE}(?:قرب|قريب(?!ا))`;
const FARTHER = `${PRE}(?:بعد(?!ين)|بعيد)`;
const BIGGER = `(?:(?:و|ف)?كل ?ما )?(?:بيكبر|يكبر|بكبر|بتكبر|تكبر|كبرت|كبر|اكبر|بيطول|اطول)`;
const SMALLER = `(?:(?:و|ف)?كل ?ما )?(?:بيصغر|يصغر|بصغر|بتصغر|تصغر|صغرت|صغر|اصغر|بيقصر|اقصر)`;
const LIGHT = `(?:ال|لل|عال)?(?:ضو|ضوء|كشاف|لمبه|نور|مصباح|فلاش|بيل)(?![ء-ي])`;
const OBJ = `(?:ال|لل)?(?:غرض|اغراض|لعبه|اشي|شي|جسم|ايد|دميه|كرتونه|مجسم)(?:ي|ك|ه|ها|نا)?(?![ء-ي])`;
const SCREEN = `(?:ال|لل|عال)?(?:حيط|حيطه|شاشه|جدار|ستاره|ورقه)(?![ء-ي])`;
const SHADOW = `(?<!${A})(?:و|ف|ل)?(?:ال|لل)?(?:ظل|ضل|خيال)(?:ه|ها|ي|ك|نا)?(?!${A})`;
/** a short stretch that does not cross a sentence end, a negation or the opposite word */
const gap = (n: number, not = '') =>
  `(?:(?!(?<!${A})(?:مش|مو)(?!${A})|(?<!كل )(?<!${A})ما (?=[بتي])${not ? `|${not}` : ''})[^.؟!]){0,${n}}?`;
const NOT_BIG = '(?:بيكبر|يكبر|بكبر|بتكبر|اكبر|كبر)';
const NOT_SMALL = '(?:بيصغر|يصغر|بصغر|بتصغر|اصغر|صغر)';
const NEG_VERB = `(?<!${A})(?:ما|مش|مو|ولا) ?(?:رح )?(?:بيتغير|بتغير|يتغير|بتتغير|تتغير|بيفرق|بفرق|فرق|يفرق|بياثر|باثر|بتاثر|ياثر|تاثير|بيهم|بهم|مهم|بيكبر|بيصغر|في فرق|دخل)`;
const re = (source: string) => new RegExp(source);
/** «حجم اللعبة ما بتغيّر» is about the object itself, not a claim that moving it leaves the shadow unchanged */
const NOT_ABOUT_OBJECT = `(?:(?!(?:حجم|طول) (?:ال)?(?:غرض|لعبه|اشي|جسم)|(?:غرض|لعبه|حجمها|حجمه) نفس)[^.؟!]){0,40}?`;
const STAYS_AR = `(?:بيضل|بتضل|ضل|يضل) (?:(?!(?:غرض|لعبه))[^.؟!]){0,14}?(?:نفس|زي ما|متل ما)`;

const AR_GEOMETRY: RegExp[] = [
  // closer to the light → bigger
  re(`${CLOSER}${gap(25, NOT_SMALL)}${LIGHT}${gap(30, NOT_SMALL)}${BIGGER}`),
  re(`${BIGGER}${gap(40, NOT_SMALL)}${CLOSER}${gap(25, NOT_SMALL)}${LIGHT}`),
  // farther from the light → smaller
  re(`${FARTHER}${gap(25, NOT_BIG)}${LIGHT}${gap(30, NOT_BIG)}${SMALLER}`),
  re(`${SMALLER}${gap(40, NOT_BIG)}${FARTHER}${gap(25, NOT_BIG)}${LIGHT}`),
  // the screen side
  re(`${CLOSER}${gap(25, NOT_BIG)}${SCREEN}${gap(30, NOT_BIG)}${SMALLER}`),
  re(`${SMALLER}${gap(40, NOT_BIG)}${CLOSER}${gap(25, NOT_BIG)}${SCREEN}`),
  re(`${FARTHER}${gap(25, NOT_SMALL)}${SCREEN}${gap(30, NOT_SMALL)}${BIGGER}`),
  re(`${BIGGER}${gap(40, NOT_SMALL)}${FARTHER}${gap(25, NOT_SMALL)}${SCREEN}`),
  re(`(?:بيعتمد|يعتمد|معتمد|حسب)${gap(20)}(?:مسافه|المسافه|البعد|بعد (?:ال)?(?:غرض|لعبه|ضو|كشاف)|قديش (?:بعيد|قريب))`),
];

const EN_GEOMETRY: RegExp[] = [
  /(?:closer|nearer)(?:(?!screen|wall|farther|further)[^.?!]){0,28}?(?:light|torch|lamp|flashlight)(?:(?!smaller|\bnot\b|n't)[^.?!]){0,45}?(?:bigger|larger|grows)/,
  /(?:light|torch|lamp|flashlight)(?:(?!screen|wall|smaller|\bnot\b|n't)[^.?!]){0,20}?(?:closer|nearer)(?:(?!smaller|\bnot\b|n't)[^.?!]){0,45}?(?:bigger|larger|grows)/,
  /(?:bigger|larger)(?:(?!smaller|screen|wall|\bnot\b)[^.?!]){0,45}?(?:closer|nearer) (?:to )?(?:the |a )?(?:light|torch|lamp|flashlight)/,
  /(?:farther|further|away)(?:(?!screen|wall|closer|nearer)[^.?!]){0,28}?(?:light|torch|lamp|flashlight)(?:(?!bigger|larger|\bnot\b|n't)[^.?!]){0,45}?smaller/,
  /(?:light|torch|lamp|flashlight)(?:(?!screen|wall|bigger|larger|\bnot\b|n't)[^.?!]){0,20}?(?:farther|further|away)(?:(?!bigger|larger|\bnot\b|n't)[^.?!]){0,45}?smaller/,
  /(?:farther|further|away) (?:from )?(?:the |a )?(?:screen|wall)(?:(?!smaller|\bnot\b|n't)[^.?!]){0,45}?(?:bigger|larger|grows)/,
  /(?:screen|wall)(?:(?!light|torch|lamp|smaller|\bnot\b|n't)[^.?!]){0,15}?(?:farther|further|away)(?:(?!smaller|\bnot\b|n't)[^.?!]){0,45}?(?:bigger|larger|grows)/,
  /(?:closer|nearer) (?:to )?(?:the |a )?(?:screen|wall)(?:(?!bigger|larger|\bnot\b|n't)[^.?!]){0,45}?smaller/,
  /depends? (?:up)?on (?:the |its )?distances?|depends? (?:up)?on how (?:far|close|near)/,
];

const STRAIGHT = anyOf(
  /(?:بخط|خط|بخطوط|خطوط) (?:مستقيم\S*|دغري)|بشكل مستقيم|(?:بيمشي|يمشي|بمشي|بروح|بيروح) (?:دغري|مستقيم)|دغري/,
  /straight (?:lines?|paths?)|(?:travels?|goes|moves|going|travell?ing) (?:in )?straight|in a straight line/,
);

const BLOCKS = anyOf(
  /(?:بيسد|بسد|يسد|بتسد|سادد|بيحجب|بحجب|يحجب|بتحجب|حاجب|بيمنع|بمنع|يمنع|بتمنع|مانع|بوقف|بيوقف|يوقف|بتوقف|موقف|بيصد|بصد|بيحجز|حاجز) [^.؟!]{0,14}?(?:ضو|ضوء|نور)/,
  /(?:ضو|ضوء|نور)(?:ه)? (?:\S+ )?(?:ما|مش) ?(?:بيوصل|بوصل|بيوصله|وصل|بيقدر يمر|بيقدر يقطع|بيقدر يعدي|بيمر|بيقطع|بيعدي)/,
  /(?:محل|مكان|المنطقه)(?: اللي| يلي)? ما (?:بيوصل\S*|بوصل\S*|وصل\S*) (?:ال)?(?:ضو|ضوء|نور)/,
  /block\w*[^.?!]{0,20}?light|light (?:is )?(?:gets? )?blocked|light (?:can't|cannot|can not|doesn't|does not|could not) (?:reach|pass|get through|go through|get past)/,
  /stops? (?:the )?light|where (?:the )?light (?:can't|cannot|can not|doesn't|does not) (?:reach|get)/,
);

/* ───────────── pack ───────────── */

export const shadows: ConceptPack = {
  id: 'shadows',
  subject: 'science',
  title: t('لعبة الظلال', 'Shadow play'),
  question: t('ليش الظل بيكبر أو بيصغر، مع إنه الغرض نفسه ما بيتغيّر حجمه؟', 'Why does a shadow get bigger or smaller when the object stays the same size?'),
  grades: [3, 6],
  curriculum: {
    verified: false,
    note: t(
      'درس الضو والظل: لسا ما راجعناه مع الكتاب المدرسي المطبوع، وما منذكر أرقام صفحات.',
      'Light and shadows: not yet checked against the printed school textbook, so no book pages are cited.',
    ),
  },
  objectives: [
    { id: 'o_form', text: t('يشرح كيف بيتكوّن الظل: الضو بيمشي دغري والغرض بيحجبه.', 'Explain how a shadow forms: light travels straight and the object blocks it.'), nodes: ['C1', 'C2', 'C3'] },
    { id: 'o_size', text: t('يتوقّع كيف بيتغيّر حجم الظل لما يتحرّك الضو أو الغرض أو الشاشة.', 'Predict how shadow size changes when the light, the object or the screen moves.'), nodes: ['C4'] },
    { id: 'o_fair', text: t('يعمل تجربة عادلة: يغيّر إشي واحد ويقيس طول الظل.', 'Run a fair test: change one thing and measure the shadow.'), nodes: ['C4', 'C5'] },
  ],
  concepts: {
    C1: { label: t('الضو بيمشي دغري', 'Light goes straight'), ai: 'light travels in straight lines from its source', needs: [] },
    C2: { label: t('أغراض بتحجب الضو', 'Objects block light'), ai: 'opaque objects block light', needs: ['C1'] },
    C3: { label: t('الظل محل بلا ضو', 'Shadow: no light there'), ai: 'a shadow is where the blocked light cannot reach', needs: ['C2'] },
    C4: { label: t('المسافات بتغيّر الحجم', 'Distances set the size'), ai: 'the closer the object is to the light compared with the screen, the bigger the shadow', needs: ['C3'] },
    C5: { label: t('مسرح الظل وأكتر', 'Shadow theatre and more'), ai: 'the same ray geometry explains shadow theatre, projectors and measuring with shadows', needs: ['C4'] },
  },
  prerequisites: [
    {
      id: 'light_travels',
      label: t('كيف بيوصل الضو', 'How light travels'),
      why: t('إذا ما بيعرف إنه الضو بيمشي دغري، ما رح يقدر يتوقّع وين بيوصل ووين لأ.', 'Without straight-line travel, the learner cannot predict where light reaches.'),
      supports: ['C1'],
      suspect: { ideas: ['same_as_object', 'light_distance_irrelevant', 'farther_light_bigger'], missingSteps: [0] },
      verify: [
        {
          id: 'lt_v1',
          q: t('بتشوف لعبة من خلال أنبوب ورق دغري. إذا لوينا الأنبوب كتير، بتضل تشوفها؟', 'You see a toy through a straight paper tube. If we bend the tube a lot, can you still see it?'),
          options: [t('لأ، لأنه الضو ما بيلفّ مع الأنبوب', 'No, light does not bend around with the tube'), t('آه، الضو بيلفّ مع الأنبوب لحاله', 'Yes, light bends along the tube by itself')],
          correct: 0,
          node: 'C1',
        },
        {
          id: 'lt_v2',
          q: t('من وين بيبدا الضو لما نشغّل الكشاف؟', 'Where does the light start when we switch on a torch?'),
          options: [t('من الكشاف وبيروح منه لبرّا', 'At the torch, then it travels outwards'), t('من الحيط وبيرجع للكشاف', 'At the wall, then back to the torch'), t('من الظل', 'At the shadow')],
          correct: 0,
          node: 'C1',
        },
      ],
      remedy: {
        title: t('طريق الضو', "The light's path"),
        minutes: 5,
        steps: [
          t('تلات كرتونات بكل وحدة خزق بنفس العلو، ورا بعض.', 'Line up three cards, each with a hole at the same height.'),
          t('وجّه الكشاف ع أول خزق، وطلّع ع الورقة اللي بالآخر (مش ع الضو).', 'Shine a torch at the first hole and watch the paper at the end, not the light.'),
          t('زيح الكرتونة اللي بالنص شوي. شو صار بالبقعة؟', 'Shift the middle card a little. What happens to the spot?'),
          t('ارسموا طريق الضو بالمسطرة.', "Draw the light's path with a ruler."),
        ],
      },
      recheck: {
        id: 'lt_r',
        q: t('كيف بيمشي الضو من الكشاف للورقة؟', 'How does light go from the torch to the paper?'),
        options: [t('بخط مستقيم', 'In a straight line'), t('بيلفّ حوالين الكرتون', 'It curves around the card')],
        correct: 0,
        node: 'C1',
      },
    },
    {
      id: 'blocking',
      label: t('أغراض بتسدّ الضو', 'Some objects block light'),
      why: t('الظل بيتكوّن بس لما إشي يحجب الضو.', 'A shadow only forms when something blocks the light.'),
      supports: ['C2', 'C3'],
      suspect: { ideas: ['object_size_only', 'same_as_object'], missingSteps: [1] },
      verify: [
        {
          id: 'bl_v1',
          q: t('أي غرض بيعمل ظل غامق وواضح؟', 'Which object makes a dark, clear shadow?'),
          options: [t('كتاب', 'A book'), t('لوح زجاج نضيف وشفّاف', 'A clean clear pane of glass')],
          correct: 0,
          node: 'C2',
        },
        {
          id: 'bl_v2',
          q: t('وين بيطلع ظل الكتاب؟', "Where does the book's shadow appear?"),
          options: [t('بين الكشاف والكتاب', 'Between the torch and the book'), t('ورا الكتاب، بالجهة التانية من الكشاف', 'Behind the book, on the side away from the torch')],
          correct: 1,
          node: 'C3',
        },
      ],
      remedy: {
        title: t('مين بيسدّ الضو؟', 'What blocks light?'),
        minutes: 5,
        steps: [
          t('جيبوا كتاب، ونايلون شفّاف، وورقة رفيعة.', 'Get a book, clear plastic and thin paper.'),
          t('حطّوهم واحد واحد بين الكشاف والحيط.', 'Hold each between the torch and the wall.'),
          t('رتّبوهم: ظل غامق، ظل خفيف، تقريباً بلا ظل.', 'Sort them: dark shadow, faint shadow, hardly any.'),
          t('احكوا: ليش المحل ورا الكتاب معتم؟', 'Discuss why it is dark behind the book.'),
        ],
      },
      recheck: {
        id: 'bl_r',
        q: t('شو هو الظل؟', 'What is a shadow?'),
        options: [t('محل ما بيوصله الضو لأنه في إشي حاجبه', 'A place light does not reach because something blocks it'), t('لون أسود بيطلع من الغرض', 'A black colour that comes out of the object')],
        correct: 0,
        node: 'C3',
      },
    },
  ],
  reference: {
    model: t(
      'الضو من مصدر صغير (متل كشاف) بيمشي بخطوط مستقيمة. الغرض المعتم بيحجب جزء منه، فبيطلع ع الشاشة محل معتم هو الظل. طول الظل = طول الغرض × (المسافة من الضو للشاشة ÷ المسافة من الضو للغرض). يعني كل ما الغرض أقرب للضو مقارنة بالشاشة، ظله أكبر.',
      'Light from a small source such as a torch travels in straight lines. An opaque object blocks part of it, leaving a dark region on the screen: the shadow. Shadow height = object height × (light-to-screen distance ÷ light-to-object distance). So the closer the object is to the light compared with the screen, the bigger the shadow.',
    ),
    limits: t(
      'منفترض مصدر ضو صغير كتير (نقطة)، وغرض مسطّح موازي للشاشة. الكشاف الحقيقي مش نقطة، فأطراف الظل بتطلع مغبّشة والقياس تقريبي. ظل الشمس غير: الشمس بعيدة كتير وأشعّتها تقريباً متوازية، وطول ظلها بيتغيّر حسب علوّها بالسما.',
      'We assume a very small point-like source and a flat object parallel to the screen. A real torch is not a point, so edges look blurry and measurements are approximate. Sun shadows differ: the sun is very far, its rays are nearly parallel, and shadow length depends on its height in the sky.',
    ),
    sources: [
      { title: 'OpenStax, College Physics 2e: section "The Ray Aspect of Light"' },
      { title: 'Driver, Squires, Rushworth and Wood-Robinson (1994), Making Sense of Secondary Science: Research into Children\'s Ideas, Routledge' },
    ],
  },

  ideas: {
    light_geometry: {
      label: t('طريق الضو', "The light's path"),
      mirror: t('هيك إنت شايفها: الضو بيمشي دغري، والغرض بيحجبه، وكل ما قرب الغرض من الضو بيكبر ظله.', 'This is how you see it: light goes straight, the object blocks it, and closer to the light the shadow grows.'),
      observation: t('لما نحرّك الكشاف أو اللعبة، حجم الظل بيتغيّر.', 'When the torch or the toy moves, the shadow changes size.'),
      assumption: t('الضو بيمشي بخطوط مستقيمة وما بيلفّ حوالين الغرض.', 'Light travels in straight lines and does not curve around objects.'),
      conclusion: t('الأماكن هي اللي بتحدّد قديش الظل كبير.', 'Where things stand decides how big the shadow is.'),
      story: [t('الضو بيمشي دغري من الكشاف', 'Light goes straight out of the torch'), t('الغرض بيحجب جزء منه', 'The object blocks part of it'), t('كل ما الغرض أقرب للضو، الظل أكبر', 'The closer the object to the light, the bigger the shadow')],
      wrongStep: null,
      correct: true,
      breaks: null,
      model: { sources: ['light_geometry'], path: 'straight_rays', requires: ['light'] },
      intervention: t('خلّيه يرسم الأشعة بالمسطرة ويتوقّع طول الظل قبل ما يقيس.', 'Have them draw the rays with a ruler and predict the shadow length before measuring.'),
      ai: 'light travels in straight lines, the object blocks it, and shadow size depends on the distances: object closer to the light (relative to the screen) gives a bigger shadow (the scientific idea)',
    },
    object_size_only: {
      label: t('بس حجم الغرض', 'Only the object size'),
      mirror: t('هيك إنت شايفها: حجم الظل بيعتمد بس ع حجم الغرض.', 'This is how you see it: the shadow size depends only on the size of the object.'),
      observation: t('الغرض الكبير غالباً ظله كبير.', 'Big objects often have big shadows.'),
      assumption: t('ما في إشي غير الغرض بيأثّر ع الظل.', 'Nothing but the object affects the shadow.'),
      conclusion: t('إذا الغرض ما تغيّر، ظله ما بيتغيّر.', 'If the object does not change, neither does its shadow.'),
      story: [t('الغرض إله حجم', 'The object has a size'), t('الظل بيتبع هالحجم وبس', 'The shadow follows that size and nothing else'), t('نفس الغرض يعني نفس الظل', 'Same object means same shadow')],
      wrongStep: 1,
      breaks: 'C4',
      model: { sources: ['object_size_only'], path: 'from_object', requires: [] },
      intervention: t('نفس اللعبة بالزبط: قرّبوا الكشاف منها بعد ما يتوقّع، وقيسوا الظل.', 'Keep the very same toy, let them predict, then bring the torch closer and measure.'),
      ai: 'the shadow size depends only on the size of the object; distances do not enter',
    },
    same_as_object: {
      label: t('الظل قد الغرض', 'Same size as object'),
      mirror: t('هيك إنت شايفها: الظل دايماً قد الغرض بالزبط.', 'This is how you see it: the shadow is always exactly the size of the object.'),
      observation: t('شكل الظل بيشبه شكل الغرض.', 'The shadow has the shape of the object.'),
      assumption: t('الظل نسخة عن الغرض.', 'A shadow is a copy of the object.'),
      conclusion: t('نفس الشكل يعني نفس الحجم.', 'Same shape means same size.'),
      story: [t('الضو بيوصل للغرض', 'Light reaches the object'), t('بيطلع ع الحيط نسخة عنه', 'A copy of it appears on the wall'), t('بنفس الحجم دايماً', 'Always the same size')],
      wrongStep: 2,
      breaks: 'C4',
      model: { sources: ['same_as_object'], path: 'shadow_copy', requires: [] },
      intervention: t('خلّيه يقيس اللعبة ويقيس ظلها بالمسطرة ويقارن الرقمين.', 'Have them measure the toy and its shadow with a ruler and compare the numbers.'),
      ai: 'the shadow is exactly the same size as the object, wherever things are',
    },
    object_distance_irrelevant: {
      label: t('مكان الغرض ما بيهمّ', 'Object position is irrelevant'),
      mirror: t('هيك إنت شايفها: لو قرّبنا الغرض من الكشاف أو بعّدناه، حجم الظل ما بيتغيّر.', 'This is how you see it: moving the object closer or farther does not change the shadow size.'),
      observation: t('الغرض نفسه ما بيتغيّر لما نحرّكه.', 'The object itself does not change when we move it.'),
      assumption: t('تحريك الغرض ما إله دخل بالظل.', 'Moving the object has nothing to do with the shadow.'),
      conclusion: t('وين ما حطّيناه، الظل متل ما هو.', 'Wherever we put it, the shadow is unchanged.'),
      story: [t('الضو بيعمل ظل للغرض', 'The light makes a shadow of the object'), t('وين ما كان الغرض بين الكشاف والحيط', 'Wherever the object stands between torch and wall'), t('الظل بيضل نفس الحجم', 'The shadow keeps the same size')],
      wrongStep: 2,
      breaks: 'C4',
      model: { sources: ['object_distance_irrelevant'], path: 'from_object', requires: [] },
      intervention: t('ثبّتوا الكشاف والحيط، وحرّكوا اللعبة بس. علّموا طول الظل بكل مكان.', 'Fix the torch and wall, move only the toy and mark the shadow height at each spot.'),
      ai: "moving the object (the object's distance) does not change the shadow size",
    },
    light_distance_irrelevant: {
      label: t('مكان الضو ما بيهمّ', 'Light position is irrelevant'),
      mirror: t('هيك إنت شايفها: لو قرّبنا الكشاف أو بعّدناه، حجم الظل ما بيتغيّر.', 'This is how you see it: moving the torch closer or farther does not change the shadow size.'),
      observation: t('الكشاف القريب بيضوّي أقوى.', 'A close torch looks brighter.'),
      assumption: t('الضو بس بيضوّي، وما بيأثّر ع الحجم.', 'Light only lights things up; it does not affect size.'),
      conclusion: t('مكان الكشاف ما بيفرق.', "The torch's position makes no difference."),
      story: [t('الكشاف وظيفته يضوّي', "The torch's job is to give light"), t('قرّبناه أو بعّدناه، بس القوّة بتتغيّر', 'Closer or farther, only the brightness changes'), t('الظل بيضل نفس الحجم', 'The shadow keeps the same size')],
      wrongStep: 2,
      breaks: 'C4',
      model: { sources: ['light_distance_irrelevant'], path: 'from_object', requires: [] },
      intervention: t('ثبّتوا اللعبة والحيط، وحرّكوا الكشاف بس بعد ما يتوقّع.', 'Fix the toy and wall, let them predict, then move only the torch.'),
      ai: "moving the light source (the light's distance) does not change the shadow size",
    },
    farther_light_bigger: {
      label: t('ضو أبعد، ظل أكبر', 'Farther light, bigger shadow'),
      mirror: t('هيك إنت شايفها: كل ما بعّدنا الكشاف، الظل بيكبر.', 'This is how you see it: the farther we move the torch, the bigger the shadow.'),
      observation: t('بقعة الضو بتوسع لما نبعّد الكشاف.', 'The patch of light spreads when the torch moves away.'),
      assumption: t('الظل بيوسع متل بقعة الضو.', 'The shadow spreads like the patch of light.'),
      conclusion: t('أبعد يعني أكبر.', 'Farther means bigger.'),
      story: [t('منبعّد الكشاف', 'We move the torch away'), t('بقعة الضو بتوسع', 'The patch of light spreads'), t('والظل بيكبر معها', 'And the shadow grows with it')],
      wrongStep: 2,
      breaks: 'C4',
      model: { sources: ['farther_light_bigger'], path: 'light_stretches', requires: [] },
      intervention: t('علّموا ظل البداية بالقلم، وخلّيه يرسم وين برأيه رح يصير لما نبعّد الكشاف، وبعدين جرّبوا.', 'Mark the starting shadow, let them draw where they think it will go as the torch moves away, then test.'),
      ai: 'moving the light farther away makes the shadow bigger (or moving it closer makes the shadow smaller)',
    },
  },
  paths: {
    straight_rays: { label: t('الضو بيمشي دغري', 'Straight rays'), ai: 'light travels in straight lines from the source and is blocked' },
    shadow_copy: { label: t('الظل نسخة عن الغرض', 'A copy of the object'), ai: 'the shadow is a copy of the object' },
    from_object: { label: t('الظل تابع للغرض', 'Set by the object'), ai: 'the shadow size is fixed by the object itself' },
    light_stretches: { label: t('الضو البعيد بيمطّ الظل', 'A far light stretches it'), ai: 'a farther light spreads out and stretches the shadow' },
  },
  requires: { light: { label: t('بدها ضو', 'Needs light'), ai: 'a shadow needs a light source' } },
  correctModel: { sources: ['light_geometry'], path: 'straight_rays', requires: ['light'] },

  steps: [
    {
      text: t('الضو بيمشي من مصدره بخطوط مستقيمة.', 'Light travels from its source in straight lines.'),
      node: 'C1',
      test: STRAIGHT,
      noorSays: t('علّمتني إنه الضو بيمشي من الكشاف بخطوط مستقيمة.', 'You taught me that light travels from the torch in straight lines.'),
      noorAsks: t('كيف بيوصل الضو من الكشاف للحيط؟ شو شكل طريقه؟', 'How does the light get from the torch to the wall? What is its path like?'),
    },
    {
      text: t('الغرض بيحجب الضو، والظل هو المحل اللي ما بيوصله الضو.', 'The object blocks the light, and the shadow is where the light cannot reach.'),
      node: 'C3',
      test: BLOCKS,
      noorSays: t('وعلّمتني إنه الغرض بيحجب الضو، والظل هو المحل اللي ما بيوصله.', 'You also taught me that the object blocks the light and the shadow is where it cannot reach.'),
      noorAsks: t('ليش بيطلع محل معتم ورا الغرض؟', 'Why is there a dark patch behind the object?'),
    },
    {
      text: t('كل ما الغرض أقرب للضو مقارنة بالشاشة، ظله بيكبر.', 'The closer the object is to the light compared with the screen, the bigger its shadow.'),
      node: 'C4',
      test: anyOf(...AR_GEOMETRY, ...EN_GEOMETRY),
      noorSays: t('وعلّمتني إنه الغرض لما يقرب من الضو ويبعد عن الشاشة، ظله بيكبر.', 'And you taught me that when the object is closer to the light and farther from the screen, its shadow grows.'),
      noorAsks: t('شو اللي ممكن يغيّر حجم الظل إذا الغرض نفسه ما تغيّر؟', 'What could change the size of the shadow if the object itself does not change?'),
    },
  ],

  variables: [
    {
      id: 'light',
      label: t('من الكشاف للغرض', 'Torch to object'),
      options: [{ id: 'near', label: t('٢٠ سم', '20 cm') }, { id: 'mid', label: t('٤٠ سم', '40 cm') }, { id: 'far', label: t('٦٠ سم', '60 cm') }],
    },
    {
      id: 'screen',
      label: t('من الغرض للحيط', 'Object to screen'),
      options: [{ id: 'near', label: t('٢٠ سم', '20 cm') }, { id: 'mid', label: t('٤٠ سم', '40 cm') }, { id: 'far', label: t('٦٠ سم', '60 cm') }],
    },
    {
      id: 'size',
      label: t('طول الغرض', 'Object height'),
      options: [{ id: 'small', label: t('٥ سم', '5 cm') }, { id: 'mid', label: t('١٠ سم', '10 cm') }, { id: 'tall', label: t('١٥ سم', '15 cm') }],
    },
  ],
  baseline: { light: 'mid', screen: 'mid', size: 'mid' },
  experiments: [
    {
      id: 'S_light_near',
      name: t('نقرّب الكشاف من اللعبة', 'Bring the torch closer'),
      short: t('كشاف أقرب', 'Torch closer'),
      change: { light: 'near' },
      question: t('اللعبة والحيط ما تحرّكوا. قرّبنا الكشاف من اللعبة. شو بصير بالظل؟', 'The toy and wall stay put. We move the torch closer to the toy. What happens to the shadow?'),
      choices: ['bigger', 'smaller', 'same', 'equals_object'],
      minutes: 7,
      materials: ['flashlight', 'ruler', 'paper', 'small_objects'],
      safety: { adult: false, note: t('ما منوجّه الكشاف ع عيون حدا، وما منطّلع بالضو.', 'Never point the torch at anyone’s eyes and never look into the light.') },
      minGrade: 3,
      targets: ['C4'],
      home: {
        steps: [
          t('وقّف لعبة صغيرة ع بعد ٤٠ سم من الحيط.', 'Stand a small toy 40 cm from the wall.'),
          t('حط الكشاف ع بعد ٤٠ سم من اللعبة، وعلّم راس الظل وآخره ع ورقة.', 'Put the torch 40 cm from the toy and mark the top and bottom of the shadow on paper.'),
          t('قرّب الكشاف لحد ٢٠ سم من اللعبة. ما تحرّك غيره.', 'Move only the torch to 20 cm from the toy.'),
          t('علّم الظل الجديد وقيس التنين.', 'Mark the new shadow and measure both.'),
        ],
        record: t('قديش طول الظل قبل وبعد؟', 'How long was the shadow before and after?'),
        reflect: [t('شو الإشي الوحيد اللي تغيّر؟', 'What was the only thing that changed?'), t('ارسم خطوط من الكشاف لأطراف اللعبة. وين بتوصل؟', "Draw lines from the torch past the toy's edges. Where do they land?")],
      },
    },
    {
      id: 'S_light_far',
      name: t('نبعّد الكشاف عن اللعبة', 'Move the torch away'),
      short: t('كشاف أبعد', 'Torch farther'),
      change: { light: 'far' },
      question: t('اللعبة والحيط ما تحرّكوا. بعّدنا الكشاف عن اللعبة. شو بصير بالظل؟', 'The toy and wall stay put. We move the torch farther from the toy. What happens to the shadow?'),
      choices: ['bigger', 'smaller', 'same', 'equals_object'],
      minutes: 7,
      materials: ['flashlight', 'ruler', 'paper', 'small_objects'],
      safety: { adult: false, note: t('ما منطّلع بالضو. دير بالك وإنت ماشي بالعتمة.', 'Never look into the light. Take care moving in a darkened room.') },
      minGrade: 3,
      targets: ['C4'],
      home: {
        steps: [
          t('رتّب الكشاف واللعبة والحيط: ٤٠ سم و٤٠ سم.', 'Set torch, toy and wall 40 cm and 40 cm apart.'),
          t('علّم الظل ع ورقة.', 'Mark the shadow on paper.'),
          t('بعّد الكشاف لحد ٦٠ سم من اللعبة.', 'Move only the torch to 60 cm from the toy.'),
          t('علّم وقيس.', 'Mark and measure.'),
        ],
        record: t('قديش طول الظل بكل مرّة؟', 'How long was the shadow each time?'),
        reflect: [t('بقعة الضو شو صار فيها؟ والظل؟ قارنهم.', 'What happened to the patch of light, and to the shadow? Compare them.')],
      },
    },
    {
      id: 'S_screen_far',
      name: t('نبعّد الحيط عن اللعبة', 'Move the screen away'),
      short: t('حيط أبعد', 'Screen farther'),
      change: { screen: 'far' },
      question: t('الكشاف واللعبة ثابتين. بعّدنا الكرتونة (الشاشة) عن اللعبة. شو بصير بالظل؟', 'The torch and toy stay put. We move the card screen farther from the toy. What happens to the shadow?'),
      choices: ['bigger', 'smaller', 'same', 'equals_object'],
      minutes: 7,
      materials: ['flashlight', 'ruler', 'paper', 'small_objects'],
      safety: { adult: false, note: t('ما منوجّه الكشاف ع عيون حدا.', 'Never point the torch at anyone’s eyes.') },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          t('استعمل كرتونة بيضا بدل الحيط، ووقّفها ع كتب.', 'Use a white card as the screen, held up by books.'),
          t('ثبّت الكشاف واللعبة بلزقة.', 'Tape the torch and toy in place.'),
          t('قيس الظل والكرتونة ع بعد ٤٠ سم، وبعدين ٦٠ سم.', 'Measure the shadow with the card at 40 cm, then at 60 cm.'),
        ],
        record: t('قديش طول الظل بالمكانين؟', 'How long was the shadow in each place?'),
        reflect: [t('اللعبة ما تغيّرت. ليش الظل مش متل قبل؟', 'The toy did not change. Why is the shadow different?')],
      },
    },
    {
      id: 'S_screen_near',
      name: t('نقرّب الحيط من اللعبة', 'Move the screen closer'),
      short: t('حيط أقرب', 'Screen closer'),
      change: { screen: 'near' },
      question: t('الكشاف واللعبة ثابتين. قرّبنا الكرتونة (الشاشة) من اللعبة. شو بصير بالظل؟', 'The torch and toy stay put. We move the card screen closer to the toy. What happens to the shadow?'),
      choices: ['bigger', 'smaller', 'same', 'equals_object'],
      minutes: 6,
      materials: ['flashlight', 'ruler', 'paper', 'small_objects'],
      safety: { adult: false, note: t('ما منطّلع بالضو.', 'Never look into the light.') },
      minGrade: 3,
      targets: ['C4'],
      home: {
        steps: [
          t('ثبّت الكشاف واللعبة، وابدا والكرتونة ع بعد ٤٠ سم.', 'Fix torch and toy, starting with the card 40 cm away.'),
          t('قرّب الكرتونة لحد ٢٠ سم من اللعبة.', 'Move the card to 20 cm from the toy.'),
          t('قيس الظل قبل وبعد.', 'Measure the shadow before and after.'),
        ],
        record: t('قديش صار طول الظل؟ وقديش طول اللعبة؟', 'How long is the shadow now, and how tall is the toy?'),
        reflect: [t('لو لزقنا الكرتونة باللعبة تقريباً، شو بتتوقّع؟', 'If the card almost touched the toy, what would you expect?')],
      },
    },
    {
      id: 'S_tall',
      name: t('لعبة أطول', 'A taller object'),
      short: t('غرض أطول', 'Taller object'),
      change: { size: 'tall' },
      question: t('كل إشي بمطرحه، بس بدّلنا اللعبة بوحدة أطول. شو بصير بالظل؟', 'Everything stays put, but we swap in a taller toy. What happens to the shadow?'),
      choices: ['bigger', 'smaller', 'same', 'equals_object'],
      minutes: 6,
      materials: ['flashlight', 'ruler', 'paper', 'small_objects', 'scissors'],
      safety: { adult: false, note: t('منقص الكرتون بمقص آمن.', 'Cut card with safety scissors.') },
      minGrade: 3,
      targets: ['C2', 'C3'],
      home: {
        steps: [
          t('قص شكلين من كرتون: واحد ١٠ سم وواحد ١٥ سم.', 'Cut two card shapes, 10 cm and 15 cm tall.'),
          t('حطّهم بنفس المطرح واحد ورا التاني.', 'Put each in turn in exactly the same spot.'),
          t('قيس ظل كل واحد.', "Measure each one's shadow."),
        ],
        record: t('طول كل شكل، وطول ظله.', "Each shape's height and its shadow's height."),
        reflect: [t('كيف تغيّر الظل لما تغيّر طول الشكل؟', 'How did the shadow change when the height changed?')],
      },
    },
    {
      id: 'S_move_object',
      name: t('نحرّك اللعبة صوب الكشاف', 'Slide the object toward the torch'),
      short: t('نحرّك اللعبة', 'Move the object'),
      change: { light: 'near', screen: 'far' },
      question: t('الكشاف والحيط ثابتين. حرّكنا اللعبة وقرّبناها من الكشاف. شو بصير بالظل؟', 'The torch and wall stay put. We slide the toy toward the torch. What happens to the shadow?'),
      choices: ['bigger', 'smaller', 'same', 'equals_object'],
      minutes: 8,
      materials: ['flashlight', 'ruler', 'paper', 'small_objects', 'screen'],
      safety: { adult: false, note: t('ما منطّلع بضو الكشاف أو جهاز العرض.', 'Never look into a torch or projector beam.') },
      minGrade: 3,
      targets: ['C4', 'C5'],
      home: {
        steps: [
          t('حط الكشاف ع بعد ٨٠ سم من الحيط، وما تحرّكهم.', 'Put the torch 80 cm from the wall and leave both there.'),
          t('وقّف اللعبة بالنص وعلّم الظل.', 'Stand the toy halfway and mark the shadow.'),
          t('قرّبها لحد ٢٠ سم من الكشاف وعلّم.', 'Slide it to 20 cm from the torch and mark again.'),
          t('وقرّبها من الحيط وعلّم كمان مرّة.', 'Then slide it near the wall and mark once more.'),
        ],
        record: t('رتّب التلات أماكن من أكبر ظل لأصغر ظل.', 'Order the three spots from biggest shadow to smallest.'),
        reflect: [t('اللعبة بأي مطرح بتسدّ ضو أكتر؟ ارسمها.', 'In which spot does the toy cut off more of the light? Draw it.')],
      },
    },
  ],
  outcomes: {
    bigger: t('الظل بيكبر', 'The shadow gets bigger'),
    smaller: t('الظل بيصغر', 'The shadow gets smaller'),
    same: t('الظل بيضل متل ما كان', 'The shadow stays as it was'),
    equals_object: t('الظل قد الغرض بالزبط', 'The shadow is exactly the size of the object'),
  },
  kidOutcome,
  realOutcome,
  measure,

  noor: {
    greeting: t('أهلاً! أنا نور. شوف: نفس اللعبة، ومرّة ظلها كبير ومرّة صغير! احكيلي بكلامك: ليش؟', "Hi! I'm Noor. Look: the same toy, yet sometimes its shadow is big and sometimes small! Tell me in your own words: why?"),
    invite: t('فهمت فكرتك! يلا نفحصها. توقّع شو بصير، وبعدين منجرّب.', "I got your idea! Let's test it. Predict what will happen, then we try."),
    afterContradiction: t('اللي صار غير اللي توقّعته فكرتك. يعني في إشي ناقص. شو برأيك بيغيّر حجم الظل هلأ؟', 'The result is not what your idea predicted, so something is missing. What do you think changes the shadow now?'),
    afterMatch: t('هالمرّة فكرتك صمدت. جرّب تغيّر إشي تاني، أو عدّل فكرتك إذا بدك.', 'Your idea held up this time. Change something else, or update your idea if you like.'),
    sameResult: t('فكرتك والتجربة أعطوا نفس النتيجة. هاي التجربة ما بتفرّق. جرّب تغيّر إشي تاني.', 'Your idea and the test gave the same result. This test cannot tell them apart. Change something else.'),
    praise: t('واو! شرحك كامل وواضح. بتعلّمني إنت هلأ؟', 'Wow! Your explanation is complete and clear. Will you teach me now?'),
    partial: t('في إشي حلو بشرحك! بس لسا ناقصني جزء. احكيلي أكتر.', 'There is something good in your explanation! I am still missing a piece. Tell me more.'),
    contradiction: t('سمعت منك فكرتين بيعاكسوا بعض. أي وحدة بتختار؟ وليش؟', 'I heard two ideas that disagree. Which one do you choose, and why?'),
    offtopic: t('حلو! بس خلّينا نرجع للظل. شو برأيك بيكبّره أو بيصغّره؟', "Nice! But let's get back to the shadow. What do you think makes it bigger or smaller?"),
    unsupported: t('فكرة بتفتح العين! ما بقدر أجرّبها هون. احكيلي عن الظل بطريقة تانية، أو اسأل معلّمك.', "That's an interesting idea! I can't test it here. Tell me about the shadow another way, or ask your teacher."),
  },
  hints: [
    t('ارجع لفكرتك. لو هي صح، شو لازم يصير لما نحرّك إشي بالتجربة؟', 'Go back to your idea. If it is right, what should happen when we move something?'),
    t('انتبه ع تلات إشيا: الكشاف، واللعبة، والحيط. أي واحد تحرّك؟ وشو صار بالظل؟', 'Watch three things: the torch, the toy and the wall. Which one moved, and what did the shadow do?'),
    t('ارسمهم من الجنب. حط المسطرة من الكشاف ع راس اللعبة ومدّها للحيط. وين بتوصل؟', "Draw them from the side. Lay a ruler from the torch over the toy's top and on to the wall. Where does it end?"),
    t('الضو بيمشي بخطوط مستقيمة، واللعبة بتحجب جزء منه فبيطلع ظل. لما تقرب من الكشاف بتحجب جزء أوسع من الضو، فالظل بيكبر. احكيها بكلامك.', 'Light travels in straight lines, and the toy blocks part of it, making a shadow. Closer to the torch it blocks a wider fan of light, so the shadow grows. Say it in your own words.'),
  ],
  clarify: [
    { id: 'what_changes', q: t('احكيلي أكتر: شو برأيك بيغيّر حجم الظل؟', 'Tell me more: what do you think changes the size of the shadow?'), ai: 'open question: what changes the shadow size?' },
    { id: 'move_torch', q: t('لو قرّبنا الكشاف من اللعبة، شو بتتوقّع يصير بالظل؟ وليش؟', 'If we move the torch closer to the toy, what do you expect the shadow to do, and why?'), ai: 'prediction when the torch moves closer' },
    { id: 'move_wall', q: t('ولو ما تحرّك إشي غير الحيط، شو بصير بالظل؟', 'And if only the wall moves, what happens to the shadow?'), ai: 'prediction when only the screen moves' },
    { id: 'how_forms', q: t('كيف برأيك بيتكوّن المحل المعتم ورا اللعبة؟', 'How do you think the dark patch behind the toy forms?'), ai: 'how does the shadow form?' },
  ],
  answerWords: /مستقيم|دغري|بيحجب|يحجب|بتحجب|حاجب|مسافة|مسافه|المسافات|straight|\bblock(?:s|ed|ing)?\b|distances?/i,
  teach: {
    planted: t('فهمت! يعني لو بعّدنا الكشاف عن اللعبة، الظل بيصير أكبر. صح؟', 'I see! So if we move the torch farther from the toy, the shadow gets bigger. Right?'),
    truth: 'Moving the light farther from the object makes the shadow smaller: the object then blocks a narrower fan of the straight light rays.',
    accept: new RegExp(
      '^(?=[\\s\\S]*(?:' +
        /(?<![ء-ي])(?:لا|مش|مو|غلط|خطا|بالعكس|العكس|مستحيل|ما بيكبر)(?![ء-ي])|اصغر|بيصغر|بصغر|\bno\b|\bnope\b|\bnot\b|n't\b|wrong|incorrect|opposite|smaller/.source +
        '))(?=[\\s\\S]*(?:' +
        anyOf(
          /خطوط|(?<![ء-ي])(?:ب|ال)?خط(?![ء-ي])|اشعه|شعاع|دغري|بيحجب|بتحجب|يحجب|حاجب|بيسد|بتسد|يسد|بيمنع|بتمنع|بتوقف|بيوقف/,
          /(?<![ء-ي])(?:لان|لانه|لانها|لانو|عشان|علشان|مشان)[^.؟!]{0,60}?(?:ضو|ضوء|كشاف|لمبه|نور|بعيد|بعد|ابعد|قريب|قرب|اقرب|حيط|شاشه|لعبه|غرض)/,
          /(?:اقرب|قريب|قرب)\S* [^.؟!]{0,30}?(?:بيكبر|اكبر|بكبر)/,
          /straight|\brays?\b|block|spread/,
          /because[^.?!]{0,70}?(?:light|torch|lamp|far|close|near|screen|wall|toy|object)/,
          /(?:closer|nearer)[^.?!]{0,35}?(?:bigger|larger)/,
        ).source +
        '))',
    ),
    reject: anyOf(
      /^(?:اه|اها|ايوه|ايوا|نعم|صح|صحيح|مزبوط|مظبوط|اكيد|طبعا|يس|yes|yeah|yep|right|true|correct|sure|of course)(?![ء-يa-z])/,
      /^(?!(?:لا|مش|غلط|بالعكس|مستحيل|no|nope|wrong|not)(?![ء-يa-z]))[\s\S]*?(?:(?:نبعد|منبعد|بنبعد|بعدنا|بعد الكشاف|ابعد)[^.؟!]{0,25}?(?<!ما )(?<!مش )(?:بيكبر|يكبر|بصير اكبر|بيصير اكبر)|(?:farther|further|away)(?:(?!closer|smaller|\bnot\b|n't)[^.?!]){0,35}?(?:bigger|larger))/,
    ),
    thanks: t('آه! لما نبعّد الكشاف، اللعبة بتحجب جزء أضيق من الضو، فالظل بيصغر. هلأ فهمت، شكراً يا معلّمي!', 'Oh! With the torch farther away the toy blocks a narrower fan of light, so the shadow shrinks. Now I get it, thank you, teacher!'),
    confused: t('لسا محتارة… لما نبعّد الكشاف، الظل بيكبر ولا بيصغر؟ وليش؟', "I'm still puzzled... when the torch moves away, does the shadow grow or shrink? And why?"),
  },
  challenge: {
    phenomenon: t('بمسرح الظل، أرنب صغير من كرتون طلع ظله ع الستارة كبير كتير. كيف هيك؟', 'In a shadow theatre a small card rabbit casts a very big shadow on the curtain. How can that be?'),
    solved: t('الضو بيمشي بخطوط مستقيمة، والأرنب بيحجب جزء منه. الأرنب قريب من اللمبة وبعيد عن الستارة، عشان هيك ظله طالع كبير.', 'Light travels in straight lines and the rabbit blocks part of it. The rabbit is close to the lamp and far from the curtain, so its shadow is big.'),
  },
  transfer: {
    prompt: t('بالصف، لما طالب يمرق جنب جهاز العرض بيغطّي ظله الشاشة كلها، ولما يمرق جنب الشاشة ظله بيطلع قريب من حجمه. فسّر بكلامك: ليش؟', 'In class, a pupil passing near the projector casts a shadow that covers the whole screen, but near the screen the shadow is close to their own size. Explain in your own words why.'),
    check: {
      id: 'tr_hand',
      q: t('بدك ظل إيدك ع الحيط يصغر، والكشاف والحيط ثابتين. شو بتعمل؟', 'You want your hand shadow on the wall to shrink, with torch and wall fixed. What do you do?'),
      options: [t('بقرّب إيدي من الحيط', 'Move my hand toward the wall'), t('بقرّب إيدي من الكشاف', 'Move my hand toward the torch'), t('بطفي الكشاف وبشعّله', 'Switch the torch off and on')],
      correct: 0,
      node: 'C4',
    },
  },

  rules: [
    {
      idea: 'light_geometry',
      re: anyOf(...AR_GEOMETRY, ...EN_GEOMETRY, STRAIGHT),
    },
    {
      idea: 'object_size_only',
      re: anyOf(
        re(`(?<!${A})(?:بس|فقط) [^.؟!]{0,16}?(?:حجم|كبر|طول|قياس) (?:ال)?(?:غرض|لعبه|اشي|شي|جسم)`),
        re(`(?:حجم|كبر|طول|قياس) (?:ال)?(?:غرض|لعبه|اشي|جسم) (?:بس|وبس|فقط)`),
        re(`${SHADOW} [^.؟!]{0,14}?(?:حسب|بيعتمد|يعتمد|معتمد|تابع) (?:علي |ع )?(?:بس )?(?:حجم|كبر|طول|قياس) (?:ال)?(?:غرض|لعبه|اشي|شي|جسم)`),
        re(`(?:غرض|لعبه|اشي|جسم) (?:ال)?(?:كبير|كبيره|طويل|طويله) [^.؟!]{0,10}?${SHADOW} (?:\\S+ )?(?:كبير|اكبر|طويل)`),
        re(`${SHADOW} [^.؟!]{0,10}?(?:بيكبر|يكبر|بيتغير|بتغير) (?:بس|الا) [^.؟!]{0,6}?(?:اذا|لما|لو) [^.؟!]{0,14}?(?:غرض|لعبه|اشي|جسم)`),
        /(?:depends?|decided) (?:only |just |entirely )?(?:up)?on (?:the |its )?(?:size|height) of (?:the |a )?(?:object|toy|thing)|(?:depends?) (?:only |just )(?:up)?on (?:the |its )?(?:object|toy|thing|size)(?!(?:'s)? (?:distance|position|place))/,
        /only (?:the )?(?:size|height) of the (?:object|toy|thing)|only (?:a )?(?:bigger|larger|taller) (?:object|toy|thing)|(?:bigger|larger|big|taller) (?:object|toy|thing)s? (?:\w+ ){0,3}?(?:bigger|larger|big|longer|taller) shadows?/,
      ),
    },
    {
      idea: 'same_as_object',
      re: anyOf(
        re(`${SHADOW} [^.؟!]{0,16}?(?:قد|بقد|علي قد|نفس (?:حجم|قياس|طول|كبر)|زي حجم|متل حجم) (?:ال)?(?:غرض|لعبه|اشي|شي|جسم|ايد)`),
        re(`${SHADOW} [^.؟!]{0,12}?(?:قده|قدها|قدي|نفس حجمه|نفس حجمها|نفس طوله|نفس طولها|نفس قياسه)(?!${A})`),
        /نفس (?:حجم|قياس|طول) (?:ال)?(?:غرض|لعبه|اشي|جسم)|(?:ال)?(?:ظل|ضل|خيال)\S* [^.؟!]{0,8}?نسخه/,
        /same (?:size|height|length) as (?:the |its |my |your )?(?:object|toy|thing|hand|puppet|it\b)/,
        /shadow(?: \w+){0,3}? (?:as (?:big|tall|large|long) as|equal to|equals) (?:the |its |my |your )?(?:object|toy|thing|hand|puppet|it\b)|shadow is (?:just |only )?a copy/,
      ),
    },
    {
      idea: 'object_distance_irrelevant',
      re: anyOf(
        re(`${PRE}(?:قرب|بعد(?!ين)|حرك|نقل|مكان)\\S* (?:(?!من |عن )[^.؟!]){0,8}?${OBJ}${NOT_ABOUT_OBJECT}(?:${NEG_VERB}|${STAYS_AR})`),
        re(`(?:مش مهم|ما بيهم|ما بيفرق|ما بتفرق|ما بياثر|ما في فرق) [^.؟!]{0,6}?(?:وين|مكان|قديش بعيد|قديش قريب) ${OBJ}`),
        re(`(?:مكان|بعد|موقع) ${OBJ} (?:\\S+ )?${NEG_VERB}`),
        /(?:moving|move[sd]?|bringing) (?:the |a |my )?(?:object|toy|thing|hand|puppet)(?:(?!bigger|smaller|larger|grows|shrinks)[^.?!]){0,40}?(?:doesn't|does not|do not|don't|won't|will not|never|not) (?:\w+ )?(?:change|matter|affect|make)(?! (?:its|the (?:object|toy)(?:'s)?) size)/,
        /(?:object|toy|thing)(?:'s)? (?:distance|position|place|location) (?:\w+ )?(?:doesn't|does not|never) (?:\w+ )?(?:change|matter|affect)|(?:doesn't|does not) matter (?:where|how (?:far|close|near)) (?:the |your |a )?(?:object|toy|thing|hand|puppet)/,
        /(?:moving|move[sd]?) (?:the |a )?(?:object|toy|thing|hand|puppet)(?:(?!bigger|smaller|larger|grows|shrinks)[^.?!]){0,40}?(?:shadow )(?:\w+ )?(?:same size|stays? the same)/,
      ),
    },
    {
      idea: 'light_distance_irrelevant',
      re: anyOf(
        re(`${PRE}(?:قرب|بعد(?!ين)|حرك|نقل|مكان)\\S* (?:(?!من |عن )[^.؟!]){0,8}?${LIGHT}${NOT_ABOUT_OBJECT}(?:${NEG_VERB}|${STAYS_AR})`),
        re(`(?:مش مهم|ما بيهم|ما بيفرق|ما بتفرق|ما بياثر|ما في فرق) [^.؟!]{0,6}?(?:وين|مكان|قديش بعيد|قديش قريب) ${LIGHT}`),
        re(`(?:مكان|بعد|موقع) ${LIGHT} (?:\\S+ )?${NEG_VERB}`),
        /(?:moving|move[sd]?|bringing) (?:the |a |my )?(?:light|torch|lamp|flashlight)(?:(?!bigger|smaller|larger|grows|shrinks)[^.?!]){0,40}?(?:doesn't|does not|do not|don't|won't|will not|never|not) (?:\w+ )?(?:change|matter|affect|make)(?! (?:its|the (?:object|toy)(?:'s)?) size)/,
        /(?:light|torch|lamp|flashlight)(?:'s)? (?:distance|position|place|location) (?:\w+ )?(?:doesn't|does not|never) (?:\w+ )?(?:change|matter|affect)|(?:doesn't|does not) matter (?:where|how (?:far|close|near)) (?:the |your |a )?(?:light|torch|lamp|flashlight)/,
        /(?:moving|move[sd]?) (?:the |a )?(?:light|torch|lamp|flashlight)(?:(?!bigger|smaller|larger|grows|shrinks)[^.?!]){0,40}?(?:shadow )(?:\w+ )?(?:same size|stays? the same)/,
      ),
    },
    {
      idea: 'farther_light_bigger',
      re: anyOf(
        // farther light → bigger
        re(`${PRE}(?:بعد(?!ين)|بعيد)\\S{0,3} (?:(?!من |عن )[^.؟!]){0,6}?${LIGHT}${gap(30, NOT_SMALL)}${BIGGER}`),
        re(`${PRE}(?:بعد(?!ين)|بعيد)\\S{0,3} ${OBJ} (?:من|عن) ${LIGHT}${gap(30, NOT_SMALL)}${BIGGER}`),
        re(`${LIGHT} [^.؟!]{0,10}?(?:ابعد|بعيد|يبعد|بيبعد|بعد)${gap(30, NOT_SMALL)}${BIGGER}`),
        re(`${BIGGER}${gap(30, NOT_SMALL)}(?:بعد(?!ين)|بعيد)\\S{0,3} (?:(?!من |عن )[^.؟!]){0,6}?${LIGHT}`),
        // closer light → smaller (the same belief said the other way round)
        re(`${PRE}(?:قرب|قريب)\\S{0,3} (?:(?!من |عن )[^.؟!]){0,6}?${LIGHT}${gap(30, NOT_BIG)}${SMALLER}`),
        re(`${SMALLER}${gap(30, NOT_BIG)}(?:قرب|قريب)\\S{0,3} (?:(?!من |عن )[^.؟!]){0,6}?${LIGHT}`),
        /(?:farther|further)(?:(?!screen|wall|closer|nearer)[^.?!]){0,28}?(?:light|torch|lamp|flashlight)(?:(?!smaller|\bnot\b|n't)[^.?!]){0,45}?(?:bigger|larger|grows|longer)/,
        /(?:light|torch|lamp|flashlight)(?:(?!screen|wall|smaller|closer|\bnot\b|n't)[^.?!]){0,20}?(?:farther|further|far away|far)(?:(?!smaller|closer|\bnot\b|n't)[^.?!]){0,45}?(?:bigger|larger|grows|longer)/,
        /(?:move|moving|moved|pull|pulling|take|taking) (?:the |a )?(?:light|torch|lamp|flashlight) (?:away|back|farther|further)(?:(?!smaller|\bnot\b|n't)[^.?!]){0,45}?(?:bigger|larger|grows|longer)/,
        /(?:bigger|larger)(?:(?!smaller|screen|wall|closer|\bnot\b|n't)[^.?!]){0,30}?(?:light|torch|lamp|flashlight)(?:(?!closer|smaller|screen|wall|\bnot\b)[^.?!]){0,15}?(?:farther|further|far|away|back)(?![a-z])/,
        /(?:bigger|larger)(?:(?!smaller|\bnot\b|n't)[^.?!]){0,30}?(?:farther|further) (?:away )?(?:from )?(?:the |a )?(?:light|torch|lamp|flashlight)/,
        /(?:light|torch|lamp|flashlight)(?:(?!screen|wall|bigger|\bnot\b|n't)[^.?!]){0,12}?(?:closer|nearer)(?:(?!bigger|larger|\bnot\b|n't)[^.?!]){0,40}?smaller/,
      ),
    },
  ],
  samples: [
    t('الضو بيمشي دغري واللعبة بتسدّ الضو، ولما نقرّبها من الكشاف الظل بيكبر', 'Light travels in straight lines, the toy blocks it, and closer to the torch the shadow gets bigger'),
    t('حجم الظل بس حسب حجم الغرض', 'The shadow size depends only on the size of the object'),
    t('الظل قد الغرض بالزبط', 'The shadow is the same size as the object'),
    t('لو قرّبنا اللعبة أو بعّدناها الظل ما بتغيّر', 'Moving the object closer does not change the shadow'),
    t('لو قرّبنا الكشاف أو بعّدناه الظل ما بتغيّر', 'Moving the torch does not change the shadow size'),
    t('كل ما بعّدنا الكشاف الظل بيكبر', 'The farther the light, the bigger the shadow'),
  ],
  preTest: [
    {
      id: 'pre1',
      q: t('كشاف ولعبة وحيط. قرّبنا الكشاف من اللعبة. شو بصير بالظل؟', 'A torch, a toy and a wall. We move the torch closer to the toy. What does the shadow do?'),
      options: [t('بيكبر', 'Gets bigger'), t('بيصغر', 'Gets smaller'), t('ما بيتغيّر', 'Does not change')],
      correct: 0,
      node: 'C4',
    },
    {
      id: 'pre2',
      q: t('شو هو الظل؟', 'What is a shadow?'),
      options: [t('لون أسود بيطلع من الغرض', 'A black colour coming out of the object'), t('محل ما بيوصله الضو لأنه في إشي حاجبه', 'A place light does not reach because something blocks it'), t('صورة مرسومة ع الحيط', 'A picture drawn on the wall')],
      correct: 1,
      node: 'C3',
    },
    {
      id: 'pre3',
      q: t('الكشاف واللعبة ثابتين، وبعّدنا الحيط عن اللعبة. الظل...', 'Torch and toy stay put and we move the wall farther from the toy. The shadow...'),
      options: [t('بيكبر', 'gets bigger'), t('بيصغر', 'gets smaller'), t('بيضل متل ما هو', 'stays as it was')],
      correct: 0,
      node: 'C4',
    },
    {
      id: 'pre4',
      q: t('كيف بيمشي الضو من الكشاف؟', 'How does light travel from a torch?'),
      options: [t('بيلفّ حوالين الأغراض', 'It curves around objects'), t('بخطوط مستقيمة', 'In straight lines'), t('ما بيتحرّك أبداً', 'It does not travel at all')],
      correct: 1,
      node: 'C1',
    },
  ],
  postTest: [
    {
      id: 'post1',
      q: t('بمسرح الظل بدك تعمل تنّين ضخم من دمية صغيرة. وين بتحط الدمية؟', 'In a shadow theatre you want a huge dragon from a small puppet. Where do you hold the puppet?'),
      options: [t('قريبة من اللمبة وبعيدة عن الستارة', 'Near the lamp and far from the curtain'), t('لازقة بالستارة', 'Touching the curtain'), t('المكان ما بيفرق', 'The place makes no difference')],
      correct: 0,
      node: 'C4',
    },
    {
      id: 'post2',
      q: t('لمبة الغرفة شغّالة وإيدك فوق الطاولة. كل ما تنزّل إيدك صوب الطاولة، ظلها...', "The ceiling lamp is on and your hand is above the table. As you lower your hand toward the table, its shadow..."),
      options: [t('بيكبر أكتر وأكتر', 'grows and grows'), t('بيصغر ويقرب من حجم إيدك', 'shrinks toward the size of your hand'), t('ما بيتغيّر أبداً', 'never changes')],
      correct: 1,
      node: 'C4',
    },
    {
      id: 'post3',
      q: t('حطّيت شنطة قدّام لمبة. ليش صار محل معتم وراها؟', 'You place a bag in front of a lamp. Why is there a dark patch behind it?'),
      options: [t('لأنه الضو بيمشي دغري والشنطة حاجبته', 'Because light goes straight and the bag blocks it'), t('لأنه الشنطة طلّعت لون أسود', 'Because the bag gave out a black colour'), t('لأنه اللمبة ضعفت', 'Because the lamp got weaker')],
      correct: 0,
      node: 'C3',
    },
    {
      id: 'post4',
      q: t('ممكن كرتونة صغيرة تعمل ظل قد ظل كرتونة أكبر منها؟', 'Can a small card make a shadow as big as that of a larger card?'),
      options: [t('آه، إذا حطّيناها أقرب للضو', 'Yes, if we put it closer to the light'), t('لأ، مستحيل', 'No, never'), t('بس إذا دهنّاها أسود', 'Only if we paint it black')],
      correct: 0,
      node: 'C5',
    },
  ],
  activities: {
    _default: {
      type: 'experiment',
      title: t('محقّقين الظل', 'Shadow detectives'),
      goal: t('كل مجموعة تفحص شو بيغيّر حجم الظل وتشرح ليش.', 'Each group tests what changes shadow size and explains why.'),
      grouping: t('مجموعات من ٣: حامل كشاف، وقيّاس، وكاتب', 'Groups of 3: torch holder, measurer, recorder'),
      materials: ['flashlight', 'ruler', 'paper', 'small_objects'],
      steps: [
        { minutes: 3, title: t('توقّعات', 'Predictions'), detail: t('كل طالب بيكتب: شو بيكبّر الظل؟', 'Each learner writes what makes a shadow bigger.') },
        { minutes: 7, title: t('قيسوا', 'Measure'), detail: t('بكل مرّة بيحرّكوا إشي واحد (الكشاف، اللعبة، أو الحيط) وبيقيسوا الظل.', 'Move one thing at a time (torch, toy or wall) and measure the shadow.') },
        { minutes: 3, title: t('ارسموا', 'Draw'), detail: t('رسمة من الجنب بالمسطرة: خطوط من الضو ع أطراف اللعبة.', "A side drawing with a ruler: lines from the light past the toy's edges.") },
        { minutes: 2, title: t('بطاقة خروج', 'Exit ticket'), detail: t('جملة: ليش تغيّر الظل واللعبة نفسها؟', 'One sentence: why did the shadow change with the same toy?') },
      ],
      teacher: t('عتّموا الصف شوي. ذكّروهم: ما حدا يطّلع بالضو.', 'Dim the room. Remind them never to look into the light.'),
      check: t('كيف منعمل أكبر ظل ممكن بنفس اللعبة؟', 'How can we make the biggest possible shadow with the same toy?'),
      adapt: t('للي بحاجة دعم: جدول جاهز فيه رسمة لكل مطرح. بدون كشافات: فلاش التلفون بإيد المعلّم.', 'For support: a ready table with a picture per position. No torches: the teacher holds a phone flash.'),
    },
    _enrich: {
      type: 'game',
      title: t('تحدّي نفس الظل', 'The matching-shadow challenge'),
      goal: t('نخلّي غرضين بطولين مختلفين يعملوا ظلين متل بعض، ونتوقّع بالأرقام.', 'Make two objects of different heights cast equal shadows and predict with numbers.'),
      grouping: t('أزواج', 'Pairs'),
      materials: ['flashlight', 'ruler', 'grid_paper', 'scissors', 'paper'],
      steps: [
        { minutes: 3, title: t('التحدّي', 'The challenge'), detail: t('كرتونة ٥ سم وكرتونة ١٠ سم: كيف ظلهم بيطلع نفس الطول؟', 'A 5 cm card and a 10 cm card: how can their shadows match?') },
        { minutes: 5, title: t('ارسم وتوقّع', 'Draw and predict'), detail: t('ع ورق المربّعات: الضو، الكرتونة، الشاشة، وخطوط دغري.', 'On grid paper: light, card, screen and straight lines.') },
        { minutes: 5, title: t('جرّب', 'Test'), detail: t('نفّذوا التوقّع وقيسوا. قديش طلع الفرق؟', 'Carry out the prediction and measure. How close was it?') },
        { minutes: 2, title: t('قاعدة', 'A rule'), detail: t('اكتبوا قاعدة: إذا بعد الغرض عن الضو نص بعد الشاشة، الظل قديش؟', 'Write a rule: if the object is halfway to the screen, how big is the shadow?') },
      ],
      teacher: t('خلّيهم يلاحظوا إنه بنص الطريق الظل ضعف طول الغرض.', 'Lead them to notice that halfway gives double the height.'),
      check: t('وين بتحط كرتونة ٥ سم عشان ظلها يصير ٢٠ سم؟', 'Where do you put a 5 cm card so its shadow is 20 cm?'),
      adapt: t('للمتقدّمين: استعملوا الظل ليحسبوا طول غرض مخبّى.', 'For stretch: use a shadow to work out the height of a hidden object.'),
    },
    object_size_only: {
      type: 'experiment',
      title: t('نفس اللعبة، ظلال كتيرة', 'One toy, many shadows'),
      goal: t('نبيّن إنه في إشي غير حجم الغرض بيغيّر الظل.', 'Show that something other than object size changes the shadow.'),
      grouping: t('مجموعات من ٣', 'Groups of 3'),
      materials: ['flashlight', 'ruler', 'paper', 'small_objects'],
      steps: [
        { minutes: 3, title: t('توقّع', 'Predict'), detail: t('بتقدروا تغيّروا الظل بدون ما تغيّروا اللعبة؟', 'Can you change the shadow without changing the toy?') },
        { minutes: 7, title: t('تلات ظلال', 'Three shadows'), detail: t('نفس اللعبة: تلات أماكن للكشاف، وبيعلّموا الظل بكل مرّة.', 'Same toy, three torch positions, marking each shadow.') },
        { minutes: 3, title: t('قارنوا', 'Compare'), detail: t('اللعبة متل ما هي. شو اللي تغيّر؟', 'The toy is unchanged. What did change?') },
        { minutes: 2, title: t('فكرة جديدة', 'Updated idea'), detail: t('أكمل: حجم الظل بيعتمد ع... و...', 'Finish: shadow size depends on... and on...') },
      ],
      teacher: t('خلّوا طالب يقيس اللعبة كل مرّة عشان يأكّد إنها ما تغيّرت.', 'Have a pupil measure the toy each time to confirm it is unchanged.'),
      check: t('اعطيني طريقتين لتكبّر الظل بدون ما تكبّر اللعبة.', 'Give two ways to enlarge the shadow without a bigger toy.'),
      adapt: t('للي بحاجة دعم: علامات جاهزة ع الطاولة لمطارح الكشاف.', 'For support: pre-marked torch positions on the table.'),
    },
    same_as_object: {
      type: 'experiment',
      title: t('قيس اللعبة وقيس ظلها', 'Measure the toy and its shadow'),
      goal: t('نقارن طول الغرض بطول ظله.', "Compare the object's height with its shadow's height."),
      grouping: t('أزواج', 'Pairs'),
      materials: ['flashlight', 'ruler', 'paper', 'small_objects'],
      steps: [
        { minutes: 3, title: t('توقّع', 'Predict'), detail: t('إذا اللعبة ١٠ سم، قديش رح يكون ظلها؟', 'If the toy is 10 cm tall, how long will its shadow be?') },
        { minutes: 6, title: t('قيس', 'Measure'), detail: t('اللعبة بالنص بين الكشاف والحيط. قيسوها وقيسوا الظل.', 'Place the toy halfway between torch and wall. Measure both.') },
        { minutes: 4, title: t('متى قريبين؟', 'When are they close?'), detail: t('حرّكوا اللعبة صوب الحيط. متى الظل بيقرب من طولها؟', 'Slide the toy toward the wall. When does the shadow approach its height?') },
        { minutes: 2, title: t('بطاقة خروج', 'Exit ticket'), detail: t('جملة: هل الظل دايماً قد الغرض؟', 'One sentence: is a shadow always the size of its object?') },
      ],
      teacher: t('الرقمين جنب بعض ع اللوح بيوضّحوا الفرق.', 'Writing the two numbers side by side on the board makes the gap clear.'),
      check: t('متى ممكن الظل يطلع قريب من حجم الغرض؟', 'When can the shadow be close to the size of the object?'),
      adapt: t('للي بحاجة دعم: يقصّوا خيط بطول اللعبة ويقارنوه بالظل.', 'For support: cut a string to the toy height and hold it against the shadow.'),
    },
    farther_light_bigger: {
      type: 'peer',
      title: t('بقعة الضو ولا الظل؟', 'The light patch or the shadow?'),
      goal: t('نميّز بين بقعة الضو اللي بتوسع وبين الظل اللي بيصغر لما نبعّد الكشاف.', 'Distinguish the spreading patch of light from the shrinking shadow as the torch moves away.'),
      grouping: t('أزواج، كل واحد بيتوقّع ويقنع التاني', 'Pairs who predict and persuade each other'),
      materials: ['flashlight', 'ruler', 'paper', 'small_objects', 'string'],
      steps: [
        { minutes: 3, title: t('توقّعين', 'Two predictions'), detail: t('كل واحد بيرسم: لو بعّدنا الكشاف، شو بصير بالظل؟', 'Each draws what happens to the shadow when the torch moves away.') },
        { minutes: 6, title: t('جرّبوا', 'Test'), detail: t('ثبّتوا اللعبة والحيط. علّموا الظل بتلات مطارح للكشاف.', 'Fix toy and wall. Mark the shadow with the torch in three places.') },
        { minutes: 4, title: t('خيطين', 'Two strings'), detail: t('شدّوا خيطين من مطرح الكشاف ع أطراف اللعبة لحد الحيط، للقريب وللبعيد.', "Stretch two strings from the torch spot past the toy's edges to the wall, near and far.") },
        { minutes: 2, title: t('اشرح لصاحبك', 'Tell your partner'), detail: t('ليش الخيوط من بعيد بتوصل لمحل أضيق؟', 'Why do the strings from farther away land closer together?') },
      ],
      teacher: t('الخيط بيمثّل طريق الضو. خلّوهم يشدّوه منيح.', 'The string stands for the path of light, so keep it taut.'),
      check: t('بعّدنا الكشاف: شو صار بالظل؟ وليش؟', 'We moved the torch away: what did the shadow do, and why?'),
      adapt: t('بدون خيط: ارسموا بالمسطرة ع ورق.', 'No string: draw with a ruler on paper.'),
    },
  },
};
