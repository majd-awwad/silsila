/**
 * The learner's side of the live classroom, as pure rules: which single task the phone shows now, what may still be
 * sent (asked of the same room rules the server uses), and kind words for everything that can go wrong.
 */
import type { L, Phase, RoomError, StudentOp, StudentRoomView } from '../contracts';
import { PHASES } from '../contracts';
import { eventsOf, initialDiagnosis } from '../brain/records';
import { checkStudentOp } from '../brain/room';
import type { ConceptPack } from '../packs/types';
import { gapTask } from './gaps';

export const CODE_LENGTH = 6;

/** Accepts what children type: lower case, spaces, dashes and Arabic-Indic digits. */
export function cleanCode(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
}
export const validCode = (code: string): boolean => /^[A-Z2-9]{6}$/.test(code);

export type ClassTask =
  | 'closed' | 'expired' | 'lobby' | 'explain' | 'gap' | 'waiting' | 'predict' | 'predicted' | 'reveal' | 'experiment'
  | 'observe' | 'discuss' | 'revise' | 'transfer' | 'transferred' | 'insight';

/** Exactly one task at a time. */
export function classTask(pack: ConceptPack, view: StudentRoomView, now = Date.now()): ClassTask {
  const { meta, me } = view;
  if (meta.closed) return 'closed';
  if (now > meta.expiresAt) return 'expired';
  const record = me.record;
  switch (meta.phase) {
    case 'lobby': return 'lobby';
    case 'explain': return 'explain';
    case 'map': case 'recommend': case 'approve': {
      // late or unclear learners may still say where they start; everyone else can check a foundation while waiting
      const start = initialDiagnosis(record);
      if (!start || start.status === 'insufficient') return canSend(pack, view, { type: 'explain', text: '-' }) ? 'explain' : 'waiting';
      return gapTask(pack, record) ? 'gap' : 'waiting';
    }
    case 'predict':
      if (!meta.experimentId) return 'waiting';
      return eventsOf(record, 'predict').some((e) => e.experimentId === meta.experimentId) ? 'predicted' : 'predict';
    case 'reveal': return 'reveal';
    case 'experiment': return 'experiment';
    case 'observe': return 'observe';
    case 'discuss': return 'discuss';
    case 'revise': return 'revise';
    case 'transfer': return eventsOf(record, 'transfer').length ? 'transferred' : 'transfer';
    case 'insight': return 'insight';
  }
}

/** Would the room accept this now? The same check the server runs, on this learner's own data. */
export const canSend = (pack: ConceptPack, view: StudentRoomView, op: StudentOp): boolean =>
  checkStudentOp(pack, { meta: view.meta, participants: [view.me] }, view.me.id, op) === null;

/** The room's thirteen phases as six steps a child can follow. */
export const CLASS_STEPS: { label: L; phases: Phase[] }[] = [
  { label: { ar: 'استعداد', en: 'Getting ready' }, phases: ['lobby'] },
  { label: { ar: 'فكرتك', en: 'Your idea' }, phases: ['explain', 'map', 'recommend', 'approve'] },
  { label: { ar: 'توقّعك', en: 'Your prediction' }, phases: ['predict', 'reveal'] },
  { label: { ar: 'التجربة', en: 'The experiment' }, phases: ['experiment', 'observe', 'discuss'] },
  { label: { ar: 'شرح جديد', en: 'Explain again' }, phases: ['revise'] },
  { label: { ar: 'موقف جديد', en: 'A new situation' }, phases: ['transfer', 'insight'] },
];
/** A quick check has three steps for the child: get ready, say the idea, wait for the teacher's decision. */
export const QUICK_STEPS: { label: L; phases: Phase[] }[] = [
  { label: { ar: 'استعداد', en: 'Getting ready' }, phases: ['lobby'] },
  { label: { ar: 'فكرتك', en: 'Your idea' }, phases: ['explain'] },
  { label: { ar: 'قرار المعلّم', en: "The teacher's decision" }, phases: ['map'] },
];
/** Still a quick check: it turns into a discovery lesson as soon as the teacher moves past the class map. */
export const isQuickNow = (meta: { settings: { kind?: 'quick' | 'discovery' | 'homework' }; phase: Phase }): boolean =>
  meta.settings.kind === 'quick' && ['lobby', 'explain', 'map'].includes(meta.phase);
export const stepsFor = (meta: Parameters<typeof isQuickNow>[0]) => (isQuickNow(meta) ? QUICK_STEPS : CLASS_STEPS);
export const classStep = (phase: Phase): number => Math.max(0, CLASS_STEPS.findIndex((s) => s.phases.includes(phase)));
export const phaseOrder = (phase: Phase): number => PHASES.indexOf(phase);

/** errors after which polling this seat is pointless */
export const FATAL_ERRORS: RoomError[] = ['no_room', 'room_closed', 'forbidden'];

export const ROOM_MESSAGES: Record<RoomError | 'expired', L> = {
  no_room: { ar: 'ما لقينا صف بهالرمز. تأكّد من الرمز مع المعلّم. ممكن كمان تكون الحصة خلص وقتها.', en: 'We could not find a class with this code. Check it with your teacher. The class may also have ended.' },
  room_closed: { ar: 'هالحصة خلصت. شكراً على مشاركتك!', en: 'This class has ended. Thank you for taking part!' },
  room_full: { ar: 'الصف مليان. خبّر المعلّم.', en: 'The class is full. Tell your teacher.' },
  wrong_phase: { ar: 'الصف انتقل لخطوة ثانية. هاي الخطوة الجديدة.', en: 'The class has moved to another step. Here is the new one.' },
  locked: { ar: 'جوابك انسجّل من قبل، وما بيتغيّر هلأ.', en: 'Your answer is already saved and cannot change now.' },
  rate_limited: { ar: 'استنّى شوي، وبعدين جرّب كمان مرة.', en: 'Wait a moment, then try again.' },
  forbidden: { ar: 'مقعدك بهالصف ما عاد موجود. ادخل من جديد.', en: 'Your seat in this class is no longer there. Join again.' },
  bad_request: { ar: 'ما انبعت الجواب. جرّب كمان مرة.', en: 'The answer was not sent. Try again.' },
  store_failed: { ar: 'ما قدرنا نحفظ الجواب. جرّب كمان مرة.', en: 'The answer could not be saved. Try again.' },
  network: { ar: 'الاتصال مقطوع. جوابك لسا عندك، جرّب كمان مرة لما يرجع.', en: 'No connection. Your answer is still here: try again when it is back.' },
  expired: { ar: 'خلص وقت هالصف.', en: 'This class has expired.' },
};
