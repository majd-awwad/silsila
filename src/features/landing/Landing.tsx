import type { L } from '../../contracts';
import { useI18n } from '../../i18n';
import { PACK_LIST } from '../../packs';
import { href } from '../../router';
import { Icon } from '../../ui/icons';
import type { IconName } from '../../ui/icons';
import { Brand, LangToggle } from '../../ui/kit';
import { Noor } from '../../ui/Noor';
import { ThoughtLab } from './ThoughtLab';
import './landing.css';

const ENTRIES: { to: string; icon: IconName; title: L; note: L; primary?: boolean }[] = [
  { to: '/learn', icon: 'flask', primary: true, title: { ar: 'اكتشف كطالب', en: 'Student discovery' }, note: { ar: 'احكي فكرتك وجرّبها', en: 'Say your idea and test it' } },
  { to: '/teacher', icon: 'cap', title: { ar: 'مساحة المعلّم', en: 'Teacher workspace' }, note: { ar: 'خريطة تفكير الصف وخطة التدخّل', en: 'Class reasoning map and next steps' } },
  { to: '/join', icon: 'qr', title: { ar: 'انضم لصف حي', en: 'Join a live class' }, note: { ar: 'بكود أو بمسح QR', en: 'With a code or a QR scan' } },
  { to: '/judge', icon: 'eye', title: { ar: 'تجربة الحكّام', en: 'Judge experience' }, note: { ar: 'العرض خطوة بخطوة مع الأدلّة', en: 'Guided demonstration with evidence' } },
];

const FLOW: { title: L; note: L }[] = [
  { title: { ar: 'يحكي', en: 'Explain' }, note: { ar: 'بكلامه ولهجته، صوت أو كتابة', en: 'Own words and dialect, voice or text' } },
  { title: { ar: 'تظهر الفكرة', en: 'Reveal the model' }, note: { ar: 'سلسلة تفكيره مع دليل من كلامه', en: 'A reasoning chain with evidence from the words' } },
  { title: { ar: 'يتوقّع', en: 'Predict' }, note: { ar: 'قبل ما يشوف أي نتيجة', en: 'Before any result is shown' } },
  { title: { ar: 'يجرّب', en: 'Test' }, note: { ar: 'تجربة يختارها خوارزم قابل للتفسير', en: 'An experiment chosen by an explainable algorithm' } },
  { title: { ar: 'يعيد البناء', en: 'Rebuild' }, note: { ar: 'يناقش، يعدّل، ويعلّم نور', en: 'Discuss, revise and teach Noor' } },
  { title: { ar: 'ينقل الفهم', en: 'Transfer' }, note: { ar: 'موقف جديد، والمعلّم بيشوف الدليل', en: 'A new situation, with evidence for the teacher' } },
];

const LEARNER: L[] = [
  { ar: 'بيشوف فكرته هو، مش علامة صح وغلط.', en: 'Sees their own idea, not a right-or-wrong mark.' },
  { ar: 'بيكتشف الحلقة اللي بدها تغيير بتجربة بنفسه.', en: 'Finds the link to change through their own experiment.' },
  { ar: 'بيعلّم نور، ونور بتحكي بس اللي هو علّمها إياه.', en: 'Teaches Noor, who can only use what they taught her.' },
  { ar: 'عالق؟ مساعدة متدرّجة بدون إحراج، ومسجّلة بصدق.', en: 'Stuck? Gentle graded help, honestly recorded.' },
];
const TEACHER: L[] = [
  { ar: 'خريطة حيّة لفرضيات الصف بدون أسماء على الشاشة.', en: 'A live map of the class’s hypotheses, with no names on screen.' },
  { ar: 'تجربة مقترحة لهالصف بالذات، مع السبب والبدائل.', en: 'An experiment chosen for this class, with reasons and alternatives.' },
  { ar: 'فجوات أساسية ما بتتأكّد إلا بسؤال تحقّق.', en: 'Foundation gaps confirmed only by a verification question.' },
  { ar: 'مجموعات تدخّل ونشاط من أدلّة الصف، قابلة للتعديل.', en: 'Editable intervention groups and activities from class evidence.' },
];

