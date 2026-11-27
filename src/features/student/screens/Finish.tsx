import { useState } from 'react';
import { lastEvent } from '../../../brain/records';
import { childSafeRecord, canAnswerChallenge, gotGuidance, nextSteps, noorAttempt } from '../../../flow/derive';
import { useI18n } from '../../../i18n';
import { PACK_LIST } from '../../../packs';
import { RESOURCES } from '../../../packs/resources';
import { href } from '../../../router';
import { BeforeAfter, LearningDNA, ThinkingReplay } from '../../../ui/Evidence';
import type { LessonProps } from '../context';
import { HelpBar, HintCard } from '../HelpBar';
import { LockChoice, NoorSays, SpeakBox, Title } from '../parts';

export function Teach(props: LessonProps) {
  const { pack, journey, dispatch, teach, busy } = props;
  const { t } = useI18n();
  const latest = lastEvent(journey.record, 'teach');
  return <div className="sl-center stack">
    <Title>{t({ ar: 'علّم نور', en: 'Teach Noor' })}</Title>
    <NoorSays text={t(pack.teach.planted)} mood="thinking" />
    {latest && <NoorSays text={t(latest.caught ? pack.teach.thanks : pack.teach.confused)} mood={latest.caught ? 'encouraging' : 'curious'} auto={false} />}
    {gotGuidance(journey.record) && !latest?.caught && <HintCard pack={pack} level={4} />}
    <SpeakBox label={t({ ar: 'شو بدك تحكي لنور؟', en: 'What would you tell Noor?' })} busy={busy} onSubmit={teach} />
    <HelpBar {...props} />
    {latest && <button type="button" className="btn btn-primary self-start" disabled={busy} onClick={() => dispatch({ type: 'continue', at: Date.now() })}>
      {t({ ar: 'شوف نور تجرب', en: 'Watch Noor try' })}
    </button>}
  </div>;
}

export function Challenge({ pack, journey, dispatch, answerChallenge, busy }: LessonProps) {
  const { t, lang } = useI18n();
  const guess = noorAttempt(pack, journey.record, lang);
  return <div className="sl-center stack">
    <Title>{t({ ar: 'تحدّي نور', en: 'Noor’s challenge' })}</Title>
    <p className="sl-phenomenon">{t(pack.challenge.phenomenon)}</p>
    <NoorSays text={guess.solved ? t(pack.challenge.solved) : guess.ask ?? ''} />
    {guess.says.length > 0 && <ol className="card stack">{guess.says.map((line, index) => <li key={index}>{line}</li>)}</ol>}
    {canAnswerChallenge(journey.record) && <SpeakBox label={t({ ar: 'ساعد نور', en: 'Help Noor' })} busy={busy} onSubmit={answerChallenge} />}
    <button type="button" className="btn btn-primary self-start" disabled={busy} onClick={() => dispatch({ type: 'continue', at: Date.now() })}>
      {t({ ar: 'هلأ دوري', en: 'My turn now' })}
    </button>
  </div>;
}

export function Transfer({ pack, transfer, busy }: LessonProps) {
  const { t } = useI18n();
  return <div className="sl-center stack">
    <Title>{t({ ar: 'موقف جديد', en: 'A new situation' })}</Title>
    <NoorSays text={t(pack.transfer.prompt)} />
    <SpeakBox label={t({ ar: 'شرحي', en: 'My explanation' })} busy={busy} onSubmit={transfer} />
  </div>;
}

export function TransferCheck({ pack, dispatch }: LessonProps) {
  const { t } = useI18n();
  const question = pack.transfer.check;
  return <div className="sl-center stack">
    <Title>{t(question.q)}</Title>
    <LockChoice label={t(question.q)} options={question.options.map((o, i) => ({ id: String(i), label: t(o) }))}
      submit={t({ ar: 'ثبّت جوابي', en: 'Save my answer' })} onSubmit={(choice) => dispatch({ type: 'check', choice: Number(choice), at: Date.now() })} />
  </div>;
}

