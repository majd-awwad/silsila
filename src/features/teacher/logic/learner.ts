/**
 * One learner as the teacher reads them: the table row, the recommended next step and the foundational gaps.
 * Everything is derived from the learner's event log.
 */
import type { Diagnosis, Lang, LearnerRecord } from '../../../contracts';
import { transferShown } from '../../../brain/classInsights';
import { ASSIST_LEVEL, gapsOf, learningDNA } from '../../../brain/evidence';
import type { GapStatus } from '../../../brain/evidence';
import { correctIdeaId } from '../../../brain/normalise';
import { DEFAULT_CONSTRAINTS, plan } from '../../../brain/planner';
import { eventsOf, groupKey, initialDiagnosis, latestDiagnosis, revisedDiagnosis } from '../../../brain/records';
import { formatNumber } from '../../../i18n';
import type { ConceptPack, Prerequisite, Question } from '../../../packs/types';
import { groupTitle, tr } from './labels';

export type TransferState = 'shown' | 'tried' | 'none';

export interface LearnerRow {
  id: string;
  alias: string;
  first: Diagnosis | null;
  firstIdea: string;
  /** the locked prediction for the given experiment, or the learner's latest one */
  prediction: string | null;
  revised: Diagnosis | null;
  revisedIdea: string;
  transfer: TransferState;
  /** highest scaffolding level received, 0 for none */
  help: number;
}

export const transferState = (r: LearnerRecord): TransferState =>
  !eventsOf(r, 'transfer').length ? 'none' : transferShown(r) ? 'shown' : 'tried';

export const helpLevel = (r: LearnerRecord): number => eventsOf(r, 'assist').reduce((m, e) => Math.max(m, e.level), 0);

export function learnerRow(pack: ConceptPack, r: LearnerRecord, experimentId: string | null, lang: Lang): LearnerRow {
  const first = initialDiagnosis(r);
  const revised = revisedDiagnosis(r);
  const predictions = eventsOf(r, 'predict');
  const p = (experimentId ? predictions.filter((e) => e.experimentId === experimentId) : predictions).at(-1);
  return {
    id: r.id,
    alias: r.alias,
    first,
    firstIdea: first ? groupTitle(pack, groupKey(pack, first))[lang] : '',
    prediction: p ? pack.outcomes[p.outcome]?.[lang] ?? p.outcome : null,
    revised,
    revisedIdea: revised ? groupTitle(pack, groupKey(pack, revised))[lang] : '',
    transfer: transferState(r),
    help: helpLevel(r),
  };
}

/* ───────────────────────── next step ───────────────────────── */

export type StepKind = 'invite' | 'remedy' | 'verify' | 'recover' | 'investigate' | 'clarify' | 'consolidate' | 'enrich';

export interface NextStep {
  kind: StepKind;
  title: string;
  detail: string;
  /** an experiment that can challenge this learner's idea */
  experimentId: string | null;
}

/** The one most useful move for this learner now. */
export function nextStep(pack: ConceptPack, r: LearnerRecord, lang: Lang): NextStep {
  const latest = latestDiagnosis(r);
  if (!latest) {
    return {
      kind: 'invite', experimentId: null,
      title: tr(lang, 'ادعوه يشرح', 'Invite an explanation'),
      detail: pack.question[lang],
    };
  }
  const gaps = gapsOf(pack, r);
  const prerequisite = (id: string): Prerequisite => pack.prerequisites.find((p) => p.id === id)!;
  const open = gaps.find((g) => g.status === 'confirmed' || g.status === 'persisting');
  if (open) {
    const p = prerequisite(open.id);
    return open.status === 'persisting'
      ? {
        kind: 'recover', experimentId: null,
        title: tr(lang, `اشتغلوا معه وجاهي على أساس «${p.label.ar}»`, `Work face to face on “${p.label.en}”`),
        detail: `${p.remedy.title[lang]} · ${p.why[lang]}`,
      }
      : {
        kind: 'remedy', experimentId: null,
        title: tr(lang, `مراجعة أساس «${p.label.ar}»`, `Recover the foundation “${p.label.en}”`),
        detail: `${p.remedy.title[lang]} (${formatNumber(lang, p.remedy.minutes)} ${tr(lang, 'دقيقة', 'min')})`,
      };
  }
  const suspected = gaps.find((g) => g.status === 'suspected');
  if (suspected) {
    const p = prerequisite(suspected.id);
    const asked = new Set(suspected.answers.map((a) => a.questionId));
    const q = p.verify.find((x) => !asked.has(x.id)) ?? p.verify[0];
    return {
      kind: 'verify', experimentId: null,
      title: tr(lang, `تحقّقوا من أساس «${p.label.ar}»`, `Check the foundation “${p.label.en}”`),
      detail: q.q[lang],
    };
  }
  const correct = correctIdeaId(pack);
  if (latest.status === 'misconception' || latest.status === 'multiple') {
    const ideaId = latest.ideas.map((i) => i.id).find((id) => id !== correct && pack.ideas[id]);
    if (ideaId) {
      const idea = pack.ideas[ideaId];
      const done = eventsOf(r, 'observe').flatMap((e) => (e.experimentId ? [e.experimentId] : []));
      const p = plan(pack, [{ key: ideaId, ideas: [ideaId], model: idea.model, learners: 1 }], { ...DEFAULT_CONSTRAINTS, grade: 12, exclude: done });
      return {
        kind: 'investigate', experimentId: p.recommended?.id ?? null,
        title: tr(lang, `اختبروا فكرة «${idea.label.ar}»`, `Investigate the idea “${idea.label.en}”`),
        detail: idea.intervention[lang],
      };
    }
  }
  if (latest.status === 'correct') {
    return helpLevel(r) >= ASSIST_LEVEL
      ? {
        kind: 'consolidate', experimentId: null,
        title: tr(lang, 'تأكّدوا إنه بيشرحها لحاله', 'Check it holds without help'),
        detail: pack.transfer.prompt[lang],
      }
      : {
        kind: 'enrich', experimentId: null,
        title: tr(lang, 'أعطوه تحدّي أبعد', 'Offer a further challenge'),
        detail: pack.challenge.phenomenon[lang],
      };
  }
  if (latest.status === 'partial') {
    const missing = latest.steps.findIndex((s) => !s.met);
    return {
      kind: 'consolidate', experimentId: null,
      title: tr(lang, 'اسألوا عن الحلقة الناقصة', 'Ask about the missing link'),
      detail: pack.steps[Math.max(0, missing)].noorAsks[lang],
    };
  }
  const asked = eventsOf(r, 'explain').filter((e) => e.diagnosis.status === 'insufficient').length;
  const clarify = pack.clarify.find((c) => c.id === latest.clarifyId) ?? pack.clarify[Math.min(pack.clarify.length - 1, Math.max(0, asked - 1))];
  return {
    kind: 'clarify', experimentId: null,
    title: tr(lang, 'وضّحوا قصده قبل أي تصحيح', 'Clarify the meaning before correcting'),
    detail: clarify.q[lang],
  };
}

