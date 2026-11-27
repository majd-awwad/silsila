/**
 * Adaptive Lesson Studio without a model: find a fully supported pack for the topic and draft from its reviewed
 * content; otherwise return an honest skeleton the teacher completes. Drafts are text only: nothing in them is
 * ever executed, and a draft never becomes an interactive simulation by itself.
 */
import type { Lang, LessonDraft, LessonInput } from '../contracts';
import { PACK_LIST } from '../packs';
import type { ConceptPack } from '../packs/types';
import { normaliseText } from './text';

const TOPICS: Record<string, RegExp> = {
  condensation: /تكاثف|التكثف|الندي|ندي|condens|dew/,
  evaporation: /تبخر|التبخر|evapor/,
  shadows: /ظل|الظلال|shadow/,
  fractions: /كسر|كسور|ربع|ثمن|fraction/,
  buoyancy: /طفو|يطفو|تطفو|غرق|buoyan|float|sink/,
  'area-perimeter': /محيط|مساحه|perimeter|\barea\b/,
};

export function matchPack(title: string, content = '', objectives = ''): ConceptPack | null {
  // the title decides; the longer text only when the title matches nothing
  for (const text of [title, `${objectives} ${content}`]) {
    const t = normaliseText(text);
    const hit = PACK_LIST.find((p) => TOPICS[p.id]?.test(t));
    if (hit) return hit;
  }
  return null;
}

const split = (s: string) => s.split(/\n|•|؛|;/).map((x) => x.trim()).filter(Boolean).slice(0, 8);

export function fallbackLesson(input: LessonInput): LessonDraft {
  const lang: Lang = input.lang;
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const pack = matchPack(input.title, input.content, input.objectives);
  const own = split(input.objectives);
  if (pack) {
    const ideas = Object.values(pack.ideas).filter((i) => !i.correct);
    return {
      title: input.title,
      objectives: own.length ? own : pack.objectives.map((o) => o.text[lang]),
      concepts: Object.values(pack.concepts).map((c) => c.label[lang]),
      prerequisites: pack.prerequisites.map((p) => p.label[lang]),
      misconceptions: ideas.slice(0, 6).map((i) => ({ idea: i.label[lang], probe: i.intervention[lang] })),
      questions: [pack.question[lang], ...pack.clarify.map((c) => c.q[lang])].slice(0, 6),
      experiments: pack.experiments.filter((x) => x.minGrade <= input.grade).slice(0, 4).map((x) => ({
        title: x.name[lang], steps: x.home.steps.map((s) => s[lang]), materials: x.materials.map(String), safety: x.safety.note[lang],
      })),
      activities: pack.activities._default.steps.map((s) => ({ title: s.title[lang], minutes: s.minutes, detail: s.detail[lang] })),
      assessment: pack.postTest.map((q) => q.q[lang]),
      transfer: [pack.transfer.prompt[lang], pack.challenge.phenomenon[lang]],
      guidance: [
        pack.activities._default.teacher[lang],
        tr('هاد الدرس مدعوم بحزمة تفاعلية كاملة: بتقدروا تفتحوا صف حي منها مباشرة.', 'This topic has a fully supported interactive pack: you can open a live class from it directly.'),
        input.accessibility ? tr(`راعوا: ${input.accessibility}`, `Plan for: ${input.accessibility}`) : '',
      ].filter(Boolean),
      matchedPack: pack.id,
      source: 'fallback',
    };
  }
  const concepts = split(input.content).slice(0, 5);
  const todo = (ar: string, en: string) => tr(`(للمعلّم) ${ar}`, `(Teacher to complete) ${en}`);
  return {
    title: input.title,
    objectives: own.length ? own : [todo(`شو بدّك الطالب يقدر يفسّر عن «${input.title}»؟`, `What should learners be able to explain about “${input.title}”?`)],
    concepts: concepts.length ? concepts : [todo('اكتب المفاهيم الأساسية.', 'List the key concepts.')],
    prerequisites: [todo('شو لازم يعرفوا قبل هالدرس؟', 'What must they know before this lesson?')],
    misconceptions: [{ idea: todo('فكرة خاطئة متوقّعة', 'A likely misconception'), probe: todo('سؤال بيكشفها', 'A question that reveals it') }],
    questions: [tr(`احكيلي بكلامك: ليش/كيف بيصير «${input.title}»؟`, `In your own words, why or how does “${input.title}” happen?`)],
    experiments: [],
    activities: [
      { title: tr('توقّع', 'Predict'), minutes: Math.max(3, Math.round(input.minutes * 0.2)), detail: tr('كل طالب بيكتب توقّعه وسببه.', 'Each learner writes a prediction and a reason.') },
      { title: tr('لاحظ', 'Observe'), minutes: Math.max(5, Math.round(input.minutes * 0.4)), detail: todo('اختاروا ملاحظة أو تجربة آمنة.', 'Choose a safe observation or test.') },
      { title: tr('فسّر', 'Explain'), minutes: Math.max(5, Math.round(input.minutes * 0.3)), detail: tr('قارنوا التوقّع بالملاحظة وعدّلوا الشرح.', 'Compare prediction with observation and revise the explanation.') },
    ],
    assessment: [tr('اشرح الفكرة لزميل بمثال جديد.', 'Explain the idea to a partner with a new example.')],
    transfer: [todo('موقف جديد بتنطبق عليه نفس الفكرة.', 'A new situation where the same idea applies.')],
    guidance: [tr('ما في حزمة تفاعلية لهاد الموضوع بعد: هاي مسودة تنظيمية، ومحتواها بدّه مراجعتك.', 'There is no interactive pack for this topic yet: this is an organising draft whose content needs your review.')],
    matchedPack: null,
    source: 'fallback',
  };
}
