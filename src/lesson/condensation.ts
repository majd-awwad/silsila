/**
 * محتوى درس «ليش بتطلع نقط مي على الكاسة الباردة؟» — الصفوف ٣–٥.
 * كل النصوص اللي بيشوفها الطفل هون، عشان تتعدّل بدون ما نلمس الكود.
 * مرتبط بدرس «دورة الماء في الطبيعة» بكتاب العلوم الفلسطيني للصف الثالث.
 */
import type { ChainId, ExperimentId, Outcome, Path, Source } from '../contracts';

export const QUESTION = 'ليش بتطلع نقط مي على الكاسة الباردة من برّا؟';

export const SOURCE_LABEL: Record<Source, string> = {
  inside_water: 'المي اللي جوّا',
  ice: 'الثلج',
  air_vapor: 'مي بالهوا',
  cold_itself: 'البرد نفسه',
  glass_itself: 'الكاسة نفسها',
  spill_from_above: 'مي نازلة من فوق',
  people_breath: 'نفَس الناس',
  appears_magic: 'بتطلع لحالها',
};

export const PATH_LABEL: Record<Path, string> = {
  through_wall: 'بتعبر من الزجاج',
  over_rim: 'بتطلع من فوق وبتنزل',
  from_air: 'من الهوا للسطح',
  appears_on_surface: 'بتظهر ع السطح',
  falls_from_above: 'بتنزل من فوق',
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  blue: 'نقط زرقا',
  clear: 'نقط شفافة',
  none: 'ما في نقط',
  drops: 'بيطلع نقط',
  fewer: 'نقط أقل بكثير',
};

export interface ExperimentInfo {
  name: string;
  short: string;
  /** what really happens — the ground truth the mirror's real world shows */
  real: Outcome;
  /** how to do it at home or in class */
  home: string;
  safety: string;
}

export const EXPERIMENTS: Record<ExperimentId, ExperimentInfo> = {
  E_color: {
    name: 'نلوّن المي جوّا بأزرق',
    short: 'مي ملوّنة',
    real: 'clear',
    home: 'حط نقطتين ملوّن طعام أزرق بكاسة مي مع ثلج، واستنى ٥ دقايق، وامسح النقط بمحرمة بيضا.',
    safety: 'ملوّن طعام بس، والكاسة على سطح ثابت.',
  },
  E_empty: {
    name: 'كاسة فاضية باردة من الفريزر',
    short: 'كاسة فاضية',
    real: 'drops',
    home: 'حط كاسة معدن أو بلاستيك فاضية ناشفة بالفريزر ١٠ دقايق، وطلّعها وحطها على الطاولة.',
    safety: 'لا تحط كاسة زجاج بالفريزر (ممكن تنكسر)، وكبير بيطلّعها.',
  },
  E_cover: {
    name: 'نغطّي الكاسة من فوق',
    short: 'غطا',
    real: 'drops',
    home: 'غطّي كاسة المي والثلج بصحن أو غطا من أول لحظة، واستنى ٥ دقايق.',
    safety: 'ما في خطر.',
  },
  E_warm: {
    name: 'مي بحرارة الغرفة بلا ثلج',
    short: 'مي مش باردة',
    real: 'none',
    home: 'عبّي كاسة مي من الحنفية واستنى لتصير بحرارة الغرفة، بدون ثلج.',
    safety: 'ما في مي سخنة بهالتجربة أبداً.',
  },
  E_dry: {
    name: 'هوا ناشف كثير',
    short: 'هوا ناشف',
    real: 'fewer',
    home: 'قارن كاسة باردة بالمطبخ وقت الطبيخ مع كاسة باردة جنب مدفاية كهربا (هوا ناشف).',
    safety: 'الكاسة بعيدة متر عن المدفاية، وكبير معك.',
  },
};

export const CHAIN_LABEL: Record<ChainId, string> = {
  C1: 'المي سائل أو غاز',
  C2: 'الهوا فيه بخار',
  C3: 'البخار بيبرد',
  C4: 'بيصير نقط',
  C5: 'الندى والغيوم',
};

export const RUBRIC_LABEL = {
  vapor_in_air: 'الهوا فيه مي',
  cooling: 'بتبرد ع الكاسة',
  turns_to_drops: 'بتصير نقط',
} as const;

