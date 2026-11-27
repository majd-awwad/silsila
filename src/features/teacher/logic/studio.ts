/**
 * Adaptive Lesson Studio: how a draft is labelled, edited, saved on this device and exported. A draft is text
 * written for the teacher to review. Nothing in it is ever interpreted as code or markup.
 */
import type { Lang, LessonDraft, LessonInput } from '../../../contracts';
import { LessonDraft as DraftSchema, LessonInput as InputSchema } from '../../../contracts';
import { RESOURCES } from '../../../packs/resources';
import type { ResourceId } from '../../../packs/resources';
import { tr } from './labels';
import { isObject, readStored, shortId, writeStored } from './storage';

export type ListKey = 'objectives' | 'concepts' | 'prerequisites' | 'questions' | 'assessment' | 'transfer' | 'guidance';

/** The limits of the draft contract: the editor never lets a list grow past them. */
export const LIMITS = {
  objectives: 10, concepts: 10, prerequisites: 10, questions: 10, assessment: 10, transfer: 10, guidance: 10,
  misconceptions: 8, experiments: 5, activities: 8, steps: 10, materials: 10,
} as const;

export const LIST_TITLE: Record<ListKey, { ar: string; en: string }> = {
  objectives: { ar: 'الأهداف', en: 'Objectives' },
  concepts: { ar: 'المفاهيم', en: 'Concepts' },
  prerequisites: { ar: 'المتطلّبات السابقة', en: 'Prerequisites' },
  questions: { ar: 'أسئلة لكشف الأفكار', en: 'Questions that surface ideas' },
  assessment: { ar: 'التقييم', en: 'Assessment' },
  transfer: { ar: 'مواقف جديدة', en: 'Transfer situations' },
  guidance: { ar: 'إرشادات للمعلّم', en: 'Teacher guidance' },
};

export const updateAt = <T>(list: T[], index: number, value: T): T[] => list.map((x, i) => (i === index ? value : x));
export const removeAt = <T>(list: T[], index: number): T[] => list.filter((_, i) => i !== index);
export const append = <T>(list: T[], value: T, max: number): T[] => (list.length >= max ? list : [...list, value]);
export function moveItem<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const out = [...list];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

/** The pack that fully supports this topic, only if the app really has it. */
export const supportedPack = (draft: Pick<LessonDraft, 'matchedPack'>, packIds: string[]): string | null =>
  draft.matchedPack && packIds.includes(draft.matchedPack) ? draft.matchedPack : null;

/** Drafts built from a pack list material ids («cups»): show their names. Free text stays as written. */
export function localiseDraft(draft: LessonDraft, lang: Lang): LessonDraft {
  const name = (m: string) => (Object.prototype.hasOwnProperty.call(RESOURCES, m) ? RESOURCES[m as ResourceId][lang] : m);
  return { ...draft, experiments: draft.experiments.map((x) => ({ ...x, materials: x.materials.map(name) })) };
}

/** Empty lines are dropped before saving or exporting. */
export function cleanDraft(d: LessonDraft): LessonDraft {
  const lines = (l: string[]) => l.map((s) => s.trim()).filter(Boolean);
  return {
    ...d,
    title: d.title.trim(),
    objectives: lines(d.objectives), concepts: lines(d.concepts), prerequisites: lines(d.prerequisites),
    questions: lines(d.questions), assessment: lines(d.assessment), transfer: lines(d.transfer), guidance: lines(d.guidance),
    misconceptions: d.misconceptions.filter((m) => m.idea.trim() || m.probe.trim()),
    experiments: d.experiments.map((x) => ({ ...x, steps: lines(x.steps), materials: lines(x.materials) }))
      .filter((x) => x.title.trim() || x.steps.length),
    activities: d.activities.filter((a) => a.title.trim() || a.detail.trim()),
  };
}

export type InputProblem = 'title' | 'minutes';
export function inputProblems(input: LessonInput): InputProblem[] {
  const out: InputProblem[] = [];
  if (input.title.trim().length < 2) out.push('title');
  if (!Number.isInteger(input.minutes) || input.minutes < 5 || input.minutes > 120) out.push('minutes');
  return out;
}

