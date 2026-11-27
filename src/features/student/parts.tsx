/** Learner-facing building blocks shared by the individual lesson and the classroom phone view. */
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Diagnosis, L } from '../../contracts';
import type { GapTask } from '../../flow/gaps';
import { useI18n } from '../../i18n';
import { SourceBadge } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { Noor } from '../../ui/Noor';
import type { NoorMood } from '../../ui/Noor';
import { useDictation } from '../../voice/useVoice';
import type { NoorVoice } from '../../voice/useVoice';
import './student.css';

export const VoiceContext = createContext<NoorVoice | null>(null);

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The mute switch. Hidden where the device has no voice for this language: Noor's words are always on screen. */
export function VoiceToggle() {
  const voice = useContext(VoiceContext);
  const { t } = useI18n();
  if (!voice?.available) return null;
  return (
    <button type="button" className={`btn btn-sm sl-touch ${voice.muted ? 'btn-ghost' : 'btn-secondary'}`} aria-pressed={!voice.muted} onClick={voice.toggle}
      title={voice.muted ? t({ ar: 'صوت نور مطفي', en: 'Noor’s voice is off' }) : t({ ar: 'صوت نور شغّال', en: 'Noor’s voice is on' })}>
      <Icon name={voice.muted ? 'cross' : 'sound'} size={17} />
      <span className="hide-sm">{t({ ar: 'صوت نور', en: 'Noor’s voice' })}</span>
      <span className="sr-only">{voice.muted ? t({ ar: 'مطفي', en: 'off' }) : t({ ar: 'شغّال', en: 'on' })}</span>
    </button>
  );
}

/**
 * Noor's line, announced politely to screen readers. With `auto` it is also spoken (unless muted); otherwise the
 * learner can ask to hear it.
 */
export function NoorSays({ text, mood = 'curious', size = 84, auto = true, hero = false, children }: {
  text: string; mood?: NoorMood; size?: number; auto?: boolean; hero?: boolean; children?: ReactNode;
}) {
  const voice = useContext(VoiceContext);
  const { t } = useI18n();
  const spoken = useRef('');
  const available = !!voice?.available;
  const muted = !!voice?.muted;
  useEffect(() => {
    if (!auto || !available || muted || !text || spoken.current === text) return;
    spoken.current = text;
    voice?.say(text);
  }, [auto, text, available, muted]);
  useEffect(() => () => { spoken.current = ''; voice?.stop(); }, []);
  return (
    <div className={hero ? 'sl-noor sl-noor-hero' : 'sl-noor'}>
      <Noor mood={mood} size={size} float={hero} />
      <div className="sl-bubble">
        <div className="sl-bubble-head">
          <span className="sl-who">{t({ ar: 'نور', en: 'Noor' })}</span>
          {available && (
            <button type="button" className="btn btn-ghost btn-icon sl-listen" onClick={() => voice?.sayNow(text)} aria-label={t({ ar: 'اسمع نور', en: 'Hear Noor' })}>
              <Icon name="sound" size={18} />
            </button>
          )}
        </div>
        <p aria-live="polite">{text}</p>
        {children}
      </div>
    </div>
  );
}

/** The screen's one heading; focus moves here when the task changes so keyboard and screen readers follow. */
export function Title({ eyebrow, children }: { eyebrow?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <header className="sl-heading">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 ref={ref} tabIndex={-1} className="sl-title">{children}</h1>
    </header>
  );
}

/** Two columns on wide screens (task, then stage); on phones the stage comes first. */
export function Split({ task, show }: { task: ReactNode; show: ReactNode }) {
  return (
    <div className="sl-split">
      <div className="sl-task stack">{task}</div>
      <div className="sl-show stack">{show}</div>
    </div>
  );
}

