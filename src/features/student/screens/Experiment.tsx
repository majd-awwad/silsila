/** The Reality Debugger: choose a test, predict and lock, see both worlds, think about the difference. */
import { useEffect, useState } from 'react';
import type { Conditions, EventOf } from '../../../contracts';
import { conditionsFor, experimentById, experimentConditions, experimentFor, outcomeMatches, sameConditions } from '../../../brain/world';
import {
  choicesFor, conditionsKey, currentDiagnosis, currentExplanation, observationContradicts, observations, shownWrong,
} from '../../../flow/derive';
import { useI18n } from '../../../i18n';
import { reveals } from '../../../mode';
import type { ConceptPack } from '../../../packs/types';
import { ReasonChain } from '../../../ui/Evidence';
import { ExperimentStage } from '../../../ui/ExperimentStage';
import { Icon } from '../../../ui/icons';
import { Segmented } from '../../../ui/kit';
import type { LessonProps } from '../context';
import { useLessonDraft, textDraft } from '../draft';
import { validConditions } from '../../../brain/world';
import { HelpBar } from '../HelpBar';
import { LockChoice, NoorSays, Split, Title, prefersReducedMotion } from '../parts';

/** What differs from the usual setup, in words. */
export function Changes({ pack, cond }: { pack: ConceptPack; cond: Conditions }) {
  const { t } = useI18n();
  const changed = pack.variables.filter((v) => cond[v.id] !== pack.baseline[v.id]);
  if (!changed.length) return <p className="help">{t({ ar: 'التجهيز العادي، بدون أي تغيير.', en: 'The usual setup, with nothing changed.' })}</p>;
  return (
    <div className="row" aria-label={t({ ar: 'شو غيّرنا', en: 'What changed' })} role="group">
      {changed.map((v) => {
        const option = v.options.find((o) => o.id === cond[v.id]);
        return <span key={v.id} className="chip chip-brand">{t(v.label)}: {option ? t(option.label) : cond[v.id]}</span>;
      })}
    </div>
  );
}

/** Their prediction, what their idea predicts, and what happened: side by side. */
export function Compare({ pack, observation }: { pack: ConceptPack; observation: EventOf<'observe'> }) {
  const { t } = useI18n();
  const { predicted, hypothesis, real } = observation;
  const verdict = (value: string) => {
    const same = outcomeMatches(pack, value, real);
    return (
      <span className={`chip self-start ${same ? 'chip-real' : 'chip-probe'}`}>
        <Icon name={same ? 'check' : 'cross'} size={13} />{same ? t({ ar: 'متل اللي صار', en: 'Matches' }) : t({ ar: 'مختلف', en: 'Differs' })}
      </span>
    );
  };
  return (
    <dl className="sl-compare">
      {predicted && <div className="is-you"><dt>{t({ ar: 'توقّعك', en: 'Your prediction' })}</dt><dd>{t(pack.outcomes[predicted])}</dd>{verdict(predicted)}</div>}
      {hypothesis && <div className="is-idea"><dt>{t({ ar: 'فكرتك بتتوقّع', en: 'Your idea predicts' })}</dt><dd>{t(pack.outcomes[hypothesis])}</dd>{verdict(hypothesis)}</div>}
      <div className="is-real"><dt>{t({ ar: 'نتيجة المحاكاة العلمية', en: 'Scientific simulation result' })}</dt><dd>{t(pack.outcomes[real])}</dd></div>
    </dl>
  );
}

