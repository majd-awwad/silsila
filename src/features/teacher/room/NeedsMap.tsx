/**
 * The class map re-read as learning needs: foundation to strengthen, a misconception to explain again, something to clarify,
 * understanding to consolidate, and learners ready for a challenge. Same evidence as the thinking map (intervention groups);
 * only the question changes from «what do they think» to «what do they need next». Teacher only: nothing here goes to the screen.
 */
import { useState } from 'react';
import { interventionGroups } from '../../../brain/classInsights';
import type { GroupKind, InterventionGroup } from '../../../brain/classInsights';
import { initialDiagnosis } from '../../../brain/records';
import type { L } from '../../../contracts';
import { useI18n } from '../../../i18n';
import { Icon } from '../../../ui/icons';
import type { IconName } from '../../../ui/icons';
import { learnersLabel } from '../logic/labels';
import type { RoomTabProps } from './types';

const NEEDS: { kind: GroupKind; title: L; icon: IconName }[] = [
  { kind: 'gap', title: { ar: 'تقوية أساس', en: 'Strengthen a foundation' }, icon: 'link' },
  { kind: 'idea', title: { ar: 'إعادة شرح تصوّر', en: 'Explain an idea again' }, icon: 'edit' },
  { kind: 'clarify', title: { ar: 'استيضاح', en: 'Clarify' }, icon: 'question' },
  { kind: 'followup', title: { ar: 'تثبيت الفهم', en: 'Consolidate' }, icon: 'check' },
  { kind: 'enrich', title: { ar: 'إثراء', en: 'Enrichment' }, icon: 'flask' },
];

export function NeedsMap({ pack, records, view }: Pick<RoomTabProps, 'pack' | 'records' | 'view'>) {
  const { t, n, lang } = useI18n();
  const groups = interventionGroups(pack, records);
  const [open, setOpen] = useState<string | null>(null);
  const alias = new Map(view.participants.map((p) => [p.id, p.alias]));
  const total = groups.reduce((s, g) => s + g.members.length, 0);
  const picked: InterventionGroup | null = groups.find((g) => g.id === open) ?? null;
  const quotes = picked
    ? picked.members.flatMap((id) => {
      const r = records.find((x) => x.id === id);
      const d = r && initialDiagnosis(r);
      return d ? [d.ideas[0]?.evidence || d.steps.find((s) => s.met)?.evidence || ''] : [];
    }).filter(Boolean).slice(0, 3)
    : [];
  const experiment = picked?.experimentId ? pack.experiments.find((x) => x.id === picked.experimentId) : null;
  return <div className="stack">
    <p className="help">{t({
      ar: 'نفس أدلة الخريطة، بس مرتّبة حسب شو بدّه كل طالب هلأ. اضغطوا على مجموعة لتشوفوا الأدلة والخطوة الجاية.',
      en: 'The same evidence as the map, ordered by what each learner needs next. Select a group for its evidence and next step.',
    })}</p>
    <div className="needs-map" role="list">
      {NEEDS.map((need) => {
        const list = groups.filter((g) => g.kind === need.kind);
        const count = list.reduce((s, g) => s + g.members.length, 0);
        return <section key={need.kind} role="listitem" className={`card stack !gap-2 needs-col ${count ? '' : 'is-empty'}`} aria-label={t(need.title)}>
          <header className="row"><Icon name={need.icon} size={18} /><strong className="flex-1">{t(need.title)}</strong><span className="chip chip-brand">{n(count)} / {n(total)}</span></header>
          {list.length ? list.map((g) => <button key={g.id} type="button" className="btn btn-secondary btn-sm needs-item" aria-pressed={open === g.id} onClick={() => setOpen(open === g.id ? null : g.id)}>
            <span>{t(g.title)}</span><span className="chip">{n(g.members.length)}</span>
          </button>) : <span className="muted text-[13px]">{t({ ar: 'ما حدا هون.', en: 'Nobody here.' })}</span>}
        </section>;
      })}
    </div>
    {picked && <section className="card stack" aria-live="polite">
      <h3 className="subtitle">{t(picked.title)} · {learnersLabel(lang, picked.members.length, n)}</h3>
      <p className="help">{picked.members.map((id) => alias.get(id) ?? '').join(' · ')}</p>
      {quotes.length > 0 && <div className="stack !gap-1">
        <strong>{t({ ar: 'الدليل من كلامهم', en: 'Evidence from their words' })}</strong>
        {quotes.map((q, i) => <blockquote key={i} className="tc-quote" dir="auto">«{q}»</blockquote>)}
      </div>}
      <div className="tc-prompt"><span className="label">{t({ ar: 'الخطوة الجاية', en: 'Next step' })}</span>{t(picked.move)}</div>
      {experiment && <p className="help">{t({ ar: 'تجربة مقترحة: ', en: 'Suggested experiment: ' })}{t(experiment.name)} · {t(experiment.question)}</p>}
    </section>}
  </div>;
}
