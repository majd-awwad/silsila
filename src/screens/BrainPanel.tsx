import type { Diagnosis, ExperimentId } from '../contracts';
import { CHAIN_IDS, EXPERIMENT_IDS } from '../contracts';
import { outcomeMatches } from '../brain/predictions';
import { CHAIN_LABEL, EXPERIMENTS, OUTCOME_LABEL, PATH_LABEL, RUBRIC_LABEL, SOURCE_LABEL } from '../lesson/condensation';

/** «عقل سلسلة»: what the AI understood, shown openly (for the child, the teacher and the judges). */
export function BrainPanel({ diag, open, busy, onRun }: {
  diag: Diagnosis | null; open: boolean; busy: boolean; onRun: (e: ExperimentId) => void;
}) {
  const m = diag?.model ?? null;
  const best = diag?.best_experiment ?? null;
  return (
    <aside id="brain" className={`lab-brain glass ${open ? 'open' : ''}`} aria-label="عقل سلسلة: شو فهم الذكاء الاصطناعي">
      <h2 className="m-0 font-display text-[17px] flex items-center gap-2">
        عقل سلسلة
        {diag && (
          <span className={`chip ${diag.source === 'ai' ? 'cool' : 'warm'} ms-auto`}>
            {diag.source === 'ai' ? 'Claude' : 'وضع احتياطي'}
          </span>
        )}
      </h2>

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">فكرة الطفل زي ما فهمها الذكاء الاصطناعي</div>
        {diag?.caption
          ? <div className="font-display text-[17px] leading-relaxed font-medium">{diag.caption}</div>
          : <div className="text-ink-2 text-sm">لسا ما حكى. أول ما يشرح، بترسم المرآة فكرته بالأبعاد الثلاثة.</div>}
        {diag?.evidence && <div className="text-ink-2 text-[13px]">«{diag.evidence}»</div>}
      </section>

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">مكونات فكرته (منها بينبني المشهد)</div>
        <div className="flex flex-wrap gap-1.5">
          {m ? (
            <>
              {m.sources.map((s) => <span key={s} className="chip warm">{SOURCE_LABEL[s]}</span>)}
              <span className="chip">{PATH_LABEL[m.path]}</span>
              {m.needs_cold && <span className="chip cool">بدها برد</span>}
            </>
          ) : <span className="chip">—</span>}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">سلسلة الفهم: وين الحلقة المكسورة؟</div>
        <div className="grid grid-cols-5 gap-1.5">
          {CHAIN_IDS.map((id) => {
            const v = diag?.chain[id] ?? 'unknown';
            const cls = diag?.broken_link === id ? 'bad' : v === 'ok' ? 'ok' : '';
            return <div key={id} className={`link ${cls}`}>{CHAIN_LABEL[id]}</div>;
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">ثقة التشخيص</div>
        <div className="h-1.5 rounded bg-white/10 overflow-hidden">
          <div className="h-full bg-water rounded transition-all" style={{ width: `${Math.round((diag?.confidence ?? 0) * 100)}%` }} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">شو بتتوقّع فكرته، وشو بصير فعلاً</div>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-ink-2"><th className="text-start font-semibold p-1 border-b border-[var(--line)]">التجربة</th><th className="text-start font-semibold p-1 border-b border-[var(--line)]">فكرته</th><th className="text-start font-semibold p-1 border-b border-[var(--line)]">الحقيقة</th></tr>
          </thead>
          <tbody>
            {EXPERIMENT_IDS.map((e) => {
              const p = m?.predictions[e];
              const ok = p ? outcomeMatches(e, p) : null;
              return (
                <tr key={e} className={e === best ? 'bg-warm/10' : ''}>
                  <td className="p-1.5 border-b border-white/5">{EXPERIMENTS[e].short}</td>
                  <td className={`p-1.5 border-b border-white/5 font-bold ${ok === null ? '' : ok ? 'text-good' : 'text-bad'}`}>{p ? OUTCOME_LABEL[p] : '—'}</td>
                  <td className="p-1.5 border-b border-white/5">{OUTCOME_LABEL[EXPERIMENTS[e].real]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <button type="button" className="btn-warm" disabled={!best || busy} onClick={() => best && onRun(best)}>
        {best ? `جرّب: ${EXPERIMENTS[best].name}` : 'جرّب التجربة اللي بتكسر الفكرة'}
      </button>

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">معيار الإتقان</div>
        <div className="flex gap-1.5">
          {(Object.keys(RUBRIC_LABEL) as (keyof typeof RUBRIC_LABEL)[]).map((k) => (
            <span key={k} className={`flex-1 text-center text-[11.5px] rounded-lg py-1.5 px-1 border ${diag?.rubric[k] ? 'border-good/60 text-good bg-good/10' : 'border-[var(--line)] text-ink-2'}`}>
              {RUBRIC_LABEL[k]}
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}
