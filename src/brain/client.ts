/**
 * What the screens call. Language calls try the model through /api and fall back to the offline rules with the
 * same contract; every result says which one answered. Classroom calls go to /api/room, except the labelled
 * sample classroom, which runs the same rules on this device.
 */
import { z } from 'zod';
import type {
  ActivityPlan, ActivityRequest, BrainContext, Diagnosis, Health, Lang, LearnerRecord, LessonDraft, LessonInput, RoomError, RoomRequest,
  RoomSettings, RoomView, StudentOp, StudentRoomView, TeacherOp, TeacherRoomView, TeachResult, TransferResult,
} from '../contracts';
import {
  ActivityPlan as ActivitySchema, Diagnosis as DiagnosisSchema, LessonDraft as LessonSchema, TeachResult as TeachSchema, TransferResult as TransferSchema,
} from '../contracts';
import { getPack } from '../packs';
import type { ConceptPack } from '../packs/types';
import { fallbackActivity } from './classInsights';
import { heuristicDiagnose, heuristicTeach, heuristicTransfer } from './heuristic';
import { fallbackLesson } from './lesson';
import { addParticipant, checkStudentOp, studentOp, viewFor } from './room';
import type { Analysis, RoomData } from './room';
import { SAMPLE_CODE, sampleRoom, sampleTeacherOp } from './sample';

const TIMEOUT_MS = 12_000;

/* ───────── tiny safe storage ───────── */
const read = <T>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

/** Demonstrate (or force) the app without any AI call. */
export const offlineMode = {
  get: () => read('silsila-offline', false),
  set: (v: boolean) => write('silsila-offline', v),
};

async function post(url: string, body: unknown, timeout = TIMEOUT_MS): Promise<{ status: number; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    return { status: r.status, json: await r.json().catch(() => null) };
  } finally {
    clearTimeout(timer);
  }
}

async function ask<T>(url: string, body: unknown, schema: z.ZodType<T>, fallback: (reason: 'network' | 'offline_mode') => T, timeout = TIMEOUT_MS): Promise<T> {
  if (offlineMode.get()) return fallback('offline_mode');
  try {
    const r = await post(url, body, timeout);
    if (r.status !== 200) throw new Error('http_' + r.status);
    return schema.parse(r.json);
  } catch {
    return fallback('network');
  }
}

export const diagnose = (pack: ConceptPack, text: string, context: BrainContext): Promise<Diagnosis> =>
  ask('/api/diagnose', { text, context }, DiagnosisSchema, (reason) => heuristicDiagnose(pack, text, context, reason));

export const teach = (pack: ConceptPack, lang: Lang, text: string): Promise<TeachResult> =>
  ask('/api/teach', { pack: pack.id, lang, text }, TeachSchema, () => heuristicTeach(pack, text));

export const transfer = (pack: ConceptPack, lang: Lang, text: string): Promise<TransferResult> =>
  ask('/api/transfer', { pack: pack.id, lang, text }, TransferSchema, () => heuristicTransfer(pack, text));

export const activity = (pack: ConceptPack, request: ActivityRequest): Promise<ActivityPlan> =>
  ask('/api/activity', request, ActivitySchema, () => fallbackActivity(pack, request), 30_000);

export const lesson = (input: LessonInput): Promise<LessonDraft> =>
  ask('/api/lesson', input, LessonSchema, () => fallbackLesson(input), 45_000);

export async function health(probe = false): Promise<Health> {
  const off: Health = { ai: false, model: null, stt: false, tts: false, store: null, online: false };
  if (offlineMode.get()) return off;
  try {
    const r = await post('/api/health', probe ? { probe: true } : {}, probe ? 14_000 : 5000);
    if (r.status !== 200) return off;
    const j = r.json as Partial<Health>;
    return { ai: !!j.ai, model: j.model ?? null, stt: !!j.stt, tts: !!j.tts, store: j.store ?? null, online: true, last: j.last ?? null, paused: !!j.paused };
  } catch {
    return off;
  }
}

/* ───────────────────────── classroom ───────────────────────── */

export type Result<T> = { ok: true; data: T } | { ok: false; error: RoomError };
export interface Seat { participantId: string; key: string; alias: string; pack: string; lang: Lang }
export interface TeacherRoom { code: string; teacherKey: string; pack: string; lang: Lang; createdAt: number }

/** Keys stay on the device that created or joined the room. */
export const seats = {
  get: (code: string) => read<Seat | null>(`silsila-seat-${code}`, null),
  set: (code: string, seat: Seat) => write(`silsila-seat-${code}`, seat),
  clear: (code: string) => { try { localStorage.removeItem(`silsila-seat-${code}`); } catch { /* ignore */ } },
};
export const teacherRooms = {
  list: () => read<TeacherRoom[]>('silsila-rooms', []).filter((r) => Date.now() - r.createdAt < 6 * 60 * 60 * 1000),
  get: (code: string) => teacherRooms.list().find((r) => r.code === code) ?? null,
  add: (room: TeacherRoom) => write('silsila-rooms', [room, ...teacherRooms.list().filter((r) => r.code !== room.code)].slice(0, 10)),
  remove: (code: string) => write('silsila-rooms', teacherRooms.list().filter((r) => r.code !== code)),
};

