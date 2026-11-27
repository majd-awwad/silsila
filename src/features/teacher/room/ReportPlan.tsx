/** Report page: the next lesson as a plan from the class's own groups, and one follow-up card per group. */
import { useState } from 'react';
import { interventionGroups } from '../../../brain/classInsights';
import type { LearnerRecord, TeacherRoomView } from '../../../contracts';
import { useI18n } from '../../../i18n';
import type { ConceptPack } from '../../../packs/types';
import { absoluteLink } from '../../../router';
import { boardKey, currentBoard, loadBoard } from '../logic/groups';
import { learnersLabel } from '../logic/labels';
import { DEFAULT_MINUTES, followUpCards, planAsText, remedialPlan } from '../logic/remedial';
import type { PlanPart } from '../logic/remedial';

export function ReportPlan({ pack, view, records }: { pack: ConceptPack; view: TeacherRoomView; records: LearnerRecord[] }) {
  const { t, n, lang } = useI18n();
  const ids = view.participants.map((p) => p.id);
  const board = currentBoard(loadBoard(boardKey(view.meta.code, view.meta.createdAt)), interventionGroups(pack, records), ids);
  const [minutes, setMinutes] = useState<Record<PlanPart['id'], number>>({ ...DEFAULT_MINUTES });
  const [copied, setCopied] = useState<string | null>(null);
  const plan = remedialPlan(pack, board, records, minutes);
  const cards = followUpCards(pack, board);
  const total = plan.reduce((s, p) => s + p.minutes, 0);
  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => setCopied(key), () => setCopied(null));
  };
  const titleOf = (id: string) => board.groups.find((g) => g.id === id)?.title;
  if (!board.groups.some((g) => g.members.length)) return null;
  return <>
    <section className="card stack" aria-labelledby="plan-h">
      <div className="row">
        <h2 id="plan-h" className="subtitle flex-1">{t({ ar: 'خطة الحصة العلاجية الجاية', en: 'Next remedial lesson plan' })} · {n(total)} {t({ ar: 'دقيقة', en: 'min' })}</h2>
        <button type="button" className="btn btn-secondary btn-sm no-print" onClick={() => copy('plan', planAsText(pack, plan, lang))}>{copied === 'plan' ? t({ ar: 'اننسخت', en: 'Copied' }) : t({ ar: 'انسخ الخطة', en: 'Copy the plan' })}</button>
      </div>
      <p className="help">{t({ ar: 'من مجموعات صفّك الحقيقية. الأوقات نقطة بداية، عدّلوها. الأعداد من هالصف، مش من مثال.', en: 'Built from the groups your class really formed. Minutes are a starting point: edit them. Counts come from this class, not from an example.' })}</p>
      <ol className="stack !gap-3">
        {plan.map((p) => <li key={p.id} className="card-flat stack !gap-1">
          <div className="row">
            <strong className="flex-1">{t(p.title)}</strong>
            <label className="row !gap-1 no-print"><span className="help">{t({ ar: 'دقائق', en: 'Minutes' })}</span>
              <input className="input" type="number" min={0} max={45} value={p.minutes} style={{ inlineSize: '5rem' }} aria-label={t({ ar: `دقائق: ${p.title.ar}`, en: `Minutes: ${p.title.en}` })}
                onChange={(e) => setMinutes({ ...minutes, [p.id]: Math.max(0, Math.min(45, Math.round(Number(e.target.value) || 0))) })} />
            </label>
          </div>
          <ul className="stack !gap-1">{p.lines.map((l, i) => <li key={i}>{t(l)}</li>)}</ul>
          {p.groupIds.length > 0 && <p className="help">{t({ ar: `مربوط بـ ${learnersLabel('ar', p.learners, n)}: `, en: `Linked to ${learnersLabel('en', p.learners, n)}: ` })}{p.groupIds.map((id) => { const x = titleOf(id); return x ? t(x) : ''; }).filter(Boolean).join(' · ')}</p>}
          {p.evidence && <blockquote className="tc-quote" dir="auto">«{p.evidence}»</blockquote>}
        </li>)}
      </ol>
    </section>

    <section className="card stack" aria-labelledby="cards-h">
      <h2 id="cards-h" className="subtitle">{t({ ar: 'بطاقات المتابعة', en: 'Follow-up cards' })}</h2>
      <p className="help">{t({ ar: 'السجل المنزلي ما بيتزامن تلقائياً مع المعلّم: الطالب بيفتح الرابط على جهازه، وأنت بتسأله عن النتيجة أو بتطلب منه يفتح الملخّص.', en: 'Work done at home does not sync to the teacher automatically: the learner opens the link on their own device and you ask about the result or ask to see the summary.' })}</p>
      <ul className="stack !gap-3">
        {cards.map((c) => {
          const link = absoluteLink(`/learn/${c.lessonPack}`);
          return <li key={c.groupId} className="card-flat stack !gap-1">
            <strong>{t(c.title)} · {learnersLabel(lang, c.learners, n)}</strong>
            <span><strong>{t({ ar: 'المفهوم اللي بدّه تقوية: ', en: 'Concept to strengthen: ' })}</strong>{t(c.concept)}</span>
            <span className="row"><strong>{t({ ar: 'رابط الدرس الفردي: ', en: 'Individual lesson link: ' })}</strong><bdi dir="ltr">{link}</bdi>
              <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => copy(c.groupId, link)}>{copied === c.groupId ? t({ ar: 'اننسخ', en: 'Copied' }) : t({ ar: 'انسخ الرابط', en: 'Copy link' })}</button></span>
            {c.check && <span><strong>{t({ ar: 'سؤال تحقق للحصة الجاية: ', en: 'Check question for next lesson: ' })}</strong>{t(c.check.q)} <span className="help">({t({ ar: 'الجواب: ', en: 'Answer: ' })}{t(c.check.options[c.check.correct])})</span></span>}
          </li>;
        })}
      </ul>
    </section>
  </>;
}
