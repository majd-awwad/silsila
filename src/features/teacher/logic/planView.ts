/**
 * Presentation of the planner's result in words a teacher can check: why this experiment, what each idea
 * predicts, what rules others out, and what to do when there is nothing to recommend. It adds no ranking of its
 * own: every number comes from src/brain/planner.ts.
 */
import type { Lang, LearnerRecord, PlanConstraints, PlanResult, RankedExperiment, RoomMeta, RoomSettings } from '../../../contracts';
import { DEFAULT_CONSTRAINTS, WEIGHTS, plan, rejectReasons } from '../../../brain/planner';
import { hypothesesOf, latestDiagnosis } from '../../../brain/records';
import { formatNumber } from '../../../i18n';
import { RESOURCES } from '../../../packs/resources';
import type { ConceptPack } from '../../../packs/types';
import { REJECT_LABEL, groupTitle, ideaName, tr } from './labels';

export function constraintsOf(meta: Pick<RoomMeta, 'settings' | 'rejected' | 'done'>): PlanConstraints {
  const s = meta.settings;
  return {
    minutes: s.minutes, resources: s.resources, grade: s.grade, supervision: s.supervision, objective: s.objective,
    exclude: [...new Set([...meta.rejected, ...meta.done])],
  };
}

export const planFor = (pack: ConceptPack, meta: Pick<RoomMeta, 'settings' | 'rejected' | 'done'>, records: LearnerRecord[]): PlanResult =>
  plan(pack, hypothesesOf(pack, records.filter((r) => r.pack === pack.id)), constraintsOf(meta));

/** Which of the pack's experiments these settings allow, before any learner has answered. */
export function feasibility(pack: ConceptPack, settings: Pick<RoomSettings, 'minutes' | 'resources' | 'grade' | 'supervision' | 'objective'>) {
  const c: PlanConstraints = { ...DEFAULT_CONSTRAINTS, ...settings, exclude: [] };
  return pack.experiments.map((x) => ({
    id: x.id,
    reasons: rejectReasons(x, c),
    missing: settings.resources ? x.materials.filter((m) => !settings.resources.includes(m)) : [],
  }));
}

const experimentName = (pack: ConceptPack, id: string, lang: Lang) => pack.experiments.find((x) => x.id === id)?.name[lang] ?? id;
const outcomeName = (pack: ConceptPack, id: string, lang: Lang) => pack.outcomes[id]?.[lang] ?? id;

export interface PredictionRow {
  key: string;
  title: string;
  learners: number;
  outcome: string;
  real: string;
  contradicted: boolean;
}

/** What each hypothesis expects, next to the reference model. */
export function predictionRows(pack: ConceptPack, ranked: RankedExperiment, lang: Lang): PredictionRow[] {
  return ranked.predictions.map((p) => ({
    key: p.key,
    title: groupTitle(pack, p.key)[lang],
    learners: p.learners,
    outcome: outcomeName(pack, p.outcome, lang),
    real: outcomeName(pack, ranked.real, lang),
    contradicted: p.contradicted,
  }));
}

