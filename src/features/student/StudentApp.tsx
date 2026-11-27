import { useEffect, useRef, useState } from 'react';
import * as brain from '../../brain/client';
import type { L } from '../../contracts';
import { brainContext, childSafeRecord, explanationText, observations, planFor } from '../../flow/derive';
import { journeyReducer, startJourney, STEPS } from '../../flow/journey';
import type { Action, Journey, Step } from '../../flow/journey';
import { useI18n } from '../../i18n';
import { isJudgeMode } from '../../mode';
import { HomeworkBar } from '../homework/HomeworkBar';
import { PACK_LIST, PACKS } from '../../packs';
import { href, useRoute } from '../../router';
import { ReasonChain, ThinkingReplay } from '../../ui/Evidence';
import { Icon } from '../../ui/icons';
import { Loading, Modal, Shell } from '../../ui/kit';
import { PhenomenonPreview } from '../../ui/PhenomenonPreview';
import { Noor } from '../../ui/Noor';
import { useNoorVoice } from '../../voice/useVoice';
import type { LessonProps } from './context';
import { ChainProgress, VoiceContext, VoiceToggle } from './parts';
import { loadLessons, saveLesson } from './storage';
import { SoloDraftContext } from './draft';
import { Challenge, Summary, Teach, Transfer, TransferCheck } from './screens/Finish';
import { Clarify, Explain, Guided, Prereq, Revise, Understood } from './screens/Explain';
import { Hypothesis, Predict, Reflect, Reveal } from './screens/Experiment';
import { Meet, Phenomenon, Quiz } from './screens/Intro';

const subjects = {
  science: { ar: 'العلوم', en: 'Science' },
  math: { ar: 'الرياضيات', en: 'Mathematics' },
};

const pages: Record<Step, (props: LessonProps) => React.ReactNode> = {
  meet: Meet, pretest: Quiz, phenomenon: Phenomenon, explain: Explain, clarify: Clarify,
  understood: Understood, prereq: Prereq, hypothesis: Hypothesis, predict: Predict, reveal: Reveal,
  reflect: Reflect, revise: Revise, guided: Guided, teach: Teach, challenge: Challenge, transfer: Transfer,
  check: TransferCheck, posttest: Quiz, summary: Summary,
};

const progress: L[] = [
  { ar: 'اللغز', en: 'Mystery' }, { ar: 'فكرتي', en: 'My idea' }, { ar: 'التجربة', en: 'Experiment' },
  { ar: 'أعلّم نور', en: 'Teach Noor' }, { ar: 'موقف جديد', en: 'New situation' }, { ar: 'الملخّص', en: 'Summary' },
];
function milestone(step: Step) {
  const at = STEPS.indexOf(step);
  // the questions before the experiment come after the learner's own idea (journey: understood → pretest), so never step back to «Mystery»
  if (step === 'pretest') return 1;
  return at < 3 ? 0 : at < 7 ? 1 : at < 13 ? 2 : at < 15 ? 3 : at < 18 ? 4 : 5;
}

export function StudentApp({ path = [] }: { path?: string[] }) {
  const { query } = useRoute();
  const requested = path[0] ?? query.get('pack');
  const homework = /^[A-Z2-9]{6}$/.test((query.get('hw') ?? '').toUpperCase()) ? query.get('hw')!.toUpperCase() : null;
  return <LessonEntry key={requested ?? ''} requested={requested} quick={query.get('quick') === '1'} judge={isJudgeMode(query)} homework={homework} />;
}

