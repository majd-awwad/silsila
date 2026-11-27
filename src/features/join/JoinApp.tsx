import { useEffect, useRef, useState } from 'react';
import { roomApi, seats } from '../../brain/client';
import type { Seat } from '../../brain/client';
import { eventsOf, initialDiagnosis, lastEvent } from '../../brain/records';
import { experimentById, experimentConditions } from '../../brain/world';
import type { RoomError, StudentOp, StudentRoomView } from '../../contracts';
import { CLASS_STEPS, FATAL_ERRORS, ROOM_MESSAGES, canSend, classStep, classTask, cleanCode, validCode } from '../../flow/classroom';
import { gapTask } from '../../flow/gaps';
import { useI18n } from '../../i18n';
import { PACKS } from '../../packs';
import { href, navigate } from '../../router';
import { LearningDNA, ReasonChain } from '../../ui/Evidence';
import { ExperimentStage } from '../../ui/ExperimentStage';
import { Loading, Notice, SampleBanner, Shell } from '../../ui/kit';
import { useNoorVoice } from '../../voice/useVoice';
import { ChainProgress, GapCard, LockChoice, NoorSays, SpeakBox, Title, VoiceContext, VoiceToggle } from '../student/parts';
import { Compare } from '../student/screens/Experiment';
import { useRoomPoll } from '../teacher/hooks/useRoomPoll';

export function JoinApp({ code }: { code: string | null }) {
  return <JoinEntry key={code ?? ''} initial={code ?? ''} />;
}

function JoinEntry({ initial }: { initial: string }) {
  const { t } = useI18n();
  const [code, setCode] = useState(() => cleanCode(initial));
  const [alias, setAlias] = useState('');
  const [seat, setSeat] = useState<Seat | null>(() => validCode(initial) ? seats.get(initial) : null);
  const [error, setError] = useState<RoomError | null>(null);
  const [busy, setBusy] = useState(false);
  if (seat) return <ClassLesson code={initial} seat={seat} onLeave={() => { seats.clear(initial); setSeat(null); }} />;
  const join = async () => {
    if (busy || !validCode(code)) return;
    setError(null);
    setBusy(true);
    try {
      const result = await roomApi.join(code, alias.trim() || undefined);
      if (!result.ok) setError(result.error);
      else if (code === initial) setSeat(result.data);
      else navigate('/join/' + code);
    } catch {
      setError('store_failed');
    } finally { setBusy(false); }
  };
  return <Shell narrow>
    <div className="stack">
      <Title>{t({ ar: 'انضمّ للصف', en: 'Join the class' })}</Title>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); void join(); }}>
        <label className="field"><span>{t({ ar: 'رمز الصف', en: 'Class code' })}</span>
          <input autoCapitalize="characters" autoComplete="off" className="input" dir="ltr" value={code} onChange={(e) => setCode(cleanCode(e.target.value))} required />
        </label>
        <label className="field"><span>{t({ ar: 'اسم مستعار (اختياري)', en: 'Nickname (optional)' })}</span>
          <input className="input" dir="auto" value={alias} maxLength={20} onChange={(e) => setAlias(e.target.value)} />
        </label>
        {error && <Notice tone="error">{t(ROOM_MESSAGES[error])}</Notice>}
        <button className="btn btn-primary btn-lg self-start" disabled={busy || !validCode(code)}>{busy ? t({ ar: 'عم ندخّلك…', en: 'Joining…' }) : t({ ar: 'ادخل', en: 'Join' })}</button>
      </form>
    </div>
  </Shell>;
}

