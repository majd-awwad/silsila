/**
 * Learning DNA, reasoning chains and Thinking Replay: the evidence views shared by the learner summary and the
 * teacher's reports. All of it is derived from the learner's event log (src/brain/evidence.ts).
 */
import { useEffect, useState } from 'react';
import type { Diagnosis, L, LearnerRecord } from '../contracts';
import { CHAIN_IDS } from '../contracts';
import { learningDNA, replaySteps, transformation } from '../brain/evidence';
import type { NodeStatus, ReplayKind } from '../brain/evidence';
import { eventsOf } from '../brain/records';
import { useI18n } from '../i18n';
import type { ConceptPack } from '../packs/types';
import { Icon } from './icons';
import type { IconName } from './icons';

export const NODE_LABEL: Record<NodeStatus, L> = {
  not_assessed: { ar: 'ما تقيّم', en: 'Not assessed' },
  insufficient: { ar: 'أدلّة غير كافية', en: 'Insufficient evidence' },
  partial: { ar: 'فهم جزئي', en: 'Partial' },
  misconception: { ar: 'فكرة بدها مراجعة', en: 'Misconception seen' },
  demonstrated: { ar: 'فهم ظاهر', en: 'Demonstrated' },
  assisted: { ar: 'فهم بمساعدة', en: 'With assistance' },
  transfer: { ar: 'طبّقه بموقف جديد', en: 'Transfer shown' },
};
const NODE_SHAPE: Record<NodeStatus, string> = { not_assessed: '○', insufficient: '◌', partial: '◐', misconception: '△', demonstrated: '●', assisted: '◍', transfer: '★' };

export function StatusCell({ status }: { status: NodeStatus }) {
  const { t } = useI18n();
  return <span className="dna-cell" data-status={status}><span aria-hidden="true">{NODE_SHAPE[status]}</span>{t(NODE_LABEL[status])}</span>;
}

/** Concept by concept: at the first explanation, and now. */
export function LearningDNA({ pack, record }: { pack: ConceptPack; record: LearnerRecord }) {
  const { t } = useI18n();
  const first = eventsOf(record, 'explain').filter((e) => e.phase !== 'revise').at(-1);
  const before = learningDNA(pack, record, first?.at ?? 0);
  const now = learningDNA(pack, record);
  return (
    <div className="dna" role="table" aria-label={t({ ar: 'خريطة الفهم: أول شرح ثم الآن', en: 'Learning map: first explanation, then now' })}>
      <div className="dna-row muted text-[12.5px] font-bold" role="row">
        <span role="columnheader">{t({ ar: 'المفهوم', en: 'Concept' })}</span>
        <span role="columnheader">{t({ ar: 'أول شرح', en: 'First explanation' })}</span>
        <span role="columnheader">{t({ ar: 'هلأ', en: 'Now' })}</span>
      </div>
      {CHAIN_IDS.map((id) => (
        <div className="dna-row" role="row" key={id}>
          <span role="rowheader" className="font-semibold text-[14px] self-center">{t(pack.concepts[id].label)}</span>
          <span role="cell" className="flex"><StatusCell status={before[id].status} /></span>
          <span role="cell" className="flex" title={now[id].evidence.map((e) => e.quote).filter(Boolean).join(' · ')}><StatusCell status={now[id].status} /></span>
        </div>
      ))}
    </div>
  );
}

/** A reasoning chain; `wrongStep` is the link to investigate. */
export function ReasonChain({ steps, wrongStep = null, tone = 'idea' }: { steps: string[]; wrongStep?: number | null; tone?: 'idea' | 'real' }) {
  const { t, n } = useI18n();
  return (
    <ol className="chain">
      {steps.map((s, i) => (
        <li key={i} className={i === wrongStep ? 'is-probe' : `is-${tone}`}>
          <span className="chain-dot" aria-hidden="true">{i === wrongStep ? '?' : n(i + 1)}</span>
          <span className="chain-text">{s}{i === wrongStep && <span className="sr-only"> ({t({ ar: 'حلقة بدها اختبار', en: 'link to investigate' })})</span>}</span>
        </li>
      ))}
    </ol>
  );
}

export function DiagnosisChain({ diagnosis, markWrong }: { diagnosis: Diagnosis; markWrong: boolean }) {
  return diagnosis.chain.length ? <ReasonChain steps={diagnosis.chain} wrongStep={markWrong ? diagnosis.wrongStep : null} tone={diagnosis.status === 'correct' ? 'real' : 'idea'} /> : null;
}