/* ───────────────────────── learning gaps ───────────────────────── */

export interface GapRow {
  learnerId: string;
  alias: string;
  prerequisiteId: string;
  prerequisite: string;
  /** the lesson objectives this foundation supports */
  objectives: string[];
  status: Exclude<GapStatus, 'not_suspected'>;
  /** the learner's words that raised the suspicion */
  quotes: string[];
  answers: { question: string; correct: boolean; phase: 'verify' | 'recheck' }[];
  recovery: { title: string; minutes: number; steps: string[] };
  uncertainty: string;
}

const STATUS_ORDER: GapRow['status'][] = ['persisting', 'confirmed', 'suspected', 'recovered', 'rejected'];

export function uncertaintyOf(status: GapRow['status'], verified: number, needed: number, remedied: boolean, lang: Lang): string {
  const n = (v: number) => formatNumber(lang, v);
  switch (status) {
    case 'suspected':
      return tr(lang, `مجرّد اشتباه من كلامه: انجاب على ${n(verified)} من ${n(needed)} سؤال تحقّق. ممكن ما يكون في ثغرة أصلاً.`,
        `Only a suspicion from the learner’s words: ${n(verified)} of ${n(needed)} checks answered. There may be no gap at all.`);
    case 'confirmed':
      return remedied
        ? tr(lang, 'شاف المراجعة وما أعاد التحقّق بعدها، فما بنعرف إذا تعافى.', 'The recovery activity was seen but not rechecked, so recovery is unknown.')
        : tr(lang, 'سؤال تحقّق واحد غلط على الأقل. السبب الدقيق بدّه حديث معه.', 'At least one check failed. The exact cause needs a conversation.');
    case 'persisting':
      return tr(lang, 'إعادة التحقّق ما نجحت بعد المراجعة. جرّبوا تمثيل مختلف.', 'The recheck failed after the recovery activity. Try a different representation.');
    case 'recovered':
      return tr(lang, 'نجح بسؤال إعادة تحقّق واحد. الاحتفاظ على المدى البعيد ما انقاس.', 'One recheck question passed. Long-term retention was not measured.');
    case 'rejected':
      return tr(lang, 'نجح بأسئلة التحقّق، وهي قليلة وما بتغطّي كل المفهوم.', 'The checks passed; they are few and do not cover the whole concept.');
  }
}

const allQuestions = (p: Prerequisite): Question[] => [...p.verify, p.recheck];

export function gapRows(pack: ConceptPack, records: LearnerRecord[], lang: Lang): GapRow[] {
  const rows: GapRow[] = [];
  for (const r of records.filter((x) => x.pack === pack.id)) {
    for (const g of gapsOf(pack, r)) {
      if (g.status === 'not_suspected') continue;
      const p = pack.prerequisites.find((x) => x.id === g.id)!;
      rows.push({
        learnerId: r.id,
        alias: r.alias,
        prerequisiteId: p.id,
        prerequisite: p.label[lang],
        objectives: pack.objectives.filter((o) => o.nodes.some((node) => p.supports.includes(node))).map((o) => o.text[lang]),
        status: g.status,
        quotes: g.because,
        answers: g.answers.map((a) => ({ question: allQuestions(p).find((q) => q.id === a.questionId)?.q[lang] ?? a.questionId, correct: a.correct, phase: a.phase })),
        recovery: { title: p.remedy.title[lang], minutes: p.remedy.minutes, steps: p.remedy.steps.map((s) => s[lang]) },
        uncertainty: uncertaintyOf(g.status, g.answers.filter((a) => a.phase === 'verify').length, p.verify.length, eventsOf(r, 'remedy').some((e) => e.prereqId === p.id), lang),
      });
    }
  }
  return rows.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.prerequisite.localeCompare(b.prerequisite));
}

/** Concepts with evidence of understanding without help, for a one-line summary. Never a claim of mastery. */
export function demonstratedConcepts(pack: ConceptPack, r: LearnerRecord, lang: Lang): string[] {
  const dna = learningDNA(pack, r);
  return (Object.keys(dna) as (keyof typeof dna)[])
    .filter((id) => dna[id].status === 'demonstrated' || dna[id].status === 'transfer')
    .map((id) => pack.concepts[id].label[lang]);
}
