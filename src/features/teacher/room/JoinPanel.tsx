/** How learners get in, and how far the class has got. */
import { useEffect, useState } from 'react';
import { PRESENCE_WINDOW_MS } from '../../../brain/room';
import { SAMPLE_CODE } from '../../../brain/sample';
import type { RoomParticipant } from '../../../contracts';
import { useI18n } from '../../../i18n';
import { joinUrl } from '../../../flow/joinUrl';
import { QR } from '../../../ui/kit';
import { CopyButton, Meter } from '../components/ui';
import type { Counts } from '../logic/insight';

export function Counters({ counts }: { counts: Counts }) {
  const { t, n } = useI18n();
  return (
    <div className="row !gap-5" role="status" aria-label={t({ ar: 'تقدّم الصف', en: 'Class progress' })}>
      <div className="tc-meter !flex-none">
        <span className="tc-meter-label">{t({ ar: 'انضمّوا', en: 'Joined' })}</span>
        <span className="tc-meter-value"><b>{n(counts.participants)}</b></span>
      </div>
      <Meter label={t({ ar: 'شرحوا', en: 'Explained' })} value={counts.explained} max={counts.participants} />
      <Meter label={t({ ar: 'توقّعوا', en: 'Predicted' })} value={counts.predicted} max={counts.participants} />
      <Meter label={t({ ar: 'شرحوا من جديد', en: 'Revised' })} value={counts.revised} max={counts.participants} />
      <Meter label={t({ ar: 'الموقف الجديد', en: 'Transferred' })} value={counts.transferred} max={counts.participants} />
    </div>
  );
}

export function JoinPanel({ code, roster }: { code: string; roster?: RoomParticipant[] }) {
  const { t, n } = useI18n();
  const link = joinUrl(code, code === SAMPLE_CODE);
  const [now, setNow] = useState(Date.now);
  const trackPresence = !!roster && code !== SAMPLE_CODE;
  useEffect(() => {
    if (!trackPresence) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [trackPresence]);
  const active = (seat: RoomParticipant) => now - (seat.lastSeenAt ?? seat.joinedAt) < PRESENCE_WINDOW_MS;
  return (
    <div className="live-lobby">
      <div className="tc-join">
      {link && <QR value={link} size={180} label={t({ ar: `رمز QR للانضمام للصف ${code}`, en: `QR code to join room ${code}` })} />}
      <div className="stack !gap-2 min-w-0 text-center sm:text-start">
        <span className="eyebrow">{t({ ar: 'رمز الصف', en: 'Room code' })}</span>
        <div className="tc-code-text tc-bigcode">{code}</div>
        {link ? <><a className="tc-url link" href={link} target="_blank" rel="noreferrer">{link}</a><div><CopyButton value={link} label={t({ ar: 'انسخ رابط الانضمام', en: 'Copy join link' })} /></div></>
          : <p className="help">{t({ ar: 'لم يُضبط عنوان الانضمام عبر الشبكة. افتح التطبيق من عنوانه الشبكي أو اضبط VITE_CLASSROOM_BASE_URL.', en: 'A network join address is unavailable. Open the app from its network address or set VITE_CLASSROOM_BASE_URL.' })}</p>}
        {code === SAMPLE_CODE
          ? <p className="help">{t({ ar: 'الصف التجريبي بيشتغل على هالجهاز وهالمتصفّح بس: افتحوا الروابط بتبويب ثاني هون.', en: 'The sample classroom works only on this device and browser: open the links in another tab here.' })}</p>
          : null}
      </div>
      </div>
      {roster && <section className="stack !gap-2" aria-label={t({ ar: 'قائمة المنضمّين', en: 'Joined learners' })}>
        <h3 className="subtitle">{n(roster.length)} {t({ ar: 'منضمّون', en: 'joined' })}</h3>
        {trackPresence && roster.length > 0 && <p>{n(roster.filter(active).length)} {t({ ar: 'متّصلون مؤخراً', en: 'recently connected' })}</p>}
        {roster.length ? <ul className="row tc-plain">{roster.map((seat) => <li className={`chip ${trackPresence && active(seat) ? 'chip-real' : ''}`} key={seat.id}><bdi>{seat.alias}</bdi>{trackPresence && !active(seat) && <span>{t({ ar: 'انقطع الاتصال', en: 'Connection inactive' })}</span>}</li>)}</ul>
          : <p>{t({ ar: 'بانتظار انضمام أول متعلّم.', en: 'Waiting for the first learner to join.' })}</p>}
      </section>}
    </div>
  );
}
