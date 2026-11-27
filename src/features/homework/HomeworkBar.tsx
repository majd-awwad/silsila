/** Shown above the individual lesson when it was opened from a homework link: the due time and the hand-in button. */
import { useEffect, useState } from 'react';
import type { LearnerRecord, StudentRoomView } from '../../contracts';
import { roomApi, seats } from '../../brain/client';
import { eventsOf } from '../../brain/records';
import { useI18n } from '../../i18n';
import { href } from '../../router';

export function HomeworkBar({ code, record }: { code: string; record: LearnerRecord }) {
  const { t, lang } = useI18n();
  const seat = seats.get(code);
  const [view, setView] = useState<StudentRoomView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!seat) return;
    let alive = true;
    void roomApi.view<StudentRoomView>(code, { role: 'student', participantId: seat.participantId, key: seat.key }).then((r) => {
      if (!alive) return;
      setOffline(!r.ok);
      if (r.ok && !('unchanged' in r.data)) setView(r.data);
    });
    return () => { alive = false; };
  }, [code, seat?.participantId]);
  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const due = view?.meta.settings.dueAt ?? null;
  const late = due !== null && Date.now() > due;
  const ready = eventsOf(record, 'explain').length > 0;

  if (!seat) return <div className="card stack" role="note">
    <strong>{t({ ar: 'هاد واجب، بس هالجهاز مش مسجّل فيه.', en: 'This is a homework, but this device has not joined it.' })}</strong>
    <a className="btn btn-secondary btn-sm self-start" href={href(`/hw/${code}`)}>{t({ ar: 'ادخل للواجب باسم مستعار', en: 'Join the homework with an alias' })}</a>
  </div>;

  async function submit() {
    if (busy || !seat) return;
    setBusy(true);
    setMessage(null);
    const r = await roomApi.submit(code, seat, record);
    setBusy(false);
    if (r.ok) { setView(r.data); setOffline(false); setMessage(null); return; }
    setOffline(r.error === 'network');
    setMessage(r.error === 'locked'
      ? t({ ar: 'خلص موعد التسليم. شغلك محفوظ، بس ما عاد ينبعت.', en: 'The due time has passed. Your work is saved but can no longer be handed in.' })
      : r.error === 'network'
        ? t({ ar: 'ما وصل للسيرفر. شغلك محفوظ على جهازك، جرّب كمان مرة لما يرجع الاتصال.', en: 'It did not reach the server. Your work is saved on your device; try again when the connection is back.' })
        : t({ ar: 'ما انسلّم. جرّب كمان مرة أو خبّر المعلّم.', en: 'It was not handed in. Try again or tell your teacher.' }));
  }

  return <section className="card stack" aria-label={t({ ar: 'الواجب', en: 'Homework' })}>
    <div className="row">
      <strong className="flex-1">{t({ ar: 'واجب من المعلّم', en: 'Homework from the teacher' })}</strong>
      <span className="chip chip-idea">{t({ ar: 'نسخة مصغّرة', en: 'Smaller version' })}</span>
      {due !== null && <span className={`chip ${late ? 'chip-probe' : ''}`}>{late ? t({ ar: 'خلص الموعد: ', en: 'Closed: ' }) : t({ ar: 'آخر موعد: ', en: 'Due: ' })}{when(due)}</span>}
    </div>
    {view?.me.submittedAt
      ? <p role="status">{t({ ar: `سلّمت ${when(view.me.submittedAt)}. ${late ? '' : 'بتقدر تسلّم من جديد قبل الموعد، وبينحسب آخر تسليم.'}`, en: `Handed in ${when(view.me.submittedAt)}. ${late ? '' : 'You can hand in again before the due time; the last one counts.'}` })}</p>
      : <p>{ready ? t({ ar: 'كمّل الدرس لآخره أو سلّم هلأ اللي وصلت له.', en: 'Finish the lesson, or hand in what you have so far.' }) : t({ ar: 'احكي فكرتك أول، وبعدين بتقدر تسلّم.', en: 'Say your idea first, then you can hand in.' })}</p>}
    {offline && <p className="help" role="status">{t({ ar: 'بدون اتصال بالسيرفر هلأ. شغلك محفوظ على جهازك.', en: 'Not connected to the server right now. Your work is saved on your device.' })}</p>}
    {message && <p role="alert">{message}</p>}
    <button type="button" className="btn btn-primary self-start" disabled={busy || late || !ready} onClick={() => void submit()}>
      {busy ? t({ ar: 'عم نسلّم…', en: 'Handing in…' }) : view?.me.submittedAt ? t({ ar: 'سلّم من جديد', en: 'Hand in again' }) : t({ ar: 'سلّم للمعلّم', en: 'Hand in to the teacher' })}
    </button>
    <p className="help">{t({ ar: 'الأدلة بتجي من جهازك، فهاد مش بيمنع النسخ ولا الغش. بيقلّل فايدة النسخ والحفظ لأنه المعلّم بيشوف شرحك بكلامك وشو تغيّر.', en: 'The evidence comes from your own device, so this does not prevent copying or cheating. It lowers the value of copying and memorising because the teacher sees your explanation in your words and what changed.' })}</p>
  </section>;
}
