import { useEffect, useState } from 'react';
import { activity, lesson } from '../../../brain/client';
import { groupKey, latestDiagnosis } from '../../../brain/records';
import { interventionGroups } from '../../../brain/classInsights';
import { ActivityKind, LessonDraft as DraftSchema, LessonInput as InputSchema } from '../../../contracts';
import type { ActivityPlan, L, LearnerRecord, LessonDraft, LessonInput } from '../../../contracts';
import { useI18n } from '../../../i18n';
import { PACKS } from '../../../packs';
import { RESOURCES, RESOURCE_IDS } from '../../../packs/resources';
import { href } from '../../../router';
import { loadRecords } from '../../../store/records';
import { EmptyState, Loading, Notice, downloadFile } from '../../../ui/kit';
import { LearnerReport } from '../components/LearnerReport';
import { PageHead, TeacherShell } from '../components/ui';
import { activityRequest, activityText, defaultForm, loadActivities, saveActivity } from '../logic/activities';
import { shortId } from '../logic/storage';
import { cleanDraft, draftText, loadDrafts, localiseDraft, newDraftId, saveDraft } from '../logic/studio';
import type { RoomTabProps } from '../room/types';
import { boardKey, currentBoard, loadBoard } from '../logic/groups';
import { groupTitle } from '../logic/labels';

