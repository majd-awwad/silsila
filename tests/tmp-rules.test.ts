import { it, expect } from 'vitest';
import { fractions } from '../src/packs/fractions';
import { buoyancy } from '../src/packs/buoyancy';
import { areaPerimeter } from '../src/packs/area-perimeter';
import { extractRaw, heuristicTeach } from '../src/brain/heuristic';
import { normaliseText } from '../src/brain/text';
import type { ConceptPack } from '../src/packs/types';

type Case = [string, string[], number[]?];

const F: Case[] = [
  // correct
  ['الربع أكبر من التمن', ['equal_parts']],
  ['الربع اكبر لانه كل ما زادت القطع صغرت', ['equal_parts'], [1]],
  ['ربع البيتزا أكتر من تمنها', ['equal_parts']],
  ['التمن أصغر لأنه مقسوم لقطع أكتر', ['equal_parts'], [1]],
  ['لازم القطع تكون قد بعض', [], [0]],
  ['قسمنا البيتزا بالتساوي', [], [0]],
  ['بس البيتزتين لازم يكونوا قد بعض', [], [2]],
  ['حسب حجم البيتزا', [], [2]],
  ['كل ما قسمنا اكتر بتصغر القطعة', ['equal_parts'], [1]],
  ['one quarter is bigger than one eighth', ['equal_parts']],
  ['1/4 is more than 1/8', ['equal_parts']],
  ['the more equal parts you cut, the smaller each piece is', ['equal_parts'], [0, 1]],
  ['the wholes must be the same size', [], [2]],
  ['the pizza is split into equal parts', [], [0]],
  // bigger denominator
  ['التمن اكبر من الربع', ['bigger_denominator']],
  ['الثمن اكتر لانه تمانيه اكبر من اربعه', ['bigger_denominator']],
  ['1/8 أكبر', ['bigger_denominator']],
  ['الرقم اللي تحت أكبر', ['bigger_denominator']],
  ['الربع اصغر من التمن', ['bigger_denominator']],
  ['كل ما كبر المقام كبر الكسر', ['bigger_denominator']],
  ['one eighth is bigger', ['bigger_denominator']],
  ['8 is more than 4 so it is bigger', ['bigger_denominator']],
  ['a bigger denominator means a bigger fraction', ['bigger_denominator']],
  ['التمن مش اكبر من الربع', []],
  ['one eighth is not bigger', []],
  ['8 أكبر من 4 بس التمن أصغر', ['equal_parts']],
  // ignore whole
  ['الربع ربع وين ما كان', ['ignore_whole']],
  ['ما بيهم قديش حجم الرغيف', ['ignore_whole']],
  ['حجم البيتزا ما بيفرق', ['ignore_whole']],
  ['مهما كان حجم الكيكة الربع نفسه', ['ignore_whole']],
  ['it does not matter how big the pizza is', ['ignore_whole']],
  ['a quarter is always a quarter', ['ignore_whole']],
  // separate numbers
  ['بقارن الأرقام اللي فوق', ['separate_numbers']],
  ['البسط نفسه فهم قد بعض', ['separate_numbers']],
  ['جمعت 1+4 وطلع 5', ['separate_numbers']],
  ['فوقهم واحد وواحد', ['separate_numbers']],
  ['5 اكبر من 3', ['separate_numbers']],
  ['I compare the top numbers', ['separate_numbers']],
  ['I added the numbers', ['separate_numbers']],
  ['5 is bigger than 3', ['separate_numbers']],
  // unequal ok
  ['مش مهم القطع تكون قد بعض', ['unequal_ok']],
  ['مش لازم القطع تكون متساوية', ['unequal_ok'], []],
  ['القطع مش لازم تكون قد بعض', ['unequal_ok'], []],
  ['حتى لو القطع مش متساوية بتضل ربع', ['unequal_ok'], []],
  ['أي قطعة من أربع قطع هي ربع', ['unequal_ok']],
  ['المهم عدد القطع', ['unequal_ok']],
  ['the pieces do not need to be equal', ['unequal_ok'], []],
  ['even if the pieces are unequal it is still a quarter', ['unequal_ok']],
  ['لو القطع مش قد بعض ما بتكون ربع', []],
  ['ما بعرف', []],
  ['مرحبا', []],
  ['عنا بيتزتين، وحدة ربع ووحدة تمن', []],
];

