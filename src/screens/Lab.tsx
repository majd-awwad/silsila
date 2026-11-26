import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { Conditions, ExperimentRun } from '../contracts';
import { challenge, diagnose, health, liveClass, teach, transfer } from '../brain/client';
import { entryFromSession } from '../brain/classInsights';
import { compare, conditionsFor, presetFor, sameConditions } from '../brain/world';
import { BrandMark, NoorAvatar } from '../components/NoorAvatar';
import { LabControls } from '../components/LabControls';
import type { Action, State } from '../flow/machine';
import { brainContext, contradictedCount, teachStuck } from '../flow/machine';
import { isJudgeMode, reveals } from '../mode';
import { getPack } from '../packs';
import { LiteScene } from '../scene/LiteScene';
import type { MirrorHandle } from '../scene/MirrorCanvas';
import { MirrorCanvas } from '../scene/MirrorCanvas';
import type { NoorState } from '../scene/MirrorEngine';
import { createDictation } from '../voice/stt';
import { createCloudDictation, createCloudVoice } from '../voice/cloud';
import { createVoice } from '../voice/tts';
import { BrainPanel } from './BrainPanel';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EXPERIMENT_MS = REDUCED ? 900 : 5200;

function initialLite(): boolean {
  if (new URLSearchParams(location.search).get('q') === 'low') return true;
  try { return localStorage.getItem('silsila-lite') === '1'; } catch { return false; }
}

