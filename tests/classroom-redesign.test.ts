import { describe, expect, it } from 'vitest';
import { classroomJoinUrl } from '../src/flow/joinUrl';
import { getPack } from '../src/packs';
import { addParticipant, newRoom, screenView, studentOp, teacherOp } from '../src/brain/room';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { experimentConditions } from '../src/brain/world';
import { feasibility } from '../src/features/teacher/logic/planView';

const pack = getPack('condensation');
const settings = { pack: pack.id, lang: 'ar' as const, grade: 3, minutes: 45, resources: [], supervision: false, objective: null };

describe('live classroom setup', () => {
  it('uses a deliberate network origin and omits loopback QR links for real classrooms', () => {
    expect(classroomJoinUrl('ABC234', 'http://localhost:5173/')).toBeNull();
    expect(classroomJoinUrl('ABC234', 'http://127.1:5173/')).toBeNull();
    expect(classroomJoinUrl('ABC234', 'http://localhost:5173/', 'http://192.168.1.10:5173')).toBe('http://192.168.1.10:5173/#/join/ABC234');
    expect(classroomJoinUrl('ABC234', 'https://school.example/silsila/')).toBe('https://school.example/silsila/#/join/ABC234');
    expect(classroomJoinUrl('SAMPLE', 'http://localhost:5173/', undefined, true)).toBe('http://localhost:5173/#/join/SAMPLE');
    expect(classroomJoinUrl('ABC234', 'http://localhost:5173/', 'https://user:pass@example.com/')).toBeNull();
  });
  it('permits digital models without physical materials and enforces physical eligibility on approval', () => {
    expect(feasibility(pack, { ...settings, mode: 'digital' }).every((item) => item.reasons.length === 0)).toBe(true);
    const room = newRoom('ABC234', { ...settings, mode: 'physical' });
    expect(teacherOp(pack, room, { type: 'choose', experimentId: pack.experiments[0].id })).toEqual({ ok: false, error: 'bad_request' });
  });
  it('rejects a stale phase action and does not reopen independent predictions after a reveal', () => {
    const room = newRoom('ABC234', { ...settings, mode: 'digital' });
    const attempt = teacherOp(pack, room, { type: 'phase', phase: 'map', expectedPhase: 'explain' });
    expect(attempt).toEqual({ ok: false, error: 'wrong_phase' });
    const state = { ...room, meta: { ...room.meta, phase: 'observe' as const, experimentId: pack.experiments[0].id } };
    expect(teacherOp(pack, state, { type: 'phase', phase: 'predict', expectedPhase: 'observe' })).toEqual({ ok: false, error: 'wrong_phase' });
    expect(teacherOp(pack, state, { type: 'reject', experimentId: state.meta.experimentId })).toEqual({ ok: false, error: 'wrong_phase' });
    const approval = { ...state, meta: { ...state.meta, phase: 'approve' as const } };
    expect(teacherOp(pack, approval, { type: 'phase', phase: 'predict', expectedPhase: 'approve', expectedExperiment: null })).toEqual({ ok: false, error: 'wrong_phase' });
  });
  it('never labels a selection as a recommendation when there is no diagnostic evidence', () => {
    const room = newRoom('ABC234', { ...settings, mode: 'digital' });
    const state = { ...room, meta: { ...room.meta, phase: 'approve' as const } };
    const experimentId = pack.experiments[0].id;
    expect(teacherOp(pack, state, { type: 'choose', experimentId, source: 'recommended', expectedPhase: 'approve' })).toEqual({ ok: false, error: 'wrong_phase' });
    expect(teacherOp(pack, state, { type: 'choose', experimentId, source: 'manual', expectedPhase: 'approve' })).toMatchObject({ ok: true, data: { meta: { experimentId, approvalSource: 'manual' } } });
  });
  it('renders the same variant the learner modeled and refuses a duplicate initial answer', () => {
    const initial = newRoom('ABC234', { ...settings, mode: 'digital' });
    const joined = addParticipant(initial, 'learner', 'A');
    if (!joined.ok) throw new Error(joined.error);
    const room = { ...joined.data, meta: { ...joined.data.meta, phase: 'explain' as const } };
    const text = 'Water leaks out through the glass, but the glass keeps the blue dye inside.';
    const op = { type: 'explain' as const, text };
    const diagnosis = heuristicDiagnose(pack, text, { pack: pack.id, lang: 'en', previous: [] });
    const explained = studentOp(pack, room, 'learner', op, { diagnosis });
    if (!explained.ok) throw new Error(explained.error);
    expect(studentOp(pack, explained.data, 'learner', op, { diagnosis })).toEqual({ ok: false, error: 'locked' });
    const approved = teacherOp(pack, explained.data, { type: 'choose', experimentId: 'E_color' });
    if (!approved.ok) throw new Error(approved.error);
    expect(screenView(pack, approved.data).agg.result).toBeNull();
    const ran = teacherOp(pack, approved.data, { type: 'phase', phase: 'observe' });
    if (!ran.ok) throw new Error(ran.error);
    const result = screenView(pack, ran.data).agg.result?.byGroup[0];
    expect(result?.model.path).toBe('filters_dye');
    expect(result && pack.kidOutcome(result.model, experimentConditions(pack, 'E_color'))).toBe(result?.outcome);
  });
});