export function Hypothesis(props: LessonProps) {
  const { pack, journey, dispatch, busy } = props;
  const { t } = useI18n();
  const { record } = journey;
  const idea = currentDiagnosis(record);
  const explanation = currentExplanation(record);
  const suggested = experimentById(pack, journey.experimentId);
  const [own, setOwn] = useLessonDraft('own', !suggested, (value): value is boolean => typeof value === 'boolean');
  const [custom, setCustom] = useLessonDraft<Conditions>('setup', suggested ? conditionsFor(pack) : journey.cond,
    (value): value is Conditions => !!value && typeof value === 'object' && validConditions(pack, value as Conditions));
  const cond = own || !suggested ? custom : experimentConditions(pack, suggested.id);
  const changed = !sameConditions(custom, conditionsFor(pack)) || !!experimentFor(pack, custom);
  const tried = observations(record).some((o) => conditionsKey(o.cond) === conditionsKey(cond));
  const tested = observations(record).length > 0;
  const latest = record.events.at(-1);
  const afterGap = latest?.type === 'prereq';
  const unresolved = latest?.type === 'prereq' && latest.phase === 'recheck' && !latest.correct;
  const mark = !!explanation && reveals({ judge: false, contradicted: shownWrong(pack, record, explanation) }).wrongStep;
  const line = unresolved
    ? { ar: 'هالفكرة لسا بدها شوي وقت. بتقدر تسأل معلّمك، ومنكمّل التجربة سوا.', en: 'This idea still needs some time. You can ask your teacher and keep exploring with me.' }
    : afterGap ? { ar: 'شكراً! هلأ نرجع للتجربة.', en: 'Thank you! Now back to the experiment.' }
    : !idea ? { ar: 'خلّينا نشوف شو بيصير، وبعدين بتحكيلي رأيك.', en: 'Let us see what happens, then tell me what you think.' }
      : tested ? { ar: 'شو منجرّب هالمرة؟', en: 'What shall we test this time?' }
        : { ar: 'هاد عالم فكرتك. يلا نمتحنها بتجربة.', en: 'This is your idea’s world. Let us put it to a test.' };
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'التجربة', en: 'The experiment' })}>{idea ? t({ ar: 'امتحن فكرتك', en: 'Test your idea' }) : t({ ar: 'يلا نجرّب', en: 'Let us experiment' })}</Title>
        <NoorSays mood="curious" text={t(line)} />
        {idea && idea.chain.length > 0 && (
          <div className="card-flat stack !gap-2">
            <h2 className="label">{t({ ar: 'سلسلة تفكيرك', en: 'Your chain of thinking' })}</h2>
            <ReasonChain steps={idea.chain} wrongStep={mark ? idea.wrongStep : null} />
          </div>
        )}
        {suggested && !own && (
          <section className="card stack !gap-3 rise">
            <span className="chip chip-brand self-start"><Icon name="flask" size={14} />{t({ ar: 'تجربة بقترحها', en: 'A test I suggest' })}</span>
            <h2 className="subtitle">{t(suggested.name)}</h2>
            <p className="muted">{t(suggested.short)}</p>
            {idea?.model && <p className="help">{idea.model.path === 'filters_dye'
              ? t({ ar: 'جرّب تغيّر اللي جوّا الكاسة لتفحص إذا فكرتك بتحتاج مي جوّا أصلاً.', en: 'Change what is inside the glass to test whether your idea needs water inside at all.' })
              : t({ ar: 'خلّينا نغيّر هالجزء ونشوف إذا فكرتك بتتوقّع نفس نتيجة المحاكاة.', en: 'Change this part and see whether your idea predicts what the simulation shows.' })}</p>}
            <Changes pack={pack} cond={cond} />
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => dispatch({ type: 'choose', experimentId: suggested.id, cond })}>
              {t({ ar: 'جرّب هاي', en: 'Try this one' })}<Icon name="next" />
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOwn(true)}><Icon name="edit" />{t({ ar: 'بدي أصمّم تجربتي', en: 'Test my own' })}</button>
          </section>
        )}
        {(own || !suggested) && (
          <section className="card sl-builder rise">
            <h2 className="subtitle">{t({ ar: 'تجربتي', en: 'My experiment' })}</h2>
            <p className="help">{t({ ar: 'غيّر إشي واحد أو أكتر، وبعدين توقّع.', en: 'Change one or more things, then predict.' })}</p>
            {pack.variables.map((v) => (
              <fieldset key={v.id}>
                <legend className="label">{t(v.label)}</legend>
                <Segmented label={t(v.label)} value={custom[v.id]} options={v.options.map((o) => ({ id: o.id, label: t(o.label) }))}
                  onChange={(id) => setCustom({ ...custom, [v.id]: id })} />
              </fieldset>
            ))}
            {tried && <p className="help" role="status">{t({ ar: 'جرّبت هاي قبل. بتقدر تعيدها أو تغيّر إشي.', en: 'You have tried this one. Repeat it or change something.' })}</p>}
            <button type="button" className="btn btn-primary btn-lg" disabled={busy || !changed} onClick={() => dispatch({ type: 'choose', experimentId: null, cond: custom })}>
              {t({ ar: 'توقّع على تجربتي', en: 'Predict my experiment' })}<Icon name="next" />
            </button>
            {!changed && <p className="help">{t({ ar: 'غيّر إشي واحد على الأقل.', en: 'Change at least one thing.' })}</p>}
            {suggested && <button type="button" className="btn btn-ghost" onClick={() => setOwn(false)}>{t({ ar: 'ارجع للتجربة المقترحة', en: 'Back to the suggested test' })}</button>}
          </section>
        )}
        {tested && (
          <div className="sl-actions">
            <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'toRevise' })}><Icon name="edit" />{t({ ar: 'غيّر شرحك', en: 'Revise your explanation' })}</button>
            <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'toTeach' })}><Icon name="cap" />{t({ ar: 'علّم نور', en: 'Teach Noor' })}</button>
            {record.finishedAt && <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'toSummary' })}>{t({ ar: 'رجوع للملخّص', en: 'Back to the summary' })}</button>}
          </div>
        )}
        <HelpBar {...props} />
      </>}
      show={<ExperimentStage pack={pack} cond={cond} model={idea?.model ?? null} revealed={false} ideaLabel={t({ ar: 'عالم فكرتك', en: 'Your idea’s world' })} />}
    />
  );
}