/** Which reasoning relationships changed between the first and the latest explanation. */
export function BeforeAfter({ pack, record, showScience = true }: { pack: ConceptPack; record: LearnerRecord; showScience?: boolean }) {
  const { t } = useI18n();
  const x = transformation(record);
  const explains = eventsOf(record, 'explain');
  if (!x) return null;
  const first = explains.filter((e) => e.phase !== 'revise').at(-1)!;
  const last = explains.at(-1)!;
  const column = (title: L, e: typeof first) => (
    <div className="card-flat flex-1 min-w-[min(100%,260px)] stack !gap-2">
      <h4 className="text-[14px]">{t(title)}</h4>
      <p className="text-[14px] muted">«{e.text}»</p>
      <DiagnosisChain diagnosis={e.diagnosis} markWrong />
    </div>
  );
  return (
    <div className="stack">
      <div className="flex flex-wrap gap-3">
        {column({ ar: 'قبل', en: 'Before' }, first)}
        {column({ ar: 'بعد', en: 'After' }, last)}
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5 text-[14px]">
        {x.dropped.map((id) => <li key={id} className="flex gap-2 items-center"><span className="chip chip-probe">{t({ ar: 'تركها', en: 'Dropped' })}</span>{t(pack.ideas[id].label)}</li>)}
        {x.kept.filter((id) => !pack.ideas[id].correct).map((id) => <li key={id} className="flex gap-2 items-center"><span className="chip chip-idea">{t({ ar: 'لسا موجودة', en: 'Still present' })}</span>{t(pack.ideas[id].label)}</li>)}
        {showScience && x.steps.map((s, i) => (!s.before && s.after ? <li key={i} className="flex gap-2 items-center"><span className="chip chip-real">{t({ ar: 'حلقة جديدة', en: 'New link' })}</span>{t(pack.steps[i].text)}</li> : null))}
      </ul>
    </div>
  );
}

const ICONS: Record<ReplayKind, IconName> = {
  explain: 'mic', clarify: 'question', revise: 'replay', predict: 'eye', test: 'flask', help: 'spark', gap: 'link',
  teach: 'cap', challenge: 'question', transfer: 'next', physical: 'home', quiz: 'chart',
};

/** The journey as a chain of moments. Plays step by step on request. */
export function ThinkingReplay({ pack, record, simple = false }: { pack: ConceptPack; record: LearnerRecord; simple?: boolean }) {
  const { t, lang } = useI18n();
  const all = replaySteps(pack, record, lang).filter((s) => !simple || !['quiz', 'clarify'].includes(s.kind));
  const [shown, setShown] = useState(all.length);
  const playing = shown < all.length;
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 200 : 1200);
    return () => clearTimeout(timer);
  }, [shown, playing]);
  if (!all.length) return null;
  return (
    <section className="stack" aria-label={t({ ar: 'رحلة التفكير', en: 'Thinking Replay' })}>
      <div className="row">
        <h3 className="subtitle">{simple ? t({ ar: 'رحلة تفكيرك', en: 'Your thinking journey' }) : t({ ar: 'رحلة التفكير', en: 'Thinking Replay' })}</h3>
        <button type="button" className="btn btn-secondary btn-sm ms-auto no-print" onClick={() => setShown(playing ? all.length : 0)}>
          <Icon name={playing ? 'eye' : 'play'} size={16} />{playing ? t({ ar: 'أظهر الكل', en: 'Show all' }) : t({ ar: 'شغّلها', en: 'Play' })}
        </button>
      </div>
      <ol className="chain">
        {all.slice(0, shown).map((s, i) => (
          <li key={`${s.at}-${i}`} className={`rise ${s.broke ? 'is-probe' : s.kind === 'test' || s.kind === 'transfer' ? 'is-real' : 'is-idea'}`}>
            <span className="chain-dot" aria-hidden="true"><Icon name={ICONS[s.kind]} size={15} /></span>
            <div className="chain-text !py-2">
              <div className="font-bold text-[14.5px]">{s.title}{s.assisted ? <span className="chip chip-idea ms-2">{t({ ar: 'بمساعدة', en: 'assisted' })}</span> : null}</div>
              {s.quote && <div>«{s.quote}»</div>}
              {s.body && <div className="muted text-[14px]">{s.body}</div>}
              {s.kind === 'test' && (
                <div className="row !gap-1.5 mt-1">
                  {s.predicted && <span className="chip">{t({ ar: 'التوقّع', en: 'Predicted' })}: {s.predicted}</span>}
                  {!simple && s.hypothesis && <span className="chip chip-idea">{t({ ar: 'الفكرة بتتوقّع', en: 'Idea predicts' })}: {s.hypothesis}</span>}
                  <span className="chip chip-real">{t({ ar: 'اللي صار', en: 'Observed' })}: {s.real}</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="help">{t({ ar: 'هاي الصورة مبنية على اللي انحكى وانعمل بالدرس بس. تذكّر المدى البعيد ما انقاس.', en: 'Built only from what was said and done in the lesson. Long-term retention was not measured.' })}</p>
    </section>
  );
}
