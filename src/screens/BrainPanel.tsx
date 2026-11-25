import type { Diagnosis } from '../contracts';
import { CHAIN_IDS, RUBRIC_KEYS } from '../contracts';
import { compare, conditionsFor } from '../brain/world';
import { ChainView } from '../components/ChainView';
import type { ConceptPack } from '../packs/types';

/** «عقل سلسلة»: what the AI understood, and what the deterministic engine computed from it. Shown openly. */
export function BrainPanel({ pack, diag, open, busy, onRun }: {
  pack: ConceptPack; diag: Diagnosis | null; open: boolean; busy: boolean; onRun: (presetId: string) => void;
}) {
  const m = diag?.model ?? null;
  const best = diag?.best_experiment ?? null;
  const bestPreset = pack.presets.find((p) => p.id === best);
  return (
    <aside id="brain" className={`lab-brain glass ${open ? 'open' : ''}`} aria-label="عقل سلسلة: شو فهم الذكاء الاصطناعي">
      <h2 className="m-0 font-display text-[17px] flex items-center gap-2">
        عقل سلسلة
        {diag && <span className={`chip ${diag.source === 'ai' ? 'cool' : 'warm'} ms-auto`}>{diag.source === 'ai' ? 'Claude' : 'وضع احتياطي'}</span>}
      </h2>

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">فكرة الطفل زي ما فهمها الذكاء الاصطناعي</div>
        {diag?.caption
          ? <div className="font-display text-[17px] leading-relaxed font-medium">{diag.caption}</div>
          : <div className="text-ink-2 text-sm">لسا ما حكى. أول ما يشرح، بترسم المرآة فكرته.</div>}
        {diag?.evidence && <div className="text-ink-2 text-[13px]">«{diag.evidence}»</div>}
      </section>

      {diag && <ChainView pack={pack} diag={diag} />}

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">مكونات فكرته (منها بينبني المشهد)</div>
        <div className="flex flex-wrap gap-1.5">
          {m ? (
            <>
              {m.sources.map((s) => <span key={s} className="chip warm">{pack.sources[s]?.label ?? s}</span>)}
              <span className="chip">{pack.paths[m.path]?.label ?? m.path}</span>
              {m.requires.map((r) => <span key={r} className="chip cool">{pack.requires[r]?.label ?? r}</span>)}
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
            return <div key={id} className={`link ${cls}`}>{pack.chain[id].label}</div>;
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
        <div className="text-xs text-ink-2 font-semibold">المحرّك بيحسب: شو بتتوقّع فكرته، وشو بصير فعلاً</div>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-ink-2">{['التجربة', 'فكرته', 'الحقيقة'].map((h) => <th key={h} className="text-start font-semibold p-1 border-b border-[var(--line)]">{h}</th>)}</tr>
          </thead>
          <tbody>
            {pack.presets.map((p) => {
              const r = m ? compare(pack, m, conditionsFor(pack, p.change)) : null;
              return (
                <tr key={p.id} className={p.id === best ? 'bg-warm/10' : ''}>
                  <td className="p-1.5 border-b border-white/5">{p.short}</td>
                  <td className={`p-1.5 border-b border-white/5 font-bold ${r ? (r.contradicted ? 'text-bad' : 'text-good') : ''}`}>{r ? pack.outcomes[r.kid] : '—'}</td>
                  <td className="p-1.5 border-b border-white/5">{pack.outcomes[pack.realOutcome(conditionsFor(pack, p.change))]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <button type="button" className="btn-warm" disabled={!bestPreset || busy} onClick={() => bestPreset && onRun(bestPreset.id)}>
        {bestPreset ? `جرّب: ${bestPreset.name}` : 'جرّب التجربة اللي بتكسر الفكرة'}
      </button>

      <section className="flex flex-col gap-2">
        <div className="text-xs text-ink-2 font-semibold">معيار الإتقان (من كلام الطفل)</div>
        <div className="flex gap-1.5">
          {RUBRIC_KEYS.map((k, i) => (
            <span key={k} className={`flex-1 text-center text-[11.5px] rounded-lg py-1.5 px-1 border ${diag?.rubric[k] ? 'border-good/60 text-good bg-good/10' : 'border-[var(--line)] text-ink-2'}`}>
              {pack.scienceChain[i]}
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}
