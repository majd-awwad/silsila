/**
 * Teacher Intelligence: turns many learners' event logs into what a teacher can act on. Deterministic, shared by
 * the teacher screens and the server. Groups are temporary suggestions from this lesson's evidence, editable by
 * the teacher, never ability labels.
 */
import type { ActivityPlan, ActivityRequest, L, Lang, LearnerRecord } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { RESOURCES } from '../packs/resources';
import type { ResourceId } from '../packs/resources';
import { ASSIST_LEVEL, gapsOf } from './evidence';
import { correctIdeaId } from './normalise';
import { eventsOf, groupKey, hypothesesOf, initialDiagnosis, latestDiagnosis, revisedDiagnosis } from './records';
import { DEFAULT_CONSTRAINTS, plan } from './planner';

export interface ClassSummary {
  total: number;
  explained: number;
  /** by latest explanation */
  correct: number;
  partial: number;
  unclear: number;
  /** wrong ideas present in the learners' initial explanations */
  ideas: { id: string; count: number; persisting: number }[];
  /** foundational gaps: suspected (not yet verified) and confirmed by a verification question */
  gaps: { id: string; suspected: number; confirmed: number; recovered: number }[];
  assisted: number;
  revised: number;
  /** initial explanation not scientific, revised one is */
  movedToCorrect: number;
  transferTried: number;
  /** all three steps expressed in the new situation, or the check question answered correctly */
  transferShown: number;
}

export const transferShown = (r: LearnerRecord): boolean =>
  eventsOf(r, 'transfer').some((e) => e.steps.every((s) => s.met) || e.choiceCorrect === true);

export function summarise(pack: ConceptPack, records: LearnerRecord[]): ClassSummary {
  const mine = records.filter((r) => r.pack === pack.id);
  const correctId = correctIdeaId(pack);
  const ideas = new Map<string, { count: number; persisting: number }>();
  const s: ClassSummary = { total: mine.length, explained: 0, correct: 0, partial: 0, unclear: 0, ideas: [], gaps: [], assisted: 0, revised: 0, movedToCorrect: 0, transferTried: 0, transferShown: 0 };
  for (const r of mine) {
    const first = initialDiagnosis(r);
    const last = latestDiagnosis(r);
    if (first) s.explained++;
    if (last?.status === 'correct') s.correct++;
    else if (last?.status === 'partial') s.partial++;
    else if (last && last.status !== 'misconception' && last.status !== 'multiple') s.unclear++;
    const rev = revisedDiagnosis(r);
    if (rev) s.revised++;
    if (rev?.status === 'correct' && first && first.status !== 'correct') s.movedToCorrect++;
    for (const i of first?.ideas ?? []) {
      if (i.id === correctId) continue;
      const row = ideas.get(i.id) ?? { count: 0, persisting: 0 };
      row.count++;
      if (rev?.ideas.some((x) => x.id === i.id)) row.persisting++;
      ideas.set(i.id, row);
    }
    if (eventsOf(r, 'assist').some((e) => e.level >= ASSIST_LEVEL)) s.assisted++;
    if (eventsOf(r, 'transfer').length) s.transferTried++;
    if (transferShown(r)) s.transferShown++;
  }
  s.ideas = [...ideas.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count);
  s.gaps = pack.prerequisites.map((p) => {
    const all = mine.map((r) => gapsOf(pack, r).find((g) => g.id === p.id)!.status);
    return {
      id: p.id,
      suspected: all.filter((x) => x === 'suspected').length,
      confirmed: all.filter((x) => x === 'confirmed' || x === 'persisting').length,
      recovered: all.filter((x) => x === 'recovered').length,
    };
  });
  return s;
}

export type GroupKind = 'gap' | 'idea' | 'clarify' | 'followup' | 'enrich';
export interface InterventionGroup {
  id: string;
  kind: GroupKind;
  title: L;
  /** learner ids */
  members: string[];
  move: L;
  experimentId: string | null;
}