export function Landing() {
  const { t } = useI18n();
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Brand />
          <div className="ms-auto flex items-center gap-2">
            <a className="btn btn-ghost btn-sm hide-sm" href={href('/teacher/library')}>{t({ ar: 'مكتبة المفاهيم', en: 'Concept library' })}</a>
            <LangToggle />
          </div>
        </div>
      </header>
      <main className="lp" id="main">
        <div className="lp-hero">
          <div className="stack !gap-5">
            <div className="row !flex-nowrap items-end">
              <Noor mood="curious" size={74} float />
              <p className="lp-motto">{t({ ar: 'صف واحد، عقول مختلفة، واكتشاف مشترك.', en: 'One class, different minds, a shared discovery.' })}</p>
            </div>
            <h1>{t({ ar: 'خلّي التفكير', en: 'Make Thinking' })} <span>{t({ ar: 'يبيّن', en: 'Visible' })}</span></h1>
            <p className="lead">
              {t({
                ar: 'سِلسِلة بتحوّل الطريقة اللي بيفكّر فيها كل متعلّم لفرضية بتنفحص، وتجربة بتتغيّر حسب الصف، وخطوة تعليمية واضحة للمعلّم. كل عقل بيفكّر بشكل مختلف، وكل عقل بيستاهل يفهم.',
                en: 'SILSILA turns the way each learner thinks into a testable hypothesis, an experiment chosen for this class, and a clear next move for the teacher. Every mind thinks differently. Every mind deserves to understand.',
              })}
            </p>
            <nav className="lp-entries" aria-label={t({ ar: 'ابدأ', en: 'Start' })}>
              {ENTRIES.map((e) => (
                <a key={e.to} className={`lp-entry ${e.primary ? 'is-primary' : ''}`} href={href(e.to)}>
                  <i><Icon name={e.icon} size={22} /></i>
                  <span><strong className="font-display">{t(e.title)}</strong><small>{t(e.note)}</small></span>
                </a>
              ))}
            </nav>
          </div>
          <ThoughtLab />
        </div>

        <section className="lp-section" aria-labelledby="flow-h">
          <h2 id="flow-h" className="title">{t({ ar: 'سلسلة وحدة من الفكرة للفهم', en: 'One chain from a thought to understanding' })}</h2>
          <ol className="lp-flow">
            {FLOW.map((f) => <li key={f.title.en}><strong>{t(f.title)}</strong><span className="muted">{t(f.note)}</span></li>)}
          </ol>
        </section>

        <section className="lp-section">
          <div className="lp-two">
            {([[{ ar: 'للمتعلّم', en: 'For the learner' }, LEARNER], [{ ar: 'للمعلّم', en: 'For the teacher' }, TEACHER]] as const).map(([title, list]) => (
              <div key={title.en} className="stack">
                <h2 className="subtitle">{t(title)}</h2>
                <ul className="lp-list">{list.map((x) => <li key={x.en}><Icon name="check" size={18} />{t(x)}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="packs-h">
          <h2 id="packs-h" className="title">{t({ ar: 'محرّك واحد، علوم ورياضيات', en: 'One engine, science and mathematics' })}</h2>
          <p className="muted">{t({ ar: 'كل درس «حزمة مفهوم»: أفكار محتملة، تجارب، قواعد حسابية ثابتة، وتقييم. المحرّك نفسه بيشغّلها كلها.', en: 'Each lesson is a concept pack: likely ideas, experiments, deterministic rules and assessment. The same engine runs them all.' })}</p>
          <div className="lp-packs">
            {PACK_LIST.map((p) => (
              <a key={p.id} className="lp-pack" href={href(`/learn/${p.id}`)}>
                <span className={`chip self-start ${p.subject === 'math' ? 'chip-idea' : 'chip-real'}`}>{t(p.subject === 'math' ? { ar: 'رياضيات', en: 'Mathematics' } : { ar: 'علوم', en: 'Science' })}</span>
                <strong className="font-display text-[17px]">{t(p.title)}</strong>
                <span className="muted text-[14px]">{t(p.question)}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="trust-h">
          <h2 id="trust-h" className="subtitle">{t({ ar: 'شو بيعمل الذكاء الاصطناعي، وشو لأ', en: 'What the AI does, and what it does not' })}</h2>
          <div className="lp-two">
            <p>{t({ ar: 'الموديل اللغوي بيفهم كلام الطفل ويطلّع منه أدلّة. نتائج التجارب، واختيار التجربة، وحالة الصف، وسطور نور محسوبة أو مكتوبة مسبقاً بكود ثابت. ولما ما يكون في موديل، بتشتغل قواعد احتياطية وبينكتب هيك على الشاشة.', en: 'The language model reads learners’ words and extracts evidence. Experiment results, experiment choice, classroom state and Noor’s lines are computed or authored in deterministic code. Without a model, offline rules answer and the screen says so.' })}</p>
            <p className="muted">{t({ ar: 'أسماء مستعارة بس، وما بنخزّن الصوت. منقيس دقة التشخيص على جمل مكتوبة؛ أثر التعلّم على أطفال حقيقيين ما انقاس بعد، وما بنادّعيه.', en: 'Aliases only, and no audio is stored. We measure diagnosis accuracy on written sentences; learning gains with real children have not been measured and are not claimed.' })}</p>
          </div>
          <p className="muted text-[13px]">{t({ ar: 'نموذج أولي لهاكاثون AI Educathon 2026، فريق من هندسة الحاسوب بجامعة النجاح الوطنية.', en: 'A prototype for AI Educathon 2026 by Computer Engineering students at An-Najah National University.' })}</p>
        </section>
      </main>
    </>
  );
}
