/**
 * The next lesson, built from the groups the class really formed: a time-boxed plan whose parts each point at a group and
 * at the evidence behind it, and one follow-up card per group (what to strengthen, the individual lesson link, a check
 * question for next time). Counts come from the room; the lines come from the pack's authored text. Minutes are only a
 * starting point the teacher edits.
 */
import type { GroupKind } from '../../../brain/classInsights';
import { initialDiagnosis } from '../../../brain/records';
import type { L, LearnerRecord } from '../../../contracts';
import type { ConceptPack, Question } from '../../../packs/types';
import type { GroupBoard, TeamGroup } from './groups';

export interface PlanPart {
  id: 'review' | 'groups' | 'apply' | 'recheck';
  minutes: number;
  title: L;
  /** what to do */
  lines: L[];
  /** the groups this part serves, by id */
  groupIds: string[];
  /** how many learners those groups hold */
  learners: number;
  /** one real quote from those learners' words (no name) */
  evidence: string | null;
}

export interface FollowUpCard {
  groupId: string;
  title: L;
  learners: number;
  /** the concept to strengthen */
  concept: L;
  /** the lesson a learner can open on their own device */
  lessonPack: string;
  /** a question to ask first thing next time */
  check: Question | null;
}

export const DEFAULT_MINUTES = { review: 5, groups: 15, apply: 10, recheck: 10 } as const;
const NEEDS_WORK: GroupKind[] = ['gap', 'idea', 'clarify', 'followup'];

const kindOf = (g: TeamGroup): GroupKind | 'custom' => g.kind;

function quoteFor(records: LearnerRecord[], ids: string[]): string | null {
  for (const id of ids) {
    const r = records.find((x) => x.id === id);
    const d = r && initialDiagnosis(r);
    const q = d?.ideas[0]?.evidence || d?.steps.find((s) => s.met)?.evidence;
    if (q) return q;
  }
  return null;
}

const ideaOf = (g: TeamGroup): string | null => (g.id.startsWith('idea:') ? g.id.slice(5) : null);
const gapOf = (g: TeamGroup): string | null => (g.id.startsWith('gap:') ? g.id.slice(4) : null);

export function conceptOf(pack: ConceptPack, g: TeamGroup): L {
  const idea = ideaOf(g);
  if (idea && pack.ideas[idea]?.breaks) return pack.concepts[pack.ideas[idea].breaks!].label;
  const gap = gapOf(g);
  const pre = gap && pack.prerequisites.find((p) => p.id === gap);
  if (pre) return pre.label;
  if (g.kind === 'enrich') return { ar: 'تطبيق الفهم على موقف جديد', en: 'Applying the idea to a new situation' };
  return pack.question;
}

export function checkFor(pack: ConceptPack, g: TeamGroup): Question | null {
  const gap = gapOf(g);
  const pre = gap && pack.prerequisites.find((p) => p.id === gap);
  if (pre) return pre.recheck;
  const idea = ideaOf(g);
  const node = idea ? pack.ideas[idea]?.breaks : null;
  return (node && pack.postTest.find((q) => q.node === node)) || pack.transfer.check;
}

export function remedialPlan(pack: ConceptPack, board: GroupBoard, records: LearnerRecord[], minutes: Record<PlanPart['id'], number> = DEFAULT_MINUTES): PlanPart[] {
  const sized = board.groups.filter((g) => g.members.length);
  const work = sized.filter((g) => NEEDS_WORK.includes(kindOf(g) as GroupKind));
  const top = [...work].sort((a, b) => b.members.length - a.members.length)[0] ?? null;
  const count = (list: TeamGroup[]) => list.reduce((s, g) => s + g.members.length, 0);
  const experiment = (top?.experimentId && pack.experiments.find((x) => x.id === top.experimentId)) || work.map((g) => g.experimentId && pack.experiments.find((x) => x.id === g.experimentId)).find(Boolean) || null;
  return [
    {
      id: 'review', minutes: minutes.review, title: { ar: 'مراجعة مشتركة', en: 'Shared review' },
      lines: top
        ? [{ ar: `ابدأوا من: ${conceptOf(pack, top).ar}. اسألوا الصف: ${pack.question.ar}`, en: `Start from: ${conceptOf(pack, top).en}. Ask the class: ${pack.question.en}` }, top.move]
        : [{ ar: `أعيدوا سؤال الدرس: ${pack.question.ar}`, en: `Ask the lesson question again: ${pack.question.en}` }],
      groupIds: top ? [top.id] : [], learners: top ? top.members.length : 0, evidence: top ? quoteFor(records, top.members) : null,
    },
    {
      id: 'groups', minutes: minutes.groups, title: { ar: 'أنشطة حسب المجموعات', en: 'Activities by group' },
      lines: sized.map((g) => ({ ar: `${g.title.ar} (${g.members.length.toLocaleString('ar-EG')}): ${g.move.ar}`, en: `${g.title.en} (${g.members.length}): ${g.move.en}` })),
      groupIds: sized.map((g) => g.id), learners: count(sized), evidence: sized[0] ? quoteFor(records, sized[0].members) : null,
    },
    {
      id: 'apply', minutes: minutes.apply, title: { ar: 'تجربة وتطبيق', en: 'Experiment and application' },
      lines: [
        ...(experiment ? [{ ar: `جرّبوا: ${experiment.name.ar}. السؤال قبل النتيجة: ${experiment.question.ar}`, en: `Try: ${experiment.name.en}. Question before the result: ${experiment.question.en}` }] : []),
        { ar: `موقف جديد: ${pack.transfer.prompt.ar}`, en: `New situation: ${pack.transfer.prompt.en}` },
      ],
      groupIds: work.map((g) => g.id), learners: count(work), evidence: top ? quoteFor(records, top.members) : null,
    },
    {
      id: 'recheck', minutes: minutes.recheck, title: { ar: 'إعادة تقييم', en: 'Re-assessment' },
      lines: [{ ar: `اطلبوا من كل طالب يشرح بكلامه من جديد، وبعدين اسألوه: ${pack.transfer.check.q.ar}`, en: `Ask each learner to explain in their own words again, then ask: ${pack.transfer.check.q.en}` }],
      groupIds: sized.map((g) => g.id), learners: count(sized), evidence: null,
    },
  ];
}

export function followUpCards(pack: ConceptPack, board: GroupBoard): FollowUpCard[] {
  return board.groups.filter((g) => g.members.length && kindOf(g) !== 'enrich').map((g) => ({
    groupId: g.id, title: g.title, learners: g.members.length, concept: conceptOf(pack, g), lessonPack: pack.id, check: checkFor(pack, g),
  }));
}

/** Plain text for copying or pasting into a chat or a document. */
export function planAsText(pack: ConceptPack, plan: PlanPart[], lang: 'ar' | 'en'): string {
  const total = plan.reduce((s, p) => s + p.minutes, 0);
  return [
    `${pack.title[lang]} — ${lang === 'ar' ? `خطة الحصة الجاية (${total} دقيقة)` : `Next lesson plan (${total} minutes)`}`,
    ...plan.map((p) => `${p.minutes}′ ${p.title[lang]}\n${p.lines.map((l) => `- ${l[lang]}`).join('\n')}`),
  ].join('\n\n');
}
