/**
 * Counterfactual Lab: the child sets the variables and tests their own hypothesis.
 * Presets are shortcuts; the experiment that breaks the idea is marked.
 */
import type { Conditions } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { conditionsFor } from '../brain/world';

interface Props {
  pack: ConceptPack;
  cond: Conditions;
  best: string | null;
  busy: boolean;
  onChange: (c: Conditions) => void;
  onTest: (c: Conditions) => void;
}

export function LabControls({ pack, cond, best, busy, onChange, onTest }: Props) {
  return (
    <section className="lab-controls glass" aria-label="مختبر الفرضيات: غيّر المتغيّرات واختبر فكرتك">
      <div className="lab-vars">
        {pack.variables.map((v) => (
          <div key={v.id} className="var" role="group" aria-label={v.label}>
            <span>{v.label}</span>
            <div className="seg">
              {v.options.map((o) => (
                <button key={o.id} type="button" aria-pressed={cond[v.id] === o.id} onClick={() => onChange({ ...cond, [v.id]: o.id })}>{o.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="lab-presets">
        <button type="button" className="btn-warm !h-[34px] !text-[14px] !px-4" disabled={busy} onClick={() => onTest(cond)}>اختبر فرضيتك</button>
        <span className="text-ink-2 text-xs ms-1">أو جرّب:</span>
        {pack.presets.map((p) => (
          <button key={p.id} type="button" className={p.id === best ? 'best' : ''} onClick={() => { const c = conditionsFor(pack, p.change); onChange(c); onTest(c); }}>
            {p.short}{p.id === best ? ' ★' : ''}
          </button>
        ))}
        <button type="button" onClick={() => onChange({ ...pack.baseline })}>رجّع</button>
      </div>
    </section>
  );
}
