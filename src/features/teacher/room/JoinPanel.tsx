/** How learners get in, and how far the class has got. */
import { SAMPLE_CODE } from '../../../brain/sample';
import { useI18n } from '../../../i18n';
import { absoluteLink, href } from '../../../router';
import { QR } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { CopyButton, Meter } from '../components/ui';
import type { Counts } from '../logic/insight';

export const isLocalHost = (): boolean => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

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

export function JoinPanel({ code }: { code: string }) {
  const { t } = useI18n();
  const link = absoluteLink(`/join/${code}`);
  return (
    <div className="tc-join">
      <QR value={link} size={180} label={t({ ar: `رمز QR للانضمام للصف ${code}`, en: `QR code to join room ${code}` })} />
      <div className="stack !gap-2 min-w-0 text-center sm:text-start">
        <span className="eyebrow">{t({ ar: 'رمز الصف', en: 'Room code' })}</span>
        <div className="tc-code-text tc-bigcode">{code}</div>
        <div className="tc-url">{link}</div>
        <div className="row justify-center sm:justify-start">
          <CopyButton value={link} label={t({ ar: 'انسخوا الرابط', en: 'Copy link' })} />
          <a className="btn btn-primary btn-sm" href={href(`/screen/${code}`)} target="_blank" rel="noreferrer">
            <Icon name="screen" size={16} />{t({ ar: 'افتحوا شاشة العرض', en: 'Open the projector' })}
          </a>
        </div>
        {code === SAMPLE_CODE
          ? <p className="help">{t({ ar: 'الصف التجريبي بيشتغل على هالجهاز وهالمتصفّح بس: افتحوا الروابط بتبويب ثاني هون.', en: 'The sample classroom works only on this device and browser: open the links in another tab here.' })}</p>
          : isLocalHost() && <p className="help">{t({ ar: 'الأجهزة الثانية ما بتفتح «localhost». شغّلوا التطبيق بعنوان الشبكة (npm run dev -- --host) وافتحوا هالصفحة منه.', en: 'Other devices cannot open “localhost”. Run the app on the network address (npm run dev -- --host) and open this page from it.' })}</p>}
      </div>
    </div>
  );
}
