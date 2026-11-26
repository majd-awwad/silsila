/**
 * حزمة «ليش بتطلع نقط مي على الكاسة الباردة؟» — الصفوف ٣–٥ (التكاثف).
 * من درس «دورة الماء في الطبيعة»، كتاب العلوم والحياة للصف الثالث ج١ (طبعة 2020)، ص ٧٥–٧٦ (راجعناها بالكتاب المطبوع).
 */
import type { ChildModel, Conditions } from '../contracts';
import type { ConceptPack } from './types';

type Out = 'drops' | 'blue' | 'fewer' | 'none';

function kidOutcome(m: ChildModel, c: Conditions): Out {
  const cold = c.temp === 'cold';
  const hasWater = c.contents !== 'empty';
  const outs: Out[] = [];
  for (const s of m.sources) {
    if (s === 'inside_water') {
      if (!hasWater) continue;
      if (m.path === 'over_rim' && c.lid === 'on') continue;
      outs.push(c.contents === 'blue' ? 'blue' : 'drops');
    } else if (s === 'ice') {
      if (hasWater && cold) outs.push('drops');
    } else if (s === 'air_vapor') {
      if (m.requires.includes('cold') && !cold) continue;
      outs.push(c.air === 'dry' ? 'fewer' : 'drops');
    } else if (s === 'cold_itself') {
      if (cold) outs.push('drops');
    } else {
      // glass_itself, spill_from_above, people_breath, appears_magic: nothing in the setup stops them
      outs.push('drops');
    }
  }
  if (m.requires.includes('cold') && !cold) return 'none';
  if (!outs.length) return 'none';
  if (outs.includes('blue')) return 'blue';
  if (outs.includes('drops')) return 'drops';
  return 'fewer';
}

function realOutcome(c: Conditions): Out {
  if (c.temp !== 'cold') return 'none';
  return c.air === 'dry' ? 'fewer' : 'drops';
}