/** Progress through the journey, drawn as a chain. */
export function ChainProgress({ steps, current }: { steps: L[]; current: number }) {
  const { t, n } = useI18n();
  return (
    <nav className="sl-progress" aria-label={t({ ar: 'وين وصلت', en: 'Your progress' })}>
      <ol className="links">
        {steps.map((s, i) => (
          <li key={i} className={i < current ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
            <i aria-hidden="true" />
            <span className="sr-only">{t(s)}{i < current ? ` (${t({ ar: 'خلصت', en: 'done' })})` : ''}</span>
          </li>
        ))}
      </ol>
      <p className="sl-progress-label">{t({ ar: 'خطوة', en: 'Step' })} {n(current + 1)} / {n(steps.length)} · {t(steps[current])}</p>
    </nav>
  );
}

/** Pick one answer, then confirm it. Nothing says whether it is right. */
export function LockChoice({ label, options, submit, onSubmit, busy = false, lock = false, initial = null }: {
  label: string; options: { id: string; label: string }[]; submit: string; onSubmit: (id: string) => void;
  busy?: boolean; lock?: boolean; initial?: string | null;
}) {
  const [picked, setPicked] = useState<string | null>(initial);
  const valid = options.some((o) => o.id === picked);
  return (
    <div className="stack !gap-3">
      <div role="group" aria-label={label} className="stack !gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" className="choice" aria-pressed={picked === o.id} disabled={busy} onClick={() => setPicked(o.id)}>
            <span className="choice-mark" aria-hidden="true" />
            <span className="min-w-0">{o.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-lg" disabled={!valid || busy} onClick={() => valid && onSubmit(picked!)}>
        {busy ? <span className="spinner" aria-hidden="true" /> : lock ? <Icon name="lock" size={18} /> : <Icon name="check" size={18} />}
        {submit}
      </button>
    </div>
  );
}

/**
 * Say it or type it. The transcript lands in the box, so the learner can fix it before sending. Where the browser
 * cannot listen there is no microphone, and typing always works.
 */
export function SpeakBox({ label, placeholder, submit, busy, onSubmit, samples = [] }: {
  label: string; placeholder?: string; submit?: string; busy: boolean;
  /** resolve to false to keep the text (it was not accepted) */
  onSubmit: (text: string) => void | Promise<boolean>;
  /** example sentences, judge mode only */
  samples?: string[];
}) {
  const { t, lang, n } = useI18n();
  const voice = useContext(VoiceContext);
  const dictation = useDictation(lang);
  const [text, setText] = useState('');
  const id = useId();
  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const said = text.trim();
    if (!said || busy) return;
    dictation.stop();
    voice?.stop();
    if ((await onSubmit(said)) === true) setText('');
  };
  const mic = () => {
    if (dictation.listening) { dictation.stop(); return; }
    const before = text.trim();
    voice?.stop();
    dictation.start((heard) => setText(`${before} ${heard}`.trim().slice(0, 600)));
  };
  return (
    <form className="sl-speak" onSubmit={send}>
      <label className="label" htmlFor={id}>{label}</label>
      {samples.length > 0 && (
        <div className="sl-samples" role="group" aria-label={t({ ar: 'جمل للتجربة (وضع الحكّام)', en: 'Sample sentences (judge mode)' })}>
          {samples.map((s) => <button key={s} type="button" className="btn btn-secondary btn-sm" onClick={() => setText(s)}>{s}</button>)}
        </div>
      )}
      <textarea id={id} className="textarea" dir="auto" rows={3} maxLength={600} value={text} placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
      <div className="sl-speak-actions">
        {dictation.supported && (
          <button type="button" className={`btn btn-secondary sl-mic ${dictation.listening ? 'is-live' : ''}`} aria-pressed={dictation.listening} onClick={mic} disabled={busy}>
            <Icon name={dictation.listening ? 'stop' : 'mic'} />
            {dictation.listening ? t({ ar: 'وقّف التسجيل', en: 'Stop recording' }) : t({ ar: 'احكي بصوتك', en: 'Speak' })}
          </button>
        )}
        {text.length > 450 && <span className="help">{n(text.length)} / {n(600)}</span>}
        <button type="submit" className="btn btn-primary ms-auto" disabled={busy || !text.trim()}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="send" />}
          {submit ?? t({ ar: 'ابعت لنور', en: 'Send to Noor' })}
        </button>
      </div>
      <p className="sr-only" role="status">{dictation.listening ? t({ ar: 'عم نسمعك', en: 'Listening' }) : ''}</p>
      {dictation.supported && (
        <p className="help">
          {dictation.cloud
            ? t({ ar: 'لما تكبس المايك، صوتك بينبعت لخدمة بتحوّله لكتابة. إحنا ما بنخزّنه. وبتقدر تكتب بداله.', en: 'When you use the microphone, your audio is sent to a service that turns it into text. We do not store it. You can type instead.' })
            : t({ ar: 'المايك بيستعمل خدمة المتصفّح لتحويل الصوت لكتابة (ممكن ينبعت الصوت إلها). إحنا ما بنخزّنه. وبتقدر تكتب بداله.', en: 'The microphone uses your browser’s speech service (audio may be sent to it). We do not store it. You can type instead.' })}
        </p>
      )}
      {dictation.problem && (
        <p className="help sl-problem" role="alert">
          {dictation.problem === 'blocked'
            ? t({ ar: 'ما قدرنا نفتح المايك. اكتب فكرتك بالصندوق.', en: 'The microphone could not be opened. Type your idea in the box.' })
            : t({ ar: 'ما قدرنا نسمع منيح. جرّب كمان مرة أو اكتب.', en: 'We could not hear that. Try again or type.' })}
        </p>
      )}
    </form>
  );
}

