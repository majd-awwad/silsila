/** The live classroom rules (src/brain/room.ts): who may do what in each phase, and what each screen may see. */
import { describe, expect, it } from 'vitest';
import { heuristicDiagnose, heuristicTransfer } from '../src/brain/heuristic';
import { normaliseDiagnosis } from '../src/brain/normalise';
import { eventsOf } from '../src/brain/records';
import {
  addParticipant, checkStudentOp, GAP_PHASES, MAX_PARTICIPANTS, newRoom, screenView, studentOp, studentView, teacherOp, teacherView,
} from '../src/brain/room';
import type { Analysis, RoomData, RoomResult } from '../src/brain/room';
import { sampleRoom, sampleSettings, sampleTeacherOp } from '../src/brain/sample';
import { experimentConditions } from '../src/brain/world';
import { PHASES } from '../src/contracts';
import type { Diagnosis, Phase, StudentOp, TeacherOp } from '../src/contracts';
import { PACK_LIST, getPack } from '../src/packs';
import type { ConceptPack } from '../src/packs/types';

const must = (r: RoomResult): RoomData => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const teach = (pack: ConceptPack, d: RoomData, op: TeacherOp) => must(teacherOp(pack, d, op));
const goto = (pack: ConceptPack, d: RoomData, phase: Phase) => teach(pack, d, { type: 'phase', phase });

const WORDS = ['private words of learner one', 'private words of learner two', 'private words of learner three'];

/** an explanation that holds one chosen idea, quoted from the text */
function diagnosisFor(pack: ConceptPack, text: string, ideaId: string | null): Diagnosis {
  return normaliseDiagnosis(
    pack,
    { relevance: ideaId ? 'answer' : 'unclear', ideas: ideaId ? [{ id: ideaId, evidence: text }] : [], steps: [] },
    text, { pack: pack.id, lang: 'en', previous: [] }, { source: 'fallback' },
  );
}
const wrongIdeas = (pack: ConceptPack) => Object.keys(pack.ideas).filter((id) => !pack.ideas[id].correct);

/** three learners with recognisable aliases and ids; the third never explains */
function classroom(pack: ConceptPack): RoomData {
  let d = newRoom('ABC234', { ...sampleSettings(pack, 'en') });
  for (const i of [1, 2, 3]) d = must(addParticipant(d, `pid-secret-${i}`, `AliasSecret${i}`));
  return d;
}
const explain = (pack: ConceptPack, d: RoomData, i: number, ideaId: string | null): RoomData =>
  must(studentOp(pack, d, `pid-secret-${i}`, { type: 'explain', text: WORDS[i - 1] }, { diagnosis: diagnosisFor(pack, WORDS[i - 1], ideaId) }));

