/**
 * حزمة «السفينة والكرة» — علوم، الصفوف ٣–٦: ليش إشي بيطفو وإشي بيغرق.
 *
 * Reference model (fresh water, 1 g/cm³):
 *   floats  ⇔  total mass (g)  <  maximum displaced volume (cm³) × 1 g/cm³
 * "Maximum displaced volume" is the volume of a solid object, or for an open boat the volume up to its rim.
 * Cargo is coins fixed on (or placed in) the object. Cargo masses are chosen so the verdict stays the same even
 * if the coins end up under water and push some water aside themselves (tests/math.test.ts checks this).
 * Slow pushing adds no lift, so the "moving" variable never changes the reference result.
 */
import type { ChildModel, Conditions, L } from '../contracts';
import type { ConceptPack } from './types';

type Out = 'floats' | 'sinks';
export type Material = 'cork' | 'wood' | 'glass' | 'steel' | 'clay';

export interface FloatObject {
  /** grams */
  mass: number;
  /** cm³: the most water it can push aside before it is fully under (a boat: up to the rim) */
  volume: number;
  material: Material;
  boat: boolean;
}

export const OBJECTS: Record<string, FloatObject> = {
  steel_ball: { mass: 39, volume: 5, material: 'steel', boat: false },
  steel_boat: { mass: 39, volume: 120, material: 'steel', boat: true },
  big_steel_boat: { mass: 400, volume: 900, material: 'steel', boat: true },
  clay_ball: { mass: 60, volume: 35, material: 'clay', boat: false },
  clay_boat: { mass: 60, volume: 150, material: 'clay', boat: true },
  wood_block: { mass: 300, volume: 500, material: 'wood', boat: false },
  cork: { mass: 5, volume: 20, material: 'cork', boat: false },
  marble: { mass: 5, volume: 2, material: 'glass', boat: false },
};

/** grams of coins */
export const CARGO: Record<string, number> = { none: 0, coins: 50, many_coins: 150 };

export const totalMass = (c: Conditions): number => OBJECTS[c.object].mass + CARGO[c.cargo];

function realOutcome(c: Conditions): Out {
  // density of water is 1 g/cm³, so the water it can push aside weighs `volume` grams
  return totalMass(c) < OBJECTS[c.object].volume ? 'floats' : 'sinks';
}

/** thresholds of the weight-only ideas: "heavy" from 30 g up, "light" up to 50 g */
export const HEAVY_FROM = 30;
export const LIGHT_UP_TO = 50;

function kidOutcome(m: ChildModel, c: Conditions): Out {
  const wrong = m.sources.filter((s) => s !== 'displacement');
  if (!wrong.length) return realOutcome(c);
  const o = OBJECTS[c.object];
  const total = totalMass(c);
  // "the engine / the movement holds the ship up": a ship floats only while it is moving
  if (wrong.includes('engine_holds') && o.boat) return c.state === 'moving' ? 'floats' : 'sinks';
  const lightStuff = o.material === 'cork' || o.material === 'wood';
  const votes = wrong.map((s): Out => {
    if (s === 'heavy_sinks') return total >= HEAVY_FROM ? 'sinks' : 'floats';
    if (s === 'light_floats') return total <= LIGHT_UP_TO ? 'floats' : 'sinks';
    // material_only, and engine_holds for things that are not ships: wood and cork float, the rest sinks
    return lightStuff ? 'floats' : 'sinks';
  });
  return votes.includes('sinks') ? 'sinks' : 'floats';
}

const arDigits = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

function measure(c: Conditions): L {
  const o = OBJECTS[c.object];
  const cargo = CARGO[c.cargo];
  const total = totalMass(c);
  return {
    ar: `الكتلة: ${arDigits(total)} غ${cargo ? ` (الغرض ${arDigits(o.mass)} غ + نقود ${arDigits(cargo)} غ)` : ''}. أكتر مي بيقدر يزيحها: ${arDigits(o.volume)} سم³، وكتلتها ${arDigits(o.volume)} غ.`,
    en: `Mass: ${total} g${cargo ? ` (object ${o.mass} g + coins ${cargo} g)` : ''}. Most water it can push aside: ${o.volume} cm³, which has a mass of ${o.volume} g.`,
  };
}

/* ───────────── offline language patterns (written against normaliseText output) ───────────── */

const any = (...parts: string[]) => new RegExp(parts.join('|'));

/** words that show the learner is reasoning with displaced water or density, so weight words are only a part */
const DISPLACEMENT_TALK = /بيزيح|بتزيح|يزيح|تزيح|ازاح|مزاح|كثاف|displac|densit|\bdens(?:e|er)\b|buoyan/;

const stepPushUp = any(
  '(?:المي|الماء|الميه|البحر)(?: (?:كمان|هي|لحالها|دايما))? (?:بتدفش|بتدفع|بتزق|بيدفع|يدفع|تدفع|بترفع|بيرفع|بتحمل|بيحمل|بتسند)',
  '(?:دفع|دفعه|دفشه|قوه|قوه دفع) (?:ال)?(?:مي|ماء|ميه)(?![ء-ي])',
  '(?:بتندفش|بيندفش|بيندفع|بتندفع)(?: من المي)? لفوق',
  'water (?:pushes|pushing|push)(?: (?:on|up on))?(?: (?:it|them|the (?:ship|boat|ball|object|things?)|objects?|things?))?(?: back)? up',
  '(?:pushed|push) up(?:wards?)? by (?:the )?water', '(?:upward|up) (?:push|force) (?:from|of) (?:the )?water',
  'upthrust', 'buoyant force', 'buoyancy',
);

/** a word that is not a negator, preceded by a space */
const GAP = '(?: (?!(?:ما|مش|مو|لا) )[^ .!?؟]+)';

const stepMoreWater = any(
  `(?:بتزيح|بيزيح|تزيح|يزيح|ازاح|بيبعد|بتبعد|بياخد مكان|بتاخد مكان)${GAP}{0,2}? (?:اكثر|اكتر|اكبر|كثير|كتير)(?![ء-ي])`,
  '(?:بتزيح|بيزيح|تزيح|يزيح) (?:ال)?(?:مي|ماء|ميه)',
  '(?:المي|الماء) (?:المزاحه|المزاح)',
  '(?:مي|ماء) (?:اكثر|اكتر|كثير|كتير) (?:بتنزاح|مزاحه)',
  `(?:شكل|شكله|شكلها)${GAP}{0,5}? (?:مي اكثر|مي اكتر|مجوف|مجوفه)`,
  '(?:push|pushes|pushing|pushed|move|moves)(?: (?:aside|away))? (?:more|a lot of|lots of|enough|much) water',
  '(?:push|pushes|pushing|pushed|move|moves) (?:aside|away) (?:(?:the|much|more) )?water',
  'displac(?:e|es|ed|ing)(?: (?:more|a lot of|lots of|enough|much|the))? water',
  '(?:more|a lot of|lots of) water (?:is )?(?:pushed|displaced|moved)',
);

const stepBalance = any(
  `(?:كثافه|كثافته|كثافتها)${GAP}{0,3}? (?:اقل|اخف|ازغر|اصغر) من (?:كثافه )?(?:ال)?(?:مي|ماء|ميه)`,
  `(?:دفع|دفعه|دفشه|المي|الماء)${GAP}{0,4}? (?:بتكفي|بيكفي|تكفي|يكفي|قد|بتساوي|يساوي|تساوي|بتوازن|يوازن|توازن|اكبر من|بتقدر تحمل|بيقدر يحمل|تقدر تحمل) (?:ل)?(?:وزن|تقل|كتله)`,
  '(?:بتكفي|تحمل|يحمل|توازن|يوازن|بتحمل|بيحمل) (?:وزن|تقل)(?:ه|ها)?(?: كله)? قبل',
  'قبل ما (?:يغطس|تغطس|ينغمر|تنغمر)',
  '(?:وزنه|وزنها|كتلته|كتلتها) (?:اقل|اخف) من (?:وزن |كتله )?(?:ال)?(?:مي|ماء)',
  'densit(?:y|ies) (?:is |are )?(?:less|lower|smaller) than (?:that of )?(?:the )?water', '(?:less|lower) dense than water',
  '(?:balance|balances|support|supports|hold|holds|match|matches|carry|carries) (?:its|the|his|her|all its) weight',
  '(?:push|force)(?: [a-z]+){0,4}? (?:as much as|more than|equal to) (?:its|the) weight',
  'before (?:it )?(?:goes|is|gets|sinks) (?:all the way |fully |completely )?under',
  'weighs? less than the water (?:it )?(?:can )?(?:push|displace)',
);

