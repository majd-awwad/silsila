/**
 * The live classroom as pure rules: what teachers and learners may do in each phase, and what each screen may
 * see. The server (api/room) adds storage, authentication and rate limits around these functions, and the
 * clearly-labelled sample classroom runs the very same functions on the device.
 *
 * Gating rules (tested): learners never see classmates' ideas before the map is revealed on screen and they have
 * explained; nobody except the teacher sees the chosen experiment before «predict», the prediction tally before
 * «reveal», or the result before «observe»; screen and learner views never carry aliases or learner ids.
 */
import type {
  Aggregates, Diagnosis, HypothesisGroup, Lang, LearnerRecord, Phase, RoomError, RoomMeta, RoomParticipant, RoomSettings,
  RoomView, ScreenRoomView, StepEvidence, StudentOp, StudentRoomView, TeacherOp, TeacherRoomView,
} from '../contracts';
import { PHASES } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { gapsOf } from './evidence';
import { plan, rejectReasons } from './planner';
import { correctIdeaId } from './normalise';
import { addEvent, autoInitialDiagnosis, eventsOf, groupKey, hypothesesOf, initialDiagnosis, lastEvent, newRecord, revisedDiagnosis } from './records';
import { compare, experimentById, experimentConditions } from './world';

export interface RoomData { meta: RoomMeta; participants: RoomParticipant[] }
export type RoomResult = { ok: true; data: RoomData } | { ok: false; error: RoomError };

export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_PARTICIPANTS = 60;
export const PRESENCE_PULSE_MS = 15_000;
export const PRESENCE_WINDOW_MS = 35_000;
const MAX_EXPLAINS = 6;

export const phaseIndex = (p: Phase) => PHASES.indexOf(p);
export const atLeast = (p: Phase, min: Phase) => phaseIndex(p) >= phaseIndex(min);

const ok = (data: RoomData): RoomResult => ({ ok: true, data });
const fail = (error: RoomError): RoomResult => ({ ok: false, error });

export function newRoom(code: string, settings: RoomSettings, now = Date.now(), sample = false): RoomData {
  return {
    meta: {
      code, settings, createdAt: now, expiresAt: now + ROOM_TTL_MS, phase: 'lobby', phaseAt: now,
      experimentId: null, rejected: [], done: [], closed: false, sample,
    },
    participants: [],
  };
}

export const ALIASES: Record<Lang, string[]> = {
  ar: ['نجمة', 'قمر', 'غيمة', 'زيتونة', 'برق', 'نسمة', 'شمس', 'موجة', 'سنبلة', 'لؤلؤة', 'ريحانة', 'ياسمينة', 'نخلة', 'فراشة', 'حبقة', 'مطر', 'ندى', 'تينة', 'رمّانة', 'صنوبرة'],
  en: ['Star', 'Moon', 'Cloud', 'Olive', 'Spark', 'Breeze', 'Sun', 'Wave', 'Wheat', 'Pearl', 'Basil', 'Jasmine', 'Palm', 'Butterfly', 'Mint', 'Rain', 'Dew', 'Fig', 'Anar', 'Pine'],
};