/** The draft as plain text, for download. */
export function draftText(draft: LessonDraft, input: LessonInput, lang: Lang, reviewed: boolean): string {
  const d = cleanDraft(draft);
  const out: string[] = [];
  const section = (title: string, lines: string[]) => {
    if (lines.length) out.push('', `## ${title}`, ...lines.map((l) => `- ${l}`));
  };
  out.push(`# ${d.title || input.title}`);
  out.push(d.source === 'ai' ? tr(lang, 'مسودة من الذكاء الاصطناعي', 'AI draft') : tr(lang, 'مسودة من قالب', 'Template draft'));
  out.push(reviewed ? tr(lang, 'راجعها المعلّم', 'Reviewed by the teacher') : tr(lang, 'بحاجة لمراجعة المعلّم', 'Needs teacher review'));
  if (!d.matchedPack) out.push(tr(lang, 'ما في محاكاة تفاعلية لهالموضوع.', 'There is no interactive simulation for this topic.'));
  out.push(`${tr(lang, 'الصف', 'Grade')}: ${input.grade} · ${tr(lang, 'الدقائق', 'Minutes')}: ${input.minutes}${input.subject ? ` · ${input.subject}` : ''}`);
  section(LIST_TITLE.objectives[lang], d.objectives);
  section(LIST_TITLE.concepts[lang], d.concepts);
  section(LIST_TITLE.prerequisites[lang], d.prerequisites);
  section(tr(lang, 'أفكار متوقّعة وكيف نكشفها', 'Likely ideas and how to probe them'), d.misconceptions.map((m) => `${m.idea} | ${m.probe}`));
  section(LIST_TITLE.questions[lang], d.questions);
  for (const x of d.experiments) {
    out.push('', `## ${tr(lang, 'تجربة', 'Experiment')}: ${x.title}`);
    if (x.materials.length) out.push(`${tr(lang, 'المواد', 'Materials')}: ${x.materials.join(tr(lang, '، ', ', '))}`);
    out.push(...x.steps.map((s, i) => `${i + 1}. ${s}`));
    if (x.safety.trim()) out.push(`${tr(lang, 'السلامة', 'Safety')}: ${x.safety.trim()}`);
  }
  section(tr(lang, 'الأنشطة', 'Activities'), d.activities.map((a) => `${a.title} (${a.minutes} ${tr(lang, 'دقيقة', 'min')}): ${a.detail}`));
  section(LIST_TITLE.assessment[lang], d.assessment);
  section(LIST_TITLE.transfer[lang], d.transfer);
  section(LIST_TITLE.guidance[lang], d.guidance);
  return `${out.join('\n')}\n`;
}

/* ───────── saved drafts on this device ───────── */

export interface SavedDraft { id: string; savedAt: number; input: LessonInput; draft: LessonDraft; reviewed: boolean }

const KEY = 'silsila-lesson-drafts';
const KEEP = 30;

export function parseDrafts(raw: unknown): SavedDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x: unknown) => {
    if (!isObject(x) || typeof x.id !== 'string' || typeof x.savedAt !== 'number') return [];
    const input = InputSchema.safeParse(x.input);
    const draft = DraftSchema.safeParse(x.draft);
    return input.success && draft.success ? [{ id: x.id, savedAt: x.savedAt, input: input.data, draft: draft.data, reviewed: x.reviewed === true }] : [];
  });
}

export const loadDrafts = (): SavedDraft[] => parseDrafts(readStored(KEY)).sort((a, b) => b.savedAt - a.savedAt);

/** false when the draft could not be stored (it breaks the contract, or the browser refused). */
export function saveDraft(item: SavedDraft): boolean {
  if (!InputSchema.safeParse(item.input).success || !DraftSchema.safeParse(item.draft).success) return false;
  return writeStored(KEY, [item, ...loadDrafts().filter((d) => d.id !== item.id)].slice(0, KEEP));
}

export const deleteDraft = (id: string): boolean => writeStored(KEY, loadDrafts().filter((d) => d.id !== id));

export const newDraftId = shortId;
