/**
 * Create a live session. The constraints chosen here are what the planner later respects, so the page shows at
 * once which experiments they allow.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ExperimentMode, Lang, RoomError, RoomSettings } from '../../../contracts';
import { roomApi } from '../../../brain/client';
import { SAMPLE_CODE } from '../../../brain/sample';
import { useI18n } from '../../../i18n';
import { PACKS, PACK_LIST } from '../../../packs';
import { RESOURCES, RESOURCE_IDS } from '../../../packs/resources';
import type { ResourceId } from '../../../packs/resources';
import type { Subject } from '../../../packs/types';
import { navigate, useRoute } from '../../../router';
import { Notice, Segmented } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { PageHead, RoomProblem, TeacherShell } from '../components/ui';
import { REJECT_LABEL, SUBJECT_LABEL } from '../logic/labels';
import { feasibility } from '../logic/planView';
import { PhenomenonPreview } from '../../../ui/PhenomenonPreview';
import { Stepper } from '../room/Stepper';
import { resetSample } from '../logic/sampleRoom';

export function NewSession() {
  const { t, n, lang } = useI18n();
  const { query } = useRoute();
  const wanted = PACKS[query.get('pack') ?? ''] ?? PACK_LIST[0];
  const [subject, setSubject] = useState<Subject>(wanted.subject);
  const [packId, setPackId] = useState(wanted.id);
  const pack = PACKS[packId] ?? wanted;
  const [grade, setGrade] = useState(wanted.grades[0]);
  const [minutes, setMinutes] = useState(45);
  const [resources, setResources] = useState<ResourceId[]>([]);
  const [supervision, setSupervision] = useState(false);
  const [objective, setObjective] = useState('');
  const [learnerLang, setLearnerLang] = useState<Lang>(lang);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<ExperimentMode>('digital');
  const [accessibility, setAccessibility] = useState<NonNullable<RoomSettings['accessibility']>>([]);
  const modes = [
    { id: 'digital', label: t({ ar: 'محاكاة رقمية', en: 'Digital simulation' }) },
    { id: 'physical', label: t({ ar: 'تجربة صفّية مادية', en: 'Physical experiment' }) },
    { id: 'hybrid', label: t({ ar: 'تجربة مادية ومحاكاة', en: 'Physical and digital' }) },
  ] as const;
  const accessOptions = [
    ['visual', { ar: 'وصف بصري أو تكبير', en: 'Visual descriptions or magnification' }],
    ['hearing', { ar: 'تعليمات مكتوبة', en: 'Written instructions' }],
    ['reading', { ar: 'دعم القراءة', en: 'Reading support' }],
    ['motor', { ar: 'دعم الحركة أو الإدخال', en: 'Motor or input support' }],
  ] as const;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RoomError | null>(null);
  const [sampleFailed, setSampleFailed] = useState(false);

  const subjects = [...new Set(PACK_LIST.map((p) => p.subject))];
  const choosePack = (id: string) => {
    const next = PACKS[id];
    if (!next) return;
    setPackId(id);
    setObjective('');
    setGrade((g) => Math.min(next.grades[1], Math.max(next.grades[0], g)));
  };
  const chooseSubject = (s: Subject) => {
    setSubject(s);
    const first = PACK_LIST.find((p) => p.subject === s);
    if (first) choosePack(first.id);
  };

  const validMinutes = Number.isInteger(minutes) && minutes >= 5 && minutes <= 120;
  const allowed = feasibility(pack, { minutes: validMinutes ? minutes : 45, resources, grade, supervision, mode, objective: objective || null });
  const feasible = allowed.filter((a) => !a.reasons.length).length;
  // only materials that some experiment of this lesson uses change the plan
  const used = new Set(pack.experiments.flatMap((x) => x.materials));
  const toggle = (id: ResourceId) => setResources((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !validMinutes) return;
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true);
    setError(null);
    const r = await roomApi.create({ pack: pack.id, lang: learnerLang, grade, minutes, resources, supervision, mode, accessibility, objective: objective || null });
    setBusy(false);
    if (r.ok) navigate(`/teacher/room/${r.data.code}`);
    else setError(r.error);
  }

  const openSample = () => {
    if (resetSample(pack.id, learnerLang)) navigate(`/teacher/room/${SAMPLE_CODE}`);
    else setSampleFailed(true);
  };

  const check = (id: ResourceId) => (
    <label key={id} className="check">
      <input type="checkbox" checked={resources.includes(id)} onChange={() => toggle(id)} />
      <span>{t(RESOURCES[id])}</span>
    </label>
  );

  return (
    <TeacherShell active="new">
      <PageHead
        title={t({ ar: 'حصة جديدة', en: 'New session' })}
        lead={t({ ar: 'حدّدوا الدرس وشروط صفّكم. اقتراح التجربة بيلتزم فيها.', en: 'Choose the lesson and your classroom constraints. The experiment suggestion respects them.' })}
      />
      <Stepper />
      <div className="tc-split live-preparation">
        <form className="card stack !gap-5" onSubmit={submit}>
          <h2 className="subtitle">{n(step + 1)} / {n(3)} · {[
            t({ ar: 'الدرس وأهداف التعلّم', en: 'Lesson and learning goals' }),
            t({ ar: 'طريقة التنفيذ والتيسيرات', en: 'Materials and accessibility' }),
            t({ ar: 'مراجعة قبل فتح الحصة', en: 'Review before opening' }),
          ][step]}</h2>
          {step === 0 && <>
          <div className="field">
            <span className="label">{t({ ar: 'المادة', en: 'Subject' })}</span>
            <Segmented label={t({ ar: 'المادة', en: 'Subject' })} value={subject} onChange={chooseSubject}
              options={subjects.map((s) => ({ id: s, label: t(SUBJECT_LABEL[s]) }))} />
          </div>
          <div className="field">
            <label className="label" htmlFor="ns-pack">{t({ ar: 'الدرس', en: 'Lesson' })}</label>
            <select id="ns-pack" className="select" value={packId} onChange={(e) => choosePack(e.target.value)}>
              {PACK_LIST.filter((p) => p.subject === subject).map((p) => <option key={p.id} value={p.id}>{t(p.title)}</option>)}
            </select>
            <span className="help">{t(pack.question)}</span>
          </div>
          <div className="tc-form-grid">
            <div className="field">
              <label className="label" htmlFor="ns-grade">{t({ ar: 'الصف', en: 'Grade' })}</label>
              <select id="ns-grade" className="select" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>{n(g)}{g >= pack.grades[0] && g <= pack.grades[1] ? ` · ${t({ ar: 'ضمن الدرس', en: 'in range' })}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="ns-min">{t({ ar: 'دقايق الحصة', en: 'Lesson minutes' })}</label>
              <input id="ns-min" className="input" type="number" min={5} max={120} step={1} inputMode="numeric" value={Number.isNaN(minutes) ? '' : minutes}
                onChange={(e) => setMinutes(e.target.value === '' ? NaN : Number(e.target.value))} aria-invalid={!validMinutes} aria-describedby="ns-min-help" />
              <span id="ns-min-help" className={validMinutes ? 'help' : 'help !text-probe-ink'}>{t({ ar: 'من ٥ إلى ١٢٠ دقيقة.', en: 'Between 5 and 120 minutes.' })}</span>
            </div>
            <div className="field">
              <span className="label">{t({ ar: 'لغة المتعلّمين', en: 'Learner language' })}</span>
              <Segmented label={t({ ar: 'لغة المتعلّمين', en: 'Learner language' })} value={learnerLang} onChange={setLearnerLang}
                options={[{ id: 'ar', label: 'العربية' }, { id: 'en', label: 'English' }]} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="ns-obj">{t({ ar: 'هدف الحصة', en: 'Session objective' })}</label>
            <select id="ns-obj" className="select" value={objective} onChange={(e) => setObjective(e.target.value)}>
              <option value="">{t({ ar: 'بدون هدف محدّد', en: 'No specific objective' })}</option>
              {pack.objectives.map((o) => <option key={o.id} value={o.id}>{t(o.text)}</option>)}
            </select>
          </div>
          </>}
          {step === 1 && <>
            <Segmented label={t({ ar: 'طريقة تنفيذ التجربة', en: 'Experiment mode' })} value={mode} onChange={setMode} options={[...modes]} />
            <p className="help">{mode === 'digital' ? t({ ar: 'تعمل المحاكاة دون مواد مادية. يعرض الصف ناتج النموذج العلمي عند الكشف.', en: 'Simulations require no physical materials and reveal the reference model when the teacher runs the test.' })
              : t({ ar: 'يُراجع المخطّط الوقت والمواد والسلامة. تُقارن ملاحظات الصف المادية بناتج المحاكاة أثناء النقاش.', en: 'The planner checks time, materials, and safety. Discuss physical observations alongside the model result.' })}</p>
            <fieldset className="tc-fieldset">
              <legend>{t({ ar: 'تيسيرات الوصول', en: 'Accessibility needs' })}</legend>
              <div className="tc-checks">{accessOptions.map(([id, label]) => <label className="check" key={id}>
                <input type="checkbox" checked={accessibility.includes(id)} onChange={() => setAccessibility((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id])} />
                {t(label)}
              </label>)}</div>
            </fieldset>
            {mode !== 'digital' && <>
          <fieldset className="tc-fieldset">
            <legend>{t({ ar: 'المواد المتوفّرة', en: 'Available materials' })}</legend>
            <div className="row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResources([...RESOURCE_IDS])}>{t({ ar: 'الكل متوفّر', en: 'All available' })}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResources([])}>{t({ ar: 'ولا إشي', en: 'None' })}</button>
            </div>
            <span className="help">{t({ ar: 'مواد هالدرس:', en: 'Used by this lesson:' })}</span>
            <div className="tc-checks">{RESOURCE_IDS.filter((id) => used.has(id)).map(check)}</div>
            <details>
              <summary className="link">{t({ ar: 'مواد ثانية', en: 'Other materials' })}</summary>
              <div className="tc-checks">{RESOURCE_IDS.filter((id) => !used.has(id)).map(check)}</div>
            </details>
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={supervision} onChange={(e) => setSupervision(e.target.checked)} />
            <span>{t({ ar: 'في شخص بالغ بيشرف على التجربة', en: 'An adult can supervise the experiment' })}</span>
          </label>

            </>}
          </>}
          {step === 2 && <dl className="live-summary">
            <div><dt>{t({ ar: 'الدرس', en: 'Lesson' })}</dt><dd>{t(pack.title)}</dd></div>
            <div><dt>{t({ ar: 'الصف والمدة', en: 'Grade and duration' })}</dt><dd>{n(grade)} · {n(minutes)} {t({ ar: 'دقيقة', en: 'min' })}</dd></div>
            <div><dt>{t({ ar: 'لغة الطلاب', en: 'Student language' })}</dt><dd>{learnerLang === 'ar' ? 'العربية' : 'English'}</dd></div>
            <div><dt>{t({ ar: 'التجربة', en: 'Experiment' })}</dt><dd>{modes.find((item) => item.id === mode)?.label}</dd></div>
            <div><dt>{t({ ar: 'هدف التعلّم', en: 'Learning goal' })}</dt><dd>{objective ? t(pack.objectives.find((item) => item.id === objective)!.text) : t({ ar: 'الهدف العام للدرس', en: 'General lesson objective' })}</dd></div>
            <div><dt>{t({ ar: 'تيسيرات الوصول', en: 'Accessibility needs' })}</dt><dd>{accessOptions.filter(([id]) => accessibility.includes(id)).map(([, label]) => t(label)).join(' · ') || '—'}</dd></div>
            {mode !== 'digital' && <div><dt>{t({ ar: 'المواد والإشراف', en: 'Materials and supervision' })}</dt><dd>{RESOURCE_IDS.filter((id) => used.has(id) && resources.includes(id)).map((id) => t(RESOURCES[id])).join(' · ') || '—'}<br />{supervision ? t({ ar: 'إشراف بالغ متاح', en: 'Adult supervision available' }) : t({ ar: 'إشراف بالغ غير متاح', en: 'Adult supervision unavailable' })}</dd></div>}
          </dl>}
          {error && (
            <div className="stack !gap-2">
              <RoomProblem error={error} />
              <Notice tone="warn">
                <div className="stack !gap-2">
                  <span>{t({ ar: 'الصف الحي بدّه الخادم. تقدروا تشوفوا نفس الخطوات بالصف التجريبي على هالجهاز (متعلّمين وهميين).', en: 'A live class needs the server. You can walk through the same steps in the sample classroom on this device (example learners).' })}</span>
                  <div><button type="button" className="btn btn-secondary btn-sm" onClick={openSample}>{t({ ar: 'افتحوا الصف التجريبي بهالدرس', en: 'Open the sample classroom with this lesson' })}</button></div>
                </div>
              </Notice>
            </div>
          )}
          {sampleFailed && <Notice tone="error">{t({ ar: 'ما قدرنا نجهّز الصف التجريبي لهالدرس.', en: 'The sample classroom could not be prepared for this lesson.' })}</Notice>}
          <div className="row live-form-actions">
          {step > 0 && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setStep(step - 1)}>{t({ ar: 'السابق', en: 'Back' })}</button>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !validMinutes}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="qr" />}
            {busy ? t({ ar: 'جارٍ فتح الصف…', en: 'Opening the room…' }) : step < 2 ? t({ ar: 'التالي', en: 'Continue' }) : t({ ar: 'افتح الصف', en: 'Create the room' })}
          </button>
          </div>
        </form>

        <aside className="card stack !gap-3 tc-sticky" aria-live="polite">
          <PhenomenonPreview pack={pack} />
          <h2 className="subtitle">{t({ ar: 'التجارب المتاحة', en: 'Eligible experiments' })}</h2>
          <p>{t({ ar: `${n(feasible)} من ${n(pack.experiments.length)} تجارب ممكنة.`, en: `${feasible} of ${pack.experiments.length} experiments are feasible.` })}</p>
          <details><summary className="link">{t({ ar: 'تفاصيل الأهلية', en: 'Eligibility details' })}</summary><ul className="tc-plain stack !gap-2">
            {pack.experiments.map((x) => {
              const a = allowed.find((y) => y.id === x.id)!;
              const ok = !a.reasons.length;
              return (
                <li key={x.id} className="tc-prompt flex gap-2 items-start">
                  <span className={ok ? 'text-real-ink' : 'text-probe-ink'}><Icon name={ok ? 'check' : 'cross'} /></span>
                  <span className="min-w-0">
                    <strong className="block text-[14.5px]">{t(x.name)} <span className="muted font-normal">· {n(x.minutes)} {t({ ar: 'د', en: 'min' })}</span></strong>
                    {ok ? <span className="help">{t({ ar: 'ممكنة', en: 'Feasible' })}</span> : (
                      <span className="help">
                        {a.reasons.map((r) => (r === 'materials' ? `${t(REJECT_LABEL.materials)}: ${a.missing.map((m) => t(RESOURCES[m])).join(t({ ar: '، ', en: ', ' }))}` : t(REJECT_LABEL[r]))).join(' · ')}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul></details>
          {feasible === 0 && <Notice tone="warn">{t({ ar: 'بتقدروا تفتحوا الصف، بس ما رح يكون في تجربة مقترحة بهالشروط.', en: 'You can still open the room, but no experiment can be suggested under these constraints.' })}</Notice>}
        </aside>
      </div>
    </TeacherShell>
  );
}