/** Same records in, same groups out. Each learner appears in the one group that is most useful to them now. */
export function interventionGroups(pack: ConceptPack, records: LearnerRecord[]): InterventionGroup[] {
  const mine = records.filter((r) => r.pack === pack.id && initialDiagnosis(r));
  const correctId = correctIdeaId(pack);
  const groups = new Map<string, InterventionGroup>();
  const put = (id: string, make: () => Omit<InterventionGroup, 'id' | 'members'>, member: string) => {
    const g = groups.get(id) ?? { id, members: [], ...make() };
    g.members.push(member);
    groups.set(id, g);
  };
  const bestFor = (ideaId: string) => {
    const idea = pack.ideas[ideaId];
    const p = plan(pack, [{ key: ideaId, ideas: [ideaId], model: idea.model, learners: 1 }], { ...DEFAULT_CONSTRAINTS, grade: 12 });
    return p.recommended?.id ?? null;
  };
  for (const r of mine) {
    const gap = gapsOf(pack, r).find((g) => g.status === 'confirmed' || g.status === 'persisting');
    const latest = latestDiagnosis(r)!;
    if (gap) {
      const p = pack.prerequisites.find((x) => x.id === gap.id)!;
      put(`gap:${p.id}`, () => ({ kind: 'gap', title: { ar: `مراجعة أساس: ${p.label.ar}`, en: `Foundation: ${p.label.en}` }, move: p.remedy.title, experimentId: null }), r.id);
    } else if (latest.status === 'misconception' || latest.status === 'multiple') {
      const ideaId = latest.ideas.find((i) => i.id !== correctId)!.id;
      const idea = pack.ideas[ideaId];
      put(`idea:${ideaId}`, () => ({ kind: 'idea', title: { ar: `نفس الفكرة: ${idea.label.ar}`, en: `Shared idea: ${idea.label.en}` }, move: idea.intervention, experimentId: bestFor(ideaId) }), r.id);
    } else if (latest.status === 'insufficient' || latest.status === 'contradictory' || latest.status === 'offtopic' || latest.status === 'unsupported') {
      put('clarify', () => ({ kind: 'clarify', title: { ar: 'بدنا نسمعهم أكثر', en: 'Needs clarification' }, move: { ar: 'اسأل كل واحد: «فرجيني بإيدك أو بالرسم شو قصدك»، قبل أي تصحيح.', en: 'Ask each one to show what they mean with a drawing or gesture before correcting anything.' }, experimentId: null }), r.id);
    } else if (latest.status === 'correct' && !eventsOf(r, 'assist').some((e) => e.level >= ASSIST_LEVEL)) {
      put('enrich', () => ({ kind: 'enrich', title: { ar: 'جاهزين لتحدّي أكبر', en: 'Ready for a further challenge' }, move: pack.activities._enrich.goal, experimentId: null }), r.id);
    } else {
      put('followup', () => ({ kind: 'followup', title: { ar: 'تثبيت الفهم', en: 'Consolidate' }, move: { ar: 'كل واحد يشرح لزميله بمثال جديد، والزميل يسأل «ليش؟».', en: 'Each explains with a new example to a partner, who asks “why?”.' }, experimentId: null }), r.id);
    }
  }
  const order: GroupKind[] = ['gap', 'idea', 'clarify', 'followup', 'enrich'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.members.length - a.members.length);
}

/** Counts only: this is all that may be sent to the activity model. */
export function evidenceForActivity(pack: ConceptPack, records: LearnerRecord[]): ActivityRequest['evidence'] {
  const s = summarise(pack, records);
  return {
    total: s.explained,
    ideas: s.ideas.slice(0, 12).map(({ id, count }) => ({ id, count })),
    correct: s.correct, partial: s.partial, unclear: s.unclear,
    gaps: s.gaps.filter((g) => g.confirmed > 0).map((g) => ({ id: g.id, count: g.confirmed })),
  };
}

/** Which activity template the evidence points to. */
export function activityFocus(pack: ConceptPack, e: ActivityRequest['evidence']): { kind: 'gap' | 'idea' | 'enrich' | 'general'; id: string | null; count: number } {
  const gap = [...e.gaps].sort((a, b) => b.count - a.count)[0];
  if (gap && e.total && gap.count / e.total >= 0.34 && pack.prerequisites.some((p) => p.id === gap.id)) return { kind: 'gap', id: gap.id, count: gap.count };
  if (e.total && e.correct / e.total >= 0.7) return { kind: 'enrich', id: null, count: e.correct };
  const idea = [...e.ideas].filter((i) => pack.ideas[i.id]).sort((a, b) => b.count - a.count)[0];
  if (idea && idea.count > 0) return { kind: 'idea', id: idea.id, count: idea.count };
  return { kind: 'general', id: null, count: 0 };
}

function scaleMinutes(steps: { minutes: number; title: string; detail: string }[], total: number) {
  const sum = steps.reduce((a, s) => a + s.minutes, 0) || 1;
  const out = steps.map((s) => ({ ...s, minutes: Math.max(1, Math.round((s.minutes * total) / sum)) }));
  // give rounding leftovers to the longest step so the minutes add up
  const diff = total - out.reduce((a, s) => a + s.minutes, 0);
  const longest = out.reduce((best, s, i) => (s.minutes > out[best].minutes ? i : best), 0);
  out[longest].minutes = Math.max(1, out[longest].minutes + diff);
  return out;
}

