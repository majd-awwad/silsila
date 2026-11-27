/**
 * The experiment planner as the teacher decides with it: the suggestion and its reason, what each idea predicts,
 * the alternatives, what was ruled out and why, and a useful move when there is nothing to suggest.
 */
import type { PlanResult, RankedExperiment } from '../../../contracts';
import { useI18n } from '../../../i18n';
import { RESOURCES } from '../../../packs/resources';
import { Notice } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { SectionTitle } from '../components/ui';
import { ideaName } from '../logic/labels';
import { explainChoice, modeAdvice, planFor, predictionRows, rejectedRows, scoreParts, sequenceNames } from '../logic/planView';
import type { RoomTabProps } from './types';

function Facts({ pack, view, ranked, result }: RoomTabProps & { ranked: RankedExperiment; result: PlanResult }) {
  const { t, n, lang } = useI18n();
  const x = pack.experiments.find((e) => e.id === ranked.id)!;
  const rows = predictionRows(pack, ranked, lang);
  return (
    <div className="stack">
      <p className="text-[17px] font-semibold">{t(x.question)}</p>
      <div className="stack !gap-1">
        <h4 className="tc-h3">{t({ ar: 'ليش هالتجربة', en: 'Why this experiment' })}</h4>
        <ul className="tc-bullets text-[14.5px]">{explainChoice(pack, ranked, result, lang).map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>
      {rows.length > 0 && (
        <div className="scroll-x">
          <table className="table tc-table is-stack">
            <caption className="sr-only">{t({ ar: 'توقّع كل فكرة مقابل النموذج العلمي', en: 'What each idea predicts against the reference model' })}</caption>
            <thead>
              <tr>
                <th scope="col">{t({ ar: 'فكرة المتعلّمين', en: 'Learners’ idea' })}</th>
                <th scope="col">{t({ ar: 'العدد', en: 'Learners' })}</th>
                <th scope="col">{t({ ar: 'بتتوقّع', en: 'Predicts' })}</th>
                <th scope="col">{t({ ar: 'النموذج العلمي', en: 'Reference model' })}</th>
                <th scope="col">{t({ ar: 'الأثر على الفكرة', en: 'Effect on the idea' })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td data-label={t({ ar: 'الفكرة', en: 'Idea' })}><strong>{r.title}</strong></td>
                  <td data-label={t({ ar: 'العدد', en: 'Learners' })}><span>{n(r.learners)}</span></td>
                  <td data-label={t({ ar: 'بتتوقّع', en: 'Predicts' })}><span>{r.outcome}</span></td>
                  <td data-label={t({ ar: 'النموذج', en: 'Reference' })}><span>{r.real}</span></td>
                  <td data-label={t({ ar: 'الأثر', en: 'Effect' })}>
                    <span className={`chip ${r.contradicted ? 'chip-probe' : 'chip-real'}`}>
                      <Icon name={r.contradicted ? 'cross' : 'check'} size={13} />
                      {r.contradicted ? t({ ar: 'بتتحدّاها', en: 'Challenged' }) : t({ ar: 'بتصمد', en: 'Holds' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view.meta.settings.mode === 'digital' ? <div className="row !gap-1.5"><span className="chip chip-brand">{t({ ar: 'محاكاة رقمية دون مواد مادية', en: 'Digital simulation without physical materials' })}</span></div> : <div className="row !gap-1.5">
        <span className="chip"><Icon name="clock" size={13} />{n(x.minutes)} {t({ ar: 'دقيقة', en: 'min' })}</span>
        {x.materials.map((m) => <span key={m} className="chip">{t(RESOURCES[m])}</span>)}
        <span className={`chip !whitespace-normal ${x.safety.adult ? 'chip-probe' : ''}`}><Icon name="shield" size={13} />{x.safety.adult ? `${t({ ar: 'بإشراف بالغ', en: 'Adult needed' })}: ` : ''}{t(x.safety.note)}</span>
      </div>}
      <details>
        <summary className="link">{t({ ar: 'كيف انحسب الترتيب', en: 'How the ranking was computed' })}</summary>
        <div className="stack !gap-2 mt-2">
          <div className="tc-score">
            {scoreParts(ranked, lang).map((p) => (
              <div key={p.id} className="contents">
                <span>{p.label} <span className="muted">({t({ ar: 'الوزن', en: 'weight' })} {n(Math.round(p.weight * 100))}٪)</span></span>
                <span className="bar-track" aria-hidden="true">{p.value > 0 && <span className="bar-fill is-real block" style={{ width: `${Math.round(p.value * 100)}%` }} />}</span>
                <b>{n(Math.round(p.value * 100))}{t({ ar: '٪', en: '%' })}</b>
              </div>
            ))}
          </div>
          <p className="text-[14px]">
            {t({ ar: 'مجموع النقاط', en: 'Total score' })}: <b>{n(Math.round(ranked.score * 100))}</b> {t({ ar: 'من ١٠٠', en: 'of 100' })}
            {' · '}{t({ ar: 'إنتروبيا التوقّعات', en: 'Predictive entropy' })}: <b>{n(ranked.entropyBits, 2)}</b> {t({ ar: 'بت', en: 'bits' })}
          </p>
          <p className="help">{t({ ar: 'الإنتروبيا بتقيس قديش أفكار الصف بتختلف على النتيجة. النقاط قاعدة تخطيط، مش قياس لأثر التعلّم.', en: 'Entropy measures how much the class’s ideas disagree about the result. The score is a planning heuristic, not a measured learning effect.' })}</p>
        </div>
      </details>
    </div>
  );
}

export function PlanTab(props: RoomTabProps) {
  const { pack, records, view, act, busy, readOnly, goTab } = props;
  const { t, n, lang } = useI18n();
  const { meta } = view;
  const result = planFor(pack, meta, records);
  // details of any experiment, also one already run or rejected
  const everything = planFor(pack, { ...meta, rejected: [], done: [], settings: { ...meta.settings, minutes: 120, resources: pack.experiments.flatMap((x) => x.materials), supervision: true, grade: 12 } }, records);
  const withinLimits = planFor(pack, { ...meta, rejected: [], done: [] }, records);
  const detail = (id: string) => withinLimits.ranked.find((r) => r.id === id) ?? everything.ranked.find((r) => r.id === id) ?? null;
  const name = (id: string) => pack.experiments.find((x) => x.id === id)?.name[lang] ?? id;
  const approved = meta.experimentId ? detail(meta.experimentId) : null;
  const recommended = result.recommended && result.recommended.id !== meta.experimentId ? result.recommended : null;
  const alternatives = result.ranked.filter((r) => r.id !== meta.experimentId && r.id !== recommended?.id);
  const advice = modeAdvice(pack, result, records, lang);
  const ruledOut = rejectedRows(pack, meta, result, lang);
  const canDecide = !readOnly && meta.phase === 'approve';

  const decide = (id: string, primary: boolean) => canDecide && (
    <div className="row no-print">
      <button type="button" className={`btn ${primary ? 'btn-primary btn-lg' : 'btn-secondary btn-sm'}`} disabled={busy} onClick={() => void act({ type: 'choose', experimentId: id, source: id === recommended?.id ? 'recommended' : 'manual', expectedPhase: meta.phase })}>
        <Icon name="check" size={17} />{id === recommended?.id ? t({ ar: 'اعتمد التجربة المقترحة', en: 'Approve recommended experiment' }) : t({ ar: 'اعتمدها باختيار يدوي', en: 'Approve as manual selection' })}
      </button>
      <button type="button" className={`btn btn-ghost ${primary ? '' : 'btn-sm'}`} disabled={busy} onClick={() => void act({ type: 'reject', experimentId: id, expectedPhase: meta.phase })}>
        <Icon name="cross" size={16} />{t({ ar: 'ارفضوها', en: 'Reject' })}
      </button>
    </div>
  );

  return (
    <div className="stack !gap-5">
      <SectionTitle hint={t({ ar: 'للمعلّم فقط: فيها النتيجة المتوقّعة. لا تعرضوا هالصفحة للصف.', en: 'For the teacher only: it contains the expected result. Do not project this page.' })}>
        {t({ ar: 'مخطّط التجربة', en: 'Experiment planner' })}
      </SectionTitle>

      {approved && (
        <section className="tc-rec is-approved stack">
          <div className="row">
            <span className="chip chip-real"><Icon name="check" size={13} />{t({ ar: 'التجربة المعتمدة', en: 'Approved experiment' })}</span>
            {meta.approvalSource && <span className="chip">{meta.approvalSource === 'manual' ? t({ ar: 'اختيار يدوي', en: 'Manual selection' }) : t({ ar: 'من توصية المخطّط', en: 'From planner recommendation' })}</span>}
            {meta.done.includes(approved.id) && <span className="chip">{t({ ar: 'انعملت', en: 'Already run' })}</span>}
            <h3 className="subtitle flex-1">{name(approved.id)}</h3>
            {canDecide && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act({ type: 'reject', experimentId: approved.id, expectedPhase: meta.phase })}>
                {t({ ar: 'إلغاء الموافقة ورفضها', en: 'Withdraw and reject' })}
              </button>
            )}
          </div>
          <Facts {...props} ranked={approved} result={withinLimits} />
          {canDecide && <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => goTab('test')}>{t({ ar: 'معاينة مشهد التجربة', en: 'Preview the experiment stage' })}</button></div>}
        </section>
      )}

      {advice && !approved && (
        <section className="card stack !gap-3">
          <div className="row">
            <span className="chip chip-idea"><Icon name={result.mode === 'enrich' ? 'spark' : 'question'} size={13} />{records.some((record) => record.events.some((event) => event.type === 'explain')) ? t({ ar: 'لا توجد توصية بعد', en: 'No recommendation yet' }) : t({ ar: 'بانتظار الأدلة التشخيصية', en: 'Awaiting diagnostic evidence' })}</span>
            <h3 className="subtitle">{advice.title}</h3>
          </div>
          <p>{advice.body}</p>
          <div className="tc-grid">
            {advice.prompts.map((p, i) => <div key={i} className="tc-prompt"><span className="label">{p.label}</span>{p.text}</div>)}
          </div>
          {result.ranked.length > 0 && <p className="help">{t({ ar: 'بتقدروا برضو تختاروا تجربة من القائمة تحت.', en: 'You can still choose an experiment from the list below.' })}</p>}
        </section>
      )}

      {recommended && (
        <section className="tc-rec stack">
          <div className="row">
            <span className="chip chip-brand"><Icon name="spark" size={13} />{approved ? t({ ar: 'اقتراح تالي', en: 'Next suggestion' }) : t({ ar: 'التجربة المقترحة', en: 'Recommended' })}</span>
            <h3 className="subtitle flex-1">{name(recommended.id)}</h3>
          </div>
          <Facts {...props} ranked={recommended} result={result} />
          {decide(recommended.id, !approved && meta.phase === 'approve')}
        </section>
      )}

      {result.sequence.length > 1 && (
        <section className="stack !gap-2">
          <h3 className="tc-h3">{t({ ar: 'تسلسل مكمّل: مع بعض بيوصلوا لأفكار أكتر ضمن وقت الحصة', en: 'Complementary sequence: together they reach more ideas within the lesson time' })}</h3>
          <ol className="tc-seq">
            {sequenceNames(pack, result.sequence, lang).map((s, i) => <li key={result.sequence[i]}>{n(i + 1)}. {s}</li>)}
          </ol>
        </section>
      )}

      {result.uncovered.length > 0 && (
        <Notice tone="warn">
          {t({ ar: 'أفكار موجودة وما في تجربة ممكنة بتتحدّاها:', en: 'Ideas present that no feasible experiment can challenge:' })}{' '}
          <b>{result.uncovered.map((id) => ideaName(pack, id)[lang]).join(t({ ar: '، ', en: ', ' }))}</b>. {t({ ar: 'ناقشوها وجاهي.', en: 'Address them in discussion.' })}
        </Notice>
      )}

      {alternatives.length > 0 && (
        <section className="stack !gap-2">
          <h3 className="tc-h3">{t({ ar: 'بدائل ممكنة', en: 'Feasible alternatives' })}</h3>
          {alternatives.map((r) => (
            <details key={r.id} className="tc-alt">
              <summary>
                <span className="flex-1 min-w-0">{name(r.id)}</span>
                <span className="chip">{t({ ar: 'بتتحدّى', en: 'Challenges' })} {n(r.reached)} / {n(result.testable)}</span>
                <span className="chip">{n(r.minutes)} {t({ ar: 'د', en: 'min' })}</span>
              </summary>
              <div className="tc-alt-body">
                <Facts {...props} ranked={r} result={result} />
                {decide(r.id, false)}
              </div>
            </details>
          ))}
        </section>
      )}

      {ruledOut.length > 0 && (
        <section className="stack !gap-2">
          <h3 className="tc-h3">{t({ ar: 'مستبعدة وليش', en: 'Ruled out, with reasons' })}</h3>
          <ul className="tc-plain stack !gap-2">
            {ruledOut.map((r) => (
              <li key={r.id} className="tc-prompt row">
                <div className="flex-1 min-w-0">
                  <strong>{r.name}</strong>
                  <div className="help">{r.reasons.join(' · ')}</div>
                </div>
                {canDecide && r.canChoose && r.id !== meta.experimentId && (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act({ type: 'choose', experimentId: r.id, source: 'manual', expectedPhase: meta.phase })}>
                    {t({ ar: 'اختاروها رغم هيك', en: 'Choose anyway' })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
