import { useEffect, useRef, useState } from 'react';
import * as brain from '../../brain/client';
import type { L } from '../../contracts';
import { brainContext, explanationText, observations, planFor } from '../../flow/derive';
import { journeyReducer, startJourney, STEPS } from '../../flow/journey';
import type { Action, Journey, Step } from '../../flow/journey';
import { useI18n } from '../../i18n';
import { isJudgeMode } from '../../mode';
import { PACK_LIST, PACKS } from '../../packs';
import { href, useRoute } from '../../router';
import { ReasonChain } from '../../ui/Evidence';
import { Icon } from '../../ui/icons';
import { Loading, Modal, Shell } from '../../ui/kit';
import { Noor } from '../../ui/Noor';
import { useNoorVoice } from '../../voice/useVoice';
import type { LessonProps } from './context';
import { ChainProgress, VoiceContext, VoiceToggle } from './parts';
import { forgetLesson, loadLesson, saveLesson } from './storage';
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
  return at < 3 ? 0 : at < 7 ? 1 : at < 13 ? 2 : at < 15 ? 3 : at < 18 ? 4 : 5;
}

export function StudentApp({ path = [] }: { path?: string[] }) {
  const { query } = useRoute();
  const requested = path[0] ?? query.get('pack');
  return <LessonEntry key={requested ?? ''} requested={requested} quick={query.get('quick') === '1'} judge={isJudgeMode(query)} />;
}

function LessonEntry({ requested, quick, judge }: { requested: string | null; quick: boolean; judge: boolean }) {
  const { lang, t, n } = useI18n();
  const [restored, setRestored] = useState<Journey | null | undefined>(undefined);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [subject, setSubject] = useState<keyof typeof subjects | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const voice = useNoorVoice(lang, judge);
  const pack = journey && PACKS[journey.record.pack];

  useEffect(() => {
    let active = true;
    void loadLesson().then((saved) => active && setRestored(saved));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (journey) void saveLesson(journey);
  }, [journey]);
  useEffect(() => {
    if (journey) window.scrollTo(0, 0);
  }, [journey?.step]);

  const start = (id: string) => {
    const selected = PACKS[id];
    if (!selected) return;
    forgetLesson();
    setRestored(null);
    setJourney(startJourney(selected, {
      id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      alias: t({ ar: 'مستكشف', en: 'Explorer' }), grade: selected.grades[0], lang, quick, at: Date.now(),
    }));
  };
  if (restored === undefined) return <Shell><Loading /></Shell>;

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
        {restored && (!selected || restored.record.pack === selected.id) && <button type="button" className="btn btn-primary self-start" onClick={() => setJourney(restored)}>
          {restored.record.finishedAt ? t({ ar: 'افتح ملخّص درسك', en: 'Open your lesson summary' }) : t({ ar: 'كمّل درسك', en: 'Resume your lesson' })} · {t(PACKS[restored.record.pack].title)}
        </button>}
        {!selected && <div className="row" role="group" aria-label={t({ ar: 'المادة', en: 'Subject' })}>
          <button type="button" className="btn btn-secondary" aria-pressed={subject === null} onClick={() => setSubject(null)}>{t({ ar: 'الكل', en: 'All' })}</button>
          {Object.entries(subjects).map(([id, label]) => <button key={id} type="button" className="btn btn-secondary" aria-pressed={subject === id}
            onClick={() => setSubject(id as keyof typeof subjects)}>{t(label)}</button>)}
        </div>}
        <div className="sl-packs">
          {options.map((item) => <button key={item.id} type="button" className={'sl-card-btn is-' + item.subject} onClick={() => start(item.id)}>
            <span className="label">{t(subjects[item.subject])} · {n(item.grades[0])}–{n(item.grades[1])}</span>
            <strong className="sl-subject-name">{t(item.title)}</strong><span className="sl-question">{t(item.question)}</span>
            <span className="row text-brand"><Icon name="next" size={17} />{t({ ar: 'ابدأ الدرس', en: 'Start lesson' })}</span>
          </button>)}
        </div>
        {selected && <a href={href('/learn')} className="btn btn-ghost self-start">{t({ ar: 'كل الدروس', en: 'All lessons' })}</a>}
      </div>
    </Shell>;
  }

  const dispatch = (action: Action) => setJourney((state) => state ? journeyReducer(pack, state, action) : state);
  const call = async (getAction: () => Promise<Action>) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    try {
      dispatch(await getAction());
      return true;
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
    <Shell actions={<><VoiceToggle /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)} disabled={busy}>
      {t({ ar: 'ابدأ من جديد', en: 'Start over' })}
    </button></>}>
      <ChainProgress steps={progress} current={milestone(journey.step)} />
      <Page key={journey.step} {...props} />
      {judge && <details className="sl-judge">
        <summary>{t({ ar: 'أدلّة النظام للحكّام', en: 'System evidence for judges' })}</summary>
        <div className="sl-judge-body stack">
          <ReasonChain steps={pack.steps.map((step) => t(step.noorSays))} tone="real" />
          <p>{t({ ar: 'التجارب اللي جربتها', en: 'Experiments run' })} · {n(observations(record).length)}</p>
          <ol>{planFor(pack, record).ranked.slice(0, 3).map((option) => <li key={option.id}>{t(pack.experiments.find((x) => x.id === option.id)!.name)} · {n(Math.round(option.score * 100))}/100</li>)}</ol>
        </div>
      </details>}
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t({ ar: 'نبدأ من جديد؟', en: 'Start a new lesson?' })}>
        <button type="button" className="btn btn-primary self-start" onClick={() => { forgetLesson(); setRestored(null); setJourney(null); setConfirm(false); }}>
          {t({ ar: 'اختار درس', en: 'Choose a lesson' })}
        </button>
      </Modal>
    </Shell>
  </VoiceContext.Provider>;
}
