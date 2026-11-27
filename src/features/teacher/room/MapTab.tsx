/** The Collective Mind Map, with the evidence behind each idea one tap away. */
import { useState } from 'react';
import type { HypothesisGroup } from '../../../contracts';
import { atLeast, groupsOf } from '../../../brain/room';
import { correctIdeaId } from '../../../brain/normalise';
import { initialDiagnosis, revisedDiagnosis, groupKey } from '../../../brain/records';
import { compare, conditionsFor } from '../../../brain/world';
import { useI18n } from '../../../i18n';
import { ReasonChain } from '../../../ui/Evidence';
import { EmptyState, Notice, Segmented } from '../../../ui/kit';
import { MindMap } from '../viz/MindMap';
import { Shape } from '../viz/Shape';
import { SectionTitle } from '../components/ui';
import { SHAPE_WORD, groupShape, groupTitle } from '../logic/labels';
import type { RoomTabProps } from './types';

function GroupDetail({ group, which, pack, records }: RoomTabProps & { group: HypothesisGroup; which: 'initial' | 'revised' }) {
  const { t, n, lang } = useI18n();
  const shape = groupShape(group.key);
  const correct = correctIdeaId(pack);
  const ideas = group.ideas.filter((id) => id !== correct && pack.ideas[id]);
  // the scientific step most learners of this group have not expressed yet
  const members = records.filter((r) => {
    const d = which === 'initial' ? initialDiagnosis(r) : revisedDiagnosis(r);
    return groupKey(pack, d) === group.key;
  });
  const missing = pack.steps.map((_, i) => members.filter((r) => {
    const d = which === 'initial' ? initialDiagnosis(r) : revisedDiagnosis(r);
    return d && !d.steps[i]?.met;
  }).length);
  const weakest = missing.indexOf(Math.max(...missing));

  return (
    <section className="card stack tc-shape-scope" aria-live="polite">
      <div className="row" data-shape={shape}>
        <span className="text-[color:var(--c-ink)]"><Shape shape={shape} size={22} /></span>
        <h3 className="subtitle flex-1">{t(groupTitle(pack, group.key))}</h3>
        <span className="chip">{t(SHAPE_WORD[shape])}</span>
        <span className="chip chip-brand">{t({ ar: 'العدد', en: 'Learners' })}: {n(group.count)}</span>
      </div>
      <div className="tc-split is-even">
        <div className="stack !gap-2">
          <h4 className="tc-h3">{t({ ar: 'بكلامهم (بدون أسماء)', en: 'In their words (no names)' })}</h4>
          {group.quotes.length
            ? group.quotes.map((q, i) => <blockquote key={i} className="tc-quote" dir="auto">«{q}»</blockquote>)
            : <p className="muted text-[14px]">{shape === 'waiting' ? t({ ar: 'ما وصل إشي لسا.', en: 'Nothing has arrived yet.' }) : t({ ar: 'ما في اقتباس واضح لهالمجموعة. افتحوا تقرير المتعلّم لتقرأوا كلامه كامل.', en: 'No clear quote for this group. Open a learner’s report to read the full text.' })}</p>}
        </div>
        <div className="stack !gap-3">
          {ideas.map((id) => {
            const idea = pack.ideas[id];
            const tests = pack.experiments.filter((x) => compare(pack, idea.model, conditionsFor(pack, x.change)).contradicted);
            return (
              <div key={id} className="stack !gap-2">
                <p className="muted text-[14px]">{t(idea.assumption)}</p>
                <ReasonChain steps={idea.story.map((s) => s[lang])} wrongStep={idea.wrongStep} />
                <div className="tc-prompt text-[14.5px]"><span className="label">{t({ ar: 'تدخّل مقترح', en: 'Teacher move' })}</span>{t(idea.intervention)}</div>
                <p className="help">
                  {tests.length
                    ? `${t({ ar: 'تجارب بتتحدّاها', en: 'Experiments that challenge it' })}: ${tests.map((x) => t(x.short)).join(t({ ar: '، ', en: ', ' }))}`
                    : t({ ar: 'ما في تجربة بالحزمة بتتحدّاها.', en: 'No experiment in this pack challenges it.' })}
                </p>
              </div>
            );
          })}
          {shape === 'partial' && missing[weakest] > 0 && (
            <div className="tc-prompt"><span className="label">{t({ ar: 'سؤال للحلقة الأكتر نقصاً', en: 'Question for the most missing link' })}</span>{t(pack.steps[weakest].noorAsks)}</div>
          )}
          {(shape === 'unclear' || shape === 'contra') && pack.clarify.slice(0, 2).map((c, i) => (
            <div key={c.id} className="tc-prompt"><span className="label">{t({ ar: `سؤال توضيحي ${n(i + 1)}`, en: `Clarifying question ${i + 1}` })}</span>{t(c.q)}</div>
          ))}
          {shape === 'real' && <div className="tc-prompt"><span className="label">{t({ ar: 'تحدّي أبعد', en: 'Further challenge' })}</span>{t(pack.challenge.phenomenon)}</div>}
          {shape === 'waiting' && <div className="tc-prompt"><span className="label">{t({ ar: 'سؤال الدرس', en: 'Lesson question' })}</span>{t(pack.question)}</div>}
        </div>
      </div>
    </section>
  );
}

export function MapTab(props: RoomTabProps) {
  const { pack, records, view } = props;
  const { t } = useI18n();
  const [which, setWhich] = useState<'initial' | 'revised'>('initial');
  const [selected, setSelected] = useState<string | null>(null);
  const anyRevised = records.some((r) => revisedDiagnosis(r));
  const shown = anyRevised ? which : 'initial';
  const groups = records.length ? groupsOf(pack, records, shown, true) : [];
  const group = groups.find((g) => g.key === selected) ?? null;
  const onScreen = atLeast(view.meta.phase, 'map');

  return (
    <div className="stack">
      <SectionTitle
        hint={t({ ar: 'حجم العقدة = عدد المتعلّمين. اضغطوا على فكرة لتشوفوا الأدلّة والخطوة المقترحة.', en: 'Node size = number of learners. Select an idea to see evidence and a suggested move.' })}
        actions={anyRevised ? (
          <Segmented label={t({ ar: 'أي شرح', en: 'Which explanation' })} value={shown} onChange={(v) => { setWhich(v); setSelected(null); }}
            options={[{ id: 'initial', label: t({ ar: 'أول شرح', en: 'First' }) }, { id: 'revised', label: t({ ar: 'الشرح الجديد', en: 'Revised' }) }]} />
        ) : undefined}
      >
        {t({ ar: 'خريطة تفكير الصف', en: 'Collective Mind Map' })}
      </SectionTitle>
      {!onScreen && records.length > 0 && <Notice tone="warn">{t({ ar: 'معاينة إلكم: الخريطة لسا مش على شاشة العرض.', en: 'Preview for you: the map is not on the projector yet.' })}</Notice>}
      {groups.length ? (
        <>
          <div className="card"><MindMap key={shown} pack={pack} groups={groups} selected={group?.key ?? null} onSelect={(k) => setSelected(k === selected ? null : k)} /></div>
          {group && <GroupDetail {...props} group={group} which={shown} />}
        </>
      ) : (
        <EmptyState>
          <strong className="block">{t({ ar: 'بانتظار المتعلّمين', en: 'Waiting for learners' })}</strong>
          {t({ ar: 'أول ما حدا ينضم ويشرح، بتظهر فكرته هون.', en: 'As soon as someone joins and explains, their idea appears here.' })}
        </EmptyState>
      )}
    </div>
  );
}