/** The sample classroom lives in localStorage so the teacher tab and the projector tab stay in step. */
export const sampleStore = {
  load(): RoomData | null { return read<RoomData | null>('silsila-sample', null); },
  reset(packId: string, lang: Lang): RoomData {
    const data = sampleRoom(getPack(packId), lang);
    write('silsila-sample', data);
    return data;
  },
  ensure(): RoomData { return this.load() ?? this.reset('condensation', 'ar'); },
  save(data: RoomData) { write('silsila-sample', data); },
};

async function room<T>(request: RoomRequest, timeout = 20_000): Promise<Result<T>> {
  try {
    const r = await post('/api/room', request, timeout);
    if (r.status === 200) return { ok: true, data: r.json as T };
    const error = (r.json as { error?: RoomError } | null)?.error;
    return { ok: false, error: error ?? 'network' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export const roomApi = {
  /** → {code, teacherKey}; the room is remembered on this device */
  async create(settings: RoomSettings): Promise<Result<{ code: string; teacherKey: string }>> {
    const r = await room<{ code: string; teacherKey: string }>({ action: 'create', settings });
    if (r.ok) teacherRooms.add({ ...r.data, pack: settings.pack, lang: settings.lang, createdAt: Date.now() });
    return r;
  },

  async join(code: string, alias?: string): Promise<Result<Seat>> {
    if (code === SAMPLE_CODE) {
      const data = sampleStore.ensure();
      const participantId = `you-${Date.now().toString(36)}`;
      const r = addParticipant(data, participantId, alias);
      if (!r.ok) return r;
      sampleStore.save(r.data);
      const seat = { participantId, key: 'sample', alias: r.data.participants.at(-1)!.alias, pack: data.meta.settings.pack, lang: data.meta.settings.lang };
      seats.set(code, seat);
      return { ok: true, data: seat };
    }
    const r = await room<Seat>({ action: 'join', code, alias });
    if (r.ok) seats.set(code, r.data);
    return r;
  },

  /** `{unchanged: true}` when `since` is still the current version */
  async view<V extends RoomView>(code: string, auth: { role: V['role']; teacherKey?: string; participantId?: string; key?: string; since?: string }): Promise<Result<V | { unchanged: true }>> {
    if (code === SAMPLE_CODE) {
      const data = sampleStore.ensure();
      const v = viewFor(getPack(data.meta.settings.pack), data, auth.role, auth.participantId);
      if (!v) return { ok: false, error: 'forbidden' };
      return { ok: true, data: v.version === auth.since ? { unchanged: true } : (v as V) };
    }
    return room<V | { unchanged: true }>({ action: 'view', code, ...auth }, 8000);
  },

  async teacher(code: string, teacherKey: string, op: TeacherOp): Promise<Result<TeacherRoomView>> {
    if (code === SAMPLE_CODE) {
      const data = sampleStore.ensure();
      const pack = getPack(data.meta.settings.pack);
      const r = sampleTeacherOp(pack, data, op);
      if (!r.ok) return r;
      sampleStore.save(r.data);
      return { ok: true, data: viewFor(pack, r.data, 'teacher') as TeacherRoomView };
    }
    return room<TeacherRoomView>({ action: 'teacher', code, teacherKey, op });
  },

  async student(code: string, seat: Seat, op: StudentOp): Promise<Result<StudentRoomView>> {
    if (code === SAMPLE_CODE) {
      let data = sampleStore.ensure();
      const pack = getPack(data.meta.settings.pack);
      const denied = checkStudentOp(pack, data, seat.participantId, op);
      if (denied) return { ok: false, error: denied };
      const analysis: Analysis = {};
      if (op.type === 'explain' || op.type === 'revise') analysis.diagnosis = heuristicDiagnose(pack, op.text, { pack: pack.id, lang: data.meta.settings.lang, previous: [] });
      if (op.type === 'transfer') analysis.transfer = heuristicTransfer(pack, op.text);
      const r = studentOp(pack, data, seat.participantId, op, analysis);
      if (!r.ok) return r;
      data = r.data;
      sampleStore.save(data);
      return { ok: true, data: viewFor(pack, data, 'student', seat.participantId) as StudentRoomView };
    }
    return room<StudentRoomView>({ action: 'student', code, participantId: seat.participantId, key: seat.key, op }, 30_000);
  },

  /** homework: hand in this device's lesson record */
  async submit(code: string, seat: Seat, record: LearnerRecord): Promise<Result<StudentRoomView>> {
    return room<StudentRoomView>({ action: 'submit', code, participantId: seat.participantId, key: seat.key, record }, 30_000);
  },
};
