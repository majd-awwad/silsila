import { describe, expect, it } from 'vitest';
import { interventionGroups } from '../src/brain/classInsights';
import { replaySteps } from '../src/brain/evidence';
import { addEvent, eventsOf, initialDiagnosis } from '../src/brain/records';
import { teacherView } from '../src/brain/room';
import { sampleRoom, sampleTeacherOp } from '../src/brain/sample';
import { buildReport, reportCSV } from '../src/features/teacher/logic/report';
import { PACK_LIST } from '../src/packs';

describe.each(PACK_LIST.map((pack) => [pack.id, pack] as const))('teacher tools for %s', (_id, pack) => {
  it('states what has been checked against the school curriculum', () => {
    expect(pack.curriculum.note.ar.length).toBeGreaterThan(5);
    expect(pack.curriculum.note.en.length).toBeGreaterThan(5);
    if (pack.id === 'condensation' || pack.id === 'evaporation') expect(pack.curriculum.verified).toBe(true);
  });
  it('suggests deterministic temporary groups based on learner evidence', () => {
    const records = sampleRoom(pack, 'en').participants.map((p) => p.record);
    const groups = interventionGroups(pack, records);
    expect(groups).toEqual(interventionGroups(pack, records));
    const assigned = groups.flatMap((g) => g.members);
    expect(new Set(assigned).size).toBe(assigned.length);
    const understood = records.filter((r) => initialDiagnosis(r)?.status === 'correct').map((r) => r.id);
    for (const group of groups) {
      expect(group.move.en.length).toBeGreaterThan(5);
      if (group.kind === 'idea') expect(group.members.some((m) => understood.includes(m))).toBe(false);
      if (group.experimentId) expect(pack.experiments.some((test) => test.id === group.experimentId)).toBe(true);
    }
  });
  it('builds the replay and export from observed class evidence', () => {
    const advance = (data: ReturnType<typeof sampleRoom>, op: Parameters<typeof sampleTeacherOp>[2]) => {
      const answer = sampleTeacherOp(pack, data, op);
      if (!answer.ok) throw new Error(answer.error);
      return answer.data;
    };
    let room = advance(sampleRoom(pack, 'en'), { type: 'choose', experimentId: pack.experiments[0].id });
    for (const phase of ['predict', 'observe', 'revise', 'transfer', 'insight'] as const) room = advance(room, { type: 'phase', phase });
    const record = room.participants[0].record;
    const assisted = addEvent(record, { type: 'assist', level: 4, at: Date.now() });
    const replay = replaySteps(pack, assisted);
    expect(replay[0].kind).toBe('explain');
    expect(replay.filter((s) => s.kind === 'test')).toHaveLength(eventsOf(record, 'observe').length);
    expect(replay.some((s) => s.kind === 'help')).toBe(true);
    const report = buildReport(pack, teacherView(room), null, 'en');
    expect(report.sample).toBe(true);
    expect(report.counts.participants).toBe(room.participants.length);
    expect(reportCSV(report)).toContain(room.participants[0].alias);
    expect(reportCSV(report)).not.toContain(room.participants[0].id);
  });
});
