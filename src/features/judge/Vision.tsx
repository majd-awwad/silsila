/** For the judges, not for children: the approved vision, what exists today for each of the seven ideas, and the honest limits. */
import summary from '../../../evals/reports/latest-offline-summary.json';
import { useI18n } from '../../i18n';
import { href } from '../../router';
import { Shell } from '../../ui/kit';
import { BLENDED, IDEAS, ROADMAP } from './ideas';
import type { IdeaStatus } from './ideas';

const STATUS: Record<IdeaStatus, { ar: string; en: string; cls: string }> = {
  exists: { ar: 'موجود', en: 'Exists', cls: 'chip-real' },
  mini: { ar: 'نسخة مصغّرة', en: 'Smaller version', cls: 'chip-brand' },
  vision: { ar: 'رؤية', en: 'Vision', cls: 'chip-idea' },
};

export function Vision() {
  const { t, n } = useI18n();
  const h = summary.holdout;
  const rate = (v: { pct: number | null; n: number; of: number }) => `${n(v.pct ?? 0, 1)}% (${n(v.n)}/${n(v.of)})`;
  return <Shell nav={[{ to: '/judge', label: { ar: 'تجربة الحكّام', en: 'Judge experience' } }, { to: '/judge/vision', label: { ar: 'الرؤية وخارطة الطريق', en: 'Vision and roadmap' }, active: true }]}>
    <div className="stack !gap-6">
      <header className="stack !gap-1">
        <h1 className="title">{t({ ar: 'الرؤية وخارطة الطريق', en: 'Vision and roadmap' })}</h1>
        <p className="muted">{t({ ar: 'للحكّام، مش للأطفال. كل فكرة بحالتها الحقيقية: موجود، نسخة مصغّرة، أو رؤية. حتى لو انقطع الدوام، تظل سلسلة التعلّم مستمرة.', en: 'For judges, not for children. Each idea with its real status: exists, a smaller version, or vision. Even if school is interrupted, the learning chain continues.' })}</p>
      </header>

      <section className="stack" aria-labelledby="ideas-h">
        <h2 id="ideas-h" className="subtitle">{t({ ar: 'الأفكار السبع', en: 'The seven ideas' })}</h2>
        {IDEAS.map((i) => <article key={i.n} className="card stack !gap-2">
          <div className="row">
            <strong className="flex-1">{n(i.n)}. {t(i.title)}</strong>
            <span className={`chip ${STATUS[i.status].cls}`}>{t(STATUS[i.status])}</span>
          </div>
          <p><strong>{t({ ar: 'الموجود: ', en: 'Today: ' })}</strong>{t(i.have)}</p>
          <p className="muted"><strong>{t({ ar: 'الناقص: ', en: 'Missing: ' })}</strong>{t(i.missing)}</p>
          {i.route && <a className="btn btn-secondary btn-sm self-start" href={href(i.route)}>{t({ ar: 'افتحها', en: 'Open it' })}</a>}
        </article>)}
      </section>

      <section className="stack" aria-labelledby="blend-h">
        <h2 id="blend-h" className="subtitle">{t({ ar: 'التعليم المدمج: كيف بيشتغل مع الموارد المتوفرة', en: 'Blended learning with the resources available' })}</h2>
        <ul className="lp-list">{BLENDED.map((b) => <li key={b.who.en}><strong>{t(b.who)}: </strong>{t(b.how)}</li>)}</ul>
      </section>

      <section className="stack" aria-labelledby="road-h">
        <h2 id="road-h" className="subtitle">{t({ ar: 'خارطة الطريق (خمس مراحل)', en: 'Roadmap (five stages)' })}</h2>
        <ol className="stack !gap-2">{ROADMAP.map((r) => <li key={r.stage.en} className="card-flat"><strong>{t(r.stage)}</strong><br />{t(r.goal)}</li>)}</ol>
        <p className="help">{t({ ar: 'المرحلة الأولى هي اللي بنعرضها. الباقي اتجاه، مش شي اتنفّذ.', en: 'Only stage one is what we show. The rest is direction, not something done.' })}</p>
      </section>

      <section className="stack" aria-labelledby="weak-h">
        <h2 id="weak-h" className="subtitle">{t({ ar: 'نقاط الضعف بصدق', en: 'Weaknesses, honestly' })}</h2>
        <ul className="lp-list">
          <li>{t({
            ar: `دقة التشخيص بالقواعد الاحتياطية (بدون موديل) على الجمل المنفصلة: ${rate(h.endToEnd)}. كشف الجواب مبكراً: ${rate(h.answerLeakage)}. التصنيفات من شخص واحد، وبدها مراجعة مستقلة.`,
            en: `Diagnosis accuracy of the offline rules (no model) on held-out sentences: ${rate(h.endToEnd)}. Early answer disclosure: ${rate(h.answerLeakage)}. Labels come from one annotator and need independent review.`,
          })}</li>
          <li>{t({ ar: 'أثر التعلّم على أطفال حقيقيين ما انقاس وما بنادّعيه. هاد بدّه دراسة ميدانية (المرحلة الثانية).', en: 'Learning impact with real children has not been measured and is not claimed. It needs a field study (stage two).' })}</li>
          <li>{t({ ar: 'الخصوصية: أسماء مستعارة، ما بنخزّن الصوت، والجلسات على الجهاز. الصوت السحابي بيرسل صوت الطفل للنسخ بس إذا انفعّل، وبنكتب هيك. الصف الحي بالذاكرة وبينتهي بعد ست ساعات.', en: 'Privacy: aliases, no audio stored, sessions on the device. Cloud voice sends a child\'s audio for transcription only when enabled, and we say so. The live room is in memory and expires after six hours.' })}</li>
          <li>{t({ ar: 'المحتوى بدّه مراجعة معلّم علوم ورياضيات. ما بندّعي تغطية المنهاج: ست حزم بس.', en: 'Content needs review by a science and maths teacher. We do not claim curriculum coverage: six packs only.' })}</li>
          <li>{t({ ar: 'لسا ما اتأكّد كتابياً من المنظّمين إنه النموذج المبني قبل السبت مقبول.', en: 'The organisers\' written confirmation that a prototype built before Saturday is acceptable is still pending.' })}</li>
        </ul>
      </section>
    </div>
  </Shell>;
}
