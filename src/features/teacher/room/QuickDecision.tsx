/** The end of a quick check: a decision the teacher can act on now. Nothing forces an experiment. */
import { useState } from 'react';
import type { LearnerRecord, RoomMeta, TeacherOp } from '../../../contracts';
import { useI18n } from '../../../i18n';
import type { ConceptPack } from '../../../packs/types';
import { navigate } from '../../../router';
import { Icon } from '../../../ui/icons';
import { ConfirmModal } from '../components/ui';
import { quickDecision } from '../logic/decision';

export function QuickDecision({ pack, meta, records, busy, act }: {
  pack: ConceptPack; meta: RoomMeta; records: LearnerRecord[]; busy: boolean; act: (op: TeacherOp) => Promise<boolean>;
}) {
  const { t, n } = useI18n();
  const [closing, setClosing] = useState(false);
  const d = quickDecision(pack, records);
  const close = () => void act({ type: 'close' }).then((ok) => { if (ok) navigate(`/teacher/room/${meta.code}/report`); });
  return <section className="live-now" aria-label={t({ ar: 'قرار التحقق السريع', en: 'Quick-check decision' })}>
    <div className="stack !gap-2">
      <span className="eyebrow">{t({ ar: 'تحقّق سريع · القرار', en: 'Quick check · decision' })}</span>
      <h2>{d.headline
        ? t({ ar: `أعيد شرح: ${d.headline.what.ar}`, en: `Explain again: ${d.headline.what.en}` })
        : t({ ar: 'ما في إشي لازم تعيد شرحه هلأ', en: 'Nothing needs explaining again right now' })}</h2>
      <p>{t({ ar: `${n(d.explained)} من ${n(d.total)} شرحوا بكلامهم.`, en: `${d.explained} of ${d.total} explained in their own words.` })}
        {d.waiting > 0 && ' ' + t({ ar: `${n(d.waiting)} لسا ما أرسلوا.`, en: `${d.waiting} have not sent yet.` })}</p>
      {d.headline && <p><strong>{t({ ar: 'لمين: ', en: 'For: ' })}</strong>{t({ ar: `${n(d.headline.count)} من الطلاب`, en: `${d.headline.count} learners` })}
        {d.headline.next && <> · <strong>{t({ ar: 'السؤال أو النشاط الجاي: ', en: 'Next question or activity: ' })}</strong>{t(d.headline.next)}</>}</p>}
    </div>
    <div className="live-next stack !gap-2">
      <span className="eyebrow">{t({ ar: 'قرارك', en: 'Your decision' })}</span>
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => setClosing(true)}><Icon name="check" />{t({ ar: 'خلّصت التحقق، سكّره واعرض التقرير', en: 'Finish the check and open the report' })}</button>
      <button className="btn btn-secondary" disabled={busy} onClick={() => void act({ type: 'phase', phase: 'recommend', expectedPhase: meta.phase, expectedExperiment: meta.experimentId })}>
        {t({ ar: 'كمّل لحصة اكتشاف كاملة من نفس الغرفة', en: 'Continue to a full discovery lesson in this room' })}
      </button>
    </div>
    {d.items.length > 0 && <ul className="tc-plain stack !gap-2" style={{ gridColumn: '1 / -1' }}>
      {d.items.map((i) => <li key={i.id} className="card-flat stack !gap-1">
        <strong>{t(i.title)} · {t({ ar: `${n(i.members.length)} طلاب`, en: `${i.members.length} learners` })}</strong>
        <span className="help">{i.members.join(' · ')}</span>
        <span>{t(i.move)}</span>
        {i.question && <span className="help">{t({ ar: 'سؤال للصف: ', en: 'Question for the class: ' })}{t(i.question)}</span>}
        {i.activity && <span className="help">{t({ ar: 'نشاط مقترح (اختياري): ', en: 'Suggested activity (optional): ' })}{t(i.activity)}</span>}
      </li>)}
    </ul>}
    <ConfirmModal open={closing} busy={busy} onClose={() => setClosing(false)} onConfirm={close}
      title={t({ ar: 'نسكّر التحقق السريع؟', en: 'Close the quick check?' })} confirmLabel={t({ ar: 'سكّر واعرض التقرير', en: 'Close and open the report' })}>
      {t({ ar: 'ما رح نشغّل تجربة. الطلاب ما بقدروا يبعتوا بعدها، والتقرير بيضل متاح.', en: 'No experiment will run. Learners can no longer submit; the report stays available.' })}
    </ConfirmModal>
  </section>;
}
