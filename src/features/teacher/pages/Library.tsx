/**
 * The concept library: everything a pack holds, laid out for lesson preparation. Results shown here are computed
 * by the pack's own outcome functions, the same ones the class will use.
 */
import type { CSSProperties } from 'react';
import { CHAIN_IDS } from '../../../contracts';
import { compare, conditionsFor } from '../../../brain/world';
import { useI18n } from '../../../i18n';
import { PACKS, PACK_LIST } from '../../../packs';
import { RESOURCES } from '../../../packs/resources';
import type { ConceptPack, Question } from '../../../packs/types';
import { href } from '../../../router';
import { ReasonChain } from '../../../ui/Evidence';
import { Notice } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { PageHead, SectionTitle, TeacherShell } from '../components/ui';
import { conceptLayout } from '../logic/graph';
import { SUBJECT_LABEL } from '../logic/labels';

function ConceptGraph({ pack }: { pack: ConceptPack }) {
  const { t } = useI18n();
  const g = conceptLayout(pack.concepts);
  const at = new Map(g.nodes.map((node) => [node.id, node]));
  // viewBox units: 100 per column, 136 per row; a node's centre is at (col + .5, row at 68)
  const path = (from: { col: number; row: number }, to: { col: number; row: number }) => {
    const x1 = from.col * 100 + 46, y1 = from.row * 136 + 68;
    const x2 = to.col * 100 + 46, y2 = to.row * 136 + 68;
    // a link that would pass behind another node bends through the gap under it
    const bend = from.row === to.row && Math.abs(to.col - from.col) > 1 ? 92 : 0;
    const mid = (x1 + x2) / 2;
    return `M${x1} ${y1}C${mid} ${y1 + bend} ${mid} ${y2 + bend} ${x2} ${y2}`;
  };
  return (
    <div className="scroll-x">
      <div className="tc-graph" style={{ '--cols': g.cols, '--rows': g.rows } as CSSProperties}>
        <svg viewBox={`0 0 ${g.cols * 100} ${g.rows * 136}`} preserveAspectRatio="none" aria-hidden="true">
          {g.edges.map((e) => <path key={`${e.from}-${e.to}`} d={path(at.get(e.from)!, at.get(e.to)!)} />)}
        </svg>
        <ol className="tc-plain">
          {g.nodes.map((node) => {
            const needs = pack.concepts[node.id].needs;
            return (
              <li key={node.id} className="tc-gnode" style={{ '--col': node.col, '--row': node.row } as CSSProperties}>
                <span className="tc-gid">{node.id}</span>
                <strong>{t(pack.concepts[node.id].label)}</strong>
                <small>{needs.length ? `${t({ ar: 'مبني على', en: 'Builds on' })}: ${needs.join(' + ')}` : t({ ar: 'أساس', en: 'Foundation' })}</small>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function CheckQuestion({ question, title }: { question: Question; title: string }) {
  const { t } = useI18n();
  return (
    <div className="stack !gap-1 text-[14px]">
      <span><b>{title}:</b> {t(question.q)}</span>
      <ul className="tc-plain row !gap-1.5">
        {question.options.map((o, i) => (
          <li key={i} className={`chip !whitespace-normal ${i === question.correct ? 'chip-real' : ''}`}>
            {i === question.correct && <><Icon name="check" size={13} /><span className="sr-only">{t({ ar: 'الإجابة الصحيحة:', en: 'Correct answer:' })}</span></>}
            {t(o)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PackDetail({ pack }: { pack: ConceptPack }) {
  const { t, n } = useI18n();
  const wrong = Object.entries(pack.ideas).filter(([, i]) => !i.correct);
  const list = (items: string[]) => items.join(t({ ar: '، ', en: ', ' }));
  return (
    <div className="stack !gap-8">
      <section className="stage p-5 stack !gap-3">
        <div className="row">
          <span className="chip chip-brand">{t(SUBJECT_LABEL[pack.subject])}</span>
          <span className="chip">{t({ ar: 'الصفوف', en: 'Grades' })} {n(pack.grades[0])}–{n(pack.grades[1])}</span>
          <span className={`chip ${pack.curriculum.verified ? 'chip-real' : 'chip-idea'}`}>
            <Icon name={pack.curriculum.verified ? 'shield' : 'question'} size={14} />
            {pack.curriculum.verified ? t({ ar: 'المنهاج متحقَّق منه', en: 'Curriculum verified' }) : t({ ar: 'المنهاج مش متحقَّق منه', en: 'Curriculum not verified' })}
          </span>
        </div>
        <h2 className="title">{t(pack.title)}</h2>
        <p className="text-[19px] font-semibold">{t(pack.question)}</p>
        <p className="muted text-[14px]">{t(pack.curriculum.note)}</p>
        <div className="row">
          <a className="btn btn-warm" href={href(`/teacher/new?pack=${pack.id}`)}><Icon name="plus" />{t({ ar: 'افتحوا حصة من هالدرس', en: 'Create a session' })}</a>
        </div>
      </section>

      <section className="stack">
        <SectionTitle>{t({ ar: 'أهداف التعلّم', en: 'Learning objectives' })}</SectionTitle>
        <ul className="tc-bullets">
          {pack.objectives.map((o) => <li key={o.id}>{t(o.text)} <span className="muted text-[12.5px]" dir="ltr">({o.nodes.join(', ')})</span></li>)}
        </ul>
      </section>

      <section className="stack">
        <SectionTitle hint={t({ ar: 'كل مفهوم بيجي بعد اللي بينبني عليه. الخطوط بتوصل الأساس بالمفهوم اللي بيحتاجه.', en: 'Each concept follows what it builds on; links join a foundation to the concept that needs it.' })}>
          {t({ ar: 'خريطة المفاهيم', en: 'Concept graph' })}
        </SectionTitle>
        <ConceptGraph pack={pack} />
      </section>

      <section className="stack">
        <SectionTitle hint={t({ ar: 'الثغرة بتنشتبه من كلام المتعلّم، وما بتتأكّد إلا بسؤال تحقّق.', en: 'A gap is only suspected from a learner’s words; a check question must confirm it.' })}>
          {t({ ar: 'المتطلّبات السابقة', en: 'Prerequisites' })}
        </SectionTitle>
        {pack.prerequisites.map((p) => (
          <details key={p.id} className="tc-alt">
            <summary>{t(p.label)} <span className="chip" dir="ltr">{p.supports.join(', ')}</span></summary>
            <div className="tc-alt-body">
              <p>{t(p.why)}</p>
              <CheckQuestion question={p.verify[0]} title={t({ ar: 'تحقّق ١', en: 'Check 1' })} />
              <CheckQuestion question={p.verify[1]} title={t({ ar: 'تحقّق ٢', en: 'Check 2' })} />
              <div className="tc-prompt">
                <span className="label">{t({ ar: 'نشاط التعافي', en: 'Recovery activity' })}: {t(p.remedy.title)} ({n(p.remedy.minutes)} {t({ ar: 'دقيقة', en: 'min' })})</span>
                <ol className="tc-bullets text-[14px]">{p.remedy.steps.map((s, i) => <li key={i}>{t(s)}</li>)}</ol>
              </div>
              <CheckQuestion question={p.recheck} title={t({ ar: 'إعادة التحقّق', en: 'Recheck' })} />
            </div>
          </details>
        ))}
        {!pack.prerequisites.length && <p className="muted">{t({ ar: 'ما في متطلّبات مسجّلة.', en: 'No prerequisites listed.' })}</p>}
      </section>

      <section className="stack">
        <SectionTitle hint={t({ ar: 'أفكار معقولة من وجهة نظر المتعلّم. كل وحدة معها تدخّل وتجارب بتختبرها.', en: 'Reasonable ideas from a learner’s point of view, each with a teacher move and tests.' })}>
          {t({ ar: 'أفكار متوقّعة وتدخّلاتها', en: 'Likely ideas and interventions' })}
        </SectionTitle>
        <div className="tc-grid">
          {wrong.map(([id, idea]) => {
            const challenging = pack.experiments.filter((x) => compare(pack, idea.model, conditionsFor(pack, x.change)).contradicted);
            return (
              <article key={id} className="card-flat stack !gap-2">
                <div className="row">
                  <h3 className="tc-h3 flex-1">{t(idea.label)}</h3>
                  {idea.breaks && <span className="chip chip-probe" title={t(pack.concepts[idea.breaks].label)} dir="ltr">{idea.breaks}</span>}
                </div>
                <p className="text-[14px] muted">{t(idea.assumption)}</p>
                <ReasonChain steps={idea.story.map((s) => t(s))} wrongStep={idea.wrongStep} />
                <div className="tc-prompt text-[14px]"><span className="label">{t({ ar: 'تدخّل مقترح', en: 'Teacher move' })}</span>{t(idea.intervention)}</div>
                <p className="help">
                  {challenging.length
                    ? `${t({ ar: 'تجارب بتتحدّاها', en: 'Challenged by' })}: ${list(challenging.map((x) => t(x.short)))}`
                    : t({ ar: 'ما في تجربة بالحزمة بتتحدّاها.', en: 'No experiment in this pack challenges it.' })}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <SectionTitle>{t({ ar: 'التجارب', en: 'Experiments' })}</SectionTitle>
        <div className="scroll-x">
          <table className="table tc-table is-stack">
            <thead>
              <tr>
                <th scope="col">{t({ ar: 'التجربة', en: 'Experiment' })}</th>
                <th scope="col">{t({ ar: 'نتيجة النموذج', en: 'Reference result' })}</th>
                <th scope="col">{t({ ar: 'المواد', en: 'Materials' })}</th>
                <th scope="col">{t({ ar: 'الوقت', en: 'Time' })}</th>
                <th scope="col">{t({ ar: 'السلامة', en: 'Safety' })}</th>
                <th scope="col">{t({ ar: 'من صف', en: 'From grade' })}</th>
              </tr>
            </thead>
            <tbody>
              {pack.experiments.map((x) => (
                <tr key={x.id}>
                  <td data-label={t({ ar: 'التجربة', en: 'Experiment' })}><span><strong className="block">{t(x.name)}</strong><span className="muted text-[13px]">{t(x.question)}</span> <span className="muted text-[12px]" dir="ltr">{x.targets.join(', ')}</span></span></td>
                  <td data-label={t({ ar: 'نتيجة النموذج', en: 'Reference result' })}><span>{t(pack.outcomes[pack.realOutcome(conditionsFor(pack, x.change))] ?? { ar: '—', en: '—' })}</span></td>
                  <td data-label={t({ ar: 'المواد', en: 'Materials' })}><span>{list(x.materials.map((m) => t(RESOURCES[m]))) || t({ ar: 'بدون', en: 'None' })}</span></td>
                  <td data-label={t({ ar: 'الوقت', en: 'Time' })}><span>{n(x.minutes)} {t({ ar: 'د', en: 'min' })}</span></td>
                  <td data-label={t({ ar: 'السلامة', en: 'Safety' })}>
                    <span>{x.safety.adult && <span className="chip chip-probe !whitespace-normal"><Icon name="shield" size={13} />{t({ ar: 'بإشراف بالغ', en: 'Adult needed' })}</span>} <span className="text-[13px]">{t(x.safety.note)}</span></span>
                  </td>
                  <td data-label={t({ ar: 'من صف', en: 'From grade' })}><span>{n(x.minGrade)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack !gap-3">
        <SectionTitle>{t({ ar: 'النموذج المرجعي وحدوده', en: 'Reference model and its limits' })}</SectionTitle>
        <p>{t(pack.reference.model)}</p>
        <ul className="tc-plain stack !gap-1">
          {CHAIN_IDS.map((id) => <li key={id} className="text-[14px]"><span className="chip me-2" dir="ltr">{id}</span>{t(pack.concepts[id].label)}</li>)}
        </ul>
        <Notice tone="warn"><b>{t({ ar: 'الحدود', en: 'Limits' })}:</b> {t(pack.reference.limits)}</Notice>
        <div>
          <h3 className="tc-h3">{t({ ar: 'المصادر', en: 'Sources' })}</h3>
          <ul className="tc-bullets text-[14px]">
            {pack.reference.sources.map((s, i) => (
              <li key={i} dir="auto">
                {s.url && /^https?:\/\//.test(s.url) ? <a className="link" href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a> : s.title}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export function Library({ packId }: { packId?: string }) {
  const { t, n } = useI18n();
  const pack = (packId && PACKS[packId]) || PACK_LIST[0];
  return (
    <TeacherShell active="library">
      <PageHead
        title={t({ ar: 'مكتبة المفاهيم', en: 'Concept library' })}
        lead={t({ ar: 'كل درس مدعوم بتفاعل كامل: أفكار، تجارب محسوبة بكود ثابت، ونموذج مرجعي بحدوده.', en: 'Each fully supported lesson: ideas, experiments computed by fixed code, and a reference model with its limits.' })}
      />
      {packId && !PACKS[packId] && <Notice tone="warn">{t({ ar: 'ما لقينا هالدرس، فعرضنا أول درس.', en: 'That lesson was not found; the first one is shown.' })}</Notice>}
      <div className="tc-split is-rail">
        <nav className="tc-packlist tc-sticky" aria-label={t({ ar: 'الدروس', en: 'Lessons' })}>
          {PACK_LIST.map((p) => (
            <a key={p.id} href={href(`/teacher/library/${p.id}`)} aria-current={p.id === pack.id ? 'page' : undefined}>
              <strong>{t(p.title)}</strong>
              <span className="muted text-[12.5px]">{t(SUBJECT_LABEL[p.subject])} · {t({ ar: 'الصفوف', en: 'Grades' })} {n(p.grades[0])}–{n(p.grades[1])}</span>
            </a>
          ))}
        </nav>
        <PackDetail key={pack.id} pack={pack} />
      </div>
    </TeacherShell>
  );
}
