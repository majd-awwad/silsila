/**
 * Concept pack: «ليش بتطلع نقط مي على الكاسة الباردة؟» (condensation), grades 3–5.
 * Anchored in the Grade 3 lesson «دورة الماء في الطبيعة» (see `curriculum`).
 * Arabic offline patterns are written against normaliseText() output: ا for أإآ, ه for ة, ي for ى/ئ, و for ؤ.
 */
import type { ChildModel, Conditions, L } from '../contracts';
import type { ConceptPack } from './types';

type Out = 'drops' | 'blue' | 'fewer' | 'none';

const t = (ar: string, en: string): L => ({ ar, en });
/** one regex from several readable alternatives (leftmost match wins, so one idea is counted once) */
const anyOf = (...parts: RegExp[]) => new RegExp(parts.map((p) => p.source).join('|'));

/* ───────────── deterministic worlds ───────────── */

function kidOutcome(m: ChildModel, c: Conditions): Out {
  const cold = c.temp === 'cold';
  const hasWater = c.contents !== 'empty';
  if (m.requires.includes('cold') && !cold) return 'none';
  const outs: Out[] = [];
  for (const s of m.sources) {
    if (s === 'inside_water') {
      if (!hasWater) continue;
      if (m.path === 'over_rim' && c.lid === 'on') continue;
      outs.push(c.contents === 'blue' ? 'blue' : 'drops');
    } else if (s === 'ice') {
      if (hasWater && cold) outs.push('drops');
    } else if (s === 'air_vapor') {
      outs.push(c.air === 'dry' ? 'fewer' : 'drops');
    } else if (s === 'cold_itself' || s === 'any_cold') {
      if (cold) outs.push('drops');
    } else {
      // glass_itself, spill_from_above, people_breath, appears_magic: nothing in the setup stops them
      outs.push('drops');
    }
  }
  if (!outs.length) return 'none';
  if (outs.includes('blue')) return 'blue';
  if (outs.includes('drops')) return 'drops';
  return 'fewer';
}

function realOutcome(c: Conditions): Out {
  if (c.temp !== 'cold') return 'none';
  return c.air === 'dry' ? 'fewer' : 'drops';
}

/* ───────────── offline language patterns ───────────── */

/** step 1: there is (invisible) water in the air */
const WATER_IN_AIR = anyOf(
  /(?:مي|ميه|مويه|ماء|بخار|رطوبه)\s[^.،,؟!]{0,18}?(?:بالهوا|بالهواء|بالجو|في الهوا|في الهواء|في الجو|حوالين)/,
  /(?:الهوا|الهواء|الجو)\s[^.،,؟!]{0,8}?(?:فيه|في|حامل|مليان)\s(?:[^.،,؟!]{0,6}?)(?:مي|ميه|ماء|بخار|رطوبه)/,
  /من (?:ال)?(?:هوا|هواء|جو)(?![ء-ي])/,
  /بخار|رطوبه/,
  /from (?:the )?(?:surrounding )?air(?![a-z])/,
  /water [^.,?!]{0,20}?in the (?:surrounding )?air/,
  /air (?:has|contains|holds|carries|is full of) [^.,?!]{0,20}?(?:water|vapou?r|moisture)/,
  /vapou?r|moisture|humidity/,
);

const AIR_WORDS = /هوا|الجو|بخار|رطوبه|\bair\b|vapou?r|moisture/;

/* ───────────── pack ───────────── */