const B: Case[] = [
  ['المي بتدفع الأغراض لفوق', ['displacement'], [0]],
  ['المي بتدفشه لفوق', ['displacement'], [0]],
  ['القارب بيزيح مي أكتر من الكرة', ['displacement'], [1]],
  ['بيطفو لأنه كثافته أقل من المي', ['displacement'], [2]],
  ['دفعة المي بتكفي وزنه قبل ما يغطس', ['displacement'], [0, 2]],
  ['water pushes it up', ['displacement'], [0]],
  ['the boat pushes aside more water', ['displacement'], [1]],
  ['it is less dense than water', ['displacement'], [2]],
  ['it floats if the water push can balance its weight before it goes under', [], [2]],
  ['الحديد تقيل فبيغرق', ['heavy_sinks']],
  ['لانه تقيل بيغرق', ['heavy_sinks']],
  ['الإشي التقيل بينزل لتحت', ['heavy_sinks']],
  ['الحجر غرق عشان وزنه كبير', ['heavy_sinks']],
  ['heavy things sink', ['heavy_sinks']],
  ['it sinks because it is heavy', ['heavy_sinks']],
  ['التقيل مش دايما بيغرق', []],
  ['heavy things do not sink', []],
  ['بيطفو لأنه خفيف', ['light_floats']],
  ['الخشب خفيف فبيطفو', ['light_floats']],
  ['الخفيف بيضل فوق', ['light_floats']],
  ['it floats because it is very light', ['light_floats']],
  ['light objects float', ['light_floats']],
  ['it floats because it is lighter than water', []],
  ['المعدن بيغرق', ['material_only']],
  ['الحديد لازم يغرق', ['material_only']],
  ['الشكل مش مهم', ['material_only']],
  ['بيغرق لأنه من حديد', ['material_only']],
  ['steel always sinks', ['material_only']],
  ['only the material matters', ['material_only']],
  ['الحديد مش دايما بيغرق', []],
  ['الموتور هو اللي بيحملها', ['engine_holds']],
  ['ما بتغرق بسبب المحرك', ['engine_holds']],
  ['بتطفو لأنها بتتحرك', ['engine_holds']],
  ['السفينة بتضل فوق عشان فيها موتور', ['engine_holds']],
  ['لو وقف الموتور بتغرق', ['engine_holds']],
  ['it floats because of its engine', ['engine_holds']],
  ['it floats because it is moving', ['engine_holds']],
  ['the motor keeps it up', ['engine_holds']],
  ['مش عشان الموتور، المي بتدفعها', ['displacement']],
  ['it floats even when the engine is off', []],
  ['ما بعرف', []],
  ['السفينة بتطفو والكرة بتغرق', []],
];