describe.each(PACK_LIST.map((p) => [p.id, p] as const))('classroom rules: %s', (_id, pack) => {
  const x = pack.experiments[0];

  it('walks every phase without showing anything before its time', () => {
    let d = goto(pack, classroom(pack), 'explain');
    d = explain(pack, d, 1, wrongIdeas(pack)[0]);
    d = explain(pack, d, 2, wrongIdeas(pack)[1]);

    for (const phase of PHASES) {
      if (phase === 'approve') d = teach(pack, d, { type: 'choose', experimentId: x.id });
      d = goto(pack, d, phase);
      const at = PHASES.indexOf(phase);
      const from = (p: Phase) => at >= PHASES.indexOf(p);
      if (phase === 'predict') {
        d = must(studentOp(pack, d, 'pid-secret-1', { type: 'predict', outcome: x.choices[0] }));
        d = must(studentOp(pack, d, 'pid-secret-2', { type: 'predict', outcome: x.choices[1] }));
      }

      const screen = screenView(pack, d);
      const mine = studentView(pack, d, 'pid-secret-1')!;
      const unexplained = studentView(pack, d, 'pid-secret-3')!;

      for (const v of [screen, mine, unexplained]) {
        expect(v.meta.experimentId, `${phase} experiment`).toBe(from('predict') ? x.id : null);
        expect(v.meta.rejected).toEqual([]);
        expect(!!v.agg.predictions, `${phase} predictions`).toBe(from('reveal'));
        expect(!!v.agg.result, `${phase} result`).toBe(from('observe'));
        expect(!!v.agg.transitions, `${phase} transitions`).toBe(phase === 'insight' && v !== unexplained);
        if (phase === 'insight' && v === unexplained) expect(v.agg.transitions).toBeNull();
      }
      expect(!!screen.agg.groups, `${phase} groups`).toBe(from('map'));
      expect(!!mine.agg.groups).toBe(from('map'));
      expect(unexplained.agg.groups, 'ideas hidden from a learner who has not explained').toBeNull();
      expect(unexplained.agg.revisedGroups).toBeNull();
      // classmates' words appear only during discussion
      expect((screen.agg.groups ?? []).some((g) => g.quotes.length > 0), `${phase} quotes`).toBe(phase === 'discuss');

      // the shared screen is anonymous
      const wall = JSON.stringify(screen);
      expect(wall).not.toContain('AliasSecret');
      expect(wall).not.toContain('pid-secret');
      // a learner sees their own record only
      const own = JSON.stringify(mine);
      for (const other of ['AliasSecret2', 'AliasSecret3', 'pid-secret-2', 'pid-secret-3']) expect(own).not.toContain(other);
      if (phase !== 'discuss') expect(own).not.toContain(WORDS[1]);
      // no observed result in a learner's own log before the teacher shows it
      expect(eventsOf(mine.me.record, 'observe').length > 0, `${phase} own result`).toBe(from('observe'));
    }
    // only the teacher view has names
    expect(JSON.stringify(teacherView(d))).toContain('AliasSecret2');
  });

  it('allows each learner action only in its phase', () => {
    let d = goto(pack, classroom(pack), 'explain');
    d = explain(pack, d, 1, wrongIdeas(pack)[0]);
    d = teach(pack, d, { type: 'choose', experimentId: x.id });
    const ops: [StudentOp, Phase[]][] = [
      [{ type: 'explain', text: 'a' }, ['explain', 'map', 'recommend', 'approve']],
      [{ type: 'predict', outcome: x.choices[0] }, ['predict']],
      [{ type: 'revise', text: 'a' }, ['revise']],
      [{ type: 'transfer', text: 'a', choice: 0 }, ['transfer']],
    ];
    for (const phase of PHASES) {
      const at = goto(pack, d, phase);
      // learner 3 has not explained yet, so nothing is locked for them
      for (const [op, allowed] of ops) {
        expect(checkStudentOp(pack, at, 'pid-secret-3', op), `${op.type} in ${phase}`).toBe(allowed.includes(phase) ? null : 'wrong_phase');
      }
    }
  });

  it('needs an approved experiment before predictions', () => {
    const d = goto(pack, classroom(pack), 'approve');
    for (const phase of ['predict', 'reveal', 'experiment', 'observe', 'discuss'] as const) {
      expect(teacherOp(pack, d, { type: 'phase', phase })).toEqual({ ok: false, error: 'wrong_phase' });
    }
    expect(teacherOp(pack, d, { type: 'choose', experimentId: 'nope' })).toEqual({ ok: false, error: 'bad_request' });
  });

  it('locks the first prediction and refuses outcomes that were not offered', () => {
    let d = teach(pack, classroom(pack), { type: 'choose', experimentId: x.id });
    d = goto(pack, d, 'predict');
    expect(checkStudentOp(pack, d, 'pid-secret-1', { type: 'predict', outcome: 'not-offered' })).toBe('bad_request');
    d = must(studentOp(pack, d, 'pid-secret-1', { type: 'predict', outcome: x.choices[0] }));
    expect(studentOp(pack, d, 'pid-secret-1', { type: 'predict', outcome: x.choices[1] })).toEqual({ ok: false, error: 'locked' });
    d = goto(pack, d, 'observe');
    const seen = eventsOf(d.participants[0].record, 'observe')[0];
    expect(seen.predicted).toBe(x.choices[0]);
    expect(seen.real).toBe(pack.realOutcome(experimentConditions(pack, x.id)));
  });

  it('handles late joiners', () => {
    let d = goto(pack, classroom(pack), 'explain');
    d = explain(pack, d, 1, wrongIdeas(pack)[0]);
    d = goto(pack, d, 'map');
    // an understood start is locked once the map is up; an unclear one may still be clarified; newcomers may explain
    expect(checkStudentOp(pack, d, 'pid-secret-1', { type: 'explain', text: 'again' })).toBe('locked');
    d = explain(pack, d, 2, null);
    expect(checkStudentOp(pack, d, 'pid-secret-2', { type: 'explain', text: 'clearer' })).toBeNull();
    d = explain(pack, d, 2, wrongIdeas(pack)[0]);
    expect(eventsOf(d.participants[1].record, 'explain').map((e) => e.phase)).toEqual(['initial', 'clarify']);

    d = goto(pack, teach(pack, d, { type: 'choose', experimentId: x.id }), 'predict');
    d = must(addParticipant(d, 'late', 'Late'));
    expect(checkStudentOp(pack, d, 'late', { type: 'explain', text: 'a' })).toBe('wrong_phase');
    expect(checkStudentOp(pack, d, 'late', { type: 'predict', outcome: x.choices[0] })).toBeNull();
    expect(studentView(pack, d, 'late')!.agg.groups).toBeNull();
  });

  it('removes learners and closes', () => {
    let d = goto(pack, classroom(pack), 'explain');
    d = teach(pack, d, { type: 'remove', participantId: 'pid-secret-1' });
    expect(studentView(pack, d, 'pid-secret-1')).toBeNull();
    expect(checkStudentOp(pack, d, 'pid-secret-1', { type: 'explain', text: 'a' })).toBe('forbidden');
    d = teach(pack, d, { type: 'close' });
    expect(addParticipant(d, 'new', undefined)).toEqual({ ok: false, error: 'room_closed' });
    expect(checkStudentOp(pack, d, 'pid-secret-2', { type: 'explain', text: 'a' })).toBe('room_closed');
    expect(teacherOp(pack, d, { type: 'phase', phase: 'map' })).toEqual({ ok: false, error: 'room_closed' });
  });

  it('runs the labelled sample classroom through a whole lesson', () => {
    let d = sampleRoom(pack, 'ar');
    expect(d.meta.sample).toBe(true);
    for (const phase of PHASES) {
      if (phase === 'approve') d = must(sampleTeacherOp(pack, d, { type: 'choose', experimentId: x.id }));
      d = must(sampleTeacherOp(pack, d, { type: 'phase', phase }));
    }
    const wall = screenView(pack, d);
    expect(wall.agg.participants).toBeGreaterThan(5);
    expect(wall.agg.revised).toBeGreaterThan(0);
    expect(wall.agg.transferred).toBeGreaterThan(0);
  });
});

