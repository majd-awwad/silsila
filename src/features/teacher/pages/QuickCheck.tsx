/**
 * Quick check: pick a lesson and open the room. Everything else (time, resources, accessibility) takes safe defaults,
 * because the teacher only wants to know what the class understood in 5–10 minutes.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RoomError } from '../../../contracts';
import { roomApi } from '../../../brain/client';
import { useI18n } from '../../../i18n';
import { PACKS, PACK_LIST } from '../../../packs';
import { RESOURCE_IDS } from '../../../packs/resources';
import type { Subject } from '../../../packs/types';
import { navigate, useRoute } from '../../../router';
import { Icon } from '../../../ui/icons';
import { Segmented } from '../../../ui/kit';
import { PageHead, RoomProblem, TeacherShell } from '../components/ui';
import { SUBJECT_LABEL } from '../logic/labels';

export function QuickCheck() {
  const { t, lang } = useI18n();
  const { query } = useRoute();
  const wanted = PACKS[query.get('pack') ?? ''] ?? PACK_LIST[0];
  const [subject, setSubject] = useState<Subject>(wanted.subject);
  const [packId, setPackId] = useState(wanted.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RoomError | null>(null);
  const pack = PACKS[packId] ?? wanted;
  const subjects = [...new Set(PACK_LIST.map((p) => p.subject))];
  const lessons = PACK_LIST.filter((p) => p.subject === subject);
  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await roomApi.create({ pack: pack.id, lang, grade: pack.grades[0], minutes: 10, resources: [...RESOURCE_IDS], supervision: true, objective: null, kind: 'quick' });
    setBusy(false);
    if (r.ok) navigate(`/teacher/room/${r.data.code}`);
    else setError(r.error);
  }
  return <TeacherShell active="quick">
    <div className="stack">
      <PageHead title={t({ ar: 'تحقّق سريع من الفهم', en: 'Quick understanding check' })}
        lead={t({ ar: '٥–١٠ دقائق: نور بتسأل كل طالب، وبتشوف خريطة صفّك وقرار قابل للتنفيذ. بدون تجربة مفروضة.', en: '5–10 minutes: Noor asks every learner, and you get a live class map and an actionable decision. No experiment is forced.' })} />
      <form className="card stack" onSubmit={create}>
        <div className="field"><span>{t({ ar: 'المادة', en: 'Subject' })}</span>
          <Segmented value={subject} onChange={(v) => { const s = v as Subject; setSubject(s); setPackId(PACK_LIST.find((p) => p.subject === s)!.id); }}
            options={subjects.map((s) => ({ id: s, label: t(SUBJECT_LABEL[s]) }))} label={t({ ar: 'المادة', en: 'Subject' })} />
        </div>
        <label className="field"><span>{t({ ar: 'الدرس', en: 'Lesson' })}</span>
          <select className="select" value={packId} onChange={(e) => setPackId(e.target.value)}>
            {lessons.map((p) => <option key={p.id} value={p.id}>{t(p.title)}</option>)}
          </select>
          <span className="help">{t(pack.question)}</span>
        </label>
        {error && <RoomProblem error={error} />}
        <button className="btn btn-primary btn-lg self-start" type="submit" disabled={busy}><Icon name="play" />{busy ? t({ ar: 'عم نفتح الصف…', en: 'Opening the room…' }) : t({ ar: 'افتح الصف وابدأ التحقق', en: 'Open the room and start the check' })}</button>
        <p className="help">{t({ ar: 'بعد ما الطلاب يشرحوا، بتقرّر: تسكّر وتاخد قرارك، أو تكمّل لحصة اكتشاف كاملة من نفس الغرفة.', en: 'After the learners explain you decide: close with your decision, or continue to a full discovery lesson in the same room.' })}</p>
      </form>
    </div>
  </TeacherShell>;
}
