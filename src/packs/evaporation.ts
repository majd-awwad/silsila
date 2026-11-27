/**
 * Concept pack: «ليش مي الكاسة بتنقص إذا تركناها كم يوم؟» (evaporation), grades 3–5.
 * The mirror image of condensation: there vapour becomes liquid, here liquid becomes vapour.
 * Arabic offline patterns are written against normaliseText() output: ا for أإآ, ه for ة, ي for ى/ئ, و for ؤ.
 */
import type { ChildModel, Conditions, L } from '../contracts';
import type { ConceptPack } from './types';

/** speed words are relative to the usual cup: open, warm sunny spot, still air */
type Out = 'stays' | 'slow' | 'normal' | 'fast' | 'wet';

const t = (ar: string, en: string): L => ({ ar, en });
/** one regex from several readable alternatives (leftmost match wins, so one idea is counted once) */
const anyOf = (...parts: RegExp[]) => new RegExp(parts.map((p) => p.source).join('|'));

/* ───────────── deterministic worlds ───────────── */

function realOutcome(c: Conditions): Out {
  // a tight lid: water still evaporates, but the trapped vapour condenses back, so the level stays about the same
  if (c.lid === 'closed') return 'stays';
  // qualitative model: each helper (warmth, sun, wide surface, moving air) counts once
  const helpers = [c.temp === 'warm', c.sun === 'yes', c.area === 'plate', c.air === 'fan'].filter(Boolean).length;
  if (helpers <= 1) return 'slow';
  return helpers === 2 ? 'normal' : 'fast';
}

function kidOutcome(m: ChildModel, c: Conditions): Out {
  const closed = c.lid === 'closed';
  /** ideas where nothing in the setup speeds things up, unless the learner also says warmth matters */
  const steady = (): Out => (m.requires.includes('heat') && c.temp !== 'warm' ? 'slow' : 'normal');
  const outs: Out[] = [];
  for (const s of m.sources) {
    if (s === 'to_vapor') outs.push(realOutcome(c));
    else if (s === 'leak_bottom') outs.push(c.napkin === 'yes' ? 'wet' : steady());
    else if (s === 'sun_pulls') outs.push(closed || c.sun !== 'yes' ? 'stays' : 'normal');
    else if (s === 'air_takes') outs.push(closed ? 'stays' : c.air === 'fan' ? 'fast' : steady());
    else if (s === 'someone_drank') outs.push(closed ? 'stays' : steady());
    else if (s === 'only_boiling') outs.push('stays'); // nothing here ever boils
    else outs.push(steady()); // glass_drinks, vanishes: a lid does not stop them
  }
  if (outs.includes('wet')) return 'wet';
  if (m.requires.includes('boiling')) return 'stays';
  if (m.requires.includes('sun') && c.sun !== 'yes') return 'stays';
  if (outs.includes('fast')) return 'fast';
  if (outs.includes('normal')) return 'normal';
  if (outs.includes('slow')) return 'slow';
  return 'stays';
}

/* ───────────── offline language patterns ───────────── */

/** step 2: liquid water becomes vapour (a gas) */
const BECOMES_VAPOUR = anyOf(
  /(?:كل ?ما [^.،,؟!]{0,25}?)?(?:بخار|تبخر)/,
  /(?:بتصير|بتتحول|تصير|تتحول|بيصير|بيتحول|يصير|يتحول|بصير|صارت|صار) (?:ل|الي )?(?:غاز)/,
  /(?:turns?|turned|turning|chang(?:es?|ed|ing)|goes) (?:in)?to (?:a |an )?(?:invisible )?(?:gas|vapou?r)/,
  /becom(?:es?|ing) (?:a |an )?(?:invisible )?(?:gas|vapou?r)|evaporat|vapou?r/,
);