function ClassLesson({ code, seat, onLeave }: { code: string; seat: Seat; onLeave: () => void }) {
  const { t, setLang } = useI18n();
  const voice = useNoorVoice(seat.lang);
  const poll = useRoomPoll<StudentRoomView>(code, 'student', undefined, true, undefined, seat);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<RoomError | null>(null);
  const running = useRef(false);
  useEffect(() => { setLang(seat.lang); }, [seat.lang, setLang]);
  const { view } = poll;
  const pack = view && PACKS[view.meta.settings.pack];
  const problem = actionError ?? poll.error;
  const fatal = poll.error && FATAL_ERRORS.includes(poll.error);
  const send = async (op: StudentOp) => {
    if (running.current || !view || !pack || !canSend(pack, view, op)) return false;
    running.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const result = await roomApi.student(code, seat, op);
      if (!result.ok) {
        setActionError(result.error);
        poll.refresh();
        return false;
      }
      poll.apply(result.data);
      return true;
    } catch {
      setActionError('store_failed');
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return <VoiceContext.Provider value={voice}>
    <Shell narrow actions={<VoiceToggle />}>
      <div className="stack">
        {view?.meta.sample && <SampleBanner />}
        {problem && <Notice tone="warn">{t(ROOM_MESSAGES[problem])}</Notice>}
        {fatal ? <button type="button" className="btn btn-secondary self-start" onClick={onLeave}>{t({ ar: 'ارجع للانضمام', en: 'Back to joining' })}</button>
          : view && pack ? <>
            <ChainProgress steps={CLASS_STEPS.map((step) => step.label)} current={classStep(view.meta.phase)} />
            <ClassTaskView key={view.meta.phase + ':' + view.meta.experimentId} view={view} send={send} busy={busy} />
          </> : !problem && <Loading />}
      </div>
    </Shell>
  </VoiceContext.Provider>;
}

function ClassTaskView({ view, send, busy }: { view: StudentRoomView; send: (op: StudentOp) => Promise<boolean>; busy: boolean }) {
  const { t } = useI18n();
  const { meta, me, agg } = view;
  const pack = PACKS[meta.settings.pack];
  const record = me.record;
  const task = classTask(pack, view);
  const test = experimentById(pack, meta.experimentId);
  const seen = test ? eventsOf(record, 'observe').find((event) => event.experimentId === test.id) : null;
  const [note, setNote] = useState(seen?.note ?? '');
  const [transfer, setTransfer] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const title = (label: { ar: string; en: string }) => <Title eyebrow={t(pack.title)}>{t(label)}</Title>;
  const waiting = <Notice>{t({ ar: 'استنّى المعلّم يفتح الخطوة الجاية.', en: 'Wait for the teacher to open the next step.' })}</Notice>;
  if (task === 'closed' || task === 'expired') return <>
    {title({ ar: 'الحصّة خلصت', en: 'Class ended' })}
    <a className="btn btn-secondary self-start" href={href('/learn')}>{t({ ar: 'اكتشف درس لحالك', en: 'Explore an individual lesson' })}</a>
  </>;
  if (task === 'lobby' || task === 'waiting') return <>
    {title({ ar: 'جاهز للخطوة الجاية؟', en: 'Ready for the next step?' })}
    <p><bdi>{me.alias}</bdi> · <bdi>{meta.code}</bdi></p>{waiting}
  </>;
  if (task === 'explain' || task === 'revise') {
    const op = task === 'explain' ? 'explain' : 'revise';
    const previous = eventsOf(record, 'explain').filter((event) => op === 'revise' ? event.phase === 'revise' : event.phase !== 'revise').at(-1);
    return <>
      {title(op === 'explain' ? { ar: 'احكي فكرتك', en: 'Share your idea' } : { ar: 'اشرح من جديد', en: 'Explain again' })}
      <NoorSays text={previous?.diagnosis.noor ?? t(pack.question)} />
      {previous && <div className="card stack">
        <p dir="auto">{previous.text}</p>
        <ReasonChain steps={previous.diagnosis.chain} />
      </div>}
      {canSend(pack, view, { type: op, text: '-' }) ? <SpeakBox label={t({ ar: 'شرحي', en: 'My explanation' })} busy={busy} onSubmit={(text) => send({ type: op, text })} /> : waiting}
    </>;
  }
  if (task === 'gap') {
    const gap = gapTask(pack, record);
    return gap ? <>
      {title({ ar: 'وقفة قصيرة', en: 'A short stop' })}
      <GapCard key={gap.kind + gap.prereq.id + (gap.kind === 'remedy' ? '' : gap.question.id)} task={gap} busy={busy}
        onAnswer={(answer) => { if (gap.kind !== 'remedy') void send({ type: 'prereq', prereqId: gap.prereq.id, questionId: gap.question.id, choice: answer }); }}
        onRemedyDone={() => void send({ type: 'remedy', prereqId: gap.prereq.id })} />
    </> : waiting;
  }
  if ((task === 'predict' || task === 'predicted') && test) return <>
    <Title eyebrow={t(pack.title)}>{t(test.name)}</Title>
    <ExperimentStage pack={pack} cond={experimentConditions(pack, test.id)} model={null} revealed={false} />
    {task === 'predict' ? <LockChoice label={t(test.question)} options={test.choices.map((id) => ({ id, label: t(pack.outcomes[id]) }))}
      submit={t({ ar: 'ثبّت توقّعي', en: 'Lock my prediction' })} busy={busy} lock onSubmit={(outcome) => void send({ type: 'predict', outcome })} />
      : <Notice>{t({ ar: 'انحفظ توقّعك. استنّى باقي الصف.', en: 'Your prediction is locked. Wait for the rest of the class.' })}</Notice>}
  </>;
  if (['reveal', 'experiment', 'observe', 'discuss'].includes(task) && test) return <>
    <Title eyebrow={t(pack.title)}>{t(test.name)}</Title>
    <ExperimentStage pack={pack} cond={experimentConditions(pack, test.id)} model={seen ? initialDiagnosis(record)?.model ?? null : null} revealed={!!agg.result} />
    {agg.predictions && <ul className="card">{agg.predictions.map((row) => <li key={row.outcome}>{t(pack.outcomes[row.outcome])} · {row.count}</li>)}</ul>}
    {seen && <Compare pack={pack} observation={seen} />}
    {seen && canSend(pack, view, { type: 'observe', note: '' }) && <form className="card stack" onSubmit={(e) => { e.preventDefault(); void send({ type: 'observe', note }); }}>
      <label className="field"><span>{t({ ar: 'شو لاحظت؟', en: 'What did you observe?' })}</span><textarea className="textarea" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="btn btn-primary self-start" disabled={busy || !note.trim() || note === seen.note}>{t({ ar: 'احفظ الملاحظة', en: 'Save observation' })}</button>
    </form>}
  </>;
  if (task === 'transfer') {
    const question = pack.transfer.check;
    return <>
      {title({ ar: 'موقف جديد', en: 'A new situation' })}
      <NoorSays text={t(pack.transfer.prompt)} />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (transfer.trim() && choice !== null) void send({ type: 'transfer', text: transfer.trim(), choice }); }}>
        <label className="field"><span>{t({ ar: 'شرحي', en: 'My explanation' })}</span><textarea required className="textarea" rows={3} maxLength={600} value={transfer} onChange={(e) => setTransfer(e.target.value)} /></label>
        <fieldset className="stack"><legend>{t(question.q)}</legend>{question.options.map((option, i) => (
          <label className="choice" key={i}><input type="radio" name="transfer-choice" checked={choice === i} onChange={() => setChoice(i)} />{t(option)}</label>
        ))}</fieldset>
        <button className="btn btn-primary self-start" disabled={busy || !transfer.trim() || choice === null}>{t({ ar: 'احفظ جوابي', en: 'Save my answer' })}</button>
      </form>
    </>;
  }
  if (task === 'insight' || task === 'transferred') return <>
    {title({ ar: 'شو اكتشفت؟', en: 'What did you discover?' })}
    {lastEvent(record, 'transfer') && <Notice>{t({ ar: 'جوابك محفوظ. يعطيك العافية!', en: 'Your response is saved. Thank you!' })}</Notice>}
    {task === 'insight' ? <LearningDNA pack={pack} record={record} /> : waiting}
  </>;
  return waiting;
}