export function Predict({ pack, journey, dispatch }: LessonProps) {
  const { t } = useI18n();
  const x = experimentById(pack, journey.experimentId);
  const question = x ? t(x.question) : t({ ar: 'بهالتجربة، شو بتتوقّع يصير؟', en: 'In this experiment, what do you think will happen?' });
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'توقّع قبل ما تشوف', en: 'Predict before you look' })}>{x ? t(x.name) : t({ ar: 'تجربتي', en: 'My experiment' })}</Title>
        <NoorSays mood="thinking" text={question} />
        <Changes pack={pack} cond={journey.cond} />
        <LockChoice draftField={'prediction:' + conditionsKey(journey.cond)} lock label={question} options={choicesFor(pack, journey.experimentId).map((id) => ({ id, label: t(pack.outcomes[id]) }))}
          submit={t({ ar: 'ثبّت توقّعي', en: 'Lock my prediction' })} onSubmit={(outcome) => dispatch({ type: 'predict', outcome, at: Date.now() })} />
        <p className="help">{t({ ar: 'بعد ما تثبّت توقّعك ما بيتغيّر. مش لازم يطلع صح: المهم نشوف.', en: 'A locked prediction cannot change. It does not have to be right: what matters is finding out.' })}</p>
        <button type="button" className="btn btn-ghost self-start sl-touch" onClick={() => dispatch({ type: 'unchoose' })}><Icon name="back" />{t({ ar: 'غيّر التجربة', en: 'Change the experiment' })}</button>
      </>}
      show={<ExperimentStage pack={pack} cond={journey.cond} model={currentDiagnosis(journey.record)?.model ?? null} revealed={false} ideaLabel={t({ ar: 'عالم فكرتك', en: 'Your idea’s world' })} />}
    />
  );
}

export function Reveal({ pack, journey, dispatch }: LessonProps) {
  const { t } = useI18n();
  const seen = observations(journey.record).at(-1)!;
  // a short wait after locking; none after a refresh or with reduced motion
  const [running, setRunning] = useState(() => !prefersReducedMotion() && Date.now() - seen.at < 1500);
  const [note, setNote] = useLessonDraft('observation', seen.note, textDraft);
  const [reason, setReason] = useLessonDraft('prediction-reason', seen.predictionReason ?? '', textDraft);
  const changedPrediction = !!seen.predicted && !!seen.hypothesis && seen.predicted !== seen.hypothesis;
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setRunning(false), 1600);
    return () => clearTimeout(timer);
  }, [running]);
  const surprised = observationContradicts(pack, seen) || (!!seen.predicted && !outcomeMatches(pack, seen.predicted, seen.real));
  const next = () => {
    if (note !== seen.note || reason !== (seen.predictionReason ?? '')) dispatch({ type: 'note', text: note, predictionReason: reason });
    dispatch({ type: 'continue', at: Date.now() });
  };
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'النتيجة', en: 'The result' })}>{running ? t({ ar: 'عم نجرّب…', en: 'Running the test…' }) : t({ ar: 'شو لاحظت بالمحاكاة؟', en: 'What did you notice in the simulation?' })}</Title>
        <NoorSays mood={running ? 'thinking' : surprised ? 'surprised' : 'discovering'}
          text={running ? t({ ar: 'يلا نشوف…', en: 'Let us see…' })
            : surprised ? t({ ar: 'أوه! قارن بين التلاتة: شو الفرق؟', en: 'Oh! Compare the three: what is different?' })
              : t({ ar: 'قارن بين اللي توقّعته واللي صار.', en: 'Compare what you expected with what happened.' })} />
        {running ? (
          <div className="sl-running" role="status">
            <span className="sl-linking" aria-hidden="true"><i /><i /><i /></span>
            {t({ ar: 'العالمين بيشتغلوا', en: 'Both worlds are running' })}
          </div>
        ) : (
          <div className="stack rise">
            <Compare pack={pack} observation={seen} />
            {changedPrediction && <label className="field">
              <span className="label">{t({ ar: 'توقّعك غير اللي بتتوقّعه فكرتك الأولى. شو اللي خلاك تختار هيك؟', en: 'Your prediction differs from what your earlier idea predicts. What led you to choose it?' })}</span>
              <textarea className="textarea" dir="auto" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>}
            <label className="field">
              <span className="label">{t({ ar: 'ملاحظتي (إذا بدك)', en: 'My observation (optional)' })}</span>
              <textarea className="textarea" dir="auto" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary btn-lg" onClick={next}>{t({ ar: 'فكّر مع نور', en: 'Think it over with Noor' })}<Icon name="next" /></button>
          </div>
        )}
      </>}
      show={<ExperimentStage pack={pack} cond={seen.cond} model={currentDiagnosis(journey.record)?.model ?? null} revealed={!running} ideaLabel={t({ ar: 'عالم فكرتك', en: 'Your idea’s world' })} />}
    />
  );
}