export function Lab({ state, dispatch }: { state: State; dispatch: Dispatch<Action> }) {
  const { session, lab, busy, diag, model, messages, cond } = state;
  const pack = getPack(session?.pack);
  const mirror = useRef<MirrorHandle>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [brainOpen, setBrainOpen] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const judge = useMemo(isJudgeMode, []);
  // voice first for children: Noor talks by default (the child's click on Start counts as the user gesture)
  const [speakOn, setSpeakOn] = useState(!judge);
  const [talking, setTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [lite, setLite] = useState(initialLite);
  const [split, setSplit] = useState(false);
  const [outcomes, setOutcomes] = useState({ kid: '', real: '' });
  const [cloud, setCloud] = useState({ stt: false, tts: false });
  const browserVoice = useMemo(() => createVoice(), []);
  const cloudVoice = useMemo(() => createCloudVoice(), []);
  const browserDictation = useMemo(() => createDictation(), []);
  const cloudDictation = useMemo(() => createCloudDictation(), []);
  // the cloud voice is used only when the server says it is configured; otherwise the browser's own
  const voice = cloud.tts ? cloudVoice : browserVoice;
  const dictation = (cloud.stt && cloudDictation) || browserDictation;
  const expTimer = useRef<number>(0);
  const spoken = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    health().then((h) => { setAi(h.ai); setAiModel(h.model); setCloud({ stt: h.stt, tts: h.tts }); });
    return () => { clearTimeout(expTimer.current); voice.stop(); };
  }, [voice]);

  // post this child's progress to the live class map, if they joined one
  useEffect(() => {
    if (session?.classCode && session.explanations.length) liveClass.post(session.classCode, entryFromSession(session));
  }, [session]);

  // keep the chat scrolled, and speak Noor's newest line when the voice is on
  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
    const last = messages[messages.length - 1];
    if (last && (last.who === 'noor' || last.who === 'challenge') && last.id > spoken.current) {
      spoken.current = last.id;
      if (speakOn) voice.speak(last.text, () => setTalking(true), () => setTalking(false));
    }
  }, [messages, speakOn, voice]);

  const noorState: NoorState = busy ? 'thinking' : talking ? 'talking' : lab === 'done' ? 'happy' : 'idle';

  function show(c: Conditions, isSplit: boolean) {
    setSplit(isSplit);
    setOutcomes({ kid: '', real: '' });
    mirror.current?.run(c, isSplit);
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || stateRef.current.busy) return;
    setInput('');
    const phase = stateRef.current.lab;
    const teachings = [...new Set([...stateRef.current.teachings, t])];
    dispatch({ type: 'CHILD_SAID', text: t });
    dispatch({ type: 'BUSY', busy: true });
    if (phase === 'teach') {
      const turnsBefore = stateRef.current.session?.teach?.turns ?? 0;
      const r = await teach(pack, t);
      dispatch({ type: 'TAUGHT', text: t, result: r });
      const stuck = teachStuck(turnsBefore, r.caught);
      if (r.caught || stuck) {
        dispatch({ type: 'BUSY', busy: true });
        const c = await challenge(pack, stuck ? [...teachings, pack.scienceChain.join('، ')] : teachings);
        dispatch({ type: 'CHALLENGED', result: c });
      }
      return;
    }
    if (phase === 'challenge') {
      const c = await challenge(pack, teachings);
      dispatch({ type: 'CHALLENGED', result: c, childText: t });
      return;
    }
    if (phase === 'transfer') {
      const r = await transfer(pack, t);
      dispatch({ type: 'TRANSFERRED', text: t, result: r });
      return;
    }
    const d = await diagnose(pack, t, brainContext(stateRef.current));
    dispatch({ type: 'DIAGNOSED', text: t, diag: d });
    if (d.status === 'model' || d.status === 'correct') {
      dispatch({ type: 'SET_COND', cond: { ...pack.baseline } });
      show(pack.baseline, false);
    }
    if (d.status === 'correct') setTimeout(() => dispatch({ type: 'NOOR', text: pack.noor.planted }), 1600);
  }

  function test(c: Conditions) {
    clearTimeout(expTimer.current);
    dispatch({ type: 'SET_COND', cond: c });
    const isBaseline = sameConditions(c, conditionsFor(pack));
    show(c, !isBaseline);
    if (isBaseline) return;
    const preset = presetFor(pack, c);
    const s = stateRef.current;
    const m = s.model;
    const cmp = m ? compare(pack, m, c) : null;
    dispatch({ type: 'SYS', text: `تجربة: ${preset ? preset.name : 'تجربة من تصميمك'}` + (cmp ? ` · فكرتك بتتوقّع: ${pack.outcomes[cmp.kid]}` : '') });
    expTimer.current = window.setTimeout(() => {
      const real = pack.realOutcome(c);
      const o = { kid: cmp ? `توقّعت: ${pack.outcomes[cmp.kid]}` : '', real: `صار: ${pack.outcomes[real]}` };
      setOutcomes(o);
      mirror.current?.setOutcomes(o.kid, o.real);
      if (!cmp || !m || stateRef.current.lab !== 'explain') return;
      const run: ExperimentRun = { preset: preset?.id ?? null, cond: c, predicted: cmp.kid, real: cmp.real, contradicted: cmp.contradicted, at: Date.now() };
      if (cmp.contradicted) {
        dispatch({ type: 'EXPERIMENT_RESULT', run, verdict: `الحلقة انكسرت! فكرتك توقّعت «${pack.outcomes[cmp.kid]}»، والحقيقة «${pack.outcomes[cmp.real]}».`, noor: pack.noor.afterContradiction });
      } else {
        dispatch({ type: 'EXPERIMENT_RESULT', run, verdict: `العالمين عملوا نفس الإشي: «${pack.outcomes[cmp.real]}».`, noor: s.diag?.status === 'model' ? pack.noor.sameResult : pack.noor.afterMatch });
      }
    }, EXPERIMENT_MS);
  }

  function toggleMic() {
    if (!dictation) return;
    if (listening) { dictation.stop(); return; }
    const base = input.trim();
    setListening(true);
    voice.stop();
    dictation.start((t) => setInput((base + ' ' + t).trim()), () => setListening(false));
  }

  const toggleLite = () => {
    const v = !lite;
    setLite(v);
    try { localStorage.setItem('silsila-lite', v ? '1' : '0'); } catch { /* private mode */ }
  };
  const onFail = useCallback(() => setLite(true), []);

  const aiLabel = ai === null ? 'عم يفحص الاتصال…' : ai ? `ذكاء اصطناعي متصل${judge && aiModel ? ` · ${aiModel}` : ''}` : 'وضع احتياطي بدون ذكاء اصطناعي';
  const runs = session?.experiments ?? [];
  const rev = reveals({ judge, lab, contradicted: contradictedCount(runs) > 0 });
  // the experiment that breaks the idea is shown only to judges, or as a hint once two tries changed nothing
  const hintBest = judge || (runs.length >= 2 && contradictedCount(runs) === 0);
  const placeholder = { explain: 'احكي لنور فكرتك…', teach: 'صحّح لنور…', challenge: 'اشرح لنور الجزء الناقص…', transfer: 'فسّر بكلامك…', done: '' }[lab];
  const samples = lab === 'explain' && judge ? pack.samplePhrases : [];

  return (
    <div className="lab stage-bg">
      {lite
        ? <LiteScene pack={pack} model={model} cond={cond} split={split} kidText={outcomes.kid} realText={outcomes.real} />
        : <MirrorCanvas ref={mirror} pack={pack} model={model} noor={noorState} onFail={onFail} />}

      <header className="lab-top glass">
        <div className="flex items-center gap-2.5 font-display font-bold text-xl whitespace-nowrap"><BrandMark />سلسلة</div>
        <div className="lab-q"><span className="text-ink-2 font-normal text-sm me-2">{pack.subject} · {session?.pseudonym}{session?.classCode ? ` · صف ${session.classCode}` : ''}</span>{pack.question}</div>
        <div className={`pill ${ai ? 'on' : ai === false ? 'off' : ''}`} title={aiLabel}><span className="dot" /><span className="lbl">{aiLabel}</span></div>
        <button type="button" className="btn-ghost" aria-pressed={lite} onClick={toggleLite} title="مشهد ثنائي الأبعاد للأجهزة الضعيفة">{lite ? 'وضع خفيف: شغّال' : 'وضع خفيف'}</button>
        {voice.available() && (
          <button type="button" className="btn-ghost" aria-pressed={speakOn} onClick={() => { setSpeakOn(!speakOn); if (speakOn) voice.stop(); }}>
            {speakOn ? 'صوت نور: شغّال' : 'صوت نور'}
          </button>
        )}
        <button type="button" className="btn-ghost brain-toggle" aria-expanded={brainOpen} aria-controls="brain" onClick={() => setBrainOpen(!brainOpen)}>{judge ? 'عقل سلسلة' : 'فكرتي'}</button>
      </header>

      <section className="lab-chat glass" aria-label="حوار مع نور">
        <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 border-b border-[var(--line)]">
          <NoorAvatar />
          <div><b className="font-display text-[17px]">نور</b><small className="block text-ink-2 text-xs">روبوت صغيرة بتتعلّم منك</small></div>
        </div>
        <div ref={msgsRef} className="flex-1 overflow-auto px-3.5 pt-3.5 pb-1.5 flex flex-col gap-2.5" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.who}${(m.who === 'verdict' || m.who === 'challenge') && m.ok ? ' ok' : ''}`}>
              {m.who === 'noor' && <span className="who">نور</span>}
              {m.who === 'challenge' && <span className="block text-[11.5px] font-bold text-water">جواب نور من اللي علّمتها ياه</span>}
              {m.text}
            </div>
          ))}
          {busy && <div className="msg noor"><span className="who">نور</span><span className="typing"><i /><i /><i /></span></div>}
          {lab === 'done' && (
            <div className="msg verdict ok flex flex-col gap-2">
              <b>خلّصت السلسلة! شرحت، جرّبت، صلّحت فكرتك، علّمت نور، وفسّرت ظاهرة جديدة لحالك.</b>
              <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'TO_POST' })}>{session?.quick ? 'شوف سلسلتك' : 'آخر خطوة: أسئلة قصيرة'}</button>
            </div>
          )}
        </div>
        {lab !== 'done' && (
          <>
            {samples.length > 0 && (
              <div className="px-3.5 py-1.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="جمل أطفال للتجربة">
                {samples.map((p) => (
                  <button key={p} type="button" onClick={() => setInput(p)} className="flex-none h-[34px] px-3 rounded-full border border-[var(--line)] bg-white/5 text-ink-2 hover:text-ink text-[13px] cursor-pointer">{p}</button>
                ))}
              </div>
            )}
            <form className="flex gap-2 items-end px-3.5 pt-2.5 pb-3.5" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <label htmlFor="say" className="sr-only">احكي لنور</label>
              <textarea
                id="say" rows={1} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={placeholder}
                className="flex-1 min-h-12 max-h-[120px] resize-none overflow-hidden rounded-[14px] border border-[var(--line)] bg-black/25 px-3.5 py-3 text-[15px] leading-6"
              />
              {dictation && (
                <button type="button" className={`mic ${listening ? 'live' : ''}`} onClick={toggleMic} aria-label={listening ? 'وقّف التسجيل' : 'احكي بصوتك'}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
                </button>
              )}
              <button type="submit" className="send" disabled={busy || !input.trim()} aria-label="ابعت لنور">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H5" /><path d="m11 5-7 7 7 7" /></svg>
              </button>
            </form>
          </>
        )}
      </section>

      <BrainPanel pack={pack} diag={diag} open={brainOpen} busy={busy} rev={rev} judge={judge} onRun={(id) => test(conditionsFor(pack, pack.presets.find((p) => p.id === id)?.change))} />

      <LabControls pack={pack} cond={cond} best={hintBest ? diag?.best_experiment ?? null : null} busy={busy}
        onChange={(c) => dispatch({ type: 'SET_COND', cond: c })} onTest={test} />
    </div>
  );
}
