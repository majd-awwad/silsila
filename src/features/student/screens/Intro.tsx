/** Meet Noor, the questions before and after the lesson, and the phenomenon. */
import { useState } from 'react';
import { conditionsFor } from '../../../brain/world';
import { useI18n } from '../../../i18n';
import { ExperimentStage } from '../../../ui/ExperimentStage';
import { Icon } from '../../../ui/icons';
import type { LessonProps } from '../context';
import { LockChoice, NoorSays, Split, Title } from '../parts';

export function Meet({ pack, dispatch }: LessonProps) {
  const { t, n } = useI18n();
  const road = [
    { ar: 'احكي فكرتك', en: 'Say your idea' },
    { ar: 'توقّع وجرّب', en: 'Predict and test' },
    { ar: 'علّم نور', en: 'Teach Noor' },
  ];
  return (
    <div className="sl-center stack">
      <Title eyebrow={t(pack.title)}>{t({ ar: 'تعرّف على نور', en: 'Meet Noor' })}</Title>
      <NoorSays text={t(pack.noor.greeting)} mood="encouraging" size={150} hero />
      <ol className="chain card-tint">
        {road.map((step, i) => (
          <li key={i} className="is-idea"><span className="chain-dot" aria-hidden="true">{n(i + 1)}</span><span className="chain-text">{t(step)}</span></li>
        ))}
      </ol>
      <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'continue', at: Date.now() })}>
        {t({ ar: 'يلا نبلّش', en: 'Let us start' })}<Icon name="next" />
      </button>
    </div>
  );
}

const draftKey = (id: string) => `silsila-quiz-${id}`;
function readDraft(id: string): number[] {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(draftKey(id)) ?? '[]');
    return Array.isArray(v) && v.every((x) => typeof x === 'number') ? v : [];
  } catch { return []; }
}

/** One question at a time, without right or wrong: marking here would teach the answer. */
export function Quiz({ pack, journey, dispatch }: LessonProps) {
  const { t, n } = useI18n();
  const before = journey.step === 'pretest';
  const questions = before ? pack.preTest : pack.postTest;
  const key = `${journey.record.id}-${journey.step}`;
  const [answers, setAnswers] = useState(() => readDraft(key).slice(0, questions.length - 1));
  const q = questions[answers.length];
  const choose = (choice: number) => {
    const next = [...answers, choice];
    const done = next.length === questions.length;
    try {
      if (done) sessionStorage.removeItem(draftKey(key));
      else sessionStorage.setItem(draftKey(key), JSON.stringify(next));
    } catch { /* private mode */ }
    if (done) dispatch({ type: 'quiz', answers: next, at: Date.now() });
    else setAnswers(next);
  };
  return (
    <div className="sl-center stack">
      <Title eyebrow={`${t({ ar: 'سؤال', en: 'Question' })} ${n(answers.length + 1)} / ${n(questions.length)}`}>
        {before ? t({ ar: 'قبل ما نبلّش', en: 'Before we start' }) : t({ ar: 'آخر أسئلة صغيرة', en: 'A few last questions' })}
      </Title>
      {answers.length === 0 && (
        <p className="muted">{t({ ar: 'ما في علامة هون. جاوب متل ما بتفكّر هلأ.', en: 'There is no mark here. Answer the way you think now.' })}</p>
      )}
      <section className="card stack rise" key={q.id}>
        <h2 className="subtitle">{t(q.q)}</h2>
        <LockChoice label={t(q.q)} options={q.options.map((o, i) => ({ id: String(i), label: t(o) }))}
          submit={answers.length + 1 === questions.length ? t({ ar: 'خلّصت', en: 'Finish' }) : t({ ar: 'السؤال الجاي', en: 'Next question' })}
          onSubmit={(id) => choose(Number(id))} />
      </section>
    </div>
  );
}

export function Phenomenon({ pack, dispatch }: LessonProps) {
  const { t } = useI18n();
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'اللغز', en: 'The mystery' })}>{t(pack.question)}</Title>
        <NoorSays mood="curious" text={t({ ar: 'شوف التجهيز منيح. شو برأيك بيصير هون، وليش؟', en: 'Look closely at the setup. What do you think happens here, and why?' })} />
        <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'continue', at: Date.now() })}>
          {t({ ar: 'عندي فكرة', en: 'I have an idea' })}<Icon name="next" />
        </button>
      </>}
      show={<ExperimentStage pack={pack} cond={conditionsFor(pack)} model={null} revealed={false} />}
    />
  );
}