/** The activity generator without a model: built from the pack and this class's evidence, always editable. */
export function fallbackActivity(pack: ConceptPack, req: ActivityRequest): ActivityPlan {
  const lang: Lang = req.lang;
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const n = (x: number) => x.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB');
  const focus = activityFocus(pack, req.evidence);
  const idea = focus.kind === 'idea' ? pack.ideas[focus.id!] : null;
  const gap = focus.kind === 'gap' ? pack.prerequisites.find((p) => p.id === focus.id)! : null;
  const template = pack.activities[focus.kind === 'enrich' ? '_enrich' : focus.id && pack.activities[focus.id] ? focus.id : '_default'];

  const available = (m: ResourceId) => req.resources.includes(m);
  const experiments = pack.experiments
    .filter((x) => x.materials.every(available) && x.minGrade <= req.grade && x.minutes <= req.minutes)
    .filter((x) => !idea || pack.kidOutcome(idea.model, { ...pack.baseline, ...x.change }) !== pack.realOutcome({ ...pack.baseline, ...x.change }));
  const pick = experiments.slice(0, 3);
  const questions = (pick.length ? pick : pack.experiments.slice(0, 3)).map((x) => x.question[lang]);
  const groups = Math.max(1, Math.ceil(req.classSize / 4));

  let steps = template.steps.map((s) => ({ minutes: s.minutes, title: s.title[lang], detail: s.detail[lang] }));
  let title = template.title[lang];
  let grouping = `${template.grouping[lang]} (${tr(`حوالي ${n(groups)} مجموعات لصف من ${n(req.classSize)}`, `about ${groups} groups for ${req.classSize} learners`)})`;
  if (gap) {
    title = gap.remedy.title[lang];
    steps = [
      ...gap.remedy.steps.map((s, i) => ({ minutes: Math.max(1, Math.round(gap.remedy.minutes / gap.remedy.steps.length)), title: tr(`خطوة ${n(i + 1)}`, `Step ${i + 1}`), detail: s[lang] })),
      { minutes: 3, title: tr('تحقّق من جديد', 'Check again'), detail: gap.recheck.q[lang] },
    ];
  } else if (req.type !== template.type) {
    const predict = { minutes: 3, title: tr('توقّعات فردية', 'Individual predictions'), detail: questions[0] };
    const debrief = { minutes: 3, title: tr('نقاش الصف', 'Class discussion'), detail: tr('أي فكرة صمدت قدّام كل النتائج؟ وليش؟', 'Which idea survived every result, and why?') };
    const check = { minutes: 2, title: tr('تقييم سريع', 'Quick check'), detail: template.check[lang] };
    const rounds = questions.map((q, i) => ({ minutes: 4, title: '', detail: q, i }));
    const named = (ar: string, en: string) => rounds.map((r) => ({ minutes: r.minutes, title: tr(`${ar} ${n(r.i + 1)}`, `${en} ${r.i + 1}`), detail: r.detail }));
    const forms: Record<ActivityRequest['type'], { title: string; steps: typeof steps }> = {
      experiment: { title: tr('تجربة اكتشاف', 'Discovery experiment'), steps: [predict, ...named('جرّبوا', 'Test'), debrief, check] },
      discussion: { title: tr('نقاش موجّه', 'Guided discussion'), steps: [predict, { minutes: 5, title: tr('فكّر مع زميلك', 'Think with a partner'), detail: tr('كل واحد يقنع زميله بتوقّعه بدليل من تجربة أو من البيت.', 'Each partner argues their prediction with evidence from a test or from home.') }, debrief, check] },
      peer: { title: tr('تعلّم بين الزملاء', 'Peer instruction'), steps: [predict, { minutes: 6, title: tr('أقنع زميلك', 'Convince your partner'), detail: tr('زاوج متعلّمين توقّعاتهم مختلفة. كل واحد يشرح، والثاني يسأل «ليش؟»، بعدين يصوّتوا من جديد.', 'Pair learners whose predictions differ. One explains, the other asks “why?”, then both vote again.') }, ...named('جرّبوا', 'Test').slice(0, 1), check] },
      game: { title: tr('لعبة «أي عالم صح؟»', 'Game: which world is it?'), steps: [{ minutes: 2, title: tr('القوانين', 'Rules'), detail: tr('كل مجموعة ترفع بطاقة بتوقّعها قبل ما تشوف النتيجة. النقطة للشرح المقنع، مش للتوقّع الصح بس.', 'Each group raises a prediction card before seeing the result. Points are for a convincing explanation, not only a correct guess.') }, ...named('جولة', 'Round'), debrief] },
      escape: { title: tr('غرفة الهروب العلمية', 'Escape-room challenge'), steps: [{ minutes: 2, title: tr('المهمّة', 'Mission'), detail: tr('ثلاثة أقفال. كل قفل بينفتح بتوقّع مع سبب، وبعدين تجربة تتأكّد.', 'Three locks. Each opens with a prediction plus a reason, then a test confirms it.') }, ...named('القفل', 'Lock'), check] },
      worksheet: { title: tr('ورقة توقّع ولاحظ وفسّر', 'Predict–observe–explain worksheet'), steps: [{ minutes: 2, title: tr('تجهيز الورقة', 'Set up the sheet'), detail: tr('ثلاثة أعمدة: بتوقّع / لاحظت / فسّرت.', 'Three columns: I predict / I observed / I explain.') }, ...named('سؤال', 'Question'), check] },
      assessment: { title: tr('تقييم تكويني سريع', 'Quick formative check'), steps: [...pack.postTest.slice(0, 3).map((q, i) => ({ minutes: 2, title: tr(`سؤال ${n(i + 1)}`, `Question ${i + 1}`), detail: `${q.q[lang]} (${q.options.map((o) => o[lang]).join(' / ')})` })), debrief] },
    };
    title = `${forms[req.type].title}: ${pack.title[lang]}`;
    steps = forms[req.type].steps;
    if (req.type === 'peer') grouping = tr(`أزواج (${n(Math.ceil(req.classSize / 2))} أزواج)`, `Pairs (${Math.ceil(req.classSize / 2)} pairs)`);
  }

  const materials = template.materials.filter(available).map((m) => RESOURCES[m][lang]);
  const missing = template.materials.filter((m) => !available(m)).map((m) => RESOURCES[m][lang]);
  const total = req.evidence.total;
  const why = focus.kind === 'gap' ? tr(`${n(focus.count)} من ${n(total)} ما اجتازوا سؤال التحقّق من أساس «${gap!.label.ar}».`, `${focus.count} of ${total} did not pass the check on “${gap!.label.en}”.`)
    : focus.kind === 'idea' ? tr(`${n(focus.count)} من ${n(total)} شرحوا بفكرة «${idea!.label.ar}».`, `${focus.count} of ${total} explained with the idea “${idea!.label.en}”.`)
      : focus.kind === 'enrich' ? tr(`${n(focus.count)} من ${n(total)} شرحوا المفهوم كامل، فالنشاط تحدّي أعمق.`, `${focus.count} of ${total} explained the concept fully, so this goes further.`)
        : tr('لسا ما في أدلّة كافية من الصف، فهاد نشاط يكشف الأفكار.', 'There is not enough class evidence yet, so this activity surfaces ideas.');

  const adapt = [
    template.adapt[lang],
    missing.length ? tr(`مش متوفّر: ${missing.join('، ')}. استعملوا المشهد التفاعلي على الشاشة بدلها.`, `Not available: ${missing.join(', ')}. Use the on-screen interactive scene instead.`) : '',
    req.accessibility ? tr(`احتياجات خاصة ذكرتها: ${req.accessibility}. اقرأ التعليمات بصوت عالي، واسمح بالإجابة بالكلام أو بالرسم أو بالإشارة.`, `Accessibility needs noted: ${req.accessibility}. Read instructions aloud and accept answers spoken, drawn or pointed.`) : '',
  ].filter(Boolean).join(' ');

  return {
    title, type: gap ? 'experiment' : req.type,
    why,
    target: gap ? gap.why[lang] : idea ? idea.assumption[lang] : template.goal[lang],
    objective: (pack.objectives.find((goal) => goal.id === req.objective) ?? pack.objectives[0]).text[lang],
    grouping, materials,
    minutes: req.minutes,
    steps: scaleMinutes(steps, req.minutes),
    teacher: template.teacher[lang],
    check: gap ? gap.recheck.q[lang] : template.check[lang],
    adapt,
    source: 'fallback',
  };
}

/** Compact, name-free description of the class for the activity model. */
export function summaryForAI(pack: ConceptPack, e: ActivityRequest['evidence']): string {
  const idea = (id: string) => pack.ideas[id]?.ai ?? id;
  return [
    `Learners who explained: ${e.total}. Complete explanation: ${e.correct}. Partial: ${e.partial}. Unclear: ${e.unclear}.`,
    `Ideas that differ from the reference model (count): ${e.ideas.map((i) => `"${idea(i.id)}" ×${i.count}`).join('; ') || 'none identified'}.`,
    `Foundational gaps confirmed by a verification question (count): ${e.gaps.map((g) => `"${pack.prerequisites.find((p) => p.id === g.id)?.label.en ?? g.id}" ×${g.count}`).join('; ') || 'none'}.`,
  ].join('\n');
}

/** Hypothesis distribution used by the teacher's planner view. */
export const classHypotheses = (pack: ConceptPack, records: LearnerRecord[]) => hypothesesOf(pack, records.filter((r) => r.pack === pack.id));
export { groupKey };