/** Which engine read the words. Honest, small, out of the way. */
export function SourceNote({ source, reason }: { source: 'ai' | 'fallback'; reason?: Diagnosis['fallbackReason'] }) {
  return <div className="sl-source"><SourceBadge source={source} reason={reason} /></div>;
}

/** One task of Learning Gap Recovery: a question, or the short remedy. No answer is ever marked here. */
export function GapCard({ task, busy = false, onAnswer, onRemedyDone }: {
  task: GapTask; busy?: boolean; onAnswer: (choice: number) => void; onRemedyDone: () => void;
}) {
  const { t, n } = useI18n();
  if (task.kind === 'remedy') {
    const { remedy } = task.prereq;
    return (
      <section className="card stack" key="remedy">
        <span className="chip chip-brand self-start"><Icon name="link" size={14} />{t({ ar: 'تقوية أساس', en: 'Strengthen a foundation' })} · {n(remedy.minutes)} {t({ ar: 'دقايق', en: 'min' })}</span>
        <h2 className="subtitle">{t(remedy.title)}</h2>
        <ol className="chain">
          {remedy.steps.map((s, i) => (
            <li key={i} className="is-real"><span className="chain-dot" aria-hidden="true">{n(i + 1)}</span><span className="chain-text">{t(s)}</span></li>
          ))}
        </ol>
        <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={onRemedyDone}>{t({ ar: 'خلّصت، اسألني', en: 'Done, ask me' })}</button>
      </section>
    );
  }
  return (
    <section className="card stack" key={task.question.id}>
      <span className="chip self-start">
        {task.kind === 'verify'
          ? `${t({ ar: 'سؤال صغير', en: 'Quick question' })} ${n(task.index + 1)} / ${n(2)}`
          : t({ ar: 'سؤال كمان للتأكّد', en: 'One more to check' })}
      </span>
      <h2 className="subtitle">{t(task.question.q)}</h2>
      <LockChoice key={task.question.id} label={t(task.question.q)} busy={busy}
        options={task.question.options.map((o, i) => ({ id: String(i), label: t(o) }))}
        submit={t({ ar: 'هاد جوابي', en: 'This is my answer' })} onSubmit={(id) => onAnswer(Number(id))} />
    </section>
  );
}