export function uniqueAlias(data: RoomData, wanted: string | undefined, lang: Lang): string {
  const taken = new Set(data.participants.map((p) => p.alias));
  const pool = ALIASES[lang];
  const base = (wanted ?? '').replace(/[<>{}\u0000-\u001f]/g, '').trim().slice(0, 20)
    || pool.find((a) => !taken.has(a)) || pool[data.participants.length % pool.length];
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`)) return `${base} ${i}`;
}

export function addParticipant(data: RoomData, id: string, alias: string | undefined, now = Date.now()): RoomResult {
  if (data.meta.closed) return fail('room_closed');
  if (data.participants.length >= MAX_PARTICIPANTS) return fail('room_full');
  const { settings } = data.meta;
  const name = uniqueAlias(data, alias, settings.lang);
  const record = newRecord({ id, pack: settings.pack, alias: name, grade: settings.grade, lang: settings.lang, classCode: data.meta.code, sample: data.meta.sample, at: now });
  return ok({ ...data, participants: [...data.participants, { id, alias: name, joinedAt: now, record }] });
}

const EXPLAIN_PHASES: Phase[] = ['explain', 'map', 'recommend', 'approve'];
export const GAP_PHASES: Phase[] = ['map', 'recommend', 'approve', 'reveal', 'discuss', 'insight'];

/** May this learner do this now? Checked before any (paid) language-model call. */
export function checkStudentOp(pack: ConceptPack, data: RoomData, participantId: string, op: StudentOp): RoomError | null {
  const { meta } = data;
  if (meta.closed) return 'room_closed';
  const p = data.participants.find((x) => x.id === participantId);
  if (!p) return 'forbidden';
  const r = p.record;
  const x = experimentById(pack, meta.experimentId);
  switch (op.type) {
    case 'explain': {
      if (!EXPLAIN_PHASES.includes(meta.phase)) return 'wrong_phase';
      if (eventsOf(r, 'explain').some((event) => event.phase !== 'revise' && event.text.trim() === op.text.trim())) return 'locked';
      const d = initialDiagnosis(r);
      // once the map is on screen, only learners who are not yet understood may still change their start
      if (meta.phase !== 'explain' && d && d.status !== 'insufficient') return 'locked';
      return eventsOf(r, 'explain').length >= MAX_EXPLAINS ? 'locked' : null;
    }
    case 'predict':
      if (meta.phase !== 'predict' || !x) return 'wrong_phase';
      if (meta.done.includes(x.id)) return 'locked';
      if (!x.choices.includes(op.outcome)) return 'bad_request';
      return eventsOf(r, 'predict').some((e) => e.experimentId === x.id) ? 'locked' : null;
    case 'observe':
      return (meta.phase === 'observe' || meta.phase === 'discuss') && lastEvent(r, 'observe') ? null : 'wrong_phase';
    case 'revise': {
      if (meta.phase !== 'revise') return 'wrong_phase';
      const revisions = eventsOf(r, 'explain').filter((event) => event.phase === 'revise');
      return revisions.length >= 3 || revisions.some((event) => event.text.trim() === op.text.trim()) ? 'locked' : null;
    }
    case 'transfer':
      if (meta.phase !== 'transfer') return 'wrong_phase';
      return eventsOf(r, 'transfer').length ? 'locked' : null;
    case 'prereq':
    case 'remedy': {
      // foundation checks fill the waiting moments, never the private explain/predict/revise tasks
      if (!GAP_PHASES.includes(meta.phase)) return 'wrong_phase';
      const gap = gapsOf(pack, r).find((g) => g.id === op.prereqId);
      const pre = pack.prerequisites.find((x) => x.id === op.prereqId);
      if (!gap || !pre || gap.status === 'not_suspected') return 'bad_request';
      if (op.type === 'remedy') return gap.status === 'confirmed' || gap.status === 'persisting' ? null : 'locked';
      const phase = pre.recheck.id === op.questionId ? 'recheck' : pre.verify.some((q) => q.id === op.questionId) ? 'verify' : null;
      if (!phase) return 'bad_request';
      if (phase === 'recheck' && !eventsOf(r, 'remedy').some((e) => e.prereqId === op.prereqId)) return 'wrong_phase';
      return gap.answers.some((a) => a.questionId === op.questionId && a.phase === phase) ? 'locked' : null;
    }
  }
}

/** What the server worked out for this operation (learners cannot supply their own diagnosis). */
export interface Analysis { diagnosis?: Diagnosis; transfer?: { steps: StepEvidence[]; source: 'ai' | 'fallback' } }

export function studentOp(pack: ConceptPack, data: RoomData, participantId: string, op: StudentOp, analysis: Analysis = {}, now = Date.now()): RoomResult {
  const error = checkStudentOp(pack, data, participantId, op);
  if (error) return fail(error);
  const update = (f: (r: LearnerRecord) => LearnerRecord): RoomResult =>
    ok({ ...data, participants: data.participants.map((p) => (p.id === participantId ? { ...p, record: f(p.record) } : p)) });
  const x = experimentById(pack, data.meta.experimentId);
  switch (op.type) {
    case 'explain':
    case 'revise': {
      const d = analysis.diagnosis;
      if (!d) return fail('bad_request');
      return update((r) => {
        const phase = op.type === 'revise' ? 'revise' : initialDiagnosis(r)?.status === 'insufficient' ? 'clarify' : 'initial';
        return addEvent(r, { type: 'explain', at: now, phase, text: op.text, diagnosis: d });
      });
    }
    case 'predict':
      return update((r) => addEvent(r, { type: 'predict', at: now, experimentId: x!.id, cond: experimentConditions(pack, x!.id), outcome: op.outcome }));
    case 'observe':
      return update((r) => {
        const i = r.events.map((e) => e.type).lastIndexOf('observe');
        return { ...r, events: r.events.map((e, j) => (j === i && e.type === 'observe' ? { ...e, note: op.note } : e)) };
      });
    case 'prereq': {
      const pre = pack.prerequisites.find((p) => p.id === op.prereqId)!;
      const recheck = pre.recheck.id === op.questionId;
      const question = recheck ? pre.recheck : pre.verify.find((q) => q.id === op.questionId)!;
      return update((r) => addEvent(r, { type: 'prereq', at: now, prereqId: pre.id, questionId: question.id, correct: op.choice === question.correct, phase: recheck ? 'recheck' : 'verify' }));
    }
    case 'remedy':
      return update((r) => addEvent(r, { type: 'remedy', at: now, prereqId: op.prereqId }));
    case 'transfer': {
      const a = analysis.transfer;
      if (!a) return fail('bad_request');
      return update((r) => addEvent(r, {
        type: 'transfer', at: now, text: op.text, steps: a.steps, source: a.source,
        choice: op.choice, choiceCorrect: op.choice === null ? null : op.choice === pack.transfer.check.correct,
      }));
    }
  }
}

/** When the teacher shows the result, every learner's log gets what happened next to what they expected. */
function recordObservation(pack: ConceptPack, data: RoomData, experimentId: string, now: number): RoomData {
  const cond = experimentConditions(pack, experimentId);
  const real = pack.realOutcome(cond);
  return {
    meta: { ...data.meta, done: [...data.meta.done.filter((d) => d !== experimentId), experimentId] },
    participants: data.participants.map((p) => {
      const r = p.record;
      if (eventsOf(r, 'observe').some((e) => e.experimentId === experimentId)) return p;
      const prediction = eventsOf(r, 'predict').filter((e) => e.experimentId === experimentId).at(-1);
      const model = initialDiagnosis(r)?.model ?? null;
      if (!prediction && !model) return p;
      return {
        ...p,
        record: addEvent(r, {
          type: 'observe', at: now, experimentId, cond, real, note: '',
          predicted: prediction?.outcome ?? null, hypothesis: model ? compare(pack, model, cond).kid : null,
        }),
      };
    }),
  };
}

export function teacherOp(pack: ConceptPack, data: RoomData, op: TeacherOp, now = Date.now()): RoomResult {
  const { meta } = data;
  if (meta.closed) return fail('room_closed');
  if ('expectedPhase' in op && op.expectedPhase !== undefined && op.expectedPhase !== meta.phase) return fail('wrong_phase');
  switch (op.type) {
    case 'phase': {
      if (op.expectedExperiment !== undefined && op.expectedExperiment !== meta.experimentId) return fail('wrong_phase');
      if (op.expectedPhase && phaseIndex(op.phase) !== phaseIndex(meta.phase) + 1 && !(meta.phase === 'approve' && op.phase === 'revise' && !meta.experimentId)) return fail('wrong_phase');
      // the shared experiment must be approved by the teacher before learners are asked to predict
      if (atLeast(op.phase, 'predict') && !atLeast(op.phase, 'revise') && !meta.experimentId) return fail('wrong_phase');
      let next: RoomData = { ...data, meta: { ...meta, phase: op.phase, phaseAt: now } };
      if (op.phase === 'observe' && meta.experimentId) next = recordObservation(pack, next, meta.experimentId, now);
      return ok(next);
    }
    case 'choose': {
      const experiment = experimentById(pack, op.experimentId);
      if (!experiment) return fail('bad_request');
      if (meta.settings.mode && rejectReasons(experiment, { ...meta.settings, exclude: [] }).length) return fail('bad_request');
      if (op.expectedPhase && !['recommend', 'approve'].includes(meta.phase)) return fail('wrong_phase');
      const recommended = op.source === 'recommended' && plan(pack, hypothesesOf(pack, data.participants.map((person) => person.record)), {
        ...meta.settings, exclude: [...meta.rejected, ...meta.done],
      }).recommended?.id === op.experimentId;
      if (op.source === 'recommended' && !recommended) return fail('wrong_phase');
      const phase = meta.experimentId !== op.experimentId && atLeast(meta.phase, 'predict') ? 'approve' : meta.phase;
      return ok({ ...data, meta: { ...meta, phase, experimentId: op.experimentId, approvalSource: recommended ? 'recommended' : 'manual', rejected: meta.rejected.filter((x) => x !== op.experimentId), phaseAt: now } });
    }
    case 'reject':
      if (!experimentById(pack, op.experimentId)) return fail('bad_request');
      if (op.experimentId === meta.experimentId && atLeast(meta.phase, 'predict')) return fail('wrong_phase');
      return ok({ ...data, meta: { ...meta, rejected: [...new Set([...meta.rejected, op.experimentId])], experimentId: meta.experimentId === op.experimentId ? null : meta.experimentId, phaseAt: now } });
    case 'remove':
      return ok({ ...data, participants: data.participants.filter((p) => p.id !== op.participantId) });
    case 'review': {
      const person = data.participants.find((p) => p.id === op.participantId);
      const auto = person && autoInitialDiagnosis(person.record);
      if (!person || !auto) return fail('bad_request');
      const correct = correctIdeaId(pack);
      if (op.outcome === 'idea' && (!op.ideaId || !Object.hasOwn(pack.ideas, op.ideaId) || op.ideaId === correct)) return fail('bad_request');
      const event = { type: 'review' as const, at: now, outcome: op.outcome, ...(op.outcome === 'idea' ? { ideaId: op.ideaId } : {}), auto: { status: auto.status, ideas: auto.ideas.map((i) => i.id) } };
      return ok({ ...data, participants: data.participants.map((p) => (p.id === op.participantId ? { ...p, record: addEvent(p.record, event) } : p)) });
    }
    case 'close':
      return ok({ ...data, meta: { ...meta, closed: true, phaseAt: now } });
  }
}

/* ───────────────────────── views ───────────────────────── */

const clip = (s: string) => (s.length > 120 ? s.slice(0, 118) + '…' : s);

export function groupsOf(pack: ConceptPack, records: LearnerRecord[], which: 'initial' | 'revised', withQuotes: boolean): HypothesisGroup[] {
  const map = new Map<string, HypothesisGroup>();
  for (const r of records) {
    const d = which === 'initial' ? initialDiagnosis(r) : revisedDiagnosis(r);
    const key = groupKey(pack, d);
    let g = map.get(key);
    if (!g) {
      const ideas = key.includes('+') || (d && (d.status === 'misconception' || d.status === 'multiple')) ? key.split('+') : [];
      g = { key, ideas, status: d?.status ?? 'waiting', count: 0, quotes: [] };
      map.set(key, g);
    }
    g.count++;
    if (withQuotes && d && g.quotes.length < 3) {
      const quote = d.ideas[0]?.evidence || d.steps.find((s) => s.met)?.evidence;
      if (quote) g.quotes.push(clip(quote));
    }
  }
  // sorted by size then key, never by who joined first
  return [...map.values()].map((g) => ({ ...g, quotes: [...g.quotes].sort() })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function transitionsOf(pack: ConceptPack, records: LearnerRecord[]): { from: string; to: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const from = initialDiagnosis(r);
    if (!from) continue;
    const to = revisedDiagnosis(r);
    const k = `${groupKey(pack, from)}→${to ? groupKey(pack, to) : 'waiting'}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([k, count]) => ({ from: k.split('→')[0], to: k.split('→')[1], count })).sort((a, b) => b.count - a.count);
}