export const condensation: ConceptPack = {
  id: 'condensation',
  subject: 'science',
  title: t('الكاسة الباردة', 'The cold glass'),
  question: t('ليش بتطلع نقط مي على الكاسة الباردة من برّا؟', 'Why do drops of water appear on the outside of a cold glass?'),
  grades: [3, 5],
  curriculum: {
    verified: true,
    note: t(
      'العلوم والحياة، الصف الثالث، الجزء الأول (طبعة 2020): الوحدة الثانية «الأرض وثرواتها»، الدرس الرابع «دورة الماء في الطبيعة»، نشاط (٣) «من أين أتى الماء؟» ونشاط (٤) «التكاثف»، ص ٧٥–٧٦. راجعناها بالكتاب المطبوع.',
      'Science and Life, Grade 3, Part 1 (2020 edition): Unit 2 "The Earth and its resources", Lesson 4 "The water cycle in nature", activity 3 "Where did the water come from?" and activity 4 "Condensation", pp. 75–76. Checked against the printed book.',
    ),
  },
  objectives: [
    { id: 'o_source', text: t('يشرح إنه نقط الكاسة الباردة جاية من الهوا اللي حواليها.', 'Explain that the drops on a cold glass come from the surrounding air.'), nodes: ['C2', 'C4'] },
    { id: 'o_cooling', text: t('يربط برودة السطح بتحوّل بخار المي لنقط.', 'Link a cold surface to water vapour turning into drops.'), nodes: ['C3', 'C4'] },
    { id: 'o_world', text: t('يستعمل نفس الفكرة ليفسّر مراية الحمّام والندى.', 'Use the same idea to explain a foggy mirror and morning dew.'), nodes: ['C5'] },
  ],
  concepts: {
    C1: { label: t('المي سايلة أو غاز', 'Water can be liquid or gas'), ai: 'water can be a liquid or an invisible gas', needs: [] },
    C2: { label: t('الهوا فيه بخار مي', 'Air holds water vapour'), ai: 'the surrounding air contains invisible water vapour', needs: ['C1'] },
    C3: { label: t('البخار بيبرد ع السطح البارد', 'Vapour cools on cold surfaces'), ai: 'water vapour cools when it touches a cold surface', needs: ['C2'] },
    C4: { label: t('البخار البارد بيصير نقط', 'Cooled vapour becomes drops'), ai: 'cooled vapour turns into liquid droplets (condensation)', needs: ['C3'] },
    C5: { label: t('المراية والندى والغيوم', 'Mirrors, dew and clouds'), ai: 'the same process makes bathroom fog, dew and clouds', needs: ['C4'] },
  },
  prerequisites: [
    {
      id: 'water_states',
      label: t('المي إلها أكتر من حالة', 'Water has more than one state'),
      why: t('عشان يفهم إنه المي ممكن تتغيّر من حالة لحالة وبتضل مي.', 'The learner needs to see that water can change state and still be water.'),
      supports: ['C1', 'C4'],
      suspect: { ideas: ['cold_itself', 'appears_magic', 'glass_itself'], missingSteps: [2] },
      verify: [
        {
          id: 'ws_v1',
          q: t('أي وحدة من هدول مي سايلة؟', 'Which of these is liquid water?'),
          options: [t('مكعّب التلج', 'An ice cube'), t('المي اللي بالكاسة', 'The water in a cup'), t('حجر صغير', 'A small stone')],
          correct: 1,
          node: 'C1',
        },
        {
          id: 'ws_v2',
          q: t('تركنا مكعّب تلج برّا الفريزر. شو بصير فيه؟', 'We leave an ice cube out of the freezer. What happens to it?'),
          options: [t('بيذوب وبيصير مي سايلة', 'It melts into liquid water'), t('بيصير حجر', 'It turns into stone'), t('بيتحوّل لإشي مش مي', 'It becomes something that is not water')],
          correct: 0,
          node: 'C1',
        },
      ],
      remedy: {
        title: t('المي بتغيّر شكلها', 'Water changes form'),
        minutes: 5,
        steps: [
          t('حطّوا مكعّب تلج بصحن وراقبوه.', 'Put an ice cube on a plate and watch it.'),
          t('احكوا: شو كان بالأول؟ وشو صار؟', 'Talk: what was it at first, and what is it now?'),
          t('ارسموا التلج والمي، واكتبوا: صلبة أو سايلة.', 'Draw the ice and the water, and label them solid or liquid.'),
          t('احكوا إنه للمي كمان حالة تالتة ما بنشوفها، اسمها غاز.', 'Add that water also has a third state we cannot see: a gas.'),
        ],
      },
      recheck: {
        id: 'ws_r',
        q: t('التلج والمي اللي بالكاسة: شو الصح؟', 'Ice and water in a cup: which is true?'),
        options: [t('التنين مي، بس بحالتين', 'Both are water, in two states'), t('التلج مش مي', 'Ice is not water'), t('بس السايلة هي مي', 'Only the liquid one is water')],
        correct: 0,
        node: 'C1',
      },
    },
    {
      id: 'water_vapour',
      label: t('في مي ما بنشوفها', 'Some water cannot be seen'),
      why: t('إذا ما بيعرف إنه المي ممكن تكون غاز بالهوا، ما رح يلاقي مصدر للنقط.', 'Without knowing water can be a gas in the air, the learner cannot find a source for the drops.'),
      supports: ['C2'],
      suspect: { ideas: ['inside_water', 'ice', 'any_cold', 'people_breath', 'spill_from_above'], missingSteps: [0] },
      verify: [
        {
          id: 'wv_v1',
          q: t('صحن فيه شوية مي نشف بعد يوم. وين ممكن تكون المي راحت؟', 'A little water on a plate dried after a day. Where could it have gone?'),
          options: [t('صارت جزء من الهوا وما بنشوفها', 'It became part of the air, where we cannot see it'), t('بطّلت موجودة بالدنيا', 'It stopped existing'), t('الصحن أكلها', 'The plate ate it')],
          correct: 0,
          node: 'C2',
        },
        {
          id: 'wv_v2',
          q: t('إذا ما بنشوف إشي، يعني أكيد مش موجود؟', 'If we cannot see something, does that mean it is not there?'),
          options: [t('آه، أكيد', 'Yes, for sure'), t('لأ، الهوا نفسه ما بنشوفه وهو موجود', 'No, we cannot see air itself and it is there')],
          correct: 1,
          node: 'C2',
        },
      ],
      remedy: {
        title: t('صيد المي المخفية', 'Hunting hidden water'),
        minutes: 5,
        steps: [
          t('انفخوا بكيس نايلون وسكّروه: الهوا ما بنشوفه، بس موجود.', 'Blow into a plastic bag and close it: we cannot see air, but it is there.'),
          t('امسحوا ع اللوح بإشي مبلول، وراقبوا لحد ما ينشف.', 'Wipe the board with something wet and watch it dry.'),
          t('اسألوا: وين راحت المي؟ واسمعوا كل الاقتراحات.', 'Ask where the water went and listen to every suggestion.'),
          t('احكوا إنها صارت غاز بالهوا، اسمه بخار المي.', 'Explain that it became a gas in the air, called water vapour.'),
        ],
      },
      recheck: {
        id: 'wv_r',
        q: t('شو هو بخار المي؟', 'What is water vapour?'),
        options: [t('مي بشكل غاز بالهوا، ما بنشوفها', 'Water as a gas in the air, which we cannot see'), t('دخان بيطلع من النار', 'Smoke from a fire'), t('مي ملوّنة', 'Coloured water')],
        correct: 0,
        node: 'C2',
      },
    },
  ],
  reference: {
    model: t(
      'الهوا فيه بخار مي، وهو غاز ما بنشوفه. السطح البارد بيبرّد الهوا اللي حواليه. لما يبرد كفاية (تحت «نقطة الندى»)، جزء من البخار بيصير مي سايلة ع السطح. كل ما الهوا فيه بخار أكتر والسطح أبرد، بتطلع نقط أكتر.',
      'Air holds water vapour, an invisible gas. A cold surface cools the air next to it. Below the dew point, some of the vapour turns into liquid water on the surface. More vapour in the air and a colder surface give more drops.',
    ),
    limits: t(
      'التجربة بتقارن بس بين هوا رطب وهوا ناشف كتير، وما بتحسب درجة الحرارة بالزبط. بالهوا الناشف كتير ممكن ما يطلع ولا نقطة. ع سطح طالع من الفريزر ممكن يطلع بالأول صقيع أبيض وبعدين يصير نقط.',
      'The lab only compares humid air with very dry air and does not compute exact temperatures. In very dry air there may be no drops at all. A surface straight from the freezer may first show white frost that then melts into drops.',
    ),
    sources: [
      { title: 'العلوم والحياة، الصف الثالث، الجزء الأول (وزارة التربية والتعليم الفلسطينية، طبعة 2020)' },
      { title: 'USGS Water Science School: Condensation and the Water Cycle' },
      { title: 'OpenStax, College Physics 2e: section "Humidity, Evaporation, and Boiling"' },
      { title: 'Driver, Squires, Rushworth and Wood-Robinson (1994), Making Sense of Secondary Science: Research into Children\'s Ideas, Routledge' },
    ],
  },

  ideas: {
    air_vapor: {
      label: t('مي من الهوا', 'Water from the air'),
      mirror: t('هيك إنت شايفها: بالهوا في مي ما بنشوفها، وع الكاسة الباردة بتصير نقط.', 'This is how you see it: the air holds water we cannot see, and on the cold glass it becomes drops.'),
      observation: t('النقط بتطلع ع الإشيا الباردة، حتى لو ما في مي جوّاها.', 'Drops appear on cold things, even with no water inside them.'),
      assumption: t('الهوا ممكن يكون فيه مي ما بنشوفها.', 'Air can hold water that we cannot see.'),
      conclusion: t('النقط هي مي من الهوا بردت ع الكاسة.', 'The drops are water from the air that cooled on the glass.'),
      story: [t('في بخار مي بالهوا', 'There is water vapour in the air'), t('بيلمس الكاسة الباردة وبيبرد', 'It touches the cold glass and cools'), t('بيصير نقط مي', 'It becomes drops of water')],
      wrongStep: null,
      correct: true,
      breaks: null,
      model: { sources: ['air_vapor'], path: 'from_air', requires: ['cold'] },
      intervention: t('خلّيه يتوقّع شو بصير لنفس الكاسة بمكان ناشف كتير، ويشرح ليش.', 'Ask them to predict what happens to the same cold glass in very dry air, and to explain why.'),
      ai: 'water vapour already in the surrounding air cools on the cold surface and becomes liquid drops (the scientific idea)',
    },
    inside_water: {
      label: t('المي اللي جوّا', 'Water from inside'),
      mirror: t('هيك إنت شايفها: المي اللي جوّا الكاسة بتطلع لبرّا وبتصير نقط.', 'This is how you see it: the water inside gets out and becomes drops.'),
      observation: t('في مي جوّا الكاسة، والنقط طلعت برّا عليها.', 'There is water inside the glass, and drops appear outside it.'),
      assumption: t('المي بتقدر تعبر من الزجاج.', 'Water can get through the glass.'),
      conclusion: t('النقط هي نفس المي اللي جوّا.', 'The drops are the same water that is inside.'),
      story: [t('المي جوّا الكاسة', 'The water is inside the glass'), t('بتطلع لبرّا من الزجاج', 'It gets out through the glass'), t('بتصير نقط برّا', 'It becomes drops outside')],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['inside_water'], path: 'through_wall', requires: [] },
      intervention: t('لوّنوا المي اللي جوّا، وامسحوا النقط بمحرمة بيضا، واسألوه: شو لونها؟ وليش؟', 'Colour the water inside, wipe the drops with a white tissue and ask what colour it is and why.'),
      ai: 'the water inside the container gets out (through the wall or over the rim) and forms the outside drops',
    },
    ice: {
      label: t('من التلج', 'From the ice'),
      mirror: t('هيك إنت شايفها: التلج بيذوب، وميّته بتطلع من الكاسة وبتصير نقط.', 'This is how you see it: the ice melts, its water gets out of the glass and becomes drops.'),
      observation: t('النقط بتبيّن لما يكون في تلج، والتلج عم يصغر.', 'Drops show up when there is ice, while the ice gets smaller.'),
      assumption: t('مية التلج الذايب بتلاقي طريق لبرّا.', 'Melted ice finds a way out.'),
      conclusion: t('النقط جاية من التلج.', 'The drops come from the ice.'),
      story: [t('التلج بيذوب', 'The ice melts'), t('ميّته بتطلع من الكاسة', 'That water gets out of the glass'), t('بتصير نقط برّا', 'It becomes drops outside')],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['ice'], path: 'through_wall', requires: [] },
      intervention: t('جيبوا كاسة معدن فاضية مبرّدة: ما فيها تلج. خلّيه يتوقّع قبل ما تشوفوا.', 'Bring an empty chilled metal cup with no ice in it and let them predict before looking.'),
      ai: 'melting ice inside gets out of the container and forms the drops',
    },
    cold_itself: {
      label: t('البرد نفسه', 'The cold itself'),
      mirror: t('هيك إنت شايفها: البرد نفسه بيتحوّل لمي ع الكاسة.', 'This is how you see it: the cold itself turns into water on the glass.'),
      observation: t('النقط بتطلع بس ع الإشي البارد.', 'Drops only appear on cold things.'),
      assumption: t('البرد إشي بيقدر يصير مي.', 'Coldness is a thing that can become water.'),
      conclusion: t('كل ما في برد، البرد بيعمل مي.', 'Wherever there is cold, the cold makes water.'),
      story: [t('الكاسة باردة كتير', 'The glass is very cold'), t('البرد نفسه بيصير مي', 'The cold itself becomes water'), t('بتطلع نقط', 'Drops appear')],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['cold_itself'], path: 'appears_on_surface', requires: ['cold'] },
      intervention: t('قارنوا كاستين بنفس البرودة: وحدة بمكان رطب ووحدة بمكان ناشف. اسأله: إذا البرد هو اللي بيصير مي، ليش مش زي بعض؟', 'Compare two equally cold glasses in humid and dry air and ask: if the cold becomes water, why are they different?'),
      ai: 'the coldness itself turns into water; no source of water is needed',
    },
    glass_itself: {
      label: t('الكاسة بتعرق', 'The glass sweats'),
      mirror: t('هيك إنت شايفها: الكاسة نفسها بتطلّع مي، زي ما إحنا بنعرق.', 'This is how you see it: the glass itself gives out water, like we sweat.'),
      observation: t('شكل النقط زي العرق ع الجلد.', 'The drops look like sweat on skin.'),
      assumption: t('الكاسة بتقدر تطلّع مي من حالها.', 'A glass can produce water by itself.'),
      conclusion: t('النقط طالعة من الزجاج.', 'The drops come out of the glass material.'),
      story: [t('الكاسة بتتأثّر', 'Something happens to the glass'), t('بتعرق زينا', 'It sweats like we do'), t('بتطلع منها نقط', 'Drops come out of it')],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['glass_itself'], path: 'appears_on_surface', requires: [] },
      intervention: t('حطّوا كاستين من نفس النوع: وحدة باردة ووحدة عادية. اسأله: ليش وحدة بس «عرقت»؟', 'Put two identical glasses side by side, one cold and one not, and ask why only one "sweated".'),
      ai: 'the glass or container itself makes or sweats the water',
    },
    spill_from_above: {
      label: t('مي وصلتها من برّا', 'Splashed from outside'),
      mirror: t('هيك إنت شايفها: في مي نزلت ع الكاسة من برّا، زي رشّة أو كبّة.', 'This is how you see it: water landed on the glass from outside, like a splash or a spill.'),
      observation: t('لما حدا يرشّ مي، بتصير نقط.', 'A splash leaves drops.'),
      assumption: t('كل نقطة لازم تكون وقعت من مكان.', 'Every drop must have fallen from somewhere.'),
      conclusion: t('حدا أو إشي رشّ الكاسة.', 'Someone or something splashed the glass.'),
      story: [t('حدا رشّ أو كبّ مي', 'Someone splashed or spilled water'), t('المي وصلت ع الكاسة', 'It landed on the glass'), t('صارت نقط', 'It became drops')],
      wrongStep: 0,
      breaks: 'C2',
      model: { sources: ['spill_from_above'], path: 'falls_from_above', requires: [] },
      intervention: t('حطّوا كاسة باردة وكاسة عادية بمكان ما حدا بيقرّب عليه، وراقبوهم سوا.', 'Leave a cold glass and a room-temperature glass where nobody goes near them, and watch both.'),
      ai: 'someone or something splashed, spilled or rained water onto the outside',
    },
    people_breath: {
      label: t('من نفَسنا', 'From our breath'),
      mirror: t('هيك إنت شايفها: نفَس الناس بيوصل للكاسة وبيصير نقط.', "This is how you see it: people's breath reaches the glass and becomes drops."),
      observation: t('لما ننفخ ع المراية بتغبّش.', 'A mirror fogs when we breathe on it.'),
      assumption: t('النقط بدها حدا يتنفّس قريب.', 'Drops need someone breathing nearby.'),
      conclusion: t('هاي المي من نفَسنا بس.', 'This water comes only from our breath.'),
      story: [t('النقط بدها نفَس حدا قريب', 'Drops need the breath of someone close'), t('النفَس بيوصل للكاسة', 'The breath reaches the glass'), t('بيصير نقط', 'It becomes drops')],
      wrongStep: 0,
      breaks: 'C2',
      model: { sources: ['people_breath'], path: 'from_air', requires: [] },
      intervention: t('جرّبوا كاسة باردة بزاوية ما حدا قريب منها، وكاسة عادية الكل قاعد حواليها.', 'Try a cold glass in a corner away from everyone, and an ordinary glass with everyone around it.'),
      ai: "people's breath lands on the glass and is the only source of the drops",
    },
    appears_magic: {
      label: t('بتطلع لحالها', 'It just appears'),
      mirror: t('هيك إنت شايفها: النقط بتطلع لحالها، بدون ما تيجي من مكان.', 'This is how you see it: the drops appear by themselves, from nowhere.'),
      observation: t('ما حدا بيشوف النقط وهي جاية.', 'Nobody sees the drops arriving.'),
      assumption: t('ممكن إشي يظهر بدون سبب.', 'Something can appear without a cause.'),
      conclusion: t('ما إلها مصدر.', 'It has no source.'),
      story: [t('الكاسة ع الطاولة', 'The glass is on the table'), t('النقط بتطلع بدون سبب', 'Drops appear for no reason')],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['appears_magic'], path: 'appears_on_surface', requires: [] },
      intervention: t('اسألوه: متى بتطلع ومتى ما بتطلع؟ وقارنوا كاسة باردة بكاسة عادية.', 'Ask when drops appear and when they do not, then compare a cold glass with an ordinary one.'),
      ai: 'the drops just appear by themselves, with no cause or source',
    },
    any_cold: {
      label: t('أي إشي بارد', 'Any cold thing'),
      mirror: t('هيك إنت شايفها: أي سطح بارد بيطلّع مي، مهما كان الهوا حواليه.', 'This is how you see it: any cold surface makes water, whatever the air around it is like.'),
      observation: t('شفت نقط ع أغراض باردة كتير.', 'You have seen drops on many cold things.'),
      assumption: t('الهوا ما إله دخل.', 'The air makes no difference.'),
      conclusion: t('بارد يعني نقط، دايماً وبنفس الكمية.', 'Cold means drops, always and just as many.'),
      story: [t('الإشي بارد', 'The thing is cold'), t('بيطلّع مي مهما كان الهوا', 'It makes water whatever the air is like'), t('بتطلع نفس النقط', 'The same drops appear')],
      wrongStep: 1,
      breaks: 'C2',
      model: { sources: ['any_cold'], path: 'appears_on_surface', requires: ['cold'] },
      intervention: t('خلّيه يتوقّع، وبعدين قارنوا كاسة باردة بهوا رطب مع نفس الكاسة بهوا ناشف.', 'Let them predict, then compare the same cold glass in humid and in dry air.'),
      ai: 'any cold surface produces water whatever the surrounding air is like (air humidity does not matter)',
    },
  },
  paths: {
    through_wall: { label: t('بتعبر من الزجاج', 'Through the glass'), ai: 'passes through the container wall' },
    over_rim: { label: t('بتطلع من فوق وبتنزل', 'Over the rim and down'), ai: 'goes over the rim and runs down the outside' },
    from_air: { label: t('من الهوا للسطح', 'From the air to the surface'), ai: 'comes from the surrounding air onto the surface' },
    appears_on_surface: { label: t('بتظهر ع السطح', 'Forms on the surface'), ai: 'forms right on the surface itself' },
    falls_from_above: { label: t('بتنزل عليها', 'Falls onto it'), ai: 'drops or splashes onto it from outside' },
  },
  requires: { cold: { label: t('بدها برد', 'Needs cold'), ai: 'drops form only when the surface is cold' } },
  correctModel: { sources: ['air_vapor'], path: 'from_air', requires: ['cold'] },

  steps: [
    {
      text: t('بالهوا في بخار مي ما بنشوفه.', 'The air holds water vapour that we cannot see.'),
      node: 'C2',
      test: WATER_IN_AIR,
      noorSays: t('علّمتني إنه بالهوا في مي ما بنشوفها.', 'You taught me that the air holds water we cannot see.'),
      noorAsks: t('هالمي، وين كانت قبل ما تصير ع الكاسة؟', 'Where was this water before it was on the glass?'),
    },
    {
      text: t('لما يلمس الكاسة الباردة بيبرد.', 'When it touches the cold glass, it cools down.'),
      node: 'C3',
      test: anyOf(
        /(?:كل ?ما [^.،,؟!]{0,25}?)?(?:بتلمس|بيلمس|تلمس|يلمس|بنلمس|لمس|لمست|بتوصل|بيوصل|توصل|يوصل|بتلزق|بيلزق|تلزق|يلزق|بتضرب|بيضرب)\S*\s[^.؟!]{0,25}?(?:بارد|ساقع|الكاس|الكوب|الكبايه|المرايه|السطح)/,
        /(?<!(?:الكاسه|الكاس|الكوب|الكبايه|الزجاج) )(?:بتبرد|بيبرد|تبرد|يبرد|بردت|بتبرده|بيبرده|بتبردها|بيبردها)/,
        /(?:touch|hit|meet|reach|land)(?:es|s|ed|ing)? [^.?!]{0,30}?cold/,
        /\bcools\b|cools? (?:it |them )?down|cooled|cooling|(?:it|they|vapou?r|water|air) cool\b|(?:gets?|getting) (?:cold|colder|cooler|chilled)/,
      ),
      noorSays: t('وعلّمتني إنها لما تلمس الكاسة الباردة بتبرد.', 'You also taught me that it cools when it touches the cold glass.'),
      noorAsks: t('ليش ع البارد بالذات؟ شو بيعمل البرد؟', 'Why on something cold? What does the cold do?'),
    },
    {
      text: t('وبيتحوّل لنقط مي سايلة.', 'And it turns into drops of liquid water.'),
      node: 'C4',
      test: anyOf(
        /(?:بتصير|بيصير|تصير|يصير|بصير|صار|صارت|بتتحول|بيتحول|تتحول|يتحول|بتنقلب|بترجع|بيرجع)\s[^.،,؟!]{0,12}?(?:نقط|نقطه|قطرات|قطره|مي|ميه|ماء|ندي|سايل)/,
        /تكاثف|تكثف|بتتجمع|بيتجمع/,
        /(?:turns?|turned|turning|chang(?:es?|ed|ing)) (?:back )?(?:in)?to (?:liquid |tiny |small )?(?:water|drops?|droplets?|liquid)/,
        /becomes? (?:liquid|water|tiny drops?|drops?|droplets?)|condens|forms? (?:into )?(?:tiny |small )?(?:water )?(?:drops?|droplets?)/,
      ),
      noorSays: t('وعلّمتني إنها بعدين بتصير نقط مي سايلة.', 'And you taught me that it then becomes drops of liquid water.'),
      noorAsks: t('وبعدين؟ كيف صار منظرها نقط بنشوفها؟', 'And then? How does it end up as drops we can see?'),
    },
  ],

  variables: [
    { id: 'temp', label: t('حرارة الكاسة', 'Glass temperature'), options: [{ id: 'cold', label: t('باردة', 'Cold') }, { id: 'room', label: t('عادية', 'Room temperature') }] },
    { id: 'contents', label: t('شو جوّا', 'Inside'), options: [{ id: 'water', label: t('مي', 'Water') }, { id: 'blue', label: t('مي زرقا', 'Blue water') }, { id: 'empty', label: t('فاضية', 'Empty') }] },
    { id: 'air', label: t('الهوا حواليها', 'Air around it'), options: [{ id: 'humid', label: t('رطب', 'Humid') }, { id: 'dry', label: t('ناشف كتير', 'Very dry') }] },
    { id: 'lid', label: t('الغطا', 'Lid'), options: [{ id: 'off', label: t('بدون غطا', 'No lid') }, { id: 'on', label: t('مغطّاية', 'Covered') }] },
  ],
  baseline: { temp: 'cold', contents: 'water', air: 'humid', lid: 'off' },
  experiments: [
    {
      id: 'E_color',
      name: t('نلوّن المي اللي جوّا بأزرق', 'Colour the water inside blue'),
      short: t('مي زرقا', 'Blue water'),
      change: { contents: 'blue' },
      question: t('لوّنّا المي اللي جوّا بأزرق وفيها تلج. شو رح نشوف ع الكاسة من برّا؟', 'We colour the iced water inside blue. What will we see on the outside of the glass?'),
      choices: ['drops', 'blue', 'none'],
      minutes: 8,
      materials: ['cups', 'water', 'ice', 'food_color', 'napkins'],
      safety: { adult: false, note: t('الكاسة ع طاولة ثابتة. ما بنشرب المي الملوّنة.', 'Keep the glass on a steady table. Do not drink the coloured water.') },
      minGrade: 3,
      targets: ['C2'],
      home: {
        steps: [
          t('عبّي كاسة شفّافة مي وتلج.', 'Fill a clear glass with water and ice.'),
          t('حط نقطتين ملوّن أزرق وحرّك.', 'Add two drops of blue colouring and stir.'),
          t('نشّف الكاسة من برّا واستنّى ٥ دقايق.', 'Dry the outside and wait 5 minutes.'),
          t('امسح النقط بمحرمة بيضا.', 'Wipe the drops with a white tissue.'),
        ],
        record: t('شو لون المحرمة بعد المسح؟', 'What colour is the tissue after wiping?'),
        reflect: [t('لو النقط طالعة من جوّا، شو لازم يكون لونها؟', 'If the drops came from inside, what colour should they be?'), t('من وين ممكن تكون إجت؟', 'Where else could they have come from?')],
      },
    },
    {
      id: 'E_empty',
      name: t('كاسة فاضية باردة', 'An empty cold cup'),
      short: t('كاسة فاضية', 'Empty cup'),
      change: { contents: 'empty' },
      question: t('برّدنا كاسة معدن فاضية بالفريزر وحطّيناها ع الطاولة. شو رح يصير عليها من برّا؟', 'We chill an empty metal cup in the freezer and put it on the table. What will happen on its outside?'),
      choices: ['drops', 'fewer', 'none'],
      minutes: 8,
      materials: ['metal_cup', 'ice'],
      safety: { adult: true, note: t('الكبير بيطلّع الكاسة من الفريزر، لأنه المعدن البارد ممكن يلزق بالإيد المبلولة. ما بنحط زجاج بالفريزر.', 'An adult takes the cup out, because very cold metal can stick to wet fingers. Never put glass in the freezer.') },
      minGrade: 3,
      targets: ['C2', 'C3'],
      home: {
        steps: [
          t('نشّف كاسة معدن منيح.', 'Dry a metal cup well.'),
          t('حطّها بالفريزر ١٠ دقايق وهي فاضية.', 'Leave it empty in the freezer for 10 minutes.'),
          t('الكبير بيطلّعها ع الطاولة.', 'An adult takes it out onto the table.'),
          t('راقبها ٣ دقايق. ممكن تبيّن طبقة بيضا رفيعة بالأول، وبعدين تتغيّر.', 'Watch it for 3 minutes. A thin white layer may show first and then change.'),
        ],
        record: t('شو طلع ع الكاسة من برّا؟', 'What appeared on the outside of the cup?'),
        reflect: [t('ما في مي ولا تلج جوّا. من وين إجا اللي شفته؟', 'There was no water or ice inside. Where did what you saw come from?')],
      },
    },
    {
      id: 'E_warm',
      name: t('مي بحرارة الغرفة', 'Water at room temperature'),
      short: t('مي مش باردة', 'Not cold'),
      change: { temp: 'room' },
      question: t('كاسة مي عادية، بدون تلج. شو رح نشوف عليها من برّا بعد ٥ دقايق؟', 'A glass of ordinary water with no ice. What will we see on its outside after 5 minutes?'),
      choices: ['drops', 'fewer', 'none'],
      minutes: 6,
      materials: ['cups', 'water'],
      safety: { adult: false, note: t('ما في مي سخنة بهالتجربة أبداً.', 'No hot water is used in this experiment.') },
      minGrade: 3,
      targets: ['C3'],
      home: {
        steps: [
          t('عبّي كاسة مي واتركها ساعة لتصير متل حرارة الغرفة.', 'Fill a glass and leave it for an hour to reach room temperature.'),
          t('نشّفها من برّا.', 'Dry the outside.'),
          t('جنبها حط كاسة مي وتلج، واستنّى ٥ دقايق.', 'Put a glass of iced water next to it and wait 5 minutes.'),
        ],
        record: t('أي كاسة طلع عليها إشي؟', 'Which glass has something on it?'),
        reflect: [t('شو الفرق الوحيد بين الكاستين؟', 'What is the only difference between the two glasses?')],
      },
    },
    {
      id: 'E_cover',
      name: t('نغطّي الكاسة من فوق', 'Cover the glass'),
      short: t('غطا', 'Lid'),
      change: { lid: 'on' },
      question: t('كاسة مي وتلج، وغطّيناها من أول لحظة. شو رح نشوف عليها من برّا؟', 'A glass of iced water, covered from the very start. What will we see on the outside?'),
      choices: ['drops', 'fewer', 'none'],
      minutes: 7,
      materials: ['cups', 'water', 'ice', 'cover'],
      safety: { adult: false, note: t('احمل الكاسة بإيدتين.', 'Carry the glass with both hands.') },
      minGrade: 3,
      targets: ['C2'],
      home: {
        steps: [
          t('عبّي كاستين مي وتلج، متل بعض.', 'Fill two glasses with the same iced water.'),
          t('غطّي وحدة بصحن فوراً، واترك التانية مفتوحة.', 'Cover one with a saucer at once and leave the other open.'),
          t('نشّفهم من برّا واستنّى ٥ دقايق.', 'Dry both outsides and wait 5 minutes.'),
        ],
        record: t('قارن اللي طلع ع الكاستين من برّا.', 'Compare what appears on the outside of the two glasses.'),
        reflect: [t('الغطا سكّر أي طريق؟ وشو ضل مفتوح؟', 'Which route does the lid close, and which stays open?')],
      },
    },
    {
      id: 'E_dry',
      name: t('هوا ناشف كتير', 'Very dry air'),
      short: t('هوا ناشف', 'Dry air'),
      change: { air: 'dry' },
      question: t('نفس كاسة التلج، بس بمكان هواه ناشف كتير. شو رح يصير عليها؟', 'The same iced glass, but in a place with very dry air. What will happen on it?'),
      choices: ['drops', 'fewer', 'none'],
      minutes: 10,
      materials: ['cups', 'water', 'ice'],
      safety: { adult: true, note: t('الكبير هو اللي بيفتح المي السخنة بالحمّام، وإنت بتدخل بعد ما تتسكّر. دير بالك من الأرض المزحلقة.', 'Only an adult runs the hot shower; you go in after it is off. Watch out for a slippery floor.') },
      minGrade: 3,
      targets: ['C2', 'C4'],
      home: {
        steps: [
          t('حضّر كاستين مي وتلج، متل بعض.', 'Prepare two identical glasses of iced water.'),
          t('حط وحدة بالحمّام بعد ما حدا يخلّص دوش سخن (هوا رطب).', 'Put one in the bathroom just after a hot shower (humid air).'),
          t('وحط التانية بغرفة ناشفة، شبابيكها مفتوحة بيوم ناشف.', 'Put the other in a dry room, with windows open on a dry day.'),
          t('استنّى ٣ دقايق وقارن.', 'Wait 3 minutes and compare.'),
        ],
        record: t('وين طلعت نقط أكتر؟', 'Where are there more drops?'),
        reflect: [t('الكاستين بنفس البرودة. شو اللي اختلف؟', 'Both glasses are equally cold. What was different?')],
      },
    },
  ],
  outcomes: {
    drops: t('نقط مي شفّافة من برّا', 'Clear drops of water outside'),
    blue: t('نقط زرقا من برّا', 'Blue drops outside'),
    fewer: t('نقط قليلة كتير', 'Only very few drops'),
    none: t('ولا نقطة', 'No drops at all'),
  },
  kidOutcome,
  realOutcome,
  matches: (predicted, real) => predicted === real || (real === 'fewer' && predicted === 'none'),
  scene3d: 'condensation',

  noor: {
    greeting: t('أهلاً! أنا نور. شايف النقط ع الكاسة من برّا؟ احكيلي بكلامك: من وين إجت؟', "Hi! I'm Noor. See the drops on the outside of the glass? Tell me in your own words: where did they come from?"),
    invite: t('فهمت فكرتك! يلا نفحصها. توقّع شو بصير، وبعدين منجرّب.', "I got your idea! Let's test it. Predict what will happen, then we try."),
    afterContradiction: t('اللي صار غير اللي توقّعته فكرتك. يعني في إشي ناقص. من وين إجت النقط برأيك هلأ؟', 'The result is not what your idea predicted, so something is missing. Where do you think the drops come from now?'),
    afterMatch: t('هالمرّة فكرتك صمدت. جرّب تغيّر إشي تاني، أو عدّل فكرتك إذا بدك.', 'Your idea held up this time. Change something else, or update your idea if you like.'),
    sameResult: t('فكرتك والتجربة أعطوا نفس النتيجة. هاي التجربة ما بتفرّق. جرّب تغيّر إشي تاني.', 'Your idea and the test gave the same result. This test cannot tell them apart. Change something else.'),
    praise: t('واو! شرحك كامل وواضح. بتعلّمني إنت هلأ؟', 'Wow! Your explanation is complete and clear. Will you teach me now?'),
    partial: t('في إشي حلو بشرحك! بس لسا ناقصني جزء. احكيلي أكتر.', 'There is something good in your explanation! I am still missing a piece. Tell me more.'),
    contradiction: t('سمعت منك فكرتين بيعاكسوا بعض. أي وحدة بتختار؟ وليش؟', 'I heard two ideas that disagree. Which one do you choose, and why?'),
    offtopic: t('حلو! بس خلّينا نرجع للكاسة. من وين إجت النقط برأيك؟', "Nice! But let's get back to the glass. Where do you think the drops came from?"),
    unsupported: t('فكرة بتفتح العين! ما بقدر أجرّبها هون. احكيلي عن النقط بطريقة تانية، أو اسأل معلّمك.', "That's an interesting idea! I can't test it here. Tell me about the drops another way, or ask your teacher."),
  },
  hints: [
    t('فكّر بفكرتك كمان مرّة. شو شفت بعينك، وشو اللي خمّنته؟', 'Think about your idea again. What did you really see, and what did you guess?'),
    t('اطّلع ع النقط منيح. وين طلعت بالزبط، ووين ما طلعت؟', 'Look closely at the drops. Where exactly are they, and where are they not?'),
    t('فكّر بكاسة باردة وفاضية: ما في إشي جوّاها. شو في حواليها من برّا؟', 'Think of a cold empty cup with nothing inside. What is all around it on the outside?'),
    t('بالهوا في بخار مي ما بنشوفه. لما يلمس الكاسة الباردة بيبرد، وبيتحوّل لنقط مي. هلأ احكيها بكلامك.', 'The air holds water vapour we cannot see. When it touches the cold glass it cools and turns into drops. Now say it in your own words.'),
  ],
  clarify: [
    { id: 'where', q: t('احكيلي أكتر: من وين إجت النقط اللي برّا؟', 'Tell me more: where did the drops outside come from?'), ai: 'open question: where did the outside drops come from?' },
    { id: 'same_water', q: t('المي اللي برّا هي نفس المي اللي جوّا، ولا من مكان تاني؟ من وين؟', 'Is the water outside the same as the water inside, or from somewhere else? From where?'), ai: 'is the outside water the inside water or from elsewhere?' },
    { id: 'empty_cup', q: t('لو الكاسة فاضية بس باردة كتير، شو بتتوقّع يصير عليها؟', 'If the cup is empty but very cold, what do you expect to happen on it?'), ai: 'prediction for an empty cold cup' },
    { id: 'warm_cup', q: t('ليش برأيك ما منشوف هالنقط ع كاسة مش باردة؟', 'Why do you think we do not see these drops on a glass that is not cold?'), ai: 'why no drops on a glass that is not cold?' },
  ],
  answerWords: /بخّ?ار|تكاثف|تكثّ?ف|تبخّ?ر|(?:مي|ماء) (?:بالهوا|بالهواء|في الهوا|في الهواء)|condens|evaporat|vapou?r|water in the air|water from the air/i,
  teach: {
    planted: t('فهمت! يعني لو حطّينا الكاسة الباردة بمكان ناشف كتير، رح يطلع عليها نقط أكتر. صح؟', 'I see! So if we put the cold glass in a very dry place, we will get MORE drops. Right?'),
    truth: 'Very dry air holds little water vapour, so fewer drops (or none) form on the cold glass, not more.',
    accept: new RegExp(
      '^(?=[\\s\\S]*(?:' +
        /(?<![ء-ي])(?:لا|مش|مو|غلط|خطا|بالعكس|العكس|مستحيل|ما رح|ما راح|ما بيطلع|ما بتطلع)(?![ء-ي])|اقل|قليل|\bno\b|\bnope\b|\bnot\b|n't\b|wrong|incorrect|opposite|fewer|\bless\b/.source +
        '))(?=[\\s\\S]*(?:' +
        anyOf(
          /(?<!(?:نقط|قطرات) (?:ال)?)(?<![ء-ي])(?:ال|بال)?(?:مي|ميه|ماء|بخار|رطوبه)\s[^.؟!]{0,10}?(?:اقل|قليل|شوي)/,
          /(?:اقل|قليل\S*|ما في|ما فيه|ما فيها|ما عنده|مافي|فش|فيش)\s(?:[^.؟!]{0,6}?\s)?(?:ال)?(?:مي|ميه|ماء|بخار|رطوبه)(?![ء-ي])/,
          /(?:من|بال)(?:ال)?(?:هوا|هواء|جو)(?![ء-ي])[^.؟!]{0,30}?(?:ناشف|جاف)|(?:ناشف|جاف)[^.؟!]{0,30}?(?:ما|مش|فش)\s[^.؟!]{0,12}?(?:مي|بخار|رطوبه)/,
          /(?:less|little|\bno\b|not much|not enough|hardly any|not a lot of) (?:\w+ )?(?:water|vapou?r|moisture|humidity)(?! drops?)/,
          /(?:water|vapou?r|moisture)[^.?!]{0,15}?(?:from|in) the air[^.?!]{0,40}?(?:dry|little|less)/,
        ).source +
        '))',
    ),
    reject: anyOf(
      /^(?:اه|اها|ايوه|ايوا|نعم|صح|صحيح|مزبوط|مظبوط|اكيد|طبعا|يس|yes|yeah|yep|right|true|correct|sure|of course)(?![ء-يa-z])/,
      /^(?!(?:لا|مش|غلط|بالعكس|مستحيل|no|nope|wrong|not)(?![ء-يa-z]))[\s\S]*?(?:(?<!(?:مش|ما|لا|مو) )(?<!(?:مش|ما|لا) (?:رح|راح) )(?:بيطلع|يطلع|بتطلع|بصير|بيصير)\s(?:\S+\s){0,2}?(?:اكثر|اكتر)|(?:there will be|we(?:'ll| will)? get|it makes|you(?:'ll| will)? get) more(?: water)? drops)/,
    ),
    thanks: t('آه! الهوا الناشف فيه مي أقل، فبتطلع نقط أقل. هلأ فهمت، شكراً يا معلّمي!', 'Oh! Dry air holds less water, so there are fewer drops. Now I get it, thank you, teacher!'),
    confused: t('لسا محتارة… بالمكان الناشف بتطلع نقط أكتر ولا أقل؟ وليش؟', "I'm still puzzled... in the dry place do we get more drops or fewer? And why?"),
  },
  challenge: {
    phenomenon: t('بعد حمّام بمي سخنة، بتغبّش مراية الحمّام. ليش؟', 'After a hot shower, the bathroom mirror gets foggy. Why?'),
    solved: t('الدوش السخن عبّى هوا الحمّام ببخار مي. لما البخار لمس المراية الأبرد منه برد، وصار نقط صغيرة عليها.', 'The hot shower filled the bathroom air with water vapour. When the vapour touched the colder mirror it cooled and became tiny drops on it.'),
  },
  transfer: {
    prompt: t('الصبح بكّير بنلاقي نقط ندى ع العشب، مع إنه ما شتّت بالليل. فسّر بكلامك: من وين إجت؟', 'Early in the morning there is dew on the grass, although it did not rain. Explain in your own words: where did it come from?'),
    check: {
      id: 'tr_dew',
      q: t('ليلتين باردات متل بعض. أي صبحية بنلاقي فيها ندى أكتر؟', 'Two equally cold nights. After which one do we find more dew?'),
      options: [t('بعد ليلة هواها رطب', 'After the night with humid air'), t('بعد ليلة هواها ناشف كتير', 'After the night with very dry air'), t('نفس الإشي بالليلتين', 'The same after both')],
      correct: 0,
      node: 'C5',
    },
  },

  rules: [
    { idea: 'air_vapor', re: WATER_IN_AIR },
    {
      idea: 'inside_water',
      re: anyOf(
        /(?:بتنز|تنز|بينز|بتنزز|نزت|بترشح|بيرشح|ترشح|بتسرب|تسرب|بيتسرب|بتهرب)(?:ت|ها)?(?![ء-ي])|تسريب|مسامات|مسام/,
        /(?:من جوا|من داخل|من قلب)(?: (?:ال)?(?:كاس|كاسه|كوب|كبايه))?/,
        /(?:ال)?لي جوا\S*\s[^.؟!]{0,20}?(?:بتطلع|طلعت|بتنزل|بتعبر|لبرا|برا)/,
        /(?:بتطلع|بيطلع|طلعت|بتعبر|عبرت|بتمرق|مرقت) من (?:ال)?(?:كاس|كوب|كبايه|زجاج|قزاز)\S*/,
        /فاضت|طفحت|بتفيض|(?:بتطلع|طلعت) من فوق/,
        /leak\w*|seep\w*|from (?:the )?inside|(?:comes?|came|goes?|gets?|pass(?:es|ed)?) (?:out )?(?:from|through) (?:the )?(?:inside|glass|cup|wall)|through the (?:glass|cup|wall)/,
      ),
      unless: /(?:ثلج|تلج)[^.؟!]{0,20}?(?:ذاب|داب|ذوب|دوب|ذايب|دايب)|melt/,
    },
    {
      idea: 'ice',
      re: anyOf(
        /(?:ثلج|تلج)\S*\s[^.؟!]{0,20}?(?:ذاب|داب|بيذوب|بيدوب|يذوب|يدوب|بذوب|بدوب|ذايب|دايب|بيسيح)[^.؟!]{0,35}?(?:برا|طلع|بتطلع|بيطلع|نقط|بينز|بتنز|عبر)/,
        /(?:ميه|مي|ماء|مويه) (?:ال)?(?:ثلج|تلج)/,
        /(?:جايه|جاي|اجت|اجا|طلعت|بتطلع|بيطلع|النقط|المي|هاي|هدول) من (?:ال)?(?:ثلج|تلج)(?:ه|ات)?(?![ء-ي])/,
        /melt\w*[^.?!]{0,40}?(?:comes? out|outside|goes? out|through|leak\w*|gets? out)/,
        /\bice\b[^.?!]{0,20}?(?:comes? out|goes? out|gets? out|leak\w*)|(?:drops?|water) (?:is |are |comes? |came )?from (?:the )?(?:melting |melted )?ice/,
      ),
    },
    {
      idea: 'cold_itself',
      re: anyOf(
        /(?:البرد|البروده|السقعه|الصقعه|برودتها)(?: (?:نفسه|نفسها|بحاله|لحاله|تاع \S+|تبع \S+))?(?: (?:هو|هي))?(?: اللي)? (?:بيصير|بتصير|صار|صارت|بيتحول|بتتحول|بيعمل|بتعمل|بيطلع|بتطلع|بيخلق|بيقلب)/,
        /(?<![ء-ي])من (?:ال)?(?:برد|بروده|سقعه|صقعه)(?:ه|ها)?(?![ء-ي])/,
        /cold(?:ness)?(?: itself)? (?:turns?|chang(?:es?|ed)|becomes?|makes?|made|creates?|produces?|gives?) [^.?!]{0,15}?(?:water|drops?|droplets?)/,
        /(?:water|drops?) (?:is |are |comes? |came )?(?:made )?(?:from|out of|by) (?:the )?cold(?:ness)?(?![a-z])(?! (?:glass|cup|surface|thing|can|air|water|metal))/,
        /it(?:'s| is) (?:just )?the cold(?![a-z])(?! (?:glass|cup))/,
      ),
      unless: /هوا|الجو|بخار|رطوبه|\bair\b|vapou?r|moisture/,
    },
    {
      idea: 'glass_itself',
      re: anyOf(
        /بتعرق|بيعرق|عرقت|عرقانه|عرقان|عم تعرق|بتبكي|بتدمع|عرق الكاس\S*/,
        /(?:الكاسه|الكاس|الكوب|الكبايه|الزجاج|القزاز|المعدن)(?: (?:نفسها|نفسه|حالها))?(?: (?:هي|هو))?(?: اللي)? (?:بتطلع|بيطلع|بتعمل|بيعمل|بتنتج) (?:ال)?(?:مي|ميه|ماء|نقط)/,
        /sweat\w*|(?:glass|cup) itself (?:makes?|produces?|gives?|creates?)|(?:glass|cup) (?:is )?(?:making|producing) (?:the )?(?:water|drops)/,
      ),
      unless: AIR_WORDS,
    },
    {
      idea: 'spill_from_above',
      re: anyOf(
        /(?<![ء-ي])(?:رش|رشت|رشها|رشوا|رشينا|كب|كبت|كبها|كبوا|انكب|انكبت|دلق|دلقت|دلقها|اندلق|اندلقت)(?![ء-ي])/,
        /(?<![ء-ي])(?:ال)?(?:مطر|شتا)(?![ء-ي])/,
        /(?:نزلت|نزل|اجت|بتنزل|وقعت) (?:عليها )?من فوق|من فوق (?:نزلت|نزل|عليها)/,
        /spill\w*|splash\w*|poured (?:water )?(?:on|over)|(?:water|drops?|it) (?:fell|came|dripped) from above|\brain(?:ed|ing|s|water)?\b/,
      ),
    },
    {
      idea: 'people_breath',
      re: anyOf(
        /(?<![ء-ي])(?:من |ب)?(?:نفس|انفاس) (?:ال)?(?:ناس|ولاد|اولاد|طلاب)/,
        /(?<![ء-ي])(?:من )?(?:ال)?(?:نفسنا|نفسهم|انفاسنا|انفاسهم)(?![ء-ي])|(?<![ء-ي])(?:من )?النفس(?![ء-ي])/,
        /تنفس|نتنفس|بيتنفس|نفخ/,
        /breath\w*|exhal\w*/,
      ),
    },
    {
      idea: 'appears_magic',
      re: anyOf(
        /(?:بتطلع|بيطلع|طلعت|طلعوا|بتظهر|ظهرت|بتيجي|اجت|صارت|بتصير) لحال\S*|لحال\S* (?:بتطلع|بيطلع|طلعت|بتظهر|بتيجي)/,
        /(?<![ء-ي])سحر\S*|من ولا (?:اشي|شي|مكان)|من العدم|بدون سبب|بلا سبب/,
        /magic\w*|by (?:it ?self|themselves)|(?:out of|from) nowhere|for no reason|just appears?/,
      ),
    },
    {
      idea: 'any_cold',
      re: anyOf(
        /(?<![ء-ي])(?:اي|كل) (?:اشي|شي|سطح|غرض|حاجه|كاسه) (?:بارد|ساقع|مسقع)\S*/,
        /(?:any|every) [^.?!]{0,10}?cold|anything (?:that is )?cold|all cold (?:things|surfaces|objects)/,
      ),
      unless: /بخار|من الهوا|مي بالهوا|vapou?r|from the air|water in the air/,
    },
    {
      idea: 'any_cold',
      re: anyOf(
        /(?:حتي لو|حتي اذا|مهما كان) (?:ال)?(?:هوا|هواء|جو)\S* (?:ناشف|جاف)|مهما كان (?:ال)?(?:هوا|هواء|جو)|(?:الهوا|الجو) (?:ما|مش) (?:بيفرق|بفرق|بياثر|مهم|بيهم)/,
        /even (?:in|if|when|with)[^.?!]{0,25}?dry|(?:no matter|whatever|regardless of)[^.?!]{0,20}?(?:air|weather)|air (?:doesn't|does not) matter/,
      ),
    },
  ],
  samples: [
    t('المي بتنزّ من الكاسة لبرّا', 'The water leaks out through the glass'),
    t('التلج بيذوب وبيطلع من الكاسة', 'The ice melts and the water comes out of the glass'),
    t('البرد نفسه بيصير مي', 'The cold itself turns into water'),
    t('الكاسة بتعرق زيّنا لما نشوّب', 'The glass is sweating like us'),
    t('يمكن حدا رشّ عليها مي', 'Maybe someone splashed water on it'),
    t('هاي من نفَس الناس', "It is from people's breath"),
    t('النقط بتطلع لحالها', 'The drops just appear by themselves'),
    t('أي إشي بارد بيطلع عليه مي حتى لو الهوا ناشف', 'Any cold thing makes water, even in dry air'),
    t('في بخار مي بالهوا، ولما يلمس الكاسة الباردة بيبرد وبيصير نقط', 'Water vapour in the air touches the cold glass, cools down and turns into drops'),
  ],
  preTest: [
    {
      id: 'pre1',
      q: t('حطّينا كاسة مي وتلج ع الطاولة، وبعد شوي طلعت نقط من برّا. من وين إجت؟', 'We put a glass of iced water on the table and drops appeared outside. Where did they come from?'),
      options: [t('نزّت من جوّا الكاسة', 'They leaked from inside'), t('من الهوا اللي حوالين الكاسة', 'From the air around the glass'), t('التلج ذاب وطلع', 'The ice melted and came out'), t('الكاسة بتعرق', 'The glass is sweating')],
      correct: 1,
      node: 'C2',
    },
    {
      id: 'pre2',
      q: t('لوّنّا المي اللي جوّا بأزرق. شو لون النقط اللي برّا؟', 'We colour the water inside blue. What colour are the drops outside?'),
      options: [t('زرقا', 'Blue'), t('شفّافة', 'Clear'), t('أبيض زي الحليب', 'White like milk')],
      correct: 1,
      node: 'C2',
    },
    {
      id: 'pre3',
      q: t('ليش ما بتطلع نقط ع كاسة مي عادية، مش باردة؟', 'Why do no drops appear on a glass of ordinary, not cold, water?'),
      options: [t('لأنها مش باردة كفاية', 'Because it is not cold enough'), t('لأنه المي العادية ما بتقدر تنزّ', 'Because ordinary water cannot leak'), t('لأنه ما فيها تلج يذوب', 'Because it has no ice to melt')],
      correct: 0,
      node: 'C3',
    },
    {
      id: 'pre4',
      q: t('وين بتطلع نقط أكتر ع كاسة باردة؟', 'Where does a cold glass collect more drops?'),
      options: [t('بمكان هواه رطب', 'Where the air is humid'), t('بمكان هواه ناشف كتير', 'Where the air is very dry'), t('نفس الإشي بكل مكان', 'The same everywhere')],
      correct: 0,
      node: 'C4',
    },
  ],
  postTest: [
    {
      id: 'post1',
      q: t('دخلت من البرد ع مطبخ دافي فيه طبيخ، فغبّشت نظّارتك. من وين إجت المي؟', 'You come in from the cold into a warm kitchen with cooking, and your glasses fog up. Where is the water from?'),
      options: [t('من عيونك', 'From your eyes'), t('من هوا المطبخ', 'From the kitchen air'), t('من زجاج النظّارة نفسه', 'From the glass of the lenses')],
      correct: 1,
      node: 'C2',
    },
    {
      id: 'post2',
      q: t('علبة عصير مسكّرة طالعة من التلّاجة، وطلعت عليها نقط. شو هاي النقط؟', 'A closed juice can from the fridge gets drops on it. What are these drops?'),
      options: [t('عصير نزّ من العلبة', 'Juice that leaked from the can'), t('مي من الهوا اللي حواليها', 'Water from the air around it'), t('برد تحوّل لمي', 'Cold that turned into water')],
      correct: 1,
      node: 'C4',
    },
    {
      id: 'post3',
      q: t('بيوم بارد نفخت ع شبّاك السيارة فصار عليه غباش. ليش صار هيك ع الشبّاك البارد؟', 'On a cold day you breathe on a car window and it fogs. Why does this happen on the cold window?'),
      options: [t('لأنه البارد بيبرّد المي اللي بالنفَس فبتصير نقط', 'Because the cold glass cools the water in your breath into drops'), t('لأنه الزجاج البارد بيعرق', 'Because cold glass sweats'), t('لأنه البرد نفسه بيتحوّل لمي', 'Because the cold itself turns into water')],
      correct: 0,
      node: 'C3',
    },
    {
      id: 'post4',
      q: t('بعد ليلة باردة لقيت نقط ع السيارة، وما شتّت. شو صار؟', 'After a cold night there are drops on the car, but it did not rain. What happened?'),
      options: [t('شتّت وإحنا نايمين أكيد', 'It must have rained while we slept'), t('مي من الهوا بردت ع السيارة الباردة وصارت نقط', 'Water from the air cooled on the cold car and became drops'), t('حديد السيارة طلّع مي', 'The metal of the car gave out water')],
      correct: 1,
      node: 'C5',
    },
  ],
  activities: {
    _default: {
      type: 'experiment',
      title: t('من وين إجت المي؟', 'Where did the water come from?'),
      goal: t('كل طالب يفحص فكرته بتجربة ويشرح من وين إجت النقط.', 'Every learner tests their idea and explains where the drops came from.'),
      grouping: t('مجموعات من ٣ لـ ٤', 'Groups of 3 to 4'),
      materials: ['cups', 'metal_cup', 'water', 'ice', 'food_color', 'napkins'],
      steps: [
        { minutes: 3, title: t('توقّعات', 'Predictions'), detail: t('كل طالب بيكتب لحاله: من وين برأيه رح تيجي النقط؟', 'Each learner writes alone where they think the drops will come from.') },
        { minutes: 7, title: t('تلات محطّات', 'Three stations'), detail: t('كاسة مي زرقا بتلج، وكاسة معدن فاضية مبرّدة، وكاسة مي عادية. بيمسحوا ويسجّلوا.', 'Iced blue water, an empty chilled metal cup, and ordinary water. Wipe and record.') },
        { minutes: 3, title: t('نقاش', 'Discussion'), detail: t('أي فكرة صمدت بالتلات محطّات؟ وأي فكرة ما صمدت، وليش؟', 'Which idea survived all three stations? Which did not, and why?') },
        { minutes: 2, title: t('بطاقة خروج', 'Exit ticket'), detail: t('جملة وحدة: من وين إجت النقط؟', 'One sentence: where did the drops come from?') },
      ],
      teacher: t('ما تعطي الجواب. اسأل: «شو الدليل؟» وخلّي المجموعات تقارن.', 'Do not give the answer. Ask "What is your evidence?" and let groups compare.'),
      check: t('ليش طلعت نقط ع الكاسة الفاضية؟', 'Why did drops appear on the empty cup?'),
      adapt: t('للي بحاجة دعم: رسمة كاسة يلوّنوا عليها وين طلعت النقط. بدون فريزر: استعملوا مي من التلّاجة.', 'For support: a glass outline to mark where drops appear. Without a freezer: use fridge-cold water.'),
    },
    _enrich: {
      type: 'game',
      title: t('صيّادين الغباش', 'Fog hunters'),
      goal: t('نطبّق الفكرة ع مواقف من الحياة ونربطها بدورة الماء.', 'Apply the idea to daily life and connect it to the water cycle.'),
      grouping: t('فرق من ٤', 'Teams of 4'),
      materials: ['paper', 'cups', 'metal_cup', 'water', 'ice'],
      steps: [
        { minutes: 4, title: t('صيد المواقف', 'Collect cases'), detail: t('كل فريق بيكتب مواقف شاف فيها غباش أو ندى بالبيت والشارع.', 'Each team lists places where they have seen fog or dew at home or outside.') },
        { minutes: 4, title: t('فسّروها', 'Explain them'), detail: t('لكل موقف: وين المي كانت؟ وشو السطح البارد؟', 'For each case: where was the water, and what is the cold surface?') },
        { minutes: 5, title: t('صمّموا تحدّي', 'Design a challenge'), detail: t('كيف نطلّع ع سطح واحد نقط أكتر؟ غيّروا إشي واحد وجرّبوا.', 'How can one surface collect more drops? Change one thing and try it.') },
        { minutes: 2, title: t('مشاركة', 'Share'), detail: t('كل فريق بيحكي: الغيمة بشو بتشبه كاستنا؟', 'Each team says how a cloud is like our glass.') },
      ],
      teacher: t('وضّح إنه الغيمة نقط مي صغيرة كتير تكوّنت لما برد الهوا فوق.', 'Clarify that a cloud is made of tiny drops formed when air cooled high up.'),
      check: t('شو المشترك بين مراية الحمّام والندى؟', 'What do a bathroom mirror and dew have in common?'),
      adapt: t('للمتقدّمين: خلّوهم يقارنوا مي باردة ومي بتلج بكاستين متل بعض.', 'For stretch: compare cool water and iced water in two identical cups.'),
    },
    inside_water: {
      type: 'experiment',
      title: t('لغز النقط الملوّنة', 'The mystery of the coloured drops'),
      goal: t('نفحص إذا النقط هي نفس المي اللي جوّا الكاسة.', 'Test whether the drops are the water from inside the glass.'),
      grouping: t('أزواج', 'Pairs'),
      materials: ['cups', 'metal_cup', 'water', 'ice', 'food_color', 'napkins'],
      steps: [
        { minutes: 3, title: t('توقّع', 'Predict'), detail: t('إذا المي طالعة من جوّا، شو لازم يكون لون المحرمة لما نمسح؟', 'If the water comes from inside, what colour should the tissue be after wiping?') },
        { minutes: 7, title: t('جرّب وامسح', 'Test and wipe'), detail: t('كاسة مي زرقا بتلج. بعد ٥ دقايق منمسح بمحرمة بيضا. وكمان كاسة معدن فاضية مبرّدة.', 'Iced blue water, wiped with a white tissue after 5 minutes, plus an empty chilled metal cup.') },
        { minutes: 3, title: t('نقاش', 'Discussion'), detail: t('المحرمة ما صارت زرقا، والكاسة الفاضية كمان طلع عليها نقط. شو بنستنتج؟', 'The tissue is not blue and the empty cup has drops too. What follows?') },
        { minutes: 2, title: t('فكرة جديدة', 'Updated idea'), detail: t('كل طالب بيكتب فكرته بعد التجربة.', 'Each learner writes their idea after the test.') },
      ],
      teacher: t('خلّيهم يحكوا توقّعهم بصوت عالي قبل المسح، عشان يلاحظوا الفرق.', 'Have them say the prediction aloud before wiping so they notice the difference.'),
      check: t('اعطيني دليلين إنه النقط مش من جوّا.', 'Give two pieces of evidence that the drops are not from inside.'),
      adapt: t('بدون ملوّن: استعملوا عصير غامق، وما حدا يشربه.', 'No colouring: use dark juice that nobody drinks.'),
    },
    ice: {
      type: 'experiment',
      title: t('بلا تلج، شو بصير؟', 'No ice, what happens?'),
      goal: t('نفصل بين ذوبان التلج وبرودة السطح.', 'Separate the melting of ice from the coldness of the surface.'),
      grouping: t('مجموعات من ٣', 'Groups of 3'),
      materials: ['cups', 'metal_cup', 'water', 'ice', 'napkins'],
      steps: [
        { minutes: 3, title: t('توقّع', 'Predict'), detail: t('كاسة باردة بس ما فيها تلج أبداً: بيطلع عليها إشي؟', 'A cold cup that has no ice at all: will anything appear on it?') },
        { minutes: 7, title: t('قارن', 'Compare'), detail: t('كاسة فيها مي وتلج جنب كاسة معدن فاضية مبرّدة.', 'A glass with iced water next to an empty chilled metal cup.') },
        { minutes: 3, title: t('نقاش', 'Discussion'), detail: t('التنتين عليهم نقط. شو المشترك بينهم؟', 'Both have drops. What do they share?') },
        { minutes: 2, title: t('بطاقة خروج', 'Exit ticket'), detail: t('جملة: شو دور التلج؟', 'One sentence: what is the job of the ice?') },
      ],
      teacher: t('التلج بيبرّد الكاسة. اسأل لحد ما يوصلوا إنه المي إجت من برّا.', 'The ice only cools the cup. Keep asking until they see the water came from outside.'),
      check: t('شو اللي لازم يكون: تلج، ولا سطح بارد؟ ومن وين المي؟', 'What is needed, ice or a cold surface? And where is the water from?'),
      adapt: t('بدون فريزر: كاسة تانية فيها مي من التلّاجة بدون تلج.', 'Without a freezer: a second glass with fridge-cold water and no ice.'),
    },
    cold_itself: {
      type: 'experiment',
      title: t('نفس البرد، هوا غير', 'Same cold, different air'),
      goal: t('نبيّن إنه البرد لحاله ما بيعمل مي.', 'Show that cold alone does not make water.'),
      grouping: t('كل الصف بمجموعتين', 'The class in two groups'),
      materials: ['cups', 'water', 'ice', 'paper'],
      steps: [
        { minutes: 3, title: t('توقّع', 'Predict'), detail: t('لو البرد هو اللي بيصير مي، الكاستين لازم يطلع عليهم نفس النقط. موافقين؟', 'If cold becomes water, both glasses should get the same drops. Do you agree?') },
        { minutes: 7, title: t('مكانين', 'Two places'), detail: t('كاسة باردة بمكان رطب (جنب مغسلة بعد ما تشتغل المي السخنة بإيد المعلّم) وكاسة بمكان ناشف ومهوّى.', 'One cold glass in humid air (near a sink after the teacher runs hot water) and one in a dry, aired spot.') },
        { minutes: 3, title: t('نقاش', 'Discussion'), detail: t('نفس البرد، بس النقط مش متل بعض. شو اللي اختلف؟', 'Same cold, different drops. What differed?') },
        { minutes: 2, title: t('بطاقة خروج', 'Exit ticket'), detail: t('جملة: من وين المي؟ وشو دور البرد؟', 'One sentence: where is the water from, and what does the cold do?') },
      ],
      teacher: t('المي السخنة بإيد المعلّم بس. إذا الفرق صغير، احكوا ليش بدها مكانين مختلفين كتير.', 'Only the teacher handles hot water. If the difference is small, discuss why the two places must differ a lot.'),
      check: t('ليش نفس البرودة بتعطي نقط أقل بالهوا الناشف؟', 'Why does the same coldness give fewer drops in dry air?'),
      adapt: t('إذا ما في مغسلة: واجب بيتي بالحمّام بعد الدوش مع كبير.', 'No sink: set it as a home task in the bathroom after a shower, with an adult.'),
    },
  },
};