/** The reason for a ranked experiment, as short checkable sentences. */
export function explainChoice(pack: ConceptPack, ranked: RankedExperiment, result: PlanResult, lang: Lang): string[] {
  const n = (v: number) => formatNumber(lang, v);
  const x = pack.experiments.find((e) => e.id === ranked.id);
  const out: string[] = [];
  const others = result.total - result.testable;

  if (!result.testable) {
    out.push(tr(lang, 'لسا ما في أي فكرة قابلة للاختبار عند المتعلّمين، فما في أساس للمفاضلة بين التجارب.',
      'No learner has a testable idea yet, so there is no basis for preferring one experiment.'));
  } else if (ranked.reached) {
    out.push(tr(lang, `بتقدر تتحدّى فكرة ${n(ranked.reached)} من ${n(result.testable)} متعلّم عندهم فكرة قابلة للاختبار.`,
      `It can challenge the idea of ${n(ranked.reached)} of ${n(result.testable)} learners who have a testable idea.`));
  } else {
    out.push(tr(lang, 'ما بتتحدّى أي فكرة موجودة هلأ: كل الأفكار القابلة للاختبار بتتوقّع نفس نتيجة النموذج العلمي.',
      'It challenges no idea present now: every testable idea predicts the same result as the reference model.'));
  }
  if (ranked.refutes.length) {
    const names = ranked.refutes.map((id) => `«${ideaName(pack, id)[lang]}»`).join(tr(lang, '، ', ', '));
    out.push(tr(lang, `الأفكار اللي ممكن تناقضها: ${names}.`, `Ideas it can contradict: ${names}.`));
  }
  const broken = ranked.predictions.filter((p) => p.contradicted);
  if (broken.length) {
    const expected = broken
      .map((p) => tr(lang, `«${groupTitle(pack, p.key).ar}» بتتوقّع «${outcomeName(pack, p.outcome, lang)}»`, `“${groupTitle(pack, p.key).en}” expects “${outcomeName(pack, p.outcome, lang)}”`))
      .join(tr(lang, '؛ ', '; '));
    out.push(tr(lang, `${expected}، بينما النموذج العلمي بيعطي «${outcomeName(pack, ranked.real, lang)}».`,
      `${expected}, while the reference model gives “${outcomeName(pack, ranked.real, lang)}”.`));
  }
  if (others > 0) {
    out.push(tr(lang, `${n(others)} من ${n(result.total)} لسا شرحهم ما بيكفي للاختبار.`,
      `${n(others)} of ${n(result.total)} learners have not yet given an idea that can be tested.`));
  }
  if (x) {
    const materials = x.materials.map((m) => RESOURCES[m]?.[lang] ?? m).join(tr(lang, '، ', ', ')) || tr(lang, 'بدون مواد', 'no materials');
    out.push(tr(lang, `بدها حوالي ${n(x.minutes)} دقيقة، والمواد: ${materials}.`, `It takes about ${n(x.minutes)} minutes and needs: ${materials}.`));
  }
  return out;
}

export interface ScorePart { id: keyof RankedExperiment['parts']; label: string; value: number; weight: number }

const PART_LABEL: Record<keyof RankedExperiment['parts'], { ar: string; en: string }> = {
  reach: { ar: 'متعلّمين بتتحدّى فكرتهم', en: 'Learners challenged' },
  coverage: { ar: 'أفكار بتغطّيها', en: 'Ideas covered' },
  disagreement: { ar: 'اختلاف توقّعات الصف', en: 'Class disagreement' },
  objective: { ar: 'ملاءمة الهدف', en: 'Fit to objective' },
  time: { ar: 'وقت بيضل للحصة', en: 'Lesson time left over' },
};

