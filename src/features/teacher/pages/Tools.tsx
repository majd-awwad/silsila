import { useEffect, useState } from 'react';
import { activity, lesson } from '../../../brain/client';
import { ActivityKind, LessonDraft as DraftSchema, LessonInput as InputSchema } from '../../../contracts';
import type { ActivityPlan, L, LearnerRecord, LessonDraft, LessonInput } from '../../../contracts';
import { useI18n } from '../../../i18n';
import { PACKS } from '../../../packs';
import { href } from '../../../router';
import { loadRecords } from '../../../store/records';
import { EmptyState, Loading, Notice, downloadFile } from '../../../ui/kit';
import { LearnerReport } from '../components/LearnerReport';
import { PageHead, TeacherShell } from '../components/ui';
import { activityRequest, activityText, defaultForm, loadActivities, saveActivity } from '../logic/activities';
import { shortId } from '../logic/storage';
import { cleanDraft, draftText, loadDrafts, localiseDraft, newDraftId, saveDraft } from '../logic/studio';
import type { RoomTabProps } from '../room/types';

export function Learners() {
  const { t } = useI18n();
  const [records, setRecords] = useState<LearnerRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void loadRecords().then((items) => { if (active) setRecords(items.filter((r) => Object.hasOwn(PACKS, r.pack) && !r.sample && r.events.length)); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <TeacherShell active="learners">
    <div className="stack">
      <PageHead title={t({ ar: 'سجلّات المتعلّمين', en: 'Learner records' })} lead={t({ ar: 'دروس فردية محفوظة على هالجهاز.', en: 'Individual lessons saved on this device.' })} />
      {failed ? <Notice tone="error">{t({ ar: 'ما قدرنا نقرأ السجلّات.', en: 'Could not read saved records.' })}</Notice>
        : !records ? <Loading /> : !records.length ? <EmptyState>{t({ ar: 'لسه ما في سجلّات.', en: 'No learner records yet.' })}</EmptyState>
          : records.map((r) => <details className="card" key={r.id}><summary>{r.alias} · {t(PACKS[r.pack].title)}</summary><LearnerReport record={r} pack={PACKS[r.pack]} /></details>)}
    </div>
  </TeacherShell>;
}

const lessonFields: [keyof Pick<LessonInput, 'title' | 'subject' | 'content' | 'objectives' | 'resources' | 'accessibility'>, L, number][] = [
  ['title', { ar: 'عنوان الدرس', en: 'Lesson title' }, 120], ['subject', { ar: 'المادة', en: 'Subject' }, 60],
  ['content', { ar: 'محتوى الدرس', en: 'Lesson content' }, 4000], ['objectives', { ar: 'أهداف التعلّم', en: 'Learning objectives' }, 800],
  ['resources', { ar: 'المواد المتاحة', en: 'Available materials' }, 400], ['accessibility', { ar: 'احتياجات الوصول', en: 'Accessibility needs' }, 300],
];
const draftLists = ['objectives', 'concepts', 'prerequisites', 'questions', 'assessment', 'transfer', 'guidance'] as const;

export function LessonStudio() {
  const { t, lang } = useI18n();
  const [input, setInput] = useState<LessonInput>({ lang, title: '', content: '', subject: '', grade: 4, objectives: '', minutes: 35, resources: '', accessibility: '' });
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [id, setId] = useState(newDraftId);
  const [saved, setSaved] = useState(loadDrafts);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const generate = async () => {
    const checked = InputSchema.safeParse({ ...input, lang, title: input.title.trim() });
    if (!checked.success || busy) return;
    setBusy(true);
    setStatus('');
    try {
      setDraft(localiseDraft(await lesson(checked.data), lang));
      setInput(checked.data);
      setId(newDraftId());
      setReviewed(false);
    } finally { setBusy(false); }
  };
  const save = () => {
    if (!draft) return;
    const checked = DraftSchema.safeParse(cleanDraft(draft));
    if (checked.success && saveDraft({ id, savedAt: Date.now(), input, draft: checked.data, reviewed })) {
      setStatus(t({ ar: 'انحفظت المسودّة على هالجهاز.', en: 'Draft saved on this device.' }));
      setSaved(loadDrafts());
    } else setStatus(t({ ar: 'ما قدرنا نحفظ المسودّة.', en: 'Could not save the draft.' }));
  };
  const change = (next: LessonDraft) => { setDraft(next); setReviewed(false); };
  const setField = (key: 'grade' | 'minutes', value: number) => setInput((prev) => ({ ...prev, [key]: value }));
  return <TeacherShell active="studio">
    <div className="stack">
      <PageHead title={t({ ar: 'استوديو الدروس', en: 'Lesson studio' })} />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
        {lessonFields.map(([key, label, max]) => <label className="field" key={key}><span>{t(label)}</span>
          {max > 120 ? <textarea className="textarea" rows={3} maxLength={max} value={input[key]} onChange={(e) => setInput({ ...input, [key]: e.target.value })} />
            : <input className="input" required={key === 'title'} minLength={key === 'title' ? 2 : undefined} maxLength={max} value={input[key]} onChange={(e) => setInput({ ...input, [key]: e.target.value })} />}
        </label>)}
        <div className="row">
          <label className="field"><span>{t({ ar: 'الصف', en: 'Grade' })}</span><input className="input" type="number" min="1" max="12" required value={input.grade || ''} onChange={(e) => setField('grade', Number(e.target.value))} /></label>
          <label className="field"><span>{t({ ar: 'الدقائق', en: 'Minutes' })}</span><input className="input" type="number" min="5" max="120" required value={input.minutes || ''} onChange={(e) => setField('minutes', Number(e.target.value))} /></label>
        </div>
        <button className="btn btn-primary self-start" disabled={busy}>{busy ? t({ ar: 'عم نحضّر المسودّة…', en: 'Preparing draft…' }) : t({ ar: 'حضّر مسودّة', en: 'Generate draft' })}</button>
      </form>
      {saved.length > 0 && <div className="card row"><span>{t({ ar: 'مسودّات محفوظة', en: 'Saved drafts' })}</span>
        {saved.map((item) => <button className="btn btn-secondary" key={item.id} onClick={() => { setId(item.id); setInput(item.input); setDraft(item.draft); setReviewed(item.reviewed); setStatus(''); }}>{item.draft.title || item.input.title}</button>)}
      </div>}
      {draft && <section className="card stack">
        <Notice>{draft.source === 'ai' ? t({ ar: 'مسودّة من الذكاء الاصطناعي.', en: 'AI-generated draft.' }) : t({ ar: 'مسودّة من قالب.', en: 'Template-based draft.' })}{' '}
          {draft.matchedPack && Object.hasOwn(PACKS, draft.matchedPack) ? t({ ar: 'في حزمة تفاعلية جاهزة لهالموضوع.', en: 'A supported concept pack is available.' }) : t({ ar: 'هالموضوع بحاجة لمراجعة، وما إله محاكاة تفاعلية جاهزة.', en: 'This topic needs review and has no supported interactive simulation.' })}</Notice>
        <input className="input" aria-label={t({ ar: 'عنوان المسودّة', en: 'Draft title' })} value={draft.title} onChange={(e) => change({ ...draft, title: e.target.value })} />
        {draftLists.map((key) => <label className="field" key={key}><span>{t(DRAFT_LABELS[key])}</span><textarea className="textarea" rows={3}
          value={draft[key].join('\n')} onChange={(e) => change({ ...draft, [key]: e.target.value.split('\n').slice(0, 10) })} /></label>)}
        <details><summary>{t({ ar: 'التجارب والأنشطة والأفكار المتوقعة', en: 'Experiments, activities and likely ideas' })}</summary>
          <pre className="whitespace-pre-wrap">{draftText({ ...draft, objectives: [], concepts: [], prerequisites: [], questions: [], assessment: [], transfer: [], guidance: [] }, input, lang, reviewed)}</pre>
        </details>
        <label className="row"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />{t({ ar: 'راجعت المسودّة', en: 'I reviewed this draft' })}</label>
        <div className="row">
          <button className="btn btn-primary" onClick={save}>{t({ ar: 'احفظ المسودّة', en: 'Save draft' })}</button>
          <button className="btn btn-secondary" onClick={() => downloadFile('silsila-lesson.txt', draftText(draft, input, lang, reviewed), 'text/plain;charset=utf-8')}>{t({ ar: 'نزّل المسودّة', en: 'Download draft' })}</button>
          {reviewed && draft.matchedPack && Object.hasOwn(PACKS, draft.matchedPack) && <a className="btn btn-secondary" href={href('/teacher/new?pack=' + draft.matchedPack)}>{t({ ar: 'افتح حصة من الحزمة', en: 'Create a session from this pack' })}</a>}
        </div>
        {status && <p role="status">{status}</p>}
      </section>}
    </div>
  </TeacherShell>;
}

const DRAFT_LABELS: Record<(typeof draftLists)[number], L> = {
  objectives: { ar: 'الأهداف', en: 'Objectives' }, concepts: { ar: 'المفاهيم', en: 'Concepts' },
  prerequisites: { ar: 'الأساسات', en: 'Prerequisites' }, questions: { ar: 'أسئلة التشخيص', en: 'Diagnostic questions' },
  assessment: { ar: 'التقييم', en: 'Assessment' }, transfer: { ar: 'مواقف جديدة', en: 'Transfer' }, guidance: { ar: 'إرشادات المعلّم', en: 'Teacher guidance' },
};

const planFields: [keyof Pick<ActivityPlan, 'title' | 'why' | 'target' | 'objective' | 'grouping' | 'teacher' | 'check' | 'adapt'>, L][] = [
  ['title', { ar: 'عنوان النشاط', en: 'Activity title' }], ['why', { ar: 'سبب الاختيار', en: 'Why this activity' }],
  ['target', { ar: 'التحدّي التعليمي', en: 'Learning problem' }], ['objective', { ar: 'الهدف', en: 'Objective' }],
  ['grouping', { ar: 'المجموعات', en: 'Grouping' }], ['teacher', { ar: 'دور المعلّم', en: 'Teacher responsibilities' }],
  ['check', { ar: 'التحقّق من الفهم', en: 'Check for understanding' }], ['adapt', { ar: 'التكييفات', en: 'Adaptations' }],
];
const kinds: Record<(typeof ActivityKind.options)[number], L> = {
  experiment: { ar: 'تجربة', en: 'Experiment' }, discussion: { ar: 'نقاش', en: 'Discussion' },
  game: { ar: 'لعبة', en: 'Game' }, peer: { ar: 'تعلّم بين الزملاء', en: 'Peer instruction' },
  worksheet: { ar: 'ورقة عمل', en: 'Worksheet' }, escape: { ar: 'غرفة هروب', en: 'Escape room' },
  assessment: { ar: 'تقييم قصير', en: 'Quick assessment' },
};

export function ActivityTab({ pack, view, records }: RoomTabProps) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(() => defaultForm(view.meta.settings, records.length));
  const savedForRoom = () => loadActivities().filter((item) => item.code === view.meta.code && item.pack === pack.id);
  const [saved, setSaved] = useState(savedForRoom);
  const [plan, setPlan] = useState<ActivityPlan | null>(null);
  const [id, setId] = useState(shortId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const hasEvidence = records.some((r) => r.events.some((e) => e.type === 'explain'));
  const generate = async () => {
    if (busy || !hasEvidence) return;
    setBusy(true);
    setStatus('');
    try {
      setPlan(await activity(pack, activityRequest(pack, records, view.meta.settings.grade, lang, form)));
      setId(shortId());
    } finally { setBusy(false); }
  };
  return <div className="stack">
    <form className="card stack" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
      {!hasEvidence && <Notice>{t({ ar: 'لما الطلاب يشاركوا أفكارهم، بنحضّر نشاط مبني عليها.', en: 'Once learners share their ideas, you can generate an activity based on them.' })}</Notice>}
      <div className="row">
        <label className="field"><span>{t({ ar: 'نوع النشاط', en: 'Activity kind' })}</span><select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: ActivityKind.parse(e.target.value) })}>
          {ActivityKind.options.map((kind) => <option key={kind} value={kind}>{t(kinds[kind])}</option>)}
        </select></label>
        <label className="field"><span>{t({ ar: 'الدقائق', en: 'Minutes' })}</span><input type="number" className="input" min="5" max="90" required value={form.minutes || ''} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} /></label>
        <label className="field"><span>{t({ ar: 'عدد الطلاب', en: 'Class size' })}</span><input type="number" className="input" min="1" max="60" required value={form.classSize || ''} onChange={(e) => setForm({ ...form, classSize: Number(e.target.value) })} /></label>
      </div>
      <label className="field"><span>{t({ ar: 'احتياجات الوصول', en: 'Accessibility needs' })}</span><input className="input" maxLength={300} value={form.accessibility} onChange={(e) => setForm({ ...form, accessibility: e.target.value })} /></label>
      <button className="btn btn-primary self-start" disabled={busy || !hasEvidence}>{busy ? t({ ar: 'عم نحضّر النشاط…', en: 'Preparing activity…' }) : t({ ar: 'اقترح نشاط للصف', en: 'Suggest a class activity' })}</button>
    </form>
    {saved.length > 0 && <div className="card row">
      <span>{t({ ar: 'أنشطة محفوظة', en: 'Saved activities' })}</span>
      {saved.map((item) => <button className="btn btn-secondary" key={item.id} onClick={() => { setId(item.id); setPlan(item.plan); setStatus(''); }}>
        {item.plan.title}
      </button>)}
    </div>}
    {plan && <section className="card stack">
      <Notice>{plan.source === 'ai' ? t({ ar: 'اقتراح من الذكاء الاصطناعي للمراجعة.', en: 'AI suggestion for review.' }) : t({ ar: 'اقتراح من قالب الحزمة للمراجعة.', en: 'Pack template suggestion for review.' })}</Notice>
      {planFields.map(([key, label]) => <label className="field" key={key}><span>{t(label)}</span><textarea className="textarea" rows={2} value={plan[key]} onChange={(e) => setPlan({ ...plan, [key]: e.target.value })} /></label>)}
      <label className="field"><span>{t({ ar: 'المواد', en: 'Materials' })}</span><textarea className="textarea" value={plan.materials.join('\n')} onChange={(e) => setPlan({ ...plan, materials: e.target.value.split('\n').slice(0, 12) })} /></label>
      {plan.steps.map((step, i) => <fieldset className="card-flat stack" key={i}>
        <legend>{t({ ar: 'خطوة', en: 'Step' })} {i + 1}</legend>
        <input className="input" aria-label={t({ ar: 'اسم الخطوة', en: 'Step title' })} value={step.title} onChange={(e) => setPlan({ ...plan, steps: plan.steps.map((s, j) => i === j ? { ...s, title: e.target.value } : s) })} />
        <textarea className="textarea" aria-label={t({ ar: 'وصف الخطوة', en: 'Step instructions' })} value={step.detail} onChange={(e) => setPlan({ ...plan, steps: plan.steps.map((s, j) => i === j ? { ...s, detail: e.target.value } : s) })} />
      </fieldset>)}
      <div className="row">
        <button className="btn btn-primary" onClick={() => {
          const ok = saveActivity({ id, savedAt: Date.now(), code: view.meta.code, pack: pack.id, plan });
          if (ok) setSaved(savedForRoom());
          setStatus(ok ? t({ ar: 'انحفظ النشاط.', en: 'Activity saved.' }) : t({ ar: 'تعذّر حفظ النشاط.', en: 'Could not save the activity.' }));
        }}>{t({ ar: 'احفظ', en: 'Save' })}</button>
        <button className="btn btn-secondary" onClick={() => downloadFile('silsila-activity.txt', activityText(plan, lang), 'text/plain;charset=utf-8')}>{t({ ar: 'نزّل', en: 'Download' })}</button>
        {status && <p role="status">{status}</p>}
      </div>
    </section>}
  </div>;
}
