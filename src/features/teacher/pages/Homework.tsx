/**
 * Self-paced homework, a smaller version: the teacher makes a homework from a pack with a due time and gets a link;
 * each learner does the whole individual lesson on their own device and hands in the same evidence the class gets.
 * It sits on the room store (a room of kind homework), so it lasts as long as that storage does.
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { health, roomApi, teacherRooms } from '../../../brain/client';
import { eventsOf } from '../../../brain/records';
import type { Health, RoomError, TeacherRoomView } from '../../../contracts';
import { homeworkUrl } from '../../../flow/joinUrl';
import { useI18n } from '../../../i18n';
import { PACKS, PACK_LIST } from '../../../packs';
import { RESOURCE_IDS } from '../../../packs/resources';
import { absoluteLink, navigate } from '../../../router';
import { EmptyState, Loading, Notice } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { CopyButton, Meter, PageHead, RoomProblem, SectionTitle, TeacherShell } from '../components/ui';
import { useRoomPoll } from '../hooks/useRoomPoll';
import { ChangeTab } from '../room/ChangeTab';
import { LearnersTab } from '../room/LearnersTab';

const LIMITS = {
  ar: 'نسخة مصغّرة. الأدلة بتجي من جهاز الطالب، فما بيمنع النسخ ولا الغش، بس بيقلّل فايدته لأنك بتشوف شرحه بكلامه وشو تغيّر عنده. بعد الموعد بيقفل التسليم بس، وما بيتمحي إشي.',
  en: 'A smaller version. The evidence comes from the learner\'s own device, so it does not prevent copying or cheating; it lowers its value because you see their explanation in their words and what changed. After the due time only hand-in closes; nothing is deleted.',
};

function storeNote(store: Health['store'] | undefined, t: (v: { ar: string; en: string }) => string): { tone: 'info' | 'warn'; text: string } | null {
  if (store === 'redis') return null;
  if (store === 'file') return { tone: 'info', text: t({ ar: 'التخزين: ملف على هاللابتوب. الواجب بيضل بعد إعادة تشغيل السيرفر، بس لازم هالجهاز يضل شغّال والمجلد .data سليم.', en: 'Storage: a file on this laptop. The homework survives a server restart, but this laptop must stay on and the .data folder intact.' }) };
  return { tone: 'warn', text: t({ ar: 'ما في تخزين دائم هلأ (ذاكرة السيرفر بس): الواجب بيضيع إذا انطفى السيرفر، ولا يصلح لواجب فعلي.', en: 'There is no durable storage right now (server memory only): the homework is lost if the server stops, so it does not suit a real assignment.' }) };
}

const pad = (v: number) => String(v).padStart(2, '0');
const localInput = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export function HomeworkNew() {
  const { t, lang } = useI18n();
  const [packId, setPackId] = useState(PACK_LIST[0].id);
  const [due, setDue] = useState(() => { const d = new Date(Date.now() + 24 * 3600_000); d.setHours(20, 0, 0, 0); return localInput(d.getTime()); });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RoomError | null>(null);
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => { void health().then(setH); }, []);
  const dueAt = new Date(due).getTime();
  const valid = Number.isFinite(dueAt) && dueAt > Date.now() + 60_000;
  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    const pack = PACKS[packId];
    const r = await roomApi.create({ pack: pack.id, lang, grade: pack.grades[0], minutes: 30, resources: [...RESOURCE_IDS], supervision: false, objective: null, kind: 'homework', dueAt });
    setBusy(false);
    if (r.ok) navigate(`/teacher/hw/${r.data.code}`);
    else setError(r.error);
  }
  const note = storeNote(h?.store, t);
  return <TeacherShell active="home">
    <div className="stack">
      <PageHead title={t({ ar: 'واجب ذاتي الوتيرة', en: 'Self-paced homework' })} lead={t({ ar: 'درس فردي كامل من حزمة، بموعد تسليم ورابط واحد للطلاب.', en: 'A whole individual lesson from a pack, with a due time and one link for the learners.' })} />
      <Notice>{t(LIMITS)}</Notice>
      {note && <Notice tone={note.tone === 'warn' ? 'warn' : 'info'}>{note.text}</Notice>}
      <form className="card stack" onSubmit={create}>
        <label className="field"><span>{t({ ar: 'الدرس', en: 'Lesson' })}</span>
          <select className="select" value={packId} onChange={(e) => setPackId(e.target.value)}>{PACK_LIST.map((p) => <option key={p.id} value={p.id}>{t(p.title)}</option>)}</select></label>
        <label className="field"><span>{t({ ar: 'موعد التسليم (تاريخ وساعة)', en: 'Due (date and time)' })}</span>
          <input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        {!valid && <Notice tone="warn">{t({ ar: 'اختار موعد بعد دقيقة من هلأ على الأقل.', en: 'Choose a time at least a minute from now.' })}</Notice>}
        {error && <RoomProblem error={error} />}
        <button className="btn btn-primary btn-lg self-start" type="submit" disabled={busy || !valid}><Icon name="plus" />{busy ? t({ ar: 'عم ننشئ الواجب…', en: 'Creating…' }) : t({ ar: 'أنشئ الواجب وخذ الرابط', en: 'Create the homework and get the link' })}</button>
      </form>
    </div>
  </TeacherShell>;
}

export function HomeworkBoard({ code }: { code: string }) {
  const { t, n, lang } = useI18n();
  const auth = teacherRooms.get(code)?.teacherKey;
  const { view, error } = useRoomPoll<TeacherRoomView>(code, 'teacher', auth, !!auth, 4000);
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => { void health().then(setH); }, []);
  const link = homeworkUrl(code) ?? absoluteLink(`/hw/${code}`);
  const pack = view && PACKS[view.meta.settings.pack];
  const note = storeNote(h?.store, t);
  if (!auth) return <TeacherShell active="home"><EmptyState action={<a className="btn btn-secondary" href="#/teacher">{t({ ar: 'لوحة المعلّم', en: 'Teacher dashboard' })}</a>}>{t({ ar: 'افتح الواجب من الجهاز اللي أنشأه.', en: 'Open the homework on the device that created it.' })}</EmptyState></TeacherShell>;
  if (!view || !pack) return <TeacherShell active="home">{error ? <RoomProblem error={error} /> : <Loading />}</TeacherShell>;
  const dueAt = view.meta.settings.dueAt ?? 0;
  const closed = Date.now() > dueAt;
  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const handed = view.participants.filter((p) => p.submittedAt && eventsOf(p.record, 'explain').length > 0);
  const pending = view.participants.filter((p) => !p.submittedAt);
  const onlySubmitted: TeacherRoomView = { ...view, participants: handed };
  const records = handed.map((p) => p.record);
  const noop = async () => false;
  return <TeacherShell active="home">
    <div className="stack">
      <PageHead eyebrow={<>{t({ ar: 'واجب', en: 'Homework' })} · <bdi>{code}</bdi></>} title={t(pack.title)} lead={t(pack.question)} />
      <Notice>{t(LIMITS)}</Notice>
      {note && <Notice tone={note.tone === 'warn' ? 'warn' : 'info'}>{note.text}</Notice>}
      {error && <RoomProblem error={error} />}
      <section className="card stack">
        <div className="row">
          <span className={`chip ${closed ? 'chip-probe' : 'chip-real'}`}>{closed ? t({ ar: 'التسليم مقفل', en: 'Hand-in closed' }) : t({ ar: 'التسليم مفتوح', en: 'Hand-in open' })}</span>
          <span>{t({ ar: 'آخر موعد: ', en: 'Due: ' })}{when(dueAt)}</span>
        </div>
        <div className="row"><strong>{t({ ar: 'رابط الطلاب: ', en: 'Learner link: ' })}</strong><bdi dir="ltr">{link}</bdi><CopyButton value={link} label={t({ ar: 'انسخ الرابط', en: 'Copy link' })} /></div>
        <div className="row !gap-4">
          <Meter label={t({ ar: 'سلّموا', en: 'Handed in' })} value={handed.length} max={Math.max(1, view.participants.length)} />
          <span className="chip">{t({ ar: `دخلوا: ${n(view.participants.length)}`, en: `Joined: ${view.participants.length}` })}</span>
          <span className="chip">{t({ ar: `لسا: ${n(pending.length)}`, en: `Not yet: ${pending.length}` })}</span>
        </div>
      </section>

      <section className="stack" aria-labelledby="who-h">
        <SectionTitle>{t({ ar: 'مين سلّم ومين لسا', en: 'Who handed in and who has not' })}</SectionTitle>
        {view.participants.length ? <ul className="tc-plain stack !gap-2" id="who-h">
          {view.participants.map((p) => <li key={p.id} className="card-flat row">
            <strong className="flex-1">{p.alias}</strong>
            {p.submittedAt ? <><span className="chip chip-real"><Icon name="check" size={13} />{t({ ar: 'سلّم', en: 'Handed in' })}</span><span className="help">{when(p.submittedAt)}</span></> : <span className="chip">{t({ ar: 'لسا', en: 'Not yet' })}</span>}
          </li>)}
        </ul> : <EmptyState>{t({ ar: 'ما دخل حدا للواجب لسا. شاركوا الرابط.', en: 'Nobody has joined yet. Share the link.' })}</EmptyState>}
        {pending.length > 0 && closed && <p className="help">{t({ ar: 'خلص الموعد: اللي ما سلّموا ما بقدروا يسلّموا هلأ. ما انمحى إشي.', en: 'The due time has passed: those who did not hand in can no longer do so. Nothing was deleted.' })}</p>}
      </section>

      {handed.length > 0 ? <>
        <section className="stack">
          <SectionTitle>{t({ ar: 'قبل وبعد (من اللي سلّموا بس)', en: 'Before and after (only those who handed in)' })}</SectionTitle>
          <ChangeTab pack={pack} view={onlySubmitted} records={records} act={noop} busy={false} readOnly goTab={() => undefined} />
        </section>
        <section className="stack">
          <SectionTitle hint={t({ ar: 'أول شرح، المساعدة اللي احتاجها، شو تغيّر، وجوابه المستقل بالموقف الجديد.', en: 'First explanation, the help needed, what changed and the independent answer to the new situation.' })}>{t({ ar: 'تقرير كل طالب', en: 'Each learner\'s report' })}</SectionTitle>
          <LearnersTab pack={pack} view={onlySubmitted} records={records} act={noop} busy={false} readOnly goTab={() => undefined} />
        </section>
      </> : <p className="muted">{t({ ar: 'التقارير بتظهر بعد أول تسليم.', en: 'Reports appear after the first hand-in.' })}</p>}
    </div>
  </TeacherShell>;
}
