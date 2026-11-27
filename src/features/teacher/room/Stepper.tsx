import { useState } from 'react';
import type { L, Phase, RoomMeta, TeacherOp } from '../../../contracts';
import { useI18n } from '../../../i18n';
import { Icon } from '../../../ui/icons';
import { href } from '../../../router';
import { ConfirmModal, Meter } from '../components/ui';
import { advanceFrom } from '../logic/insight';
import type { Counts } from '../logic/insight';
import { PHASE_DOES, PHASE_NAME } from '../logic/labels';

const stages: L[] = [
  { ar: 'الإعداد', en: 'Prepare' }, { ar: 'الانضمام', en: 'Join' }, { ar: 'اكتشاف أفكار الصف', en: 'Discover class thinking' },
  { ar: 'اختيار التجربة', en: 'Select an experiment' }, { ar: 'التجربة والمراجعة', en: 'Experiment and revise' }, { ar: 'التقييم والمتابعة', en: 'Assess and follow up' },
];
const stageOf: Record<Phase, number> = { lobby: 1, explain: 2, map: 2, recommend: 3, approve: 3, predict: 4, reveal: 4, experiment: 4, observe: 4, discuss: 4, revise: 4, transfer: 5, insight: 5 };

export function Stepper({ phase }: { phase?: Phase }) {
  const { t, n } = useI18n();
  const at = phase ? stageOf[phase] : 0;
  return <ol className="live-steps" aria-label={t({ ar: 'مراحل الحصة', en: 'Classroom stages' })}>
    {stages.map((label, i) => <li key={label.en} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} aria-current={i === at ? 'step' : undefined}>
      <span aria-hidden="true">{i < at ? <Icon name="check" size={15} /> : n(i + 1)}</span>{t(label)}
    </li>)}
  </ol>;
}

const action: Record<Exclude<Phase, 'lobby'>, L> = {
  explain: { ar: 'ابدأ الحصة', en: 'Start lesson' },
  map: { ar: 'راجع أفكار الصف', en: 'Review class thinking' },
  recommend: { ar: 'افتح مخطّط التجربة', en: 'Open experiment planner' },
  approve: { ar: 'انتقل لاعتماد التجربة', en: 'Continue to experiment approval' },
  predict: { ar: 'أرسل سؤال التوقّع', en: 'Send prediction question' },
  reveal: { ar: 'اعرض توقّعات الصف', en: 'Reveal class predictions' },
  experiment: { ar: 'اعرض إعداد التجربة', en: 'Show the experiment setup' },
  observe: { ar: 'شغّل التجربة واعرض النتيجة', en: 'Run the experiment and show results' },
  discuss: { ar: 'افتح النقاش', en: 'Open discussion' },
  revise: { ar: 'اطلب شرحاً جديداً', en: 'Request a revised explanation' },
  transfer: { ar: 'أرسل سؤال التطبيق', en: 'Send transfer question' },
  insight: { ar: 'راجع أدلة التعلّم', en: 'Review learning evidence' },
};

export function NextAction({ meta, counts, busy, act }: {
  meta: RoomMeta; counts: Counts; busy: boolean; act: (op: TeacherOp) => Promise<boolean>;
}) {
  const { t, n } = useI18n();
  const [confirm, setConfirm] = useState<Phase | null>(null);
  const { target, blocked, waiting } = advanceFrom(meta.phase, !!meta.experimentId, counts);
  const progress = { explain: counts.explained, predict: counts.predicted, revise: counts.revised, transfer: counts.transferred };
  const submitted = progress[meta.phase as keyof typeof progress];
  const go = (phase: Phase) => void act({ type: 'phase', phase, expectedPhase: meta.phase, expectedExperiment: meta.experimentId }).then((ok) => { if (ok) setConfirm(null); });
  return <section className="live-now">
    <div className="stack !gap-2">
      <span className="eyebrow">{t({ ar: 'الآن', en: 'Now' })}</span>
      <h2>{t(PHASE_NAME[meta.phase])}</h2>
      <p>{t(PHASE_DOES[meta.phase])}</p>
      {submitted !== undefined
        ? <Meter label={t({ ar: 'أرسلوا الإجابة', en: 'Submitted' })} value={submitted} max={counts.participants} />
        : <strong>{n(counts.participants)} {t({ ar: 'انضمّوا إلى الحصة', en: 'joined the lesson' })}</strong>}
    </div>
    <div className="live-next stack !gap-2">
      <span className="eyebrow">{t({ ar: 'الخطوة التالية', en: 'Next action' })}</span>
      {blocked ? <>
        <p>{t({ ar: 'اعتمد تجربة من المخطّط لإرسال سؤال التوقّع.', en: 'Approve an experiment in the planner to send the prediction question.' })}</p>
        <button className="btn btn-secondary" disabled={busy} onClick={() => setConfirm('revise')}>{t({ ar: 'المتابعة مباشرة إلى الشرح الجديد', en: 'Continue directly to revised explanations' })}</button>
      </> : target && target !== 'lobby' ? <>
        <p>{t(PHASE_DOES[target])}</p>
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => waiting > 0 ? setConfirm(target) : go(target)}>
          <Icon name="next" />{t(action[target])}
        </button>
      </> : <a className="btn btn-primary btn-lg" href={href('/teacher/room/' + meta.code + '/report')}>{t({ ar: 'افتح التقرير وخطة التدخّل', en: 'Open report and intervention plan' })}</a>}
    </div>
    <ConfirmModal open={!!confirm} busy={busy} onClose={() => setConfirm(null)} onConfirm={() => confirm && go(confirm)}
      title={t({ ar: 'متابعة الحصة؟', en: 'Continue the lesson?' })} confirmLabel={t({ ar: 'انتقل الآن', en: 'Continue now' })}>
      {blocked ? t({ ar: 'سيبدأ الشرح الجديد من دون إجراء تجربة مشتركة.', en: 'Revised explanations will open without running a shared experiment.' })
        : waiting > 0 ? t({ ar: `لم يُرسل ${n(waiting)} من المتعلّمين إجابتهم بعد. سيُغلق النشاط الحالي عند الانتقال.`, en: `${waiting} learners have not submitted. Continuing closes the current task.` })
          : t({ ar: 'وصلت جميع الإجابات. يمكنك الانتقال الآن.', en: 'All responses have arrived. You can continue now.' })}
    </ConfirmModal>
  </section>;
}
