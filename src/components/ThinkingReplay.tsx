import { useEffect, useState } from 'react';
import type { Session } from '../contracts';
import { replaySteps } from '../brain/replay';
import type { ConceptPack } from '../packs/types';

const icon: Record<string, string> = { idea: '💭', test: '🧪', revise: '🔄', noor: '🤖', challenge: '🎯', transfer: '⭐' };
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "Thinking Replay": the child's journey step by step. Plays automatically; with reduced motion it just shows everything. */
export function ThinkingReplay({ pack, session }: { pack: ConceptPack; session: Session }) {
  const steps = replaySteps(pack, session);
  const [shown, setShown] = useState(reduced() ? steps.length : 0);

  useEffect(() => {
    if (shown >= steps.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 300 : 1100);
    return () => clearTimeout(t);
  }, [shown, steps.length]);

  if (!steps.length) return null;
  return (
    <section aria-label="رحلة تفكيرك" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-base m-0">رحلة تفكيرك</h2>
        <button type="button" className="btn-ghost ms-auto text-xs" onClick={() => setShown(shown >= steps.length ? 0 : steps.length)}>
          {shown >= steps.length ? 'شغّلها من جديد' : 'أظهر الكل'}
        </button>
      </div>
      <ol className="m-0 p-0 list-none flex flex-col gap-2" aria-live="polite">
        {steps.slice(0, shown).map((s, i) => (
          <li key={i} className={`rounded-2xl border p-3 leading-7 ${s.broke ? 'border-bad/60 bg-bad/10' : s.kind === 'test' ? 'border-good/40' : 'border-[var(--line)]'}`}>
            <div><span aria-hidden="true">{icon[s.kind]} </span><b>{s.title}</b></div>
            <div className="text-sm">{s.body}</div>
            {s.kind === 'test' && <div className="text-xs text-ink-2">فكرتك: {s.predicted} · الحقيقة: {s.real}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}
