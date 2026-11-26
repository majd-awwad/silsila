import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { ActivityPlan, ClassEntry, Session } from '../contracts';
import { activity, health, liveClass } from '../brain/client';
import { entryFromSession, interventionGroups, summarise } from '../brain/classInsights';
import { BrandMark } from '../components/NoorAvatar';
import { LearningDNA } from '../components/LearningDNA';
import { ThinkingReplay } from '../components/ThinkingReplay';
import { PACK_LIST, getPack } from '../packs';
import { demoClass } from '../store/demoClass';
import { loadSessions } from '../store/sessions';

const fmt = (n: number, d = 0) => n.toLocaleString('ar-EG', { maximumFractionDigits: d, minimumFractionDigits: d });
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Teacher Intelligence: where each child is stuck, a live class map, and an activity built from the class's real ideas. */
export function Teacher() {
  const [packId, setPackId] = useState(PACK_LIST[0].id);
  const pack = getPack(packId);
  const [local, setLocal] = useState<Session[]>([]);
  const [showDemo, setShowDemo] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [live, setLive] = useState<ClassEntry[]>([]);
  const [store, setStore] = useState<string | null>(null);
  const [plan, setPlan] = useState<ActivityPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { loadSessions().then(setLocal).catch(() => setLocal([])); health().then((h) => setStore(h.liveStore)); }, []);
  useEffect(() => { setPlan(null); }, [packId]);

  // poll the live class every 3 seconds
  useEffect(() => {
    if (!code) return;
    let alive = true;
    const tick = async () => { const r = await liveClass.list(code); if (alive && r) setLive(r.entries); };
    tick();
    const t = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [code]);

  const joinUrl = code ? `${location.origin}/?class=${code}&pack=${packId}&quick=1` : '';
  useEffect(() => {
    if (!joinUrl) { setQr(''); return; }
    QRCode.toString(joinUrl, { type: 'svg', margin: 1, color: { dark: '#060C18', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(''));
  }, [joinUrl]);

  const sessions = useMemo(
    () => [...local.filter((s) => s.pack === packId), ...(showDemo ? demoClass(packId) : [])],
    [local, showDemo, packId],
  );
  const entries = useMemo(() => {
    const byId = new Map<string, ClassEntry>();
    for (const s of sessions) if (s.explanations.length) byId.set(s.id, entryFromSession(s));
    for (const e of live) if (e.pack === packId) byId.set(e.id, e);
    return [...byId.values()];
  }, [sessions, live, packId]);
  const sum = summarise(pack, entries);
  const groups = useMemo(() => interventionGroups(pack, entries), [pack, entries]);
  const done = sessions.filter((s) => s.pre && s.post);
  const pre = avg(done.map((s) => s.pre!.score / s.pre!.total)) * 100;
  const post = avg(done.map((s) => s.post!.score / s.post!.total)) * 100;
  const transfers = entries.filter((e) => e.transferScore !== null).map((e) => e.transferScore!);
  const maxIdea = Math.max(1, ...sum.ideas.map((i) => i.count));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  async function startLive() {
    const c = await liveClass.create(packId);
    if (c) { setCode(c); setLive([]); }
  }
  async function suggest() {
    setPlanning(true);
    setPlan(await activity(pack, entries));
    setPlanning(false);
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(local, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `silsila-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="stage-bg min-h-full p-4 md:p-6">
      <div className="max-w-[1240px] mx-auto flex flex-col gap-5">
        <header className="glass flex flex-wrap items-center gap-3 px-4 py-3">
          <BrandMark />
          <h1 className="font-display text-xl font-bold m-0">شاشة المعلّم</h1>
          <div className="seg" role="tablist" aria-label="الدرس">
            {PACK_LIST.map((p) => <button key={p.id} type="button" role="tab" aria-selected={p.id === packId} aria-pressed={p.id === packId} onClick={() => setPackId(p.id)}>{p.title}</button>)}
          </div>
          <label className="ms-auto flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} />
            أظهر الصف التجريبي
          </label>
          <button type="button" className="btn-ghost" onClick={exportJson} disabled={!local.length}>تصدير الجلسات</button>
          <a href="#/" className="btn-ghost no-underline">رجوع</a>
        </header>

        <p className="text-ink-2 text-sm m-0" data-testid="curriculum">من المنهاج: {pack.curriculum.book} · {pack.curriculum.unit} · {pack.curriculum.lesson} (ص {pack.curriculum.pages}).{pack.curriculum.note ? ` ${pack.curriculum.note}` : ''}</p>

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3" aria-label="ملخص الصف">
          <Tile label="عدد الطلاب" value={fmt(sum.total)} note={`${fmt(live.length)} من الصف الحي`} />
          <Tile label="فهموا المفهوم" value={fmt(sum.understood)} note={`${fmt(sum.needFollowUp)} بحاجة متابعة${sum.helped ? ` · ${fmt(sum.helped)} احتاجوا مساعدة نور` : ''}`} />
          <Tile label="أكثر حلقة مكسورة" value={sum.topLink ? pack.chain[sum.topLink.link].label : '—'} note={sum.topLink ? `عند ${fmt(sum.topLink.count)} طالب` : ''} />
          <Tile label="الاختبار قبل ← بعد" value={done.length ? `${fmt(pre)}٪ ← ${fmt(post)}٪` : '—'} note="الأسئلة البعدية مواقف جديدة" />
          <Tile label="انتقال الفهم" value={transfers.length ? `${fmt(avg(transfers), 1)} / ${fmt(3)}` : '—'} note="تفسير ظاهرة جديدة لحاله" />
        </section>

        <div className="grid lg:grid-cols-[1fr_1.35fr] gap-4">
          <div className="flex flex-col gap-4">
            <section className="glass p-5 flex flex-col gap-3" aria-labelledby="live-h">
              <h2 id="live-h" className="font-display text-lg m-0">الصف الحي</h2>
              {!code ? (
                <>
                  <p className="text-ink-2 text-sm m-0 leading-6">الطلاب (أو الحكّام) بيمسحوا الكود من جوالاتهم، وأفكارهم بتطلع على الخريطة هون وهنّه بيحكوا.</p>
                  <button type="button" className="btn-primary" onClick={startLive}>ابدأ صف حي</button>
                </>
              ) : (
                <div className="flex gap-4 items-center">
                  {qr && <div className="w-40 h-40 bg-white rounded-xl p-1.5 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`رمز QR للانضمام لصف ${code}`} role="img" />}
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-ink-2 text-sm">كود الصف</span>
                    <span className="font-display text-4xl font-bold tracking-widest" dir="ltr">{code}</span>
                    <span className="text-ink-2 text-xs break-all" dir="ltr">{joinUrl}</span>
                    <span className="text-sm">{fmt(live.length)} انضموا</span>
                  </div>
                </div>
              )}
              {store === 'memory' && <p className="text-ink-2 text-xs m-0">التخزين المؤقت بالذاكرة: الصف الحي بيشتغل لما التطبيق شغّال على لابتوب واحد والكل على نفس الشبكة. للنشر على الإنترنت ضيفوا Upstash Redis.</p>}
            </section>

            <section className="glass p-5 flex flex-col gap-4" aria-labelledby="ideas-h">
              <h2 id="ideas-h" className="font-display text-lg m-0">خريطة تصوّرات الصف</h2>
              <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
                {sum.ideas.map((i) => (
                  <li key={i.source} className="grid grid-cols-[130px_1fr_32px] items-center gap-3" title={`${i.label}: ${i.count}`}>
                    <span className="text-sm">{i.label}{i.correct ? ' ✓' : ''}</span>
                    <span className="h-3.5 rounded-e bg-white/5 overflow-hidden">
                      <span className={`block h-full rounded-e ${i.correct ? 'bg-good/80' : 'bg-warm/80'}`} style={{ width: `${(i.count / maxIdea) * 100}%` }} />
                    </span>
                    <span className="text-sm text-ink-2 tabular-nums">{fmt(i.count)}</span>
                  </li>
                ))}
                {!sum.ideas.length && <li className="text-ink-2 text-sm">لسا ما في أفكار.</li>}
              </ul>
            </section>

            <section className="glass p-5 flex flex-col gap-3" aria-labelledby="grp-h">
              <h2 id="grp-h" className="font-display text-lg m-0">مجموعات صغيرة للتدخّل</h2>
              <p className="text-ink-2 text-sm m-0">الأطفال اللي عندهم نفس الفكرة الغلط مع بعض، ومعهم التجربة اللي بتكسر فكرتهم.</p>
              {groups.length === 0 && <p className="text-ink-2 text-sm m-0">ما في مجموعات لسا.</p>}
              {groups.map((g) => (
                <div key={g.source ?? 'help'} className="rounded-2xl border border-[var(--line)] p-3 flex flex-col gap-1 leading-7">
                  <div className="flex items-center gap-2"><b>{g.label}</b><span className="chip warm ms-auto">{fmt(g.members.length)} طالب</span></div>
                  <div className="text-sm">{g.members.join('، ')}</div>
                  <div className="text-sm text-ink-2">{g.move}</div>
                  {g.helpers.length > 0 && <div className="text-xs text-water">ممكن يساعدهم: {g.helpers.join('، ')}</div>}
                </div>
              ))}
            </section>

            <section className="glass p-5 flex flex-col gap-3" aria-labelledby="act-h">
              <h2 id="act-h" className="font-display text-lg m-0">نشاط مبني على أخطاء صفك</h2>
              <p className="text-ink-2 text-sm m-0">النظام بيعرف شو اللي ما فهموه، مش بس اسم الدرس.{sum.topWrong ? ` أشيع تصوّر: «${pack.sources[sum.topWrong].label}».` : ''}</p>
              <button type="button" className="btn-warm" onClick={suggest} disabled={planning || !entries.length}>{planning ? 'عم يجهّز النشاط…' : 'اقترح نشاط ١٥ دقيقة'}</button>
              {plan && (
                <div className="rounded-2xl border border-warm/50 bg-warm/10 p-4 flex flex-col gap-2 leading-7">
                  <div className="flex items-center gap-2"><b className="font-display text-lg">{plan.title}</b><span className={`chip ${plan.source === 'ai' ? 'cool' : 'warm'} ms-auto`}>{plan.source === 'ai' ? 'ذكاء اصطناعي' : 'قالب جاهز'}</span></div>
                  <div className="text-sm">{plan.goal}</div>
                  {plan.materials.length > 0 && <div className="text-ink-2 text-sm">الأدوات: {plan.materials.join('، ')}</div>}
                  <ol className="m-0 ps-5 text-sm flex flex-col gap-1">
                    {plan.steps.map((s, i) => <li key={i}><b>{s.title} ({fmt(s.minutes)} د):</b> {s.detail}</li>)}
                  </ol>
                  <div className="text-sm"><b>سؤال تحقق:</b> {plan.check}</div>
                </div>
              )}
            </section>
          </div>

          <section className="glass p-5 flex flex-col gap-3 overflow-x-auto" aria-labelledby="kids-h">
            <h2 id="kids-h" className="font-display text-lg m-0">كل طالب: وين علق ووين وصل</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-ink-2">
                  {['الطالب', 'فكرته الأولى', 'الحلقة', 'فهم؟', 'علّم نور', 'انتقال', ''].map((h, i) => (
                    <th key={i} className="text-start font-semibold p-2 border-b border-[var(--line)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const s = sessionById.get(e.id);
                  const isOpen = open === e.id;
                  return (
                    <FragmentRow key={e.id}>
                      <tr className="align-top">
                        <td className="p-2 border-b border-white/5 whitespace-nowrap">{e.pseudonym}{s?.demo ? <span className="text-ink-2 text-xs"> · تجريبي</span> : !s ? <span className="text-water text-xs"> · حي</span> : null}</td>
                        <td className="p-2 border-b border-white/5">{e.firstCaption || '—'}</td>
                        <td className="p-2 border-b border-white/5 whitespace-nowrap text-bad">{e.brokenLink ? pack.chain[e.brokenLink].label : '—'}</td>
                        <td className="p-2 border-b border-white/5">{e.understood ? <span className="text-good">نعم</span> : <span className="text-ink-2">لسا</span>}</td>
                        <td className="p-2 border-b border-white/5">{e.taught ? <span className="text-good">نعم</span> : <span className="text-ink-2">لسا</span>}</td>
                        <td className="p-2 border-b border-white/5 tabular-nums">{e.transferScore === null ? '—' : `${fmt(e.transferScore)}/${fmt(3)}`}</td>
                        <td className="p-2 border-b border-white/5">{s && <button type="button" className="text-water text-xs underline cursor-pointer bg-transparent border-0" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}>{isOpen ? 'سكّر' : 'خريطة الفهم'}</button>}</td>
                      </tr>
                      {isOpen && s && (
                        <tr><td colSpan={7} className="p-3 border-b border-white/5"><div className="grid md:grid-cols-2 gap-4"><div className="max-w-[420px]"><LearningDNA pack={pack} session={s} /></div><ThinkingReplay pack={pack} session={s} /></div></td></tr>
                      )}
                    </FragmentRow>
                  );
                })}
              </tbody>
            </table>
            {!entries.length && <p className="text-ink-2 m-0">لسا ما في جلسات.</p>}
          </section>
        </div>
        <p className="text-ink-2 text-xs m-0">البيانات على هالجهاز، وبالصف الحي بس ملخّص الفكرة واسم مستعار. ما في أسماء حقيقية ولا تسجيل صوت.</p>
      </div>
    </main>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
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