const A: Case[] = [
  ['مش لازم نفس المساحة', ['independent']],
  ['ممكن يكونوا نفس المحيط بس مساحتهم مختلفة', ['independent'], [2]],
  ['المحيط ما بيحدد المساحة', ['independent'], [2]],
  ['نفس المحيط مش يعني نفس المساحة', ['independent'], [2]],
  ['they can have different areas', ['independent']],
  ['the same perimeter does not mean the same area', ['independent'], [2]],
  ['not always the same area', ['independent']],
  ['المحيط هو طول الخط اللي حوالين الشكل', [], [0]],
  ['بنجمع الأضلاع', [], [0]],
  ['المساحة هي المكان اللي جوا', [], [1]],
  ['بنعد المربعات', [], [1]],
  ['perimeter is the length around the shape', [], [0]],
  ['area is the space inside', [], [1]],
  ['نفس المحيط يعني نفس المساحة', ['same_perimeter_same_area']],
  ['اذا المحيط قد بعض المساحة قد بعض', ['same_perimeter_same_area']],
  ['اه دايما، نفس المحيط فنفس المساحة', ['same_perimeter_same_area']],
  ['المساحة نفسها لأن المحيط نفسه', ['same_perimeter_same_area']],
  ['same perimeter so same area', ['same_perimeter_same_area']],
  ['if the perimeters are equal then the areas are equal', ['same_perimeter_same_area']],
  ['مش شرط نفس المحيط يعني نفس المساحة', []],
  ['المحيط الأكبر مساحته أكبر', ['bigger_perimeter_bigger_area']],
  ['اللي محيطه أطول مساحته أكبر', ['bigger_perimeter_bigger_area']],
  ['كل ما زاد المحيط زادت المساحة', ['bigger_perimeter_bigger_area']],
  ['مساحته أكبر لأنه محيطه أكبر', ['bigger_perimeter_bigger_area']],
  ['a longer perimeter means more area', ['bigger_perimeter_bigger_area']],
  ['the bigger the perimeter the bigger the area', ['bigger_perimeter_bigger_area']],
  ['المحيط الأكبر مش يعني مساحة أكبر', []],
  ['المساحة هي المحيط', ['same_thing']],
  ['المحيط والمساحة نفس الاشي', ['same_thing']],
  ['area and perimeter are the same', ['same_thing']],
  ['المساحة مش هي المحيط', []],
  ['المحيط والمساحة مش نفس الاشي', []],
  ['ما بعرف', []],
];

const TEACH: Record<string, [string, boolean][]> = {
  fractions: [
    ['لأ، الربع أكبر لأنه مقسوم لقطع أقل', true],
    ['لا لانه كل ما قسمنا لقطع اكتر القطعه بتصغر', true],
    ['غلط، بالتمن في ناس اكتر فكل واحد بياخد اقل', true],
    ['الربع اكبر لانه 4 قطع بس', true],
    ['no, because more pieces means smaller pieces', true],
    ['That is wrong: eighths are cut into more parts', true],
    ['لا', false],
    ['لأ مش صح', false],
    ['لأنه التمن اكبر', false],
    ['اه صح', false],
    ['صح لأنه 8 قطع', false],
    ['التمن اكبر لانه قطعه اكتر', false],
    ['yes, eighth is bigger because it has more pieces', false],
    ['no', false],
  ],
  buoyancy: [
    ['لا، القارب شكله بيزيح مي أكتر', true],
    ['غلط، السفن من حديد وبتطفو', true],
    ['لأ لانه شكل القارب مجوف وفيه هوا', true],
    ['no, a boat shape pushes aside more water', true],
    ['wrong, ships are made of steel and they float', true],
    ['لا', false],
    ['لأ مش صح', false],
    ['اه لازم يغرق', false],
    ['صح الحديد تقيل', false],
    ['لأنه حديد لازم يغرق', false],
    ['yes it must sink in water', false],
    ['no', false],
  ],
  'area-perimeter': [
    ['لا، مثلا ٥ في ٥ مساحته أكبر من ٩ في ١', true],
    ['غلط، الشكل الرفيع فيه مربعات أقل', true],
    ['مش لازم، حسب شكل الحوش', true],
    ['no, a thin yard has fewer squares', true],
    ['not true, for example 5x5 and 9x1', true],
    ['لا', false],
    ['لأ مش صح', false],
    ['اه صح نفس المكان', false],
    ['صح لأنه نفس السياج', false],
    ['أكيد نفس المساحة', false],
    ['yes, same room because same shape of fence', false],
    ['no', false],
  ],
};