export function aggregates(pack: ConceptPack, data: RoomData): Aggregates {
  const { meta } = data;
  const records = data.participants.map((p) => p.record);
  const x = meta.experimentId;
  const count = (f: (r: LearnerRecord) => boolean) => records.filter(f).length;
  const predictions = new Map<string, number>();
  if (x) for (const r of records) {
    const e = eventsOf(r, 'predict').filter((p) => p.experimentId === x).at(-1);
    if (e) predictions.set(e.outcome, (predictions.get(e.outcome) ?? 0) + 1);
  }
  let result: Aggregates['result'] = null;
  if (x && meta.done.includes(x) && atLeast(meta.phase, 'observe')) {
    const cond = experimentConditions(pack, x);
    const byGroup = groupsOf(pack, records, 'initial', false).flatMap((g) => {
      const rec = records.find((r) => groupKey(pack, initialDiagnosis(r)) === g.key);
      const model = rec ? initialDiagnosis(rec)?.model : null;
      if (!model) return [];
      const c = compare(pack, model, cond);
      return [{ key: g.key, ideas: g.ideas, outcome: c.kid, contradicted: c.contradicted, count: g.count, model }];
    });
    result = { outcome: pack.realOutcome(cond), byGroup };
  }
  return {
    participants: records.length,
    explained: count((r) => !!initialDiagnosis(r)),
    predicted: [...predictions.values()].reduce((a, b) => a + b, 0),
    revised: count((r) => !!revisedDiagnosis(r)),
    transferred: count((r) => eventsOf(r, 'transfer').length > 0),
    groups: atLeast(meta.phase, 'map') ? groupsOf(pack, records, 'initial', false) : null,
    predictions: x && atLeast(meta.phase, 'reveal') ? [...predictions.entries()].map(([outcome, n]) => ({ outcome, count: n })) : null,
    result,
    revisedGroups: atLeast(meta.phase, 'revise') ? groupsOf(pack, records, 'revised', false) : null,
    transitions: meta.phase === 'insight' ? transitionsOf(pack, records) : null,
  };
}

