/** The live room survives a server restart: room, learner, explanation and the teacher's key (api/_store.ts file store). */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as health } from '../api/health';
import { POST as room } from '../api/room';
import { resetStores, storeKind } from '../api/_store';
import { resetLimits } from '../api/_limit';
import { resetAi } from '../api/_ai';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'silsila-rooms-'));
  for (const k of ['OPENROUTER_API_KEY', 'LLM_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VERCEL', 'SILSILA_STORE']) vi.stubEnv(k, '');
  vi.stubEnv('SILSILA_DATA_DIR', dir);
  resetLimits(); resetStores(); resetAi();
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

const call = async (handler: (r: Request) => Promise<Response>, body: unknown, ip = '10.0.0.7') => {
  const r = await handler(new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json() as Record<string, any> };
};
const settings = { pack: 'condensation', lang: 'ar', grade: 5, minutes: 45, resources: ['paper'], supervision: true, objective: null };

describe('file store', () => {
  it('is the default without Redis, and health says so', async () => {
    expect(storeKind()).toBe('file');
    expect((await call(health, {})).body.store).toBe('file');
  });

  it('keeps the room, the learner, the explanation and the teacher key across a restart', async () => {
    const made = (await call(room, { action: 'create', settings })).body as { code: string; teacherKey: string };
    const seat = (await call(room, { action: 'join', code: made.code, alias: 'نجمة' })).body as { participantId: string; key: string };
    expect((await call(room, { action: 'teacher', code: made.code, teacherKey: made.teacherKey, op: { type: 'phase', phase: 'explain' } })).status).toBe(200);
    const sent = await call(room, { action: 'student', code: made.code, participantId: seat.participantId, key: seat.key, op: { type: 'explain', text: 'المي بتنز من جوا الكاسة' } });
    expect(sent.status).toBe(200);

    resetStores(); // the process is gone: memory is empty, only the file is left

    const teacher = await call(room, { action: 'view', code: made.code, role: 'teacher', teacherKey: made.teacherKey });
    expect(teacher.status).toBe(200);
    expect(teacher.body.participants).toHaveLength(1);
    expect(teacher.body.participants[0].record.events.some((e: { type: string }) => e.type === 'explain')).toBe(true);
    // the learner's key still works, and the room carries on
    const student = await call(room, { action: 'view', code: made.code, role: 'student', participantId: seat.participantId, key: seat.key });
    expect(student.status).toBe(200);
    expect((await call(room, { action: 'teacher', code: made.code, teacherKey: made.teacherKey, op: { type: 'phase', phase: 'map' } })).status).toBe(200);
    expect((await call(room, { action: 'teacher', code: made.code, teacherKey: 'wrong-key', op: { type: 'phase', phase: 'recommend' } })).status).toBe(403);
  });

  it('never leaves a half-written file and sets a damaged one aside', async () => {
    const made = (await call(room, { action: 'create', settings })).body as { code: string };
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    expect(Array.isArray(JSON.parse(readFileSync(join(dir, 'rooms.json'), 'utf8')))).toBe(true);
    writeFileSync(join(dir, 'rooms.json'), '{"cut off');
    resetStores();
    expect((await call(room, { action: 'view', code: made.code, role: 'screen' })).status).toBe(404);
    expect(readdirSync(dir).some((f) => f.startsWith('rooms.json.damaged-'))).toBe(true);
    // and it can still create rooms
    expect((await call(room, { action: 'create', settings })).status).toBe(200);
  });
});

describe('homework over the API', () => {
  it('accepts a full lesson record from a seat, survives a restart, and closes after the due time', async () => {
    const due = Date.now() + 3600_000;
    const made = (await call(room, { action: 'create', settings: { ...settings, kind: 'homework', dueAt: due } })).body as { code: string; teacherKey: string };
    const seat = (await call(room, { action: 'join', code: made.code, alias: 'منى' })).body as { participantId: string; key: string };
    const { normaliseDiagnosis } = await import('../src/brain/normalise');
    const { addEvent, newRecord } = await import('../src/brain/records');
    const { getPack } = await import('../src/packs');
    const pack = getPack('condensation');
    const text = 'المي بتنز من جوا الكاسة ' + 'كلام '.repeat(40);
    const d = normaliseDiagnosis(pack, { relevance: 'answer', ideas: [{ id: 'inside_water', evidence: 'المي بتنز من جوا الكاسة' }], steps: [] }, text, { pack: pack.id, lang: 'ar', previous: [] }, { source: 'fallback' });
    let record = newRecord({ id: 'x', pack: pack.id, alias: 'x', grade: 5, lang: 'ar' });
    for (let i = 0; i < 30; i++) record = addEvent(record, { type: 'explain', at: i + 1, phase: i ? 'clarify' : 'initial', text, diagnosis: d });
    const sent = await call(room, { action: 'submit', code: made.code, participantId: seat.participantId, key: seat.key, record });
    expect(sent.status).toBe(200);
    // a wrong key cannot hand in for this seat
    expect((await call(room, { action: 'submit', code: made.code, participantId: seat.participantId, key: 'nope', record })).status).toBe(403);
    resetStores();
    const teacher = await call(room, { action: 'view', code: made.code, role: 'teacher', teacherKey: made.teacherKey });
    expect(teacher.body.participants[0].submittedAt).toBeGreaterThan(0);
    expect(teacher.body.participants[0].record.alias).toBe('منى');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(due + 60_000);
    const late = await call(room, { action: 'submit', code: made.code, participantId: seat.participantId, key: seat.key, record });
    vi.useRealTimers();
    expect(late.status).toBe(409);
    expect(late.body.error).toBe('locked');
    // other requests stay small
    const big = await call(room, { action: 'join', code: made.code, alias: 'x', pad: 'y'.repeat(40_000) });
    expect(big.status).toBe(413);
  });
});
