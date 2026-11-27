/** #/hw/CODE — a learner opens the homework link, picks an alias, and goes on to the individual lesson on their own device. */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { roomApi, seats } from '../../brain/client';
import { FATAL_ERRORS, ROOM_MESSAGES, cleanCode, validCode } from '../../flow/classroom';
import { useI18n } from '../../i18n';
import { navigate } from '../../router';
import { Notice, Shell } from '../../ui/kit';

export function HomeworkJoin({ code: raw }: { code: string | null }) {
  const { t } = useI18n();
  const code = cleanCode(raw ?? '');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // a learner who already has a seat for this homework goes straight back to their lesson
  useEffect(() => {
    const seat = validCode(code) ? seats.get(code) : null;
    if (seat) navigate(`/learn/${seat.pack}?hw=${code}`);
  }, [code]);
  async function join(e: FormEvent) {
    e.preventDefault();
    if (busy || !validCode(code)) return;
    setBusy(true);
    setProblem(null);
    const r = await roomApi.join(code, alias.trim() || undefined);
    setBusy(false);
    if (r.ok) navigate(`/learn/${r.data.pack}?hw=${code}`);
    else setProblem(t(ROOM_MESSAGES[r.error]) + (FATAL_ERRORS.includes(r.error) ? '' : ''));
  }
  return <Shell narrow>
    <form className="card stack" onSubmit={join}>
      <h1 className="title">{t({ ar: 'واجبك من المعلّم', en: 'Your homework from the teacher' })}</h1>
      <p className="muted">{t({ ar: 'بتعمل الدرس على جهازك ولوحدك، وبوقتك. بتقدر تسكّر وترجع تكمّل. لما تخلّص بتكبس «سلّم» وبيوصل للمعلّم أول شرح إلك، وشو تغيّر، وجوابك بالموقف الجديد.', en: 'You do the lesson on your own device, at your own pace. You can close it and come back. When you finish, press “Hand in” and the teacher gets your first explanation, what changed and your answer to the new situation.' })}</p>
      <label className="field"><span>{t({ ar: 'اسم مستعار (اختياري، مش اسمك الحقيقي)', en: 'Alias (optional, not your real name)' })}</span>
        <input className="input" value={alias} maxLength={20} onChange={(e) => setAlias(e.target.value)} /></label>
      {!validCode(code) && <Notice tone="error">{t({ ar: 'رابط الواجب مش مكتمل. اطلب الرابط من المعلّم.', en: 'This homework link is incomplete. Ask your teacher for the link.' })}</Notice>}
      {problem && <Notice tone="error">{problem}</Notice>}
      <button className="btn btn-primary btn-lg self-start" type="submit" disabled={busy || !validCode(code)}>{busy ? t({ ar: 'عم ندخّلك…', en: 'Joining…' }) : t({ ar: 'ابدأ الواجب', en: 'Start the homework' })}</button>
      <p className="help">{t({ ar: 'ما بنسجّل صوت، والاسم مستعار. تقدّمك محفوظ على هالجهاز.', en: 'No audio is recorded and the name is an alias. Your progress is saved on this device.' })}</p>
    </form>
  </Shell>;
}
