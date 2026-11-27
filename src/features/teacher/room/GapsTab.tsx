/** Learning gaps: foundations suspected from what learners said, and what the check questions then showed. */
import { useI18n } from '../../../i18n';
import { EmptyState } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { SectionTitle } from '../components/ui';
import { GAP_LABEL } from '../logic/labels';
import { gapRows } from '../logic/learner';
import type { GapRow } from '../logic/learner';
import type { RoomTabProps } from './types';

const CHIP: Record<GapRow['status'], string> = { persisting: 'chip-probe', confirmed: 'chip-probe', suspected: 'chip-idea', recovered: 'chip-real', rejected: '' };
const MARK: Record<GapRow['status'], 'cross' | 'question' | 'check' | 'replay'> = { persisting: 'replay', confirmed: 'cross', suspected: 'question', recovered: 'check', rejected: 'check' };

export function GapsTab({ pack, records }: RoomTabProps) {
  const { t, n, lang } = useI18n();
  const rows = gapRows(pack, records, lang);
  const counts = (['suspected', 'confirmed', 'persisting', 'recovered', 'rejected'] as const).map((s) => ({ s, count: rows.filter((r) => r.status === s).length }));
  return (
    <div className="stack">
      <SectionTitle hint={t({ ar: 'الاشتباه من كلام المتعلّم بس. ما بنعتبرها ثغرة إلا إذا فشل بسؤال تحقّق.', en: 'A suspicion comes from the learner’s words. It counts as a gap only after a check question fails.' })}>
        {t({ ar: 'ثغرات التعلّم', en: 'Learning gaps' })}
      </SectionTitle>
      {!rows.length ? (
        <EmptyState>
          <strong className="block">{t({ ar: 'ما في اشتباه بثغرة أساسية', en: 'No foundational gap is suspected' })}</strong>
          {records.length
            ? t({ ar: 'ولا شرح من الموجودين بيشير لأساس ناقص حسب قواعد الدرس. هذا مش إثبات إنه ما في ثغرات.', en: 'No explanation here points to a missing foundation under this lesson’s rules. That is not proof there are none.' })
            : t({ ar: 'بتظهر بعد ما المتعلّمين يشرحوا.', en: 'They appear after learners explain.' })}
        </EmptyState>
      ) : (
        <>
          <dl className="tc-strip">
            {counts.map(({ s, count }) => <div key={s}><dt>{t(GAP_LABEL[s])}</dt><dd>{n(count)}</dd></div>)}
          </dl>
          <div className="stack !gap-2">
            {rows.map((g, i) => (
              <details key={`${g.learnerId}-${g.prerequisiteId}`} className="tc-alt" open={i === 0}>
                <summary>
                  <span className="flex-1 min-w-0">{g.alias} · {g.prerequisite}</span>
                  <span className={`chip ${CHIP[g.status]}`}><Icon name={MARK[g.status]} size={13} />{t(GAP_LABEL[g.status])}</span>
                </summary>
                <div className="tc-alt-body">
                  <div className="tc-split is-even">
                    <div className="stack !gap-3">
                      <div>
                        <h4 className="tc-h3">{t({ ar: 'الهدف المتأثّر', en: 'Objective affected' })}</h4>
                        {g.objectives.length ? <ul className="tc-bullets text-[14px]">{g.objectives.map((o) => <li key={o}>{o}</li>)}</ul> : <p className="muted text-[14px]">{t({ ar: 'ما في هدف مربوط مباشرة.', en: 'No objective is linked directly.' })}</p>}
                      </div>
                      <div>
                        <h4 className="tc-h3">{t({ ar: 'الدليل من كلامه', en: 'Evidence in their words' })}</h4>
                        {g.quotes.length ? g.quotes.map((q, k) => <blockquote key={k} className="tc-quote text-[14px]" dir="auto">«{q}»</blockquote>) : <p className="muted text-[14px]">{t({ ar: 'ما في اقتباس محفوظ.', en: 'No quote recorded.' })}</p>}
                      </div>
                      <div>
                        <h4 className="tc-h3">{t({ ar: 'نتائج التحقّق', en: 'Check results' })}</h4>
                        {g.answers.length ? (
                          <ul className="tc-plain stack !gap-1.5 text-[14px]">
                            {g.answers.map((a, k) => (
                              <li key={k} className="flex gap-2 items-start">
                                <span className={`chip ${a.correct ? 'chip-real' : 'chip-probe'}`}><Icon name={a.correct ? 'check' : 'cross'} size={13} />{a.correct ? t({ ar: 'صح', en: 'Correct' }) : t({ ar: 'غلط', en: 'Not correct' })}</span>
                                <span>{a.phase === 'recheck' ? `${t({ ar: 'إعادة', en: 'Recheck' })}: ` : ''}{a.question}</span>
                              </li>
                            ))}
                          </ul>
                        ) : <p className="muted text-[14px]">{t({ ar: 'لسا ما جاوب على أسئلة التحقّق.', en: 'No check question answered yet.' })}</p>}
                      </div>
                    </div>
                    <div className="stack !gap-3">
                      <div className="tc-prompt">
                        <span className="label">{t({ ar: 'نشاط التعافي المقترح', en: 'Recommended recovery activity' })}</span>
                        <strong>{g.recovery.title}</strong> <span className="muted">({n(g.recovery.minutes)} {t({ ar: 'دقيقة', en: 'min' })})</span>
                        <ol className="tc-bullets text-[14px]">{g.recovery.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
                      </div>
                      <div>
                        <h4 className="tc-h3">{t({ ar: 'شو لسا مش مؤكّد', en: 'Remaining uncertainty' })}</h4>
                        <p className="text-[14px]">{g.uncertainty}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
