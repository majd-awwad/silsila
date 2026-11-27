/**
 * حزمة «نفس السياج، نفس الأرض؟» — رياضيات، الصفوف ٣–٥: المحيط والمساحة.
 *
 * Rectangles with whole-number sides, measured on a unit grid:
 *   perimeter = 2 × (width + height) unit lengths · area = width × height unit squares.
 * The outcome is about AREA: which rectangle has more room inside.
 */
import type { ChildModel, Conditions, L } from '../contracts';
import type { ConceptPack } from './types';

type Out = 'a_more' | 'b_more' | 'equal';

/** option id → [width, height] in grid units */
export const RECTS: Record<string, readonly [number, number]> = {
  r5x5: [5, 5], r6x4: [6, 4], r7x3: [7, 3], r8x2: [8, 2], r9x1: [9, 1],
  r6x6: [6, 6], r4x4: [4, 4], r6x2: [6, 2], r3x3: [3, 3],
};

export const perimeterOf = (id: string): number => 2 * (RECTS[id][0] + RECTS[id][1]);
export const areaOf = (id: string): number => RECTS[id][0] * RECTS[id][1];

const cmp = (a: number, b: number): Out => (a > b ? 'a_more' : a < b ? 'b_more' : 'equal');

function realOutcome(c: Conditions): Out {
  return cmp(areaOf(c.a), areaOf(c.b));
}

function kidOutcome(m: ChildModel, c: Conditions): Out {
  const wrong = m.sources.filter((s) => s !== 'independent');
  if (!wrong.length) return realOutcome(c);
  // the length around decides the room inside (also when the two are taken to be one property)
  if (wrong.includes('bigger_perimeter_bigger_area') || wrong.includes('same_thing')) return cmp(perimeterOf(c.a), perimeterOf(c.b));
  // "same perimeter, same area": the claim is only about equal perimeters
  return perimeterOf(c.a) === perimeterOf(c.b) ? 'equal' : realOutcome(c);
}

const arDigits = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

function measure(c: Conditions): L {
  const line = (id: string, nameAr: string, nameEn: string): L => {
    const [w, h] = RECTS[id];
    return {
      ar: `${nameAr} ${arDigits(w)} × ${arDigits(h)}: المحيط ${arDigits(perimeterOf(id))} وحدة طول، المساحة ${arDigits(areaOf(id))} وحدة مربّعة.`,
      en: `${nameEn} ${w} × ${h}: perimeter ${perimeterOf(id)} units, area ${areaOf(id)} square units.`,
    };
  };
  const a = line(c.a, '(أ)', 'A');
  const b = line(c.b, '(ب)', 'B');
  return { ar: `${a.ar} ${b.ar}`, en: `${a.en} ${b.en}` };
}

/* ───────────── offline language patterns (written against normaliseText output) ───────────── */

const any = (...parts: string[]) => new RegExp(parts.join('|'));

/** a few characters of the same sentence that do not start a negator */
const SPAN = (n: number) => `(?:(?!(?:ما|مش|مو|لا|مستحيل|never|cannot|can't) )[^.!?؟]){0,${n}}?`;
const PER = '(?:ال)?محيط(?:هم|ها|ه)?(?![ء-ي])';
const AREA = '(?:ال)?(?:مساحه|مساحت(?:هم|ها|ه))(?![ء-ي])';
const DIFFERENT = '(?:مساحات مختلفه|مساحتهم مختلفه|مساحه مختلفه|مساحاتهم مختلفه|مساحات مختلفات)';

const differentRoom = [
  `(?:نفس|بنفس) ${PER} و(?:واحد|وحده) ${AREA} (?:اكبر|اصغر)`,
  '(?:ممكن |يجوز )?(?:تكون )?(?:ال)?مساحت(?:هم|ها|ه) (?:غير|مختلفه)(?![ء-ي])',
  '(?:not|no,? not) (?:always|necessarily) (?:the )?same area',
  'same perimeter[^.!?]{0,50}?(?:one (?:can|may|could|might) have (?:a larger|more) area)',
  `(?:نفس|بنفس|متساوي) ${PER}${SPAN(40)}${DIFFERENT}`,
  `${DIFFERENT}${SPAN(40)}(?:نفس|بنفس) ${PER}`,
  `(?:نفس|بنفس) ${PER}(?: [^ ]+){0,3}? (?:مش|مو) (?:نفس|قد) ${AREA}`,
  `(?:نفس|بنفس) ${PER} (?:ما|مش|مو) (?:بيعني|يعني|معناه|معناته|بالضروره) (?:انه |ان )?(?:نفس )?${AREA}`,
  `${PER}(?: لحاله)? (?:ما|مش|مو) (?:بيحدد|بيقرر|بحدد|بقرر|بيحكيلنا|بيحكي)(?: عن)? ${AREA}`,
  'same perimeter[^.!?]{0,50}?(?:different areas?|areas? (?:can|could|may|might) (?:be )?differ|not (?:always |necessarily )?(?:have )?(?:the )?same area)',
  'different areas?[^.!?]{0,40}?same perimeter',
  'same perimeter (?:does not|doesn\'?t) (?:always )?mean (?:the )?same area',
  'perimeter(?: alone)? (?:does not|doesn\'?t|cannot|can\'?t) (?:decide|determine|tell|fix)(?: us)?(?: the)? area',
];

const stepPerimeter = any(
  `${PER}(?: (?:هو|هي|يعني|بيكون|بنقيس|بقيس|منقيس))* (?:ال)?(?:طول|مسافه|خط|اطار|حدود|مجموع)`,
  '(?:ال)?(?:طول|مسافه|خط) (?:اللي |الي )?(?:حوالين|حول|ع دور|عدور|علي دور|حواليه|حواليها|من برا)',
  '(?:مجموع|بنجمع|بجمع|منجمع|نجمع) (?:كل )?(?:ال)?(?:اضلاع|اطوال|جوانب|اضلاعه|اضلاعها|الضلاع)',
  'perimeter (?:(?:is|means|measures|=) )(?:the )?(?:total )?(?:length|distance|way|line|border|edge)',
  '(?:distance|length|way|line) (?:all )?(?:the way )?around',
  '(?:add|adding|added)(?: up)?(?: all)?(?: the)?(?: side)? (?:sides|side lengths)',
);

const stepArea = any(
  `${AREA}(?: (?:هي|هو|يعني|بتكون|بنقيس|بنعدها|بنحسبها))* (?:ال)?(?:مكان|فراغ|محل|اللي جوا|الي جوا|مربعات|عدد (?:ال)?مربعات|جوا|داخل)`,
  '(?:ال)?(?:مكان|فراغ|محل) (?:اللي |الي )?(?:جوا|داخل|من جوا)',
  '(?:عدد|بنعد|منعد|نعد|بعد|عديت|عدينا) (?:كل )?(?:ال)?مربعات',
  '(?:ال)?مربعات (?:اللي |الي )?(?:جوا|جواته|جواتها|داخل)',
  'area (?:(?:is|means|measures|=) )(?:the )?(?:space|room|inside|surface|number of (?:unit |little |small )?squares|squares|how (?:much|many))',
  '(?:count|counting|counted) (?:all )?(?:the )?(?:unit |little |small )?squares',
  '(?:space|room|squares) inside',
);

const stepIndependent = any(...differentRoom);

