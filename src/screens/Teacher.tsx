import { useEffect, useMemo, useState } from 'react';
import type { ChainId, ExperimentId, Session, Source } from '../contracts';
import { CHAIN_IDS, EXPERIMENT_IDS } from '../contracts';
import { BrandMark } from '../components/NoorAvatar';
import { CHAIN_LABEL, EXPERIMENTS, SOURCE_LABEL } from '../lesson/condensation';
import { demoClass } from '../store/demoClass';
import { loadSessions } from '../store/sessions';

const fmt = (n: number, d = 0) => n.toLocaleString('ar-EG', { maximumFractionDigits: d, minimumFractionDigits: d });
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function firstIdea(s: Session) {
  return s.explanations.find((e) => e.diagnosis.model)?.diagnosis ?? null;
}

/** Teacher dashboard: where each child is stuck, and which experiment helps the whole class. */
export function Teacher() {
  const [real, setReal] = useState<Session[]>([]);
  const [showDemo, setShowDemo] = useState(true);
  useEffect(() => { loadSessions().then(setReal).catch(() => setReal([])); }, []);
  const sessions = useMemo(() => [...real, ...(showDemo ? demoClass() : [])], [real, showDemo]);

  const done = sessions.filter((s) => s.pre && s.post);
  const pre = avg(done.map((s) => s.pre!.score / s.pre!.total)) * 100;
  const post = avg(done.map((s) => s.post!.score / s.post!.total)) * 100;
  const taught = sessions.filter((s) => s.teach?.caught).length;

  const sourceCounts = new Map<Source, number>();
  const linkCounts = new Map<ChainId, number>();
  const expHelps = new Map<ExperimentId, number>();
  for (const s of sessions) {
    const d = firstIdea(s);
    if (d?.model) for (const src of d.model.sources) sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
    if (d?.broken_link) linkCounts.set(d.broken_link, (linkCounts.get(d.broken_link) ?? 0) + 1);
    if (d?.best_experiment) expHelps.set(d.best_experiment, (expHelps.get(d.best_experiment) ?? 0) + 1);
  }
  const ideas = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxIdea = Math.max(1, ...ideas.map(([, n]) => n));
  const topLink = CHAIN_IDS.map((c) => [c, linkCounts.get(c) ?? 0] as const).sort((a, b) => b[1] - a[1])[0];
  const classExp = EXPERIMENT_IDS.map((e) => [e, expHelps.get(e) ?? 0] as const).sort((a, b) => b[1] - a[1])[0];

  function exportJson() {
    const blob = new Blob([JSON.stringify(real, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `silsila-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="stage-bg min-h-full p-4 md:p-6">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-5">
        <header className="glass flex flex-wrap items-center gap-3 px-4 py-3">
          <BrandMark />
          <h1 className="font-display text-xl font-bold m-0">شاشة المعلّم · درس الكاسة الباردة</h1>
          <label className="ms-auto flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} />
            أظهر الصف التجريبي ({fmt(demoClass().length)} طفل)
          </label>
          <button type="button" className="btn-ghost" onClick={exportJson} disabled={!real.length}>تصدير الجلسات الحقيقية</button>
          <a href="#/" className="btn-ghost inline-flex items-center no-underline">رجوع</a>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="ملخص الصف">
          <Tile label="عدد الأطفال" value={fmt(sessions.length)} note={`${fmt(real.length)} حقيقي`} />
          <Tile label="متوسط الاختبار" value={`${fmt(pre)}٪ ← ${fmt(post)}٪`} note="قبل الدرس ← بعده" />
          <Tile label="علّموا نور صح" value={`${fmt(taught)} من ${fmt(sessions.length)}`} note="وصلوا للمعيار الكامل" />
          <Tile label="أكثر حلقة مكسورة" value={topLink && topLink[1] ? CHAIN_LABEL[topLink[0]] : '—'} note={topLink && topLink[1] ? `عند ${fmt(topLink[1])} طفل` : ''} />
        </section>

        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
          <section className="glass p-5 flex flex-col gap-4" aria-labelledby="ideas-h">
            <h2 id="ideas-h" className="font-display text-lg m-0">من وين الأطفال مفكّرين النقط إجت؟</h2>
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {ideas.map(([src, n]) => (
                <li key={src} className="grid grid-cols-[120px_1fr_32px] items-center gap-3" title={`${SOURCE_LABEL[src]}: ${n}`}>
                  <span className="text-sm">{SOURCE_LABEL[src]}</span>
                  <span className="h-3.5 rounded-e bg-white/5 overflow-hidden">
                    <span className="block h-full rounded-e bg-warm/80" style={{ width: `${(n / maxIdea) * 100}%` }} />
                  </span>
                  <span className="text-sm text-ink-2 tabular-nums">{fmt(n)}</span>
                </li>
              ))}
            </ul>
            {classExp && classExp[1] > 0 && (
              <div className="rounded-2xl border border-warm/50 bg-warm/10 p-4 leading-7">
                <b>اقتراح للصف بكرة:</b> {EXPERIMENTS[classExp[0]].name}. بتكسر فكرة {fmt(classExp[1])} طفل مرة وحدة.
                <div className="text-ink-2 text-sm mt-1">{EXPERIMENTS[classExp[0]].home} ({EXPERIMENTS[classExp[0]].safety})</div>
              </div>
            )}
          </section>

          <section className="glass p-5 flex flex-col gap-3 overflow-x-auto" aria-labelledby="kids-h">
            <h2 id="kids-h" className="font-display text-lg m-0">كل طفل: وين علق ووين وصل</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-ink-2 text-start">
                  {['الطفل', 'فكرته الأولى', 'الحلقة', 'التجربة', 'قبل ← بعد', 'علّم نور'].map((h) => (
                    <th key={h} className="text-start font-semibold p-2 border-b border-[var(--line)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const d = firstIdea(s);
                  const ex = s.experiments[0];
                  return (
                    <tr key={s.id} className="align-top">
                      <td className="p-2 border-b border-white/5 whitespace-nowrap">{s.pseudonym}{s.demo && <span className="text-ink-2 text-xs"> · تجريبي</span>}</td>
                      <td className="p-2 border-b border-white/5">{d?.caption.replace('هيك إنت شايفها: ', '') ?? '—'}</td>
                      <td className="p-2 border-b border-white/5 whitespace-nowrap text-bad">{d?.broken_link ? CHAIN_LABEL[d.broken_link] : '—'}</td>
                      <td className="p-2 border-b border-white/5 whitespace-nowrap">{ex ? `${EXPERIMENTS[ex.exp].short}${ex.contradicted ? ' ✕' : ''}` : '—'}</td>
                      <td className="p-2 border-b border-white/5 whitespace-nowrap tabular-nums">{s.pre && s.post ? `${fmt(s.pre.score)} ← ${fmt(s.post.score)}` : '—'}</td>
                      <td className="p-2 border-b border-white/5">{s.teach?.caught ? <span className="text-good">نعم</span> : <span className="text-ink-2">لسا</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!sessions.length && <p className="text-ink-2 m-0">لسا ما في جلسات. أول طفل بيخلّص الدرس بيبيّن هون.</p>}
          </section>
        </div>
        <p className="text-ink-2 text-xs m-0">البيانات محفوظة على هالجهاز بس. أسماء مستعارة، وما في تسجيل صوت.</p>
      </div>
    </main>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="glass p-4 flex flex-col gap-1">
      <span className="text-ink-2 text-sm">{label}</span>
      <span className="font-display text-2xl font-bold">{value}</span>
      <span className="text-ink-2 text-xs">{note}</span>
    </div>
  );
}
