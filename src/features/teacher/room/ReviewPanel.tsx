/**
 * The teacher reads one learner's own words and may move them to another idea group or mark them «unclear».
 * The automatic classification stays in the record; the teacher's decision is stored next to it and wins in every count.
 */
import { useState } from 'react';
import type { LearnerRecord, TeacherOp } from '../../../contracts';
import { correctIdeaId } from '../../../brain/normalise';
import { autoInitialDiagnosis, eventsOf, initialDiagnosis, reviewOf } from '../../../brain/records';
import { useI18n } from '../../../i18n';
import type { ConceptPack } from '../../../packs/types';
import { StatusChip } from '../../../ui/kit';
import { ideaName } from '../logic/labels';

type Choice = string; // 'correct' | 'partial' | 'unclear' | 'idea:<id>'

export function ReviewPanel({ pack, record, act, busy, readOnly }: {
  pack: ConceptPack; record: LearnerRecord; act(op: TeacherOp): Promise<boolean>; busy: boolean; readOnly: boolean;
}) {
  const { t, lang } = useI18n();
  const explain = eventsOf(record, 'explain').filter((e) => e.phase !== 'revise').at(-1);
  const auto = autoInitialDiagnosis(record);
  const current = initialDiagnosis(record);
  const review = explain ? reviewOf(record, explain) : null;
  const correct = correctIdeaId(pack);
  const [choice, setChoice] = useState<Choice>('');
  if (!explain || !auto || !current) return null;
  const wrong = Object.keys(pack.ideas).filter((id) => id !== correct);
  const parse = (value: Choice): Pick<Extract<TeacherOp, { type: 'review' }>, 'outcome' | 'ideaId'> | null =>
    value === 'correct' || value === 'partial' || value === 'unclear' ? { outcome: value }
      : value.startsWith('idea:') ? { outcome: 'idea', ideaId: value.slice(5) } : null;
  const picked = parse(choice);
  const autoIdeas = auto.ideas.map((i) => t(ideaName(pack, i.id))).join(' + ');
  return <section className="card stack" aria-label={t({ ar: 'تصحيح التصنيف', en: 'Correct the classification' })}>
    <h3 className="subtitle">{t({ ar: 'كلامه الأصلي وتصنيفه', en: 'Original words and classification' })}</h3>
    <blockquote dir="auto" lang={lang}>{explain.text}</blockquote>
    <div className="row">
      <span className="muted">{t({ ar: 'التصنيف الآلي:', en: 'Automatic classification:' })}</span>
      <StatusChip status={auto.status} />
      {autoIdeas && <span>{autoIdeas}</span>}
    </div>
    {review && <p className="help" role="status">
      {t({ ar: 'صحّحه المعلّم، وهاد المعتمد بالأعداد والتقارير:', en: 'Corrected by the teacher. This is what the counts and reports use:' })} <StatusChip status={current.status} />{' '}
      {current.ideas.map((i) => t(ideaName(pack, i.id))).join(' + ')}
    </p>}
    {!readOnly && <>
      <label className="field"><span>{t({ ar: 'انقله إلى', en: 'Move to' })}</span>
        <select className="select" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">{t({ ar: 'اختاروا…', en: 'Choose…' })}</option>
          <option value="correct">{t({ ar: 'شرح كامل (علمي)', en: 'Complete scientific explanation' })}</option>
          <option value="partial">{t({ ar: 'شرح جزئي', en: 'Partial explanation' })}</option>
          {wrong.map((id) => <option key={id} value={`idea:${id}`}>{t(ideaName(pack, id))}</option>)}
          <option value="unclear">{t({ ar: 'غير واضح', en: 'Unclear' })}</option>
        </select>
      </label>
      <button type="button" className="btn btn-secondary self-start" disabled={busy || !picked} onClick={() => picked && void act({ type: 'review', participantId: record.id, ...picked }).then((ok) => { if (ok) setChoice(''); })}>
        {t({ ar: 'احفظ قرار المعلّم', en: 'Save the teacher decision' })}
      </button>
      <p className="help">{t({ ar: 'التصنيف الآلي بيضل محفوظ جنب قرارك. لو الطالب كتب شرح جديد بعدين، بينحسب الجديد.', en: 'The automatic result stays stored next to your decision. If the learner writes a newer explanation, the newer one counts.' })}</p>
    </>}
  </section>;
}