const run = (pack: ConceptPack, cases: Case[]) => {
  const bad: string[] = [];
  for (const [text, ideas, steps] of cases) {
    const raw = extractRaw(pack, text);
    const got = (raw.ideas as { id: string }[]).map((i) => i.id).sort();
    const gotSteps = (raw.steps as { met: boolean }[]).map((s, i) => (s.met ? i : -1)).filter((i) => i >= 0);
    if (JSON.stringify(got) !== JSON.stringify([...ideas].sort())) bad.push(`IDEAS "${text}" [${normaliseText(text)}] want ${ideas} got ${got}`);
    if (steps && JSON.stringify(gotSteps) !== JSON.stringify(steps)) bad.push(`STEPS "${text}" want ${steps} got ${gotSteps}`);
    if (!steps && gotSteps.length && !ideas.some((i) => pack.ideas[i].correct)) bad.push(`(info) step on non-correct "${text}" got ${gotSteps}`);
  }
  return bad;
};

it('fraction rules', () => expect(run(fractions, F)).toEqual([]));
it('buoyancy rules', () => expect(run(buoyancy, B)).toEqual([]));
it('area rules', () => expect(run(areaPerimeter, A)).toEqual([]));
it('teach replies', () => {
  const bad: string[] = [];
  for (const pack of [fractions, buoyancy, areaPerimeter]) {
    for (const [text, caught] of TEACH[pack.id]) {
      if (heuristicTeach(pack, text).caught !== caught) bad.push(`${pack.id} "${text}" [${normaliseText(text)}] want ${caught}`);
    }
    if (heuristicTeach(pack, pack.teach.planted.ar).caught || heuristicTeach(pack, pack.teach.planted.en).caught) bad.push(`${pack.id} planted accepted`);
  }
  expect(bad).toEqual([]);
});
it('samples map to exactly one intended idea', () => {
  const bad: string[] = [];
  for (const pack of [fractions, buoyancy, areaPerimeter]) {
    for (const s of pack.samples) {
      const a = extractRaw(pack, s.ar), e = extractRaw(pack, s.en);
      const ia = (a.ideas as { id: string }[]).map((i) => i.id), ie = (e.ideas as { id: string }[]).map((i) => i.id);
      process.stdout.write(`${pack.id} | ${s.en} | ar=${ia} steps=${(a.steps as { met: boolean }[]).map((x) => +x.met).join('')} | en=${ie} steps=${(e.steps as { met: boolean }[]).map((x) => +x.met).join('')}\n`);
      if (ia.join() !== ie.join() || ia.length > 1) bad.push(`${s.en}: ${ia} / ${ie}`);
    }
  }
  expect(bad).toEqual([]);
});
it('no rule or step fires on the question, and Noor never says answer words', () => {
  const bad: string[] = [];
  for (const pack of [fractions, buoyancy, areaPerimeter]) {
    for (const lang of ['ar', 'en'] as const) {
      const raw = extractRaw(pack, pack.question[lang]);
      if ((raw.ideas as unknown[]).length) bad.push(`${pack.id} question ${lang} idea ${JSON.stringify(raw.ideas)}`);
      const lines = [
        ...Object.entries(pack.noor).map(([k, v]) => [`noor.${k}`, v[lang]]),
        ['planted', pack.teach.planted[lang]], ['confused', pack.teach.confused[lang]],
        ...pack.experiments.flatMap((x) => [[`${x.id}.question`, x.question[lang]]]),
        ...pack.clarify.map((c) => [`clarify.${c.id}`, c.q[lang]]),
        ...pack.hints.slice(0, 3).map((h, i) => [`hint${i}`, h[lang]]),
      ];
      for (const [k, v] of lines) if (pack.answerWords.test(v)) bad.push(`${pack.id} ${lang} ${k}: ${v.match(pack.answerWords)?.[0]}`);
      if (!pack.answerWords.test(pack.hints[3][lang])) bad.push(`(info) ${pack.id} ${lang} hint3 has no answer words`);
    }
  }
  expect(bad).toEqual([]);
});
