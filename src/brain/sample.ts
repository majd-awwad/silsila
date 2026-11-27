/**
 * The sample classroom: built-in, clearly labelled example learners that run through exactly the same room rules
 * and offline diagnosis as a live class, entirely on this device. It exists so every classroom feature can be
 * shown without a network or other people. It is never mixed with real submissions.
 */
import type { Lang, RoomSettings, StudentOp, TeacherOp } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { RESOURCE_IDS } from '../packs/resources';
import { heuristicDiagnose, heuristicTransfer } from './heuristic';
import { correctIdeaId } from './normalise';
import { initialDiagnosis } from './records';
import { addParticipant, newRoom, studentOp, teacherOp } from './room';
import type { RoomData, RoomResult } from './room';
import { compare, experimentById, experimentConditions } from './world';

export const SAMPLE_CODE = 'SAMPLE';
const SAMPLE_SIZE = 12;
const isSample = (id: string) => id.startsWith('sample-');

export const sampleSettings = (pack: ConceptPack, lang: Lang): RoomSettings =>
  ({ pack: pack.id, lang, grade: Math.max(pack.grades[0], 4), minutes: 45, resources: [...RESOURCE_IDS], supervision: true, objective: null });

/** The authored sample sentences, split into those the offline rules read as complete and the others. */
function sentences(pack: ConceptPack, lang: Lang) {
  const all = pack.samples.map((s) => ({ text: s[lang], d: heuristicDiagnose(pack, s[lang], { pack: pack.id, lang, previous: [] }) }));
  return {
    correct: all.filter((x) => x.d.status === 'correct').map((x) => x.text),
    other: all.filter((x) => x.d.status !== 'correct').map((x) => x.text),
  };
}

const analyse = (pack: ConceptPack, lang: Lang, text: string) => heuristicDiagnose(pack, text, { pack: pack.id, lang, previous: [] });

export function sampleRoom(pack: ConceptPack, lang: Lang, now = Date.now()): RoomData {
  let data = newRoom(SAMPLE_CODE, sampleSettings(pack, lang), now, true);
  data = must(teacherOp(pack, data, { type: 'phase', phase: 'explain' }, now));
  const { correct, other } = sentences(pack, lang);
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const id = `sample-${i + 1}`;
    data = must(addParticipant(data, id, undefined, now + i));
    // most learners start with an idea to investigate; every fifth already explains it
    const pool = i % 5 === 4 && correct.length ? correct : other.length ? other : correct;
    const text = pool[(i * 3) % pool.length] ?? pool[0];
    data = must(studentOp(pack, data, id, { type: 'explain', text }, { diagnosis: analyse(pack, lang, text) }, now + 100 + i));
  }
  return data;
}

function must(r: RoomResult): RoomData {
  if (!r.ok) throw new Error('sample_room_' + r.error);
  return r.data;
}

/** After the teacher moves the sample class on, its example learners do that phase's task. */
function simulate(pack: ConceptPack, data: RoomData, now: number): RoomData {
  const lang = data.meta.settings.lang;
  const { correct } = sentences(pack, lang);
  const x = experimentById(pack, data.meta.experimentId);
  let next = data;
  const act = (id: string, op: StudentOp, analysis = {}) => {
    const r = studentOp(pack, next, id, op, analysis, now + 1);
    if (r.ok) next = r.data;
  };
  data.participants.filter((p) => isSample(p.id)).forEach((p, i) => {
    const first = initialDiagnosis(p.record);
    if (data.meta.phase === 'predict' && x) {
      const own = first?.model ? compare(pack, first.model, experimentConditions(pack, x.id)).kid : null;
      act(p.id, { type: 'predict', outcome: own && x.choices.includes(own) ? own : x.choices[i % x.choices.length] });
    } else if (data.meta.phase === 'revise' && first) {
      // example classroom outcome: some move to the full explanation, some keep their idea
      const moved = i % 3 !== 0 && correct.length;
      const text = moved ? correct[i % correct.length] : p.record.events.find((e) => e.type === 'explain')!.text;
      act(p.id, { type: 'revise', text }, { diagnosis: analyse(pack, lang, text) });
    } else if (data.meta.phase === 'transfer') {
      const full = i % 3 !== 0 && correct.length;
      const text = full ? correct[(i + 1) % correct.length] : p.record.events.find((e) => e.type === 'explain')!.text;
      const t = heuristicTransfer(pack, text);
      const check = pack.transfer.check;
      act(p.id, { type: 'transfer', text, choice: full ? check.correct : (check.correct + 1) % check.options.length }, { transfer: { steps: t.steps, source: t.source } });
    }
  });
  return next;
}

export function sampleTeacherOp(pack: ConceptPack, data: RoomData, op: TeacherOp, now = Date.now()): RoomResult {
  const r = teacherOp(pack, data, op, now);
  if (!r.ok || op.type !== 'phase') return r;
  return { ok: true, data: simulate(pack, r.data, now) };
}

export const sampleHasCorrect = (pack: ConceptPack): boolean => !!pack.ideas[correctIdeaId(pack)];
