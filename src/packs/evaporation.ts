/**
 * حزمة «ليش مي الكاسة بتنقص إذا تركناها كم يوم؟» — الصفوف ٣–٥ (التبخّر).
 * المفهوم الثاني: بيثبت إن نفس المحرّك (العقل + العالمين + نور) بيشتغل لمفهوم جديد.
 * عكس حزمة التكاثف: هناك البخار بيصير مي، هون المي بتصير بخار. مع بعض بيكمّلوا «دورة الماء».
 */
import type { ChildModel, Conditions } from '../contracts';
import type { ConceptPack } from './types';

type Out = 'stays' | 'slow' | 'fast' | 'wet';

function warm(c: Conditions) { return c.place === 'warm' || c.sun === 'yes'; }

function kidOutcome(m: ChildModel, c: Conditions): Out {
  const closed = c.lid === 'closed';
  const needsHeat = m.requires.includes('heat');
  const needsSun = m.requires.includes('sun');
  const speed = (): Out => (needsHeat ? (warm(c) ? 'fast' : 'slow') : 'fast');
  const outs: Out[] = [];
  for (const s of m.sources) {
    if (s === 'to_vapor') outs.push(closed ? 'stays' : warm(c) ? 'fast' : 'slow');
    else if (s === 'leak_bottom') outs.push(c.napkin === 'yes' ? 'wet' : 'fast');
    else if (s === 'sun_pulls') outs.push(closed || c.sun !== 'yes' ? 'stays' : 'fast');
    else if (s === 'air_takes' || s === 'someone_drank') outs.push(closed ? 'stays' : speed());
    else outs.push(speed()); // glass_drinks, vanishes: a lid does not stop them
  }
  if (needsSun && c.sun !== 'yes' && !outs.includes('wet')) return 'stays';
  if (outs.includes('wet')) return 'wet';
  if (outs.includes('fast')) return 'fast';
  if (outs.includes('slow')) return 'slow';
  return 'stays';
}

function realOutcome(c: Conditions): Out {
  if (c.lid === 'closed') return 'stays';
  return warm(c) ? 'fast' : 'slow';
}

