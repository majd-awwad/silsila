/**
 * Judge experience: the presenter's control panel. Pre-flight checks, a timed demonstration script with working
 * shortcuts, a live room for judges, a clearly labelled sample classroom, offline mode, reset, measured evidence
 * and prepared answers. It never creates participants or answers on anyone's behalf in a live room.
 */
import { useEffect, useState } from 'react';
import type { Health } from '../../contracts';
import { SAMPLE_CODE } from '../../brain/sample';
import { health, offlineMode, roomApi, sampleStore, teacherRooms } from '../../brain/client';
import { useI18n } from '../../i18n';
import { PACK_LIST, getPack } from '../../packs';
import { RESOURCE_IDS } from '../../packs/resources';
import { absoluteLink, href } from '../../router';
import { clearSoloDrafts } from '../student/storage';
import { clearRecords } from '../../store/records';
import { Icon } from '../../ui/icons';
import { Notice, QR, Segmented, Shell } from '../../ui/kit';
import { EvidencePanel } from './EvidencePanel';
import { JUDGE_QA } from './qa';
import { STEPS } from './steps';
import './judge.css';

const DONE_KEY = 'silsila-demo-done';
const localOnly = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

function readDone(): string[] {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]'); } catch { return []; }
}

function Timer({ limit }: { limit: number }) {
  const { t, n } = useI18n();
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (start === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [start]);
  const s = start === null ? 0 : Math.max(0, Math.floor((now - start) / 1000));
  const two = (v: number) => (v < 10 ? n(0) : '') + n(v);
  return (
    <div className="row">
      <span className={`jd-timer ${s > limit ? 'over' : ''}`} role="timer" dir="ltr">{two(Math.floor(s / 60))}:{two(s % 60)}</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (start === null) { setNow(Date.now()); setStart(Date.now()); } else setStart(null); }}>
        <Icon name={start === null ? 'play' : 'stop'} size={16} />{start === null ? t({ ar: 'ابدأ المؤقّت', en: 'Start timer' }) : t({ ar: 'صفّر', en: 'Reset' })}
      </button>
    </div>
  );
}

