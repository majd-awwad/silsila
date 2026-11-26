/**
 * Thinking Replay: the child's whole journey as ordered steps, built only from what the session already recorded
 * (no model call, no new data). The same steps feed the child's summary and the teacher's per-child view.
 */
import type { Session } from '../contracts';
import type { ConceptPack } from '../packs/types';

export type ReplayKind = 'idea' | 'test' | 'revise' | 'noor' | 'challenge' | 'transfer';
export interface ReplayStep {
  kind: ReplayKind;
  title: string;
  /** one short line in the child's own words or the pack's words */
  body: string;
  /** for a test: what their idea predicted vs what really happens */
  predicted?: string;
  real?: string;
  broke?: boolean;
}

const clean = (c: string) => c.replace('هيك إنت شايفها: ', '').trim();

export function replaySteps(pack: ConceptPack, s: Session): ReplayStep[] {
  const steps: ReplayStep[] = [];
  const ideas = s.explanations.filter((e) => e.diagnosis.caption);
  if (ideas[0]) steps.push({ kind: 'idea', title: 'فكرتك الأولى', body: clean(ideas[0].diagnosis.caption) });

  for (const r of s.experiments) {
    const name = pack.presets.find((p) => p.id === r.preset)?.name ?? 'تجربتك';
    steps.push({
      kind: 'test', title: name, body: r.contradicted ? 'النتيجة ما طلعت متل ما توقّعت فكرتك.' : 'فكرتك طلعت صح هون.',
      predicted: pack.outcomes[r.predicted] ?? r.predicted, real: pack.outcomes[r.real] ?? r.real, broke: r.contradicted,
    });
  }

  const last = ideas[ideas.length - 1];
  if (last && ideas.length > 1 && clean(last.diagnosis.caption) !== clean(ideas[0].diagnosis.caption)) {
    steps.push({ kind: 'revise', title: 'غيّرت فكرتك', body: clean(last.diagnosis.caption) });
  }
  if (s.scaffolded) steps.push({ kind: 'noor', title: 'نور ساعدتك', body: 'شرحتلك نور بلطف، وإنت أعدتها بكلامك.' });
  if (s.teach?.caught) steps.push({ kind: 'noor', title: 'علّمت نور', body: `«${s.teach.quote}»` });
  if (s.challenge) steps.push({ kind: 'challenge', title: 'تحدّي نور', body: s.challenge.resolved ? 'نور فسّرت ظاهرة جديدة من شرحك بس.' : 'نور وقفت عند خطوة، وكمّلتلها الناقص.' });
  if (s.transfer) steps.push({ kind: 'transfer', title: 'فسّرت ظاهرة جديدة', body: s.transfer.text });
  return steps;
}