/** The experiment id stays hidden from learners and the screen until predictions open. */
export const publicMeta = ({ approvalSource: _approvalSource, settings: { accessibility: _accessibility, ...settings }, ...meta }: RoomMeta): RoomMeta =>
  atLeast(meta.phase, 'predict') ? { ...meta, settings, rejected: [] } : { ...meta, settings, rejected: [], experimentId: null };

export function versionOf(data: RoomData): string {
  // Include event contents so same-length edits and same-tick classroom actions invalidate cached views.
  const text = JSON.stringify(data);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

export const teacherView = (data: RoomData): TeacherRoomView =>
  ({ role: 'teacher', version: versionOf(data), meta: data.meta, participants: data.participants });

export const screenView = (pack: ConceptPack, data: RoomData): ScreenRoomView =>
  ({ role: 'screen', version: versionOf(data), meta: publicMeta(data.meta), agg: aggregates(pack, data) });

export function studentView(pack: ConceptPack, data: RoomData, participantId: string): StudentRoomView | null {
  const me = data.participants.find((p) => p.id === participantId);
  if (!me) return null;
  const agg = aggregates(pack, data);
  // classmates' ideas only after this learner has explained
  if (!initialDiagnosis(me.record)) {
    agg.groups = agg.revisedGroups = agg.transitions = null;
    if (agg.result) agg.result.byGroup = [];
  }
  // the diagnosis a learner sees carries their own words and Noor's line, not the teacher's analysis: the teacher's
  // reclassification stays on the teacher's side
  const own = { ...me, record: { ...me.record, events: me.record.events.filter((e) => e.type !== 'review') } };
  return { role: 'student', version: versionOf(data), meta: publicMeta(data.meta), me: own, agg };
}

export function viewFor(pack: ConceptPack, data: RoomData, role: RoomView['role'], participantId?: string): RoomView | null {
  if (role === 'teacher') return teacherView(data);
  if (role === 'screen') return screenView(pack, data);
  return participantId ? studentView(pack, data, participantId) : null;
}