describe('room limits and aliases', () => {
  const pack = getPack('condensation');
  it('holds a bounded number of learners with unique, harmless aliases', () => {
    let d = newRoom('ABC234', sampleSettings(pack, 'ar'));
    for (let i = 0; i < MAX_PARTICIPANTS; i++) d = must(addParticipant(d, `p${i}`, i < 2 ? '<b>سارة</b>' : undefined));
    expect(new Set(d.participants.map((p) => p.alias)).size).toBe(MAX_PARTICIPANTS);
    expect(d.participants.every((p) => !/[<>]/.test(p.alias) && p.alias.length > 0)).toBe(true);
    expect(addParticipant(d, 'one-more', undefined)).toEqual({ ok: false, error: 'room_full' });
  });
  it('never accepts a learner’s explanation without the server’s diagnosis', () => {
    const d = goto(pack, classroom(pack), 'explain');
    const forged = { diagnosis: undefined } as Analysis;
    expect(studentOp(pack, d, 'pid-secret-1', { type: 'explain', text: 'a' }, forged)).toEqual({ ok: false, error: 'bad_request' });
  });
  it('records a transfer once, scoring the check question in code', () => {
    const d = goto(pack, classroom(pack), 'transfer');
    const op: StudentOp = { type: 'transfer', text: 'a new case', choice: pack.transfer.check.correct };
    const done = must(studentOp(pack, d, 'pid-secret-1', op, { transfer: heuristicTransfer(pack, op.text) }));
    expect(eventsOf(done.participants[0].record, 'transfer')[0].choiceCorrect).toBe(true);
    expect(checkStudentOp(pack, done, 'pid-secret-1', op)).toBe('locked');
  });
});

