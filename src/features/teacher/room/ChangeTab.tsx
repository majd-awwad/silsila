/** Before → after for the class: how ideas moved, who still needs follow-up, transfer, and the stated limits. */
import { summarise } from '../../../brain/classInsights';
import { transitionsOf } from '../../../brain/room';
import { eventsOf, groupKey, initialDiagnosis, revisedDiagnosis } from '../../../brain/records';
import { useI18n } from '../../../i18n';
import { EmptyState, Notice } from '../../../ui/kit';
import { SectionTitle } from '../components/ui';
import { CHANGE_LABEL, changeTotals, classifyChange } from '../logic/insight';
import type { Change } from '../logic/insight';
import { LIMITATIONS, groupTitle } from '../logic/labels';
import { TransformFlow } from '../viz/TransformFlow';
import type { RoomTabProps } from './types';

const FOLLOW_UP: Change[] = ['persisting', 'new_idea', 'unresolved', 'waiting'];

export function ChangeTab({ pack, records, goTab }: RoomTabProps) {
  const { t, n } = useI18n();
  const moves = transitionsOf(pack, records);
  const totals = changeTotals(moves);
  const summary = summarise(pack, records);
  const transfers = records.flatMap((r) => eventsOf(r, 'transfer').slice(-1));
  const checked = transfers.filter((x) => x.choiceCorrect !== null);
  const allSteps = transfers.filter((x) => x.steps.every((s) => s.met)).length;
  const follow = records.flatMap((r) => {
    const from = initialDiagnosis(r);
    if (!from) return [];
    const to = revisedDiagnosis(r);
    const change = classifyChange(groupKey(pack, from), groupKey(pack, to));
    return FOLLOW_UP.includes(change) ? [{ id: r.id, alias: r.alias, change, now: groupKey(pack, to ?? from) }] : [];
  }).sort((a, b) => FOLLOW_UP.indexOf(a.change) - FOLLOW_UP.indexOf(b.change));
  const noStart = records.length - totals.total;

  return (
    <div className="stack !gap-5">
      <SectionTitle hint={t({ ar: 'من أول شرح لكل متعلّم لشرحه بعد التجربة والنقاش.', en: 'From each learner’s first explanation to the one after the experiment and discussion.' })}>
        {t({ ar: 'قبل وبعد', en: 'Before and after' })}
      </SectionTitle>

      {totals.revised === 0 ? (
        <EmptyState>
          <strong className="block">{t({ ar: 'لسا ما في شروحات جديدة', en: 'No revised explanations yet' })}</strong>
          {t({ ar: 'المقارنة بتظهر لما المتعلّمين يشرحوا من جديد بمرحلة «شرح جديد».', en: 'The comparison appears once learners explain again in the “Explain again” phase.' })}
        </EmptyState>
      ) : (
        <>
          <dl className="tc-strip">
            {(['reached', 'kept', 'partial', 'persisting', 'new_idea', 'unresolved', 'waiting'] as Change[]).filter((c) => totals[c] > 0 || c === 'reached' || c === 'persisting').map((c) => (
              <div key={c}>
                <dt>{t(CHANGE_LABEL[c])}</dt>
                <dd>{n(totals[c])} <small>{t({ ar: `من ${n(totals.total)}`, en: `of ${totals.total}` })}</small></dd>
              </div>
            ))}
          </dl>
          {noStart > 0 && <p className="help">{t({ ar: `${n(noStart)} ما عندهم شرح أول، فمش داخلين بالمقارنة.`, en: `${noStart} have no first explanation and are not part of the comparison.` })}</p>}
          <div className="card"><TransformFlow pack={pack} moves={moves} /></div>
        </>
      )}

      {totals.revised > 0 && (
        <section className="stack !gap-2">
          <h3 className="subtitle">{t({ ar: 'بدهم متابعة', en: 'Need follow-up' })}</h3>
          {follow.length ? (
            <ul className="tc-plain tc-grid">
              {follow.map((f) => (
                <li key={f.id} className="card-flat">
                  <strong>{f.alias}</strong>
                  <div className="text-[14px]">{t(CHANGE_LABEL[f.change])}</div>
                  <div className="help">{t(groupTitle(pack, f.now))}</div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{t({ ar: 'ما في حالات مستمرة أو مش محلولة بهالمقارنة.', en: 'No persisting or unresolved case in this comparison.' })}</p>}
          <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => goTab('groups')}>{t({ ar: 'جهّزوا مجموعات التدخّل', en: 'Prepare intervention groups' })}</button></div>
        </section>
      )}

      <section className="stack !gap-2">
        <h3 className="subtitle">{t({ ar: 'الموقف الجديد', en: 'Transfer to a new situation' })}</h3>
        {summary.transferTried ? (
          <dl className="tc-strip">
            <div><dt>{t({ ar: 'حاولوا', en: 'Attempted' })}</dt><dd>{n(summary.transferTried)} <small>{t({ ar: `من ${n(records.length)}`, en: `of ${records.length}` })}</small></dd></div>
            <div><dt>{t({ ar: 'عبّروا عن كل الحلقات', en: 'Expressed every scientific link' })}</dt><dd>{n(allSteps)}</dd></div>
            <div><dt>{t({ ar: 'سؤال التحقّق صح', en: 'Check question correct' })}</dt><dd>{n(checked.filter((x) => x.choiceCorrect).length)} <small>{t({ ar: `من ${n(checked.length)}`, en: `of ${checked.length}` })}</small></dd></div>
            <div><dt>{t({ ar: 'ظهر التطبيق (واحد من الاثنين)', en: 'Transfer shown (either)' })}</dt><dd>{n(summary.transferShown)}</dd></div>
          </dl>
        ) : <p className="muted">{t({ ar: 'لسا ما حدا جاوب على الموقف الجديد.', en: 'Nobody has answered the new situation yet.' })}</p>}
      </section>

      <Notice tone="warn">
        <ul className="tc-bullets">{LIMITATIONS.slice(0, 3).map((l, i) => <li key={i}>{t(l)}</li>)}</ul>
      </Notice>
    </div>
  );
}
