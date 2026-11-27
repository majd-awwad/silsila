import type { L } from '../../contracts';
import { useI18n } from '../../i18n';
import { DEFAULT_CONSTRAINTS, plan } from '../../brain/planner';
import { hypothesesOf } from '../../brain/records';
import { sampleRoom, SAMPLE_CODE } from '../../brain/sample';
import { useMemo } from 'react';
import { PhenomenonPreview } from '../../ui/PhenomenonPreview';
import { PACK_LIST, getPack } from '../../packs';
import { href } from '../../router';
import { Icon } from '../../ui/icons';
import type { IconName } from '../../ui/icons';
import { Brand, LangToggle } from '../../ui/kit';
import { Noor } from '../../ui/Noor';
import { ThoughtLab } from './ThoughtLab';
import './landing.css';

const ENTRIES: { to: string; icon: IconName; title: L; note: L; primary?: boolean }[] = [
  { to: '/learn', icon: 'flask', primary: true, title: { ar: 'ابدأ كطالب', en: 'Start as a learner' }, note: { ar: 'احكي فكرتك وجرّبها مع نور', en: 'Say your idea and test it with Noor' } },
  { to: '/teacher', icon: 'cap', title: { ar: 'مساحة المعلّم', en: 'Teacher workspace' }, note: { ar: 'تحقّق سريع أو حصة اكتشاف', en: 'Quick check or discovery lesson' } },
  { to: '/join', icon: 'qr', title: { ar: 'انضم لصف حي', en: 'Join a live class' }, note: { ar: 'بكود أو بمسح QR', en: 'With a code or a QR scan' } },
  { to: '/judge', icon: 'eye', title: { ar: 'تجربة الحكّام', en: 'Judge experience' }, note: { ar: 'العرض خطوة بخطوة مع الأدلّة', en: 'Guided demonstration with evidence' } },
];

const PILLARS: { icon: IconName; title: L; note: L }[] = [
  { icon: 'eye', title: { ar: 'Understand · نفهم', en: 'Understand' }, note: { ar: 'نفهم كيف بيفكّر الطالب، من كلامه هو، بدليل من نصّه.', en: 'We understand how the learner thinks, from their own words, with evidence from the text.' } },
  { icon: 'link', title: { ar: 'Recover · نستدرك', en: 'Recover' }, note: { ar: 'لما نلاقي حلقة أساس ناقصة، بنقوّيها بجزء قصير وبنرجع لنفس مكانك بالدرس.', en: 'When a foundation link is missing, a short part strengthens it and brings the learner back to the same place.' } },
  { icon: 'flask', title: { ar: 'Grow · ننمّي', en: 'Grow' }, note: { ar: 'تعلّم مستقل ومستمر: يجرّب، يعلّم نور، ويطبّق على موقف جديد.', en: 'Independent, continuing learning: test, teach Noor and apply to a new situation.' } },
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
              <p className="lp-motto">{t({ ar: 'حتى لو انقطع الدوام، تظل سلسلة التعلّم مستمرة.', en: 'Reconnecting the Missing Links in Education' })}</p>
            </div>
            <h1>{t({ ar: 'خلّي التفكير', en: 'Make Thinking' })} <span>{t({ ar: 'يبيّن', en: 'Visible' })}</span></h1>
            <p className="lead">
              {t({
                ar: 'للطالب: استدراك التعلّم مع نور. للمعلّم: قرار مبني على الفهم، مش على الحدس.',
                en: 'For the learner: recovering learning with Noor. For the teacher: a decision based on understanding, not a guess.',
              })}
            </p>
            <nav className="lp-entries" aria-label={t({ ar: 'ابدأ', en: 'Start' })}>
              {ENTRIES.map((e) => (
                <a key={e.to} className={`lp-entry ${e.primary ? 'is-primary' : ''}`} href={href(e.to)}>
                  <i><Icon name={e.icon} size={22} /></i>
                  <span><strong className="font-display">{t(e.title)}</strong>{e.primary && <small>{t(e.note)}</small>}</span>
                </a>
              ))}
            </nav>
          </div>
          <ThoughtLab />
        </div>

        <section className="lp-section" aria-labelledby="pillars-h">
          <h2 id="pillars-h" className="title">{t({ ar: 'ثلاث ركائز', en: 'Three pillars' })}</h2>
          <div className="lp-two" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(15rem,1fr))' }}>
            {PILLARS.map((p) => <article key={p.title.en} className="card stack !gap-2">
              <span className="chip chip-brand self-start"><Icon name={p.icon} size={14} />{t(p.title)}</span>
              <p>{t(p.note)}</p>
            </article>)}
          </div>
          <p><a className="btn btn-secondary btn-sm" href={href('/passport')}>{t({ ar: 'جواز تعلّمي (على هالجهاز)', en: 'My learning passport (this device)' })}</a></p>
          <p className="muted text-[14px]">{t({ ar: 'علوم ورياضيات، صفوف ٣–٦ حسب الدرس. ست حزم مفاهيم، وما بنادّعي تغطية المنهاج.', en: 'Science and mathematics, grades 3–6 depending on the lesson. Six concept packs; we do not claim curriculum coverage.' })}</p>
        </section>

        <section className="lp-section" aria-labelledby="why-h">
          <h2 id="why-h" className="title">{t({ ar: 'ليش سلسلة في فلسطين؟', en: 'Why Silsila in Palestine?' })}</h2>
          <p>{t({ ar: 'لما يتقلّص الدوام أو ينقطع، ممكن ما يلحق بعض الطلاب يتعلّموا المفاهيم الأساسية. ولما يرجع الطالب للمدرسة، ممكن المعلّم يبدأ درس جديد على أساس إنه الأساسيات مفهومة، ومستوى الفهم بين الطلاب مختلف.', en: 'When school time is cut or interrupted, some learners may not get enough chance to learn the basic concepts. When they return, a teacher may start a new lesson that assumes those basics, while understanding differs between learners.' })}</p>
          <ul className="lp-list">
            <li><Icon name="check" size={18} />{t({
              ar: 'البنك الدولي، Economic Update on the West Bank and Gaza، أيار 2026، ص ١٩: انخفاض أيام التعليم الوجاهي في المدارس الحكومية بالضفة الغربية من أربعة إلى ثلاثة أيام بالأسبوع. هذا ما بيعني إنه كل المدارس بتتبع نفس الجدول اليوم.',
              en: 'World Bank, Economic Update on the West Bank and Gaza, May 2026, p. 19: in-person days in public schools in the West Bank fell from four to three a week. This does not mean every school follows the same schedule today.',
            })}</li>
            <li><Icon name="check" size={18} />{t({ ar: 'اليونيسف، التقرير السنوي لفلسطين ٢٠٢٥ (نُشر ٢٠٢٦).', en: 'UNICEF, State of Palestine annual report 2025 (published 2026).' })}</li>
          </ul>
          <p className="muted text-[13px]">{t({ ar: 'هاي مصادر للحاجة العامة، وما هي دليل على فعالية تطبيقنا. وما بنادّعي تعويض ساعات الدراسة ولا استبدال المعلّم.', en: 'These sources describe the general need. They are not evidence that our app works, and we do not claim to replace lost study hours or the teacher.' })}</p>
        </section>

        <Collective />
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
                <PhenomenonPreview pack={p} compact />
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