/** the claim that water only leaves when it boils */
const ONLY_BOILING = anyOf(
  /(?:\S+ )?(?:ما|مش|مستحيل|لا) ?(?:بتتبخر\S*|بيتبخر\S*|تتبخر|يتبخر|بتصير بخار|بتصير غاز|بتطلع|بتنقص) [^.؟!]{0,20}?(?:الا|غير|بدون ما|من غير ما)\s[^.؟!]{0,14}?(?:تغلي|يغلي|بتغلي|بيغلي|غليان|الغلي|غلت)/,
  /(?:\S+ )?ما(?:ب|بي|بت)\S{2,}ش [^.؟!]{0,20}?(?:الا|غير)\s[^.؟!]{0,14}?(?:تغلي|يغلي|بتغلي|بيغلي|غليان|غلت)/,
  /(?:الا|غير|بس|فقط) (?:لما|اذا|وقت|وقتها|عند|بال)\s?[^.،,؟!]{0,14}?(?:تغلي|يغلي|بتغلي|بيغلي|غليان|الغلي|غلت)/,
  /(?:لازم|بدها|بده) [^.،,؟!]{0,18}?(?:تغلي|يغلي|غليان|تنغلي)/,
  /(?:\S+ )?(?:doesn't|does not|do not|don't|can't|cannot|can not|won't|will not|never|not) [^.?!]{0,35}?(?:unless|until|without) [^.?!]{0,15}?boil\w*/,
  /only [^.?!]{0,30}?(?:when|if|while|by|after)[^.?!]{0,15}?boil\w*|only boil\w*/,
  /(?:needs?|has|have) to (?:be )?boil\w*|must (?:be )?boil\w*|needs? boiling/,
);
/** the same claim, not negated by the learner: used to keep "vapour" words from counting as the scientific idea */
const ONLY_BOILING_CLAIM = anyOf(
  /(?<!(?:مش|مو) )(?:الا|غير|بس|فقط) (?:لما|اذا|وقت|وقتها|عند|بال)\s?[^.،,؟!]{0,14}?(?:تغلي|يغلي|بتغلي|بيغلي|غليان|الغلي|غلت)/,
  /(?<!(?:ما|مش|مو) )(?:لازم|بدها|بده) [^.،,؟!]{0,18}?(?:تغلي|يغلي|غليان|تنغلي)/,
  /(?<!not )only [^.?!]{0,30}?(?:when|if|while|by|after)[^.?!]{0,15}?boil\w*/,
  /(?:unless|until) [^.?!]{0,15}?boil|(?<!(?:not|n't) )(?:need|has|have)s? to (?:be )?boil|must (?:be )?boil/,
);

const VAPOUR_WORDS = /بخار|تبخر|vapou?r|evaporat/;

/* ───────────── pack ───────────── */

export const evaporation: ConceptPack = {
  id: 'evaporation',
  subject: 'science',
  title: t('المي اللي بتنقص', 'The shrinking water'),
  question: t('ليش مي الكاسة بتنقص إذا تركناها كم يوم؟', 'Why does the water in a cup go down if we leave it for a few days?'),
  grades: [3, 5],
  curriculum: {
    verified: true,
    note: t(
      'العلوم والحياة، الصف الثالث، الجزء الأول (طبعة 2020): الوحدة الثانية «الأرض وثرواتها»، الدرس الرابع «دورة الماء في الطبيعة»، نشاط (٢) «التبخّر»، ص ٧٤. وللصف الخامس: الوحدة الثانية «خصائص المادة»، الدرس الثالث «حالات المادة ودقائقها»، ص ٥٢–٥٣.',
      'Science and Life, Grade 3, Part 1 (2020 edition): Unit 2 "The Earth and its resources", Lesson 4 "The water cycle in nature", activity 2 "Evaporation", p. 74. For Grade 5: Unit 2 "Properties of matter", Lesson 3 "States of matter and their particles", pp. 52–53.',
    ),
  },
  objectives: [
    { id: 'o_where', text: t('يشرح وين بتروح المي لما تنقص من وعاء مفتوح.', 'Explain where the water goes when it leaves an open container.'), nodes: ['C3', 'C4'] },
    { id: 'o_heat', text: t('يربط التبخّر بأخد حرارة من المحيط، بدون ما المي تغلي.', 'Link evaporation to heat taken from the surroundings, without boiling.'), nodes: ['C2'] },
    { id: 'o_speed', text: t('يقارن شو بيسرّع التبخّر: الحرارة، السطح الواسع، والهوا المتحرّك.', 'Compare what speeds evaporation up: warmth, a wide surface and moving air.'), nodes: ['C5'] },
  ],
  concepts: {
    C1: { label: t('المي سايلة أو غاز', 'Water can be liquid or gas'), ai: 'water can be a liquid or an invisible gas', needs: [] },
    C2: { label: t('المي بتاخد حرارة', 'Water takes in heat'), ai: 'water takes heat from its surroundings; boiling and direct sun are not required', needs: ['C1'] },
    C3: { label: t('المي بتصير بخار', 'Water becomes vapour'), ai: 'liquid water turns into invisible vapour (it does not stop existing)', needs: ['C1', 'C2'] },
    C4: { label: t('البخار بيختلط بالهوا', 'Vapour mixes into air'), ai: 'the vapour goes into the air and mixes with it', needs: ['C3'] },
    C5: { label: t('شو بيسرّع: غسيل وبرك', 'What speeds it up'), ai: 'warmth, a wide surface and moving air speed it up (drying clothes, puddles, the water cycle)', needs: ['C3', 'C4'] },
  },
  prerequisites: [
    {
      id: 'water_states',
      label: t('المي إلها أكتر من حالة', 'Water has more than one state'),
      why: t('عشان يصدّق إنه المي بتتغيّر وبتضل موجودة.', 'The learner needs to accept that water can change and still exist.'),
      supports: ['C1', 'C3'],
      suspect: { ideas: ['vanishes', 'glass_drinks'], missingSteps: [1] },
      verify: [
        {
          id: 'ws_v1',
          q: t('المي اللي بالكاسة، بأي حالة هي؟', 'What state is the water in a cup?'),
          options: [t('سايلة', 'Liquid'), t('صلبة', 'Solid'), t('غاز', 'Gas')],
          correct: 0,
          node: 'C1',
        },
        {
          id: 'ws_v2',
          q: t('حطّينا مي بالفريزر وصارت تلج. هل التلج مي؟', 'We freeze water into ice. Is the ice still water?'),
          options: [t('لأ، صارت إشي تاني', 'No, it became something else'), t('آه، هي مي بس بحالة صلبة', 'Yes, it is water in a solid state')],
          correct: 1,
          node: 'C1',
        },
      ],
      remedy: {
        title: t('المي بتغيّر شكلها', 'Water changes form'),
        minutes: 5,
        steps: [
          t('حطّوا مكعّب تلج بصحن وراقبوه.', 'Put an ice cube on a plate and watch it.'),
          t('احكوا: كان صلب، وصار سايل. بعدها مي؟', 'Talk: it was solid and became liquid. Is it still water?'),
          t('احكوا إنه للمي حالة تالتة ما منشوفها اسمها غاز.', 'Add that water has a third state we cannot see: a gas.'),
        ],
      },
      recheck: {
        id: 'ws_r',
        // applied, and the other direction from ws_v2 (freezing): melting
        q: t('حطّينا مكعّب تلج على صحن بالشمس، وبعد شوي صار في بركة صغيرة. شو صار بالتلج؟', 'We left an ice cube on a plate in the sun, and soon there was a small puddle. What happened to the ice?'),
        options: [t('اختفى وطلعت مي من الصحن', 'It vanished and water came out of the plate'), t('ذاب وصار مي سايلة، نفس المي', 'It melted into liquid water, the same water'), t('صار حجر', 'It turned into stone')],
        correct: 1,
        node: 'C1',
      },
    },
    {
      id: 'water_vapour',
      label: t('في غاز اسمه بخار المي', 'There is a gas called water vapour'),
      why: t('إذا ما بيعرف إنه المي ممكن تكون بالهوا، رح يدوّر ع مكان تاني راحت عليه.', 'Without knowing water can be in the air, the learner looks for another place it went.'),
      supports: ['C3', 'C4'],
      suspect: { ideas: ['only_boiling', 'vanishes', 'sun_pulls', 'air_takes'], missingSteps: [1, 2] },
      verify: [
        {
          id: 'wv_v1',
          q: t('بخار المي...', 'Water vapour...'),
          options: [t('دايماً منشوفه متل الغيمة البيضا', 'is always seen, like a white cloud'), t('غاز ما منشوفه', 'is a gas we cannot see')],
          correct: 1,
          node: 'C3',
        },
        {
          id: 'wv_v2',
          q: t('الهوا اللي حوالينا...', 'The air around us...'),
          options: [t('ممكن يكون فيه مي بشكل غاز', 'can hold water as a gas'), t('ما بيقدر يكون فيه ولا إشي', 'cannot hold anything at all')],
          correct: 0,
          node: 'C4',
        },
      ],
      remedy: {
        title: t('المي اللي بالهوا', 'Water in the air'),
        minutes: 5,
        steps: [
          t('انفخوا ع مراية أو شبّاك بارد وشوفوا الغباش.', 'Breathe on a mirror or a cool window and look at the fog.'),
          t('اسألوا: هالمي كانت وين قبل ما نشوفها؟', 'Ask: where was this water before we could see it?'),
          t('احكوا إنه كانت غاز ما منشوفه اسمه بخار المي.', 'Explain it was an invisible gas called water vapour.'),
          t('الغيمة البيضا فوق الإبريق نقط صغيرة كتير، مش البخار نفسه.', 'The white cloud over a kettle is tiny drops, not the vapour itself.'),
        ],
      },
      recheck: {
        id: 'wv_r',
        q: t('إذا مي صارت بخار بالغرفة، شو الصح؟', 'If water becomes vapour in a room, which is true?'),
        options: [t('صارت جزء من هوا الغرفة', 'It is now part of the air in the room'), t('اختفت من الدنيا', 'It no longer exists')],
        correct: 0,
        node: 'C4',
      },
    },
  ],
  reference: {
    model: t(
      'طول الوقت في دقايق مي صغيرة ع السطح بتاخد طاقة من حواليها وبتطلع للهوا كبخار ما منشوفه. هاد بيصير بأي حرارة، مش بس بالغليان، وحتى بالعتمة. بيصير أسرع لما الحرارة أعلى، والسطح أوسع، والهوا بيتحرّك. بوعاء مسكّر منيح التبخّر ما بيوقف: البخار بينحبس وبيرجع يتكثّف نقط، فمستوى المي بيضل تقريباً زي ما هو.',
      'All the time, some water particles at the surface take energy from around them and leave as invisible vapour. This happens at any temperature, not only at boiling, and in the dark too. It is faster when it is warmer, the surface is wider and the air moves. In a tightly closed container evaporation does not stop: the trapped vapour condenses back, so the water level stays about the same.',
    ),
    limits: t(
      'المختبر بيقارن السرعة بشكل تقريبي (أبطأ، زي العادة، أسرع): كل مساعد (دفا، شمس، سطح واسع، هوا متحرّك) بينحسب مرّة وحدة. بالحقيقة تأثيرهم مش متساوي. رطوبة الهوا بتأثّر كمان وما منغيّرها هون. والغطا لازم يكون محكم.',
      'The lab compares speeds roughly (slower, usual, faster): each helper (warmth, sun, wide surface, moving air) counts once. In reality they are not equally strong. Air humidity also matters and is not changed here. The lid must seal tightly.',
    ),
    sources: [
      { title: 'العلوم والحياة، الصف الثالث، الجزء الأول (وزارة التربية والتعليم الفلسطينية، طبعة 2020)' },
      { title: 'USGS Water Science School: Evaporation and the Water Cycle' },
      { title: 'OpenStax, College Physics 2e: section "Humidity, Evaporation, and Boiling"' },
      { title: 'Driver, Squires, Rushworth and Wood-Robinson (1994), Making Sense of Secondary Science: Research into Children\'s Ideas, Routledge' },
    ],
  },

  ideas: {
    to_vapor: {
      label: t('بتصير بخار', 'Becomes vapour'),
      mirror: t('هيك إنت شايفها: المي بتاخد حرارة، بتصير بخار ما منشوفه، وبتروح للهوا.', 'This is how you see it: the water takes in heat, becomes vapour we cannot see and goes into the air.'),
      observation: t('المي بتنقص شوي شوي من وعاء مفتوح.', 'Water slowly goes down in an open container.'),
      assumption: t('المي ممكن تصير غاز بدون ما تغلي.', 'Water can become a gas without boiling.'),
      conclusion: t('المي صارت جزء من الهوا.', 'The water became part of the air.'),
      story: [t('المي بتاخد حرارة من حواليها', 'The water takes heat from around it'), t('بتصير بخار ما منشوفه', 'It becomes invisible vapour'), t('البخار بيختلط بالهوا', 'The vapour mixes into the air')],
      wrongStep: null,
      correct: true,
      breaks: null,
      model: { sources: ['to_vapor'], path: 'up_to_air', requires: ['heat'] },
      intervention: t('خلّيه يتوقّع شو بيسرّع الموضوع: صحن واسع، مروحة، مكان دافي. ويشرح ليش.', 'Ask what would speed it up (wide plate, fan, warm spot) and why.'),
      ai: 'liquid water takes heat from its surroundings, turns into invisible vapour and mixes into the air (the scientific idea)',
    },
    glass_drinks: {
      label: t('الكاسة بتشربها', 'The cup drinks it'),
      mirror: t('هيك إنت شايفها: الكاسة بتشرب المي لجوّا، عشان هيك بتنقص.', 'This is how you see it: the cup soaks the water into itself, so it goes down.'),
      observation: t('الإسفنجة والمحرمة بيشربوا المي.', 'Sponges and tissues soak up water.'),
      assumption: t('الزجاج كمان بيقدر يشرب.', 'Glass can soak up water too.'),
      conclusion: t('المي صارت جوّا مادّة الكاسة.', 'The water is now inside the material of the cup.'),
      story: [t('المي لازقة بالزجاج', 'The water touches the glass'), t('الزجاج بيمتصّها', 'The glass soaks it up'), t('بتختفي جوّا الكاسة', 'It disappears into the cup')],
      wrongStep: 1,
      breaks: 'C3',
      model: { sources: ['glass_drinks'], path: 'into_glass', requires: [] },
      intervention: t('كاستين متل بعض، وحدة مسكّرة ووحدة مفتوحة. اسأله قبل: إذا الزجاج بيشرب، شو بصير بالتنتين؟', 'Two identical cups, one sealed and one open. Ask first: if glass drinks, what happens to both?'),
      ai: 'the cup or glass material soaks up / drinks the water',
    },
    leak_bottom: {
      label: t('بتنزّ من تحت', 'Leaks from the bottom'),
      mirror: t('هيك إنت شايفها: المي بتنزّ من قعر الكاسة شوي شوي.', 'This is how you see it: the water slowly leaks out of the bottom of the cup.'),
      observation: t('في أوعية بتسرّب مي من تحت.', 'Some containers do leak from below.'),
      assumption: t('في خزوق صغيرة ما منشوفها.', 'There are tiny holes we cannot see.'),
      conclusion: t('المي نزلت ع الطاولة.', 'The water went down onto the table.'),
      story: [t('في خزوق صغيرة بالقعر', 'There are tiny holes in the bottom'), t('المي بتنزل منها', 'The water drips through them'), t('بتروح ع الطاولة', 'It ends up on the table')],
      wrongStep: 0,
      breaks: 'C3',
      model: { sources: ['leak_bottom'], path: 'out_bottom', requires: [] },
      intervention: t('حطّوا محرمة ناشفة تحت الكاسة، وخلّيه يتوقّع قبل ما تشوفوها.', 'Put a dry tissue under the cup and let them predict before checking it.'),
      ai: 'the water leaks out through the bottom of the container',
    },
    sun_pulls: {
      label: t('الشمس بتسحبها', 'The sun pulls it'),
      mirror: t('هيك إنت شايفها: بس الشمس بتسحب المي لفوق.', 'This is how you see it: only the sun pulls the water up.'),
      observation: t('المي بتنقص أسرع بيوم مشمس.', 'Water goes down faster on a sunny day.'),
      assumption: t('بدون شمس ما بصير إشي.', 'Without sunshine nothing happens.'),
      conclusion: t('الشمس هي اللي بتاخد المي.', 'The sun is what takes the water.'),
      story: [t('الشمس طالعة', 'The sun is out'), t('بتشدّ المي لفوق', 'It pulls the water up'), t('المي بتنقص', 'The water goes down')],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['sun_pulls'], path: 'up_to_air', requires: ['sun'] },
      intervention: t('حطّوا كاسة بخزانة عتمة وكاسة ع الشبّاك. اسأله قبل: شو بتتوقّع للي بالعتمة؟', 'Put one cup in a dark cupboard and one on the window. Ask first what the dark one will do.'),
      ai: 'the sun pulls the water up; it only happens in sunlight',
    },
    air_takes: {
      label: t('الهوا بياخدها', 'The air takes it'),
      mirror: t('هيك إنت شايفها: الهوا بياخد المي معه شوي شوي، وهي بتضل متل ما هي.', 'This is how you see it: the air carries the water off bit by bit, without it changing.'),
      observation: t('الغسيل بينشف أسرع بيوم هوا.', 'Washing dries faster on a windy day.'),
      assumption: t('الهوا بيحمل نقط مي صغيرة متل ما هي، بدون حرارة.', 'Air carries tiny drops as they are; warmth plays no part.'),
      conclusion: t('المي راحت مع الهوا وهي لسا سايلة.', 'The water left with the air, still liquid.'),
      story: [t('الهوا بيمرق فوق المي', 'Air passes over the water'), t('بياخد منها نقط صغيرة متل ما هي', 'It takes tiny drops of it as they are'), t('المي بتنقص', 'The water goes down')],
      wrongStep: 1,
      breaks: 'C3',
      model: { sources: ['air_takes'], path: 'up_to_air', requires: [] },
      intervention: t('قارنوا مكان دافي ومكان بارد بدون ولا نسمة هوا. اسأله قبل: بيفرقوا؟', 'Compare a warm and a cold still place. Ask first whether they will differ.'),
      ai: 'the air or wind takes the water away as liquid bits, without a change of state; warmth does not matter',
    },
    vanishes: {
      label: t('بتختفي لحالها', 'It just disappears'),
      mirror: t('هيك إنت شايفها: المي بتختفي لحالها وما بتضل موجودة.', 'This is how you see it: the water just disappears and no longer exists.'),
      observation: t('ما منشوف المي وهي رايحة.', 'We cannot see the water leaving.'),
      assumption: t('إذا ما منشوف إشي، يعني بطّل موجود.', 'If we cannot see something, it no longer exists.'),
      conclusion: t('المي انتهت.', 'The water is simply gone.'),
      story: [t('المي قاعدة بالكاسة', 'The water sits in the cup'), t('بتختفي وبتبطّل موجودة', 'It vanishes and stops existing'), t('فبتنقص', 'So the level goes down')],
      wrongStep: 1,
      breaks: 'C3',
      model: { sources: ['vanishes'], path: 'disappears', requires: [] },
      intervention: t('كاسة مسكّرة منيح: اسأله إذا المي «بتختفي»، ليش هون بتضل؟ ودلّوا ع النقط تحت الغطا.', 'Use a sealed cup: if water vanishes, why does it stay here? Point out the drops under the lid.'),
      ai: 'the water just disappears / stops existing, with no destination',
    },
    someone_drank: {
      label: t('حدا شربها', 'Someone drank it'),
      mirror: t('هيك إنت شايفها: حدا شرب من الكاسة أو كبّ منها.', 'This is how you see it: someone drank from the cup or poured some out.'),
      observation: t('المي بتنقص لما حدا يشرب.', 'Water goes down when someone drinks.'),
      assumption: t('المي ما بتنقص إلا إذا حدا أخدها.', 'Water only goes down if somebody takes it.'),
      conclusion: t('في حدا لمس الكاسة.', 'Somebody touched the cup.'),
      story: [t('حدا مرق جنب الكاسة', 'Someone passed by the cup'), t('شرب منها أو كبّها', 'They drank or poured some'), t('فنقصت', 'So it went down')],
      wrongStep: 1,
      breaks: 'C3',
      model: { sources: ['someone_drank'], path: 'taken_out', requires: [] },
      intervention: t('حطّوا كاستين بمكان ما حدا بيوصله، وحدة عليها مروحة. اسأله ليش وحدة نقصت أكتر.', 'Put two cups out of reach, one with a fan, and ask why one lost more.'),
      ai: 'a person or animal drank it or poured it out',
    },
    only_boiling: {
      label: t('بس لما تغلي', 'Only when it boils'),
      mirror: t('هيك إنت شايفها: المي ما بتطلع للهوا إلا إذا غلت ع النار.', 'This is how you see it: water only goes into the air if it boils on the stove.'),
      observation: t('لما المي تغلي منشوفها بتنقص بسرعة.', 'We see water go down quickly when it boils.'),
      assumption: t('بدون غليان ما بتتغيّر المي.', 'Without boiling, water does not change.'),
      conclusion: t('اللي نقص من الكاسة راح بطريقة تانية.', 'The water missing from the cup must have left another way.'),
      story: [t('مي الكاسة مش سخنة كتير', 'The water in the cup is not very hot'), t('بدون غليان ما بتتغيّر', 'Without boiling it does not change'), t('فلازم تضل متل ما هي', 'So it should stay as it is')],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['only_boiling'], path: 'up_to_air', requires: ['boiling'] },
      intervention: t('اسأله: اللوح المبلول بينشف، هل غلى؟ وبعدين جرّبوا بقعتين مي، وحدة بالمروحة.', 'Ask: did the wet board boil as it dried? Then try two wet patches, one fanned.'),
      ai: 'water only evaporates when it boils',
    },
  },
  paths: {
    up_to_air: { label: t('بتطلع للهوا', 'Up into the air'), ai: 'goes up into the air' },
    into_glass: { label: t('بتدخل بالكاسة', 'Into the cup material'), ai: 'goes into the material of the container' },
    out_bottom: { label: t('بتطلع من تحت', 'Out of the bottom'), ai: 'goes out through the bottom' },
    disappears: { label: t('بتختفي بمكانها', 'Vanishes in place'), ai: 'disappears where it is' },
    taken_out: { label: t('حدا بياخدها', 'Someone takes it'), ai: 'a person or animal takes it out' },
  },
  requires: {
    heat: { label: t('بدها حرارة', 'Needs warmth'), ai: 'depends on warmth' },
    sun: { label: t('بدها شمس', 'Needs sunlight'), ai: 'happens only in sunlight' },
    boiling: { label: t('بدها غليان', 'Needs boiling'), ai: 'happens only when the water boils' },
  },
  correctModel: { sources: ['to_vapor'], path: 'up_to_air', requires: ['heat'] },

  steps: [
    {
      text: t('المي بتاخد حرارة من حواليها، حتى بدون غليان وبدون شمس مباشرة.', 'The water takes heat from its surroundings, with no need to boil or sit in direct sun.'),
      node: 'C2',
      test: anyOf(
        /(?:كل ?ما [^.،,؟!]{0,15}?)?(?:بتاخد|بتاخذ|تاخد|تاخذ|بياخد|بياخذ|اخدت|اخذت|بتكسب|بتمتص|بتستمد|بتسحب) (?:\S+ )?(?:ال)?(?:حراره|حرارتها|دفا|طاقه|سخونه)/,
        /(?:حراره|دفا) (?:ال)?(?:جو|غرفه|هوا|مكان|شمس|محيط)/,
        /(?:كل ?ما [^.،,؟!]{0,15}?)?(?:بتسخن|تسخن|سخنت|بتدفي|تدفي|بتدفا|تدفا|دفيت|بتحمي|تحمي)/,
        /(?:من|بسبب|بفعل|مع) (?:ال)?(?:حراره|حر|شوب|دفا)(?![ء-ي])|بالحراره|الحراره (?:بتخلي|بتخليها|بتحول|بتحولها|بتبخر)/,
        /(?:takes?|took|taking|gets?|getting|absorbs?|absorbed|gains?|receives?) (?:in )?(?:some |the )?(?:heat|energy|warmth)/,
        /heat (?:from|of) |because of (?:the )?(?:heat|warmth)|(?:with|from) (?:the )?(?:heat|warmth)|heat (?:makes|turns|changes)/,
        /water (?:gets?|becomes?|is getting) (?:warm|hot)|(?<![a-z])warms?(?: up)? (?:the )?water|water warms|energy from/,
      ),
      noorSays: t('علّمتني إنه المي بتاخد حرارة من الجو اللي حواليها.', 'You taught me that the water takes heat from its surroundings.'),
      noorAsks: t('شو اللي بيساعد المي تتغيّر؟ ومن وين بيجيها؟', 'What helps the water change, and where does it get it from?'),
    },
    {
      text: t('بتتحوّل لبخار ما منشوفه.', 'It turns into invisible vapour.'),
      node: 'C3',
      test: BECOMES_VAPOUR,
      noorSays: t('وعلّمتني إنها بتصير بخار ما منشوفه.', 'You also taught me that it becomes vapour we cannot see.'),
      noorAsks: t('طيّب المي اللي نقصت، شو صار شكلها؟', 'So what form is the missing water in now?'),
    },
    {
      text: t('البخار بيروح للهوا وبيختلط فيه.', 'The vapour goes into the air and mixes with it.'),
      node: 'C4',
      test: anyOf(
        /(?:كل ?ما [^.،,؟!]{0,25}?)?(?:بتطلع|بيطلع|تطلع|يطلع|بتروح|بيروح|تروح|يروح|بتطير|بيطير|تطير|بتختلط|بيختلط|بتنتشر|بينتشر|بتنخلط|بينخلط|بتدخل|بيدخل|بتصعد|بيصعد|طلعت|طلع|راحت|راح)\S* [^.؟!]{0,18}?(?:بالهوا|بالهواء|للهوا|للهواء|عالهوا|عالهواء|ع الهوا|مع الهوا|الي الهوا|الي الهواء|بالجو|للجو|عالجو|مع الجو)/,
        /(?:بيختلط|يختلط|بتختلط|تختلط|مخلوط|بينخلط)[^.؟!]{0,10}?(?:هوا|هواء|جو)/,
        /(?:goes?|going|went|rises?|rose|floats?|moves?|escapes?|spreads?|flies|fly|travels?) [^.?!]{0,20}?(?:in(?:to)? (?:the )?air|to the air)/,
        /mix(?:es|ed|ing)? (?:in )?with (?:the )?air|into the air|part of the air/,
      ),
      noorSays: t('وعلّمتني إنه البخار بيروح للهوا وبيختلط فيه.', 'And you taught me that the vapour goes into the air and mixes with it.'),
      noorAsks: t('وبعدين وين بتروح؟', 'And then where does it go?'),
    },
  ],

  variables: [
    { id: 'temp', label: t('حرارة المكان', 'Temperature'), options: [{ id: 'warm', label: t('دافي', 'Warm') }, { id: 'cold', label: t('بارد', 'Cold') }] },
    { id: 'area', label: t('الوعاء', 'Container'), options: [{ id: 'cup', label: t('كاسة', 'Cup') }, { id: 'plate', label: t('صحن واسع', 'Wide plate') }] },
    { id: 'air', label: t('الهوا', 'Airflow'), options: [{ id: 'still', label: t('هادي', 'Still') }, { id: 'fan', label: t('مروحة', 'Fan') }] },
    { id: 'lid', label: t('الغطا', 'Cover'), options: [{ id: 'open', label: t('مفتوح', 'Open') }, { id: 'closed', label: t('مسكّر منيح', 'Sealed') }] },
    { id: 'sun', label: t('الضو', 'Light'), options: [{ id: 'yes', label: t('بالشمس', 'In the sun') }, { id: 'no', label: t('بالعتمة', 'In the dark') }] },
    { id: 'napkin', label: t('تحت الوعاء', 'Underneath'), options: [{ id: 'no', label: t('ولا إشي', 'Nothing') }, { id: 'yes', label: t('محرمة ناشفة', 'Dry tissue') }] },
  ],
  baseline: { temp: 'warm', area: 'cup', air: 'still', lid: 'open', sun: 'yes', napkin: 'no' },
  experiments: [
    {
      id: 'V_lid',
      name: t('نسكّر الكاسة منيح', 'Seal the cup'),
      short: t('غطا', 'Lid'),
      change: { lid: 'closed' },
      question: t('سكّرنا الكاسة منيح بنايلون. بعد ٣ أيام، شو بصير بمستوى المي مقارنة بالكاسة المفتوحة العادية؟', 'We seal the cup tightly with cling film. After 3 days, what happens to the water level compared with the usual open cup?'),
      choices: ['stays', 'slow', 'normal', 'fast'],
      minutes: 6,
      materials: ['cups', 'water', 'cover', 'paper'],
      safety: { adult: false, note: t('إذا الكاسة زجاج، امسكها بإيدتين وحطّها بعيد عن حرف الطاولة.', 'Hold glass with both hands and keep it away from the table edge.') },
      minGrade: 3,
      targets: ['C3', 'C4'],
      home: {
        steps: [
          t('عبّي كاستين متل بعض لنفس العلو.', 'Fill two identical cups to the same height.'),
          t('علّم مستوى المي بلزقة ورق.', 'Mark the water level with a strip of paper tape.'),
          t('سكّر وحدة بنايلون وخيط، واترك التانية مفتوحة.', 'Seal one with cling film and string, leave the other open.'),
          t('حطّهم جنب بعض ٣ أيام.', 'Leave them side by side for 3 days.'),
        ],
        record: t('قديش المستوى بكل كاسة بعد ٣ أيام؟ وشو شايف تحت النايلون؟', 'Where is each level after 3 days? What do you see under the film?'),
        reflect: [t('شو الفرق الوحيد بين الكاستين؟', 'What is the only difference between the cups?'), t('من وين إجت النقط اللي تحت الغطا؟', 'Where did the drops under the lid come from?')],
      },
    },
    {
      id: 'V_dark',
      name: t('بالعتمة، بمكان دافي', 'In the dark, still warm'),
      short: t('عتمة', 'Dark'),
      change: { sun: 'no' },
      question: t('حطّينا الكاسة المفتوحة بخزانة دافية وعتمة. شو بصير بالمي مقارنة بكاسة الشبّاك؟', 'We put the open cup in a warm, dark cupboard. What happens to the water compared with the cup on the window?'),
      choices: ['stays', 'slow', 'normal', 'fast'],
      minutes: 6,
      materials: ['cups', 'water', 'sunlight', 'paper'],
      safety: { adult: false, note: t('حط الكاسة بمكان ما بتنكبّ فيه.', 'Put the cup where it cannot be knocked over.') },
      minGrade: 3,
      targets: ['C2', 'C3'],
      home: {
        steps: [
          t('عبّي كاستين لنفس العلو وعلّم المستوى.', 'Fill two cups to the same height and mark it.'),
          t('حط وحدة بخزانة دافية عتمة، ووحدة ع شبّاك مشمس.', 'Put one in a warm dark cupboard and one on a sunny window.'),
          t('شوفهم بعد ٣ أيام.', 'Check them after 3 days.'),
        ],
        record: t('أي كاسة نقصت؟ وقديش كل وحدة؟', 'Which cups went down, and by how much?'),
        reflect: [t('هل لازم شمس عشان المي تنقص؟', 'Is sunshine needed for the water to go down?'), t('شو بتعطي الشمس زيادة؟', 'What extra does the sun give?')],
      },
    },
    {
      id: 'V_napkin',
      name: t('محرمة ناشفة تحت الكاسة', 'A dry tissue underneath'),
      short: t('محرمة', 'Tissue'),
      change: { napkin: 'yes' },
      question: t('حطّينا الكاسة ع محرمة ناشفة. بعد يومين، شو رح نلاحظ؟', 'We stand the cup on a dry tissue. After two days, what will we notice?'),
      choices: ['wet', 'normal', 'stays'],
      minutes: 5,
      materials: ['cups', 'water', 'napkins'],
      safety: { adult: false, note: t('نشّف الكاسة من برّا قبل ما تحطّها.', 'Dry the outside of the cup before putting it down.') },
      minGrade: 3,
      targets: ['C3'],
      home: {
        steps: [
          t('نشّف الكاسة من برّا ومن تحت.', 'Dry the outside and bottom of the cup.'),
          t('حطّها ع محرمة ناشفة وعلّم مستوى المي.', 'Stand it on a dry tissue and mark the water level.'),
          t('شوف المحرمة والمستوى بعد يومين.', 'Check the tissue and the level after two days.'),
        ],
        record: t('المحرمة ناشفة ولا مبلولة؟ والمستوى؟', 'Is the tissue dry or wet? What about the level?'),
        reflect: [t('لو المي طالعة من تحت، شو لازم يصير بالمحرمة؟', 'If the water left through the bottom, what should happen to the tissue?')],
      },
    },
    {
      id: 'V_cold',
      name: t('بمكان بارد', 'In a cold place'),
      short: t('برد', 'Cold'),
      change: { temp: 'cold' },
      question: t('نقلنا الكاسة المفتوحة لمكان بارد. شو بصير بالمي مقارنة بالمكان الدافي؟', 'We move the open cup to a cold place. What happens to the water compared with the warm place?'),
      choices: ['stays', 'slow', 'normal', 'fast'],
      minutes: 6,
      materials: ['cups', 'water', 'ice', 'paper'],
      safety: { adult: false, note: t('بالتلّاجة منحط الكاسة ع رف ثابت.', 'In the fridge, stand the cup on a flat shelf.') },
      minGrade: 3,
      targets: ['C2', 'C5'],
      home: {
        steps: [
          t('عبّي كاستين لنفس العلو وعلّم المستوى.', 'Fill two cups to the same height and mark it.'),
          t('حط وحدة بالتلّاجة (مفتوحة) ووحدة بخزانة دافية: التنتين بالعتمة.', 'Put one open in the fridge and one in a warm cupboard, so both are dark.'),
          t('شوفهم بعد ٣ أيام.', 'Check them after 3 days.'),
        ],
        record: t('أي كاسة نقصت أكتر؟', 'Which cup went down more?'),
        reflect: [t('شو الفرق بين المكانين؟ وكيف أثّر؟', 'How do the two places differ, and what did that change?')],
      },
    },
    {
      id: 'V_wide',
      name: t('نفس المي بصحن واسع', 'Same water in a wide plate'),
      short: t('صحن واسع', 'Wide plate'),
      change: { area: 'plate' },
      question: t('كبّينا المي بصحن واسع ومفتوح بدل الكاسة. شو بصير بالمي مقارنة بالكاسة؟', 'We pour the water into a wide open plate instead of the cup. What happens compared with the cup?'),
      choices: ['stays', 'slow', 'normal', 'fast'],
      minutes: 7,
      materials: ['cups', 'plates', 'water', 'sunlight'],
      safety: { adult: false, note: t('امسح أي مي بتنكبّ عشان ما حدا يتزحلق.', 'Wipe up spills so nobody slips.') },
      minGrade: 3,
      targets: ['C5'],
      home: {
        steps: [
          t('قيس نفس الكمية: ٥ معالق مي لكاسة و٥ معالق لصحن واسع.', 'Measure the same amount: 5 spoons into a cup and 5 into a wide plate.'),
          t('حطّهم جنب بعض بنفس المكان.', 'Leave them side by side in the same place.'),
          t('بعد يوم، رجّع المي بالمعلقة وعدّ كم معلقة ضلّت.', 'After a day, count with the spoon how much is left in each.'),
        ],
        record: t('كم معلقة ضلّت بالكاسة؟ وكم بالصحن؟', 'How many spoons are left in the cup and in the plate?'),
        reflect: [t('شو الفرق بشكل المي بين الاتنين؟', 'How does the shape of the water differ?')],
      },
    },
    {
      id: 'V_fan',
      name: t('نشغّل مروحة', 'Add a fan'),
      short: t('مروحة', 'Fan'),
      change: { air: 'fan' },
      question: t('شغّلنا مروحة هادية جنب الكاسة المفتوحة. شو بصير بالمي مقارنة بدون مروحة؟', 'We run a gentle fan next to the open cup. What happens to the water compared with no fan?'),
      choices: ['stays', 'slow', 'normal', 'fast'],
      minutes: 7,
      materials: ['cups', 'water', 'fan', 'napkins'],
      safety: { adult: true, note: t('المروحة الكهربا بيشغّلها الكبير، بعيدة عن المي وبدون ما نحط إيدينا فيها. أو منهوّي بكرتونة.', 'An adult runs any electric fan, away from the water, with fingers kept out. Or fan with a piece of card.') },
      minGrade: 3,
      targets: ['C4', 'C5'],
      home: {
        steps: [
          t('بلّل محرمتين بنفس كمية المي.', 'Wet two tissues with the same amount of water.'),
          t('افرد التنتين بعيد عن بعض.', 'Spread them out well apart.'),
          t('هوّي ع وحدة بكرتونة دقيقتين، وبعدين استنّى. عيد كل شوي.', 'Fan one with card for two minutes, wait, and repeat.'),
          t('شوف أي وحدة بتنشف قبل.', 'See which one dries first.'),
        ],
        record: t('أي محرمة نشفت قبل؟', 'Which tissue dried first?'),
        reflect: [t('شو عمل الهوا المتحرّك؟', 'What did the moving air do?')],
      },
    },
  ],
  outcomes: {
    stays: t('مستوى المي بيضل تقريباً زي ما هو', 'The water level stays about the same'),
    slow: t('بتنقص أبطأ من العادة', 'Goes down more slowly than usual'),
    normal: t('بتنقص زي العادة', 'Goes down at the usual speed'),
    fast: t('بتنقص أسرع من العادة', 'Goes down faster than usual'),
    wet: t('المحرمة اللي تحتها بتتبلّ', 'The tissue underneath gets wet'),
  },
  kidOutcome,
  realOutcome,
  scene3d: 'evaporation',

  noor: {
    greeting: t('أهلاً! أنا نور. تركنا هالكاسة كم يوم، وشوف: المي نقصت! احكيلي بكلامك: وين راحت؟', "Hi! I'm Noor. We left this cup for a few days and look: there is less water! Tell me in your own words: where did it go?"),
    invite: t('فهمت فكرتك! يلا نفحصها. توقّع شو بصير، وبعدين منجرّب.', "I got your idea! Let's test it. Predict what will happen, then we try."),
    afterContradiction: t('اللي صار غير اللي توقّعته فكرتك. يعني في إشي ناقص. وين راحت المي برأيك هلأ؟', 'The result is not what your idea predicted, so something is missing. Where do you think the water goes now?'),
    afterMatch: t('هالمرّة فكرتك صمدت. جرّب تغيّر إشي تاني، أو عدّل فكرتك إذا بدك.', 'Your idea held up this time. Change something else, or update your idea if you like.'),
    sameResult: t('فكرتك والتجربة أعطوا نفس النتيجة. هاي التجربة ما بتفرّق. جرّب تغيّر إشي تاني.', 'Your idea and the test gave the same result. This test cannot tell them apart. Change something else.'),
    praise: t('واو! شرحك كامل وواضح. بتعلّمني إنت هلأ؟', 'Wow! Your explanation is complete and clear. Will you teach me now?'),
    partial: t('في إشي حلو بشرحك! بس لسا ناقصني جزء. احكيلي أكتر.', 'There is something good in your explanation! I am still missing a piece. Tell me more.'),
    contradiction: t('سمعت منك فكرتين بيعاكسوا بعض. أي وحدة بتختار؟ وليش؟', 'I heard two ideas that disagree. Which one do you choose, and why?'),
    offtopic: t('حلو! بس خلّينا نرجع للكاسة. وين راحت المي برأيك؟', "Nice! But let's get back to the cup. Where do you think the water went?"),
    unsupported: t('فكرة بتفتح العين! ما بقدر أجرّبها هون. احكيلي عن المي بطريقة تانية، أو اسأل معلّمك.', "That's an interesting idea! I can't test it here. Tell me about the water another way, or ask your teacher."),
  },
  hints: [
    t('ارجع لفكرتك. لو هي صح، شو لازم يصير بكاسة تانية متلها؟', 'Go back to your idea. If it is right, what should happen to another cup like this one?'),
    t('انتبه: المي بتنقص حتى لو ما حدا لمسها. شو تغيّر بالكاسة، وشو ضل متل ما هو؟', 'Notice: the water goes down even if nobody touches it. What changed around the cup, and what stayed the same?'),
    t('قارن كاسة مسكّرة وكاسة مفتوحة جنب بعض. وين في طريق مفتوح؟', 'Compare a sealed cup and an open cup side by side. Where is there an open way out?'),
    t('المي بتاخد حرارة من حواليها وبتتحوّل لبخار ما منشوفه، والبخار بيروح للهوا وبيختلط فيه. هلأ احكيها بكلامك.', 'The water takes heat from around it and turns into vapour we cannot see, and the vapour mixes into the air. Now say it in your own words.'),
  ],
  clarify: [
    { id: 'where', q: t('احكيلي أكتر: المي اللي نقصت، وين هي هلأ برأيك؟', 'Tell me more: where do you think the missing water is now?'), ai: 'open question: where is the missing water now?' },
    { id: 'direction', q: t('برأيك المي راحت لتحت، لجوّا الكاسة، لفوق، ولا صار إشي تاني؟', 'Do you think the water went down, into the cup, upwards, or did something else happen?'), ai: 'which way did the water go?' },
    { id: 'lid_case', q: t('لو سكّرنا الكاسة منيح، شو بتتوقّع يصير بمستوى المي؟', 'If we seal the cup tightly, what do you expect the water level to do?'), ai: 'prediction for a sealed cup' },
    { id: 'dark_case', q: t('ولو خبّينا الكاسة بخزانة عتمة، شو بتتوقّع؟', 'And if we hide the cup in a dark cupboard, what do you expect?'), ai: 'prediction for a cup in the dark' },
  ],
  answerWords: /بخّ?ار|تبخّ?ر|تكاثف|تكثّ?ف|evaporat|vapou?r|condens/i,
  teach: {
    planted: t('فهمت! يعني لو سكّرنا الكاسة بغطا محكم، المي رح تضل تنقص بنفس السرعة. صح؟', 'I see! So if we seal the cup with a tight lid, the water will keep going down at the same speed. Right?'),
    truth: 'With a tight lid water still evaporates, but the vapour is trapped and condenses back, so the level stays about the same instead of going down.',
    accept: new RegExp(
      '^(?=[\\s\\S]*(?:' +
        /(?<![ء-ي])(?:لا|مش|مو|غلط|خطا|بالعكس|العكس|مستحيل|ما رح|ما راح|ما بتنقص|ما بتقل|بتضل|بيضل)(?![ء-ي])|\bno\b|\bnope\b|\bnot\b|n't\b|cannot|wrong|incorrect|opposite|\bstays?\b/.source +
        '))(?=[\\s\\S]*(?:' +
        anyOf(
          /بينحبس|بتنحبس|محبوس|محبوسه|بيحبس|بتحبس|بحبس|يحبس|حابس|بيرجع|بترجع|يرجع|ترجع|بتكثف|بيتكثف/,
          /(?:ما|مش) (?:رح |راح )?(?:بيقدر|بتقدر|يقدر|تقدر|بقدر|فيه|فيها) [^.؟!]{0,15}?(?:يطلع|تطلع|يهرب|تهرب|يروح|تروح)/,
          /ما (?:في|فيه|فيها) (?:طريق|مجال|منفذ|محل)|(?:الغطا|النايلون) (?:\S+ )?(?:بيمنع|بسد|بيسد|حاجز|بوقف|بيوقف|مانع)|نقط[^.؟!]{0,15}?(?:الغطا|النايلون)/,
          /trap|(?:can't|cannot|can not|won't|doesn't|unable to) (?:\w+ ){0,3}?(?:get out|escape|leave|go out|come out|go into the air|reach the air)/,
          /stays? (?:in|inside|under)|(?:comes?|goes?|drips?|drops?|falls?|turns?) back|condens|(?:lid|cover) (?:keeps|blocks|stops|holds)|no way out/,
        ).source +
        '))',
    ),
    reject: anyOf(
      /^(?:اه|اها|ايوه|ايوا|نعم|صح|صحيح|مزبوط|مظبوط|اكيد|طبعا|يس|yes|yeah|yep|right|true|correct|sure|of course)(?![ء-يa-z])/,
      /^(?!(?:لا|مش|غلط|بالعكس|مستحيل|no|nope|wrong|not)(?![ء-يa-z]))[\s\S]*?(?:(?<!(?:مش|ما|لا|مو) )(?<!(?:مش|ما|لا) (?:رح|راح) )(?:بتنقص|تنقص|بتضل تنقص) (?:بنفس السرعه|نفس السرعه|عادي|متل قبل|زي قبل)|(?:will|keeps?|still) (?:keep )?(?:go(?:es|ing)? down|drop(?:s|ping)?|get(?:s|ting)? less)[^.?!]{0,15}?same speed)/,
    ),
    thanks: t('آه! المي بتضل تطلع منها، بس البخار بينحبس تحت الغطا وبيرجع نقط، فالمستوى بيضل تقريباً زي ما هو. شكراً يا معلّمي!', 'Oh! Water still leaves the surface, but the vapour is trapped under the lid and turns back into drops, so the level stays about the same. Thank you, teacher!'),
    confused: t('لسا محتارة… تحت الغطا، وين بيروح اللي بيطلع من المي؟ وشو بصير بالمستوى؟', "I'm still puzzled... under the lid, where does what leaves the water go? And what happens to the level?"),
  },
  challenge: {
    phenomenon: t('الغسيل المنشور بينشف، وبيوم الشوب بينشف أسرع. ليش؟', 'Washing on the line dries, and it dries faster on a hot day. Why?'),
    solved: t('المي اللي بالأواعي بتاخد حرارة من الجو، بتصير بخار ما منشوفه، والبخار بيروح للهوا. بيوم الشوب في حرارة أكتر، فبتنشف أسرع.', 'The water in the clothes takes heat from around it, becomes invisible vapour and goes into the air. A hot day gives more heat, so they dry faster.'),
  },
  transfer: {
    prompt: t('بعد الشتا ضلّت بركة مي صغيرة بساحة المدرسة. بعد يومين نشفت. فسّر بكلامك: وين راحت المي؟', 'After the rain a small puddle was left in the school yard. Two days later it was dry. Explain in your own words: where did the water go?'),
    check: {
      id: 'tr_board',
      q: t('مسحنا اللوح بإسفنجة مبلولة. كيف منخلّيه ينشف أسرع؟', 'We wiped the board with a wet sponge. How can we make it dry faster?'),
      options: [t('منهوّي عليه بكرتونة', 'Fan it with a piece of card'), t('منغطّيه بنايلون', 'Cover it with plastic'), t('منسكّر الشبابيك ومنطفي المروحة', 'Close the windows and switch the fan off')],
      correct: 0,
      node: 'C5',
    },
  },

  rules: [
    { idea: 'to_vapor', re: anyOf(/بخار|تبخر/, /(?:بتصير|بتتحول|تصير|تتحول|بيصير|بيتحول) (?:ل|الي )?غاز/, /vapou?r|evaporat|(?:turns?|chang(?:es?|ed)) (?:in)?to (?:a )?gas|becomes? (?:a )?gas/), unless: ONLY_BOILING_CLAIM },
    {
      idea: 'glass_drinks',
      re: anyOf(
        /(?:الكاسه|الكاس|الكوب|الكبايه|الزجاج|القزاز|الصحن|الوعاء)(?: (?:نفسها|نفسه|هي|هو))?(?: (?:عم|اللي))? (?:بتشرب|بيشرب|تشرب|يشرب|شربت|شربها|شرب|بتمتص|بيمتص|امتص|امتصت|امتصها|بتمص|مصت)\S*(?! (?:ال)?(?:حراره|طاقه|دفا))/,
        /(?:بتشربها|بيشربها|شربتها|بتمتصها|بيمتصها) (?:ال)?(?:كاسه|كاس|كوب|كبايه|زجاج|قزاز|صحن)/,
        /(?:بتدخل|دخلت|بتفوت|فاتت) (?:بالزجاج|بالقزاز|جوا الزجاج|بمسامات)/,
        /(?:glass|cup|plate|container) (?:itself )?(?:drinks?|drank|absorbs?|absorbed|soaks?(?: up)?|soaked(?: up)?|sucks?(?: up| in)?)(?![a-z])(?! (?:the )?(?:heat|energy))/,
        /(?:soaks?|soaked|goes|went) into the (?:glass(?! of)|walls? of the cup)|(?:water|it) is (?:drunk|absorbed|soaked up) by the (?:glass|cup|plate)/,
      ),
    },
    {
      idea: 'leak_bottom',
      re: anyOf(
        /(?:بتنز|تنز|بينز|بتنزز|نزت|بترشح|بيرشح|ترشح|بتسرب|تسرب|بيتسرب|بتهرب|بتخر|بيخر)(?:ت|ها)?(?![ء-ي])|تسريب/,
        /(?:بتنزل|بتطلع|بتهرب|بتروح|نزلت|طلعت) من (?:ال)?(?:تحت|قعر|اسفل)|من تحت (?:ال)?(?:كاس\S* )?(?:بتنزل|بتطلع|بتهرب|نزلت)/,
        /ثقوب|ثقب|بخاش|خزق|خزوق|مخزوق|مخروم|مثقوب|مبخوش/,
        /leak\w*|holes? (?:in|at) (?:the )?(?:bottom|cup|glass)|(?:drips?|seeps?|comes? out|goes? out) [^.?!]{0,15}?(?:bottom|underneath)/,
      ),
    },
    {
      idea: 'sun_pulls',
      re: anyOf(
        /(?<![ء-ي])(?:ال)?شمس(?: (?:هي|اللي))*(?: عم)? (?:بتسحب|تسحب|سحبت|سحبتها|بتشفط|تشفط|شفطت|بتمص|مصت|بتاخد|بتاخذ|تاخد|اخدت|اخدتها|بتشرب|شربت|شربتها)\S*(?! (?:ال)?(?:حراره|طاقه))/,
        /(?:بتسحبها|بيسحبها|بتشفطها|بتاخدها|سحبتها) (?:ال)?شمس/,
        /(?<![ء-ي])(?:بس|الا|فقط) (?:بال|ال|في ال)?شمس|(?:لازم|بدها|بده) (?:\S+ )?(?:ال)?شمس/,
        /sun(?:light|shine)? (?:pulls?|pulled|sucks?|sucked|takes?|took|drinks?|drank|lifts?|draws?)(?! (?:the )?(?:heat|energy))/,
        /only (?:in|with|by|when)[^.?!]{0,15}?sun|only the sun|(?:needs?|requires?) (?:the )?sun(?:light|shine)?/,
      ),
      unless: VAPOUR_WORDS,
    },
    {
      idea: 'air_takes',
      re: anyOf(
        /(?<![ء-ي])(?:ال)?(?:هوا|هواء|ريح|هوايه|مروحه)(?: (?:هو|هي|اللي))?(?: عم)? (?:بياخد|بياخذ|ياخد|بتاخد|اخد|اخذ|بشيل|بيشيل|بتشيل|شال|بسحب|بيسحب|بتسحب|بطير|بيطير|بتطير|طير)(?:ها|ه|ت|تها)?(?![ء-ي])/,
        /(?:بياخدها|بياخذها|اخدها|بيشيلها|طيرها) (?:ال)?(?:هوا|هواء|ريح)/,
        /(?:air|wind|breeze|fan) (?:takes?|took|carries|carried|blows?|blew|pulls?|steals?|sweeps?)(?! (?:the )?(?:heat|energy))/,
        /(?:taken|carried|blown) (?:away )?by (?:the )?(?:air|wind|breeze|fan)/,
      ),
      unless: VAPOUR_WORDS,
    },
    {
      idea: 'vanishes',
      re: anyOf(
        /بتختفي|بيختفي|تختفي|اختفت|اختفي|بتتلاشي|تلاشت|انعدمت|بتنعدم|بتبطل موجوده|ما بتضل موجوده/,
        /(?:بتروح|بتنقص|بتخلص|راحت|خلصت|نقصت) لحالها|لحالها (?:بتختفي|بتروح|بتنقص|بتخلص|راحت|نقصت)/,
        /disappear\w*|vanish\w*|(?:goes|went|gone) (?:away )?by itself|just gone|stops? existing|(?:turns?|goes) into nothing/,
      ),
      unless: /بخار|تبخر|هوا|الجو|غاز|vapou?r|evaporat|\bair\b|\bgas\b/,
    },
    {
      idea: 'someone_drank',
      re: anyOf(
        /(?<![ء-ي])(?:حدا|حد|واحد|ماما|بابا|اخي|اخوي|اختي|القطه|البسه|عصفور|العصفور) (?:\S+ )?(?:شرب|شربها|شربت|شربتها|بيشرب|بشرب|كب|كبها|دلقها)(?:ت|وا|ه|ها)?(?![ء-ي])/,
        /(?:شرب|شربها|شربوها|شربتها|كبها) (?:منها )?(?:حدا|حد|واحد)(?![ء-ي])/,
        /(?:someone|somebody|a (?:cat|bird)|the (?:cat|bird)|my (?:brother|sister|mom|dad)) (?:\w+ )?(?:drank|drinks|drunk|poured|spilled|spilt)|(?:drank|drunk) by (?:someone|somebody)/,
      ),
    },
    { idea: 'only_boiling', re: ONLY_BOILING },
    {
      idea: 'only_boiling',
      re: anyOf(/(?:بس )?(?:لما|اذا|وقت|عند ما) (?:المي )?(?:بتغلي|تغلي|بيغلي|يغلي|غلت)/, /(?:when|if) (?:the water |it )boils/),
      // «بتتبخر أسرع لما تغلي», «حتى لو ما غلت» are not the claim that boiling is required
      unless: /اسرع|كمان|حتي|الا|غير|لازم|\balso\b|faster|quicker|\beven\b|\btoo\b|only|unless/,
    },
  ],
  samples: [
    t('المي بتاخد حرارة وبتصير بخار ما منشوفه وبتطلع للهوا', 'The water takes heat, turns into vapour and goes into the air'),
    t('الكاسة بتشرب المي', 'The glass drinks the water'),
    t('المي بتنزّ من تحت', 'The water leaks out of the bottom'),
    t('الشمس بتسحب المي', 'The sun pulls the water up'),
    t('الهوا بياخدها', 'The air takes it away'),
    t('المي بتختفي لحالها', 'The water just disappears'),
    t('حدا شربها', 'Someone drank it'),
    t('المي ما بتتبخر إلا لما تغلي', 'Water only evaporates when it boils'),
  ],
  preTest: [
    {
      id: 'pre1',
      q: t('تركنا كاسة مي مفتوحة ٣ أيام، والمي نقصت. وين راحت؟', 'We left an open cup of water for 3 days and the level dropped. Where did the water go?'),
      options: [t('الكاسة شربتها', 'The cup drank it'), t('صارت بخار وراحت للهوا', 'It became vapour and went into the air'), t('نزّت من تحت', 'It leaked from the bottom'), t('بطّلت موجودة', 'It stopped existing')],
      correct: 1,
      node: 'C3',
    },
    {
      id: 'pre2',
      q: t('لو سكّرنا الكاسة بغطا محكم، شو بصير بمستوى المي؟', 'If we seal the cup tightly, what happens to the water level?'),
      options: [t('بينقص بنفس السرعة', 'It drops just as fast'), t('بيضل تقريباً زي ما هو', 'It stays about the same'), t('بيزيد', 'It rises')],
      correct: 1,
      node: 'C4',
    },
    {
      id: 'pre3',
      q: t('كاسة مفتوحة بخزانة عتمة. شو بصير فيها بعد أيام؟', 'An open cup stands in a dark cupboard. What happens after some days?'),
      options: [t('ما بتنقص لأنه ما في شمس', 'Nothing, because there is no sun'), t('بتنقص، حتى بدون شمس', 'It goes down, even without sun'), t('بتنقص بس إذا غلت', 'It goes down only if it boils')],
      correct: 1,
      node: 'C2',
    },
    {
      id: 'pre4',
      q: t('نفس كمية المي: وحدة بكاسة ووحدة بصحن واسع. أي وحدة بتخلص قبل؟', 'The same amount of water: one in a cup, one in a wide plate. Which is gone first?'),
      options: [t('اللي بالكاسة', 'The one in the cup'), t('اللي بالصحن الواسع', 'The one in the wide plate'), t('التنتين مع بعض', 'Both together')],
      correct: 1,
      node: 'C5',
    },
  ],
  postTest: [
    {
      id: 'post1',
      q: t('نشرنا الغسيل المبلول، وبعد ساعات نشف. وين راحت المي؟', 'We hung wet washing out and hours later it was dry. Where did the water go?'),
      options: [t('كلها نقّطت ع الأرض', 'It all dripped to the ground'), t('صارت بخار بالهوا', 'It became vapour in the air'), t('القماش شربها للأبد', 'The cloth drank it for good')],
      correct: 1,
      node: 'C3',
    },
    {
      id: 'post2',
      q: t('حطّينا قميص مبلول بكيس نايلون وسكّرناه. بعد يوم، كيف بيكون؟', 'We shut a wet shirt in a plastic bag. How is it a day later?'),
      options: [t('ناشف تماماً', 'Completely dry'), t('لسا مبلول', 'Still wet'), t('ناشف لأنه ما حدا لمسه', 'Dry because nobody touched it')],
      correct: 1,
      node: 'C4',
    },
    {
      id: 'post3',
      q: t('بلاط الدرج انمسح، وهو بمحل ما بتوصله الشمس. بينشف؟', 'The stairs are mopped in a spot the sun never reaches. Will they dry?'),
      options: [t('لأ، بدها شمس', 'No, that needs sun'), t('آه، المي بتاخد حرارة من الجو', 'Yes, the water takes heat from the air around it'), t('بس إذا غلّيناها', 'Only if we boil it')],
      correct: 1,
      node: 'C2',
    },
    {
      id: 'post4',
      q: t('بدك شعرك المبلول ينشف أسرع. شو بتعمل؟', 'You want your wet hair to dry faster. What do you do?'),
      options: [t('بقعد بمحل دافي فيه هوا', 'Sit somewhere warm and breezy'), t('بلفّه بكيس نايلون', 'Wrap it in a plastic bag'), t('بقعد بمحل بارد ومسكّر', 'Sit somewhere cold and closed')],
      correct: 0,
      node: 'C5',
    },
  ],
  activities: {
    _default: {
      type: 'experiment',
      title: t('وين راحت المي؟', 'Where did the water go?'),
      goal: t('كل طالب يفحص فكرته ويشرح وين بتروح المي اللي بتنقص.', 'Every learner tests their idea and explains where the missing water goes.'),
      grouping: t('مجموعات من ٣ لـ ٤', 'Groups of 3 to 4'),
      materials: ['cups', 'water', 'cover', 'napkins', 'paper'],
      steps: [
        { minutes: 3, title: t('توقّعات', 'Predictions'), detail: t('كل طالب بيكتب وين برأيه بتروح المي.', 'Each learner writes where they think the water goes.') },
        { minutes: 6, title: t('تجهيز التجارب', 'Set up the tests'), detail: t('كاسة مفتوحة، كاسة مسكّرة، كاسة ع محرمة. منعلّم المستوى. ومنشوف كاسات جهّزها المعلّم قبل بتلات أيام.', 'Open cup, sealed cup, cup on a tissue; mark the levels. Then look at cups the teacher prepared three days earlier.') },
        { minutes: 4, title: t('نقاش', 'Discussion'), detail: t('أي فكرة بتفسّر التلات كاسات سوا؟', 'Which idea explains all three cups together?') },
        { minutes: 2, title: t('بطاقة خروج', 'Exit ticket'), detail: t('جملة وحدة: وين راحت المي؟', 'One sentence: where did the water go?') },
      ],
      teacher: t('جهّزوا نسخة من الكاسات قبل بتلات أيام عشان تشوفوا النتيجة بنفس الحصّة.', 'Prepare a set of cups three days ahead so results can be seen in the same lesson.'),
      check: t('ليش في نقط تحت غطا الكاسة المسكّرة؟', 'Why are there drops under the lid of the sealed cup?'),
      adapt: t('للي بحاجة دعم: رسمة تلات كاسات يرسموا عليها المستوى الجديد.', 'For support: a drawing of three cups where they mark the new levels.'),
    },
    _enrich: {
      type: 'game',
      title: t('سباق التنشيف', 'The drying race'),
      goal: t('نصمّم تجربة عادلة عن شو بيسرّع التبخّر، ونربطها بالحياة.', 'Design a fair test of what speeds drying up and connect it to daily life.'),
      grouping: t('فرق من ٤', 'Teams of 4'),
      materials: ['napkins', 'water', 'fan', 'plates', 'paper'],
      steps: [
        { minutes: 4, title: t('خطّة السباق', 'Plan the race'), detail: t('كل فريق بيختار عامل واحد: هوا، فرد المحرمة، أو دفا. نفس كمية المي للكل.', 'Each team picks one factor: airflow, spreading the tissue, or warmth. Same water for all.') },
        { minutes: 6, title: t('السباق', 'Race'), detail: t('محرمتين، وبس العامل المختار مختلف. منسجّل مين نشفت قبل.', 'Two tissues that differ only in the chosen factor. Record which dries first.') },
        { minutes: 3, title: t('تفسير', 'Explain'), detail: t('ليش ربحت؟ شو صار بالمي؟', 'Why did it win? What happened to the water?') },
        { minutes: 2, title: t('ربط', 'Connect'), detail: t('وين منستعمل هاي الفكرة بالبيت؟ ووين بتروح مي البحر؟', 'Where do we use this at home, and where does sea water go?') },
      ],
      teacher: t('أكّدوا ع «إشي واحد بس مختلف».', 'Insist on changing only one thing.'),
      check: t('ليش منفرد الغسيل وما منكوّمه؟', 'Why do we spread washing out instead of piling it?'),
      adapt: t('للمتقدّمين: عاملين مع بعض، وتوقّع مين أسرع قبل التجربة.', 'For stretch: combine two factors and predict the winner first.'),
    },
    glass_drinks: {
      type: 'experiment',
      title: t('هل الكاسة بتشرب المي؟', 'Does the cup drink the water?'),
      goal: t('نفحص إذا الزجاج بيمتصّ المي.', 'Test whether the glass soaks up water.'),
      grouping: t('مجموعات من ٣', 'Groups of 3'),
      materials: ['cups', 'water', 'cover', 'paper'],
      steps: [
        { minutes: 3, title: t('توقّع', 'Predict'), detail: t('لو الكاسة بتشرب المي، المسكّرة كمان لازم تنقص. موافقين؟', 'If the cup drinks water, the sealed one should go down too. Do you agree?') },
        { minutes: 6, title: t('تجهيز ومقارنة', 'Set up and compare'), detail: t('كاسة مسكّرة وكاسة مفتوحة بنفس المستوى. ومنشوف زوج جهّزناه قبل بتلات أيام.', 'Sealed and open cups at the same level, plus a pair prepared three days earlier.') },
        { minutes: 4, title: t('نقاش', 'Discussion'), detail: t('نفس الزجاج، ليش وحدة بس نقصت؟', 'Same glass, so why did only one go down?') },
        { minutes: 2, title: t('فكرة جديدة', 'Updated idea'), detail: t('كل طالب بيكتب فكرته بعد المقارنة.', 'Each learner writes their idea after comparing.') },
      ],
      teacher: t('ممكن تضيفوا صحن بلاستيك لتبيّنوا إنه حتى اللي ما بيشرب بتنقص المي فيه.', 'Add a plastic container to show water also goes down in something that cannot soak it.'),
      check: t('إذا الزجاج بيشرب المي، ليش الكاسة المسكّرة ما نقصت تقريباً؟', 'If glass drinks water, why did the sealed cup hardly go down?'),
      adapt: t('للي بحاجة دعم: قارنوا المحرمة (بتشرب) بقطعة زجاج (ما بتشرب) بنقطة مي.', 'For support: compare a drop on a tissue (soaks) with a drop on glass (does not).'),
    },
    sun_pulls: {
      type: 'experiment',
      title: t('لازم شمس؟', 'Is the sun needed?'),
      goal: t('نبيّن إنه المي بتنقص بالعتمة كمان، والشمس بتعطي حرارة بتسرّع.', 'Show water also goes down in the dark, and that the sun adds heat that speeds it up.'),
      grouping: t('مجموعات من ٤', 'Groups of 4'),
      materials: ['cups', 'water', 'sunlight', 'paper', 'napkins'],
      steps: [
        { minutes: 3, title: t('توقّع', 'Predict'), detail: t('بقعة مي بالظل وبقعة بالشمس: أي وحدة بتنشف؟', 'A wet patch in shade and one in sun: which will dry?') },
        { minutes: 6, title: t('جرّب', 'Test'), detail: t('نقطة بنفس الحجم ع ورقتين: وحدة بالشمس ووحدة بمحل ظلّ. ومنحط كاستين للأيام الجاية.', 'Equal drops on two sheets, one in sun and one in shade. Also set up two cups for the coming days.') },
        { minutes: 4, title: t('نقاش', 'Discussion'), detail: t('التنتين نشفوا، بس مش بنفس السرعة. شو عملت الشمس؟', 'Both dried, at different speeds. What did the sun do?') },
        { minutes: 2, title: t('بطاقة خروج', 'Exit ticket'), detail: t('جملة: شو بتحتاج المي عشان تنقص؟', 'One sentence: what does water need in order to leave?') },
      ],
      teacher: t('ما بنطّلع ع الشمس أبداً. ركّزوا إنه الظل فيه حرارة كمان.', 'Never look at the sun. Stress that shade has heat too.'),
      check: t('ليش الغسيل بينشف حتى بيوم غيم؟', 'Why does washing dry even on a cloudy day?'),
      adapt: t('بيوم بلا شمس: قارنوا جنب شبّاك دافي وجوّا خزانة، واحكوا عن الفرق.', 'With no sunshine: compare a warm window spot with a cupboard and discuss.'),
    },
    only_boiling: {
      type: 'discussion',
      title: t('نشفت بلا ما تغلي!', 'It dried without boiling!'),
      goal: t('نلاقي أدلّة إنه المي بتصير بخار بدون غليان.', 'Find evidence that water turns to vapour without boiling.'),
      grouping: t('أزواج ثم الصف كله', 'Pairs, then the whole class'),
      materials: ['water', 'napkins', 'fan', 'paper'],
      steps: [
        { minutes: 3, title: t('اسأل', 'Question'), detail: t('اللوح المبلول: بينشف؟ ولازم نغلّيه؟', 'A wet board: will it dry? Do we have to boil it?') },
        { minutes: 5, title: t('راقب', 'Observe'), detail: t('امسحوا اللوح بإسفنجة مبلولة وبلّلوا محرمة. هوّوا عليهم وسجّلوا.', 'Wipe the board with a wet sponge and wet a tissue. Fan them and record.') },
        { minutes: 5, title: t('أدلّة', 'Evidence'), detail: t('كل زوج بيجيب مثال تاني نشف بلا غليان، وبيشرح من وين إجت الحرارة.', 'Each pair gives another thing that dried without boiling and says where the heat came from.') },
        { minutes: 2, title: t('بطاقة خروج', 'Exit ticket'), detail: t('أكمل: المي بتصير بخار حتى لو...', 'Finish: water turns into vapour even if...') },
      ],
      teacher: t('ميّزوا: الغليان تبخّر سريع بكل المي وفيه فقاقيع، والتبخّر العادي بيصير من السطح بأي حرارة.', 'Distinguish: boiling is fast, throughout the water, with bubbles; ordinary evaporation happens at the surface at any temperature.'),
      check: t('هل غلى اللوح عشان ينشف؟ شو صار بالمي؟', 'Did the board boil in order to dry? What happened to the water?'),
      adapt: t('بدون مروحة: كرتونة. للي بحاجة دعم: صور غسيل وبركة ولوح يرتّبوها.', 'No fan: use card. For support: picture cards of washing, a puddle and a board to sort.'),
    },
  },
};