export const areaPerimeter: ConceptPack = {
  id: 'area-perimeter',
  subject: 'math',
  title: { ar: 'نفس السياج، نفس الأرض؟', en: 'Same fence, same ground?' },
  question: {
    ar: 'شكلين إلهم نفس المحيط: هل دايماً إلهم نفس المساحة؟ وليش؟',
    en: 'Two shapes have the same perimeter. Do they always have the same area? Why?',
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
    { id: 'o_perimeter', text: { ar: 'أقيس المحيط كطول حوالين الشكل.', en: 'Measure perimeter as the length around a shape.' }, nodes: ['C1', 'C2'] },
    { id: 'o_area', text: { ar: 'أقيس المساحة بعدّ مربّعات الوحدة.', en: 'Measure area by counting unit squares.' }, nodes: ['C1', 'C3'] },
    { id: 'o_relate', text: { ar: 'أقارن مستطيلات وأبيّن العلاقة بين المحيط والمساحة.', en: 'Compare rectangles and show how perimeter and area relate.' }, nodes: ['C4', 'C5'] },
  ],
  concepts: {
    C1: { label: { ar: 'القياس بوحدات', en: 'Measuring with units' }, ai: 'measuring means counting equal units: unit lengths and unit squares', needs: [] },
    C2: { label: { ar: 'المحيط: الطول حوالين', en: 'Perimeter: length around' }, ai: 'perimeter is the total length around a shape', needs: ['C1'] },
    C3: { label: { ar: 'المساحة: المربّعات جوّا', en: 'Area: squares inside' }, ai: 'area is the space inside a shape, counted in unit squares', needs: ['C1'] },
    C4: { label: { ar: 'نفس المحيط، مساحات غير', en: 'One perimeter, many areas' }, ai: 'shapes with the same perimeter can have different areas, so one does not decide the other', needs: ['C2', 'C3'] },
    C5: { label: { ar: 'تصميم جنينة', en: 'Designing a garden' }, ai: 'use perimeter for the fence and area for the planting room when designing', needs: ['C4'] },
  },
  prerequisites: [
    {
      id: 'unit_lengths',
      label: { ar: 'قياس الأطوال بالوحدات', en: 'Measuring lengths in units' },
      why: { ar: 'المحيط بيبدأ من عدّ وحدات الطول صح.', en: 'Perimeter starts from counting unit lengths correctly.' },
      supports: ['C1', 'C2'],
      suspect: { ideas: ['same_thing'], missingSteps: [0] },
      verify: [
        {
          id: 'ul_v1', node: 'C1',
          q: { ar: 'ضلع طوله ٤ خانات على ورق المربّعات. كم وحدة طول هو؟', en: 'A side spans 4 boxes on grid paper. How many unit lengths is it?' },
          options: [{ ar: '٤', en: '4' }, { ar: '٥', en: '5' }, { ar: '١٦', en: '16' }],
          correct: 0,
        },
        {
          id: 'ul_v2', node: 'C2',
          q: { ar: 'مستطيل طوله ٣ وعرضه ٢. نملة بتمشي على حافّته كلها. كم وحدة بتمشي؟', en: 'A rectangle is 3 by 2. An ant walks its whole edge. How many units does it walk?' },
          options: [{ ar: '٥', en: '5' }, { ar: '٦', en: '6' }, { ar: '١٠', en: '10' }],
          correct: 2,
        },
      ],
      remedy: {
        title: { ar: 'مشوار النملة', en: 'The ant’s walk' },
        minutes: 5,
        steps: [
          { ar: 'ارسم مستطيل على ورق مربّعات.', en: 'Draw a rectangle on grid paper.' },
          { ar: 'مشّي إصبعك على الحافّة وعدّ كل خانة بتمرق عنها.', en: 'Trace the edge with a finger, counting every unit you pass.' },
          { ar: 'قيس نفس الحافّة بخيط ومدّه على المسطرة.', en: 'Lay a string along the edge, then stretch it on a ruler.' },
        ],
      },
      recheck: {
        id: 'ul_r', node: 'C2',
        q: { ar: 'مربّع ضلعه ٣. كم الطول حواليه؟', en: 'A square has side 3. What is the length around it?' },
        options: [{ ar: '٩', en: '9' }, { ar: '١٢', en: '12' }, { ar: '٦', en: '6' }],
        correct: 1,
      },
    },
    {
      id: 'unit_squares',
      label: { ar: 'تغطية الشكل بمربّعات', en: 'Covering a shape with squares' },
      why: { ar: 'المساحة معناها كم مربّع وحدة بيغطّي الشكل.', en: 'Area means how many unit squares cover the shape.' },
      supports: ['C1', 'C3'],
      suspect: { ideas: ['same_thing', 'bigger_perimeter_bigger_area'], missingSteps: [1] },
      verify: [
        {
          id: 'us_v1', node: 'C3',
          q: { ar: 'شكل فيه صفّين، بكل صف ٤ مربّعات. كم مربّع بيغطّيه؟', en: 'A shape has 2 rows of 4 squares. How many squares cover it?' },
          options: [{ ar: '٦', en: '6' }, { ar: '٨', en: '8' }, { ar: '١٢', en: '12' }],
          correct: 1,
        },
        {
          id: 'us_v2', node: 'C1',
          q: { ar: 'شو لازم يكون بالمربّعات لما نعدّ المساحة؟', en: 'What must be true of the squares when we count area?' },
          options: [
            { ar: 'قد بعض، بدون فراغات ولا تراكب', en: 'Same size, no gaps and no overlaps' },
            { ar: 'بأي حجم', en: 'Any sizes' },
            { ar: 'على الأطراف بس', en: 'Only along the edges' },
          ],
          correct: 0,
        },
      ],
      remedy: {
        title: { ar: 'نبلّط الأرض', en: 'Tile the floor' },
        minutes: 5,
        steps: [
          { ar: 'قصّوا مربّعات ورق قد بعض.', en: 'Cut equal paper squares.' },
          { ar: 'غطّوا مستطيل بدون فراغات وعدّوهم.', en: 'Cover a rectangle with no gaps and count them.' },
          { ar: 'احكوا: كم صف؟ وكم مربّع بكل صف؟', en: 'Say how many rows, and how many squares in each.' },
        ],
      },
      recheck: {
        id: 'us_r', node: 'C3',
        q: { ar: 'مستطيل فيه ٣ صفوف، بكل صف ٥ مربّعات. شو مساحته؟', en: 'A rectangle has 3 rows of 5 squares. What is its area?' },
        options: [{ ar: '٨', en: '8' }, { ar: '١٥', en: '15' }, { ar: '١٦', en: '16' }],
        correct: 1,
      },
    },
  ],
  reference: {
    model: {
      ar: 'محيط المستطيل = ٢ × (الطول + العرض) بوحدات الطول، ومساحته = الطول × العرض بالوحدات المربّعة. مستطيلات بنفس المحيط ممكن تكون مساحاتها مختلفة، ومحيط أطول ما بيضمن مساحة أكبر. بين المستطيلات اللي إلها نفس المحيط، المربّع إله أكبر مساحة.',
      en: 'A rectangle’s perimeter is 2 × (width + height) in unit lengths and its area is width × height in square units. Rectangles with equal perimeters can have different areas, and a longer perimeter does not guarantee a larger area. Among rectangles of one perimeter the square has the largest area.',
    },
    limits: {
      ar: 'بس مستطيلات أضلاعها أعداد صحيحة. الفكرة بتنطبق على أشكال تانية، بس ما بنعرضها هون. «نفس المساحة» بتعني نفس عدد المربّعات، مش نفس الشكل.',
      en: 'Only rectangles with whole-number sides. The idea extends to other shapes, which are not shown here. “Same area” means the same number of squares, not the same shape.',
    },
    sources: [
      { title: 'Common Core State Standards for Mathematics — Grade 3, Measurement and Data (3.MD): area and perimeter' },
    ],
  },

  ideas: {
    independent: {
      label: { ar: 'المحيط ما بيقرّر المساحة', en: 'Perimeter does not decide area' },
      mirror: {
        ar: 'هيك إنت شايفها: المحيط طول الحافّة، والمساحة المربّعات اللي جوّا، وشكلين بنفس المحيط ممكن مساحتهم تكون مختلفة.',
        en: 'You see it like this: perimeter is the length of the edge, area is the squares inside, and one perimeter can hold different areas.',
      },
      observation: { ar: 'مستطيل رفيع وطويل ومربّع، بنفس طول الحافّة، وجوّاهم عدد مربّعات غير.', en: 'A long thin rectangle and a square with one edge length hold different numbers of squares.' },
      assumption: { ar: 'المحيط والمساحة قياسين مختلفين.', en: 'Perimeter and area are two different measures.' },
      conclusion: { ar: 'لازم نعدّ المربّعات تا نعرف المساحة.', en: 'To know the area we must count the squares.' },
      story: [
        { ar: 'بقيس طول الحافّة', en: 'I measure the edge' },
        { ar: 'بعدّ المربّعات جوّا', en: 'I count the squares inside' },
        { ar: 'نفس الحافّة ممكن تعطي عدد مربّعات غير', en: 'One edge length can give different counts' },
      ],
      wrongStep: null,
      correct: true,
      breaks: null,
      model: { sources: ['independent'], path: 'count_inside', requires: [] },
      intervention: {
        ar: 'تحدّاه: لاقي مستطيلين، الأول محيطه أطول ومساحته أقل.',
        en: 'Challenge: find two rectangles where the longer perimeter has the smaller area.',
      },
      ai: 'correct idea: shapes with the same perimeter can have different areas; perimeter does not decide area',
    },
    same_perimeter_same_area: {
      label: { ar: 'نفس المحيط، نفس المساحة', en: 'Same perimeter, same area' },
      mirror: {
        ar: 'هيك إنت شايفها: إذا الشكلين إلهم نفس المحيط، أكيد إلهم نفس المساحة.',
        en: 'You see it like this: if two shapes share a perimeter, they surely share an area.',
      },
      observation: { ar: 'السياجين نفس الطول.', en: 'The two fences have one length.' },
      assumption: { ar: 'طول الحافّة بيحدّد قدّيش جوّا.', en: 'The edge length fixes how much is inside.' },
      conclusion: { ar: 'المساحتين قد بعض.', en: 'The two areas match.' },
      story: [
        { ar: 'بقيس المحيطين', en: 'I measure both perimeters' },
        { ar: 'طلعوا قد بعض', en: 'They match' },
        { ar: 'إذن المساحتين قد بعض', en: 'So the areas match' },
      ],
      wrongStep: 2,
      breaks: 'C4',
      model: { sources: ['same_perimeter_same_area'], path: 'length_around', requires: [] },
      intervention: {
        ar: 'أعطيه خيط مربوط بطول ٢٠، يعمل منه مربّع وبعدين مستطيل رفيع على ورق مربّعات ويعدّ.',
        en: 'Give a 20-unit loop of string: make a square, then a thin rectangle on grid paper, and count.',
      },
      ai: 'thinks shapes with the same perimeter must have the same area',
    },
    bigger_perimeter_bigger_area: {
      label: { ar: 'محيط أطول، مساحة أكبر', en: 'Longer perimeter, bigger area' },
      mirror: {
        ar: 'هيك إنت شايفها: اللي محيطه أطول، أكيد مساحته أكبر.',
        en: 'You see it like this: the one with the longer perimeter surely has the bigger area.',
      },
      observation: { ar: 'مرّات الشكل الأكبر حافّته أطول.', en: 'Often a larger shape has a longer edge.' },
      assumption: { ar: 'المحيط والمساحة بيكبروا مع بعض دايماً.', en: 'Perimeter and area always grow together.' },
      conclusion: { ar: 'بقارن المحيط تا أعرف المساحة.', en: 'I compare perimeters to learn the areas.' },
      story: [
        { ar: 'بقيس الحافّتين', en: 'I measure both edges' },
        { ar: 'وحدة أطول', en: 'One is longer' },
        { ar: 'إذن مساحتها أكبر', en: 'So its area is bigger' },
      ],
      wrongStep: 2,
      breaks: 'C4',
      model: { sources: ['bigger_perimeter_bigger_area'], path: 'length_around', requires: [] },
      intervention: {
        ar: 'اعرض ٩×١ و٤×٤: يقيس المحيطين، يتوقّع، وبعدين يعدّ المربّعات.',
        en: 'Show 9×1 and 4×4: measure both perimeters, predict, then count the squares.',
      },
      ai: 'thinks a longer perimeter always means a larger area',
    },
    same_thing: {
      label: { ar: 'المحيط والمساحة واحد', en: 'Perimeter and area are one' },
      mirror: {
        ar: 'هيك إنت شايفها: المحيط والمساحة اسمين لنفس القياس، وبكفّي نقيس حوالين الشكل.',
        en: 'You see it like this: perimeter and area are two names for one measure, so measuring around is enough.',
      },
      observation: { ar: 'الاثنين بيحكوا عن «قدّيش الشكل كبير».', en: 'Both talk about “how big the shape is”.' },
      assumption: { ar: 'في قياس واحد بس لكِبَر الشكل.', en: 'There is only one measure of a shape’s size.' },
      conclusion: { ar: 'اللي حوالين هو نفسه اللي جوّا.', en: 'Around and inside are the same thing.' },
      story: [
        { ar: 'بقيس حوالين الشكل', en: 'I measure around the shape' },
        { ar: 'هاد هو حجمه', en: 'That is its size' },
        { ar: 'فالمساحة نفس الإشي', en: 'So the area is the same thing' },
      ],
      wrongStep: 1,
      breaks: 'C3',
      model: { sources: ['same_thing'], path: 'one_measure', requires: [] },
      intervention: {
        ar: 'خلّيه يلوّن الحافّة بلون والمربّعات اللي جوّا بلون ثاني، ويحكي وحدة كل قياس.',
        en: 'Have the learner colour the edge one colour and the inside squares another, naming each unit.',
      },
      ai: 'confuses area and perimeter and thinks they measure the same property',
    },
  },
  paths: {
    count_inside: { label: { ar: 'بعدّ المربّعات جوّا', en: 'Count the squares inside' }, ai: 'counts unit squares inside to compare areas' },
    length_around: { label: { ar: 'بقرّر من الطول حوالين', en: 'Decide from the length around' }, ai: 'uses the perimeter to decide the area' },
    one_measure: { label: { ar: 'قياس واحد للشكل', en: 'One measure for the shape' }, ai: 'treats area and perimeter as the same measurement' },
  },
  requires: {
    count_squares: { label: { ar: 'بدها عدّ مربّعات', en: 'Needs counting squares' }, ai: 'says area must be found by counting squares' },
  },
  correctModel: { sources: ['independent'], path: 'count_inside', requires: [] },
  steps: [
    {
      node: 'C2',
      text: { ar: 'المحيط هو الطول حوالين الشكل.', en: 'Perimeter is the length around the shape.' },
      test: stepPerimeter,
      noorSays: { ar: 'المحيط هو طول الخط اللي حوالين الشكل.', en: 'Perimeter is the length of the line around the shape.' },
      noorAsks: { ar: 'لما تحكي «محيط»، شو بالزبط بتقيس؟', en: 'When you say “perimeter”, what exactly do you measure?' },
    },
    {
      node: 'C3',
      text: { ar: 'المساحة هي المكان جوّا الشكل، وبنعدّه بمربّعات الوحدة.', en: 'Area is the space inside, counted in unit squares.' },
      test: stepArea,
      noorSays: { ar: 'المساحة هي المكان جوّا، وبنعدّه بالمربّعات.', en: 'Area is the space inside, and we count it in squares.' },
      noorAsks: { ar: 'و«المساحة»، شو هي؟ وكيف بنعدّها؟', en: 'And “area”: what is it, and how do we count it?' },
    },
    {
      node: 'C4',
      text: { ar: 'نفس المحيط ممكن يعطي مساحات مختلفة، فالمحيط لحاله ما بيقرّر المساحة.', en: 'The same perimeter can give different areas, so perimeter alone does not decide area.' },
      test: stepIndependent,
      noorSays: { ar: 'وشكلين بنفس المحيط ممكن مساحتهم تكون مختلفة.', en: 'And two shapes with one perimeter can have different areas.' },
      noorAsks: { ar: 'إذا عرفت المحيط، شو بتقدر تحكي عن المكان اللي جوّا؟', en: 'If you know the perimeter, what can you say about the space inside?' },
    },
  ],

  variables: [
    {
      id: 'a', label: { ar: 'الشكل (أ)', en: 'Shape A' },
      options: [
        { id: 'r5x5', label: { ar: '٥ × ٥', en: '5 × 5' } }, { id: 'r6x4', label: { ar: '٦ × ٤', en: '6 × 4' } },
        { id: 'r7x3', label: { ar: '٧ × ٣', en: '7 × 3' } }, { id: 'r8x2', label: { ar: '٨ × ٢', en: '8 × 2' } },
        { id: 'r9x1', label: { ar: '٩ × ١', en: '9 × 1' } }, { id: 'r6x6', label: { ar: '٦ × ٦', en: '6 × 6' } },
        { id: 'r4x4', label: { ar: '٤ × ٤', en: '4 × 4' } }, { id: 'r6x2', label: { ar: '٦ × ٢', en: '6 × 2' } },
        { id: 'r3x3', label: { ar: '٣ × ٣', en: '3 × 3' } },
      ],
    },
    {
      id: 'b', label: { ar: 'الشكل (ب)', en: 'Shape B' },
      options: [
        { id: 'r5x5', label: { ar: '٥ × ٥', en: '5 × 5' } }, { id: 'r6x4', label: { ar: '٦ × ٤', en: '6 × 4' } },
        { id: 'r7x3', label: { ar: '٧ × ٣', en: '7 × 3' } }, { id: 'r8x2', label: { ar: '٨ × ٢', en: '8 × 2' } },
        { id: 'r9x1', label: { ar: '٩ × ١', en: '9 × 1' } }, { id: 'r6x6', label: { ar: '٦ × ٦', en: '6 × 6' } },
        { id: 'r4x4', label: { ar: '٤ × ٤', en: '4 × 4' } }, { id: 'r6x2', label: { ar: '٦ × ٢', en: '6 × 2' } },
        { id: 'r3x3', label: { ar: '٣ × ٣', en: '3 × 3' } },
      ],
    },
  ],
  baseline: { a: 'r5x5', b: 'r8x2' },
  experiments: [
    {
      id: 'square_wide',
      name: { ar: 'مربّع ومستطيل عريض', en: 'A square and a wide rectangle' },
      short: { ar: '٥×٥ و٨×٢', en: '5×5 and 8×2' },
      change: {},
      question: {
        ar: 'حوش (أ) ٥ × ٥ وحوش (ب) ٨ × ٢. سياج كل واحد ٢٠ وحدة. وين المكان جوّا أكثر؟',
        en: 'Yard A is 5 × 5 and yard B is 8 × 2. Each fence is 20 units. Which has more room inside?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 8,
      materials: ['grid_paper', 'ruler'],
      safety: { adult: false, note: { ar: 'ما في خطر.', en: 'No hazard.' } },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          { ar: 'على ورق مربّعات ارسموا مستطيل ٥ × ٥.', en: 'On grid paper draw a 5 × 5 rectangle.' },
          { ar: 'ارسموا جنبه مستطيل ٨ × ٢.', en: 'Draw an 8 × 2 rectangle beside it.' },
          { ar: 'عدّوا الخطوط الصغيرة حوالين كل واحد.', en: 'Count the unit edges around each.' },
          { ar: 'بعدين عدّوا المربّعات جوّا.', en: 'Then count the squares inside.' },
        ],
        record: { ar: 'اعملوا جدول: الشكل، المحيط، المساحة.', en: 'Make a table: shape, perimeter, area.' },
        reflect: [{ ar: 'أي عمودين بالجدول طلعوا زي ما توقّعتوا؟', en: 'Which columns came out as you expected?' }],
      },
    },
    {
      id: 'square_strip',
      name: { ar: 'مربّع وشريط رفيع', en: 'A square and a thin strip' },
      short: { ar: '٥×٥ و٩×١', en: '5×5 and 9×1' },
      change: { b: 'r9x1' },
      question: {
        ar: 'خيط واحد طوله ٢٠: مرّة ٥ × ٥ ومرّة ٩ × ١. بأي شكل بتساع بلاطات أكثر؟',
        en: 'One string 20 long makes 5 × 5, then 9 × 1. Which shape takes more tiles?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 8,
      materials: ['string', 'grid_paper', 'ruler'],
      safety: { adult: false, note: { ar: 'الخيط ما بينلف حوالين الرقبة أو الأصابع.', en: 'Never wrap the string around a neck or fingers.' } },
      minGrade: 3,
      targets: ['C2', 'C3', 'C4'],
      home: {
        steps: [
          { ar: 'اربطوا خيط على شكل حلقة طولها ٢٠ سم.', en: 'Tie a string into a 20 cm loop.' },
          { ar: 'على ورقة مربّعات ١ سم، شكّلوه ٥ × ٥ وعدّوا المربّعات.', en: 'On 1 cm grid paper shape it 5 × 5 and count the squares.' },
          { ar: 'شكّلوه ٩ × ١ وعدّوا من جديد.', en: 'Reshape it 9 × 1 and count again.' },
        ],
        record: { ar: 'ارسموا الشكلين واكتبوا العددين.', en: 'Draw both shapes and write both counts.' },
        reflect: [{ ar: 'الخيط ما تغيّر. شو تغيّر؟', en: 'The string did not change. What did?' }],
      },
    },
    {
      id: 'close_pair',
      name: { ar: 'مستطيلين متقاربين', en: 'Two close rectangles' },
      short: { ar: '٦×٤ و٧×٣', en: '6×4 and 7×3' },
      change: { a: 'r6x4', b: 'r7x3' },
      question: {
        ar: '(أ) ٦ × ٤ و(ب) ٧ × ٣، وسياج كل واحد ٢٠. وين المربّعات أكثر؟',
        en: 'A is 6 × 4 and B is 7 × 3, each with a fence of 20. Which has more squares?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 7,
      materials: ['grid_paper', 'ruler'],
      safety: { adult: false, note: { ar: 'ما في خطر.', en: 'No hazard.' } },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          { ar: 'ارسموا ٦ × ٤ و٧ × ٣ على ورق مربّعات.', en: 'Draw 6 × 4 and 7 × 3 on grid paper.' },
          { ar: 'عدّوا المحيط، وبعدين عدّوا الصفوف والمربّعات.', en: 'Count each perimeter, then the rows and squares.' },
        ],
        record: { ar: 'اكتبوا المحيط والمساحة تحت كل رسمة.', en: 'Write perimeter and area under each drawing.' },
        reflect: [{ ar: 'لاقوا مستطيل ثالث بنفس السياج.', en: 'Find a third rectangle with the same fence.' }],
      },
    },
    {
      id: 'longer_less',
      name: { ar: 'سياج أطول', en: 'The longer fence' },
      short: { ar: '٩×١ و٤×٤', en: '9×1 and 4×4' },
      change: { a: 'r9x1', b: 'r4x4' },
      question: {
        ar: '(أ) ٩ × ١ سياجه ٢٠، و(ب) ٤ × ٤ سياجه ١٦. وين المكان جوّا أكثر؟',
        en: 'A is 9 × 1 with a fence of 20; B is 4 × 4 with a fence of 16. Which has more room inside?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 7,
      materials: ['grid_paper', 'string', 'ruler'],
      safety: { adult: false, note: { ar: 'الخيط ما بينلف حوالين الرقبة أو الأصابع.', en: 'Never wrap the string around a neck or fingers.' } },
      minGrade: 3,
      targets: ['C4'],
      home: {
        steps: [
          { ar: 'ارسموا ٩ × ١ و٤ × ٤ على ورق مربّعات.', en: 'Draw 9 × 1 and 4 × 4 on grid paper.' },
          { ar: 'مدّوا خيط حوالين كل واحد وقصّوه، وقارنوا الخيطين.', en: 'Run a string around each, cut it, and compare the two.' },
          { ar: 'عدّوا المربّعات جوّا كل شكل.', en: 'Count the squares inside each.' },
        ],
        record: { ar: 'ألصقوا الخيطين واكتبوا عدد المربّعات.', en: 'Glue both strings down and write the square counts.' },
        reflect: [{ ar: 'الخيط الأطول: شو صار بعدد المربّعات عنده؟', en: 'The longer string: what about its number of squares?' }],
      },
    },
    {
      id: 'same_ground',
      name: { ar: 'سياجين غير، وجوّا؟', en: 'Two fences, and inside?' },
      short: { ar: '٨×٢ و٤×٤', en: '8×2 and 4×4' },
      change: { a: 'r8x2', b: 'r4x4' },
      question: {
        ar: '(أ) ٨ × ٢ سياجه ٢٠، و(ب) ٤ × ٤ سياجه ١٦. وين المربّعات أكثر؟',
        en: 'A is 8 × 2 with a fence of 20; B is 4 × 4 with a fence of 16. Which has more squares?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 8,
      materials: ['grid_paper', 'scissors'],
      safety: { adult: false, note: { ar: 'استعملوا مقص آمن.', en: 'Use safety scissors.' } },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          { ar: 'قصّوا من ورق المربّعات مستطيل ٨ × ٢.', en: 'Cut an 8 × 2 rectangle from grid paper.' },
          { ar: 'قصّوه من النص لقطعتين ٤ × ٢.', en: 'Cut it in the middle into two 4 × 2 pieces.' },
          { ar: 'حطّوا القطعتين فوق وتحت واعملوا شكل جديد.', en: 'Place one above the other to make a new shape.' },
        ],
        record: { ar: 'اكتبوا المحيط والمساحة قبل وبعد.', en: 'Write perimeter and area before and after.' },
        reflect: [
          { ar: 'ولا مربّع انزاد ولا نقص. شو صار بالمحيط؟', en: 'No square was added or removed. What happened to the perimeter?' },
        ],
      },
    },
    {
      id: 'thin_square',
      name: { ar: 'مربّع صغير وشريط', en: 'A small square and a strip' },
      short: { ar: '٣×٣ و٩×١', en: '3×3 and 9×1' },
      change: { a: 'r3x3', b: 'r9x1' },
      question: {
        ar: '(أ) ٣ × ٣ و(ب) ٩ × ١. وين المساحة أكثر؟',
        en: 'A is 3 × 3 and B is 9 × 1. Which has more area?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 6,
      materials: ['grid_paper', 'scissors'],
      safety: { adult: false, note: { ar: 'استعملوا مقص آمن.', en: 'Use safety scissors.' } },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          { ar: 'قصّوا شريط ٩ × ١ من ورق المربّعات.', en: 'Cut a 9 × 1 strip from grid paper.' },
          { ar: 'قصّوه تلات قطع ورتّبوها مربّع.', en: 'Cut it into three pieces and arrange them as a square.' },
          { ar: 'قيسوا الحافّة بالحالتين.', en: 'Measure the edge in both cases.' },
        ],
        record: { ar: 'ارسموا قبل وبعد.', en: 'Draw before and after.' },
        reflect: [{ ar: 'شو ضل زي ما هو، وشو تغيّر؟', en: 'What stayed the same and what changed?' }],
      },
    },
    {
      id: 'both_grow',
      name: { ar: 'مربّع كبير ومربّع أصغر', en: 'A big square and a smaller one' },
      short: { ar: '٦×٦ و٤×٤', en: '6×6 and 4×4' },
      change: { a: 'r6x6', b: 'r4x4' },
      question: {
        ar: '(أ) ٦ × ٦ سياجه ٢٤، و(ب) ٤ × ٤ سياجه ١٦. وين المكان جوّا أكثر؟',
        en: 'A is 6 × 6 with a fence of 24; B is 4 × 4 with a fence of 16. Which has more room inside?',
      },
      choices: ['a_more', 'b_more', 'equal'],
      minutes: 5,
      materials: ['grid_paper'],
      safety: { adult: false, note: { ar: 'ما في خطر.', en: 'No hazard.' } },
      minGrade: 3,
      targets: ['C2', 'C3', 'C4'],
      home: {
        steps: [
          { ar: 'ارسموا المربّعين على ورق مربّعات.', en: 'Draw both squares on grid paper.' },
          { ar: 'عدّوا المحيط والمساحة لكل واحد.', en: 'Count perimeter and area for each.' },
          { ar: 'قارنوا النتيجة مع تجربة ٩ × ١ و٤ × ٤.', en: 'Compare with the 9 × 1 and 4 × 4 case.' },
        ],
        record: { ar: 'اكتبوا النتيجتين جنب بعض.', en: 'Write both results side by side.' },
        reflect: [{ ar: 'هل المحيط لحاله بيكفّي تا نعرف وين المساحة أكثر؟', en: 'Is the perimeter alone enough to know which area is larger?' }],
      },
    },
  ],
  outcomes: {
    a_more: { ar: 'مساحة (أ) أكبر', en: 'A has more area' },
    b_more: { ar: 'مساحة (ب) أكبر', en: 'B has more area' },
    equal: { ar: 'المساحتين قد بعض', en: 'The areas are equal' },
  },
  kidOutcome,
  realOutcome,
  measure,

  noor: {
    greeting: {
      ar: 'أهلاً! أنا نور. بدي أعمل حوش للجاجات. حوشين محاطين بنفس طول السياج: لازم يكون جوّاهم نفس المكان؟ احكيلي بكلامك وبرسم فكرتك زي ما هي.',
      en: 'Hi! I am Noor. I want to build a yard for my hens. Two yards use the same length of fence: must they have the same room inside? Tell me in your words and I will draw your idea as it is.',
    },
    invite: { ar: 'فهمت فكرتك! يلا نجرّبها على ورق المربّعات. شو بتتوقّع؟', en: 'I got your idea! Let’s test it on the grid. What do you predict?' },
    afterContradiction: {
      ar: 'شفت؟ العدّ طلع غير اللي توقّعته الفكرة. في إشي لازم نعدّله. شو لاحظت؟',
      en: 'See? The count is not what the idea expected. Something needs fixing. What did you notice?',
    },
    afterMatch: { ar: 'هالمرة فكرتك صمدت! جرّب شكلين غيرهم.', en: 'Your idea held up this time! Try two other shapes.' },
    sameResult: {
      ar: 'فكرتك والحقيقة أعطوا نفس النتيجة، فهالتجربة ما بتفرّق بينهم. غيّر الشكل وجرّب.',
      en: 'Your idea and reality gave one result, so this test cannot tell them apart. Change a shape and try.',
    },
    praise: { ar: 'شرحك مرتّب وكامل! بتعلّمني إنت هلأ؟', en: 'Your explanation is clear and complete! Will you teach me now?' },
    partial: { ar: 'حلو، فهمت منك إشي مهم! زيدني:', en: 'Nice, I learned something important from you! Tell me more:' },
    contradiction: { ar: 'سمعت منك فكرتين ما بيزبطوا مع بعض. أي وحدة بتقصد؟', en: 'I heard two ideas that do not fit together. Which one do you mean?' },
    offtopic: { ar: 'خلّينا نرجع لحوش الجاجات والسياج. شو رأيك؟', en: 'Let’s go back to the hen yard and the fence. What do you think?' },
    unsupported: {
      ar: 'فكرة بتستاهل نفكّر فيها! بس ما بقدر أجرّبها هون. احكيلي عن السياج وعن المكان اللي جوّاه.',
      en: 'That is worth thinking about! I cannot test it here. Tell me about the fence and the space inside it.',
    },
  },
  hints: [
    {
      ar: 'احكيلي بكلامك: شو بنقيس لما نلفّ خيط حوالين الشكل؟ وشو بنقيس لما نعبّيه بلاط؟',
      en: 'In your words: what do we measure with a string around a shape? What do we measure when we fill it with tiles?',
    },
    {
      ar: 'ارسم على ورق مربّعات حوشين، سياج كل واحد ٢٠ خط صغير. طلّع على جوّاهم.',
      en: 'On grid paper draw two yards, each with a fence 20 little edges long. Look inside them.',
    },
    {
      ar: 'جرّب حوش رفيع وطويل كثير، وحوش طوله قريب من عرضه، بنفس طول السياج. عدّ المربّعات بكل واحد.',
      en: 'With one fence length, try a very long thin yard and a nearly square one. Count the squares in each.',
    },
    {
      ar: 'عدّ بكل رسمة: ٩ × ١ فيه ٩ مربّعات، و٥ × ٥ فيه ٢٥، مع إن سياج الاثنين ٢٠. يعني نفس المحيط ممكن يعطي مساحة مختلفة.',
      en: 'Count each drawing: 9 × 1 holds 9 squares and 5 × 5 holds 25, though both fences are 20. So one perimeter can give different areas.',
    },
  ],
  clarify: [
    { id: 'why', q: { ar: 'احكيلي أكثر: ليش هيك رأيك؟', en: 'Tell me more: why do you think so?' }, ai: 'ask for the reason' },
    { id: 'perimeter', q: { ar: 'شو يعني «محيط» بكلامك؟', en: 'What does “perimeter” mean in your words?' }, ai: 'ask what perimeter means' },
    { id: 'area', q: { ar: 'و«مساحة»، شو يعني؟ كيف بنقيسها؟', en: 'And “area”: what does it mean? How do we measure it?' }, ai: 'ask what area means' },
    { id: 'example', q: { ar: 'بتعطيني مثال لشكلين وبتقيسهم؟', en: 'Can you give two shapes as an example and measure them?' }, ai: 'ask for a measured example' },
  ],
  answerWords: /مختلف|(?:مش|مو)\s+(?:(?:لازم|شرط|دايماً|دايما|دائماً)\s+)?نفس|ما\s+(?:بيحدد|بيقرر|بتحدد|بتقرر|بيحدّد|بيقرّر)|different\s+(?:areas?|space|room)|not\s+(?:(?:always|necessarily)\s+)?(?:have\s+)?(?:the\s+)?same|(?:does(?:\s+not|n't|n’t))\s+(?:always\s+)?(?:decide|determine|fix)|square\s+(?:is|has)\s+(?:the\s+)?(?:most|biggest|largest|bigger|more)|المرب[ّ]?ع\s+(?:[أا]كبر|إله\s+[أا]كبر|فيه\s+[أا]كثر)/i,
  teach: {
    planted: {
      ar: 'فهمت! يعني لو حوشين محاطين بنفس طول السياج، أكيد جوّاهم نفس المكان. صح؟',
      en: 'I get it! So two yards with the same length of fence surely have the same room inside. Right?',
    },
    truth: 'Equal perimeters can enclose different areas: with a fence of 20, a 5×5 yard holds 25 squares but a 9×1 yard only 9.',
    accept: new RegExp(
      '^(?=.*(?:(?<![ء-ي])(?:لا|لاا|لأ|غلط|خطا|مش|مو|العكس|بالعكس|ابدا)(?![ء-ي])|\\b(?:no|nope|not|wrong|incorrect|false|isn\'t|doesn\'t)\\b|مختلف|different|(?<![ء-ي])ممكن))'
      + '(?=.*(?:مربع|شكل|اشكال|طويل|رفيع|عريض|ضيق|مثلا|مثال|[0-9٠-٩]|square|shape|\\bthin\\b|\\blong\\b|\\bwide\\b|narrow|skinny|example|count|tiles?))',
    ),
    reject: new RegExp(
      '^\\s*(?:اه|ايوه|ايوا|نعم|صح|صحيح|مزبوط|مظبوط|مضبوط|اكيد(?! لا| مش)|yes|yeah|yep|right|correct|true)(?![ء-يa-z])|'
      + '(?<!(?:مش|مو) )(?:اكيد|لازم|دايما) (?:جواهم )?(?:نفس (?:ال)?(?:مساحه|مكان)|قد بعض)|'
      + '(?<!not )(?:always|must|will|surely) (?:have |has )?(?:the )?same (?:area|room|space)',
    ),
    thanks: {
      ar: 'آه! لازم أعدّ المربّعات اللي جوّا، لأن نفس السياج ممكن يساع مربّعات أكثر أو أقل حسب الشكل. شكراً يا أستاذ!',
      en: 'Oh! I must count the squares inside, because one fence can hold more or fewer squares depending on the shape. Thank you, teacher!',
    },
    confused: {
      ar: 'لسا محتارة… إذا عملت من نفس الخيط أشكال كثيرة، كيف بعرف قدّيش بيساع كل واحد؟',
      en: 'I am still puzzled… If I make many shapes from one string, how do I find how much each one holds?',
    },
  },
  challenge: {
    phenomenon: {
      ar: 'بدنا نعمل قنّ للجاجات بسياج طوله ١٢ متر. بنقدر نعمله ٥ × ١ أو ٣ × ٣. هل الجاجات بتاخد نفس المكان بالحالتين؟ ليش؟',
      en: 'We build a hen run with 12 m of fence. It can be 5 × 1 or 3 × 3. Do the hens get the same room both ways? Why?',
    },
    solved: {
      ar: 'السياج بالحالتين ١٢ متر، بس جوّا ٣ × ٣ في ٩ مربّعات، وجوّا ٥ × ١ في ٥ بس. يعني نفس المحيط ما بيعني نفس المساحة.',
      en: 'Both fences are 12 m, but 3 × 3 holds 9 squares and 5 × 1 only 5. So the same perimeter does not mean the same area.',
    },
  },
  transfer: {
    prompt: {
      ar: 'أبو سامي عنده ١٦ متر سياج، وبدو يعمل جنينة مستطيلة فيها أكبر مكان للزرع. محتار بين ٧ × ١ و٥ × ٣ و٤ × ٤. شو بتنصحه؟ وكيف عرفت؟',
      en: 'Abu Sami has 16 m of fence and wants the rectangle garden with the most room for planting. He is choosing between 7 × 1, 5 × 3 and 4 × 4. What do you advise, and how do you know?',
    },
    check: {
      id: 'tr_garden', node: 'C5',
      q: { ar: 'أي جنينة فيها أكبر مكان للزرع؟', en: 'Which garden has the most room for planting?' },
      options: [
        { ar: '٧ × ١', en: '7 × 1' }, { ar: '٥ × ٣', en: '5 × 3' }, { ar: '٤ × ٤', en: '4 × 4' },
        { ar: 'كلهم نفس الإشي', en: 'All the same' },
      ],
      correct: 2,
    },
  },
  rules: [
    {
      idea: 'same_thing',
      re: any(
        `${AREA} (?:و|و )?(?:ال)?محيط (?:(?:هما|هنه|هن|هني|هم) )?(?:نفس الاشي|نفس الشي|نفسهم|واحد|نفس الشغله|شي واحد|اشي واحد)`,
        `${PER} (?:و|و )?(?:ال)?مساحه (?:(?:هما|هنه|هن|هني|هم) )?(?:نفس الاشي|نفس الشي|نفسهم|واحد|نفس الشغله|شي واحد|اشي واحد)`,
        `${AREA} (?:(?:هي|هو|يعني) )?(?:ال)?محيط(?![ء-ي])`,
        `${PER} (?:(?:هو|هي|يعني) )?(?:ال)?مساحه(?![ء-ي]| نفسها| قد بعض| متساويه)`,
        '(?:area (?:and|&) (?:the )?perimeter|perimeter (?:and|&) (?:the )?area)(?: both)? (?:are|mean|measure|is)(?: both)? (?:the )?same',
        '(?:area is|area means) (?:the same (?:as|thing as) )?(?:the )?perimeter',
        '(?<!same )perimeter (?:is|means) (?:the same (?:as|thing as) )?(?:the )?area',
        '(?:area and perimeter|perimeter and area)(?: are)? (?:one|a single) (?:thing|measure)',
      ),
    },
    {
      idea: 'bigger_perimeter_bigger_area',
      re: any(
        `(?:ال)?(?:محيط|سياج|سور)(?:ه|ها)? (?:ال)?(?:اكبر|اطول|اكتر|اكثر)(?: (?:يعني|معناه|فا|ف|اذن|اكيد|لازم|بتكون|رح تكون|فبتكون|هي|هو))* ?(?:ف)?${AREA}(?: (?:هي|رح تكون|بتكون))* (?:ال)?(?:اكبر|اكتر|اكثر)`,
        '(?:اكبر|اطول) (?:محيط|سياج)(?: (?:يعني|معناه|ف|فا))* (?:مساحه اكبر|اكبر مساحه|مساحه اكتر|مساحه اكثر)',
        '(?:كل ما|كلما) (?:زاد|كبر|طال|زادت|كبرت|طالت) (?:ال)?(?:محيط|سياج)(?: (?:ف|فا))* (?:زادت|كبرت|بتزيد|بتكبر|بيزيد|بيكبر|زاد|كبر) (?:ال)?مساحه',
        `${AREA} (?:اكبر|اكتر|اكثر) (?:لانه|لانها|لان|عشان) (?:ال)?(?:محيط|سياج|سور)(?:ه|ها)? (?:ال)?(?:اكبر|اطول|اكتر|اكثر)`,
        '(?:bigger|longer|larger|greater|more) (?:perimeter|fence)(?: (?:always|means|so|gives|has|will|have|then|=|equals|makes|is|a|an|the|it|its))* (?:bigger|larger|more|greater) (?:area|space|room)',
        '(?:bigger|larger|more|greater) (?:area|space) because (?:(?:it has|of) )?(?:(?:an?|the) )?(?:bigger|longer|larger|greater|more) (?:perimeter|fence)',
        '(?:ال)?(?:سياج|سور) (?:ال)?اطول (?:بيساع|بوسع|بيوسع) (?:اكتر|اكثر)',
        'longer fence (?:holds|fits|encloses) more',
        '(?:as|when) (?:the )?(?:perimeter|fence) (?:(?:gets|grows|is) )?(?:bigger|longer|grows)[^.]{0,20}?area (?:(?:gets|is|grows) )?(?:bigger|larger|more|grows|too)',
        'the (?:bigger|longer) the (?:perimeter|fence),? the (?:bigger|larger|more) the (?:area|space)',
      ),
    },
    {
      idea: 'same_perimeter_same_area',
      re: any(
        `(?:نفس|بنفس|متساوي) ${PER}(?: (?:يعني|معناه|فا|ف|اكيد|لازم|اذن|بالتالي|دايما|اذا|هو|فلازم|بيعني))* ?(?:انه )?(?:ف)?(?:نفس (?:ال)?مساحه|${AREA} (?:نفسها|قد بعض|متساويه|نفس الاشي))`,
        `(?:اذا|لما|دام|طالما|ما دام) (?:ال)?(?:محيط|محيطهم|سياج|السياج) (?:نفسه|قد بعض|متساوي|نفس الاشي|نفس الطول)(?: (?:يعني|ف|فا|اذن|اكيد|لازم|بتكون|رح تكون|كمان))* ?${AREA} (?:نفسها|قد بعض|متساويه|نفس الاشي)`,
        `${AREA} (?:نفسها|قد بعض|متساويه|نفس الاشي) (?:لانه|لان|عشان) (?:ال)?(?:محيط|محيطهم|سياج|السياج) (?:نفسه|قد بعض|متساوي|نفس)`,
        '(?:نفس|بنفس) (?:ال)?(?:سياج|سور) (?:يعني |معناه )?نفس (?:ال)?مكان',
        'same fence (?:always )?(?:means|gives) (?:the )?same (?:space|area|room)',
        '(?:اه|نعم) (?:دايما|اكيد) نفس (?:ال)?مساحه',
        'yes,? (?:they )?always (?:have )?(?:the )?same area',
        '(?:ال)?مساحه نفسها (?:لان|لانه|عشان) محيطهم (?:عشرين|عشرون|20|٢٠)',
        'same perimeter (?:means|so) (?:that )?(?:the )?area is (?:also )?(?:the )?same',
        'same perimeter(?: (?:always|means|so|gives|has|have|equals|makes|=|the|that|they|will|must))* same area',
        'if (?:(?:the|their) )?perimeters? (?:(?:are|is) )?(?:the same|equal),? (?:(?:then|so) )?(?:(?:the|their) )?areas? (?:(?:is|are|must be|will be|are also) )?(?:also )?(?:the same|equal)',
        'same area because (?:(?:they have|it has) )?(?:the )?same perimeter',
      ),
    },
    { idea: 'independent', re: any(...differentRoom, `(?:مش|مو) (?:لازم|شرط|دايما)(?: (?:يكون|تكون|يكونو|يكونوا|إلهم|الهم|عندهم))* (?:نفس (?:ال)?مساحه|${AREA} (?:نفسها|قد بعض|متساويه))`, `${AREA}(?: (?:ممكن|بتكون|رح تكون|تكون|بتطلع))* (?:مختلفه|تختلف|بتختلف|مش نفسها)`, 'different areas?', 'not (?:always |necessarily )(?:have )?(?:the )?same area') },
  ],
  samples: [
    { ar: 'مش لازم نفس المساحة، لأنه شكلين بنفس المحيط ممكن مساحتهم مختلفة', en: 'Not always: two shapes with the same perimeter can have different areas.' },
    { ar: 'نفس المحيط يعني نفس المساحة', en: 'Same perimeter means same area.' },
    { ar: 'المحيط الأكبر يعني المساحة أكبر', en: 'A bigger perimeter means a bigger area.' },
    { ar: 'المساحة والمحيط نفس الإشي', en: 'Area and perimeter are the same thing.' },
    { ar: 'المحيط هو الطول حوالين الشكل، والمساحة عدد المربعات اللي جوّا', en: 'Perimeter is the distance around, and area is the number of squares inside.' },
  ],
  preTest: [
    {
      id: 'pre1', node: 'C2',
      q: { ar: 'مستطيل طوله ٦ وعرضه ٢. شو محيطه؟', en: 'A rectangle is 6 by 2. What is its perimeter?' },
      options: [{ ar: '١٢', en: '12' }, { ar: '١٦', en: '16' }, { ar: '٨', en: '8' }],
      correct: 1,
    },
    {
      id: 'pre2', node: 'C3',
      q: { ar: 'مستطيل طوله ٦ وعرضه ٢. كم مربّع وحدة بيغطّيه؟', en: 'A rectangle is 6 by 2. How many unit squares cover it?' },
      options: [{ ar: '١٢', en: '12' }, { ar: '١٦', en: '16' }, { ar: '٨', en: '8' }],
      correct: 0,
    },
    {
      id: 'pre3', node: 'C4',
      q: { ar: 'مستطيلين محيط كل واحد ١٤. شو بنقدر نحكي عن مساحتهم؟', en: 'Two rectangles each have perimeter 14. What can we say about their areas?' },
      options: [
        { ar: 'أكيد قد بعض', en: 'Surely equal' },
        { ar: 'ممكن تكون غير، لازم نعدّ', en: 'They may differ: we must count' },
        { ar: 'كل وحدة ١٤', en: 'Each is 14' },
      ],
      correct: 1,
    },
    {
      id: 'pre4', node: 'C4',
      q: { ar: 'شكل محيطه أطول من شكل ثاني. هل مساحته أكيد أكبر؟', en: 'One shape has a longer perimeter than another. Must its area be bigger?' },
      options: [{ ar: 'آه دايماً', en: 'Yes, always' }, { ar: 'لأ، مش أكيد', en: 'No, not necessarily' }, { ar: 'مساحته أكيد أقل', en: 'Its area is surely smaller' }],
      correct: 1,
    },
  ],
  postTest: [
    {
      id: 'post1', node: 'C2',
      q: { ar: 'بدنا نحط برواز حوالين صورة ٥ × ٣. شو اللي لازم نحسبه؟', en: 'We frame a 5 × 3 picture. What must we work out?' },
      options: [{ ar: 'المساحة: ١٥', en: 'The area: 15' }, { ar: 'المحيط: ١٦', en: 'The perimeter: 16' }, { ar: 'الطول بس: ٥', en: 'Just the width: 5' }],
      correct: 1,
    },
    {
      id: 'post2', node: 'C3',
      q: { ar: 'بدنا نبلّط أرضية ٤ × ٣ ببلاط متر بمتر. كم بلاطة بدنا؟', en: 'We tile a 4 × 3 floor with 1 m tiles. How many tiles?' },
      options: [{ ar: '١٤', en: '14' }, { ar: '٧', en: '7' }, { ar: '١٢', en: '12' }],
      correct: 2,
    },
    {
      id: 'post3', node: 'C4',
      q: { ar: 'سجّادتين: ٦ × ١ و٣ × ٣. وين المساحة أكبر؟ ووين المحيط أطول؟', en: 'Two rugs: 6 × 1 and 3 × 3. Which has more area, and which a longer perimeter?' },
      options: [
        { ar: '٣ × ٣ مساحتها أكبر، و٦ × ١ محيطها أطول', en: '3 × 3 has more area; 6 × 1 a longer perimeter' },
        { ar: '٦ × ١ أكبر بالاثنين', en: '6 × 1 wins both' },
        { ar: '٣ × ٣ أكبر بالاثنين', en: '3 × 3 wins both' },
      ],
      correct: 0,
    },
    {
      id: 'post4', node: 'C5',
      q: { ar: 'مزارع عنده ١٨ متر سياج. أي حوض مستطيل بيعطيه أرض أكثر: ٨ × ١ ولا ٥ × ٤؟', en: 'A farmer has 18 m of fence. Which rectangle plot gives more ground: 8 × 1 or 5 × 4?' },
      options: [{ ar: '٨ × ١', en: '8 × 1' }, { ar: '٥ × ٤', en: '5 × 4' }, { ar: 'نفس الإشي', en: 'The same' }],
      correct: 1,
    },
  ],
  activities: {
    same_perimeter_same_area: {
      type: 'experiment',
      title: { ar: 'خيط واحد، حيشان كثيرة', en: 'One string, many yards' },
      goal: { ar: 'نبني مستطيلات بنفس المحيط ونقارن مساحاتها.', en: 'Build rectangles with one perimeter and compare their areas.' },
      grouping: { ar: 'مجموعات من ٣', en: 'Groups of 3' },
      materials: ['string', 'grid_paper', 'ruler'],
      steps: [
        { minutes: 3, title: { ar: 'توقّعوا', en: 'Predict' }, detail: { ar: 'خيط طوله ٢٠: كل المستطيلات منه بتساع نفس عدد البلاط؟', en: 'A 20 cm string: do all rectangles from it hold the same number of tiles?' } },
        { minutes: 7, title: { ar: 'ابنوا وعدّوا', en: 'Build and count' }, detail: { ar: 'لاقوا كل المستطيلات الممكنة بأضلاع صحيحة، وعبّوا جدول.', en: 'Find every whole-number rectangle and fill a table.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'شو العمود اللي ما تغيّر؟ وشو اللي تغيّر؟ أي شكل ساع أكثر؟', en: 'Which column stayed fixed, which changed, and which shape held most?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'ارسم مستطيلين محيطهم ١٢ ومساحتهم غير.', en: 'Draw two rectangles with perimeter 12 and different areas.' } },
      ],
      teacher: { ar: 'خلّي الجدول يحكي: ما تعطي القاعدة قبل ما يكتشفوها.', en: 'Let the table speak; do not state the rule before they find it.' },
      check: { ar: 'ليش نفس الخيط ساع عدد مربّعات غير؟', en: 'Why did one string hold different numbers of squares?' },
      adapt: { ar: 'للي بده دعم: ورق مربّعات ١ سم وأعواد. للمتقدّم: خيط طوله ٢٤.', en: 'Support: 1 cm grid and sticks. Stretch: a 24 cm string.' },
    },
    bigger_perimeter_bigger_area: {
      type: 'game',
      title: { ar: 'اصطاد المثال المعاكس', en: 'Hunt the counterexample' },
      goal: { ar: 'نلاقي شكل محيطه أطول ومساحته أقل.', en: 'Find a shape with a longer perimeter and a smaller area.' },
      grouping: { ar: 'أزواج', en: 'Pairs' },
      materials: ['grid_paper', 'ruler'],
      steps: [
        { minutes: 3, title: { ar: 'ادّعاء', en: 'The claim' }, detail: { ar: '«كل ما طال المحيط كبرت المساحة». صوّتوا: صح ولا مش أكيد؟', en: '“A longer perimeter always means more area.” Vote: true or not certain?' } },
        { minutes: 7, title: { ar: 'صيد', en: 'Hunt' }, detail: { ar: 'كل زوج بيرسم مستطيلات تا يكسر الادّعاء. نقطة لكل مثال صحيح.', en: 'Pairs draw rectangles to break the claim, one point per valid example.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'مثال واحد بكفّي يكسر «دايماً». ليش؟', en: 'One example breaks an “always”. Why?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'اكتب مثالك المفضّل بالأرقام.', en: 'Write your favourite example with numbers.' } },
      ],
      teacher: { ar: 'وضّح إنه أحياناً الاثنين بيكبروا مع بعض، بس مش دايماً.', en: 'Note that sometimes both grow together, but not always.' },
      check: { ar: 'أعطيني شكلين: الأطول محيط هو الأقل مساحة.', en: 'Give two shapes where the longer perimeter has less area.' },
      adapt: { ar: 'للي بده دعم: ابدأ من ٤ × ٤ وشريط طويل. للمتقدّم: أطول محيط بـ١٢ مربّع.', en: 'Support: start with 4 × 4 and a long strip. Stretch: longest perimeter with 12 squares.' },
    },
    same_thing: {
      type: 'worksheet',
      title: { ar: 'برواز ولا بلاط؟', en: 'Frame or tiles?' },
      goal: { ar: 'نميّز بين قياس الحافّة وقياس اللي جوّا.', en: 'Tell the measure of the edge from the measure of the inside.' },
      grouping: { ar: 'فردي وبعدين أزواج', en: 'Solo, then pairs' },
      materials: ['grid_paper', 'string', 'paper'],
      steps: [
        { minutes: 4, title: { ar: 'لوّنوا', en: 'Colour' }, detail: { ar: 'على كل شكل: الحافّة بلون، والمربّعات اللي جوّا بلون ثاني، وعدّوا الاثنين.', en: 'On each shape colour the edge one way and the inside squares another, and count both.' } },
        { minutes: 6, title: { ar: 'صنّفوا', en: 'Sort' }, detail: { ar: 'مواقف: سياج، سجّاد، برواز، بلاط، دهان حيط. أي قياس بدنا لكل واحد؟', en: 'Situations: fence, carpet, frame, tiles, painting a wall. Which measure for each?' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'ليش وحدة المحيط خط، ووحدة المساحة مربّع؟', en: 'Why is the perimeter unit a length and the area unit a square?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'لشكل ٤ × ٢ اكتب المحيط والمساحة مع الوحدة.', en: 'For a 4 × 2 shape write perimeter and area with units.' } },
      ],
      teacher: { ar: 'انتبه لـ٤ × ٤: العددين طلعوا ١٦ بس الوحدة غير.', en: 'Watch 4 × 4: both numbers are 16 but the units differ.' },
      check: { ar: 'إذا بدنا نشتري سياج، أي قياس بنحتاج؟', en: 'To buy fencing, which measure do we need?' },
      adapt: { ar: 'للي بده دعم: أشياء حقيقية بالصف. للمتقدّم: صمّم أسئلة لزميلك.', en: 'Support: real objects in class. Stretch: write questions for a partner.' },
    },
    _default: {
      type: 'experiment',
      title: { ar: 'حوالين وجوّا', en: 'Around and inside' },
      goal: { ar: 'كل طالب يقيس المحيط والمساحة ويقارن مستطيلين.', en: 'Every learner measures perimeter and area and compares two rectangles.' },
      grouping: { ar: 'أزواج', en: 'Pairs' },
      materials: ['grid_paper', 'string', 'ruler'],
      steps: [
        { minutes: 3, title: { ar: 'توقّعوا', en: 'Predict' }, detail: { ar: '٥ × ٥ و٩ × ١: وين المكان جوّا أكثر؟ كل واحد بيكتب.', en: '5 × 5 and 9 × 1: which has more room inside? Each writes.' } },
        { minutes: 7, title: { ar: 'قيسوا', en: 'Measure' }, detail: { ar: 'خيط للحافّة، وعدّ مربّعات للجوّا، لتلات مستطيلات.', en: 'String for the edge, counting for the inside, on three rectangles.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'هل المحيط لحاله بيعرّفنا المساحة؟ شو الدليل؟', en: 'Does perimeter alone tell us the area? What is the evidence?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'جملة: شو الفرق بين المحيط والمساحة؟', en: 'One sentence: how do perimeter and area differ?' } },
      ],
      teacher: { ar: 'اطلب الوحدة مع كل عدد.', en: 'Ask for a unit with every number.' },
      check: { ar: 'مستطيلين محيطهم ١٤: كيف بتعرف مين مساحته أكبر؟', en: 'Two rectangles of perimeter 14: how do you find the bigger area?' },
      adapt: { ar: 'للي بده دعم: مربّعات ورق للتغطية. للمتقدّم: أكبر مساحة بمحيط ٢٤.', en: 'Support: paper tiles. Stretch: largest area with perimeter 24.' },
    },
    _enrich: {
      type: 'peer',
      title: { ar: 'مهندسين الجنينة', en: 'Garden designers' },
      goal: { ar: 'نصمّم جنينة بشروط على المحيط والمساحة مع بعض.', en: 'Design gardens that meet conditions on perimeter and area together.' },
      grouping: { ar: 'مجموعات من ٤', en: 'Groups of 4' },
      materials: ['grid_paper', 'ruler', 'paper'],
      steps: [
        { minutes: 5, title: { ar: 'طلب الزبون', en: 'The brief' }, detail: { ar: 'سياج ٢٤ متر وأكبر أرض زرع. صمّموا وبرّروا.', en: 'A 24 m fence and the most planting ground. Design and justify.' } },
        { minutes: 6, title: { ar: 'طلب ثاني', en: 'Second brief' }, detail: { ar: 'أرض ١٢ متر مربّع بأقل سياج.', en: '12 square metres of ground with the least fence.' } },
        { minutes: 4, title: { ar: 'تقييم الأقران', en: 'Peer review' }, detail: { ar: 'مجموعة بتفحص حسابات مجموعة تانية.', en: 'One group checks another group’s numbers.' } },
      ],
      teacher: { ar: 'شجّعهم يجرّبوا جدول منظّم لكل الأبعاد.', en: 'Encourage an organised table of all dimensions.' },
      check: { ar: 'ليش تصميمكم أحسن من غيره؟', en: 'Why is your design better than another?' },
      adapt: { ar: 'للي بده دعم: أبعاد مقترحة. للمتقدّم: جنينة ملاصقة لحيط (سياج لتلات جهات).', en: 'Support: suggested dimensions. Stretch: a garden against a wall (fence three sides).' },
    },
  },
};