export function JudgeApp(_: { path?: string[] }) {
  const { t, lang, n } = useI18n();
  const [track, setTrack] = useState<'short' | 'full'>('short');
  const [done, setDone] = useState<string[]>(readDone);
  const [status, setStatus] = useState<Health | null>(null);
  const [offline, setOffline] = useState(offlineMode.get());
  const [packId, setPackId] = useState('condensation');
  const [room, setRoom] = useState<string | null>(() => teacherRooms.list()[0]?.code ?? null);
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const check = () => { setStatus(null); health().then(setStatus); };
  useEffect(check, [offline]);
  const toggleDone = (id: string) => {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    try { localStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  async function createRoom() {
    setBusy(true);
    setMessage(null);
    const pack = getPack(packId);
    const r = await roomApi.create({ pack: pack.id, lang, grade: 5, minutes: 45, resources: [...RESOURCE_IDS], supervision: true, objective: null });
    setBusy(false);
    if (r.ok) setRoom(r.data.code);
    else setMessage({ tone: 'error', text: t({ ar: 'ما قدرنا نعمل صف حي (السيرفر مش متاح). استعملوا الصف التجريبي الموسوم.', en: 'Could not create a live room (server unavailable). Use the labelled sample classroom.' }) });
  }

  async function reset() {
    if (!confirm(t({ ar: 'نمسح جلسات الطلاب المحفوظة على هالجهاز ونرجّع الصف التجريبي وخطوات العرض؟ ما في تراجع.', en: 'Delete lessons saved on this device and reset the sample classroom and demo steps? This cannot be undone.' }))) return;
    await clearRecords().catch(() => {});
    clearSoloDrafts();
    sampleStore.reset(packId, lang);
    setDone([]);
    try { localStorage.removeItem(DONE_KEY); sessionStorage.clear(); } catch { /* private mode */ }
    setMessage({ tone: 'info', text: t({ ar: 'تم التصفير.', en: 'Reset done.' }) });
  }

  const steps = STEPS.filter((s) => track === 'full' || !s.fullOnly);
  const chip = (ok: boolean, yes: string, no: string) => <span className={`chip ${ok ? 'chip-real' : 'chip-idea'}`}><Icon name={ok ? 'check' : 'question'} size={13} />{ok ? yes : no}</span>;
  const joinUrl = room ? absoluteLink(`/join/${room}`) : '';

  return (
    <Shell nav={[{ to: '/judge', label: { ar: 'تجربة الحكّام', en: 'Judge experience' }, active: true }, { to: '/judge/vision', label: { ar: 'الرؤية وخارطة الطريق', en: 'Vision and roadmap' } }, { to: '/teacher', label: { ar: 'المعلّم', en: 'Teacher' } }]}>
      <div className="stack !gap-6">
        <header className="row">
          <div className="stack !gap-1">
            <h1 className="title">{t({ ar: 'تجربة الحكّام', en: 'Judge experience' })}</h1>
            <p className="muted">{t({ ar: 'فحص قبل العرض، سكربت موقّت، وأدلّة صادقة.', en: 'Pre-flight check, a timed script and honest evidence.' })}</p>
          </div>
          <div className="ms-auto"><Timer limit={track === 'short' ? 300 : 540} /></div>
        </header>

        <section className="card stack" aria-labelledby="pre-h">
          <div className="row">
            <h2 id="pre-h" className="subtitle">{t({ ar: 'فحص قبل العرض', en: 'Pre-flight check' })}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={check}><Icon name="replay" size={16} />{t({ ar: 'افحص من جديد', en: 'Check again' })}</button>
          </div>
          <div className="row" aria-live="polite">
            {!status ? <span className="spinner" aria-label={t({ ar: 'عم يفحص', en: 'Checking' })} /> : (
              <>
                {chip(status.online, t({ ar: 'السيرفر شغّال', en: 'Server reachable' }), t({ ar: 'بدون سيرفر', en: 'No server' }))}
                {!status.ai
                  ? chip(false, '', t({ ar: 'بدون ذكاء اصطناعي (قواعد احتياطية)', en: 'No AI (offline rules)' }))
                  : <>
                    {chip(true, `${t({ ar: 'مفتاح موجود', en: 'Key present' })}: ${status.model ?? ''}`, '')}
                    {!status.last
                      ? chip(false, '', t({ ar: 'لسا ما اتجرّب طلب حقيقي', en: 'No real request yet' }))
                      : chip(status.last.ok && !status.paused,
                        t({ ar: 'آخر طلب حقيقي نجح', en: 'Last real request worked' }),
                        t({ ar: `آخر طلب فشل (${status.last.reason ?? '?'}): بنشتغل بالوضع الاحتياطي`, en: `Last request failed (${status.last.reason ?? '?'}): running on the offline fallback` }))}
                    <button type="button" className="btn btn-ghost btn-sm" disabled={probing} onClick={() => { setProbing(true); health(true).then((h) => { setStatus(h); setProbing(false); }); }}>
                      {probing ? t({ ar: 'عم يجرّب…', en: 'Testing…' }) : t({ ar: 'جرّب طلب حقيقي (بصرف شوي رصيد)', en: 'Test one real request (tiny cost)' })}
                    </button>
                  </>}
                {chip(status.tts, t({ ar: 'صوت سحابي', en: 'Cloud voice' }), t({ ar: 'صوت المتصفح', en: 'Browser voice' }))}
                {chip(status.store === 'redis' || status.store === 'file', status.store === 'file' ? t({ ar: 'الصف الحي محفوظ بملف (بيضل بعد إعادة التشغيل)', en: 'Live room saved to a file (survives a restart)' }) : t({ ar: 'تخزين Redis', en: 'Redis store' }), t({ ar: 'صف حي بالذاكرة بس (بيضيع بإعادة التشغيل)', en: 'Live room in memory only (lost on restart)' }))}
              </>
            )}
          </div>
          <label className="check">
            <input type="checkbox" checked={offline} onChange={(e) => { offlineMode.set(e.target.checked); setOffline(e.target.checked); }} />
            <span>{t({ ar: 'جرّب بدون ذكاء اصطناعي (للعرض الاحتياطي). الصف الحي بيضل محتاج السيرفر.', en: 'Run without AI (backup demonstration). Live rooms still need the server.' })}</span>
          </label>
        </section>

        <div className="jd-grid">
          <section className="card stack" aria-labelledby="script-h">
            <div className="row">
              <h2 id="script-h" className="subtitle">{t({ ar: 'السكربت', en: 'Script' })}</h2>
              <div className="ms-auto">
                <Segmented label={t({ ar: 'طول العرض', en: 'Length' })} value={track} onChange={setTrack}
                  options={[{ id: 'short', label: t({ ar: `قصير (${n(5)} د)`, en: 'Short (5 min)' }) }, { id: 'full', label: t({ ar: 'كامل', en: 'Full' }) }]} />
              </div>
            </div>
            <ol className="jd-steps">
              {steps.map((s, i) => (
                <li key={s.id} className={`jd-step ${done.includes(s.id) ? 'done' : ''}`}>
                  <button type="button" className="jd-tick" aria-pressed={done.includes(s.id)} aria-label={`${t({ ar: 'علّم كمنجزة', en: 'Mark done' })}: ${t(s.title)}`} onClick={() => toggleDone(s.id)}>
                    {done.includes(s.id) ? <Icon name="check" /> : n(i + 1)}
                  </button>
                  <div className="stack !gap-1.5">
                    <div className="row !gap-2"><strong className="font-display">{t(s.title)}</strong><span className="chip" dir="ltr">{s.minutes}</span></div>
                    <p className="muted text-[14.5px]">{t(s.say)}</p>
                    <div className="row !gap-2">
                      {s.actions.filter((a) => a.to !== '/judge').map((a) => (
                        <a key={a.to} className="btn btn-secondary btn-sm" href={href(a.to)} target={a.newTab ? '_blank' : undefined} rel="noreferrer">
                          <Icon name="next" size={15} />{t(a.label)}
                        </a>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="stack">
            <section className="card stack" aria-labelledby="room-h">
              <h2 id="room-h" className="subtitle">{t({ ar: 'صف حي للحكّام', en: 'Live room for judges' })}</h2>
              <div className="field">
                <label className="label" htmlFor="jd-pack">{t({ ar: 'الدرس', en: 'Lesson' })}</label>
                <select id="jd-pack" className="select" value={packId} onChange={(e) => setPackId(e.target.value)}>
                  {PACK_LIST.map((p) => <option key={p.id} value={p.id}>{t(p.title)}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={createRoom}>
                {busy ? <span className="spinner" /> : <Icon name="plus" />}{t({ ar: 'اعمل صف حي', en: 'Create a live room' })}
              </button>
              {room && (
                <div className="stack items-center text-center">
                  <QR value={joinUrl} size={200} label={t({ ar: `رمز الانضمام للصف ${room}`, en: `QR code to join room ${room}` })} />
                  <strong className="font-display text-3xl tracking-[.2em]" dir="ltr">{room}</strong>
                  <span className="help break-all" dir="ltr">{joinUrl}</span>
                  <div className="row justify-center">
                    <a className="btn btn-secondary btn-sm" href={href(`/teacher/room/${room}`)} target="_blank" rel="noreferrer"><Icon name="cap" size={16} />{t({ ar: 'تحكّم المعلّم', en: 'Teacher control' })}</a>
                    <a className="btn btn-secondary btn-sm" href={href(`/screen/${room}`)} target="_blank" rel="noreferrer"><Icon name="screen" size={16} />{t({ ar: 'شاشة العرض', en: 'Projector' })}</a>
                  </div>
                </div>
              )}
              {localOnly() && <Notice tone="warn">{t({ ar: 'العنوان هلأ localhost، فالجوالات ما رح تقدر تفتحه. شغّلوا `npm run dev -- --host` وافتحوا الموقع بعنوان اللابتوب على الشبكة.', en: 'This page is on localhost, so phones cannot open the code. Run `npm run dev -- --host` and open the site through the laptop’s network address.' })}</Notice>}
              <hr className="divider" />
              <div className="row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { sampleStore.reset(packId, lang); setMessage({ tone: 'info', text: t({ ar: 'جهّزنا صف تجريبي جديد (بيانات وهمية موسومة).', en: 'A fresh sample classroom is ready (labelled example data).' }) }); }}>
                  <Icon name="people" size={16} />{t({ ar: 'جهّز الصف التجريبي', en: 'Prepare sample class' })}
                </button>
                <a className="btn btn-ghost btn-sm" href={href(`/teacher/room/${SAMPLE_CODE}`)} target="_blank" rel="noreferrer">{t({ ar: 'افتحه', en: 'Open it' })}</a>
                <button type="button" className="btn btn-danger btn-sm ms-auto" onClick={reset}><Icon name="trash" size={16} />{t({ ar: 'تصفير', en: 'Reset' })}</button>
              </div>
              {message && <Notice tone={message.tone}>{message.text}</Notice>}
            </section>
          </div>
        </div>

        <EvidencePanel />

        <section className="card stack" aria-labelledby="qa-h">
          <h2 id="qa-h" className="subtitle">{t({ ar: 'أسئلة متوقّعة وأجوبة ندافع عنها', en: 'Likely questions, defensible answers' })}</h2>
          <div className="jd-qa">
            {JUDGE_QA.map((x) => (
              <details key={x.q.en}><summary>{t(x.q)}</summary><p className="ps-6 pb-2">{t(x.a)}</p></details>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