function Collective() {
  const { t, n, lang } = useI18n();
  const pack = getPack('condensation');
  const { groups, test } = useMemo(() => {
    const sample = sampleRoom(pack, lang, 100);
    const groups = hypothesesOf(pack, sample.participants.map((person) => person.record));
    const recommended = plan(pack, groups, DEFAULT_CONSTRAINTS).recommended;
    return { groups, test: pack.experiments.find((item) => item.id === recommended?.id) };
  }, [pack, lang]);
  return <section className="lp-section collective" aria-labelledby="collective-title">
    <header className="row !justify-between">
      <h2 className="title" id="collective-title">{t({ ar: 'اكتشاف الصف مع بعض', en: 'Collective discovery' })}</h2>
      <span className="chip chip-idea">{t({ ar: 'صف تجريبي', en: 'Example classroom' })}</span>
    </header>
    <div className="collective-flow">
      <article className="card stack">
        <h3 className="subtitle">{t({ ar: 'أفكار المتعلّمين', en: 'Learners’ ideas' })}</h3>
        <ul className="stack !gap-2">{groups.filter((g) => g.ideas.length).slice(0, 4).map((g) => <li key={g.key} className="row">
          <span className="chip chip-idea">{n(g.learners)}</span><span>{g.ideas.map((id) => t(pack.ideas[id].label)).join(' · ')}</span>
        </li>)}</ul>
      </article>
      <article className="card stack">
        <h3 className="subtitle">{t({ ar: 'تجربة الصف المشتركة', en: 'One shared classroom test' })}</h3>
        {test && <strong>{t(test.name)}</strong>}
        <p>{t({ ar: 'الصف بثبّت التوقّعات وبقارنها بعد التجربة.', en: 'The class locks in predictions and compares them after the test.' })}</p>
      </article>
      <article className="card stack">
        <h3 className="subtitle">{t({ ar: 'خطوة المعلّم الجاية', en: 'The teacher’s next move' })}</h3>
        <p>{t({ ar: 'يشوف كيف تغيّرت الأفكار ويحضّر نشاط مبني على دليل.', en: 'See how ideas changed and plan an activity from the evidence.' })}</p>
        <a className="btn btn-secondary self-start" href={href('/teacher/room/' + SAMPLE_CODE)}>{t({ ar: 'افتح الصف التجريبي', en: 'Open the sample classroom' })}</a>
      </article>
    </div>
  </section>;
}