export function Learners() {
  const { t, lang } = useI18n();
  const [records, setRecords] = useState<LearnerRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [packId, setPackId] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    void loadRecords().then((items) => { if (active) setRecords(items.filter((r) => Object.hasOwn(PACKS, r.pack) && !r.sample && !r.classCode && r.events.length).sort((a, b) => b.startedAt - a.startedAt)); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const uid = (record: LearnerRecord) => record.id.slice(-8);
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const query = search.trim().toLocaleLowerCase(locale);
  const matches = records?.filter((r) => (!packId || r.pack === packId) && (!status || (status === 'done') === !!r.finishedAt)
    && [r.alias, uid(r), t(PACKS[r.pack].title), dates.format(r.startedAt)].some((value) => value.toLocaleLowerCase(locale).includes(query)));
  return <TeacherShell active="learners">
    <div className="stack">
      <PageHead title={t({ ar: 'سجلّات المتعلّمين', en: 'Learner records' })} lead={t({ ar: 'كل صفّ في القائمة محاولة فردية على هذا الجهاز. لعرض بيانات صف مشترك افتح تقرير الحصة.', en: 'Each entry is one individual attempt on this device. For shared classroom data, open its class report.' })} />
      {!!records?.length && <div className="tc-form-grid card">
        <label className="field"><span>{t({ ar: 'بحث بالاسم المستعار أو المعرّف', en: 'Search by pseudonym or ID' })}</span><input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="field"><span>{t({ ar: 'الدرس', en: 'Lesson' })}</span><select className="select" value={packId} onChange={(e) => setPackId(e.target.value)}><option value="">{t({ ar: 'كل الدروس', en: 'All lessons' })}</option>{Object.values(PACKS).map((p) => <option value={p.id} key={p.id}>{t(p.title)}</option>)}</select></label>
        <label className="field"><span>{t({ ar: 'حالة المحاولة', en: 'Attempt status' })}</span><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t({ ar: 'الكل', en: 'All' })}</option><option value="done">{t({ ar: 'مكتملة', en: 'Complete' })}</option><option value="open">{t({ ar: 'قيد التعلّم', en: 'In progress' })}</option></select></label>
      </div>}
      {failed ? <Notice tone="error">{t({ ar: 'ما قدرنا نقرأ السجلّات.', en: 'Could not read saved records.' })}</Notice>
        : !records ? <Loading /> : !records.length ? <EmptyState>{t({ ar: 'لسه ما في سجلّات.', en: 'No learner records yet.' })}</EmptyState>
          : !matches?.length ? <EmptyState>{t({ ar: 'لا توجد محاولات تطابق البحث.', en: 'No attempts match your search.' })}</EmptyState>
            : matches.map((r) => <details className="card" key={r.id}><summary className="live-record"><strong><bdi>{r.alias}</bdi> <bdi className="help">{uid(r)}</bdi></strong><span>{t(PACKS[r.pack].title)} · {dates.format(r.startedAt)}</span>
              <span>{r.finishedAt ? t({ ar: 'مكتملة', en: 'Complete' }) : t({ ar: 'قيد التعلّم', en: 'In progress' })} · {t(groupTitle(PACKS[r.pack], groupKey(PACKS[r.pack], latestDiagnosis(r))))}</span></summary><LearnerReport record={r} pack={PACKS[r.pack]} /></details>)}
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
  const generate = async (section?: (typeof draftLists)[number]) => {
    const checked = InputSchema.safeParse({ ...input, lang, title: input.title.trim() });
    if (!checked.success || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const result = localiseDraft(await lesson(checked.data), lang);
      setDraft((previous) => section && previous ? { ...previous, [section]: result[section] } : result);
      if (!section) {
        setInput(checked.data);
        setId(newDraftId());
      }
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
    <div className="stack live-studio">
      <PageHead title={t({ ar: 'استوديو الدروس', en: 'Lesson studio' })} lead={t({ ar: 'حوّل محتوى الدرس إلى مسودة قابلة للتحرير، وراجعها قبل استخدامها.', en: 'Turn lesson content into an editable draft and review it before use.' })} />
      <div className="live-studio-grid">
      <div className="stack no-print">
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
        <h2 className="subtitle">{t({ ar: 'إعدادات الدرس', en: 'Lesson brief' })}</h2>
        <label className="field"><span>{t({ ar: 'استيراد نص الدرس (.txt). للصور وPDF: الصق النص بالحقل (رفع الصور وPDF رؤية مستقبلية)', en: 'Import lesson text (.txt). For images and PDFs paste the text (uploading them is a future vision)' })}</span><input className="input" type="file" accept=".txt,text/plain" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            if (!file.name.toLowerCase().endsWith('.txt') || file.size > 64_000) throw new Error('invalid text');
            const body = await file.text();
            setInput((previous) => ({ ...previous, content: body.slice(0, 4000) }));
            setStatus(body.length > 4000 ? t({ ar: 'استُورد أول ٤٠٠٠ حرف.', en: 'The first 4,000 characters were imported.' }) : t({ ar: 'تم استيراد النص.', en: 'Text imported.' }));
          } catch { setStatus(t({ ar: 'اختر ملفاً نصياً صغيراً أو الصق المحتوى مباشرة.', en: 'Choose a small text file or paste the content.' })); }
        }} /><span className="help">{t({ ar: 'لملف PDF، انسخ النص المطلوب والصقه في حقل المحتوى.', en: 'For a PDF, copy and paste the relevant text into the content field.' })}</span></label>
        {lessonFields.map(([key, label, max]) => <label className="field" key={key}><span>{t(label)}</span>
          {max > 120 ? <textarea className="textarea" rows={3} maxLength={max} value={input[key]} onChange={(e) => setInput({ ...input, [key]: e.target.value })} />
            : <input className="input" required={key === 'title'} minLength={key === 'title' ? 2 : undefined} maxLength={max} value={input[key]} onChange={(e) => setInput({ ...input, [key]: e.target.value })} />}
        </label>)}
        <div className="row">
          <label className="field"><span>{t({ ar: 'الصف', en: 'Grade' })}</span><input className="input" type="number" min="1" max="12" required value={input.grade || ''} onChange={(e) => setField('grade', Number(e.target.value))} /></label>
          <label className="field"><span>{t({ ar: 'الدقائق', en: 'Minutes' })}</span><input className="input" type="number" min="5" max="120" required value={input.minutes || ''} onChange={(e) => setField('minutes', Number(e.target.value))} /></label>
        </div>
        <button className="btn btn-primary self-start" disabled={busy}>{busy ? t({ ar: 'عم نحضّر المسودّة…', en: 'Preparing draft…' }) : t({ ar: 'حضّر مسودّة', en: 'Generate draft' })}</button>
        {status && <p role="status">{status}</p>}
      </form>
      {saved.length > 0 && <div className="card row"><span>{t({ ar: 'مسودّات محفوظة', en: 'Saved drafts' })}</span>
        {saved.map((item) => <button className="btn btn-secondary" key={item.id} onClick={() => { setId(item.id); setInput(item.input); setDraft(item.draft); setReviewed(item.reviewed); setStatus(''); }}>{item.draft.title || item.input.title}</button>)}
      </div>}
      </div>
      {draft ? <section className="card stack live-studio-draft">
        <h2 className="subtitle">{t({ ar: 'معاينة المسودة وتحريرها', en: 'Preview and edit draft' })}</h2>
        <Notice>{draft.source === 'ai' ? t({ ar: 'مسودّة من الذكاء الاصطناعي.', en: 'AI-generated draft.' }) : t({ ar: 'مسودّة من قالب.', en: 'Template-based draft.' })}{' '}
          {draft.matchedPack && Object.hasOwn(PACKS, draft.matchedPack) ? t({ ar: 'في حزمة تفاعلية جاهزة لهالموضوع.', en: 'A supported concept pack is available.' }) : t({ ar: 'هالموضوع بحاجة لمراجعة، وما إله محاكاة تفاعلية جاهزة.', en: 'This topic needs review and has no supported interactive simulation.' })}</Notice>
        <p className="help" role="note">{t({ ar: 'مسودة يراجعها المعلّم، مش محاكاة جديدة: الأهداف والمفاهيم والأخطاء المتوقّعة والمتطلبات السابقة بتنكتب من النص، والمحاكاة التفاعلية بتتوفّر بس إذا الموضوع بيطابق حزمة موجودة.', en: 'A draft for the teacher to review, not a new simulation: objectives, concepts, likely mistakes and prerequisites are drafted from the text, and an interactive simulation exists only when the topic matches an existing pack.' })}</p>
        <input className="input" aria-label={t({ ar: 'عنوان المسودّة', en: 'Draft title' })} value={draft.title} onChange={(e) => change({ ...draft, title: e.target.value })} />
        {draftLists.map((key) => <details key={key} open={key === 'objectives' || undefined}><summary>{t(DRAFT_LABELS[key])}</summary><div className="stack">
          <textarea className="textarea" aria-label={t(DRAFT_LABELS[key])} rows={3} value={draft[key].join('\n')} onChange={(e) => change({ ...draft, [key]: e.target.value.split('\n').slice(0, 10) })} />
          <button className="btn btn-secondary self-start no-print" type="button" disabled={busy} onClick={() => void generate(key)}>{t({ ar: 'جدّد هذا القسم من حقول الإعداد', en: 'Regenerate this section from lesson inputs' })}</button>
        </div></details>)}
        <details><summary>{t({ ar: 'أفكار متوقّعة وأسئلة التشخيص', en: 'Likely ideas and diagnostic prompts' })}</summary>{draft.misconceptions.map((row, i) => <div className="tc-form-grid" key={i}>
          {(['idea', 'probe'] as const).map((key) => <label className="field" key={key}>{key === 'idea' ? t({ ar: 'الفكرة', en: 'Idea' }) : t({ ar: 'سؤال التشخيص', en: 'Diagnostic prompt' })}<input className="input" value={row[key]} onChange={(event) => change({ ...draft, misconceptions: draft.misconceptions.map((item, j) => i === j ? { ...item, [key]: event.target.value } : item) })} /></label>)}
        </div>)}</details>
        <details><summary>{t({ ar: 'التجارب', en: 'Experiments' })}</summary>{draft.experiments.map((row, i) => <div className="card-flat stack" key={i}>
          {(['title', 'steps', 'materials', 'safety'] as const).map((key) => <label className="field" key={key}>{t({ title: { ar: 'العنوان', en: 'Title' }, steps: { ar: 'الخطوات', en: 'Steps' }, materials: { ar: 'المواد', en: 'Materials' }, safety: { ar: 'السلامة', en: 'Safety' } }[key])}
            <textarea className="textarea" rows={2} value={typeof row[key] === 'string' ? row[key] : row[key].join('\n')} onChange={(event) => {
              const value = key === 'steps' || key === 'materials' ? event.target.value.split('\n').slice(0, 10) : event.target.value;
              change({ ...draft, experiments: draft.experiments.map((item, j) => i === j ? { ...item, [key]: value } : item) });
            }} /></label>)}
        </div>)}</details>
        <details><summary>{t({ ar: 'الأنشطة', en: 'Activities' })}</summary>{draft.activities.map((row, i) => <div className="card-flat stack" key={i}>
          {(['title', 'minutes', 'detail'] as const).map((key) => <label className="field" key={key}>{t({ title: { ar: 'العنوان', en: 'Title' }, minutes: { ar: 'الدقائق', en: 'Minutes' }, detail: { ar: 'تعليمات النشاط', en: 'Instructions' } }[key])}<input className="input" type={key === 'minutes' ? 'number' : 'text'} value={row[key]} onChange={(event) => change({ ...draft, activities: draft.activities.map((item, j) => i === j ? { ...item, [key]: key === 'minutes' ? Number(event.target.value) : event.target.value } : item) })} /></label>)}
        </div>)}</details>
        <label className="row"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />{t({ ar: 'راجعت المسودّة', en: 'I reviewed this draft' })}</label>
        <div className="row">
          <button className="btn btn-primary" onClick={save}>{t({ ar: 'احفظ المسودّة', en: 'Save draft' })}</button>
          <button className="btn btn-secondary" onClick={() => downloadFile('silsila-lesson.txt', draftText(draft, input, lang, reviewed), 'text/plain;charset=utf-8')}>{t({ ar: 'نزّل المسودّة', en: 'Download draft' })}</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>{t({ ar: 'اطبع المسودة', en: 'Print draft' })}</button>
          {reviewed && draft.matchedPack && Object.hasOwn(PACKS, draft.matchedPack) && <a className="btn btn-secondary" href={href('/teacher/new?pack=' + draft.matchedPack)}>{t({ ar: 'افتح حصة من الحزمة', en: 'Create a session from this pack' })}</a>}
        </div>
        <pre className="live-studio-print" dir="auto">{draftText(draft, input, lang, reviewed)}</pre>
      </section> : <EmptyState>{t({ ar: 'ستظهر مسودة الدرس هنا بعد تجهيزها.', en: 'Your lesson draft will appear here.' })}</EmptyState>}
      </div>
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
  const [form, setForm] = useState(() => ({ ...defaultForm(view.meta.settings, records.length), objective: view.meta.settings.objective ?? '', accessibility: (view.meta.settings.accessibility ?? []).join(', ') }));
  const [groupId, setGroupId] = useState('');
  const board = currentBoard(loadBoard(boardKey(view.meta.code, view.meta.createdAt)), interventionGroups(pack, records), records.map((record) => record.id));
  const selectedGroup = board.groups.find((group) => group.id === groupId);
  const target = groupId ? records.filter((record) => selectedGroup?.members.includes(record.id)) : records;
  const savedForRoom = () => loadActivities().filter((item) => item.code === view.meta.code && item.pack === pack.id);
  const [saved, setSaved] = useState(savedForRoom);
  const [plan, setPlan] = useState<ActivityPlan | null>(null);
  const [id, setId] = useState(shortId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const hasEvidence = target.some((r) => r.events.some((e) => e.type === 'explain'));
  const generate = async () => {
    if (busy || !hasEvidence) return;
    setBusy(true);
    setStatus('');
    try {
      setPlan(await activity(pack, activityRequest(pack, target, view.meta.settings.grade, lang, form)));
      setId(shortId());
    } finally { setBusy(false); }
  };
  return <div className="stack">
    <form className="card stack" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
      <h2 className="subtitle">{t({ ar: 'خطّة نشاط مبنية على أدلة الحصة', en: 'Activity plan based on classroom evidence' })}</h2>
      {!hasEvidence && <Notice>{t({ ar: 'سيُتاح التوليد عندما يتوفّر شرح لأحد المتعلّمين في المجموعة المختارة.', en: 'Generation becomes available when a learner in the selected group submits an explanation.' })}</Notice>}
      <div className="tc-form-grid">
        <label className="field"><span>{t({ ar: 'المجموعة المستهدفة', en: 'Target group' })}</span><select className="select" value={groupId} onChange={(event) => {
          const id = event.target.value;
          setGroupId(id);
          setPlan(null);
          setForm({ ...form, classSize: Math.max(1, id ? board.groups.find((g) => g.id === id)?.members.length ?? 0 : records.length) });
        }}><option value="">{t({ ar: 'الصف كاملاً', en: 'Entire class' })}</option>{board.groups.map((group) => <option key={group.id} value={group.id}>{group.title[lang]}</option>)}</select></label>
        <label className="field"><span>{t({ ar: 'هدف التعلّم', en: 'Learning objective' })}</span><select className="select" value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })}><option value="">{t({ ar: 'الهدف الأساسي للحزمة', en: 'Main concept objective' })}</option>{pack.objectives.map((objective) => <option key={objective.id} value={objective.id}>{t(objective.text)}</option>)}</select></label>
      </div>
      <p className="help">{t({ ar: `تفسيرات صالحة للمراجعة من ${target.filter(latestDiagnosis).length.toLocaleString('ar-EG')} من أصل ${target.length.toLocaleString('ar-EG')} في الاختيار الحالي.`, en: `${target.filter(latestDiagnosis).length} of ${target.length} learners in the selection have given explanations.` })}</p>
      <div className="row">
        <label className="field"><span>{t({ ar: 'نوع النشاط', en: 'Activity kind' })}</span><select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: ActivityKind.parse(e.target.value) })}>
          {ActivityKind.options.map((kind) => <option key={kind} value={kind}>{t(kinds[kind])}</option>)}
        </select></label>
        <label className="field"><span>{t({ ar: 'الدقائق', en: 'Minutes' })}</span><input type="number" className="input" min="5" max="90" required value={form.minutes || ''} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} /></label>
        <label className="field"><span>{t({ ar: 'عدد الطلاب', en: 'Class size' })}</span><input type="number" className="input" min="1" max="60" required value={form.classSize || ''} onChange={(e) => setForm({ ...form, classSize: Number(e.target.value) })} /></label>
      </div>
      <label className="field"><span>{t({ ar: 'احتياجات الوصول', en: 'Accessibility needs' })}</span><input className="input" maxLength={300} value={form.accessibility} onChange={(e) => setForm({ ...form, accessibility: e.target.value })} /></label>
      <details><summary>{t({ ar: 'المواد المتاحة', en: 'Available materials' })}</summary><div className="tc-checks">
        {RESOURCE_IDS.filter((id) => pack.experiments.some((experiment) => experiment.materials.includes(id))).map((id) => <label className="check" key={id}><input type="checkbox" checked={form.resources.includes(id)} onChange={(event) => setForm({ ...form, resources: event.target.checked ? [...form.resources, id] : form.resources.filter((item) => item !== id) })} />{t(RESOURCES[id])}</label>)}
      </div></details>
      <button className="btn btn-primary self-start" disabled={busy || !hasEvidence}>{busy ? t({ ar: 'عم نحضّر النشاط…', en: 'Preparing activity…' }) : t({ ar: 'اقترح نشاط للصف', en: 'Suggest a class activity' })}</button>
    </form>
    {saved.length > 0 && <div className="card row">
      <span>{t({ ar: 'أنشطة محفوظة', en: 'Saved activities' })}</span>
      {saved.map((item) => <button className="btn btn-secondary" key={item.id} onClick={() => { setId(item.id); setPlan(item.plan); setStatus(''); }}>
        {item.plan.title}
      </button>)}
    </div>}
    {plan && <section className="card stack">
      <h2 className="subtitle">{t({ ar: 'خطة تنفيذ للمعلّم', en: 'Facilitation plan for the teacher' })}</h2>
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