export const NOOR = {
  greeting: 'أهلاً! أنا نور. شايف النقط اللي عم تطلع ع الكاسة من برّا؟ احكيلي بكلامك: من وين إجت؟ رح أرسم فكرتك زي ما هي.',
  planted: 'فهمت! يعني لو حطينا الكاسة بمكان ناشف كثير، زي أريحا بالصيف، رح يطلع نقط أكثر؟',
  afterContradiction: 'شفت؟ اللي صار غير اللي توقّعته فكرتك. يعني في إشي ناقص. شو رأيك هلأ: من وين إجت النقط؟ احكيلي من جديد.',
  afterMatch: 'حلو! هالمرة فكرتك صمدت. خلّينا نجرّب تجربة ثانية، أو احكيلي إذا بدك تغيّر إشي بفكرتك.',
  glitch: 'صار عندي لخبطة صغيرة. ممكن تعيد؟',
  safeFallback: 'فهمت عليك. طيب شو بتتوقّع يصير لو جرّبنا تجربة؟',
  thanks: 'آه! يعني الهوا الناشف فيه مي أقل، فبيطلع نقط أقل. هلأ فهمت، شكراً يا أستاذ!',
  stillConfused: 'لسا محتارة… الهوا الناشف فيه مي أكثر ولا أقل؟',
};

/** Child phrases for quick demos (what real kids tend to say). */
export const SAMPLE_PHRASES = [
  'المي بتنزّ من الكاسة لبرّا',
  'الثلج بيذوب وبيطلع من الكاسة',
  'الكاسة بتعرق زيّنا لما نشوب',
  'البرد نفسه بيصير مي',
  'يمكن حدا رشّ عليها مي',
  'من نفَس الناس اللي حواليها',
  'ما بعرف، بتطلع لحالها',
  'في مي بالهوا ما بنشوفها، ولما تلمس الكاسة الباردة بتبرد وبتصير نقط',
];

export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
  /** which link of the chain this question checks */
  link: ChainId;
}

/** Pre-test and post-test are parallel: same links, different situations (transfer). */
export const PRE_TEST: QuizQuestion[] = [
  {
    q: 'حطّينا كاسة مي فيها ثلج على الطاولة، وبعد شوي طلع نقط مي من برّا. من وين إجت النقط؟',
    options: ['نزّت من جوّا الكاسة', 'من الهوا اللي حوالين الكاسة', 'الثلج ذاب وطلع', 'الكاسة بتعرق'],
    correct: 1,
    link: 'C2',
  },
  {
    q: 'لو لوّنّا المي اللي جوّا الكاسة بأزرق، شو لون النقط اللي برّا؟',
    options: ['زرقا', 'شفافة', 'ما بيطلع نقط أصلاً'],
    correct: 1,
    link: 'C2',
  },
  {
    q: 'ليش ما بيطلع نقط على كاسة مي دافية؟',
    options: ['لأنها مش باردة لتبرّد المي اللي بالهوا', 'لأن المي الدافية ما بتنزّ', 'لأنه ما فيها ثلج يذوب'],
    correct: 0,
    link: 'C3',
  },
  {
    q: 'وين بيطلع نقط أكثر على كاسة باردة؟',
    options: ['بغرفة رطبة', 'بمكان ناشف كثير', 'نفس الإشي بكل مكان'],
    correct: 0,
    link: 'C4',
  },
];

export const POST_TEST: QuizQuestion[] = [
  {
    q: 'طلعت من برّا البرد ودخلت مطبخ دافي فيه طبيخ، فغبّشت نظارتك. من وين إجت المي؟',
    options: ['من عيونك', 'من المي اللي بهوا المطبخ', 'من زجاج النظارة نفسه'],
    correct: 1,
    link: 'C2',
  },
  {
    q: 'علبة عصير مسكّرة طالعة من الثلاجة، وطلع عليها نقط. هل النقط عصير؟',
    options: ['آه، العصير نزّ من العلبة', 'لأ، هي مي من الهوا', 'لأ، هي البرد صار مي'],
    correct: 1,
    link: 'C2',
  },
  {
    q: 'كاسة فيها مي بحرارة الغرفة، وكاسة فيها مي وثلج. على أيّ وحدة بيطلع نقط من برّا؟',
    options: ['ع الكاستين نفس الإشي', 'ع اللي فيها ثلج بس', 'ع اللي بحرارة الغرفة بس'],
    correct: 1,
    link: 'C3',
  },
  {
    q: 'الصبح لقيت ندى على العشب. شو اللي صار؟',
    options: ['المطر نزل بالليل', 'مي الهوا بردت على العشب البارد وصارت نقط', 'العشب طلّع مي من جوّا'],
    correct: 1,
    link: 'C5',
  },
];
