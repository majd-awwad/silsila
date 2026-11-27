/** Likely judge questions, answered only with what this build actually does. Keep in step with docs/JUDGE-QA.md. */
import type { L } from '../../contracts';

export const JUDGE_QA: { q: L; a: L }[] = [
  {
    q: { ar: 'ليش مش ChatGPT مباشرة؟', en: 'Why not simply use ChatGPT?' },
    a: { ar: 'المحادثة العامة بتعطي جواب. إحنا بنطلّع فكرة الطفل بدليل من كلامه، وبنخلّيه يتوقّع ويختبرها بنموذج حسابي ثابت، وبنجمع أفكار صف كامل ونختار تجربة بخوارزم، ونسجّل الأدلّة للمعلّم. الموديل جزء واحد: فهم اللغة.', en: 'A general chat gives an answer. Here the learner’s idea is extracted with evidence from their words, they predict and test it against a deterministic model, a whole class’s hypotheses are grouped, an algorithm picks the shared experiment, and the teacher gets the evidence. The model does one job: understanding language.' },
  },
  {
    q: { ar: 'شو الفرق عن Betty’s Brain؟', en: 'How is this different from Betty’s Brain?' },
    a: { ar: 'Betty’s Brain من أنظمة «التعلّم بالتعليم» المعروفة: الطالب بيبني خريطة مفاهيم لعميل. إحنا بناخد كلام حر باللهجة، وبنشغّل فكرة الطفل كتجربة قابلة للاختبار، وبنشتغل على مستوى الصف. منستلهم من الفكرة وما بندّعي إننا اخترعناها.', en: 'Betty’s Brain is a well-known learning-by-teaching system where students build a concept map for an agent. SILSILA starts from free dialect speech, runs the learner’s idea as a testable experiment and works at classroom level. We build on learning by teaching; we did not invent it.' },
  },
  {
    q: { ar: 'وشو الفرق عن PhET؟', en: 'How is this different from PhET?' },
    a: { ar: 'PhET محاكيات ممتازة وأغنى منّا فيزيائياً. إحنا ما بننافسها بالمحاكاة: بنختار أي تجربة تنعمل حسب أفكار هالمتعلّم أو هالصف، وبنعرض عالم فكرته جنب النموذج العلمي، وبنربطها بالتوقّع والنقاش والتقييم.', en: 'PhET simulations are excellent and richer than ours. Our contribution is not the simulator: it is choosing which test to run from this learner’s or class’s ideas, showing the idea’s world beside the reference model, and connecting it to prediction, discussion and assessment.' },
  },
  {
    q: { ar: 'مش مجرّد تجميع طرق تعليمية معروفة؟', en: 'Is this only a collection of existing methods?' },
    a: { ar: 'الطرق معروفة (توقّع–لاحظ–فسّر، التعلّم بين الزملاء، التعلّم بالتعليم) وهاد مقصود. الجديد عندنا بالتنفيذ: سلسلة وحدة بيانات بتمرّ من كلام الطفل لفرضية، لاختيار تجربة للصف، لخطة المعلّم، على ستة مفاهيم بنفس المحرّك.', en: 'The methods are established (predict–observe–explain, peer instruction, learning by teaching) and that is deliberate. What we built is the pipeline: one data chain from a learner’s words to a hypothesis, to a class experiment, to a teaching plan, across six concepts on one engine.' },
  },
  {
    q: { ar: 'اختيار التجربة فعلاً بيتغيّر؟', en: 'Does experiment selection actually adapt?' },
    a: { ar: 'آه. المخطِّط بيحسب لكل تجربة توقّع كل فرضية، ونسبة المتعلّمين اللي بتتحدّى فكرتهم، وانتروبيا التوقّعات، والوقت والمواد والأمان. غيّروا توزيع الصف أو شيلوا مادة من القائمة وبيتغيّر الترتيب، وفي اختبارات آلية على هالشي. هو قاعدة تخطيط، مش مقياس مثبت للتعلّم.', en: 'Yes. For each experiment the planner computes what every hypothesis predicts, the share of learners whose idea it challenges, the entropy of predictions, and time, materials and safety. Change the class distribution or untick a material and the ranking changes; automated tests cover this. It is a planning heuristic, not a validated learning measure.' },
  },
  {
    q: { ar: 'ليش بدكم ذكاء اصطناعي أصلاً؟', en: 'Why does this require AI?' },
    a: { ar: 'لأن الأطفال ما بيحكوا بكلمات مفتاحية: لهجة، أخطاء، نفي، أفكار متشابكة. القواعد الاحتياطية بتشتغل وبنقيسها بصراحة، وهي الأرضية اللي لازم الموديل يتفوّق عليها.', en: 'Children do not speak in keywords: dialect, errors, negation, tangled ideas. Our offline rules run and are measured openly; they are the floor a model has to beat.' },
  },
  {
    q: { ar: 'كيف بيساعد المعلّم؟', en: 'How does it help teachers?' },
    a: { ar: 'خريطة فرضيات حيّة، تجربة مقترحة مع السبب، مجموعات تدخّل قابلة للتعديل، فجوات أساسية مع نتيجة التحقّق، نشاط من أدلّة الصف، وتقرير بينطبع.', en: 'A live hypothesis map, a recommended experiment with its reason, editable intervention groups, foundation gaps with verification results, an activity built from class evidence and a printable report.' },
  },
  {
    q: { ar: 'بيدعم مادة ثانية؟', en: 'Can it support another subject?' },
    a: { ar: 'آه: علوم ورياضيات على نفس المحرّك. الدرس الجديد حزمة بيانات ورسمة، وبيمرّ على اختبارات ثابتة. استوديو الدروس بيعمل مسودة نصّية للمواضيع الجديدة، وما بيدّعي إنه بيولّد محاكاة صحيحة لحاله.', en: 'Yes: science and mathematics run on the same engine. A new lesson is a data pack plus a drawing and must pass invariant tests. Lesson Studio drafts text for new topics and does not claim to generate a correct simulation by itself.' },
  },
  {
    q: { ar: 'كيف بتعرفوا إن الطالب فهم؟', en: 'How do you know the student understands?' },
    a: { ar: 'ما بنعرف يقيناً. خريطة الفهم بتطلب دليلين مستقلّين لنقول «ظاهر»، وبتميّز الفهم بمساعدة، وبتختبر موقف جديد. الاحتفاظ على المدى البعيد ما انقاس.', en: 'Not with certainty. The learning map needs two independent kinds of evidence before saying “demonstrated”, marks assisted understanding separately and tests a new situation. Long-term retention is not measured.' },
  },
  {
    q: { ar: 'شو بصير لما الموديل يغلط؟', en: 'What happens when the AI is wrong?' },
    a: { ar: 'ما بيقبل إشي بدون اقتباس موجود بكلام الطفل، والحالة بيحسبها الكود، وسطور نور مكتوبة مسبقاً، والنتائج من النموذج الحسابي. إذا مش متأكد بيسأل، والمعلّم بيشوف الدليل وبيقدر يتجاهله.', en: 'Nothing is accepted without a quote found in the learner’s words, code derives the status, Noor’s lines are authored and results come from the model in code. When unsure it asks, and the teacher sees the evidence and can disregard it.' },
  },
  {
    q: { ar: 'والأطفال اللي إنترنتهم ضعيف؟', en: 'What about children without strong internet?' },
    a: { ar: 'المشاهد ثنائية الأبعاد خفيفة، والـ3D اختياري. بدون موديل بتشتغل القواعد الاحتياطية، والصف الحي بيشتغل على شبكة محلية من لابتوب المعلّم.', en: 'Lite 2D scenes are the default and 3D is optional. Without a model the offline rules answer, and a live class can run over a local network from the teacher’s laptop.' },
  },
  {
    q: { ar: 'كيف بتحموا بيانات الأطفال؟', en: 'How do you protect children’s data?' },
    a: { ar: 'اسم مستعار بس، وما بنخزّن صوت، والصف الحي بينتهي بعد ساعات، وصلاحيات معلّم وطالب منفصلة، والشاشة بدون أسماء. بس بصراحة: لما الذكاء الاصطناعي شغّال، كلام الطفل (والصوت إذا التحويل السحابي مفعّل) بيروح لمزوّد الموديل. هاد نموذج أولي وما بندّعي امتثال إنتاجي.', en: 'Aliases only, no audio stored, live rooms expire within hours, separate teacher and learner permissions, no names on the shared screen. Honestly: when AI is on, the learner’s words (and audio if cloud transcription is enabled) go to the model provider. This is a prototype and we claim no production compliance.' },
  },
  {
    q: { ar: 'شو الأدلّة على ادّعاءاتكم؟', en: 'What evidence supports your claims?' },
    a: { ar: 'اختبارات آلية على المحرّك والحزم، وتقييم تشخيص على جمل مقسّمة تطوير/اختبار مع الأعداد الدقيقة. الجمل مكتوبة ومصنّفة من شخص واحد أو مولّدة، وبدها مراجعة. ما عنا دليل أثر تعلّم بعد.', en: 'Automated tests on the engine and packs, and a diagnosis evaluation on development/holdout sentences with exact counts. Sentences are team-written or generated and single-annotator, so they need review. We have no learning-impact evidence yet.' },
  },
  {
    q: { ar: 'شو الجديد فعلاً بتنفيذكم؟', en: 'What is genuinely new in your implementation?' },
    a: { ar: 'تحويل كلام حر بالعربي الفلسطيني لفرضية قابلة للتشغيل، ومخطِّط قابل للتفسير بيختار تجربة لتوزيع أفكار الصف، ونور محدودة بمعرفة الطفل بشكل بنيوي، وكل هاد على محرّك واحد. ما بندّعي إننا الأوائل بالعالم.', en: 'Turning free Palestinian-Arabic speech into a runnable hypothesis, an explainable planner that picks a test for a class’s distribution of ideas, and a Noor who is structurally limited to what the child taught, on one engine. We make no “first in the world” claim.' },
  },
];