function LessonEntry({ requested, quick, judge, homework }: { requested: string | null; quick: boolean; judge: boolean; homework: string | null }) {
  const { lang, t, n } = useI18n();
  const [restored, setRestored] = useState<Awaited<ReturnType<typeof loadLessons>>>();
  const current = useRef<Journey | null>(null);
  const revision = useRef<string | null>(null);
  const mounted = useRef(true);
  const [problem, setProblem] = useState<'conflict' | 'unavailable' | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [subject, setSubject] = useState<keyof typeof subjects | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const voice = useNoorVoice(lang, judge);
  const pack = journey && PACKS[journey.record.pack];

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void loadLessons().then((saved) => active && setRestored(saved));
    return () => { active = false; mounted.current = false; };
  }, []);
  useEffect(() => {
    if (journey) window.scrollTo(0, 0);
  }, [journey?.step]);

  const commit = (next: Journey) => {
    const saved = saveLesson(next, revision.current);
    if (saved.status === 'conflict') {
      setProblem('conflict');
      return false;
    }
    if (saved.status === 'saved') revision.current = saved.revision;
    setProblem(saved.status === 'unavailable' ? 'unavailable' : null);
    current.current = next;
    setJourney(next);
    return true;
  };
  const writeDraft = (name: string, value: string) => {
    if (!mounted.current || !current.current) return;
    const saved = saveLesson(current.current, revision.current, false);
    if (saved.status !== 'saved') { setProblem(saved.status); return; }
    revision.current = saved.revision;
    try { localStorage.setItem(name, value); setProblem(null); } catch { setProblem('unavailable'); }
  };
  const resume = (saved: NonNullable<typeof restored>[string]) => {
    revision.current = saved.revision;
    current.current = saved.journey;
    setJourney(saved.journey);
  };
  const start = (id: string) => {
    const selected = PACKS[id];
    if (!selected) return;
    if (current.current?.record.pack !== id) revision.current = restored?.[id]?.revision ?? null;
    commit(startJourney(selected, {
      id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      alias: t({ ar: 'مستكشف', en: 'Explorer' }), grade: selected.grades[0], lang, quick, at: Date.now(),
    }));
  };
  if (restored === undefined) return <Shell><Loading /></Shell>;
  const storageNotice = problem && <div role="alert" className="card">
    {problem === 'conflict'
      ? t({ ar: 'هالدرس تغيّر بتبويب تاني. حدّث الصفحة عشان تكمّل من آخر حفظ.', en: 'The lesson changed in another tab. Reload to continue from the latest save.' })
      : t({ ar: 'الجهاز ما قدر يحفظ التقدّم. خلّي هالصفحة مفتوحة.', en: 'This device could not save your progress. Keep this page open.' })}
  </div>;

  if (!journey || !pack) {
    const selected = requested ? PACKS[requested] : null;
    const options = selected ? [selected] : PACK_LIST.filter((p) => !subject || p.subject === subject);
    return <Shell>
      <div className="stack">
        <div className="stage sl-hero">
          <div className="stack !gap-2">
            <h1 className="title">{selected ? t(selected.title) : t({ ar: 'اختار لغزك', en: 'Choose your mystery' })}</h1>
            <p>{selected ? t(selected.question) : t({ ar: 'اكتشف فكرتك بتجربة مع نور.', en: 'Put your idea to the test with Noor.' })}</p>
          </div><Noor mood="curious" size={96} />
        </div>
        {storageNotice}
        {Object.values(restored).filter((saved) => !selected || saved.journey.record.pack === selected.id).sort((a, b) => b.savedAt - a.savedAt).map((saved) => {
          const item = PACKS[saved.journey.record.pack];
          return <section className="card stack sl-resume" key={item.id}>
            <h2 className="subtitle">{t(item.title)}</h2>
            {!saved.journey.record.finishedAt && <p>{t({ ar: 'أهلاً بعودتك! نور مستنيّتك تكمّل اكتشافك.', en: 'Welcome back! Noor is ready to keep exploring with you.' })}</p>}
            <ChainProgress steps={progress} current={milestone(saved.journey.step)} />
            <p className="help">{t({ ar: 'آخر حفظ', en: 'Last saved' })} · {new Date(saved.savedAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en')}</p>
            {saved.recovered && <p className="help">{t({ ar: 'استرجعنا السجل المتاح. بعض تفاصيل الشاشة القديمة ممكن تكون ناقصة.', en: 'We recovered the available record. Some previous screen details may be missing.' })}</p>}
            <div className="sl-actions">
              <button className="btn btn-primary" type="button" onClick={() => resume(saved)}>
                {saved.journey.record.finishedAt ? t({ ar: 'افتح ملخّص درسك', en: 'Open your lesson summary' }) : t({ ar: 'كمّل من وين وقفت', en: 'Continue where you left off' })}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setConfirm(item.id)}>{t({ ar: 'ابدأ من جديد', en: 'Start over' })}</button>
            </div>
          </section>;
        })}
        {!selected && <div className="row" role="group" aria-label={t({ ar: 'المادة', en: 'Subject' })}>
          <button type="button" className="btn btn-secondary" aria-pressed={subject === null} onClick={() => setSubject(null)}>{t({ ar: 'الكل', en: 'All' })}</button>
          {Object.entries(subjects).map(([id, label]) => <button key={id} type="button" className="btn btn-secondary" aria-pressed={subject === id}
            onClick={() => setSubject(id as keyof typeof subjects)}>{t(label)}</button>)}
        </div>}
        <div className="sl-packs">
          {options.map((item) => <button key={item.id} type="button" className={'sl-card-btn is-' + item.subject} onClick={() => restored[item.id] ? resume(restored[item.id]) : start(item.id)}>
            <span className="label">{t(subjects[item.subject])} · {t({ ar: 'صفوف', en: 'Grades' })} {n(item.grades[0])}–{n(item.grades[1])}</span>
            <PhenomenonPreview pack={item} compact />
            <strong className="sl-subject-name">{t(item.title)}</strong><span className="sl-question">{t(item.question)}</span>
            <span className="row text-brand"><Icon name="next" size={17} />{restored[item.id] ? t({ ar: 'افتح الدرس المحفوظ', en: 'Open saved lesson' }) : t({ ar: 'ابدأ الدرس', en: 'Start lesson' })}</span>
          </button>)}
        </div>
        {selected && <a href={href('/learn')} className="btn btn-ghost self-start">{t({ ar: 'كل الدروس', en: 'All lessons' })}</a>}
      </div>
      <Restart pack={confirm} close={() => setConfirm(null)} start={start} />
    </Shell>;
  }

  const dispatch = (action: Action) => {
    const previous = current.current;
    if (!previous || !mounted.current) return false;
    const next = journeyReducer(pack, previous, action);
    return next === previous || commit(next);
  };
  const call = async (getAction: () => Promise<Action>) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    try {
      const previous = current.current;
      const action = await getAction();
      return previous === current.current && dispatch(action);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const record = journey.record;
  const props: LessonProps = {
    pack, journey, dispatch, judge, busy,
    explain: (input) => call(async () => {
      const text = explanationText(record, journey.step, input);
      return { type: 'explained', text, diagnosis: await brain.diagnose(pack, text, brainContext(pack, record, lang)), at: Date.now() };
    }),
    teach: (text) => call(async () => ({ type: 'taught', text, result: await brain.teach(pack, lang, text), at: Date.now() })),
    answerChallenge: (text) => call(async () => ({ type: 'challengeAnswer', text, result: await brain.teach(pack, lang, text), at: Date.now() })),
    transfer: (text) => call(async () => ({ type: 'transferred', text, result: await brain.transfer(pack, lang, text) })),
  };
  const Page = pages[journey.step];
  return <VoiceContext.Provider value={voice}>
    <Shell actions={<><VoiceToggle /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(pack.id)} disabled={busy}>
      {t({ ar: 'ابدأ من جديد', en: 'Start over' })}
    </button></>}>
      {homework && <HomeworkBar code={homework} record={record} />}
      <ChainProgress steps={progress} current={milestone(journey.step)} />
      {storageNotice}
      <SoloDraftContext.Provider value={{ prefix: record.id + ':' + journey.step + ':' + record.events.filter((event) => event.type !== 'assist').length, write: writeDraft }}>
        <Page key={record.id + ':' + journey.step} {...props} />
      </SoloDraftContext.Provider>
      {journey.step !== 'summary' && <ExperimentHistory journey={journey} />}
      {judge && <details className="sl-judge">
        <summary>{t({ ar: 'أدلّة النظام للحكّام', en: 'System evidence for judges' })}</summary>
        <div className="sl-judge-body stack">
          <ReasonChain steps={pack.steps.map((step) => t(step.noorSays))} tone="real" />
          <p>{t({ ar: 'التجارب اللي جربتها', en: 'Experiments run' })} · {n(observations(record).length)}</p>
          <ol>{planFor(pack, record).ranked.slice(0, 3).map((option) => <li key={option.id}>{t(pack.experiments.find((x) => x.id === option.id)!.name)} · {n(Math.round(option.score * 100))}/100</li>)}</ol>
        </div>
      </details>}
      <Restart pack={confirm} close={() => setConfirm(null)} start={start} />
    </Shell>
  </VoiceContext.Provider>;
}

