/** The shared test: locked predictions, the experiment beside a chosen idea, the result and what to talk about. */
import { useState } from 'react';
import { aggregates, atLeast, groupsOf } from '../../../brain/room';
import { eventsOf, groupKey, initialDiagnosis } from '../../../brain/records';
import { experimentConditions } from '../../../brain/world';
import { useI18n } from '../../../i18n';
import { ExperimentStage } from '../../../ui/ExperimentStage';
import { Bar, EmptyState, Notice, Segmented } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { SectionTitle } from '../components/ui';
import { closingQuestion, discussionPrompts, modelForGroup, predictionTally } from '../logic/insight';
import { groupTitle, orderKeys } from '../logic/labels';
import type { RoomTabProps } from './types';

export function TestTab({ pack, view, records, goTab }: RoomTabProps) {
  const { t, n, lang } = useI18n();
  const { meta } = view;
  const [chosen, setChosen] = useState<string | null>(null);
  const experiment = pack.experiments.find((x) => x.id === meta.experimentId) ?? null;

  if (!experiment) {
    return (
      <EmptyState action={<button type="button" className="btn btn-primary" onClick={() => goTab('plan')}><Icon name="flask" />{t({ ar: 'روحوا على المخطّط', en: 'Go to the planner' })}</button>}>
        <strong className="block">{t({ ar: 'ما في تجربة معتمدة', en: 'No approved experiment' })}</strong>
        {t({ ar: 'وافقوا على تجربة مشتركة عشان يفتح التوقّع.', en: 'Approve a shared experiment to open predictions.' })}
      </EmptyState>
    );
  }

  const revealed = atLeast(meta.phase, 'observe');
  const tally = predictionTally(pack, records, experiment.id);
  const predicted = tally.reduce((s, x) => s + x.count, 0);
  const result = aggregates(pack, view).result;
  const initial = groupsOf(pack, records, 'initial', true).sort(orderKeys);
  const withModel = initial.filter((g) => modelForGroup(pack, g.key, g.ideas));
  const focus = withModel.find((g) => g.key === chosen)
    ?? withModel.find((g) => result?.byGroup.find((b) => b.key === g.key)?.contradicted)
    ?? [...withModel].sort((a, b) => Number(a.key === 'correct') - Number(b.key === 'correct') || b.count - a.count)[0] ?? null;
  const outcome = (id: string) => pack.outcomes[id]?.[lang] ?? id;
  const prompts = discussionPrompts(pack, initial, result, lang);
  const notes = records.flatMap((r) => eventsOf(r, 'observe').filter((e) => e.experimentId === experiment.id && e.note.trim()).map((e) => e.note));
  // predictions of each starting idea, so the teacher sees who expects what
  const byIdea = initial.map((g) => {
    const mine = records.filter((r) => groupKey(pack, initialDiagnosis(r)) === g.key);
    return { key: g.key, count: g.count, tally: predictionTally(pack, mine, experiment.id) };
  });

  return (
    <div className="stack !gap-5">
      <SectionTitle hint={t(experiment.question)}>{t(experiment.name)}</SectionTitle>

      <section className="card stack">
        <div className="row">
          <h3 className="subtitle flex-1">{t({ ar: 'توقّعات الصف', en: 'Class predictions' })}</h3>
          <span className="chip chip-brand" role="status">{t({ ar: `${n(predicted)} من ${n(records.length)} توقّعوا`, en: `${predicted} of ${records.length} predicted` })}</span>
          {!atLeast(meta.phase, 'reveal') && <span className="chip"><Icon name="lock" size={13} />{t({ ar: 'مش على الشاشة لسا', en: 'Not on the projector yet' })}</span>}
        </div>
        {tally.map((x) => (
          <Bar key={x.outcome} label={outcome(x.outcome)} value={x.count} max={Math.max(1, records.length)}
            tone={revealed && result?.outcome === x.outcome ? 'real' : 'idea'}
            note={revealed && result?.outcome === x.outcome ? <><Icon name="check" size={12} className="inline" /> {t({ ar: 'اللي صار', en: 'Observed result' })}</> : undefined} />
        ))}
        {predicted > 0 && (
          <details>
            <summary className="link">{t({ ar: 'التوقّعات حسب الفكرة الأولى', en: 'Predictions by starting idea' })}</summary>
            <div className="scroll-x mt-2">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t({ ar: 'الفكرة', en: 'Idea' })}</th>
                    {experiment.choices.map((c) => <th scope="col" key={c}>{outcome(c)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {byIdea.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="!text-ink !text-[14px] !whitespace-normal">{t(groupTitle(pack, row.key))} <span className="muted">({n(row.count)})</span></th>
                      {experiment.choices.map((c) => <td key={c}>{n(row.tally.find((x) => x.outcome === c)?.count ?? 0)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <section className="stack">
        <div className="row">
          <h3 className="subtitle flex-1">{t({ ar: 'التجربة المشتركة', en: 'Shared experiment' })}</h3>
          {withModel.length > 1 && (
            <Segmented label={t({ ar: 'أي فكرة جنب الواقع', en: 'Which idea beside reality' })} value={focus?.key ?? ''} onChange={setChosen}
              options={withModel.map((g) => ({ id: g.key, label: t(groupTitle(pack, g.key)) }))} />
          )}
        </div>
        {!revealed && <Notice tone="warn">{t({ ar: 'النتيجة بتنكشف هون وعلى الشاشة بس بمرحلة «النتيجة».', en: 'The result is revealed here and on the projector only from the “Result” phase.' })}</Notice>}
        <ExperimentStage pack={pack} cond={experimentConditions(pack, experiment.id)} revealed={revealed}
          model={focus ? modelForGroup(pack, focus.key, focus.ideas) : null}
          ideaLabel={focus ? t(groupTitle(pack, focus.key)) : undefined} />
      </section>

      {result && (
        <section className="stack !gap-2">
          <h3 className="subtitle">{t({ ar: 'كل فكرة: توقّعت وشو صار', en: 'Each idea: predicted and observed' })}</h3>
          <div className="scroll-x">
            <table className="table tc-table is-stack">
              <thead>
                <tr>
                  <th scope="col">{t({ ar: 'الفكرة', en: 'Idea' })}</th>
                  <th scope="col">{t({ ar: 'العدد', en: 'Learners' })}</th>
                  <th scope="col">{t({ ar: 'الفكرة بتتوقّع', en: 'Idea predicts' })}</th>
                  <th scope="col">{t({ ar: 'اللي صار', en: 'Observed' })}</th>
                  <th scope="col">{t({ ar: 'النتيجة على الفكرة', en: 'Outcome for the idea' })}</th>
                </tr>
              </thead>
              <tbody>
                {result.byGroup.map((g) => (
                  <tr key={g.key}>
                    <td data-label={t({ ar: 'الفكرة', en: 'Idea' })}><strong>{t(groupTitle(pack, g.key))}</strong></td>
                    <td data-label={t({ ar: 'العدد', en: 'Learners' })}><span>{n(g.count)}</span></td>
                    <td data-label={t({ ar: 'بتتوقّع', en: 'Predicts' })}><span>{outcome(g.outcome)}</span></td>
                    <td data-label={t({ ar: 'اللي صار', en: 'Observed' })}><span>{outcome(result.outcome)}</span></td>
                    <td data-label={t({ ar: 'النتيجة', en: 'Outcome' })}>
                      <span className={`chip ${g.contradicted ? 'chip-probe' : 'chip-real'}`}>
                        <Icon name={g.contradicted ? 'cross' : 'check'} size={13} />
                        {g.contradicted ? t({ ar: 'اختلفت', en: 'Differs' }) : t({ ar: 'صمدت هون', en: 'Holds here' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section className="stack !gap-2">
          <h3 className="tc-h3">{t({ ar: 'ملاحظات المتعلّمين على النتيجة (بدون أسماء)', en: 'Learners’ observation notes (no names)' })}</h3>
          {[...notes].sort().map((note, i) => <blockquote key={i} className="tc-quote" dir="auto">«{note}»</blockquote>)}
        </section>
      )}

      {prompts.length > 0 && (
        <section className="stack !gap-3">
          <h3 className="subtitle">{t({ ar: 'أسئلة للنقاش', en: 'Discussion prompts' })}</h3>
          <div className="tc-grid">
            {prompts.map((p) => (
              <article key={p.key} className="card-flat stack !gap-2">
                <div className="row">
                  <strong className="flex-1">{p.title}</strong>
                  <span className="chip">{n(p.learners)}</span>
                </div>
                <p>{p.question}</p>
                {p.move && <p className="help">{t({ ar: 'تدخّل', en: 'Move' })}: {p.move}</p>}
                {p.quotes.map((q, i) => <blockquote key={i} className="tc-quote text-[14px]" dir="auto">«{q}»</blockquote>)}
              </article>
            ))}
          </div>
          <p className="tc-prompt"><span className="label">{t({ ar: 'سؤال ختامي', en: 'Closing question' })}</span>{closingQuestion(lang)}</p>
        </section>
      )}
    </div>
  );
}
