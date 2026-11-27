/**
 * One learner's report, the same for a live classroom and for lessons recorded on this device: the recommended
 * next step, their own words with the evidence used to read them, predictions, help received, the learning map,
 * what changed and the replay. Everything comes from the learner's event log.
 */
import type { LearnerRecord } from '../../../contracts';
import { ASSIST_LEVEL, transformation } from '../../../brain/evidence';
import { eventsOf } from '../../../brain/records';
import { useI18n } from '../../../i18n';
import type { ConceptPack } from '../../../packs/types';
import { BeforeAfter, DiagnosisChain, LearningDNA, ThinkingReplay } from '../../../ui/Evidence';
import { SourceBadge, StatusChip } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { GAP_LABEL, ideaName } from '../logic/labels';
import { gapRows, nextStep } from '../logic/learner';

export const PHASE_OF_EXPLAIN = {
  initial: { ar: 'الشرح الأول', en: 'First explanation' },
  clarify: { ar: 'توضيح', en: 'Clarification' },
  revise: { ar: 'الشرح الجديد', en: 'Revised explanation' },
} as const;

export function LearnerReport({ pack, record }: { pack: ConceptPack; record: LearnerRecord }) {
  const { t, n, lang } = useI18n();
  const step = nextStep(pack, record, lang);
  const explains = eventsOf(record, 'explain');
  const predictions = eventsOf(record, 'predict');
  const observed = eventsOf(record, 'observe');
  const assists = eventsOf(record, 'assist');
  const gaps = gapRows(pack, [record], lang);
  const outcome = (id: string | null) => (id ? pack.outcomes[id]?.[lang] ?? id : '—');
  const experiment = (id: string | null) => pack.experiments.find((x) => x.id === id)?.name[lang] ?? t({ ar: 'تجربة حرّة', en: 'Free test' });
  const suggested = step.experimentId ? pack.experiments.find((x) => x.id === step.experimentId) : null;
  // predictions whose result has not been shown yet
  const open = predictions.filter((p) => !observed.some((o) => o.experimentId === p.experimentId && o.at >= p.at));

  return (
    <div className="stack">
      <div className="row">
        <span className="chip chip-brand">{t(pack.title)}</span>
        <span className="chip">{t({ ar: 'الصف', en: 'Grade' })} {n(record.grade)}</span>
        <span className="chip">{new Date(record.startedAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
        {record.classCode && <span className="chip"><span dir="ltr">{record.classCode}</span></span>}
        {record.sample && <span className="chip chip-idea">{t({ ar: 'بيانات تجريبية', en: 'Sample data' })}</span>}
      </div>

      <div className="tc-prompt tc-keep">
        <span className="label"><Icon name="next" size={15} className="inline me-1 rtl:-scale-x-100" />{t({ ar: 'الخطوة الجاية المقترحة', en: 'Recommended next step' })}</span>
        <strong className="block">{step.title}</strong>
        <p>{step.detail}</p>
        {suggested && <p className="help">{t({ ar: 'تجربة ممكن تتحدّى الفكرة', en: 'An experiment that can challenge the idea' })}: {t(suggested.name)}</p>}
      </div>

      <section className="stack !gap-2">
        <h3 className="tc-h3">{t({ ar: 'بكلامه، والأدلّة اللي اعتمدنا عليها', en: 'In their words, with the evidence used' })}</h3>
        {!explains.length && <p className="muted">{t({ ar: 'لسا ما في شرح.', en: 'No explanation yet.' })}</p>}
        {explains.map((e, i) => (
          <article key={`${e.at}-${i}`} className="tc-edit-block tc-keep">
            <div className="row">
              <strong>{t(PHASE_OF_EXPLAIN[e.phase])}</strong>
              <StatusChip status={e.diagnosis.status} />
              <SourceBadge source={e.diagnosis.source} reason={e.diagnosis.fallbackReason} />
            </div>
            <blockquote className="tc-quote" dir="auto">«{e.text}»</blockquote>
            {e.diagnosis.ideas.length > 0 && (
              <ul className="tc-plain stack !gap-1 text-[14px]">
                {e.diagnosis.ideas.map((idea) => (
                  <li key={idea.id}><b>{t(ideaName(pack, idea.id))}</b>: <span dir="auto">«{idea.evidence}»</span></li>
                ))}
              </ul>
            )}
            {e.diagnosis.steps.some((s) => s.met) && (
              <ul className="tc-plain stack !gap-1 text-[14px]">
                {e.diagnosis.steps.map((s, k) => (s.met ? (
                  <li key={k} className="flex gap-2 items-start">
                    <span className="chip chip-real"><Icon name="check" size={13} />{t({ ar: 'حلقة علمية', en: 'Scientific link' })} {n(k + 1)}</span>
                    <span dir="auto">«{s.evidence}»</span>
                  </li>
                ) : null))}
              </ul>
            )}
            {e.diagnosis.chain.length > 0 && <DiagnosisChain diagnosis={e.diagnosis} markWrong />}
          </article>
        ))}
      </section>

      <div className="tc-split is-even">
        <section className="stack !gap-2">
          <h3 className="tc-h3">{t({ ar: 'التوقّعات', en: 'Predictions' })}</h3>
          {!observed.length && !open.length && <p className="muted text-[14px]">{t({ ar: 'ما في توقّعات مسجّلة.', en: 'No predictions recorded.' })}</p>}
          <ul className="tc-plain stack !gap-2">
            {observed.map((o, i) => (
              <li key={`${o.at}-${i}`} className="tc-edit-block tc-keep !gap-1 text-[14px]">
                <strong>{experiment(o.experimentId)}</strong>
                <span>{t({ ar: 'توقّعه', en: 'Predicted' })}: {outcome(o.predicted)}</span>
                {o.hypothesis && <span>{t({ ar: 'فكرته بتتوقّع', en: 'Their idea predicts' })}: {outcome(o.hypothesis)}</span>}
                <span>{t({ ar: 'اللي صار', en: 'Observed' })}: <b>{outcome(o.real)}</b></span>
                {o.note && <span dir="auto">{t({ ar: 'ملاحظته', en: 'Their note' })}: «{o.note}»</span>}
              </li>
            ))}
            {open.map((p, i) => (
              <li key={`p${p.at}-${i}`} className="tc-edit-block tc-keep !gap-1 text-[14px]">
                <strong>{experiment(p.experimentId)}</strong>
                <span>{t({ ar: 'توقّعه (مقفول)', en: 'Locked prediction' })}: {outcome(p.outcome)}</span>
                <span className="muted">{t({ ar: 'النتيجة لسا ما انعرضت.', en: 'The result has not been shown yet.' })}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="stack !gap-2">
          <h3 className="tc-h3">{t({ ar: 'المساعدة اللي أخدها', en: 'Help received' })}</h3>
          {!assists.length
            ? <p className="muted text-[14px]">{t({ ar: 'ما في مساعدة مسجّلة.', en: 'No help recorded.' })}</p>
            : (
              <ul className="tc-bullets text-[14px]">
                {assists.map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    {t([
                      { ar: 'سؤال تأمّل', en: 'Reflection question' }, { ar: 'توجيه انتباه', en: 'Attention prompt' }, { ar: 'تلميح مركّز', en: 'Focused clue' },
                      { ar: 'شرح موجّه', en: 'Guided instruction' }, { ar: 'اقتراح طلب المعلّم', en: 'Suggested asking the teacher' },
                    ][a.level - 1])}
                    {a.level >= ASSIST_LEVEL && <span className="chip chip-idea ms-2">{t({ ar: 'بتنحسب مساعدة', en: 'counts as assistance' })}</span>}
                  </li>
                ))}
              </ul>
            )}
          {gaps.length > 0 && (
            <>
              <h3 className="tc-h3">{t({ ar: 'أساسيات', en: 'Foundations' })}</h3>
              <ul className="tc-bullets text-[14px]">
                {gaps.map((g) => <li key={g.prerequisiteId}><b>{g.prerequisite}</b>: {t(GAP_LABEL[g.status])}. <span className="muted">{g.uncertainty}</span></li>)}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="stack !gap-2">
        <h3 className="tc-h3">{t({ ar: 'خريطة الفهم', en: 'Learning DNA' })}</h3>
        <LearningDNA pack={pack} record={record} />
      </section>

      <section className="stack !gap-2">
        <h3 className="tc-h3">{t({ ar: 'قبل وبعد', en: 'Before and after' })}</h3>
        {transformation(record)
          ? <BeforeAfter pack={pack} record={record} />
          : <p className="muted text-[14px]">{t({ ar: 'للمقارنة لازم شرحين على الأقل.', en: 'A comparison needs at least two explanations.' })}</p>}
      </section>

      <ThinkingReplay pack={pack} record={record} />
    </div>
  );
}
