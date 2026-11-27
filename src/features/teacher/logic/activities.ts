/**
 * Activity plans: the request sent to the generator carries counts only (no aliases, no learner words), and the
 * edited plan is saved on this device.
 */
import type { ActivityPlan, ActivityRequest, Lang, LearnerRecord, RoomSettings } from '../../../contracts';
import { ActivityPlan as PlanSchema } from '../../../contracts';
import { evidenceForActivity } from '../../../brain/classInsights';
import type { ConceptPack } from '../../../packs/types';
import { tr } from './labels';
import { isObject, readStored, writeStored } from './storage';

export interface ActivityForm {
  type: ActivityRequest['type'];
  minutes: number;
  classSize: number;
  resources: string[];
  accessibility: string;
}

export const defaultForm = (settings: Pick<RoomSettings, 'resources'>, participants: number): ActivityForm => ({
  type: 'experiment', minutes: 15, classSize: Math.min(60, Math.max(1, participants || 20)), resources: [...settings.resources], accessibility: '',
});

const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));

export function activityRequest(pack: ConceptPack, records: LearnerRecord[], grade: number, lang: Lang, form: ActivityForm): ActivityRequest {
  const evidence = evidenceForActivity(pack, records);
  return {
    pack: pack.id,
    lang,
    type: form.type,
    minutes: clampInt(form.minutes, 5, 90),
    grade: clampInt(grade, 1, 12),
    classSize: clampInt(form.classSize, 1, 60),
    resources: form.resources.slice(0, 40),
    accessibility: form.accessibility.slice(0, 300),
    evidence,
  };
}

export const stepMinutes = (plan: Pick<ActivityPlan, 'steps'>): number => plan.steps.reduce((s, x) => s + (Number.isFinite(x.minutes) ? x.minutes : 0), 0);

export function activityText(plan: ActivityPlan, lang: Lang): string {
  const line = (title: string, value: string) => (value.trim() ? `${title}: ${value}` : '');
  return [
    `# ${plan.title}`,
    plan.source === 'ai' ? tr(lang, 'مقترح من الذكاء الاصطناعي، راجعوه قبل التنفيذ', 'AI suggestion: review before use') : tr(lang, 'من قوالب الحزمة، راجعوه قبل التنفيذ', 'From pack templates: review before use'),
    line(tr(lang, 'ليش هالنشاط', 'Why this activity'), plan.why),
    line(tr(lang, 'المشكلة المستهدفة', 'Learning problem'), plan.target),
    line(tr(lang, 'الهدف', 'Objective'), plan.objective),
    line(tr(lang, 'توزيع الطلاب', 'Grouping'), plan.grouping),
    line(tr(lang, 'المواد', 'Materials'), plan.materials.join(tr(lang, '، ', ', '))),
    `${tr(lang, 'المدّة بالدقايق', 'Duration in minutes')}: ${plan.minutes}`,
    '',
    ...plan.steps.map((s, i) => `${i + 1}. ${s.title} (${s.minutes}) ${s.detail}`),
    '',
    line(tr(lang, 'دور المعلّم', 'Teacher responsibilities'), plan.teacher),
    line(tr(lang, 'التحقّق', 'Check for understanding'), plan.check),
    line(tr(lang, 'تكييفات', 'Adaptations'), plan.adapt),
  ].filter((l, i, all) => l !== '' || all[i - 1] !== '').join('\n');
}

/* ───────── saved plans ───────── */

export interface SavedActivity { id: string; savedAt: number; code: string; pack: string; plan: ActivityPlan }

const KEY = 'silsila-activities';
const KEEP = 30;

export function parseActivities(raw: unknown): SavedActivity[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x: unknown) => {
    if (!isObject(x) || typeof x.id !== 'string' || typeof x.savedAt !== 'number' || typeof x.code !== 'string' || typeof x.pack !== 'string') return [];
    const plan = PlanSchema.safeParse(x.plan);
    return plan.success ? [{ id: x.id, savedAt: x.savedAt, code: x.code, pack: x.pack, plan: plan.data }] : [];
  });
}

export const loadActivities = (): SavedActivity[] => parseActivities(readStored(KEY)).sort((a, b) => b.savedAt - a.savedAt);

export function saveActivity(item: SavedActivity): boolean {
  if (!PlanSchema.safeParse(item.plan).success) return false;
  return writeStored(KEY, [item, ...loadActivities().filter((a) => a.id !== item.id)].slice(0, KEEP));
}

export const deleteActivity = (id: string): boolean => writeStored(KEY, loadActivities().filter((a) => a.id !== id));