export function scoreParts(ranked: RankedExperiment, lang: Lang): ScorePart[] {
  return (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((id) => ({
    id, label: PART_LABEL[id][lang], value: ranked.parts[id], weight: WEIGHTS[id],
  }));
}

export interface RejectedRow {
  id: string;
  name: string;
  reasons: string[];
  /** the teacher may still pick it: never when safety or grade ruled it out */
  canChoose: boolean;
}

export function rejectedRows(pack: ConceptPack, meta: Pick<RoomMeta, 'settings' | 'rejected' | 'done'>, result: PlanResult, lang: Lang): RejectedRow[] {
  return result.rejected.map((r) => {
    const x = pack.experiments.find((e) => e.id === r.id);
    const reasons = r.reasons.map((why) => {
      if (why === 'excluded') {
        return meta.rejected.includes(r.id) ? tr(lang, 'انتو رفضتوها', 'You rejected it') : tr(lang, 'انعملت بهالصف', 'Already run in this room');
      }
      if (why === 'materials' && x) {
        const missing = x.materials.filter((m) => !meta.settings.resources.includes(m)).map((m) => RESOURCES[m]?.[lang] ?? m);
        return `${REJECT_LABEL.materials[lang]}: ${missing.join(tr(lang, '، ', ', '))}`;
      }
      return REJECT_LABEL[why][lang];
    });
    return { id: r.id, name: experimentName(pack, r.id, lang), reasons, canChoose: !r.reasons.includes('safety') && !r.reasons.includes('grade') };
  });
}

export interface Advice {
  title: string;
  body: string;
  /** concrete things the teacher can say or do next */
  prompts: { label: string; text: string }[];
}

/** When the planner does not recommend an experiment there is still a useful next move. */
export function modeAdvice(pack: ConceptPack, result: PlanResult, records: LearnerRecord[], lang: Lang): Advice | null {
  const n = (v: number) => formatNumber(lang, v);
  if (result.mode === 'experiment') return null;
  if (result.mode === 'enrich') {
    return {
      title: tr(lang, 'الصف جاهز لتحدّي أبعد', 'The class is ready for a further challenge'),
      body: tr(lang, 'ما في بين الأفكار القابلة للاختبار فكرة بتختلف عن النموذج العلمي. بدل تجربة تصحيح، طبّقوا الفهم على موقف جديد.',
        'No testable idea differs from the reference model. Instead of a correcting experiment, apply the understanding to a new situation.'),
      prompts: [
        { label: tr(lang, 'موقف جديد', 'New situation'), text: pack.transfer.prompt[lang] },
        { label: tr(lang, 'تحدّي إضافي', 'Further challenge'), text: pack.challenge.phenomenon[lang] },
        ...(pack.activities._enrich ? [{ label: pack.activities._enrich.title[lang], text: pack.activities._enrich.goal[lang] }] : []),
      ],
    };
  }
  if (result.mode === 'ask') {
    const mine = records.filter((r) => r.pack === pack.id);
    const unclear = mine.filter((r) => {
      const d = latestDiagnosis(r);
      return d && !d.model;
    }).length;
    const waiting = mine.filter((r) => !latestDiagnosis(r)).length;
    const partsBody = [
      result.total === 0
        ? tr(lang, 'لسا ما وصل أي شرح.', 'No explanation has arrived yet.')
        : result.testable === 0
          ? tr(lang, `وصل ${n(result.total)} شرح، بس ولا واحد فيه فكرة واضحة كفاية للاختبار.`, `${n(result.total)} explanations arrived, but none holds an idea clear enough to test.`)
          : tr(lang, 'الأدلّة لسا ما بتكفي لاختيار تجربة بتفرّق بين الأفكار.', 'There is not yet enough evidence to choose a test that separates ideas.'),
      unclear ? tr(lang, `${n(unclear)} شرحهم مش واضح.`, `${n(unclear)} explanations are unclear.`) : '',
      waiting ? tr(lang, `${n(waiting)} لسا ما جاوبوا.`, `${n(waiting)} have not answered yet.`) : '',
    ];
    return {
      title: tr(lang, 'اسألوا سؤال تشخيصي أول', 'Ask a diagnostic question first'),
      body: partsBody.filter(Boolean).join(' '),
      prompts: [
        ...pack.clarify.slice(0, 3).map((c, i) => ({ label: tr(lang, `سؤال ${n(i + 1)}`, `Question ${n(i + 1)}`), text: c.q[lang] })),
        { label: tr(lang, 'سؤال الدرس', 'Lesson question'), text: pack.question[lang] },
      ],
    };
  }
  const why = [...new Set(result.rejected.flatMap((r) => r.reasons))].map((r) => REJECT_LABEL[r][lang]);
  return {
    title: tr(lang, 'ما في تجربة ممكنة بهالشروط', 'No experiment fits these constraints'),
    body: tr(lang, `الأسباب: ${why.join('، ') || 'ما في تجارب بالحزمة'}. وفّروا المواد أو الوقت أو الإشراف بصف جديد، أو ناقشوا هالأسئلة.`,
      `Reasons: ${why.join(', ') || 'the pack has no experiments'}. Provide materials, time or supervision in a new room, or discuss these questions.`),
    prompts: [
      ...pack.clarify.slice(0, 2).map((c) => ({ label: tr(lang, 'سؤال للنقاش', 'Discussion question'), text: c.q[lang] })),
      { label: tr(lang, 'موقف جديد', 'New situation'), text: pack.transfer.prompt[lang] },
    ],
  };
}

export const sequenceNames = (pack: ConceptPack, ids: string[], lang: Lang): string[] => ids.map((id) => experimentName(pack, id, lang));