export const buoyancy: ConceptPack = {
  id: 'buoyancy',
  subject: 'science',
  title: { ar: 'السفينة والكرة', en: 'The ship and the ball' },
  question: {
    ar: 'ليش السفينة التقيلة بتضل على وش المي، وقطعة معدن صغيرة بتغرق؟',
    en: 'Why does a heavy ship float while a small metal object sinks?',
  },
  grades: [3, 6],
  curriculum: {
    verified: false,
    note: {
      ar: 'لسا ما راجعنا هالدرس مع كتاب العلوم الفلسطيني المطبوع.',
      en: 'Not yet checked against the printed Palestinian science textbook.',
    },
  },
  objectives: [
    { id: 'o_push', text: { ar: 'أوصف إن المي بتدفع الأغراض لفوق.', en: 'Describe that water pushes objects upwards.' }, nodes: ['C1'] },
    { id: 'o_shape', text: { ar: 'أربط شكل الإشي بكمية المي اللي بيقدر يزيحها.', en: 'Link an object’s shape to how much water it can push aside.' }, nodes: ['C2', 'C3'] },
    { id: 'o_decide', text: { ar: 'أتوقّع الطفو من الوزن والمي المزاحة مع بعض.', en: 'Predict floating from mass and displaced water together.' }, nodes: ['C4', 'C5'] },
  ],
  concepts: {
    C1: { label: { ar: 'المي بتدفع لفوق', en: 'Water pushes up' }, ai: 'water pushes upwards on objects in it', needs: [] },
    C2: { label: { ar: 'الإشي بيزيح مي', en: 'Objects push water aside' }, ai: 'an object in water takes up space and pushes water aside', needs: [] },
    C3: { label: { ar: 'الشكل بيغيّر المي المزاحة', en: 'Shape changes the water displaced' }, ai: 'a hollow shape can push aside more water than the same material as a lump, giving a bigger upward push', needs: ['C1', 'C2'] },
    C4: { label: { ar: 'الوزن مقابل الدفع', en: 'Weight against the push' }, ai: 'it floats when the push can balance its weight before it is fully under (average density lower than water)', needs: ['C3'] },
    C5: { label: { ar: 'سفن ومراكب وطوّافات', en: 'Ships, boats and rafts' }, ai: 'the same rule explains ships, rafts, swim rings and why a flooded boat sinks', needs: ['C4'] },
  },
  prerequisites: [
    {
      id: 'mass_and_size',
      label: { ar: 'الوزن مش هو الحجم', en: 'Mass is not size' },
      why: { ar: 'لازم نفرّق بين «قدّيش تقيل» و«قدّيش كبير».', en: 'We must separate “how heavy” from “how big”.' },
      supports: ['C3', 'C4'],
      suspect: { ideas: ['heavy_sinks', 'light_floats'], missingSteps: [2] },
      verify: [
        {
          id: 'ms_v1', node: 'C4',
          q: { ar: 'كرتين قد بعض: وحدة حديد ووحدة فلّين. أي وحدة أتقل؟', en: 'Two balls of one size: iron and cork. Which is heavier?' },
          options: [{ ar: 'الحديد', en: 'The iron one' }, { ar: 'الفلّين', en: 'The cork one' }, { ar: 'قد بعض لأنهم قد بعض', en: 'The same, they are one size' }],
          correct: 0,
        },
        {
          id: 'ms_v2', node: 'C4',
          q: { ar: 'ممكن إشي كبير يكون أخف من إشي صغير؟', en: 'Can a big thing be lighter than a small thing?' },
          options: [{ ar: 'آه، زي إسفنجة كبيرة وحجر صغير', en: 'Yes, like a big sponge and a small stone' }, { ar: 'لأ، الكبير دايماً أتقل', en: 'No, big is always heavier' }],
          correct: 0,
        },
      ],
      remedy: {
        title: { ar: 'نوزن بإيدينا', en: 'Weigh by hand' },
        minutes: 5,
        steps: [
          { ar: 'امسك بكل إيد غرض: كبير وخفيف، وصغير وتقيل.', en: 'Hold one object in each hand: a big light one and a small heavy one.' },
          { ar: 'رتّب خمس أغراض مرّة حسب الحجم ومرّة حسب الوزن.', en: 'Order five objects by size, then by heaviness.' },
          { ar: 'احكي: هل الترتيبين طلعوا نفس الإشي؟', en: 'Say: did the two orders match?' },
        ],
      },
      recheck: {
        id: 'ms_r', node: 'C4',
        q: { ar: 'طابة بحر كبيرة وكرة حديد صغيرة. أي وحدة أتقل؟', en: 'A big beach ball and a small iron ball. Which is heavier?' },
        options: [{ ar: 'طابة البحر لأنها أكبر', en: 'The beach ball, it is bigger' }, { ar: 'غالباً كرة الحديد، مع إنها أصغر', en: 'Probably the iron ball, although it is smaller' }],
        correct: 1,
      },
    },
    {
      id: 'takes_space',
      label: { ar: 'الإشي بالمي بياخد مكان', en: 'Things in water take up space' },
      why: { ar: 'عشان نفهم الطفو لازم نشوف إن الغرض بيبعد المي عن مكانه.', en: 'To understand floating we need to see that objects push water out of the way.' },
      supports: ['C2', 'C3'],
      suspect: { ideas: ['material_only'], missingSteps: [1] },
      verify: [
        {
          id: 'ts_v1', node: 'C2',
          q: { ar: 'حطّينا حجر بكاسة مي. شو بصير بمستوى المي؟', en: 'We put a stone in a glass of water. What happens to the water level?' },
          options: [{ ar: 'بيعلى', en: 'It rises' }, { ar: 'بينزل', en: 'It falls' }, { ar: 'بيضل زي ما هو', en: 'It stays' }],
          correct: 0,
        },
        {
          id: 'ts_v2', node: 'C2',
          q: { ar: 'حجرين، واحد كبير وواحد صغير، غطسوا بالمي. أي واحد بيعلّي المي أكثر؟', en: 'A big stone and a small stone are fully under. Which raises the water more?' },
          options: [{ ar: 'الكبير', en: 'The big one' }, { ar: 'الصغير', en: 'The small one' }, { ar: 'الاثنين نفس الإشي', en: 'Both the same' }],
          correct: 0,
        },
      ],
      remedy: {
        title: { ar: 'وين راحت المي؟', en: 'Where did the water go?' },
        minutes: 5,
        steps: [
          { ar: 'عبّي كاسة لنصّها وعلّم مستوى المي.', en: 'Half-fill a glass and mark the water level.' },
          { ar: 'نزّل غرض صغير، وبعدين أكبر، وعلّم كل مرّة.', en: 'Lower a small object, then a bigger one, marking each time.' },
          { ar: 'احكي: شو علاقة قدّ الغرض بالعلامة؟', en: 'Say: how does the object’s size relate to the mark?' },
        ],
      },
      recheck: {
        id: 'ts_r', node: 'C2',
        q: { ar: 'ليش مستوى المي بيعلى لما نقعد بحوض الاستحمام؟', en: 'Why does bath water rise when we sit in it?' },
        options: [{ ar: 'لأن جسمنا بياخد مكان المي وبيبعدها', en: 'Our body takes the water’s place and pushes it away' }, { ar: 'لأن المي بتكتر', en: 'Because more water appears' }],
        correct: 0,
      },
    },
  ],
  reference: {
    model: {
      ar: 'المي بتدفع أي إشي فيها لفوق بقوة قد وزن المي اللي أزاحها (مبدأ أرخميدس). الإشي بيطفو إذا كتلته أقل من كتلة أكتر مي بيقدر يزيحها قبل ما يغطس كله، يعني كثافته المتوسطة (مع الهوا اللي جوّا القارب) أقل من كثافة المي.',
      en: 'Water pushes an object up with a force equal to the weight of the water it displaces (Archimedes’ principle). It floats if its mass is less than the mass of the most water it can displace before it is fully under, that is, its average density (including the air inside a hull) is below that of water.',
    },
    limits: {
      ar: 'مي حلوة كثافتها ١ غ/سم³ (مي البحر أكثف شوي). الأرقام تقريبية لأغراض صفّية. القارب المفتوح بيغرق لما المي تفوت من فوق طرفه. ما بنمثّل: شدّ سطح المي (إبرة أو مشبك ممكن يضلّوا فوق)، فقاعات الهوا العالقة، الخشب اللي بيشرب مي مع الوقت، والأجسام السريعة اللي بترفعها سرعتها (زي الحجر اللي بينطّ عالمي أو بعض الزوارق). «ماشي» يعني دفش بطيء، والنقود مثبّتة على الغرض.',
      en: 'Fresh water at 1 g/cm³ (sea water is slightly denser). Rounded model numbers for classroom objects. An open boat sinks once water passes its rim. Not modelled: surface tension (a needle or paper clip can rest on water), trapped air bubbles, wood soaking up water over time, and fast objects lifted by their speed (skipping stones, some speedboats). “Moving” means pushed slowly, and the coins are fixed to the object.',
    },
    sources: [
      { title: 'OpenStax, College Physics — Archimedes’ Principle' },
      { title: 'Archimedes, On Floating Bodies' },
    ],
  },

  ideas: {
    displacement: {
      label: { ar: 'المي المزاحة مقابل الوزن', en: 'Displaced water against weight' },
      mirror: {
        ar: 'هيك إنت شايفها: المي بتدفع لفوق، والشكل اللي بيزيح مي أكثر بياخد دفعة أكبر، وإذا كفّت وزنه بيطفو.',
        en: 'You see it like this: water pushes up, a shape that pushes aside more water gets a bigger push, and if that matches its weight it floats.',
      },
      observation: { ar: 'نفس المادة مرّة بتطفو ومرّة بتغرق حسب شكلها.', en: 'The same material can float or sink depending on its shape.' },
      assumption: { ar: 'دفعة المي بتكبر مع المي المزاحة.', en: 'The water’s push grows with the water pushed aside.' },
      conclusion: { ar: 'الطفو بيعتمد على الوزن والمي المزاحة مع بعض.', en: 'Floating depends on mass and displaced water together.' },
      story: [
        { ar: 'الإشي بينزل بالمي وبيزيحها', en: 'The object goes in and pushes water aside' },
        { ar: 'المي بتدفعه لفوق', en: 'The water pushes it up' },
        { ar: 'إذا الدفعة كفّت وزنه بيطفو', en: 'If the push matches its weight, it floats' },
      ],
      wrongStep: null,
      correct: true,
      breaks: null,
      model: { sources: ['displacement'], path: 'water_push', requires: [] },
      intervention: {
        ar: 'اطلب منه يتوقّع قبل التجربة من رقمين: كتلة القارب وأكتر مي بيقدر يزيحها.',
        en: 'Ask the learner to predict from two numbers before testing: the boat’s mass and the most water it can push aside.',
      },
      ai: 'correct idea: water pushes up according to the water pushed aside; a shape that displaces enough water to balance its weight floats (average density below water)',
    },
    heavy_sinks: {
      label: { ar: 'التقيل بيغرق', en: 'Heavy things sink' },
      mirror: { ar: 'هيك إنت شايفها: الإشي التقيل المي ما بتقدر تحمله، فبيغرق.', en: 'You see it like this: water cannot hold a heavy thing, so it sinks.' },
      observation: { ar: 'الحجر التقيل بينزل لتحت.', en: 'A heavy stone goes down.' },
      assumption: { ar: 'الوزن لحاله بيقرّر.', en: 'Weight alone decides.' },
      conclusion: { ar: 'كل إشي تقيل بيغرق.', en: 'Every heavy thing sinks.' },
      story: [
        { ar: 'بشوف قدّيش الإشي تقيل', en: 'I check how heavy it is' },
        { ar: 'التقيل المي ما بتحمله', en: 'Water cannot hold heavy things' },
        { ar: 'فبيغرق', en: 'So it sinks' },
      ],
      wrongStep: 1,
      breaks: 'C4',
      model: { sources: ['heavy_sinks'], path: 'weight_decides', requires: [] },
      intervention: {
        ar: 'خلّيه يوزن خشبة كبيرة وحجر صغير، يتوقّع، وبعدين يحطّهم بالمي.',
        en: 'Have the learner weigh a big block of wood and a small stone, predict, then put both in water.',
      },
      ai: 'thinks heavy objects sink because they are heavy, whatever their shape or size',
    },
    light_floats: {
      label: { ar: 'الخفيف بيطفو', en: 'Light things float' },
      mirror: { ar: 'هيك إنت شايفها: الإشي الخفيف دايماً بيضل فوق المي.', en: 'You see it like this: a light thing always stays on top of the water.' },
      observation: { ar: 'الفلّين والريشة بيضلّوا فوق.', en: 'Cork and feathers stay on top.' },
      assumption: { ar: 'الخفّة لحالها بتكفّي.', en: 'Being light is enough.' },
      conclusion: { ar: 'كل إشي خفيف بيطفو.', en: 'Every light thing floats.' },
      story: [
        { ar: 'الإشي خفيف', en: 'The thing is light' },
        { ar: 'الخفيف مكانه فوق', en: 'Light things belong on top' },
        { ar: 'فبيطفو', en: 'So it floats' },
      ],
      wrongStep: 1,
      breaks: 'C4',
      model: { sources: ['light_floats'], path: 'weight_decides', requires: [] },
      intervention: {
        ar: 'اعرض بنّورة زجاج وفلّينة بنفس الكتلة تقريباً، وخلّيه يتوقّع لكل وحدة.',
        en: 'Show a glass marble and a cork of about the same mass and ask for a prediction for each.',
      },
      ai: 'thinks light objects float because they are light, whatever their size',
    },
    material_only: {
      label: { ar: 'المادة بس بتقرّر', en: 'Only the material decides' },
      mirror: { ar: 'هيك إنت شايفها: المعدن دايماً بيغرق، والشكل ما بيغيّر إشي.', en: 'You see it like this: metal always sinks and the shape changes nothing.' },
      observation: { ar: 'المسمار والمفتاح بيغرقوا.', en: 'Nails and keys sink.' },
      assumption: { ar: 'الطفو صفة للمادة بس.', en: 'Floating belongs to the material alone.' },
      conclusion: { ar: 'نفس المادة بتعمل نفس الإشي بأي شكل.', en: 'One material behaves the same in any shape.' },
      story: [
        { ar: 'بشوف من شو معمول', en: 'I check what it is made of' },
        { ar: 'المعدن دايماً بيغرق', en: 'Metal always sinks' },
        { ar: 'الشكل ما بيفرق', en: 'Shape makes no difference' },
      ],
      wrongStep: 1,
      breaks: 'C3',
      model: { sources: ['material_only'], path: 'material_decides', requires: [] },
      intervention: {
        ar: 'أعطيه قطعة معجون: يجرّبها كرة، وبعدين يشكّلها بإيده تا تضل فوق المي.',
        en: 'Give a lump of clay: test it as a ball, then let the learner reshape it until it stays on the water.',
      },
      ai: 'thinks only the material decides and shape does not matter, e.g. metal always sinks',
    },
    engine_holds: {
      label: { ar: 'الموتور بيحملها', en: 'The engine holds it up' },
      mirror: {
        ar: 'هيك إنت شايفها: السفينة بتضل فوق لأن الموتور وحركتها بيحملوها.',
        en: 'You see it like this: the ship stays up because its engine and movement hold it.',
      },
      observation: { ar: 'السفن إلها موتور وبتتحرّك.', en: 'Ships have engines and move.' },
      assumption: { ar: 'الحركة بتمنع الإشي من النزول.', en: 'Movement stops a thing from going down.' },
      conclusion: { ar: 'لو وقف الموتور، السفينة بتغرق.', en: 'If the engine stops, the ship sinks.' },
      story: [
        { ar: 'السفينة تقيلة', en: 'The ship is heavy' },
        { ar: 'الموتور والحركة بيحملوها', en: 'The engine and movement hold it up' },
        { ar: 'إذا وقفت بتنزل', en: 'If it stops, it goes down' },
      ],
      wrongStep: 1,
      breaks: 'C1',
      model: { sources: ['engine_holds'], path: 'engine_lifts', requires: ['moving'] },
      intervention: {
        ar: 'حط قارب لعبة بدون موتور على مي واقفة، واتركه دقيقتين. شو بيلاحظ؟',
        en: 'Put a toy boat with no engine on still water and leave it for two minutes. What does the learner notice?',
      },
      ai: 'thinks a ship floats because its engine or its movement holds it up',
    },
  },
  paths: {
    water_push: { label: { ar: 'المي بتدفع حسب المي المزاحة', en: 'Water push from displaced water' }, ai: 'the water pushes up according to how much water is pushed aside' },
    weight_decides: { label: { ar: 'الوزن بيقرّر', en: 'Weight decides' }, ai: 'only how heavy or light the object is decides' },
    material_decides: { label: { ar: 'المادة بتقرّر', en: 'Material decides' }, ai: 'only what the object is made of decides' },
    engine_lifts: { label: { ar: 'الحركة بتحمل', en: 'Movement holds it up' }, ai: 'an engine or movement keeps it up' },
  },
  requires: {
    moving: { label: { ar: 'بدها حركة أو موتور', en: 'Needs movement or an engine' }, ai: 'floating needs an engine or movement' },
    hollow: { label: { ar: 'بدها شكل مجوّف', en: 'Needs a hollow shape' }, ai: 'floating needs a hollow, wide shape' },
  },
  correctModel: { sources: ['displacement'], path: 'water_push', requires: [] },
  steps: [
    {
      node: 'C1',
      text: { ar: 'المي بتدفع الأغراض لفوق.', en: 'Water pushes objects up.' },
      test: stepPushUp,
      noorSays: { ar: 'المي بتدفع الأغراض لفوق.', en: 'Water pushes things up.' },
      noorAsks: { ar: 'والمي نفسها، بتعمل إشي للأغراض اللي فيها؟', en: 'And the water itself, does it do anything to things in it?' },
    },
    {
      node: 'C3',
      text: { ar: 'كل ما شكل الإشي بيقدر يزيح مي أكثر، بتكبر الدفعة.', en: 'The more water an object’s shape can push aside, the bigger the push.' },
      test: stepMoreWater,
      noorSays: { ar: 'كل ما الشكل بيزيح مي أكثر، بتكبر دفعة المي.', en: 'A shape that pushes aside more water gets a bigger push.' },
      noorAsks: { ar: 'شكل الإشي، شو بيغيّر بالمي اللي حواليه؟', en: 'What does an object’s shape change about the water around it?' },
    },
    {
      node: 'C4',
      text: {
        ar: 'بيطفو لما المي المزاحة بتقدر توازن وزنه قبل ما يغطس كله (كثافته المتوسطة أقل من المي).',
        en: 'It floats when pushing water aside can balance its weight before it is fully under (average density below water).',
      },
      test: stepBalance,
      noorSays: { ar: 'إذا الدفعة قدرت تحمل وزنه قبل ما يغطس كله، بيطفو.', en: 'If the push can hold its weight before it is fully under, it floats.' },
      noorAsks: { ar: 'طيب إيمتى بالزبط بيضل فوق، وإيمتى بينزل؟', en: 'So when exactly does it stay up, and when does it go down?' },
    },
  ],

  variables: [
    {
      id: 'object', label: { ar: 'الغرض', en: 'Object' },
      options: [
        { id: 'steel_ball', label: { ar: 'كرة حديد صغيرة', en: 'Small steel ball' } },
        { id: 'steel_boat', label: { ar: 'قارب من نفس كمية حديد الكرة', en: 'Boat made of the ball’s steel' } },
        { id: 'big_steel_boat', label: { ar: 'سفينة حديد كبيرة (مجسّم)', en: 'Big steel model ship' } },
        { id: 'clay_ball', label: { ar: 'كرة معجون', en: 'Clay ball' } },
        { id: 'clay_boat', label: { ar: 'قارب من نفس المعجون', en: 'Boat of the same clay' } },
        { id: 'wood_block', label: { ar: 'قطعة خشب كبيرة', en: 'Big wooden block' } },
        { id: 'cork', label: { ar: 'فلّينة', en: 'Cork' } },
        { id: 'marble', label: { ar: 'بنّورة زجاج', en: 'Glass marble' } },
      ],
    },
    {
      id: 'cargo', label: { ar: 'الحمولة', en: 'Cargo' },
      options: [
        { id: 'none', label: { ar: 'بدون حمولة', en: 'No cargo' } },
        { id: 'coins', label: { ar: 'شوية نقود', en: 'A few coins' } },
        { id: 'many_coins', label: { ar: 'نقود كثير', en: 'Many coins' } },
      ],
    },
    {
      id: 'state', label: { ar: 'الحركة', en: 'Movement' },
      options: [
        { id: 'still', label: { ar: 'واقف بهدوء', en: 'Staying still' } },
        { id: 'moving', label: { ar: 'ماشي (حدا بيزقّه شوي شوي)', en: 'Moving (gently pushed along)' } },
      ],
    },
  ],
  baseline: { object: 'steel_ball', cargo: 'none', state: 'still' },
  experiments: [
    {
      id: 'steel_ball',
      name: { ar: 'كرة حديد صغيرة', en: 'A small steel ball' },
      short: { ar: 'كرة حديد', en: 'Steel ball' },
      change: {},
      question: { ar: 'بنحط كرة حديد صغيرة بحوض المي. شو بصير فيها؟', en: 'We put a small steel ball in a basin of water. What happens to it?' },
      choices: ['floats', 'sinks'],
      minutes: 4,
      materials: ['basin', 'water', 'small_objects'],
      safety: { adult: false, note: { ar: 'الكرات الصغيرة ما بتنحط بالتم. امسحوا المي المكبوبة بسرعة ومعكم كبير.', en: 'Small balls never go in mouths. Wipe spills quickly, with an adult’s help.' } },
      minGrade: 3,
      targets: ['C4'],
      home: {
        steps: [
          { ar: 'عبّوا وعاء كبير مي لنصّه على أرض مستوية.', en: 'Half-fill a large basin on a flat surface.' },
          { ar: 'جيبوا غرض معدن صغير وأملس، زي صامولة أو قطعة نقود.', en: 'Take a small smooth metal object, such as a nut or a coin.' },
          { ar: 'نزّلوه بهدوء وراقبوا.', en: 'Lower it gently and watch.' },
        ],
        record: { ar: 'ارسموا وين استقرّ الغرض.', en: 'Draw where the object ended up.' },
        reflect: [{ ar: 'كان خفيف ولا تقيل بإيدك؟', en: 'Did it feel light or heavy in your hand?' }],
      },
    },
    {
      id: 'steel_boat',
      name: { ar: 'نفس الحديد، شكل قارب', en: 'Same steel, boat shape' },
      short: { ar: 'قارب حديد', en: 'Steel boat' },
      change: { object: 'steel_boat' },
      question: { ar: 'أخدنا نفس كمية حديد الكرة وعملناها قارب، وتركناه واقف على المي. شو بصير؟', en: 'The same amount of steel as the ball is shaped into a boat and left still on the water. What happens?' },
      choices: ['floats', 'sinks'],
      minutes: 6,
      materials: ['basin', 'water', 'metal_cup'],
      safety: { adult: false, note: { ar: 'استعملوا وعاء معدن أطرافه ملسا، بدون صفايح حادّة. وامسحوا المي المكبوبة ومعكم كبير.', en: 'Use a smooth-edged metal cup or bowl, never sharp sheet metal. Wipe spills with an adult’s help.' } },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          { ar: 'جيبوا كاسة معدن خفيفة أو صحن معدن أملس فاضي.', en: 'Take a light metal cup or a smooth empty metal bowl.' },
          { ar: 'حطّوه على وش المي وفتحته لفوق.', en: 'Set it on the water with the opening up.' },
          { ar: 'بعدين نزّلوه على جنبه تا تعبّيه المي.', en: 'Then tip it on its side so water fills it.' },
        ],
        record: { ar: 'ارسموا الحالتين.', en: 'Draw both cases.' },
        reflect: [
          { ar: 'نفس الكاسة، نفس المعدن. شو تغيّر؟', en: 'Same cup, same metal. What changed?' },
        ],
      },
    },
    {
      id: 'wood_block',
      name: { ar: 'خشبة كبيرة وتقيلة', en: 'A big heavy block of wood' },
      short: { ar: 'خشبة', en: 'Wood' },
      change: { object: 'wood_block' },
      question: { ar: 'قطعة خشب كبيرة، أتقل من كرة الحديد بكثير. شو بصير فيها بالمي؟', en: 'A big block of wood, much heavier than the steel ball. What happens to it in water?' },
      choices: ['floats', 'sinks'],
      minutes: 5,
      materials: ['basin', 'water', 'small_objects'],
      safety: { adult: false, note: { ar: 'اختاروا خشبة ملسا بدون شظايا. امسحوا المي المكبوبة ومعكم كبير.', en: 'Use smooth wood without splinters. Wipe spills with an adult’s help.' } },
      minGrade: 3,
      targets: ['C4'],
      home: {
        steps: [
          { ar: 'جيبوا مكعّب خشب كبير وحجر صغير.', en: 'Take a large wooden block and a small stone.' },
          { ar: 'احملوهم وقرّروا مين أتقل.', en: 'Hold them and decide which is heavier.' },
          { ar: 'حطّوهم بالمي واحد واحد.', en: 'Put them in the water one at a time.' },
        ],
        record: { ar: 'اكتبوا: الأتقل بإيدي، وشو صار لكل واحد.', en: 'Write which felt heavier and what each one did.' },
        reflect: [{ ar: 'هل الأتقل عمل اللي توقّعته؟', en: 'Did the heavier one do what you expected?' }],
      },
    },
    {
      id: 'marble',
      name: { ar: 'بنّورة خفيفة', en: 'A light marble' },
      short: { ar: 'بنّورة', en: 'Marble' },
      change: { object: 'marble' },
      question: { ar: 'بنّورة زجاج صغيرة وزنها خفيف جداً. شو بصير فيها بالمي؟', en: 'A small glass marble that weighs very little. What happens to it in water?' },
      choices: ['floats', 'sinks'],
      minutes: 4,
      materials: ['basin', 'water', 'small_objects'],
      safety: { adult: false, note: { ar: 'البنانير ما بتنحط بالتم، وبنلمّها بعد التجربة. امسحوا المي المكبوبة ومعكم كبير.', en: 'Marbles never go in mouths; collect them afterwards. Wipe spills with an adult’s help.' } },
      minGrade: 3,
      targets: ['C4'],
      home: {
        steps: [
          { ar: 'جيبوا بنّورة وفلّينة.', en: 'Take a marble and a cork.' },
          { ar: 'احملوهم وقارنوا وزنهم.', en: 'Hold them and compare how heavy they feel.' },
          { ar: 'نزّلوهم بالمي.', en: 'Lower both into the water.' },
        ],
        record: { ar: 'ارسموا وين صار كل واحد.', en: 'Draw where each one ended up.' },
        reflect: [{ ar: 'الاثنين خفاف. ليش ممكن يتصرّفوا هيك؟', en: 'Both are light. Why might they behave like that?' }],
      },
    },
    {
      id: 'clay_ball',
      name: { ar: 'كرة معجون', en: 'A clay ball' },
      short: { ar: 'كرة معجون', en: 'Clay ball' },
      change: { object: 'clay_ball' },
      question: { ar: 'كوّرنا المعجون كرة وحطّيناها بالمي. شو بصير؟', en: 'We roll clay into a ball and put it in the water. What happens?' },
      choices: ['floats', 'sinks'],
      minutes: 4,
      materials: ['basin', 'water', 'clay'],
      safety: { adult: false, note: { ar: 'المعجون ما بينتاكل. امسحوا المي المكبوبة ومعكم كبير.', en: 'Do not eat the clay. Wipe spills with an adult’s help.' } },
      minGrade: 3,
      targets: ['C2', 'C4'],
      home: {
        steps: [
          { ar: 'كوّروا قطعة معجون قد حبة جوز.', en: 'Roll a walnut-sized ball of clay.' },
          { ar: 'علّموا مستوى المي بالوعاء.', en: 'Mark the water level on the basin.' },
          { ar: 'نزّلوا الكرة وراقبوا الكرة والمستوى.', en: 'Lower the ball and watch it and the level.' },
        ],
        record: { ar: 'ارسموا الكرة ومستوى المي قبل وبعد.', en: 'Draw the ball and the water level before and after.' },
        reflect: [{ ar: 'قدّيش تغيّر مستوى المي؟', en: 'How much did the water level change?' }],
      },
    },
    {
      id: 'clay_boat',
      name: { ar: 'قارب من نفس المعجون', en: 'A boat of the same clay' },
      short: { ar: 'قارب معجون', en: 'Clay boat' },
      change: { object: 'clay_boat' },
      question: { ar: 'فتحنا نفس المعجون وعملناه قارب بحواف عالية. شو بصير؟', en: 'We reshape the same clay into a boat with high sides. What happens?' },
      choices: ['floats', 'sinks'],
      minutes: 8,
      materials: ['basin', 'water', 'clay'],
      safety: { adult: false, note: { ar: 'امسحوا المي المكبوبة بسرعة ومعكم كبير.', en: 'Wipe spills quickly, with an adult’s help.' } },
      minGrade: 3,
      targets: ['C2', 'C3', 'C4'],
      home: {
        steps: [
          { ar: 'خدوا نفس كرة المعجون بدون ما تزيدوا أو تنقّصوا.', en: 'Take the same clay ball, adding and removing nothing.' },
          { ar: 'مدّوها رقيقة واعملوا قارب بحواف عالية بدون ثقوب.', en: 'Flatten it thin and build a boat with high sides and no holes.' },
          { ar: 'حطّوه بهدوء على المي وعلّموا مستوى المي.', en: 'Set it gently on the water and mark the level.' },
        ],
        record: { ar: 'ارسموا الكرة والقارب ومستوى المي مع كل واحد.', en: 'Draw the ball and the boat with the water level for each.' },
        reflect: [
          { ar: 'شو ضل زي ما هو، وشو تغيّر؟', en: 'What stayed the same and what changed?' },
          { ar: 'مع أي شكل ارتفعت المي أكثر؟', en: 'With which shape did the water rise more?' },
        ],
      },
    },
    {
      id: 'loaded_boat',
      name: { ar: 'قارب عليه شوية نقود', en: 'A boat with a few coins' },
      short: { ar: 'قارب محمّل', en: 'Loaded boat' },
      change: { object: 'clay_boat', cargo: 'coins' },
      question: { ar: 'حطّينا شوية نقود بقارب المعجون، فصار أتقل. شو بصير فيه؟', en: 'We add a few coins to the clay boat, so it is heavier. What happens to it?' },
      choices: ['floats', 'sinks'],
      minutes: 6,
      materials: ['basin', 'water', 'clay', 'small_objects'],
      safety: { adult: false, note: { ar: 'النقود ما بتنحط بالتم. اغسلوا إيديكم بعدها، وامسحوا المي ومعكم كبير.', en: 'Coins never go in mouths. Wash hands afterwards and wipe spills with an adult’s help.' } },
      minGrade: 3,
      targets: ['C4', 'C5'],
      home: {
        steps: [
          { ar: 'حطّوا قارب المعجون على المي.', en: 'Float the clay boat.' },
          { ar: 'زيدوا النقود وحدة وحدة بنص القارب.', en: 'Add coins one at a time in the middle.' },
          { ar: 'بعد كل وحدة شوفوا قدّيش نزل القارب.', en: 'After each coin look how low the boat sits.' },
        ],
        record: { ar: 'عدّوا النقود وارسموا خط المي على القارب.', en: 'Count the coins and draw the water line on the boat.' },
        reflect: [{ ar: 'شو صار بخط المي كل ما زدنا نقود؟', en: 'What happened to the water line as coins were added?' }],
      },
    },
    {
      id: 'overloaded_boat',
      name: { ar: 'قارب ماشي ومحمّل كثير', en: 'A moving boat with many coins' },
      short: { ar: 'حمولة كبيرة', en: 'Heavy load' },
      change: { object: 'clay_boat', cargo: 'many_coins', state: 'moving' },
      question: { ar: 'حمّلنا قارب المعجون نقود كثير، وإحنا بنزقّه شوي شوي. شو بصير؟', en: 'We load the clay boat with many coins and push it gently along. What happens?' },
      choices: ['floats', 'sinks'],
      minutes: 6,
      materials: ['basin', 'water', 'clay', 'small_objects'],
      safety: { adult: false, note: { ar: 'النقود ما بتنحط بالتم. امسحوا المي المكبوبة ومعكم كبير.', en: 'Coins never go in mouths. Wipe spills with an adult’s help.' } },
      minGrade: 3,
      targets: ['C4', 'C5'],
      home: {
        steps: [
          { ar: 'ضلّوا زيدوا نقود على القارب وإنتو بتزقّوه بإصبعكم شوي شوي.', en: 'Keep adding coins while nudging the boat along with a finger.' },
          { ar: 'عدّوا كم قطعة حملها.', en: 'Count how many coins it carried.' },
          { ar: 'كبّروا حواف القارب وعيدوا.', en: 'Raise the boat’s sides and repeat.' },
        ],
        record: { ar: 'اكتبوا عدد النقود لكل قارب.', en: 'Write the number of coins for each boat.' },
        reflect: [
          { ar: 'هل الحركة ساعدت القارب يحمل أكثر؟', en: 'Did moving help the boat carry more?' },
          { ar: 'إيمتى فاتت المي لجوّا؟', en: 'When did water get inside?' },
        ],
      },
    },
    {
      id: 'big_ship',
      name: { ar: 'سفينة حديد كبيرة واقفة', en: 'A big steel ship, standing still' },
      short: { ar: 'سفينة', en: 'Big ship' },
      change: { object: 'big_steel_boat' },
      question: { ar: 'مجسّم سفينة حديد كبير وتقيل، واقف بدون موتور. شو بصير فيه؟', en: 'A big heavy steel model ship stands still with no engine. What happens to it?' },
      choices: ['floats', 'sinks'],
      minutes: 5,
      materials: ['basin', 'water', 'metal_cup', 'screen'],
      safety: { adult: false, note: { ar: 'وعاء معدن أطرافه ملسا بس. امسحوا المي المكبوبة ومعكم كبير.', en: 'Smooth-edged metal containers only. Wipe spills with an adult’s help.' } },
      minGrade: 3,
      targets: ['C1', 'C4', 'C5'],
      home: {
        steps: [
          { ar: 'جيبوا طنجرة معدن فاضية ونظيفة.', en: 'Take an empty clean metal pot.' },
          { ar: 'حطّوها فاضية على المي بحوض واسع، بدون ما حدا يحرّكها.', en: 'Set it on water in a wide tub without anyone moving it.' },
          { ar: 'اضغطوها بإيدكم لتحت شوي وحسّوا.', en: 'Press it down gently and feel.' },
        ],
        record: { ar: 'ارسموا الطنجرة وخط المي عليها.', en: 'Draw the pot and the water line on it.' },
        reflect: [{ ar: 'شو حسّيتوا لما ضغطتوا لتحت؟', en: 'What did you feel when you pressed down?' }],
      },
    },
  ],
  outcomes: {
    floats: { ar: 'بيطفو', en: 'It floats' },
    sinks: { ar: 'بيغرق', en: 'It sinks' },
  },
  kidOutcome,
  realOutcome,
  measure,

  noor: {
    greeting: {
      ar: 'أهلاً! أنا نور. شفت سفينة بالبحر تقيلة كثير وضلّت فوق، وأنا رميت قطعة معدن صغيرة وغرقت! ليش برأيك؟ احكيلي بكلامك وبرسم فكرتك زي ما هي.',
      en: 'Hi! I am Noor. I saw a very heavy ship stay on the sea, then I dropped a small piece of metal and it sank! Why do you think that is? Tell me in your words and I will draw your idea as it is.',
    },
    invite: { ar: 'فهمت فكرتك! يلا نجرّبها بالحوض. شو بتتوقّع؟', en: 'I got your idea! Let’s test it in the tank. What do you predict?' },
    afterContradiction: {
      ar: 'شفت؟ المي عملت غير اللي توقّعته الفكرة. في إشي ناقص. شو لاحظت؟',
      en: 'See? The water did not do what the idea expected. Something is missing. What did you notice?',
    },
    afterMatch: { ar: 'هالمرة فكرتك صمدت! جرّب غرض ثاني أو حمولة ثانية.', en: 'Your idea held up this time! Try another object or another load.' },
    sameResult: {
      ar: 'فكرتك والحقيقة أعطوا نفس النتيجة، فهالتجربة ما بتفرّق بينهم. غيّر الغرض وجرّب.',
      en: 'Your idea and reality gave one result, so this test cannot tell them apart. Change the object and try.',
    },
    praise: { ar: 'شرحك مرتّب وكامل! بتعلّمني إنت هلأ؟', en: 'Your explanation is clear and complete! Will you teach me now?' },
    partial: { ar: 'حلو، فهمت منك إشي مهم! زيدني:', en: 'Nice, I learned something important from you! Tell me more:' },
    contradiction: { ar: 'سمعت منك فكرتين ما بيزبطوا مع بعض. أي وحدة بتقصد؟', en: 'I heard two ideas that do not fit together. Which one do you mean?' },
    offtopic: { ar: 'خلّينا نرجع للسفينة وقطعة المعدن. شو رأيك؟', en: 'Let’s go back to the ship and the metal piece. What do you think?' },
    unsupported: {
      ar: 'فكرة بتستاهل نفكّر فيها! بس ما بقدر أجرّبها هون. احكيلي شو بتلاحظ لما تحط أغراض بالمي.',
      en: 'That is worth thinking about! I cannot test it here. Tell me what you notice when you put things in water.',
    },
  },
  hints: [
    { ar: 'فكّر: شو بتحسّ بإيدك لما تحاول تنزّل طابة منفوخة تحت المي؟', en: 'Think: what do you feel when you try to hold a blown-up ball under water?' },
    { ar: 'طلّع على المعجون: مرّة كرة ومرّة قارب. شو ضل زي ما هو، وشو تغيّر؟', en: 'Look at the clay: once a ball, once a boat. What stayed the same and what changed?' },
    {
      ar: 'لما القارب ينزل بالمي، وين بتروح المي اللي كانت بمكانه؟ قارن المكان اللي بياخده القارب بالمكان اللي بتاخده الكرة.',
      en: 'When the boat goes into the water, where does the water that was there go? Compare the room the boat takes with the room the ball takes.',
    },
    {
      ar: 'المي بتدفع لفوق. القارب شكله بيزيح مي أكثر من الكرة، فالدفعة أكبر. إذا الدفعة بتحمل وزنه قبل ما يغطس كله، بيطفو.',
      en: 'Water pushes up. The boat’s shape pushes aside more water than the ball, so the push is bigger. If it can hold the boat’s weight before it is fully under, it floats.',
    },
  ],
  clarify: [
    { id: 'why', q: { ar: 'احكيلي أكثر: ليش برأيك واحد بيضل فوق وواحد بينزل؟', en: 'Tell me more: why does one stay up and the other go down?' }, ai: 'ask for the reason' },
    { id: 'water', q: { ar: 'والمي اللي حواليهم، شو دورها برأيك؟', en: 'And the water around them: what part does it play?' }, ai: 'ask about the role of the water' },
    { id: 'compare', q: { ar: 'لو قارنت كرة وقارب من نفس المعدن، شو بيفرق بينهم؟', en: 'Compare a ball and a boat of the same metal. How do they differ?' }, ai: 'ask to compare ball and boat of one material' },
    { id: 'stop', q: { ar: 'إيش بتتوقّع يصير للسفينة وهي واقفة بالميناء؟ وليش؟', en: 'What do you expect of a ship waiting in the harbour, and why?' }, ai: 'ask about a ship that is not moving' },
  ],
  answerWords: /يزيح|بتزيح|بيزيح|تزيح|[إأا]زاح|المزاح|مزاحة|كثاف|بتدف[عش]|بيدف[عش]|يدف[عش]|تدف[عش]|دَ?فع|دفش|displac|buoyan|densit|upthrust|\bpush(?:es|ed|ing)?\s+(?:\S+\s+){0,2}?(?:aside|up|away)\b|water\s+push/i,
  teach: {
    planted: { ar: 'فهمت! يعني أي إشي من حديد لازم يغرق، حتى لو عملناه على شكل قارب. صح؟', en: 'I get it! So anything made of steel must sink, even if we shape it like a boat. Right?' },
    truth: 'A steel boat shape can push aside enough water to balance its weight before it goes under, so it floats; the same steel as a solid ball cannot.',
    accept: new RegExp(
      '^(?=.*(?:(?<![ء-ي])(?:لا|لاا|لأ|غلط|خطا|مش|مو|العكس|بالعكس|ابدا)(?![ء-ي])|\\b(?:no|nope|not|wrong|incorrect|opposite|isn\'t|doesn\'t|false)\\b|(?:بيطفو|بتطفو|بيعوم|بتعوم)|\\bfloats?\\b))'
      + '(?=.*(?:شكل|مجوف|فاضي|هوا|واسع|يزيح|تزيح|كثاف|مي اكثر|مي اكتر|مي كثير|سفن|السفينه|سفينه|بواخر|باخره|shape|hollow|\\bair\\b|\\bwide\\b|displac|densit|\\bwater\\b|\\bships?\\b))',
    ),
    reject: new RegExp(
      '^\\s*(?:اه|ايوه|ايوا|نعم|صح|صحيح|مزبوط|مظبوط|مضبوط|اكيد(?! لا| مش)|yes|yeah|yep|right|correct|true)(?![ء-يa-z])|'
      + '(?<!(?:مش|مو) )(?:لازم|اكيد|دايما) (?:ي|ت|بي|بت|رح ي|رح ت|حي|حت)غرق|'
      + '(?<!not (?:true that )?(?:it )?)(?<!n\'t (?:true that )?(?:it )?)(?:must|will|has to|always) sink',
    ),
    thanks: {
      ar: 'آه! يعني نفس الحديد ممكن يطفو إذا شكله بيزيح مي كفاية. فالمادة لحالها ما بتقرّر. شكراً يا أستاذ!',
      en: 'Oh! The same steel can float if its shape pushes aside enough water. So the material alone does not decide. Thank you, teacher!',
    },
    confused: {
      ar: 'لسا محتارة… نفس الحديد، مرّة كرة ومرّة قارب. كيف بقدر أعرف شو بصير بكل واحد؟',
      en: 'I am still puzzled… One lot of steel, once a ball and once a boat. How can I tell what each will do?',
    },
  },
  challenge: {
    phenomenon: {
      ar: 'ولد لابس طوق سباحة منفوخ بيضل راسه فوق المي. ليش الطوق بيساعده؟',
      en: 'A child wearing a blown-up swim ring keeps their head above water. Why does the ring help?',
    },
    solved: {
      ar: 'الطوق خفيف وكبير: بيزيح مي كثير، فدفعة المي لفوق بتكبر وبتحمل الولد والطوق مع بعض وهو لسا مش غاطس كله.',
      en: 'The ring is light but big: it pushes aside a lot of water, so the upward push grows and holds child and ring before they are fully under.',
    },
  },
  transfer: {
    prompt: {
      ar: 'صاحبك بدو يعمل طوّافة من قناني بلاستيك فاضية ومسكّرة، ويحط عليها شنطة. ليش ممكن الطوّافة تحمل الشنطة؟ وإيمتى ممكن تغرق؟',
      en: 'A friend builds a raft from empty closed plastic bottles and puts a bag on it. Why could the raft carry the bag? When could it sink?',
    },
    check: {
      id: 'tr_raft', node: 'C5',
      q: { ar: 'أي طوّافة بتقدر تحمل حمولة أكبر؟', en: 'Which raft can carry the bigger load?' },
      options: [
        { ar: 'طوّافة من ٤ قناني فاضية', en: 'A raft of 4 empty bottles' },
        { ar: 'طوّافة من ٨ من نفس القناني', en: 'A raft of 8 of the same bottles' },
        { ar: 'الاثنين نفس الإشي', en: 'Both the same' },
      ],
      correct: 1,
    },
  },
  rules: [
    {
      idea: 'engine_holds',
      unless: any(
        '(?<![ء-ي])(?:مش|مو|ما) (?:عشان|بسبب|لان|لانه|لانها) (?:ال)?(?:موتور|محرك|ماتور|حرك)',
        '(?:بدون|بلا|من دون) (?:ال)?(?:موتور|محرك|ماتور)(?: [^ ]+){0,2}? (?:بتطفو|بيطفو|بتعوم|بتضل)',
        'not because (?:of )?(?:the |its |an? )?(?:engine|motor|movement)',
        'even (?:with|when) (?:the )?(?:engine|motor) (?:is )?off',
        'without (?:an? |the )?(?:engine|motor)(?: [a-z]+){0,3}? (?:floats?|stays)',
      ),
      re: any(
        '(?:ال)?(?:محرك|موتور|ماتور) (?:بيدفعها|بدفعها|بيدفعه) لفوق',
        '(?:الموتور|المحرك|الماتور|موتور|محرك|ماتور)(?: (?:تبعها|تبعتها|تبعه|الشغال|هو|اللي|الي|بس))* (?:بيحملها|بيحمله|بيحمل|حاملها|بيخليها|بيخليه|بيرفعها|بيرفعه|بيمسكها|ماسكها|بيعومها|بيطوفها)',
        '(?:ما بتغرق|ما بيغرق|بتطفو|بيطفو|بتعوم|بيعوم|بتضل فوق|بيضل فوق|طافيه) (?:بسبب|من) (?:ال)?(?:موتور|محرك|ماتور|حركه|حركتها|سرعتها)',
        '(?<=(?:عشان|لانه|لانها|لان) )(?:ال)?(?:موتور|محرك|ماتور|حركتها|بتتحرك|بتمشي|ماشيه|سرعتها|فيها موتور|فيها محرك|عندها موتور|عندها محرك|إلها موتور|الها موتور)',
        '(?:لو|اذا|لما) (?:وقف|طفي|بطل|وقفت|طفينا|طفا) (?:ال)?(?:موتور|محرك|ماتور|حركه)[^.،]{0,12}?(?:بتغرق|بيغرق|رح تغرق|حتغرق)',
        '(?:بدون|بلا|من دون) (?:ال)?(?:موتور|محرك|ماتور) (?:بتغرق|بيغرق|رح تغرق)',
        '(?:engine|motor)s?(?: power)? (?:holds?|keeps?|pushes|push|lifts?)(?: (?:it|them|the (?:ship|boat)))?(?: up| afloat| on top| floating)?',
        '(?:engine|motor)s? makes? (?:it|them|the (?:ship|boat)) float',
        '(?<=because (?:of )?(?:(?:its|the|it has an?|it has the|of its) )?)(?:engines?|motors?|movement|speed|it is moving|it\'s moving|it moves)',
        '(?:floats?|stays up|does(?:n\'t| not) sink) (?:thanks to|due to) (?:its |the )?(?:engine|motor|movement|speed)',
        '(?:if|when) (?:the )?(?:engine|motor) (?:stops|is off|turns off)[^.]{0,20}?sinks?',
        'without (?:an? |the )?(?:engine|motor)[^.]{0,20}?sinks?',
      ),
    },
    {
      idea: 'material_only',
      unless: DISPLACEMENT_TALK,
      re: any(
        '(?:ال)?(?:حديد|معدن) (?:ما|مش) (?:بيطفو|بيطوف|بيعوم)',
        "^(?:metal|steel|iron) (?:can never|cannot|can't|does not) float",
        '(?:الحديد|المعدن|حديد|معدن|الستانلس)(?: (?:دايما|اكيد|لازم|كله|بالاخر|ف|يعني|هو))* (?:بيغرق|بتغرق|يغرق|بغرق|غرق)',
        '(?:بيغرق|بتغرق|بغرق) (?:لانه|لانها|عشان) (?:(?:هو|هي) )?(?:من |معمول من |معموله من )?(?:ال)?(?:حديد|معدن)',
        '(?:الشكل|شكله|شكلها|شكل الاشي)(?: تبعه)? (?:ما|مش|مو) (?:بيفرق|بفرق|بتفرق|بيهم|مهم|بياثر|بتاثر|فارق|بيغير)',
        '(?:مش مهم|ما بيفرق|ما بيهم|مو مهم) (?:ال)?شكل',
        '(?:المهم|حسب) (?:ال)?(?:ماده|من شو (?:معمول|مصنوع)|نوع الماده)',
        'الماده (?:هي )?(?:بس )?(?:اللي |الي )?بتقرر',
        // «a small metal object sinks» is the question's own wording, not a claim about all metal
        '(?<!(?:small|little) )(?:metal|steel|iron)(?: (?:things?|objects?))? (?:always |will |would |just )?sinks?',
        'sinks? because (?:it(?:\'s| is) )?(?:made (?:of|from) )?(?:metal|steel|iron)',
        'shape (?:doesn\'?t|does not|never|won\'?t) (?:matters?|change)',
        '(?:only|just) (?:the )?material (?:matters|decides|counts)', 'material decides',
        'depends (?:only )?on (?:the )?material', '(?:what|the stuff) it(?:\'s| is) made of decides',
      ),
    },
    {
      idea: 'heavy_sinks',
      unless: DISPLACEMENT_TALK,
      re: any(
        '(?:التقيل|الثقيل|تقيل|ثقيل|تقيله|ثقيله|وزنه (?:كبير|تقيل|كثير|كتير)|وزنها (?:كبير|تقيل|كثير|كتير))(?: (?:دايما|اكيد|كتير|كثير|ف|فا|فلازم|لازم|رح|هو|هي|كله|بالاخر|يعني))* (?:ف)?(?:بي|بت|ب|ي|ت|حي|حت)?(?:غرق|بينزل|بتنزل)',
        '(?:بيغرق|بتغرق|بغرق|يغرق|تغرق|غرق|غرقت|بينزل|بتنزل|نزل|نزلت)(?:وا)?(?: (?:لتحت|عالقاع|بالمي))? (?:لانه|لانها|عشان|لان) (?:(?:هو|هي|الاشي) )?(?:تقيل|ثقيل|تقيله|ثقيله|وزنه (?:كبير|تقيل|كثير)|وزنها (?:كبير|تقيل|كثير))',
        '(?:كل )?heavy(?: (?:things?|objects?|stuff|ones?|metal))? (?:always |will |would |just )?(?:sinks?|go(?:es)? (?:down|under|to the bottom))',
        '(?:sinks?|goes? down|goes? under)(?: to the bottom)? because (?:(?:it(?:\'s| is)?|they(?:\'re| are)?) )?(?:(?:too|so|very) )?(?:heavy|of (?:its|their) weight)',
        'because (?:it is|it is so) heavy,? it sinks',
        '(?:التقيل|الثقيل)(?: (?:دايما|اكيد))? (?:ما|مش) (?:بيطفو|بيطوف|بيعوم)',
        "heavy (?:things|objects|stuff) (?:cannot|can't|do not|never) float",
        'too heavy to float', 'heav(?:y|ier),? so (?:it )?sinks?',
      ),
    },
    {
      idea: 'light_floats',
      unless: DISPLACEMENT_TALK,
      re: any(
        '(?:الخفيف|خفيف|خفيفه|وزنه خفيف|وزنها خفيف|وزنه قليل)(?: (?:دايما|اكيد|كتير|كثير|ف|فا|لازم|رح|هو|هي|كله|يعني))* (?:ف)?(?:بيطفو|بتطفو|يطفو|تطفو|بيطوف|بتطوف|بيعوم|بتعوم|يعوم|تعوم|بيضل فوق|بتضل فوق|بيضل طافي|ما بيغرق|ما بتغرق)',
        '(?:بيطفو|بتطفو|يطفو|بيطوف|بتطوف|بيعوم|بتعوم|بيضل فوق|بتضل فوق)(?:وا)?(?: (?:فوق|عالمي))? (?:لانه|لانها|عشان|لان) (?:(?:هو|هي|الاشي) )?(?:خفيف|خفيفه|وزنه خفيف|وزنها خفيف|وزنه قليل)',
        'light(?:er)?(?: (?:things?|objects?|stuff|ones?))? (?:always |will |would |just )?(?:floats?|stays? (?:up|on top))',
        '(?:floats?|stays? (?:up|on top)) because (?:(?:it(?:\'s| is)?|they(?:\'re| are)?) )?(?:(?:so|very) )?light(?!er than)',
        'light,? so (?:it )?floats?',
      ),
    },
    {
      idea: 'displacement',
      re: any(
        'بتزيح|بيزيح|تزيح|يزيح|ازاحه|بيزيحوا|المزاحه|المزاح|مزاحه',
        '(?:المي|الماء|الميه)(?: (?:كمان|هي|تبعت البحر|لحالها))? (?:بتدفش|بتدفع|بتزق|بيدفع|يدفع|تدفع|بترفع|بيرفع)',
        '(?:دفع|دفعه|دفشه) (?:ال)?(?:مي|ماء|ميه)(?![ء-ي])', 'كثافه|كثافته|كثافتها',
        'displac', 'buoyan', 'densit', '\\bdens(?:e|er)\\b', 'upthrust',
        '(?:push|pushes|pushing|pushed)(?: (?:aside|away))? (?:(?:more|a lot of|lots of|enough|much) )water',
        '(?:push|pushes|pushing|pushed) (?:aside|away) (?:(?:the|much|more) )?water',
        'water (?:pushes|pushing|push)(?: (?:it|them|the (?:ship|boat|object)))?(?: back)? up',
      ),
    },
  ],
  samples: [
    { ar: 'المي بتدفع القارب لفوق، وشكله بيزيح مي كثير، فبيضل طافي', en: 'The water pushes the boat up, and its shape pushes aside lots of water, so it floats.' },
    { ar: 'الحجر بيغرق لأنه تقيل', en: 'Heavy things always sink.' },
    { ar: 'الإشي الخفيف دايماً بيطفو', en: 'Light things always float.' },
    { ar: 'الحديد دايماً بيغرق، الشكل ما بيفرق', en: 'Metal always sinks, the shape doesn’t matter.' },
    { ar: 'السفينة بتطفو عشان الموتور بيحملها', en: 'The ship floats because its engine holds it up.' },
  ],
  preTest: [
    {
      id: 'pre1', node: 'C3',
      q: { ar: 'ليش سفينة الحديد الكبيرة بتضل فوق المي؟', en: 'Why does a big steel ship stay on the water?' },
      options: [
        { ar: 'لأن الموتور بيحملها', en: 'Its engine holds it' },
        { ar: 'لأن شكلها بيزيح مي كثير', en: 'Its shape pushes aside lots of water' },
        { ar: 'لأنها خفيفة', en: 'It is light' },
      ],
      correct: 1,
    },
    {
      id: 'pre2', node: 'C4',
      q: { ar: 'قطعة خشب كبيرة تقيلة، وبنّورة زجاج خفيفة. شو بصير بالمي؟', en: 'A big heavy block of wood and a light glass marble. What happens in water?' },
      options: [
        { ar: 'الخشبة بتغرق والبنّورة بتطفو', en: 'The wood sinks and the marble floats' },
        { ar: 'الخشبة بتطفو والبنّورة بتغرق', en: 'The wood floats and the marble sinks' },
        { ar: 'الاثنين بيغرقوا', en: 'Both sink' },
      ],
      correct: 1,
    },
    {
      id: 'pre3', node: 'C3',
      q: { ar: 'كرة معجون بتغرق. إذا عملنا نفس المعجون قارب، شو ممكن يصير؟', en: 'A clay ball sinks. If the same clay becomes a boat, what can happen?' },
      options: [
        { ar: 'أكيد بيغرق لأنه نفس الوزن', en: 'It must sink, the mass is the same' },
        { ar: 'ممكن يطفو', en: 'It can float' },
        { ar: 'بيذوب', en: 'It dissolves' },
      ],
      correct: 1,
    },
    {
      id: 'pre4', node: 'C1',
      q: { ar: 'نزّلت طابة تحت المي وتركتها، فنطّت لفوق. ليش؟', en: 'You hold a ball under water and let go, and it jumps up. Why?' },
      options: [
        { ar: 'المي دفعتها لفوق', en: 'The water pushed it up' },
        { ar: 'الهوا اللي برّا سحبها', en: 'The air outside pulled it' },
        { ar: 'الطابة بتحرّك حالها', en: 'The ball moves itself' },
      ],
      correct: 0,
    },
  ],
  postTest: [
    {
      id: 'post1', node: 'C4',
      q: { ar: 'علبة تنك مسكّرة وفاضية بتطفو. لما انثقبت وتعبّت مي، غرقت. ليش؟', en: 'A closed empty tin can floats. Once holed and full of water, it sinks. Why?' },
      options: [
        { ar: 'صارت كتلتها أكبر من المي اللي بتقدر تزيحها', en: 'Its mass became more than the water it can push aside' },
        { ar: 'المعدن تغيّر نوعه', en: 'The metal changed into another material' },
        { ar: 'الثقب سحبها لتحت', en: 'The hole pulled it down' },
      ],
      correct: 0,
    },
    {
      id: 'post2', node: 'C4',
      q: { ar: 'بطّيخة تقيلة بتطفو، وحصوة صغيرة بتغرق. شو اللي بيقرّر؟', en: 'A heavy watermelon floats and a small pebble sinks. What decides?' },
      options: [
        { ar: 'الوزن لحاله', en: 'Mass alone' },
        { ar: 'الوزن مقارنةً بالمي اللي بيزيحها', en: 'Mass compared with the water pushed aside' },
        { ar: 'اللون', en: 'The colour' },
      ],
      correct: 1,
    },
    {
      id: 'post3', node: 'C5',
      q: { ar: 'قارب ورق ألمنيوم، بنزيد عليه حصى وحدة وحدة. شو بصير بالآخر؟', en: 'We add pebbles one by one to a foil boat. What happens in the end?' },
      options: [
        { ar: 'بيضل طافي مهما حمّلنا', en: 'It floats however much we load' },
        { ar: 'بيغرق لما الدفعة ما بتعود تكفّي الوزن', en: 'It sinks when the push can no longer match the weight' },
        { ar: 'بيصير أخف', en: 'It becomes lighter' },
      ],
      correct: 1,
    },
    {
      id: 'post4', node: 'C1',
      q: { ar: 'مركب بالميناء واقف ومحرّكه مطفي. ليش ما بيغرق؟', en: 'A boat waits in harbour with its engine off. Why does it not sink?' },
      options: [
        { ar: 'المي بتدفعه لفوق قد وزنه', en: 'The water pushes it up as much as it weighs' },
        { ar: 'مربوط بحبل بيحمله', en: 'A rope holds it up' },
        { ar: 'لأنه كان ماشي قبل', en: 'Because it was moving before' },
      ],
      correct: 0,
    },
  ],
  activities: {
    heavy_sinks: {
      type: 'experiment',
      title: { ar: 'التقيل والخفيف بالحوض', en: 'Heavy and light in the tank' },
      goal: { ar: 'نشوف إن الوزن لحاله ما بيقرّر.', en: 'See that weight alone does not decide.' },
      grouping: { ar: 'مجموعات من ٤', en: 'Groups of 4' },
      materials: ['basin', 'water', 'small_objects', 'napkins'],
      steps: [
        { minutes: 3, title: { ar: 'رتّبوا وتوقّعوا', en: 'Order and predict' }, detail: { ar: 'رتّبوا ٦ أغراض من الأخف للأتقل، واكتبوا توقّع لكل واحد.', en: 'Order six objects from lightest to heaviest and predict each.' } },
        { minutes: 7, title: { ar: 'جرّبوا', en: 'Test' }, detail: { ar: 'نزّلوهم بالترتيب. دوّروا على تقيل بيطفو وخفيف بيغرق.', en: 'Test them in order. Find a heavy floater and a light sinker.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'إذا مش الوزن لحاله، شو كمان لازم نطلّع عليه؟', en: 'If not weight alone, what else must we look at?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'اكتب مثال لإشي تقيل ما نزل لتحت.', en: 'Write one heavy thing that stayed up.' } },
      ],
      teacher: { ar: 'اختاروا خشبة كبيرة وحجر أو بنّورة، عشان التناقض يكون واضح.', en: 'Include a large piece of wood and a stone or marble so the clash is clear.' },
      check: { ar: 'ليش الخشبة التقيلة طفت والبنّورة الخفيفة غرقت؟', en: 'Why did the heavy wood float and the light marble sink?' },
      adapt: { ar: 'للي بده دعم: غرضين بس. للمتقدّم: قيسوا ارتفاع المي مع كل غرض.', en: 'Support: two objects only. Stretch: measure the water rise for each.' },
    },
    light_floats: {
      type: 'experiment',
      title: { ar: 'خفيف بس غرق', en: 'Light, yet it sank' },
      goal: { ar: 'نقارن غرضين بنفس الوزن تقريباً وبحجم غير.', en: 'Compare two objects of similar mass but different size.' },
      grouping: { ar: 'أزواج', en: 'Pairs' },
      materials: ['basin', 'water', 'small_objects', 'napkins'],
      steps: [
        { minutes: 3, title: { ar: 'توقّعوا', en: 'Predict' }, detail: { ar: 'بنّورة، فلّينة، وقطعة نقود: مين بيضل فوق؟ وليش؟', en: 'A marble, a cork and a coin: which stays up, and why?' } },
        { minutes: 7, title: { ar: 'جرّبوا', en: 'Test' }, detail: { ar: 'احملوهم، قارنوا الوزن والحجم، ونزّلوهم بالمي.', en: 'Hold them, compare mass and size, then test.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'نفس الوزن تقريباً. شو اللي غير بين البنّورة والفلّينة؟', en: 'Similar mass. What differs between marble and cork?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'اكتب: خفيف بس غرق، مثال وسبب.', en: 'Write one light sinker and a reason.' } },
      ],
      teacher: { ar: 'اربطوا دايماً الوزن بالمكان اللي بياخده الغرض بالمي.', en: 'Keep pairing mass with the room the object takes in water.' },
      check: { ar: 'ليش قطعة النقود الخفيفة بتغرق؟', en: 'Why does a light coin sink?' },
      adapt: { ar: 'للي بده دعم: ميزان بكفّتين. للمتقدّم: قدّروا كتلة المي المزاحة.', en: 'Support: a pan balance. Stretch: estimate the mass of displaced water.' },
    },
    material_only: {
      type: 'experiment',
      title: { ar: 'تحدّي قارب المعجون', en: 'Clay boat challenge' },
      goal: { ar: 'نفس المادة ونفس الوزن: الشكل بيغيّر النتيجة.', en: 'Same material and mass: shape changes the result.' },
      grouping: { ar: 'مجموعات من ٣', en: 'Groups of 3' },
      materials: ['basin', 'water', 'clay', 'small_objects'],
      steps: [
        { minutes: 3, title: { ar: 'كرة أول', en: 'Ball first' }, detail: { ar: 'جرّبوا كرة المعجون وسجّلوا النتيجة.', en: 'Test the clay ball and record it.' } },
        { minutes: 7, title: { ar: 'شكّلوا', en: 'Reshape' }, detail: { ar: 'بنفس المعجون ابنوا قارب، وشوفوا مين قاربه بيحمل نقود أكثر.', en: 'Build a boat from the same clay and see whose carries most coins.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'شو تغيّر لما غيّرنا الشكل؟ شو صار بمستوى المي؟', en: 'What changed with the shape? What did the water level do?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'ارسم ليش سفينة الحديد ممكن تطفو.', en: 'Draw why a steel ship can float.' } },
      ],
      teacher: { ar: 'خلّي كل مجموعة تعلّم مستوى المي مع الكرة ومع القارب.', en: 'Have each group mark the water level with the ball and with the boat.' },
      check: { ar: 'هل المعدن لازم يغرق دايماً؟ أعطي دليل.', en: 'Must metal always sink? Give evidence.' },
      adapt: { ar: 'للي بده دعم: صورة لشكل قارب. للمتقدّم: أعلى حمولة بأقل معجون.', en: 'Support: a picture of a boat shape. Stretch: most cargo with least clay.' },
    },
    engine_holds: {
      type: 'discussion',
      title: { ar: 'لو طفي الموتور', en: 'If the engine stops' },
      goal: { ar: 'نبيّن إن الطفو ما بيحتاج حركة.', en: 'Show that floating needs no movement.' },
      grouping: { ar: 'مجموعات من ٤', en: 'Groups of 4' },
      materials: ['basin', 'water', 'clay', 'metal_cup'],
      steps: [
        { minutes: 3, title: { ar: 'سؤال', en: 'Question' }, detail: { ar: 'سفينة واقفة بالميناء ومحرّكها مطفي. شو بصير فيها؟', en: 'A ship waits in harbour, engine off. What happens to it?' } },
        { minutes: 7, title: { ar: 'جرّبوا', en: 'Test' }, detail: { ar: 'قارب معجون وكاسة معدن على مي هادية. استنّوا دقيقتين، وبعدين حمّلوهم وهم ماشيين.', en: 'A clay boat and a metal cup on still water. Wait two minutes, then load them while moving.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'مين حمل القارب وهو واقف؟ وإيمتى الحركة ما ساعدت؟', en: 'What held the boat while still? When did moving not help?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'جملة: شغلة الموتور شو هي بالسفينة؟', en: 'One sentence: what is a ship’s engine for?' } },
      ],
      teacher: { ar: 'وضّح: الموتور بيمشّي السفينة، والمي هي اللي بتحملها.', en: 'Make clear: the engine moves the ship; the water holds it.' },
      check: { ar: 'ليش القوارب المربوطة بالميناء ما بتغرق؟', en: 'Why do moored boats not sink?' },
      adapt: { ar: 'للي بده دعم: صور موانئ. للمتقدّم: ليش بعض الأشياء السريعة بتنطّ على المي؟', en: 'Support: harbour photos. Stretch: why can some fast things skip over water?' },
    },
    _default: {
      type: 'experiment',
      title: { ar: 'بيطفو ولا بيغرق؟', en: 'Float or sink?' },
      goal: { ar: 'كل طالب يربط الطفو بالوزن والمي المزاحة مع بعض.', en: 'Every learner links floating to mass and displaced water together.' },
      grouping: { ar: 'مجموعات من ٤', en: 'Groups of 4' },
      materials: ['basin', 'water', 'clay', 'small_objects', 'napkins'],
      steps: [
        { minutes: 3, title: { ar: 'توقّعوا', en: 'Predict' }, detail: { ar: 'خشبة، بنّورة، كرة معجون، قارب معجون: توقّع وسبب.', en: 'Wood, marble, clay ball, clay boat: predict with a reason.' } },
        { minutes: 7, title: { ar: 'جرّبوا', en: 'Test' }, detail: { ar: 'جرّبوا الأربعة وعلّموا مستوى المي مع كل واحد.', en: 'Test all four and mark the water level for each.' } },
        { minutes: 3, title: { ar: 'نقاش', en: 'Discuss' }, detail: { ar: 'أي فكرة صمدت مع الأغراض الأربعة؟', en: 'Which idea survived all four objects?' } },
        { minutes: 2, title: { ar: 'بطاقة خروج', en: 'Exit card' }, detail: { ar: 'اشرح بجملتين ليش القارب ضل فوق.', en: 'Explain in two sentences why the boat stayed up.' } },
      ],
      teacher: { ar: 'جهّز محارم للمي المكبوبة، وما في أدوات معدن حادّة.', en: 'Have cloths ready for spills, and no sharp metal.' },
      check: { ar: 'شو الفرق بين كرة المعجون وقارب المعجون؟', en: 'How do the clay ball and the clay boat differ?' },
      adapt: { ar: 'للي بده دعم: غرضين ورسمة. للمتقدّم: توقّع من الكتلة والحجم.', en: 'Support: two objects and a drawing. Stretch: predict from mass and volume.' },
    },
    _enrich: {
      type: 'game',
      title: { ar: 'سباق الحمولة', en: 'Cargo contest' },
      goal: { ar: 'نصمّم قارب بيحمل أكثر ونفسّر السبب.', en: 'Design a boat that carries more and explain why.' },
      grouping: { ar: 'مجموعات من ٣', en: 'Groups of 3' },
      materials: ['basin', 'water', 'clay', 'small_objects', 'ruler'],
      steps: [
        { minutes: 5, title: { ar: 'صمّموا', en: 'Design' }, detail: { ar: 'نفس كمية المعجون لكل مجموعة. ارسموا التصميم قبل البناء.', en: 'Equal clay for each group. Sketch before building.' } },
        { minutes: 6, title: { ar: 'اختبروا', en: 'Test' }, detail: { ar: 'زيدوا النقود وحدة وحدة لحد ما تفوت المي.', en: 'Add coins one by one until water gets in.' } },
        { minutes: 4, title: { ar: 'فسّروا', en: 'Explain' }, detail: { ar: 'ليش تصميم حمل أكثر؟ اربطوا بالمي المزاحة.', en: 'Why did one design carry more? Link it to displaced water.' } },
      ],
      teacher: { ar: 'الأهم التفسير مش مين ربح.', en: 'The explanation matters more than winning.' },
      check: { ar: 'إذا بدنا نحمل ضعف النقود، شو لازم نغيّر؟', en: 'To carry twice the coins, what must change?' },
      adapt: { ar: 'للي بده دعم: قالب جاهز. للمتقدّم: توقّع عدد النقود قبل التجربة.', en: 'Support: a template. Stretch: predict the coin count first.' },
    },
  },
};