describe('learning gap recovery inside the room', () => {
  const pack = getPack('condensation');
  const pre = pack.prerequisites.find((p) => p.suspect.ideas.length)!;
  const wrongChoice = (q: { correct: number; options: unknown[] }) => (q.correct + 1) % q.options.length;
  const answer = (questionId: string, choice: number): StudentOp => ({ type: 'prereq', prereqId: pre.id, questionId, choice });
  const remedy: StudentOp = { type: 'remedy', prereqId: pre.id };

  const started = () => goto(pack, explain(pack, goto(pack, classroom(pack), 'explain'), 1, pre.suspect.ideas[0]), 'map');

  it('goes check → remedy → recheck, in order, once each, with no analysis argument', () => {
    let d = started();
    const me = 'pid-secret-1';
    expect(checkStudentOp(pack, d, me, remedy)).toBe('locked');
    expect(checkStudentOp(pack, d, me, answer(pre.recheck.id, 0))).toBe('wrong_phase');
    d = must(studentOp(pack, d, me, answer(pre.verify[0].id, wrongChoice(pre.verify[0]))));
    expect(checkStudentOp(pack, d, me, answer(pre.verify[0].id, 0))).toBe('locked');
    d = must(studentOp(pack, d, me, remedy));
    d = must(studentOp(pack, d, me, answer(pre.recheck.id, pre.recheck.correct)));
    expect(eventsOf(d.participants[0].record, 'prereq').map((e) => [e.phase, e.correct])).toEqual([['verify', false], ['recheck', true]]);
    expect(checkStudentOp(pack, d, me, remedy)).toBe('locked');
  });

  it('is offered only in the waiting phases, for a gap that is actually suspected', () => {
    const d = started();
    for (const phase of PHASES) {
      const at = { ...d, meta: { ...d.meta, phase } };
      const expected = GAP_PHASES.includes(phase) ? null : 'wrong_phase';
      expect(checkStudentOp(pack, at, 'pid-secret-1', answer(pre.verify[0].id, 0)), phase).toBe(expected);
    }
    // learner 3 never explained: nothing is suspected
    expect(checkStudentOp(pack, d, 'pid-secret-3', answer(pre.verify[0].id, 0))).toBe('bad_request');
    expect(checkStudentOp(pack, d, 'pid-secret-1', answer('no-such-question', 0))).toBe('bad_request');
    expect(checkStudentOp(pack, d, 'pid-secret-1', { type: 'remedy', prereqId: 'no-such-gap' })).toBe('bad_request');
  });
});

describe('classroom edge cases', () => {
  const pack = getPack('condensation');
  const [x, y] = pack.experiments;
  const observed = () => {
    let d = goto(pack, classroom(pack), 'explain');
    d = explain(pack, d, 1, wrongIdeas(pack)[0]);
    d = goto(pack, teach(pack, d, { type: 'choose', experimentId: x.id }), 'predict');
    return goto(pack, d, 'observe');
  };

  it('choosing another experiment after «observe» must not show its result before anyone predicts', () => {
    const r = teacherOp(pack, observed(), { type: 'choose', experimentId: y.id });
    if (r.ok) expect(screenView(pack, r.data).agg.result).toBeNull();
  });

  it('a learner who never explained must not see classmates’ ideas inside the result', () => {
    expect(studentView(pack, observed(), 'pid-secret-3')!.agg.result?.byGroup ?? []).toEqual([]);
  });

  it('a result already shown must not be «predicted» afterwards', () => {
    const d = goto(pack, observed(), 'predict');
    expect(checkStudentOp(pack, d, 'pid-secret-3', { type: 'predict', outcome: x.choices[0] })).not.toBeNull();
  });

  it('the version changes when a note is rewritten with the same length', async () => {
    const { versionOf } = await import('../src/brain/room');
    const a = must(studentOp(pack, observed(), 'pid-secret-1', { type: 'observe', note: 'aaa' }));
    const b = must(studentOp(pack, a, 'pid-secret-1', { type: 'observe', note: 'bbb' }));
    expect(versionOf(b)).not.toBe(versionOf(a));
  });

  it('offline diagnosis of a sample sentence runs in the room (sanity)', () => {
    const d = goto(pack, classroom(pack), 'explain');
    const text = pack.samples[0].en;
    const r = studentOp(pack, d, 'pid-secret-1', { type: 'explain', text }, { diagnosis: heuristicDiagnose(pack, text, { pack: pack.id, lang: 'en', previous: [] }) });
    expect(r.ok).toBe(true);
  });
});
