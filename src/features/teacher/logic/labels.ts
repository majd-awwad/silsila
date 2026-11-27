/** Words the teacher and the projector share: group names, phase names, reasons, errors and stated limits. */
import type { ActivityPlan, L, Lang, Phase, RejectReason, RoomError } from '../../../contracts';
import type { GapStatus } from '../../../brain/evidence';
import type { GroupKind } from '../../../brain/classInsights';
import type { ConceptPack, Subject } from '../../../packs/types';

export const tr = (lang: Lang, ar: string, en: string): string => (lang === 'ar' ? ar : en);

/* ───────── hypothesis groups ───────── */

/** The shape family of a group: always shown as a shape and a word, never as colour alone. */
export type GroupShape = 'real' | 'partial' | 'idea' | 'contra' | 'unclear' | 'waiting';

export function groupShape(key: string): GroupShape {
  if (key === 'correct') return 'real';
  if (key === 'partial') return 'partial';
  if (key === 'contradictory') return 'contra';
  if (key === 'waiting') return 'waiting';
  if (key === 'unclear' || key === '') return 'unclear';
  return 'idea';
}

export const SHAPE_ORDER: GroupShape[] = ['real', 'partial', 'idea', 'contra', 'unclear', 'waiting'];

export const SHAPE_WORD: Record<GroupShape, L> = {
  real: { ar: 'شرح كامل', en: 'Complete explanation' },
  partial: { ar: 'شرح جزئي', en: 'Partial explanation' },
  idea: { ar: 'فكرة بدها اختبار', en: 'Idea to investigate' },
  contra: { ar: 'فيها تناقض', en: 'Contradictory' },
  unclear: { ar: 'لسا مش واضح', en: 'Not yet clear' },
  waiting: { ar: 'بدون جواب', en: 'No answer yet' },
};

export const ideaName = (pack: ConceptPack, id: string): L => pack.ideas[id]?.label ?? { ar: id, en: id };

export function groupTitle(pack: ConceptPack, key: string): L {
  const shape = groupShape(key);
  if (shape !== 'idea') return SHAPE_WORD[shape];
  const names = key.split('+').map((id) => ideaName(pack, id));
  return { ar: names.map((l) => l.ar).join(' + '), en: names.map((l) => l.en).join(' + ') };
}

/** Same order everywhere: reference-like first, then ideas, then what is still unclear; larger first. */
export function orderKeys(a: { key: string; count: number }, b: { key: string; count: number }): number {
  return SHAPE_ORDER.indexOf(groupShape(a.key)) - SHAPE_ORDER.indexOf(groupShape(b.key)) || b.count - a.count || a.key.localeCompare(b.key);
}

/* ───────── phases ───────── */

export const PHASE_NAME: Record<Phase, L> = {
  lobby: { ar: 'الانضمام', en: 'Joining' },
  explain: { ar: 'شرح فردي', en: 'Private explanations' },
  map: { ar: 'خريطة الأفكار', en: 'Idea map' },
  recommend: { ar: 'اقتراح التجربة', en: 'Suggested test' },
  approve: { ar: 'موافقتك', en: 'Your approval' },
  predict: { ar: 'التوقّع', en: 'Predictions' },
  reveal: { ar: 'توقّعات الصف', en: 'Class predictions' },
  experiment: { ar: 'التجربة', en: 'Experiment' },
  observe: { ar: 'النتيجة', en: 'Result' },
  discuss: { ar: 'النقاش', en: 'Peer discussion' },
  revise: { ar: 'شرح جديد', en: 'Explain again' },
  transfer: { ar: 'موقف جديد', en: 'New situation' },
  insight: { ar: 'شو تغيّر', en: 'What changed' },
};

/** What moving into this phase does, told to the teacher before they press the button. */
export const PHASE_DOES: Record<Phase, L> = {
  lobby: { ar: 'المتعلّمين بينضمّوا بالكود. ما في مهمّة لسا.', en: 'Learners join with the code. No task yet.' },
  explain: { ar: 'كل متعلّم بيكتب شرحه لحاله على جهازه. ما حدا بيشوف أفكار غيره.', en: 'Each learner explains privately on their own device. Nobody sees other ideas.' },
  map: { ar: 'خريطة الأفكار بتطلع على الشاشة بدون أسماء. اللي فكرته صارت واضحة ما بيقدر يغيّر شرحه الأول.', en: 'The anonymous idea map appears on the projector. Learners whose idea is clear can no longer change their first explanation.' },
  recommend: { ar: 'بتراجعوا التجربة المقترحة هون. الشاشة بتحكي إنه عم نختار تجربة، بدون ما تسمّيها.', en: 'You review the suggested experiment here. The projector says a test is being chosen without naming it.' },
  approve: { ar: 'قراركم: وافقوا على تجربة أو غيّروها. بدون موافقة ما بيفتح التوقّع.', en: 'Your decision: approve an experiment or change it. Predictions do not open without approval.' },
  predict: { ar: 'التجربة المعتمدة بتطلع للكل، وكل متعلّم بيتوقّع لحاله.', en: 'The approved experiment appears and each learner predicts privately.' },
  reveal: { ar: 'توزيع توقّعات الصف بيطلع على الشاشة بدون أسماء.', en: 'The class distribution of predictions appears on the projector, without names.' },
  experiment: { ar: 'نفّذوا التجربة المشتركة. النتيجة على الشاشة لسا مخبّاية.', en: 'Run the shared experiment. The result on screen stays hidden.' },
  observe: { ar: 'بتنكشف النتيجة، وبتتسجّل جنب توقّع كل متعلّم.', en: 'The result is revealed and recorded next to each learner’s prediction.' },
  discuss: { ar: 'أسئلة نقاش واقتباسات بدون أسماء على الشاشة.', en: 'Discussion prompts and anonymous quotes appear on the projector.' },
  revise: { ar: 'كل متعلّم بيشرح من جديد لحاله.', en: 'Each learner explains again, on their own.' },
  transfer: { ar: 'موقف جديد لكل متعلّم يفسّره.', en: 'Each learner explains a new situation.' },
  insight: { ar: 'الشاشة بتبيّن كيف انتقلت الأفكار من الشرح الأول للشرح الجديد.', en: 'The projector shows how ideas moved from first to revised explanations.' },
};