export const evaporation: ConceptPack = {
  id: 'evaporation',
  title: 'المي اللي بتنقص',
  subject: 'علوم',
  grades: '٣–٥',
  question: 'ليش مي الكاسة بتنقص إذا تركناها كم يوم؟',
  scene: 'evaporation',

  sources: {
    to_vapor: { label: 'المي بتصير بخار', story: ['المي بتاخد حرارة', 'بتتحول لبخار ما بنشوفه', 'البخار بيطلع للهوا'], wrongStep: null, ai: 'the water turns into invisible vapour and goes into the air' },
    glass_drinks: { label: 'الكاسة بتشرب المي', story: ['المي بتلمس الزجاج', 'الزجاج بيمتصها', 'المي بتختفي جوّا الكاسة'], wrongStep: 1, ai: 'the glass soaks up / drinks the water' },
    leak_bottom: { label: 'بتنزّ من تحت', story: ['في ثقوب صغيرة تحت', 'المي بتنزل منها', 'بتروح عالطاولة'], wrongStep: 0, ai: 'the water leaks out through the bottom' },
    sun_pulls: { label: 'الشمس بتسحبها', story: ['الشمس بتطلع', 'بتسحب المي لفوق', 'المي بتنقص'], wrongStep: 1, ai: 'the sun pulls the water up (only the sun)' },
    air_takes: { label: 'الهوا بياخدها', story: ['الهوا بيلمس المي', 'بياخد منها شوي شوي', 'المي بتنقص'], wrongStep: 1, ai: 'the air takes the water away, without it changing form' },
    vanishes: { label: 'بتختفي لحالها', story: ['المي قاعدة', 'بتختفي لحالها', 'بتنقص'], wrongStep: 1, ai: 'the water just disappears / stops existing' },
    someone_drank: { label: 'حدا شربها', story: ['حدا مرق', 'شرب من الكاسة', 'نقصت'], wrongStep: 1, ai: 'someone drank it or poured it out' },
  },
  paths: {
    up_to_air: { label: 'بتطلع لفوق للهوا', ai: 'goes up into the air' },
    into_glass: { label: 'بتدخل بالزجاج', ai: 'goes into the glass material' },
    out_bottom: { label: 'بتطلع من تحت', ai: 'goes out through the bottom' },
    disappears: { label: 'بتختفي بمكانها', ai: 'disappears where it is' },
    taken_out: { label: 'حدا بيطلّعها', ai: 'someone takes it out' },
  },
  requires: {
    heat: { label: 'بدها حرارة', ai: 'happens faster with warmth' },
    sun: { label: 'بدها شمس', ai: 'happens only in sunlight' },
  },
  correctModel: { sources: ['to_vapor'], path: 'up_to_air', requires: ['heat'] },

  scienceChain: ['المي بتاخد حرارة', 'بتتحول لبخار ما بنشوفه', 'البخار بيطلع وبيختلط بالهوا'],
  chain: {
    C1: { label: 'المي سائل أو غاز', ai: 'water can be a liquid or an invisible gas' },
    C2: { label: 'المي بتتحول لبخار', ai: 'liquid water turns into invisible vapour (it does not vanish)' },
    C3: { label: 'البخار بيطلع للهوا', ai: 'the vapour goes into the air and mixes with it' },
    C4: { label: 'الحرارة بتسرّع', ai: 'warmth makes it happen faster (sun is not required)' },
    C5: { label: 'الغسيل والغيوم', ai: 'the same thing dries clothes and feeds clouds (water cycle)' },
  },

  variables: [
    { id: 'lid', label: 'غطا', options: [{ id: 'open', label: 'مفتوحة' }, { id: 'closed', label: 'مسكّرة بغطا' }] },
    { id: 'place', label: 'المكان', options: [{ id: 'warm', label: 'دافي' }, { id: 'cold', label: 'بارد' }] },
    { id: 'sun', label: 'الشمس', options: [{ id: 'yes', label: 'بالشمس' }, { id: 'no', label: 'بالعتمة' }] },
    { id: 'napkin', label: 'تحت الكاسة', options: [{ id: 'no', label: 'ولا إشي' }, { id: 'yes', label: 'محرمة ناشفة' }] },
  ],
  baseline: { lid: 'open', place: 'warm', sun: 'yes', napkin: 'no' },
  presets: [
    { id: 'V_lid', name: 'نسكّر الكاسة بغطا', short: 'غطا', change: { lid: 'closed' }, home: 'عبّوا كاستين لنفس الخط، وحدة مسكّرة بنايلون وشريطة، ووحدة مفتوحة، وعلّموا مستوى المي. شوفوهم بعد ٣ أيام.', safety: 'ما في خطر.' },
    { id: 'V_dark', name: 'بالعتمة بس بمكان دافي', short: 'عتمة', change: { sun: 'no' }, home: 'حطوا كاسة بخزانة دافية بالعتمة، وعلّموا المستوى، وشوفوها بعد ٣ أيام.', safety: 'ما في خطر.' },
    { id: 'V_napkin', name: 'محرمة ناشفة تحت الكاسة', short: 'محرمة', change: { napkin: 'yes' }, home: 'حطوا الكاسة على محرمة ناشفة، وشوفوا بعد يومين إذا المحرمة تبلّت.', safety: 'ما في خطر.' },
    { id: 'V_cold', name: 'بمكان بارد وعتمة', short: 'مكان بارد', change: { place: 'cold', sun: 'no' }, home: 'كاسة بالثلاجة (مفتوحة) وكاسة عالشبّاك، وقارنوا المستوى بعد ٣ أيام.', safety: 'ما في خطر.' },
  ],
  outcomes: { stays: 'المي ما بتنقص', slow: 'بتنقص بشوي', fast: 'بتنقص بسرعة', wet: 'المحرمة بتتبلّ' },
  kidOutcome,
  realOutcome,
  matches: (kid, real) => kid === real,

  noor: {
    greeting: 'أهلاً! أنا نور. تركنا هالكاسة كم يوم، وشوف: المي نقصت! احكيلي بكلامك: وين راحت المي؟ رح أرسم فكرتك زي ما هي.',
    planted: 'فهمت! يعني لو سكّرنا الكاسة بغطا محكم، المي رح تضل تنقص بنفس السرعة؟',
    plantedTruth: 'a tight lid traps the vapour, so the water level STAYS (almost) the same',
    afterContradiction: 'شفت؟ اللي صار غير اللي توقّعته فكرتك. في إشي ناقص. وين راحت المي برأيك هلأ؟ احكيلي من جديد.',
    afterMatch: 'حلو! هالمرة فكرتك صمدت. جرّب تغيّر إشي ثاني، أو احكيلي إذا بدك تغيّر فكرتك.',
    sameResult: 'العالمين عملوا نفس الإشي! هالتجربة ما بتفرّق بين فكرتك والحقيقة. غيّر متغيّر ثاني.',
    clarifyLadder: [
      'مش متأكدة إني فهمت. المي اللي نقصت، وين راحت برأيك؟',
      'طيب: برأيك المي نزلت لتحت، دخلت بالكاسة، ولا طلعت لفوق؟',
      'آخر تلميح: لو سكّرنا الكاسة بغطا، المي بتضل تنقص ولا لأ؟ شو بتتوقّع؟',
    ],
    caughtThanks: 'آه! الغطا بيحبس البخار، فالمي ما بتقدر تطلع للهوا وبتضل زي ما هي. هلأ فهمت، شكراً يا أستاذ!',
    stillConfused: 'لسا محتارة… إذا المي بتطلع لفوق للهوا، والغطا مسكّر، كيف رح تطلع؟',
    challengeIntro: 'تحدي جديد! رح أحاول أفسّر ظاهرة ما شفناها، بس من اللي علّمتني ياه:',
    transferIntro: 'هلأ دورك إنت تفسّر لحالك:',
  },
  answerWords: /بخار|تبخر|يتبخر|بتتبخر|التبخر|evapor|vapou?r/i,
  challenge: {
    phenomenon: 'ليش الغسيل المنشور بينشف أسرع بيوم شوب؟',
    correctAnswer: 'لأن الحرارة بتخلي المي اللي بالغسيل تتحول لبخار أسرع، والبخار بيطلع للهوا وبيروح.',
  },
  transfer: { question: 'مسحنا اللوح بإسفنجة مبلولة، وبعد شوي اللوح نشف. وين راحت المي؟' },

  correctRule: { s1: /حرار|سخن|دافي|شمس|دفا|شوب/, s2: /بخار|بتتحول|بتصير غاز|بتتبخر|تبخر|غاز/, s3: /هوا|الجو|بتطلع لفوق|بتطير|لفوق/ },
  teachCaught: /لا|لأ|ما بتنقص|بتضل|ما رح|ما بيطلع|محبوس|بيحبس|ما بتقدر/,
  keywordRules: [
    { re: /(الكاسه|الزجاج|الكاس) ?(بتشرب|شربت|بيشرب|بتمتص|امتص)|بيمتص|بتمتص|بتدخل بالزجاج|بالزجاج/, sources: ['glass_drinks'], path: 'into_glass', caption: 'الكاسة بتشرب المي.' },
    { re: /شرب|شربها|حدا/, sources: ['someone_drank'], path: 'taken_out', caption: 'حدا شرب من الكاسة.' },
    { re: /لحالها|بتختفي|اختفت|انعدمت|بتروح لحالها/, unless: /بخار|هوا|تبخر/, sources: ['vanishes'], path: 'disappears', caption: 'المي بتختفي لحالها.' },
    { re: /نز|من تحت|ثقوب|بتسرب|تسرب/, sources: ['leak_bottom'], path: 'out_bottom', caption: 'المي بتنزّ من تحت الكاسة.' },
    { re: /الشمس بتسحب|بتسحب|بتشفط|الشمس بتاخد/, unless: /بخار|تبخر/, sources: ['sun_pulls'], path: 'up_to_air', requires: ['sun'], caption: 'الشمس بتسحب المي لفوق.' },
    { re: /بخار|تبخر|بتتبخر|غاز/, sources: ['to_vapor'], path: 'up_to_air', caption: 'المي بتصير بخار وبتطلع للهوا.' },
    { re: /هوا|الجو/, sources: ['air_takes'], path: 'up_to_air', caption: 'الهوا بياخد المي شوي شوي.' },
    { re: /شمس/, sources: ['sun_pulls'], path: 'up_to_air', requires: ['sun'], caption: 'الشمس بتسحب المي لفوق.' },
  ],
  samplePhrases: [
    'الكاسة بتشرب المي',
    'المي بتنزّ من تحت',
    'الشمس بتسحب المي',
    'الهوا بياخدها',
    'المي بتختفي لحالها',
    'المي لما تسخن بتصير بخار ما بنشوفه وبتطلع للهوا',
  ],
  preTest: [
    { q: 'تركنا كاسة مي مفتوحة ٣ أيام، والمي نقصت. وين راحت؟', options: ['الكاسة شربتها', 'صارت بخار وطلعت للهوا', 'نزّت من تحت', 'اختفت لحالها'], correct: 1, link: 'C2' },
    { q: 'لو سكّرنا الكاسة بغطا محكم، شو بصير بالمي؟', options: ['بتنقص بنفس السرعة', 'بتضل تقريباً زي ما هي', 'بتزيد'], correct: 1, link: 'C3' },
    { q: 'كاسة بالشمس وكاسة بالعتمة بنفس الغرفة الدافية. شو بصير؟', options: ['بس اللي بالشمس بتنقص', 'الثنتين بتنقص', 'ولا وحدة بتنقص'], correct: 1, link: 'C4' },
    { q: 'وين المي بتنقص أسرع؟', options: ['بمكان دافي', 'بمكان بارد', 'نفس الإشي'], correct: 0, link: 'C4' },
  ],
  postTest: [
    { q: 'نشرنا الغسيل المبلول، وبعد ساعات نشف. وين راحت المي؟', options: ['نزلت عالأرض كلها', 'صارت بخار بالهوا', 'القماش شربها'], correct: 1, link: 'C2' },
    { q: 'بركة مي بالشارع بعد الشتا، بعد يومين اختفت. شو صار فيها؟', options: ['الأرض شربتها كلها', 'جزء منها تبخّر للهوا', 'اختفت من الوجود'], correct: 1, link: 'C3' },
    { q: 'وين بينشف الغسيل أسرع؟', options: ['بيوم شوب', 'بيوم بارد', 'نفس الإشي'], correct: 0, link: 'C4' },
    { q: 'المي اللي بتتبخر من البحر، وين بتروح بالآخر؟', options: ['بتختفي', 'بتطلع للهوا وبتصير غيوم', 'بترجع للبحر فوراً'], correct: 1, link: 'C5' },
  ],
  activities: {
    glass_drinks: {
      title: 'هل الكاسة بتشرب المي؟',
      goal: 'نكسر فكرة إن الزجاج بيمتص المي.',
      materials: ['كاستين زجاج', 'نايلون وشريطة', 'قلم لتعليم المستوى'],
      steps: [
        { minutes: 3, title: 'توقّعات', detail: 'لو الكاسة بتشرب المي، المسكّرة كمان رح تنقص. صح؟' },
        { minutes: 5, title: 'تجهيز', detail: 'كاسة مسكّرة وكاسة مفتوحة، نفس المستوى، ونعلّمه.' },
        { minutes: 5, title: 'نتيجة (بعد ٣ أيام)', detail: 'المسكّرة ما نقصت تقريباً، والمفتوحة نقصت.' },
        { minutes: 2, title: 'تقييم سريع', detail: 'جملة: ليش المسكّرة ما نقصت؟' },
      ],
      check: 'إذا الزجاج بيشرب المي، ليش الكاسة المسكّرة ما نقصت؟',
    },
    sun_pulls: {
      title: 'الشمس ولا الحرارة؟',
      goal: 'نبيّن إن التبخّر بيصير بالعتمة كمان، والحرارة هي اللي بتسرّعه.',
      materials: ['كاستين', 'خزانة دافية', 'شبّاك مشمس'],
      steps: [
        { minutes: 3, title: 'توقّعات', detail: 'لو الشمس هي اللي بتسحب المي، الكاسة اللي بالعتمة ما رح تنقص. صح؟' },
        { minutes: 5, title: 'تجهيز', detail: 'كاسة بالخزانة الدافية وكاسة عالشبّاك، ونعلّم المستوى.' },
        { minutes: 5, title: 'نتيجة', detail: 'الثنتين نقصوا. إذن مش لازم شمس.' },
        { minutes: 2, title: 'تقييم سريع', detail: 'جملة: شو اللي بيخلّي المي تنقص أسرع؟' },
      ],
      check: 'ليش الغسيل بينشف حتى بيوم غيم؟',
    },
    _default: {
      title: 'وين راحت المي؟',
      goal: 'نربط نقص المي بتحوّلها لبخار بيطلع للهوا.',
      materials: ['كاسات', 'نايلون', 'محرمة', 'قلم'],
      steps: [
        { minutes: 3, title: 'توقّعات', detail: 'كل طالب بيكتب وين برأيه راحت المي.' },
        { minutes: 7, title: 'تجارب', detail: 'كاسة مسكّرة، كاسة على محرمة، كاسة بالعتمة.' },
        { minutes: 3, title: 'نقاش', detail: 'أيّ فكرة صمدت بكل التجارب؟' },
        { minutes: 2, title: 'تقييم سريع', detail: 'جملة: وين راحت المي؟' },
      ],
      check: 'ليش البركة بتختفي أسرع بالصيف؟',
    },
  },
};