export const condensation: ConceptPack = {
  id: 'condensation',
  title: 'الكاسة الباردة',
  subject: 'علوم',
  grades: '٣–٥',
  curriculum: {
    book: 'العلوم والحياة، الصف الثالث، الجزء الأول (طبعة 2020)',
    unit: 'الوحدة الثانية: الأرض وثرواتها',
    lesson: 'الدرس الرابع: دورة الماء في الطبيعة، نشاط (٣) «من أين أتى الماء؟» ونشاط (٤) «التكاثف»',
    pages: '٧٥–٧٦',
  },
  question: 'ليش بتطلع نقط مي على الكاسة الباردة من برّا؟',
  scene: 'condensation',

  sources: {
    inside_water: { label: 'المي اللي جوّا', story: ['المي اللي جوّا الكاسة', 'بتعبر من الزجاج', 'بتصير نقط برّا'], wrongStep: 1, ai: 'the water inside the glass gets out' },
    ice: { label: 'الثلج', story: ['الثلج بيذوب', 'المي الذايبة بتطلع من الكاسة', 'بتصير نقط برّا'], wrongStep: 1, ai: 'melting ice gets out of the glass' },
    air_vapor: { label: 'مي بالهوا', story: ['في مي بالهوا', 'بتلزق ع الكاسة', 'بتصير نقط'], wrongStep: null, ai: 'water comes from the surrounding air' },
    cold_itself: { label: 'البرد نفسه', story: ['الكاسة باردة كثير', 'البرد نفسه بيتحول لمي', 'بيصير نقط'], wrongStep: 1, ai: 'the coldness itself turns into water' },
    glass_itself: { label: 'الكاسة نفسها', story: ['الكاسة بتبرد', 'بتعرق زي الناس', 'بيطلع منها نقط'], wrongStep: 1, ai: 'the glass itself makes or sweats water' },
    spill_from_above: { label: 'مي نازلة من فوق', story: ['حدا كبّ مي', 'المي نزلت ع الكاسة', 'صارت نقط'], wrongStep: 0, ai: 'someone or something spilled or dripped water on it' },
    people_breath: { label: 'نفَس الناس', story: ['الناس بيتنفسوا', 'النفَس بيوصل للكاسة', 'بيصير نقط'], wrongStep: null, ai: "people's breath lands on it" },
    appears_magic: { label: 'بتطلع لحالها', story: ['النقط بتطلع لحالها', 'بدون سبب'], wrongStep: 0, ai: 'it just appears, no cause' },
  },
  paths: {
    through_wall: { label: 'بتعبر من الزجاج', ai: 'passes through the glass wall' },
    over_rim: { label: 'بتطلع من فوق وبتنزل', ai: 'goes over the top and runs down' },
    from_air: { label: 'من الهوا للسطح', ai: 'comes from the surrounding air onto the surface' },
    appears_on_surface: { label: 'بتظهر ع السطح', ai: 'forms right on the surface' },
    falls_from_above: { label: 'بتنزل من فوق', ai: 'drops onto it from above' },
  },
  requires: { cold: { label: 'بدها برد', ai: 'drops form only because the glass is cold' } },
  correctModel: { sources: ['air_vapor'], path: 'from_air', requires: ['cold'] },

  scienceChain: ['في مي بالهوا ما بنشوفها', 'لما تلمس الكاسة الباردة بتبرد', 'بتتحول لنقط مي'],
  chain: {
    C1: { label: 'المي سائل أو غاز', ai: 'water can be a liquid or an invisible gas' },
    C2: { label: 'الهوا فيه بخار', ai: 'air contains invisible water vapour' },
    C3: { label: 'البخار بيبرد', ai: 'that vapour cools when it touches a cold surface' },
    C4: { label: 'بيصير نقط', ai: 'cooled vapour becomes droplets (condensation)' },
    C5: { label: 'الندى والغيوم', ai: 'the same thing makes dew and clouds' },
  },

  variables: [
    { id: 'temp', label: 'حرارة الكاسة', options: [{ id: 'cold', label: 'باردة (ثلج)' }, { id: 'room', label: 'حرارة الغرفة' }] },
    { id: 'contents', label: 'شو جوّا الكاسة', options: [{ id: 'water', label: 'مي' }, { id: 'blue', label: 'مي ملوّنة أزرق' }, { id: 'empty', label: 'فاضية' }] },
    { id: 'air', label: 'الهوا حوالينها', options: [{ id: 'humid', label: 'رطب' }, { id: 'dry', label: 'ناشف كثير' }] },
    { id: 'lid', label: 'غطا', options: [{ id: 'off', label: 'بدون' }, { id: 'on', label: 'مغطّاة' }] },
  ],
  baseline: { temp: 'cold', contents: 'water', air: 'humid', lid: 'off' },
  presets: [
    { id: 'E_color', name: 'نلوّن المي جوّا بأزرق', short: 'مي ملوّنة', change: { contents: 'blue' }, home: 'حط نقطتين ملوّن طعام أزرق بكاسة مي مع ثلج، واستنى ٥ دقايق، وامسح النقط بمحرمة بيضا.', safety: 'ملوّن طعام بس، والكاسة على سطح ثابت.' },
    { id: 'E_empty', name: 'كاسة فاضية باردة من الفريزر', short: 'كاسة فاضية', change: { contents: 'empty' }, home: 'حط كاسة معدن أو بلاستيك فاضية ناشفة بالفريزر ١٠ دقايق، وطلّعها وحطها على الطاولة.', safety: 'لا تحط كاسة زجاج بالفريزر (ممكن تنكسر)، وكبير بيطلّعها.' },
    { id: 'E_warm', name: 'مي بحرارة الغرفة بلا ثلج', short: 'مي مش باردة', change: { temp: 'room' }, home: 'عبّي كاسة مي من الحنفية واستنى لتصير بحرارة الغرفة، بدون ثلج.', safety: 'ما في مي سخنة بهالتجربة أبداً.' },
    { id: 'E_cover', name: 'نغطّي الكاسة من فوق', short: 'غطا', change: { lid: 'on' }, home: 'غطّي كاسة المي والثلج بصحن من أول لحظة، واستنى ٥ دقايق.', safety: 'ما في خطر.' },
    { id: 'E_dry', name: 'هوا ناشف كثير', short: 'هوا ناشف', change: { air: 'dry' }, home: 'قارن كاسة باردة بالمطبخ وقت الطبيخ مع كاسة باردة جنب مدفاية كهربا (هوا ناشف).', safety: 'الكاسة بعيدة متر عن المدفاية، وكبير معك.' },
  ],
  outcomes: { drops: 'بيطلع نقط', blue: 'نقط زرقا', fewer: 'نقط أقل بكثير', none: 'ما في نقط' },
  kidOutcome,
  realOutcome,
  matches: (kid, real) => kid === real || (real === 'fewer' && kid === 'none'),

  noor: {
    greeting: 'أهلاً! أنا نور. شايف النقط اللي عم تطلع ع الكاسة من برّا؟ احكيلي بكلامك: من وين إجت؟ رح أرسم فكرتك زي ما هي.',
    planted: 'فهمت! يعني لو حطينا الكاسة بمكان ناشف كثير، زي أريحا بالصيف، رح يطلع نقط أكثر؟',
    plantedTruth: 'dry air holds less water vapour, so FEWER droplets form',
    afterContradiction: 'شفت؟ اللي صار غير اللي توقّعته فكرتك. يعني في إشي ناقص. شو رأيك هلأ: من وين إجت النقط؟ احكيلي من جديد.',
    afterMatch: 'حلو! هالمرة فكرتك صمدت. جرّب تغيّر إشي ثاني بالتجربة، أو احكيلي إذا بدك تغيّر فكرتك.',
    sameResult: 'العالمين عملوا نفس الإشي! يعني هالتجربة ما بتفرّق بين فكرتك والحقيقة. غيّر متغيّر ثاني لحد ما تلاقي تجربة بتفرّق.',
    clarifyLadder: [
      'مش متأكدة إني فهمت. المي اللي برّا الكاسة، من وين إجت برأيك؟',
      'طيب خلّيني أسهّلها: برأيك المي اللي برّا هي نفس المي اللي جوّا الكاسة، ولا إجت من مكان ثاني؟',
      'آخر تلميح: لو الكاسة فاضية بس باردة كثير، بيطلع عليها نقط ولا لأ؟ شو بتتوقّع؟',
    ],
    caughtThanks: 'آه! يعني الهوا الناشف فيه مي أقل، فبيطلع نقط أقل. هلأ فهمت، شكراً يا أستاذ!',
    stillConfused: 'لسا محتارة… الهوا الناشف فيه مي أكثر ولا أقل؟',
    challengeIntro: 'تحدي جديد! رح أحاول أفسّر ظاهرة ما شفناها، بس من اللي علّمتني ياه:',
    transferIntro: 'هلأ دورك إنت تفسّر لحالك:',
    reveal: 'خلّيني أساعدك شوي، لأنك جرّبت كثير وهاد شاطر منك! في مي بالهوا، بخار ما بنشوفه. لما هالمي بتلمس الكاسة الباردة بتبرد وبتصير نقط. يعني النقط جاية من الهوا، مش من جوّا الكاسة. هلأ جرّب تحكيها بكلامك.',
  },
  answerWords: /بخار|تكاثف|يتكاثف|بتتكاثف|التكثف|تكثّف|condens|vapou?r/i,
  challenge: {
    phenomenon: 'ليش بتتغطى مراية الحمام بنقط مي بعد ما حدا يتحمّم؟',
    correctAnswer: 'لأن هوا الحمام صار فيه مي كثير من الدوش السخن، ولما هالمي لمست المراية الأبرد منه بردت وصارت نقط.',
  },
  transfer: { question: 'الصبح بنلاقي نقط ندى على العشب، مع إنه ما شتت بالليل. من وين إجت؟' },

  correctRule: { s1: /هوا|الجو|بخار|رطوب/, s2: /برد|بارد|تبرد|بتبرد|تبريد/, s3: /نقط|تتجمع|بتصير مي|بتتحول|تكاثف|بتتكثف/ },
  teachCaught: /اقل|قليل|ما بيطلع|ما في|ناشف.*(مي|بخار)|مي اقل/,
  keywordRules: [
    { re: /لحالها|سحر|من ولا اشي/, sources: ['appears_magic'], path: 'appears_on_surface', caption: 'النقط بتطلع لحالها.' },
    { re: /(^|\s)(نفس|تنفس|نتنفس|بنتنفس|بيتنفسوا|نفخ)(\s|$)/, sources: ['people_breath'], path: 'from_air', caption: 'نفَس الناس بيلزق ع الكاسة.' },
    { re: /(^|\s)(رش|رشت|كب|كبت|انكب|انكبت|دلق)(\s|$|ها)|حدا/, sources: ['spill_from_above'], path: 'falls_from_above', caption: 'حدا رشّ أو كبّ مي ع الكاسة.' },
    { re: /عرق|بتبكي|بتدمع/, sources: ['glass_itself'], path: 'appears_on_surface', caption: 'الكاسة نفسها بتعرق زي الناس.' },
    { re: /(ثلج|تلج|ذاب|بيذوب).*(نز|يطلع|بتطلع|بيطلع|طلع)|(نز|يطلع|بتطلع|بيطلع).*(ثلج|تلج)/, sources: ['ice', 'inside_water'], path: 'through_wall', caption: 'الثلج بيذوب وبيطلع لبرّا من الكاسة.' },
    { re: /ثلج|تلج|ذاب|بيذوب/, sources: ['ice'], path: 'through_wall', caption: 'الثلج بيذوب وبيطلع لبرّا من الكاسة.' },
    { re: /فاضت|طفحت|من الطرف|من فوق وبتنزل|بتطلع من فوق/, sources: ['inside_water'], path: 'over_rim', caption: 'المي اللي جوّا بتطلع من فوق وبتنزل ع الكاسة.' },
    { re: /نز|تسرب|بتسرب|ترشح|يرشح|بيرشح|من جو|ثقوب|مسامات|بتعبر|طلعت من الكاس|بتطلع من الكاس|بيطلع من الكاس/, sources: ['inside_water'], path: 'through_wall', caption: 'المي اللي جوّا بتطلع لبرّا من الزجاج.' },
    { re: /البرد|البروده|بارده|باردة/, unless: /هوا|الجو|بخار|رطوب/, sources: ['cold_itself'], path: 'appears_on_surface', requires: ['cold'], caption: 'البرد نفسه بيتحول لمي.' },
    { re: /هوا|الجو|بخار|رطوب/, sources: ['air_vapor'], path: 'from_air', caption: 'في مي بالهوا بتروح ع الكاسة.' },
  ],
  samplePhrases: [
    'المي بتنزّ من الكاسة لبرّا',
    'الثلج بيذوب وبيطلع من الكاسة',
    'الكاسة بتعرق زيّنا لما نشوب',
    'البرد نفسه بيصير مي',
    'يمكن حدا رشّ عليها مي',
    'ما بعرف، بتطلع لحالها',
    'في مي بالهوا ما بنشوفها، ولما تلمس الكاسة الباردة بتبرد وبتصير نقط',
  ],
  preTest: [
    { q: 'حطّينا كاسة مي فيها ثلج على الطاولة، وبعد شوي طلع نقط مي من برّا. من وين إجت النقط؟', options: ['نزّت من جوّا الكاسة', 'من الهوا اللي حوالين الكاسة', 'الثلج ذاب وطلع', 'الكاسة بتعرق'], correct: 1, link: 'C2' },
    { q: 'لو لوّنّا المي اللي جوّا الكاسة بأزرق، شو لون النقط اللي برّا؟', options: ['زرقا', 'شفافة', 'ما بيطلع نقط أصلاً'], correct: 1, link: 'C2' },
    { q: 'ليش ما بيطلع نقط على كاسة مي دافية؟', options: ['لأنها مش باردة لتبرّد المي اللي بالهوا', 'لأن المي الدافية ما بتنزّ', 'لأنه ما فيها ثلج يذوب'], correct: 0, link: 'C3' },
    { q: 'وين بيطلع نقط أكثر على كاسة باردة؟', options: ['بغرفة رطبة', 'بمكان ناشف كثير', 'نفس الإشي بكل مكان'], correct: 0, link: 'C4' },
  ],
  postTest: [
    { q: 'طلعت من برّا البرد ودخلت مطبخ دافي فيه طبيخ، فغبّشت نظارتك. من وين إجت المي؟', options: ['من عيونك', 'من المي اللي بهوا المطبخ', 'من زجاج النظارة نفسه'], correct: 1, link: 'C2' },
    { q: 'علبة عصير مسكّرة طالعة من الثلاجة، وطلع عليها نقط. هل النقط عصير؟', options: ['آه، العصير نزّ من العلبة', 'لأ، هي مي من الهوا', 'لأ، هي البرد صار مي'], correct: 1, link: 'C2' },
    { q: 'كاسة فيها مي بحرارة الغرفة، وكاسة فيها مي وثلج. على أيّ وحدة بيطلع نقط من برّا؟', options: ['ع الكاستين نفس الإشي', 'ع اللي فيها ثلج بس', 'ع اللي بحرارة الغرفة بس'], correct: 1, link: 'C3' },
    { q: 'الصبح لقيت ندى على العشب. شو اللي صار؟', options: ['المطر نزل بالليل', 'مي الهوا بردت على العشب البارد وصارت نقط', 'العشب طلّع مي من جوّا'], correct: 1, link: 'C5' },
  ],
  activities: {
    inside_water: {
      title: 'تحدي مصدر المي الغامض',
      goal: 'نكسر فكرة إن المي بتعبر الزجاج من جوّا لبرّا.',
      materials: ['كاسات شفافة', 'ثلج', 'ملوّن طعام أزرق', 'محارم بيضا', 'كاسة معدن فاضية مبرّدة'],
      steps: [
        { minutes: 3, title: 'توقّعات', detail: 'كل مجموعة بتكتب: لو لوّنّا المي أزرق، شو لون النقط برّا؟ وليش؟' },
        { minutes: 7, title: 'تجربة وملاحظة', detail: 'كاسة مي زرقا مع ثلج + كاسة معدن فاضية مبرّدة. بعد ٥ دقايق بيمسحوا النقط بمحرمة بيضا.' },
        { minutes: 3, title: 'نقاش', detail: 'النقط شفافة، وطلعت على الكاسة الفاضية كمان. إذن من وين إجت؟' },
        { minutes: 2, title: 'تقييم سريع', detail: 'كل طالب بيكتب جملة: من وين إجت النقط؟' },
      ],
      check: 'ليش طلع نقط على الكاسة الفاضية؟',
    },
    ice: {
      title: 'الثلج ولا البرد؟',
      goal: 'نفصل بين ذوبان الثلج وبين برودة السطح.',
      materials: ['كاسة فيها ثلج', 'كاسة معدن فاضية مبرّدة', 'محارم'],
      steps: [
        { minutes: 3, title: 'توقّعات', detail: 'إذا ما في ثلج أبداً بس الكاسة باردة، بيطلع نقط؟' },
        { minutes: 7, title: 'تجربة', detail: 'قارنوا كاسة الثلج مع كاسة معدن فاضية من الفريزر.' },
        { minutes: 3, title: 'نقاش', detail: 'الكاسة الفاضية ما فيها ثلج يذوب، ومع هيك تغطّت نقط.' },
        { minutes: 2, title: 'تقييم سريع', detail: 'جملة: شو المهم، الثلج ولا البرد؟ ومن وين المي؟' },
      ],
      check: 'شو اللي لازم يكون عشان يطلع نقط: ثلج ولا سطح بارد؟',
    },
    cold_itself: {
      title: 'هل البرد بيصير مي؟',
      goal: 'نبيّن إن البرد لحاله ما بيعمل مي، لازم يكون في مي بالهوا.',
      materials: ['كاستين باردات', 'مكان رطب (مطبخ وقت الطبيخ)', 'مكان ناشف (جنب مدفاية)'],
      steps: [
        { minutes: 3, title: 'توقّعات', detail: 'لو البرد هو اللي بيصير مي، الكاستين لازم يطلع عليهم نفس كمية النقط. صح؟' },
        { minutes: 7, title: 'تجربة', detail: 'كاسة باردة بمكان رطب وكاسة باردة بمكان ناشف، ونقارن بعد ٥ دقايق.' },
        { minutes: 3, title: 'نقاش', detail: 'نفس البرد، بس نقط أقل بالمكان الناشف. إذن المي جاية من الهوا.' },
        { minutes: 2, title: 'تقييم سريع', detail: 'جملة: ليش الكاسة بالمكان الناشف عليها نقط أقل؟' },
      ],
      check: 'ليش نفس البرودة بتعطي نقط أقل بالهوا الناشف؟',
    },
    _default: {
      title: 'من وين إجت المي؟',
      goal: 'كل طالب يربط النقط بمي الهوا اللي بتبرد على سطح بارد.',
      materials: ['كاسات', 'ثلج', 'ملوّن طعام', 'كاسة معدن مبرّدة'],
      steps: [
        { minutes: 3, title: 'توقّعات', detail: 'كل طالب بيكتب فكرته عن مصدر النقط.' },
        { minutes: 7, title: 'تجارب سريعة', detail: 'المي الملوّنة، والكاسة الفاضية المبرّدة، والكاسة الدافية.' },
        { minutes: 3, title: 'نقاش', detail: 'أيّ فكرة صمدت بكل التجارب؟' },
        { minutes: 2, title: 'تقييم سريع', detail: 'جملة: من وين إجت النقط؟' },
      ],
      check: 'وين بيطلع نقط أكثر: بالحمام بعد الدوش ولا بغرفة ناشفة؟ ليش؟',
    },
  },
};