function ExperimentHistory({ journey }: { journey: Journey }) {
  const { t, n } = useI18n();
  const pack = PACKS[journey.record.pack];
  const record = childSafeRecord(pack, journey.record);
  const sealed = journey.step === 'reveal' ? observations(record).at(-1)?.at : undefined;
  const past = observations(record).filter((event) => event.at !== sealed);
  if (!past.length) return null;
  const history = { ...record, events: record.events.filter((event) => event.at !== sealed) };
  return <details className="card sl-history">
    <summary>{t({ ar: 'تجاربي السابقة', en: 'My earlier experiments' })} · {n(past.length)}</summary>
    <ThinkingReplay pack={pack} record={history} simple />
  </details>;
}

function Restart({ pack, close, start }: { pack: string | null; close: () => void; start: (pack: string) => void }) {
  const { t } = useI18n();
  return <Modal open={!!pack} onClose={close} title={t({ ar: 'نبدأ من جديد؟', en: 'Start over?' })}>
    <p>{t({ ar: 'رح تبدأ محاولة جديدة لهالدرس.', en: 'This starts a new attempt for this lesson.' })}</p>
    <button type="button" className="btn btn-secondary" onClick={close}>{t({ ar: 'كمّل الدرس', en: 'Keep my lesson' })}</button>
    <button type="button" className="btn btn-primary" onClick={() => { if (pack) start(pack); close(); }}>{t({ ar: 'ابدأ محاولة جديدة', en: 'Start a new attempt' })}</button>
  </Modal>;
}
