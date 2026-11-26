/** Turns many children's results into what a teacher can act on. Shared by the teacher screen and api/activity. */
import type { ActivityPlan, ChainId, ClassEntry, Session } from '../contracts';
import type { ConceptPack } from '../packs/types';

export function entryFromSession(s: Session): ClassEntry {
  const first = s.explanations.find((e) => e.diagnosis.model && e.diagnosis.status === 'model') ?? s.explanations.find((e) => e.diagnosis.model);
  const understood = s.explanations.some((e) => e.diagnosis.status === 'correct');
  return {
    id: s.id,
    pseudonym: s.pseudonym,
    pack: s.pack,
    at: s.finishedAt ?? s.startedAt,
    firstSources: first?.diagnosis.model?.sources ?? [],
    firstCaption: first?.diagnosis.caption.replace('هيك إنت شايفها: ', '') ?? '',
    brokenLink: first?.diagnosis.broken_link ?? null,
    bestExperiment: first?.diagnosis.best_experiment ?? null,
    understood,
    taught: !!s.teach?.caught,
    transferScore: s.transfer ? s.transfer.score : null,
    needsHelp: s.scaffolded,
  };
}

export interface ClassSummary {
  total: number;
  understood: number;
  needFollowUp: number;
  /** children Noor had to help after they were stuck (STUCK_AFTER tries) */
  helped: number;
  ideas: { source: string; label: string; count: number; correct: boolean }[];
  topWrong: string | null;
  topLink: { link: ChainId; count: number } | null;
  topExperiment: { id: string; count: number } | null;
}

export function summarise(pack: ConceptPack, entries: ClassEntry[]): ClassSummary {
  const mine = entries.filter((e) => e.pack === pack.id);
  const correct = pack.correctModel.sources[0];
  const ideas = new Map<string, number>();
  const links = new Map<ChainId, number>();
  const exps = new Map<string, number>();
  for (const e of mine) {
    const src = e.firstSources[0] ?? (e.understood ? correct : null);
    if (src) ideas.set(src, (ideas.get(src) ?? 0) + 1);
    if (e.brokenLink) links.set(e.brokenLink, (links.get(e.brokenLink) ?? 0) + 1);
    if (e.bestExperiment) exps.set(e.bestExperiment, (exps.get(e.bestExperiment) ?? 0) + 1);
  }
  const ideaList = [...ideas.entries()]
    .map(([source, count]) => ({ source, label: pack.sources[source]?.label ?? source, count, correct: source === correct }))
    .sort((a, b) => b.count - a.count);
  const topWrong = ideaList.find((i) => !i.correct)?.source ?? null;
  const link = [...links.entries()].sort((a, b) => b[1] - a[1])[0];
  const exp = [...exps.entries()].sort((a, b) => b[1] - a[1])[0];
  const understood = mine.filter((e) => e.understood).length;
  return {
    total: mine.length, understood, needFollowUp: mine.length - understood, helped: mine.filter((e) => e.needsHelp).length, ideas: ideaList, topWrong,
    topLink: link ? { link: link[0], count: link[1] } : null,
    topExperiment: exp ? { id: exp[0], count: exp[1] } : null,
  };
}

export interface InterventionGroup {
  kind: 'idea' | 'help';
  /** the wrong idea (source id) this group shares; null for the "needs Noor's help" group */
  source: string | null;
  label: string;
  members: string[];
  brokenLink: ChainId | null;
  /** the experiment that breaks this group's idea, as the pack names it */
  experiment: { id: string; name: string } | null;
  /** children who already explain it correctly and can pair with this group */
  helpers: string[];
  move: string;
}

/**
 * Small groups a teacher can pull aside right now: children who share the same wrong idea go to the same
 * experiment (the one that breaks it); children Noor had to help get a retell-it-to-a-friend pairing.
 * Deterministic: same entries in, same groups out. Names are pseudonyms.
 */
export function interventionGroups(pack: ConceptPack, entries: ClassEntry[]): InterventionGroup[] {
  const mine = entries.filter((e) => e.pack === pack.id);
  const correct = pack.correctModel.sources[0];
  const helpers = mine.filter((e) => e.understood && !e.needsHelp).map((e) => e.pseudonym);
  const bySource = new Map<string, ClassEntry[]>();
  for (const e of mine) {
    if (e.understood) continue;
    const src = e.firstSources[0];
    if (!src || src === correct) continue;
    bySource.set(src, [...(bySource.get(src) ?? []), e]);
  }
  const groups: InterventionGroup[] = [...bySource.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([src, list]) => {
      const exps = new Map<string, number>();
      const links = new Map<ChainId, number>();
      for (const e of list) {
        if (e.bestExperiment) exps.set(e.bestExperiment, (exps.get(e.bestExperiment) ?? 0) + 1);
        if (e.brokenLink) links.set(e.brokenLink, (links.get(e.brokenLink) ?? 0) + 1);
      }
      const expId = [...exps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const preset = expId ? pack.presets.find((p) => p.id === expId) : null;
      const link = [...links.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const label = pack.sources[src]?.label ?? src;
      return {
        kind: 'idea' as const, source: src, label, members: list.map((e) => e.pseudonym), brokenLink: link,
        experiment: preset ? { id: preset.id, name: preset.name } : null,
        helpers: helpers.slice(0, 2),
        move: preset
          ? `خلّيهم يتوقّعوا ويجرّبوا «${preset.name}» وبعدين يحكوا شو تغيّر عن فكرتهم.`
          : 'خلّيهم يغيّروا متغيّر واحد بالمرّة ويقارنوا فكرتهم بالنتيجة.',
      };
    });
  const needHelp = mine.filter((e) => e.needsHelp);
  if (needHelp.length) {
    groups.push({
      kind: 'help', source: null, label: 'احتاجوا مساعدة نور', members: needHelp.map((e) => e.pseudonym), brokenLink: null,
      experiment: null, helpers: helpers.slice(0, 2),
      move: 'اجلس معهم دقيقتين: كل واحد يعيد شرح نور بكلامه لصاحبه، وبعدين يجرّبوا كاسة حقيقية.',
    });
  }
  return groups;
}

export function fallbackActivity(pack: ConceptPack, topWrong: string | null): Omit<ActivityPlan, 'source'> {
  return (topWrong && pack.activities[topWrong]) || pack.activities._default;
}

/** A compact text the activity AI gets (no names, counts only). */
export function summaryForAI(pack: ConceptPack, s: ClassSummary): string {
  return [
    `Students: ${s.total}, already explain it correctly: ${s.understood}.`,
    `Their first ideas (count): ${s.ideas.map((i) => `${i.source} = "${pack.sources[i.source]?.ai ?? i.source}" ×${i.count}`).join('; ') || 'none yet'}.`,
    `Most common wrong idea: ${s.topWrong ?? 'none'}. Most common broken link: ${s.topLink ? `${s.topLink.link} (${pack.chain[s.topLink.link].ai})` : 'none'}.`,
  ].join('\n');
}
