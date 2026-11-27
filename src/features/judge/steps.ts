/** The demonstration script: what to say, what to open. Times assume the 5-minute competition slot. */
import type { L } from '../../contracts';

export interface DemoAction { label: L; to: string; newTab?: boolean }
export interface DemoStep { id: string; title: L; say: L; minutes: string; actions: DemoAction[]; fullOnly?: boolean }

export const STEPS: DemoStep[] = [
  {
    id: 'problem', minutes: '0:00–0:35',
    title: { ar: 'المشكلة: أفكار مخبّاية', en: 'The problem: hidden misconceptions' },
    say: { ar: 'المعلّم بيشوف الجواب، ما بيشوف ليش. طفلين غلطوا بنفس السؤال ممكن يكونوا مفكّرين بطريقتين مختلفتين تماماً.', en: 'Teachers see the answer, not the reason. Two children can miss the same question for completely different reasons.' },
    actions: [{ label: { ar: 'الصفحة الرئيسية', en: 'Landing page' }, to: '/' }],
  },
  {
    id: 'words', minutes: '0:35–1:50',
    title: { ar: 'حكم بيحكي بكلامه', en: 'A judge explains in their own words' },
    say: { ar: 'اكتب أو احكي ليش بتطلع النقط. منحوّلها لسلسلة تفكير، بتتوقّع، وبعدين بتجرّب. النتيجة ما بتطلع قبل التوقّع.', en: 'Say why the droplets appear. We turn it into a reasoning chain, you predict, then you test. No result is shown before a prediction.' },
    actions: [{ label: { ar: 'المختبر (وضع الحكّام)', en: 'Lab (judge mode)' }, to: '/learn/condensation?judge=1&quick=1' }],
  },
  {
    id: 'join', minutes: '1:50–2:20',
    title: { ar: 'الحكّام بينضمّوا للصف', en: 'Judges join the classroom' },
    say: { ar: 'امسحوا الكود، واكتبوا فكرتكم لحالكم. ما حدا بيشوف فكرة غيره قبل ما يبعت.', en: 'Scan the code and write your own idea. Nobody sees another idea before sending theirs.' },
    actions: [{ label: { ar: 'اعمل صف حي (تحت)', en: 'Create a live room (below)' }, to: '/judge' }],
  },
  {
    id: 'discover', minutes: '2:20–3:45',
    title: { ar: 'اكتشاف جماعي', en: 'Collective discovery' },
    say: { ar: 'هاي خريطة تفكير الصف. المخطِّط اختار تجربة لهالتوزيع بالذات وبيشرح ليش. توقّعوا، نشغّلها، تناقشوا، وعدّلوا.', en: 'This is the class’s reasoning map. The planner chose a test for exactly this distribution and says why. Predict, run it, discuss, revise.' },
    actions: [
      { label: { ar: 'لوحة تحكّم المعلّم', en: 'Teacher control' }, to: '/teacher', newTab: true },
      { label: { ar: 'الصف التجريبي (موسوم)', en: 'Sample classroom (labelled)' }, to: '/teacher/room/SAMPLE', newTab: true },
      { label: { ar: 'شاشة العرض التجريبية', en: 'Sample projector' }, to: '/screen/SAMPLE', newTab: true },
    ],
  },
  {
    id: 'teacher', minutes: '3:45–4:20',
    title: { ar: 'خطة للمعلّم', en: 'A plan for the teacher' },
    say: { ar: 'مين تغيّرت فكرته ومين لسا، ومجموعات صغيرة، ونشاط مبني على أدلّة هالصف.', en: 'Whose idea changed and whose did not, small groups, and an activity built from this class’s evidence.' },
    actions: [{ label: { ar: 'مساحة المعلّم', en: 'Teacher workspace' }, to: '/teacher' }],
  },
  {
    id: 'math', minutes: '4:20–4:40',
    title: { ar: 'نفس المحرّك، رياضيات', en: 'Same engine, mathematics' },
    say: { ar: '«الثمن أكبر من الربع لأنه ٨ أكبر من ٤». نفس السلسلة: فكرة، توقّع، تجربة.', en: '“One eighth is bigger than one quarter because 8 is bigger than 4.” Same chain: idea, prediction, test.' },
    actions: [{ label: { ar: 'درس الكسور', en: 'Fractions lesson' }, to: '/learn/fractions?judge=1&quick=1' }],
  },
  {
    id: 'gap', minutes: '+1:00', fullOnly: true,
    title: { ar: 'استرجاع فجوة أساسية', en: 'Learning gap recovery' },
    say: { ar: 'ما بنفترض فجوة من جواب غلط: بنسأل سؤالين تحقّق، وإذا تأكّدت بنعالجها وبنرجع للدرس.', en: 'A wrong answer is not assumed to be a gap: two check questions confirm it, a short activity addresses it, then we return to the lesson.' },
    actions: [{ label: { ar: 'درس الكسور: جاوب سؤال التحقّق غلط', en: 'Fractions: miss a check question' }, to: '/learn/fractions?judge=1&quick=1' }],
  },
  {
    id: 'noor', minutes: '+1:00', fullOnly: true,
    title: { ar: 'علّم نور', en: 'Teach Noor' },
    say: { ar: 'نور ما بتستعمل إلا اللي الطفل علّمها إياه، وإذا في حلقة ناقصة بتوقف عندها وبتسأل.', en: 'Noor uses only what the child taught her; at a missing link she stops and asks.' },
    actions: [{ label: { ar: 'كمّل الدرس لآخره', en: 'Finish the lesson' }, to: '/learn/condensation?judge=1&quick=1' }],
  },
  {
    id: 'studio', minutes: '+0:45', fullOnly: true,
    title: { ar: 'استوديو الدروس', en: 'Lesson Studio' },
    say: { ar: 'المعلّم بيكتب درسه وبياخد مسودة قابلة للتعديل، وموسومة بصدق: مدعومة تفاعلياً أو بدها مراجعة.', en: 'A teacher enters a lesson and gets an editable draft, honestly labelled: fully interactive or needs review.' },
    actions: [{ label: { ar: 'افتح الاستوديو', en: 'Open the studio' }, to: '/teacher/studio' }],
  },
  {
    id: 'evidence', minutes: '4:40–5:00',
    title: { ar: 'الأدلّة والحدود', en: 'Evidence and limits' },
    say: { ar: 'هاي أرقام التشخيص بأعدادها، ومنها غير المقاس: أثر التعلّم ما قسناه.', en: 'These are the diagnosis numbers with their counts, and what is not measured: learning impact.' },
    actions: [{ label: { ar: 'الأدلّة (تحت)', en: 'Evidence (below)' }, to: '/judge' }],
  },
];