export function Summary({ pack, journey, dispatch, judge }: LessonProps) {
  const { t } = useI18n();
  const record = judge ? journey.record : childSafeRecord(pack, journey.record);
  const { recheck, nextPack } = nextSteps(pack, record, PACK_LIST);
  const transfer = lastEvent(record, 'transfer');
  const seen = lastEvent(record, 'observe');
  const practical = pack.experiments.find((x) => x.id === seen?.experimentId && x.home.steps.length)
    ?? pack.experiments.find((x) => x.home.steps.length);
  const [comparison, setComparison] = useState<string>(() => {
    const match = lastEvent(record, 'physical')?.matched;
    return match === true ? 'yes' : match === false ? 'no' : '';
  });
  const physical = lastEvent(record, 'physical');
  const [note, setNote] = useState(physical?.observation ?? '');
  return <div className="stack">
    <Title eyebrow={t(pack.title)}>{t({ ar: 'رحلة تفكيرك', en: 'Your thinking journey' })}</Title>
    {transfer && <div className="card">
      <strong>{t({ ar: 'سؤال الموقف الجديد', en: 'New-situation check' })}</strong>
      <p>{transfer.choiceCorrect ? t({ ar: 'جوابك طابق نتيجة النموذج.', en: 'Your answer matches the model.' }) : t({ ar: 'جرّب موقف تاني عشان تفحص فكرتك.', en: 'Try another setup to check your idea.' })}</p>
    </div>}
    <BeforeAfter pack={pack} record={record} showScience={judge} />
    <LearningDNA pack={pack} record={record} />
    <ThinkingReplay pack={pack} record={record} simple={!judge} />
    {practical && <details className="card">
      <summary className="subtitle">{t({ ar: 'جرّبها بإشي حقيقي', en: 'Try it with real materials' })}</summary>
      <p>{t(practical.name)}</p>
      {practical.materials.length > 0 && <p className="help">{practical.materials.map((item) => t(RESOURCES[item])).join(' · ')}</p>}
      <p className="help">{t(practical.safety.note)}</p>
      {practical.safety.adult && <p className="font-bold">{t({ ar: 'اعملوا التجربة مع شخص كبير.', en: 'Do this activity with an adult.' })}</p>}
      <ol>{practical.home.steps.map((step, i) => <li key={i}>{t(step)}</li>)}</ol>
      <label className="field mt-3"><span>{t(practical.home.record)}</span>
        <textarea className="textarea" rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {practical.home.reflect.length > 0 && <ul>{practical.home.reflect.map((question, i) => <li key={i}>{t(question)}</li>)}</ul>}
      <label className="field mt-3"><span>{t({ ar: 'هل اللي صار طابق نتيجة النموذج؟', en: 'Did the observation match the simulated result?' })}</span>
        <select className="select" value={comparison} onChange={(e) => setComparison(e.target.value)}>
          <option value="">{t({ ar: 'لسا مش متأكّد', en: 'Not sure yet' })}</option>
          <option value="yes">{t({ ar: 'آه', en: 'Yes' })}</option>
          <option value="no">{t({ ar: 'لأ', en: 'No' })}</option>
        </select>
      </label>
      <button className="btn btn-secondary mt-2" type="button" disabled={!note.trim()}
        onClick={() => dispatch({ type: 'physical', experimentId: practical.id, observation: note.trim(), matched: comparison === '' ? null : comparison === 'yes', at: Date.now() })}>
        {t({ ar: 'احفظ ملاحظتي', en: 'Save observation' })}
      </button>
      {note === physical?.observation && <p role="status">{t({ ar: 'انحفظت الملاحظة', en: 'Observation saved' })}</p>}
    </details>}
    <div className="sl-actions">
      {recheck && <button className="btn btn-secondary" type="button" onClick={() => dispatch({ type: 'toTest', experimentId: recheck.id })}>
        {t({ ar: 'جرّب كمان مرة', en: 'Test again' })}
      </button>}
      <a className="btn btn-primary" href={href(nextPack ? '/learn/' + nextPack.id : '/learn')}>
        {nextPack ? t(nextPack.title) : t({ ar: 'اختار درس ثاني', en: 'Choose another lesson' })}
      </a>
    </div>
  </div>;
}
