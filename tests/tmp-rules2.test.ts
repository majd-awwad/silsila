import { it, expect } from 'vitest';
import { fractions } from '../src/packs/fractions';
import { buoyancy } from '../src/packs/buoyancy';
import { areaPerimeter } from '../src/packs/area-perimeter';
import { extractRaw } from '../src/brain/heuristic';
import { normaliseText } from '../src/brain/text';
import type { ConceptPack } from '../src/packs/types';
type Case = [string, string[], number[]?];
const F: Case[] = [
  ['الربع لانه قطعته اكبر', ['equal_parts']],
  ['الربع، عشان لما نقسم لاربعه حصتك اكبر', ['equal_parts']],
  ['one quarter, because fewer pieces so each piece is bigger', ['equal_parts'], [1]],
  ['التمن عشان رقمه اكبر', ['bigger_denominator']],
  ['لانه رقم التمن اكبر', ['bigger_denominator']],
  ['the eighth because eight is a bigger number', ['bigger_denominator']],
  ['كل الأرباع قد بعض', ['ignore_whole']],
  ['all quarters are the same', ['ignore_whole']],
  ['القطع مش مهم تكون متساوية', ['unequal_ok'], []],
  ['عادي لو القطع مش قد بعض', ['unequal_ok'], []],
  ['it is ok if the pieces are different sizes', ['unequal_ok']],
  ['القطع لازم تكون متساوية وإلا مش ربع', [], [0]],
  ['the pieces are not equal so it is not a quarter', []],
];
const B: Case[] = [
  ['لأنه تقيل بيغرق', ['heavy_sinks']],
  ['الكرة تقيلة فغرقت', ['heavy_sinks']],
  ['because it is heavy it sinks', ['heavy_sinks']],
  ['التقيل ما بيطفو', ['heavy_sinks']],
  ['heavy things cannot float', ['heavy_sinks']],
  ['الحديد ما بيطفو', ['material_only']],
  ['metal can never float', ['material_only']],
  ['الخشب بيطفو والحديد بيغرق', ['material_only']],
  ['المحرك بيدفعها لفوق', ['engine_holds']],
  ['it does not float because it is heavy', []],
];
const A: Case[] = [
  ['لا، ممكن مساحتهم غير', ['independent'], [2]],
  ['ممكن يكونوا بنفس المحيط وواحد مساحته أكبر', ['independent'], [2]],
  ['same perimeter but one can have more area', ['independent'], [2]],
  ['not always the same area', ['independent'], [2]],
  ['نفس السياج يعني نفس المكان', ['same_perimeter_same_area']],
  ['same fence means same space', ['same_perimeter_same_area']],
  ['نفس المحيط نفس المساحة', ['same_perimeter_same_area']],
  ['نفس المحيط يعني المساحة نفسها', ['same_perimeter_same_area']],
  ['same perimeter means the area is the same', ['same_perimeter_same_area']],
  ['آه دايماً نفس المساحة', ['same_perimeter_same_area']],
  ['yes they always have the same area', ['same_perimeter_same_area']],
  ['المساحة نفسها لانه محيطهم عشرين', ['same_perimeter_same_area']],
  ['السياج الأطول بيساع أكتر', ['bigger_perimeter_bigger_area']],
  ['a longer fence holds more', ['bigger_perimeter_bigger_area']],
  ['المحيط يعني المساحة', ['same_thing']],
  ['المساحة يعني المحيط', ['same_thing']],
];
const run = (pack: ConceptPack, cases: Case[]) => {
  const bad: string[] = [];
  for (const [text, ideas, steps] of cases) {
    const raw = extractRaw(pack, text);
    const got = (raw.ideas as { id: string }[]).map((i) => i.id).sort();
    const gotSteps = (raw.steps as { met: boolean }[]).map((s, i) => (s.met ? i : -1)).filter((i) => i >= 0);
    if (JSON.stringify(got) !== JSON.stringify([...ideas].sort())) bad.push(`IDEAS "${text}" [${normaliseText(text)}] want ${ideas} got ${got}`);
    if (steps && JSON.stringify(gotSteps) !== JSON.stringify(steps)) bad.push(`STEPS "${text}" want ${steps} got ${gotSteps}`);
  }
  return bad;
};
it('fraction rules 2', () => expect(run(fractions, F)).toEqual([]));
it('buoyancy rules 2', () => expect(run(buoyancy, B)).toEqual([]));
it('area rules 2', () => expect(run(areaPerimeter, A)).toEqual([]));
