/**
 * POST /api/room (RoomRequest) — the live classroom. All rules are src/brain/room.ts; this file adds identity,
 * storage, concurrency and limits around them. Failures are an HTTP status plus {error: RoomError}.
 *
 *   create                      → {code, teacherKey}
 *   join     code, alias?       → {participantId, key, alias, pack, lang}
 *   view     teacher | student  → authorised by key; screen is public and carries anonymous aggregates only
 *   teacher  code, teacherKey   → TeacherRoomView
 *   student  code, id, key, op  → StudentRoomView (the server computes any diagnosis, never the learner)
 *
 * Keys are random (192 bits) and only their SHA-256 hashes are stored. A closed room accepts nothing and shows
 * nothing, except that its teacher may still read it until it expires.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { RoomRequest } from '../src/contracts';
import type { RoomError, RoomSettings, StudentOp } from '../src/contracts';
import { eventsOf } from '../src/brain/records';
import { addParticipant, checkStudentOp, newRoom, studentOp, teacherOp, viewFor } from '../src/brain/room';
import type { Analysis, RoomData } from '../src/brain/room';
import { SAMPLE_CODE } from '../src/brain/sample';
import { RESOURCE_IDS } from '../src/packs/resources';
import type { ConceptPack } from '../src/packs/types';
import { diagnose, transfer } from './_ai';
import { take, wait } from './_limit';
import { roomStore } from './_store';
import type { Head, RoomStore, Snapshot } from './_store';
import { clientIp, error, json, logError, packById, readBody } from './_util';

type Request_<A extends RoomRequest['action']> = Extract<RoomRequest, { action: A }>;

/** A subset of the contract's [A-Z2-9] without the characters children confuse (I, L, O). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** longer than a single endpoint: the browser waits 30 s for a classroom submission */
const AI_TIMEOUT_MS = 15_000;

const STATUS: Record<RoomError, number> = {
  bad_request: 400, forbidden: 403, no_room: 404, wrong_phase: 409, locked: 409, room_full: 409, room_closed: 410,
  rate_limited: 429, store_failed: 503, network: 502,
};
const refuse = (code: RoomError, status = STATUS[code]) => error(code, status);
const limited = (seconds: number) => error('rate_limited', 429, seconds);

const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const newKey = () => randomBytes(24).toString('base64url');
const sha256 = (value: string) => createHash('sha256').update(value).digest();
const hashOf = (key: string) => sha256(key).toString('hex');

/** Constant-time comparison of a presented key with a stored hash. */
function keyMatches(key: string | undefined, stored: string | undefined): boolean {
  const given = sha256(key ?? '');
  const expected = Buffer.from(stored ?? '', 'hex');
  return expected.length === given.length && timingSafeEqual(given, expected) && !!key;
}

const isSeat = (head: Head, participantId: string | undefined, key: string | undefined): boolean =>
  keyMatches(key, participantId && Object.hasOwn(head.keys, participantId) ? head.keys[participantId] : undefined);

/** Changes with every committed write; opaque to the client, which sends it back as `since`. */
const versionFor = (rev: number, createdAt: number) => `v${rev}.${createdAt.toString(36)}`;
const dataOf = (s: Snapshot): RoomData => ({ meta: s.head.meta, participants: s.participants });

/** A code that does not exist, tried where anybody can guess (join, public screen). */
function miss(ip: string): Response {
  take('roomMiss', ip);
  return refuse('no_room');
}

async function create(store: RoomStore, settings: RoomSettings, ip: string): Promise<Response> {
  const busy = take('roomCreate', ip);
  if (busy) return limited(busy);
  const pack = packById(settings.pack);
  if (!pack || (settings.objective !== null && !pack.objectives.some((o) => o.id === settings.objective))) return refuse('bad_request');
  const resources = [...new Set(settings.resources.filter((r) => (RESOURCE_IDS as string[]).includes(r)))];
  const teacherKey = newKey();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode();
    // the sample classroom lives only on the device
    if (code === SAMPLE_CODE) continue;
    const { meta } = newRoom(code, { ...settings, resources });
    if (await store.create({ meta, teacherHash: hashOf(teacherKey), keys: {}, rev: 1 })) return json({ code, teacherKey });
  }
  return refuse('store_failed');
}