export const REJECT_LABEL: Record<RejectReason, L> = {
  time: { ar: 'أطول من وقت الحصة', en: 'Longer than the lesson time' },
  materials: { ar: 'مواد ناقصة', en: 'Missing materials' },
  safety: { ar: 'بدها إشراف شخص بالغ', en: 'Needs adult supervision' },
  grade: { ar: 'أعلى من صفّكم', en: 'Above this grade' },
  excluded: { ar: 'مستثناة', en: 'Excluded' },
};

export const GAP_LABEL: Record<GapStatus, L> = {
  not_suspected: { ar: 'ما في اشتباه', en: 'Not suspected' },
  suspected: { ar: 'اشتباه بدون تحقّق', en: 'Suspected, not verified' },
  confirmed: { ar: 'مؤكّدة بسؤال تحقّق', en: 'Confirmed by a check' },
  rejected: { ar: 'انتفت بالتحقّق', en: 'Ruled out by the checks' },
  recovered: { ar: 'تعافى بإعادة التحقّق', en: 'Recovered on recheck' },
  persisting: { ar: 'لسا موجودة', en: 'Still present' },
};

export const GROUP_KIND_LABEL: Record<GroupKind | 'custom', L> = {
  gap: { ar: 'أساس بدّه مراجعة', en: 'Foundation review' },
  idea: { ar: 'فكرة مشتركة', en: 'Shared idea' },
  clarify: { ar: 'توضيح', en: 'Clarification' },
  followup: { ar: 'تثبيت', en: 'Consolidation' },
  enrich: { ar: 'تحدّي', en: 'Challenge' },
  custom: { ar: 'مجموعتكم', en: 'Your group' },
};

export const SUBJECT_LABEL: Record<Subject, L> = {
  science: { ar: 'علوم', en: 'Science' },
  math: { ar: 'رياضيات', en: 'Mathematics' },
};

export const ACTIVITY_LABEL: Record<ActivityPlan['type'], L> = {
  experiment: { ar: 'تجربة', en: 'Experiment' },
  discussion: { ar: 'نقاش', en: 'Discussion' },
  game: { ar: 'لعبة', en: 'Game' },
  peer: { ar: 'تعلّم بين الزملاء', en: 'Peer instruction' },
  worksheet: { ar: 'ورقة عمل', en: 'Worksheet' },
  escape: { ar: 'غرفة هروب', en: 'Escape room' },
  assessment: { ar: 'تقييم تكويني', en: 'Formative assessment' },
};

export const ROOM_ERROR: Record<RoomError, L> = {
  bad_request: { ar: 'الطلب مش مقبول. حدّثوا الصفحة وجرّبوا مرة ثانية.', en: 'The request was not accepted. Refresh and try again.' },
  no_room: { ar: 'هالصف مش موجود أو انتهت صلاحيته.', en: 'This room does not exist or has expired.' },
  room_closed: { ar: 'هالصف مسكّر.', en: 'This room is closed.' },
  forbidden: { ar: 'هالجهاز ما معه صلاحية على هالصف.', en: 'This device is not allowed to manage this room.' },
  room_full: { ar: 'الصف مليان.', en: 'The room is full.' },
  wrong_phase: { ar: 'هالخطوة مش متاحة بهالمرحلة. للتوقّع والتجربة لازم توافقوا على تجربة أول.', en: 'Not available in this phase. Predictions and the experiment need an approved experiment first.' },
  locked: { ar: 'هالإجابة انقفلت.', en: 'This answer is already locked.' },
  rate_limited: { ar: 'طلبات كثيرة بسرعة. استنّوا شوي.', en: 'Too many requests. Wait a moment.' },
  store_failed: { ar: 'الخادم ما قدر يخزّن الصف.', en: 'The server could not store the room.' },
  network: { ar: 'ما في اتصال بالخادم.', en: 'No connection to the server.' },
};

/** Stated on every report and on the transformation views: what these numbers do not show. */
export const LIMITATIONS: L[] = [
  { ar: 'هاي أدلّة فورية من حصة وحدة. ما بتقيس الاحتفاظ بالتعلّم ولا مكسب التعلّم، وما بندّعيهم.', en: 'This is immediate evidence from one lesson. It does not measure retention or learning gains, and no such claim is made.' },
  { ar: 'تصنيف الشرح آلي (ذكاء اصطناعي أو قواعد احتياطية) وممكن يغلط. راجعوا كلام المتعلّم نفسه قبل أي قرار.', en: 'Explanations are classified automatically (AI or offline rules) and can be wrong. Read the learner’s own words before deciding.' },
  { ar: 'النموذج بيمثّل التفكير اللي انحكى بس، وما بيشوف التفكير الداخلي.', en: 'Only reasoning that was expressed is modelled; private thought cannot be observed.' },
  { ar: 'المجموعات مؤقتة لهالحصة، ومش تصنيف لقدرات حدا.', en: 'Groups are temporary for this lesson and are never ability labels.' },
  { ar: 'ترتيب التجارب قاعدة تخطيط واضحة، مش قياس لأثر التعلّم.', en: 'Experiment ranking is a transparent planning rule, not a measure of learning effect.' },
];
