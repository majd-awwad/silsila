/**
 * The teacher's starting point: rooms open on this device (live counts), the way into a new class or the labelled
 * sample classroom, and what individual lessons on this device show. Only recorded numbers appear.
 */
import { useEffect, useState } from 'react';
import type { LearnerRecord, TeacherRoomView } from '../../../contracts';
import { teacherRooms } from '../../../brain/client';
import type { TeacherRoom } from '../../../brain/client';
import { summarise } from '../../../brain/classInsights';
import { aggregates } from '../../../brain/room';
import { SAMPLE_CODE } from '../../../brain/sample';
import { useI18n } from '../../../i18n';
import { PACKS, PACK_LIST } from '../../../packs';
import { href, navigate } from '../../../router';
import { loadRecords } from '../../../store/records';
import { Bar, EmptyState, Loading, Notice } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import type { IconName } from '../../../ui/icons';
import { ConfirmModal, Meter, SectionTitle, TeacherShell } from '../components/ui';
import { useRoomPoll } from '../hooks/useRoomPoll';
import { PHASE_NAME, ROOM_ERROR, ideaName } from '../logic/labels';
import { ensureSample } from '../logic/sampleRoom';

function RoomRow({ room, onForget }: { room: TeacherRoom; onForget: () => void }) {
  const { t } = useI18n();
  const { view, error } = useRoomPoll<TeacherRoomView>(room.code, 'teacher', room.teacherKey, true, 6000);
  const pack = PACKS[view?.meta.settings.pack ?? room.pack];
  const counts = view && pack ? aggregates(pack, view) : null;
  const gone = error === 'no_room' || error === 'forbidden' || (!!view && view.meta.expiresAt < Date.now());
  return (
    <li className="tc-room">
      <div>
        <div className="tc-code-text">{room.code}</div>
        {view && <span className={`chip ${view.meta.closed || gone ? '' : 'chip-real'}`}>{view.meta.closed ? t({ ar: 'مسكّر', en: 'Closed' }) : gone ? t({ ar: 'منتهي', en: 'Expired' }) : t(PHASE_NAME[view.meta.phase])}</span>}
      </div>
      <div className="min-w-0 stack !gap-2">
        <strong>{pack ? t(pack.title) : room.pack}</strong>
        {counts ? (
          <div className="row !gap-4">
            <Meter label={t({ ar: 'شرحوا', en: 'Explained' })} value={counts.explained} max={counts.participants} />
            <Meter label={t({ ar: 'توقّعوا', en: 'Predicted' })} value={counts.predicted} max={counts.participants} />
            <Meter label={t({ ar: 'شرحوا من جديد', en: 'Revised' })} value={counts.revised} max={counts.participants} />
          </div>
        ) : error ? (
          <span className="text-probe-ink text-[14px]" role="status">{t(ROOM_ERROR[error])}</span>
        ) : (
          <span className="muted text-[14px]" role="status">{t({ ar: 'عم نتحقّق من الصف…', en: 'Checking the room…' })}</span>
        )}
        {view && error && <span className="text-probe-ink text-[13px]" role="status">{t(ROOM_ERROR[error])} {t({ ar: 'الأرقام من آخر اتصال.', en: 'Numbers are from the last connection.' })}</span>}
      </div>
      <div className="row">
        <a className="btn btn-primary btn-sm" href={href(view?.meta.settings.kind === 'homework' ? `/teacher/hw/${room.code}` : `/teacher/room/${room.code}`)}>{view?.meta.closed ? t({ ar: 'عرض أدلة الحصة', en: 'View class evidence' }) : t({ ar: 'استئناف الحصة', en: 'Resume lesson' })}</a>
        <a className="btn btn-secondary btn-sm" href={href(`/screen/${room.code}`)} target="_blank" rel="noreferrer"><Icon name="screen" size={16} />{t({ ar: 'الشاشة', en: 'Projector' })}</a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onForget} aria-label={t({ ar: `شيلوا الصف ${room.code} من هالجهاز`, en: `Remove room ${room.code} from this device` })}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  );
}