export function Reflect(props: LessonProps) {
  const { pack, journey, dispatch } = props;
  const { t } = useI18n();
  const { record } = journey;
  const seen = observations(record).at(-1)!;
  const idea = currentDiagnosis(record);
  const explanation = currentExplanation(record);
  const contradicted = observationContradicts(pack, seen);
  const complete = idea?.status === 'correct' || idea?.status === 'partial';
  const mark = !!explanation && reveals({ judge: false, contradicted: shownWrong(pack, record, explanation) }).wrongStep;
  const line = contradicted ? t(pack.noor.afterContradiction) : complete ? t(pack.noor.afterMatch) : idea ? t(pack.noor.sameResult)
    : t({ ar: 'هلأ بعد ما شفت، احكيلي: شو بتفكّر؟', en: 'Now that you have seen it, tell me: what do you think?' });
  const primary = !idea || contradicted ? 'revise' : complete ? 'teach' : 'test';
  const actions = [
    { id: 'test', icon: 'flask' as const, label: t({ ar: 'تجربة تانية', en: 'Another experiment' }), run: () => dispatch({ type: 'toTest' }) },
    { id: 'revise', icon: 'edit' as const, label: idea ? t({ ar: 'بدي أغيّر شرحي', en: 'Revise my explanation' }) : t({ ar: 'بدي أشرح', en: 'I want to explain' }), run: () => dispatch({ type: 'toRevise' }) },
    { id: 'teach', icon: 'cap' as const, label: t({ ar: 'علّم نور', en: 'Teach Noor' }), run: () => dispatch({ type: 'toTeach' }) },
  ].sort((a, b) => Number(b.id === primary) - Number(a.id === primary));
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'وقت التفكير', en: 'Thinking time' })}>{contradicted ? t({ ar: 'فكرتك توقّعت إشي تاني', en: 'Your idea expected something else' }) : t({ ar: 'شو بيعني هاد؟', en: 'What does this tell us?' })}</Title>
        <NoorSays mood={contradicted ? 'surprised' : 'encouraging'} text={line} />
        {idea && idea.chain.length > 0 && (
          <div className="card-flat stack !gap-2">
            <h2 className="label">{mark ? t({ ar: 'الحلقة اللي بعلامة سؤال بدها تفكير', en: 'The link with a question mark needs another look' }) : t({ ar: 'سلسلة تفكيرك', en: 'Your chain of thinking' })}</h2>
            <ReasonChain steps={idea.chain} wrongStep={mark ? idea.wrongStep : null} />
          </div>
        )}
        <Compare pack={pack} observation={seen} />
        <div className="sl-actions">
          {actions.map((a) => (
            <button key={a.id} type="button" className={`btn ${a.id === primary ? 'btn-primary btn-lg' : 'btn-secondary'}`} onClick={a.run}><Icon name={a.icon} />{a.label}</button>
          ))}
          {record.finishedAt && <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'toSummary' })}>{t({ ar: 'رجوع للملخّص', en: 'Back to the summary' })}</button>}
        </div>
        <HelpBar {...props} />
      </>}
      show={<ExperimentStage pack={pack} cond={seen.cond} model={idea?.model ?? null} revealed ideaLabel={t({ ar: 'عالم فكرتك', en: 'Your idea’s world' })} />}
    />
  );
}