async function join(store: RoomStore, req: Request_<'join'>, ip: string): Promise<Response> {
  const busy = wait('roomMiss', ip) || take('roomJoin', ip);
  if (busy) return limited(busy);
  const head = await store.head(req.code);
  if (!head) return miss(ip);
  if (head.meta.closed) return refuse('room_closed');
  const crowded = take('roomJoinCode', req.code);
  if (crowded) return limited(crowded);

  type Out = { error: RoomError } | { seat: { participantId: string; key: string; alias: string; pack: string; lang: string } };
  const out = await store.update<Out>(req.code, (snapshot) => {
    if (!snapshot) return { value: { error: 'no_room' } };
    const participantId = `p_${randomBytes(12).toString('base64url')}`;
    const key = newKey();
    const r = addParticipant(dataOf(snapshot), participantId, req.alias);
    if (!r.ok) return { value: { error: r.error } };
    const { settings } = r.data.meta;
    return {
      value: { seat: { participantId, key, alias: r.data.participants.at(-1)!.alias, pack: settings.pack, lang: settings.lang } },
      commit: { meta: r.data.meta, participants: r.data.participants, keys: { ...snapshot.head.keys, [participantId]: hashOf(key) } },
    };
  });
  return 'error' in out ? refuse(out.error) : json(out.seat);
}

async function view(store: RoomStore, req: Request_<'view'>, ip: string): Promise<Response> {
  const busy = take('roomView', ip) || (req.role === 'screen' ? wait('roomMiss', ip) : 0);
  if (busy) return limited(busy);
  const head = await store.head(req.code);
  if (!head) return req.role === 'screen' ? miss(ip) : refuse('no_room');
  if (req.role === 'teacher' && !keyMatches(req.teacherKey, head.teacherHash)) return refuse('forbidden');
  if (req.role === 'student' && !isSeat(head, req.participantId, req.key)) return refuse('forbidden');
  if (head.meta.closed && req.role !== 'teacher') return refuse('room_closed');
  if (req.since === versionFor(head.rev, head.meta.createdAt)) return json({ unchanged: true });

  const snapshot = await store.read(head);
  if (!snapshot) return refuse('no_room');
  const { meta, rev } = snapshot.head;
  if (meta.closed && req.role !== 'teacher') return refuse('room_closed');
  const pack = packById(meta.settings.pack);
  if (!pack) return refuse('bad_request');
  const seen = viewFor(pack, dataOf(snapshot), req.role, req.participantId);
  return seen ? json({ ...seen, version: versionFor(rev, meta.createdAt) }) : refuse('forbidden');
}

type Outcome = { error: RoomError } | { view: object };
const reply = (out: Outcome) => ('error' in out ? refuse(out.error) : json(out.view));

async function teacher(store: RoomStore, req: Request_<'teacher'>, ip: string): Promise<Response> {
  const busy = take('roomTeacher', ip);
  if (busy) return limited(busy);
  const head = await store.head(req.code);
  if (!head) return refuse('no_room');
  if (!keyMatches(req.teacherKey, head.teacherHash)) return refuse('forbidden');

  return reply(await store.update<Outcome>(req.code, (snapshot) => {
    if (!snapshot) return { value: { error: 'no_room' } };
    // the code may have been reused since the key was checked
    if (snapshot.head.teacherHash !== head.teacherHash) return { value: { error: 'forbidden' } };
    const pack = packById(snapshot.head.meta.settings.pack);
    if (!pack) return { value: { error: 'bad_request' } };
    const r = teacherOp(pack, dataOf(snapshot), req.op);
    if (!r.ok) return { value: { error: r.error } };
    const keys = { ...snapshot.head.keys };
    if (req.op.type === 'remove') delete keys[req.op.participantId];
    const version = versionFor(snapshot.head.rev + 1, r.data.meta.createdAt);
    return {
      value: { view: { ...viewFor(pack, r.data, 'teacher'), version } },
      commit: { meta: r.data.meta, participants: r.data.participants, keys },
    };
  }));
}