/** What lessons done on this device show, concept by concept. Sample records are left out and counted apart. */
function IndividualLessons() {
  const { t, n, lang } = useI18n();
  const [records, setRecords] = useState<LearnerRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadRecords().then((r) => alive && setRecords(r)).catch(() => alive && (setRecords([]), setFailed(true)));
    return () => { alive = false; };
  }, []);

  if (!records) return <Loading />;
  const mine = records.filter((r) => !r.sample && !r.classCode);
  const byPack = PACK_LIST.map((pack) => ({ pack, list: mine.filter((r) => r.pack === pack.id) })).filter((x) => x.list.length);
  const samples = records.filter((r) => r.sample).length;

  if (failed) return <Notice tone="error">{t({ ar: 'ما قدرنا نقرأ الدروس المحفوظة على هالجهاز (ممكن التخزين مقفول).', en: 'Saved lessons on this device could not be read (storage may be blocked).' })}</Notice>;
  if (!byPack.length) {
    return (
      <EmptyState action={<a className="btn btn-secondary" href={href('/learn')}>{t({ ar: 'جرّبوا درس فردي', en: 'Try an individual lesson' })}</a>}>
        <strong className="block">{t({ ar: 'لسا ما في دروس فردية محفوظة على هالجهاز', en: 'No individual lessons recorded on this device yet' })}</strong>
        {t({ ar: 'لما متعلّم يعمل درس لحاله هون، بتشوفوا الأفكار اللي ظهرت وشو تغيّر.', en: 'When a learner completes a lesson here, the ideas that appeared and what changed will show.' })}
        {samples > 0 && <div className="text-[13px]">{t({ ar: `في ${n(samples)} سجلّات تجريبية مش محسوبة.`, en: `${samples} sample records are not counted.` })}</div>}
      </EmptyState>
    );
  }
  return (
    <div className="stack">
      {byPack.map(({ pack, list }) => {
        const s = summarise(pack, list);
        const max = Math.max(1, s.explained);
        return (
          <article key={pack.id} className="card stack !gap-3">
            <div className="row">
              <h3 className="tc-h3 flex-1">{t(pack.title)}</h3>
              <span className="chip">{t({ ar: 'محاولات', en: 'Attempts' })}: {n(list.length)}</span>
              <span className="chip">{t({ ar: 'فيها شرح', en: 'With an explanation' })}: {n(s.explained)}</span>
            </div>
            {s.ideas.length ? (
              <div className="stack !gap-2" aria-label={t({ ar: 'توزيع الأفكار اللي بدها اختبار', en: 'Distribution of ideas to investigate' })}>
                <p className="help">{t({ ar: 'أفكار بتختلف عن النموذج العلمي، من أول شرح في كل محاولة.', en: 'Ideas that differ from the reference model, from the first explanation in each attempt.' })}</p>
                {s.ideas.map((i) => (
                  <Bar key={i.id} label={ideaName(pack, i.id)[lang]} value={i.count} max={max}
                    note={i.persisting ? t({ ar: `ضلّت بعد الشرح الجديد عند ${n(i.persisting)}`, en: `Still present after revising: ${i.persisting}` }) : undefined} />
                ))}
              </div>
            ) : (
              <p className="muted">{t({ ar: 'ما ظهرت أفكار مختلفة عن النموذج العلمي بهالدروس.', en: 'No idea differing from the reference model appeared in these lessons.' })}</p>
            )}
            <p className="help">
              {t({ ar: 'آخر شرح', en: 'Latest explanation' })}: {t({ ar: 'كامل', en: 'complete' })} {n(s.correct)} · {t({ ar: 'جزئي', en: 'partial' })} {n(s.partial)} · {t({ ar: 'مش واضح', en: 'unclear' })} {n(s.unclear)}
            </p>
          </article>
        );
      })}
      {samples > 0 && <p className="help">{t({ ar: `في ${n(samples)} سجلّات تجريبية مش محسوبة.`, en: `${samples} sample records are not counted.` })}</p>}
    </div>
  );
}

