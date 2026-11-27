/**
 * The hero is the product, not a picture of it: a sentence goes through the real offline engine and the real
 * planner. It shows what the idea predicts and which experiment would test it, never the experiment's result.
 */
import { useMemo, useState } from 'react';
import type { L } from '../../contracts';
import { heuristicDiagnose } from '../../brain/heuristic';
import { DEFAULT_CONSTRAINTS, plan } from '../../brain/planner';
import { experimentById } from '../../brain/world';
import { useI18n } from '../../i18n';
import { getPack } from '../../packs';
import { href } from '../../router';
import { ReasonChain } from '../../ui/Evidence';
import { Icon } from '../../ui/icons';
import { PhenomenonPreview } from '../../ui/PhenomenonPreview';
import { ExperimentStage } from '../../ui/ExperimentStage';
import { experimentConditions } from '../../brain/world';

const THOUGHTS: L[] = [
  { ar: 'الكاسة بتعرق زيّنا', en: 'The glass is sweating like us' },
  { ar: 'المي بتنزّ من الكاسة لبرّا', en: 'Water leaks out through the glass' },
  { ar: 'البرد نفسه بيصير مي', en: 'The coldness turns into water' },
];

const featured = ['condensation', 'fractions', 'shadows'] as const;

export function ThoughtLab() {
  const { t } = useI18n();
  const [id, setId] = useState<string>('condensation');
  return <section className="stage lab-hero" aria-label={t({ ar: 'مختبر الاكتشاف', en: 'Discovery lab' })}>
    <div className="thoughts" role="group" aria-label={t({ ar: 'الظاهرة', en: 'Phenomenon' })}>
      {featured.map((key) => <button className="thought" type="button" key={key} aria-pressed={id === key} onClick={() => setId(key)}>{t(getPack(key).title)}</button>)}
    </div>
    <Lab key={id} id={id} />
  </section>;
}

function Lab({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const pack = getPack(id);
  const samples = id === 'condensation' ? THOUGHTS : pack.samples.slice(1, 4);
  const [picked, setPicked] = useState(0);
  const [own, setOwn] = useState('');
  const [typed, setTyped] = useState('');
  const text = typed || samples[picked][lang];
  const d = useMemo(() => heuristicDiagnose(pack, text, { pack: pack.id, lang, previous: [] }), [pack, text, lang]);
  const next = useMemo(() => {
    if (!d.model) return null;
    const p = plan(pack, [{ key: 'you', ideas: d.ideas.map((i) => i.id), model: d.model, learners: 1 }], DEFAULT_CONSTRAINTS);
    const r = p.recommended;
    return r ? { x: experimentById(pack, r.id)!, predicts: r.predictions[0].outcome } : null;
  }, [pack, d]);

  return (
    <>
      <h2 className="text-[18px]">{t(pack.question)}</h2>
      <PhenomenonPreview pack={pack} compact />
      <div className="thoughts" role="group" aria-label={t({ ar: 'أفكار للتجربة', en: 'Example thoughts' })}>
        {samples.map((th, i) => (
          <button key={i} type="button" className="thought" aria-pressed={!typed && i === picked} onClick={() => { setPicked(i); setTyped(''); setOwn(''); }}>{t(th)}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setTyped(own.trim()); }}>
        <label className="sr-only" htmlFor="own-thought">{t({ ar: 'أو اكتب فكرتك', en: 'Or write your own idea' })}</label>
        <input id="own-thought" value={own} maxLength={200} onChange={(e) => setOwn(e.target.value)} placeholder={t({ ar: 'أو اكتب فكرتك إنت…', en: 'Or write your own idea…' })} />
        <button type="submit" className="btn btn-warm" disabled={!own.trim()}>{t({ ar: 'حلّل', en: 'Analyse' })}</button>
      </form>
      <div className="lab-result" aria-live="polite" key={text + lang}>
        {d.chain.length > 0 && <div className="rise"><ReasonChain steps={d.chain} wrongStep={d.wrongStep} tone={d.status === 'correct' ? 'real' : 'idea'} /></div>}
        {!d.chain.length && <div className="stack !gap-2"><p>{d.noor}</p>
          <button className="btn btn-secondary btn-sm self-start" onClick={() => {
            setOwn(text + ' ');
            document.getElementById('own-thought')?.focus();
          }}>{t({ ar: 'وضّح فكرتك', en: 'Clarify your idea' })}</button>
        </div>}
        {next ? (
          <div className="rise flex flex-col gap-1 rounded-2xl p-3 border border-[var(--stage-line)]" style={{ animationDelay: '.15s' }}>
            <span className="text-[13px] muted">{t({ ar: 'التجربة اللي اختارها المخطِّط لتختبر هالفكرة', en: 'The experiment the planner picked to test this idea' })}</span>
            <strong>{t(next.x.name)}</strong>
            <ExperimentStage pack={pack} cond={experimentConditions(pack, next.x.id)} model={d.model} revealed={false} allow3d={false} quietSetup />
            <span>{t({ ar: 'الفكرة بتتوقّع:', en: 'This idea predicts:' })} <b className="text-idea">{t(pack.outcomes[next.predicts])}</b>. {t({ ar: 'وإنت شو بتتوقّع؟', en: 'What do you predict?' })}</span>
          </div>
        ) : d.status === 'correct' ? (
          <p className="rise m-0">{t({ ar: 'هالشرح كامل. المخطِّط بيقترح تحدّي جديد بدل تجربة تصحيح.', en: 'A complete explanation: the planner offers a new challenge instead of remediation.' })}</p>
        ) : null}
      </div>
      <div className="row">
        <a className="btn btn-secondary btn-sm" href={href('/learn/' + id + '?quick=1')}><Icon name="flask" size={16} />{t({ ar: 'جرّبها بالمختبر', en: 'Test it in the lab' })}</a>
        <span className="text-[12px] muted">{t({ ar: 'هاد العرض بيشتغل على جهازك بالقواعد الاحتياطية.', en: 'This preview runs on your device with the offline rules.' })}</span>
      </div>
    </>
  );
}