/** The language work an operation needs, from the learner's own words. */
async function analyse(pack: ConceptPack, data: RoomData, participantId: string, op: StudentOp): Promise<Analysis> {
  if (op.type === 'explain' || op.type === 'revise') {
    const record = data.participants.find((p) => p.id === participantId)!.record;
    const previous = eventsOf(record, 'explain').map((e) => ({ text: e.text, status: e.diagnosis.status, ideas: e.diagnosis.ideas.map((i) => i.id) }));
    return { diagnosis: await diagnose(pack, op.text, { pack: pack.id, lang: data.meta.settings.lang, previous }, { timeoutMs: AI_TIMEOUT_MS }) };
  }
  if (op.type === 'transfer') {
    const { steps, source } = await transfer(pack, op.text, { timeoutMs: AI_TIMEOUT_MS });
    return { transfer: { steps, source } };
  }
  return {};
}

async function student(store: RoomStore, req: Request_<'student'>, ip: string): Promise<Response> {
  const busy = take('roomStudent', ip);
  if (busy) return limited(busy);
  const head = await store.head(req.code);
  if (!head) return refuse('no_room');
  if (!isSeat(head, req.participantId, req.key)) return refuse('forbidden');
  const seat = `${req.code}:${req.participantId}`;
  const usesModel = req.op.type === 'explain' || req.op.type === 'revise' || req.op.type === 'transfer';
  const eager = take('roomSeat', seat) || (usesModel ? take('roomSeatAi', seat) : 0) || take('roomStudentCode', req.code);
  if (eager) return limited(eager);

  let op = req.op;
  if ('text' in op) {
    op = { ...op, text: op.text.trim() };
    if (!op.text) return refuse('bad_request');
  }
  const before = await store.read(head);
  if (!before) return refuse('no_room');
  const pack = packById(before.head.meta.settings.pack);
  if (!pack) return refuse('bad_request');
  // refuse before any (paid) model call
  const denied = checkStudentOp(pack, dataOf(before), req.participantId, op);
  if (denied) return refuse(denied);

  // outside the lock: other learners keep working while the model reads this answer
  const analysis = await analyse(pack, dataOf(before), req.participantId, op);

  return reply(await store.update<Outcome>(req.code, (snapshot) => {
    if (!snapshot) return { value: { error: 'no_room' } };
    if (!isSeat(snapshot.head, req.participantId, req.key)) return { value: { error: 'forbidden' } };
    // the rules run again on the current state: the teacher may have moved on meanwhile
    const r = studentOp(pack, dataOf(snapshot), req.participantId, op, analysis);
    if (!r.ok) return { value: { error: r.error } };
    const version = versionFor(snapshot.head.rev + 1, r.data.meta.createdAt);
    return {
      value: { view: { ...viewFor(pack, r.data, 'student', req.participantId), version } },
      commit: { meta: r.data.meta, participants: r.data.participants, keys: snapshot.head.keys },
    };
  }));
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, 16_384);
  if (!body.ok) return refuse('bad_request', body.status);
  const parsed = RoomRequest.safeParse(body.value);
  if (!parsed.success) return refuse('bad_request');
  const store = roomStore();
  if (!store) return refuse('store_failed');
  const ip = clientIp(request);
  const req = parsed.data;
  try {
    switch (req.action) {
      case 'create': return await create(store, req.settings, ip);
      case 'join': return await join(store, req, ip);
      case 'view': return await view(store, req, ip);
      case 'teacher': return await teacher(store, req, ip);
      case 'student': return await student(store, req, ip);
    }
  } catch (e) {
    logError('room', e);
    return refuse('store_failed');
  }
}