export function Dashboard() {
  const { t, lang } = useI18n();
  const [rooms, setRooms] = useState<TeacherRoom[]>(() => teacherRooms.list());
  const [forget, setForget] = useState<TeacherRoom | null>(null);
  const [sampleFailed, setSampleFailed] = useState(false);

  const openSample = () => {
    if (ensureSample(lang)) navigate(`/teacher/room/${SAMPLE_CODE}`);
    else setSampleFailed(true);
  };

  const links: { to: string; icon: IconName; title: string; body: string }[] = [
    { to: '/teacher/hw', icon: 'edit', title: t({ ar: 'واجب ذاتي الوتيرة (نسخة مصغّرة)', en: 'Self-paced homework (smaller version)' }), body: t({ ar: 'درس فردي بموعد تسليم ورابط، والأدلة بترجعلك.', en: 'An individual lesson with a due time and a link; the evidence comes back to you.' }) },
    { to: '/teacher/library', icon: 'book', title: t({ ar: 'مكتبة المفاهيم', en: 'Concept library' }), body: t({ ar: 'السؤال، الأفكار المتوقّعة، التجارب، والنموذج العلمي لكل درس.', en: 'Question, likely ideas, experiments and reference model for each lesson.' }) },
    { to: '/teacher/studio', icon: 'edit', title: t({ ar: 'استوديو الدروس', en: 'Lesson studio' }), body: t({ ar: 'مسودة درس لأي موضوع، بتراجعوها وبتعدّلوها.', en: 'A lesson draft for any topic, for you to review and edit.' }) },
    { to: '/teacher/learners', icon: 'people', title: t({ ar: 'المتعلّمين', en: 'Learners' }), body: t({ ar: 'تقرير كل درس فردي محفوظ على هالجهاز.', en: 'A report for each individual lesson saved on this device.' }) },
  ];

  return (
    <TeacherShell active="home">
      <section className="live-dashboard-hero">
        <div className="stack !gap-2">
          <span className="eyebrow">{t({ ar: 'مساحة المعلّم', en: 'Teacher workspace' })}</span>
          <h1 className="title">{t({ ar: 'بدك تتحقق من فهم طلابك، ولا تنظّم حصة اكتشاف؟', en: 'Do you want to check what your learners understand, or run a discovery lesson?' })}</h1>
          <p>{t({ ar: 'التحقّق السريع (٥–١٠ دقائق) بيوصلك لقرار: شو تعيد تشرح ولمين. وحصة الاكتشاف بتختار تجربة تميّز بين أفكارهم. تقدر تبدأ بالتحقّق وتكمّل للاكتشاف من نفس الغرفة.', en: 'A quick check (5–10 minutes) ends in a decision: what to explain again and for whom. A discovery lesson picks an experiment that tells their ideas apart. You can start with the check and continue to discovery in the same room.' })}</p>
        </div>
        <div className="row">
          <a className="btn btn-warm btn-lg" href={href('/teacher/quick')}><Icon name="check" />{t({ ar: 'أتحقق من الفهم (سريع)', en: 'Check understanding (quick)' })}</a>
          <a className="btn btn-primary btn-lg" href={href('/teacher/new')}><Icon name="plus" />{t({ ar: 'أنظّم حصة اكتشاف', en: 'Plan a discovery lesson' })}</a>
          <button type="button" className="btn btn-secondary" onClick={openSample}><Icon name="eye" />{t({ ar: 'استعرض صفاً تجريبياً', en: 'Explore a sample classroom' })}</button>
        </div>
      </section>
      {sampleFailed && <Notice tone="error">{t({ ar: 'تعذّر تجهيز الصف التجريبي.', en: 'The sample classroom could not be prepared.' })}</Notice>}
      <div className="tc-split">
        <div className="stack !gap-7">
          <section className="stack">
            <SectionTitle hint={t({ ar: 'الحصص التي أُنشئت من هذا الجهاز خلال آخر ست ساعات. إدارة الحصة متاحة من المتصفّح الذي أنشأها.', en: 'Rooms opened from this device in the last 6 hours. The teacher key is kept here only.' })}>
              {t({ ar: 'حصصك على هذا الجهاز', en: 'Your classrooms on this device' })}
            </SectionTitle>
            {rooms.length ? (
              <ul className="tc-rooms tc-plain">
                {rooms.map((r) => <RoomRow key={r.code} room={r} onForget={() => setForget(r)} />)}
              </ul>
            ) : (
              <EmptyState action={<a className="btn btn-primary" href={href('/teacher/new')}>{t({ ar: 'افتحوا أول صف', en: 'Open your first room' })}</a>}>
                {t({ ar: 'ما في صفوف مفتوحة على هالجهاز.', en: 'There are no open rooms on this device.' })}
              </EmptyState>
            )}
          </section>

          <section className="stack">
            <SectionTitle actions={<a className="btn btn-secondary btn-sm" href={href('/teacher/learners')}>{t({ ar: 'كل المتعلّمين', en: 'All learners' })}</a>}>
              {t({ ar: 'الدروس الفردية على هالجهاز', en: 'Individual lessons on this device' })}
            </SectionTitle>
            <IndividualLessons />
          </section>
        </div>

        <aside className="stack tc-sticky">
          <nav className="tc-links" aria-label={t({ ar: 'أدوات المعلّم', en: 'Teacher tools' })}>
            {links.map((l) => (
              <a key={l.to} href={href(l.to)}>
                <Icon name={l.icon} />
                <span><strong className="block">{l.title}</strong><span className="muted text-[13.5px]">{l.body}</span></span>
              </a>
            ))}
          </nav>
          <p className="help">{t({ ar: 'ما في أسماء حقيقية ولا تسجيل صوت. الدروس الفردية محفوظة على هالجهاز بس.', en: 'No real names and no audio. Individual lessons stay on this device.' })}</p>
        </aside>
      </div>

      <ConfirmModal
        open={!!forget}
        title={t({ ar: 'نشيل الصف من هالجهاز؟', en: 'Remove this room from this device?' })}
        confirmLabel={t({ ar: 'شيلوه', en: 'Remove' })}
        onClose={() => setForget(null)}
        onConfirm={() => {
          if (forget) teacherRooms.remove(forget.code);
          setRooms(teacherRooms.list());
          setForget(null);
        }}
      >
        <p>{t({ ar: 'مفتاح المعلّم بيروح من هالجهاز وما بتقدروا ترجعوا تديروا الصف. الصف نفسه ما بيتسكّر؛ إذا بدكم تسكّروه، ادخلوا غرفة التحكّم أول.', en: 'The teacher key is erased from this device and you can no longer manage the room. The room itself is not closed; to close it, use the control room first.' })}</p>
      </ConfirmModal>
    </TeacherShell>
  );
}
