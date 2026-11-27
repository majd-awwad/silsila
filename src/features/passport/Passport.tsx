import { useEffect, useState } from 'react';
import type { LearnerRecord } from '../../contracts';
import { useI18n } from '../../i18n';
import { PREREQUISITE_CHAINS } from '../../packs/links';
import { href } from '../../router';
import { loadRecords } from '../../store/records';
import { StatusCell } from '../../ui/Evidence';
import { EmptyState, Loading, Notice, Shell } from '../../ui/kit';
import { passportOf, reviewPath } from './derive';

export function Passport() {
  const { t, n, lang } = useI18n();
  const [records, setRecords] = useState<LearnerRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadRecords().then((r) => alive && setRecords(r)).catch(() => alive && (setRecords([]), setFailed(true)));
    return () => { alive = false; };
  }, []);
  const pass = records ? passportOf(records) : [];
  const review = records ? reviewPath(records) : [];
  const done = new Set(pass.map((p) => p.pack.id));
  return <Shell>
    <div className="stack">
      <header className="stack !gap-1">
        <h1 className="title">{t({ ar: 'جواز تعلّمي', en: 'My learning passport' })}</h1>
        <p className="muted">{t({ ar: 'محفوظ على هالجهاز بس، وبيتغيّر مع الأدلة، ومش علامة. بيجمع اللي ظهر بكل درس عملته هون.', en: 'Kept on this device only, it changes with the evidence, and it is not a mark. It gathers what each lesson you did here showed.' })}</p>
      </header>
      {failed && <Notice tone="error">{t({ ar: 'ما قدرنا نقرأ الدروس المحفوظة (ممكن التخزين مقفول).', en: 'Saved lessons could not be read (storage may be blocked).' })}</Notice>}
      {!records ? <Loading /> : !pass.length ? (
        <EmptyState action={<a className="btn btn-primary" href={href('/learn')}>{t({ ar: 'ابدأ درس مع نور', en: 'Start a lesson with Noor' })}</a>}>
          <strong className="block">{t({ ar: 'لسا ما في دروس محفوظة على هالجهاز', en: 'No lessons are saved on this device yet' })}</strong>
          {t({ ar: 'أول ما تخلّص شرح بدرس، بتظهر هون حالة كل مفهوم. ما في أرقام جاهزة ولا بيانات افتراضية.', en: 'As soon as you explain in a lesson, the state of each concept appears here. There are no ready-made numbers or example data.' })}
        </EmptyState>
      ) : <>
        {pass.map((p) => <section key={p.pack.id} className="card stack" aria-label={t(p.pack.title)}>
          <div className="row">
            <h2 className="subtitle flex-1">{t(p.pack.title)}</h2>
            <span className="chip">{t({ ar: `محاولات: ${n(p.attempts)}`, en: `Attempts: ${p.attempts}` })}</span>
            <span className="chip">{new Date(p.lastAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
          </div>
          <div className="dna" role="table" aria-label={t(p.pack.title)}>
            {p.concepts.map((c) => <div className="dna-row" role="row" key={c.id} style={{ gridTemplateColumns: '1fr auto' }}>
              <span role="rowheader" className="font-semibold text-[14px] self-center">{t(c.label)}</span>
              <span role="cell" className="flex"><StatusCell status={c.status} /></span>
            </div>)}
          </div>
          <a className="btn btn-secondary btn-sm self-start" href={href(`/learn/${p.pack.id}`)}>{t({ ar: 'افتح الدرس', en: 'Open the lesson' })}</a>
        </section>)}
        <section className="card stack" aria-labelledby="path-h">
          <h2 id="path-h" className="subtitle">{t({ ar: 'مسار المراجعة الجاي', en: 'Next review path' })}</h2>
          {review.length ? <ul className="stack !gap-2">{review.map((r, i) => <li key={i} className="card-flat stack !gap-1">
            <strong>{t(r.pack.title)}: {t(r.reason)}</strong>
            {r.part && <span>{r.fromPack
              ? t({ ar: `جزء قصير من درس «${r.fromPack.title.ar}»: ${r.part.ar}`, en: `A short part of “${r.fromPack.title.en}”: ${r.part.en}` })
              : t(r.part)}</span>}
            <a className="btn btn-ghost btn-sm self-start" href={href(`/learn/${(r.fromPack ?? r.pack).id}`)}>{t({ ar: 'ابدأ المراجعة', en: 'Start the review' })}</a>
          </li>)}</ul> : <p className="muted">{t({ ar: 'ما في إشي لازم يتراجع حسب اللي ظهر لهلأ.', en: 'Nothing needs review from what has shown up so far.' })}</p>}
          <p className="help">{t({ ar: 'ترتيب الأفكار بالدروس:', en: 'How the lessons build on each other:' })}</p>
          {PREREQUISITE_CHAINS.map((c) => <p key={c.subject} className="row !gap-2">{c.steps.map((s, i) => <span key={i} className={`chip ${s.pack && done.has(s.pack) ? 'chip-real' : ''}`}>{s.pack && done.has(s.pack) ? '✓ ' : ''}{t(s.label)}</span>)}</p>)}
        </section>
        <p className="help">{t({ ar: 'نقل الجواز بين مدارس أو حسابات مش موجود هلأ: رؤية مستقبلية بس. الصوت ما بنخزّنه، والأسماء مستعارة.', en: 'Moving a passport between schools or accounts does not exist yet: it is a future vision only. Audio is never stored and names are aliases.' })}</p>
      </>}
    </div>
  </Shell>;
}
