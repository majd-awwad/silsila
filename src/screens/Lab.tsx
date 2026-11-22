import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { ExperimentId, ExperimentRun, SceneExperiment } from '../contracts';
import { EXPERIMENT_IDS } from '../contracts';
import { aiAvailable, diagnose, teach } from '../brain/client';
import { outcomeMatches } from '../brain/predictions';
import { BrandMark, NoorAvatar } from '../components/NoorAvatar';
import type { Action, State } from '../flow/machine';
import { brainContext } from '../flow/machine';
import { EXPERIMENTS, NOOR, OUTCOME_LABEL, QUESTION, SAMPLE_PHRASES } from '../lesson/condensation';
import type { MirrorHandle } from '../scene/MirrorCanvas';
import { MirrorCanvas } from '../scene/MirrorCanvas';
import type { NoorState } from '../scene/MirrorEngine';
import { createDictation } from '../voice/stt';
import { createVoice } from '../voice/tts';
import { BrainPanel } from './BrainPanel';

const EXPERIMENT_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 5200;
const quality = new URLSearchParams(location.search).get('q') === 'low' ? 'low' : 'high';

export function Lab({ state, dispatch }: { state: State; dispatch: Dispatch<Action> }) {
  const mirror = useRef<MirrorHandle>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [brainOpen, setBrainOpen] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const [speakOn, setSpeakOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const voice = useMemo(() => createVoice(), []);
  const dictation = useMemo(() => createDictation(), []);
  const expTimer = useRef<number>(0);
  const spoken = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const { session, lab, busy, diag, model, messages, exp } = state;

  useEffect(() => {
    aiAvailable().then(setAi);
    return () => { clearTimeout(expTimer.current); voice.stop(); };
  }, [voice]);

  // keep the chat scrolled, and speak Noor's newest line when the voice is on
  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
    const last = messages[messages.length - 1];
    if (last && last.who === 'noor' && last.id > spoken.current) {
      spoken.current = last.id;
      if (speakOn) voice.speak(last.text, () => setTalking(true), () => setTalking(false));
    }
  }, [messages, speakOn, voice]);

  const noorState: NoorState = busy ? 'thinking' : talking ? 'talking' : lab === 'done' ? 'happy' : 'idle';

  async function send(text: string) {
    const t = text.trim();
    if (!t || stateRef.current.busy) return;
    setInput('');
    dispatch({ type: 'CHILD_SAID', text: t });
    dispatch({ type: 'BUSY', busy: true });
    if (stateRef.current.lab === 'teach') {
      const r = await teach(t);
      dispatch({ type: 'TAUGHT', text: t, result: r });
      return;
    }
    const d = await diagnose(t, brainContext(stateRef.current));
    dispatch({ type: 'DIAGNOSED', text: t, diag: d });
    if (d.status === 'model' || d.status === 'correct') runExperiment('base', true);
    if (d.status === 'correct') setTimeout(() => dispatch({ type: 'NOOR', text: NOOR.planted }), 1600);
  }

  function runExperiment(e: SceneExperiment, quiet = false) {
    clearTimeout(expTimer.current);
    dispatch({ type: 'EXPERIMENT', exp: e });
    mirror.current?.runExperiment(e);
    if (e === 'base') return;
    const s = stateRef.current;
    const pred = s.model?.predictions[e];
    if (!quiet) dispatch({ type: 'SYS', text: `تجربة: ${EXPERIMENTS[e].name}` + (pred ? ` · فكرتك بتتوقّع: ${OUTCOME_LABEL[pred]}` : '') });
    expTimer.current = window.setTimeout(() => {
      const real = EXPERIMENTS[e].real;
      mirror.current?.setOutcomes(pred ? `توقّعت: ${OUTCOME_LABEL[pred]}` : '', `صار: ${OUTCOME_LABEL[real]}`);
      if (!pred || stateRef.current.lab !== 'explain') return;
      const ok = outcomeMatches(e, pred);
      const run: ExperimentRun = { exp: e, predicted: pred, real, contradicted: !ok, at: Date.now() };
      dispatch({
        type: 'EXPERIMENT_RESULT', run,
        verdict: (ok ? 'توقّعك طلع صح بهالتجربة. ' : 'الحلقة انكسرت! ') + `فكرتك توقّعت «${OUTCOME_LABEL[pred]}»، والحقيقة «${OUTCOME_LABEL[real]}».`,
      });
      dispatch({ type: 'NOOR', text: ok ? NOOR.afterMatch : NOOR.afterContradiction });
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

  const aiLabel = ai === null ? 'عم يفحص الاتصال…' : ai ? 'Claude متصل' : 'وضع احتياطي بدون ذكاء اصطناعي';

  return (
    <div className="lab stage-bg">
      <MirrorCanvas ref={mirror} model={model} noor={noorState} quality={quality} />

      <header className="lab-top glass">
        <div className="flex items-center gap-2.5 font-display font-bold text-xl whitespace-nowrap"><BrandMark />سلسلة</div>
        <div className="lab-q"><span className="text-ink-2 font-normal text-sm me-2">علوم · {session?.pseudonym}</span>{QUESTION}</div>
        <div className={`pill ${ai ? 'on' : ai === false ? 'off' : ''}`} title={aiLabel}><span className="dot" /><span className="lbl">{aiLabel}</span></div>
        {voice.available() && (
          <button type="button" className="btn-ghost" aria-pressed={speakOn} onClick={() => { setSpeakOn(!speakOn); if (speakOn) voice.stop(); }}>
            {speakOn ? 'صوت نور: شغّال' : 'صوت نور'}
          </button>
        )}
        <button type="button" className="btn-ghost brain-toggle" aria-expanded={brainOpen} aria-controls="brain" onClick={() => setBrainOpen(!brainOpen)}>عقل سلسلة</button>
      </header>

      <section className="lab-chat glass" aria-label="حوار مع نور">
        <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 border-b border-[var(--line)]">
          <NoorAvatar />
          <div><b className="font-display text-[17px]">نور</b><small className="block text-ink-2 text-xs">روبوت صغيرة بتتعلّم منك</small></div>
        </div>
        <div ref={msgsRef} className="flex-1 overflow-auto px-3.5 pt-3.5 pb-1.5 flex flex-col gap-2.5" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.who}${m.who === 'verdict' && m.ok ? ' ok' : ''}`}>
              {m.who === 'noor' && <span className="who">نور</span>}
              {m.text}
            </div>
          ))}
          {busy && <div className="msg noor"><span className="who">نور</span><span className="typing"><i /><i /><i /></span></div>}
          {lab === 'done' && (
            <div className="msg verdict ok flex flex-col gap-2">
              <b>خلّصت السلسلة! شرحت، جرّبت، صلّحت فكرتك، وعلّمت نور.</b>
              <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'TO_POST' })}>آخر خطوة: أسئلة قصيرة</button>
            </div>
          )}
        </div>
        {lab !== 'done' && (
          <>
            <div className="px-3.5 py-1.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="جمل أطفال للتجربة">
              {SAMPLE_PHRASES.map((p) => (
                <button key={p} type="button" onClick={() => setInput(p)} className="flex-none h-[34px] px-3 rounded-full border border-[var(--line)] bg-white/5 text-ink-2 hover:text-ink text-[13px] cursor-pointer">{p}</button>
              ))}
            </div>
            <form className="flex gap-2 items-end px-3.5 pt-2.5 pb-3.5" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <label htmlFor="say" className="sr-only">احكي لنور فكرتك</label>
              <textarea
                id="say" rows={1} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={lab === 'teach' ? 'صحّح لنور…' : 'احكي لنور: من وين إجت النقط؟'}
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

      <BrainPanel diag={diag} open={brainOpen} busy={busy} onRun={(e: ExperimentId) => runExperiment(e)} />

      <nav className="lab-exps glass" aria-label="التجارب">
        <button type="button" aria-pressed={exp === 'base'} onClick={() => runExperiment('base')}>العادية</button>
        {EXPERIMENT_IDS.map((e) => (
          <button key={e} type="button" aria-pressed={exp === e} onClick={() => runExperiment(e)}>{EXPERIMENTS[e].short}</button>
        ))}
      </nav>
    </div>
  );
}
