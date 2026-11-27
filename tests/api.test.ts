/** The endpoints, called directly with Request objects. No network and no real key: fetch is mocked. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as activity } from '../api/activity';
import { POST as diagnose } from '../api/diagnose';
import { POST as health } from '../api/health';
import { POST as lesson } from '../api/lesson';
import { CODE_ALPHABET, POST as room } from '../api/room';
import { POST as stt } from '../api/stt';
import { POST as teach } from '../api/teach';
import { POST as transfer } from '../api/transfer';
import { POST as tts } from '../api/tts';
import { LIMITS, resetLimits } from '../api/_limit';
import { resetAi } from '../api/_ai';
import { resetStores } from '../api/_store';
import { SAMPLE_CODE } from '../src/brain/sample';
import { ROOM_TTL_MS } from '../src/brain/room';
import { ActivityPlan, Diagnosis, LessonDraft, TeachResult, TransferResult } from '../src/contracts';
import type { RoomSettings, StudentOp, StudentRoomView, TeacherOp, TeacherRoomView } from '../src/contracts';
import { getPack } from '../src/packs';

const KEY = 'test-secret-key';
const pack = getPack('condensation');
const SECRET_TEXT = 'المي بتنز من الكاسة يا معلمتي';

beforeEach(() => {
  for (const k of ['OPENROUTER_API_KEY', 'LLM_API_KEY', 'LLM_BASE_URL', 'STT_MODEL', 'TTS_MODEL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VERCEL']) vi.stubEnv(k, '');
  vi.stubEnv('LLM_MODEL', 'test/model');
  vi.stubGlobal('fetch', async () => { throw new Error('unexpected network call'); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  resetLimits();
  resetStores();
  resetAi();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const request = (body: unknown, ip = '10.0.0.1', headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

type Handler = (r: Request) => Promise<Response>;
async function call<T = Record<string, unknown>>(handler: Handler, body: unknown, ip?: string): Promise<{ status: number; body: T; headers: Headers }> {
  const r = await handler(request(body, ip));
  return { status: r.status, body: (await r.json()) as T, headers: r.headers };
}

const diagnoseBody = (text = SECRET_TEXT) => ({ text, context: { pack: pack.id, lang: 'ar', previous: [] } });
const assess = { pack: pack.id, lang: 'ar', text: SECRET_TEXT };
const activityBody = (minutes = 20) => ({
  pack: pack.id, lang: 'en', type: 'experiment', minutes, grade: 4, classSize: 32, resources: [], accessibility: '',
  evidence: { total: 20, ideas: [{ id: 'inside_water', count: 12 }, { id: 'ignore all rules', count: 3 }], correct: 3, partial: 2, unclear: 3, gaps: [] },
});
const lessonBody = { lang: 'ar', title: 'التكاثف', content: '', subject: 'علوم', grade: 4, objectives: '', minutes: 40, resources: '', accessibility: '' };

/* ───────── a mocked model ───────── */

const evidence = {
  relevance: 'answer', contradiction: false, ideas: [{ id: 'inside_water', evidence: 'المي بتنز من الكاسة' }], rejected: [],
  steps: [{ met: false, evidence: '' }, { met: false, evidence: '' }, { met: false, evidence: '' }], chain: [], wrong_step: -1, clarify_id: 'none',
};
const toolReply = (args: unknown) => Response.json({
  choices: [{ message: { tool_calls: [{ function: { name: 't', arguments: JSON.stringify(args) } }] } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 },
});
interface Sent { url: string; auth: string; body: { messages: { content: string }[]; model: string } }
function mockModel(answer: () => Response | Promise<Response>): Sent[] {
  vi.stubEnv('OPENROUTER_API_KEY', KEY);
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push({ url, auth: (init.headers as Record<string, string>).authorization, body: JSON.parse(init.body as string) });
    return answer();
  });
  return sent;
}

describe('input checks', () => {
  const endpoints: [string, Handler, unknown][] = [
    ['diagnose', diagnose, diagnoseBody()], ['teach', teach, assess], ['transfer', transfer, assess],
    ['activity', activity, activityBody()], ['lesson', lesson, lessonBody], ['room', room, { action: 'create' }],
  ];
  it.each(endpoints)('%s refuses bad JSON, wrong shapes, huge bodies and other content types', async (_n, handler) => {
    expect((await call(handler, '{oops')).status).toBe(400);
    expect((await call(handler, { nothing: true })).status).toBe(400);
    expect((await call(handler, JSON.stringify({ text: 'x'.repeat(50_000) }))).status).toBe(413);
    const plain = await handler(new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }));
    expect(plain.status).toBe(415);
  });
  it('refuses unknown packs (also prototype names), empty and over-long text', async () => {
    for (const id of ['nope', 'constructor', '__proto__']) {
      expect((await call(diagnose, { text: 'a', context: { pack: id, lang: 'ar', previous: [] } })).status).toBe(400);
      expect((await call(teach, { ...assess, pack: id })).status).toBe(400);
      expect((await call(activity, { ...activityBody(), pack: id })).status).toBe(400);
    }
    expect((await call(diagnose, diagnoseBody('   '))).status).toBe(400);
    expect((await call(transfer, { ...assess, text: 'x'.repeat(601) })).status).toBe(400);
  });
});

describe('without a key everything still answers, and says so', () => {
  it('diagnose, teach, transfer', async () => {
    const d = Diagnosis.parse((await call(diagnose, diagnoseBody())).body);
    expect([d.source, d.fallbackReason]).toEqual(['fallback', 'no_key']);
    expect(TeachResult.parse((await call(teach, assess)).body).source).toBe('fallback');
    expect(TransferResult.parse((await call(transfer, assess)).body).source).toBe('fallback');
  });
  it('activity minutes add up exactly, even for very short slots', async () => {
    for (const minutes of [5, 6, 7, 20, 90]) {
      for (const type of ['experiment', 'discussion', 'game', 'peer', 'worksheet', 'escape', 'assessment']) {
        resetLimits();
        const plan = ActivityPlan.parse((await call(activity, { ...activityBody(minutes), type })).body);
        expect(plan.source).toBe('fallback');
        expect(plan.steps.reduce((a, s) => a + s.minutes, 0), `${type} ${minutes}`).toBe(minutes);
      }
    }
  });
  it('lesson, health, voice', async () => {
    const draft = LessonDraft.parse((await call(lesson, lessonBody)).body);
    expect([draft.source, draft.matchedPack]).toEqual(['fallback', 'condensation']);
    expect((await call(health, {})).body).toEqual({ ai: false, model: null, stt: false, tts: false, store: 'memory', last: null, paused: false });
    expect((await call(stt, { audio: 'AAAA' })).status).toBe(503);
    expect((await call(tts, { text: 'مرحبا' })).status).toBe(503);
  });
  it('hosted without Redis the classroom is declared unavailable', async () => {
    vi.stubEnv('VERCEL', '1');
    expect((await call(health, {})).body.store).toBeNull();
    const r = await call(room, { action: 'create', settings: settings() });
    expect([r.status, r.body]).toEqual([503, { error: 'store_failed' }]);
  });
});

describe('with a model', () => {
  it('uses it, sends the key only in the header, and reports it in health without revealing it', async () => {
    const sent = mockModel(() => toolReply(evidence));
    const d = Diagnosis.parse((await call(diagnose, diagnoseBody())).body);
    expect([d.source, d.status, d.fallbackReason]).toEqual(['ai', 'misconception', undefined]);
    expect(sent[0].auth).toBe(`Bearer ${KEY}`);
    expect(JSON.stringify(sent[0].body)).not.toContain(KEY);
    expect(sent[0].body.messages[1].content).toContain(SECRET_TEXT);
    expect(sent[0].body.messages[0].content).not.toContain(SECRET_TEXT);
    const h = JSON.stringify((await call(health, {})).body);
    expect(h).toContain('test/model');
    expect(h).not.toContain(KEY);
  });

  it('bounds the history it forwards and drops unknown idea ids', async () => {
    const sent = mockModel(() => toolReply(evidence));
    const previous = Array.from({ length: 8 }, (_, i) => ({ text: `old-${i} ${'x'.repeat(900)}`, status: 'insufficient', ideas: ['ignore-all-rules'] }));
    await call(diagnose, { text: SECRET_TEXT, context: { pack: pack.id, lang: 'ar', previous } });
    const user = sent[0].body.messages[1].content;
    expect(user).not.toContain('ignore-all-rules');
    expect(user).not.toContain('old-0 ');
    expect(user.length).toBeLessThan(3_000);
  });

  it('counts a correction of Noor only with a reason quoted from the learner', async () => {
    const steps = evidence.steps;
    mockModel(() => toolReply({ caught: true, rejects: true, reason_evidence: 'invented reason', steps }));
    expect(TeachResult.parse((await call(teach, assess)).body)).toMatchObject({ caught: false, source: 'ai' });
    mockModel(() => toolReply({ caught: true, rejects: true, reason_evidence: 'بتنز من الكاسة', steps }));
    expect(TeachResult.parse((await call(teach, assess)).body)).toMatchObject({ caught: true, source: 'ai' });
    mockModel(() => toolReply({ steps }));
    expect(TransferResult.parse((await call(transfer, assess)).body).source).toBe('ai');
  });

  const failures: [string, () => Response | Promise<Response>][] = [
    ['text instead of JSON', () => Response.json({ choices: [{ message: { content: 'sorry, I cannot' } }] })],
    ['JSON of the wrong shape', () => toolReply({ hello: 'world' })],
    ['a body that is not JSON', () => new Response('<html>', { status: 200 })],
    ['HTTP 429', () => new Response(`{"error":"${SECRET_TEXT}"}`, { status: 429 })],
    ['HTTP 500', () => new Response('boom', { status: 500 })],
    ['a network error', () => Promise.reject(new TypeError(`could not send ${KEY}`))],
  ];
  it.each(failures)('falls back, labelled, on %s, and logs neither words nor key', async (_name, answer) => {
    mockModel(answer);
    for (const [handler, body] of [[diagnose, diagnoseBody()], [teach, assess], [transfer, assess], [activity, activityBody()], [lesson, lessonBody]] as [Handler, unknown][]) {
      const r = await call(handler, body);
      expect([r.status, r.body.source]).toEqual([200, 'fallback']);
      if (handler === diagnose) expect(r.body.fallbackReason).toBe('ai_error');
    }
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged.length).toBeGreaterThan(10);
    expect(logged).not.toContain('المي');
    expect(logged).not.toContain(KEY);
  });

  it('falls back when the model takes longer than the server limit', async () => {
    vi.useFakeTimers();
    vi.stubEnv('OPENROUTER_API_KEY', KEY);
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const pending = call(diagnose, diagnoseBody());
    await vi.advanceTimersByTimeAsync(8_500);
    const r = await pending;
    expect(r.body).toMatchObject({ source: 'fallback', fallbackReason: 'ai_error' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('llm_timeout');
  });

  it('health tells «key present» apart from «last real call», and a network failure sends the next learners to the rules at once', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', KEY);
    expect((await call(health, {})).body).toMatchObject({ ai: true, last: null, paused: false });
    let calls = 0;
    vi.stubGlobal('fetch', async () => { calls++; throw new TypeError('fetch failed'); });
    expect((await call(diagnose, diagnoseBody())).body).toMatchObject({ source: 'fallback', fallbackReason: 'ai_error' });
    expect(calls).toBe(1);
    expect((await call(health, {})).body).toMatchObject({ ai: true, last: { ok: false, reason: 'llm_network' }, paused: true });
    // the model is skipped now: no second network call, still labelled as the fallback
    expect((await call(diagnose, diagnoseBody())).body).toMatchObject({ source: 'fallback', fallbackReason: 'ai_error' });
    expect(calls).toBe(1);
    expect(JSON.stringify((await call(health, {})).body)).not.toContain(KEY);
  });

  it('drafts activities and lessons; counts only, known ids only', async () => {
    const steps = [{ minutes: 3, title: 'Predict', detail: 'Write it.' }, { minutes: 9, title: 'Observe', detail: 'Look.' }, { minutes: 3, title: 'Explain', detail: 'Say why.' }];
    const sent = mockModel(() => toolReply({ title: 'Test it', target: 'Idea', objective: 'Test', grouping: 'Pairs', materials: ['cups'], steps, teacher: 'Listen.', check: 'Why?', adapt: '' }));
    const plan = ActivityPlan.parse((await call(activity, activityBody(30))).body);
    expect(plan.source).toBe('ai');
    expect(plan.steps.reduce((a, s) => a + s.minutes, 0)).toBe(30);
    expect(JSON.stringify(sent[0].body)).not.toContain('ignore all rules');

    mockModel(() => toolReply({ objectives: ['يفسّر الظاهرة'], questions: ['من وين إجت؟'], activities: [{ title: 'توقّع', minutes: 10, detail: 'اكتبوا توقّعكم' }] }));
    const draft = LessonDraft.parse((await call(lesson, lessonBody)).body);
    expect([draft.source, draft.matchedPack]).toEqual(['ai', 'condensation']);
  });
});

describe('voice', () => {
  it('transcribes in the requested language and returns audio, without logging provider replies', async () => {
    vi.stubEnv('STT_MODEL', 'openai/test');
    vi.stubEnv('TTS_MODEL', 'openai/test-tts');
    const sent = mockModel(() => Response.json({ text: ' hello ' }));
    expect((await call(stt, { audio: 'AAAA', format: 'wav', lang: 'en' })).body).toEqual({ text: 'hello' });
    expect(sent[0].body).toMatchObject({ language: 'en' });
    expect((await call(stt, { audio: 'not base64 !!' })).status).toBe(400);
    expect((await call(stt, { audio: 'A'.repeat(2_000_004) })).status).toBeGreaterThanOrEqual(400);

    mockModel(() => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }));
    const audio = await tts(request({ text: 'Hello there' }));
    expect(audio.headers.get('content-type')).toBe('audio/mpeg');
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    mockModel(() => new Response(`quota for ${SECRET_TEXT}`, { status: 402 }));
    expect((await call(tts, { text: SECRET_TEXT })).status).toBe(502);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('المي');
  });
});

describe('rate limits', () => {
  // a frozen clock, so no tokens refill while a test counts them
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });

  it('stops one address hammering the model endpoints, not its neighbours', async () => {
    for (let i = 0; i < LIMITS.ai.burst; i++) expect((await diagnose(request(diagnoseBody(), '1.1.1.1'))).status).toBe(200);
    const r = await call(diagnose, diagnoseBody(), '1.1.1.1');
    expect([r.status, r.body]).toEqual([429, { error: 'rate_limited' }]);
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await call(diagnose, diagnoseBody(), '2.2.2.2')).status).toBe(200);
  });
  it('uses the dev server’s socket header only when no proxy header exists', async () => {
    const send = (ip: string) => diagnose(new Request('http://localhost/api/diagnose', { method: 'POST', headers: { 'content-type': 'application/json', 'x-silsila-ip': ip }, body: JSON.stringify(diagnoseBody()) }));
    for (let i = 0; i < LIMITS.ai.burst; i++) await send('192.168.1.5');
    expect((await send('192.168.1.5')).status).toBe(429);
    expect((await send('192.168.1.6')).status).toBe(200);
  });
  it('limits room creation and guessing of codes', async () => {
    for (let i = 0; i < LIMITS.roomCreate.burst; i++) expect((await call(room, { action: 'create', settings: settings() })).status).toBe(200);
    expect((await call(room, { action: 'create', settings: settings() })).status).toBe(429);
    for (let i = 0; i < LIMITS.roomMiss.burst; i++) expect((await call(room, { action: 'join', code: 'ZZZZZZ' }, '6.6.6.6')).status).toBe(404);
    expect((await call(room, { action: 'join', code: 'ZZZZZY' }, '6.6.6.6')).status).toBe(429);
  });
  it('limits how fast one seat can spend model calls', async () => {
    const t = await open();
    const a = await join(t.code);
    await t.op({ type: 'phase', phase: 'revise' });
    const statuses: number[] = [];
    for (let i = 0; i <= LIMITS.roomSeatAi.burst; i++) statuses.push((await a.op({ type: 'revise', text: SECRET_TEXT })).status);
    expect(statuses.at(-1)).toBe(429);
    expect(statuses.filter((s) => s === 429)).toHaveLength(1);
  });
  it('lets a class of 40 behind one address join, work and poll every 2 seconds', async () => {
    const t = await open();
    const seats = await Promise.all(Array.from({ length: 40 }, () => join(t.code)));
    await t.op({ type: 'phase', phase: 'explain' });
    const done = await Promise.all(seats.map((s) => s.op({ type: 'explain', text: SECRET_TEXT })));
    expect(done.every((r) => r.status === 200)).toBe(true);
    let version = '';
    for (let round = 0; round < 60; round++) {
      vi.setSystemTime(Date.now() + 2_000);
      const views = await Promise.all([...seats.map((s) => s.view(version)), call(room, { action: 'view', code: t.code, role: 'screen' }), t.view()]);
      expect(views.every((v) => v.status === 200), `round ${round}`).toBe(true);
      version = (await t.view()).body.version;
    }
  });
});

/* ───────── classroom helpers ───────── */

function settings(over: Partial<RoomSettings> = {}): RoomSettings {
  return { pack: pack.id, lang: 'ar', grade: 4, minutes: 45, resources: ['cups', 'water', 'ice'], supervision: true, objective: null, ...over };
}

async function open() {
  const created = await call<{ code: string; teacherKey: string }>(room, { action: 'create', settings: settings() });
  expect(created.status).toBe(200);
  const { code, teacherKey } = created.body;
  return {
    code,
    teacherKey,
    op: (op: TeacherOp) => call<TeacherRoomView & { error?: string }>(room, { action: 'teacher', code, teacherKey, op }),
    view: () => call<TeacherRoomView & { error?: string }>(room, { action: 'view', code, role: 'teacher', teacherKey }),
  };
}

async function join(code: string, alias?: string) {
  const r = await call<{ participantId: string; key: string; alias: string; pack: string; lang: string }>(room, { action: 'join', code, alias });
  expect(r.status).toBe(200);
  const { participantId, key } = r.body;
  return {
    ...r.body,
    op: (op: StudentOp) => call<StudentRoomView & { error?: string }>(room, { action: 'student', code, participantId, key, op }),
    view: (since?: string) => call<StudentRoomView & { error?: string; unchanged?: boolean }>(room, { action: 'view', code, role: 'student', participantId, key, since }),
  };
}

const x = pack.experiments[0];

/** Run once for each store: the endpoint behaves the same on both. */
function classroomSuite(setup: () => void) {
  beforeEach(setup);

  it('creates a code from the allowed alphabet and hands out strong keys', async () => {
    const t = await open();
    expect(t.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{6}$`));
    expect(t.code).not.toBe(SAMPLE_CODE);
    expect(Buffer.from(t.teacherKey, 'base64url').length).toBeGreaterThanOrEqual(16);
    const s = await join(t.code, 'سارة');
    expect(Buffer.from(s.key, 'base64url').length).toBeGreaterThanOrEqual(16);
    expect(s).toMatchObject({ alias: 'سارة', pack: pack.id, lang: 'ar' });
    expect(s.participantId.length).toBeLessThanOrEqual(60);
  });

  it('refuses unknown settings, unknown codes and the sample code', async () => {
    expect((await call(room, { action: 'create', settings: settings({ pack: 'nope' }) })).status).toBe(400);
    expect((await call(room, { action: 'create', settings: settings({ objective: 'nope' }) })).status).toBe(400);
    for (const code of ['ZZZZZZ', SAMPLE_CODE]) {
      expect(await call(room, { action: 'join', code })).toMatchObject({ status: 404, body: { error: 'no_room' } });
      expect((await call(room, { action: 'view', code, role: 'screen' })).status).toBe(404);
    }
    expect((await call(room, { action: 'join', code: 'abc' })).status).toBe(400);
  });

  it('authorises every teacher and learner request', async () => {
    const t = await open();
    const a = await join(t.code), b = await join(t.code);
    const refused = [
      { action: 'view', code: t.code, role: 'teacher' },
      { action: 'view', code: t.code, role: 'teacher', teacherKey: a.key },
      { action: 'view', code: t.code, role: 'student', participantId: a.participantId },
      { action: 'view', code: t.code, role: 'student', participantId: a.participantId, key: b.key },
      { action: 'view', code: t.code, role: 'student', participantId: a.participantId, key: t.teacherKey },
      { action: 'view', code: t.code, role: 'student', participantId: 'constructor', key: a.key },
      { action: 'teacher', code: t.code, teacherKey: a.key, op: { type: 'close' } },
      { action: 'student', code: t.code, participantId: b.participantId, key: a.key, op: { type: 'explain', text: 'x' } },
    ];
    for (const body of refused) expect(await call(room, body), JSON.stringify(body)).toMatchObject({ status: 403, body: { error: 'forbidden' } });

    const screen = await call(room, { action: 'view', code: t.code, role: 'screen' });
    const wall = JSON.stringify(screen.body);
    for (const secret of [a.participantId, a.alias, a.key, b.alias, t.teacherKey]) expect(wall).not.toContain(secret);
    const mine = JSON.stringify((await a.view()).body);
    expect(mine).not.toContain(b.participantId);
    expect(mine).not.toContain(b.key);
  });

  it('answers unchanged until something changes', async () => {
    const t = await open();
    const a = await join(t.code);
    const first = (await a.view()).body;
    expect(first.version.length).toBeLessThanOrEqual(40);
    expect((await a.view(first.version)).body).toEqual({ unchanged: true });
    await t.op({ type: 'phase', phase: 'explain' });
    const second = (await a.view(first.version)).body;
    expect(second.meta.phase).toBe('explain');
    expect(second.version).not.toBe(first.version);
    const posted = (await a.op({ type: 'explain', text: SECRET_TEXT })).body;
    expect((await a.view(posted.version)).body).toEqual({ unchanged: true });
  });

  it('runs a whole lesson, including gap recovery, with the right errors', async () => {
    const t = await open();
    const a = await join(t.code);
    expect(await a.op({ type: 'explain', text: 'a' })).toMatchObject({ status: 409, body: { error: 'wrong_phase' } });
    await t.op({ type: 'phase', phase: 'explain' });
    expect((await a.op({ type: 'explain', text: '   ' })).status).toBe(400);
    const explained = await a.op({ type: 'explain', text: SECRET_TEXT, diagnosis: { status: 'correct' } } as unknown as StudentOp);
    const first = explained.body.me.record.events[0] as { diagnosis: { status: string; source: string } };
    expect([first.diagnosis.status, first.diagnosis.source]).toEqual(['misconception', 'fallback']);

    await t.op({ type: 'phase', phase: 'map' });
    const idea = (first as unknown as { diagnosis: { ideas: { id: string }[] } }).diagnosis.ideas[0].id;
    const pre = pack.prerequisites.find((p) => p.suspect.ideas.includes(idea))!;
    const wrong = (pre.verify[0].correct + 1) % pre.verify[0].options.length;
    expect((await a.op({ type: 'prereq', prereqId: pre.id, questionId: pre.verify[0].id, choice: wrong })).status).toBe(200);
    expect(await a.op({ type: 'prereq', prereqId: pre.id, questionId: pre.verify[0].id, choice: wrong })).toMatchObject({ status: 409, body: { error: 'locked' } });
    expect((await a.op({ type: 'remedy', prereqId: pre.id })).status).toBe(200);
    expect((await a.op({ type: 'prereq', prereqId: pre.id, questionId: pre.recheck.id, choice: pre.recheck.correct })).status).toBe(200);
    expect((await a.op({ type: 'remedy', prereqId: 'nope' })).status).toBe(400);

    expect(await t.op({ type: 'phase', phase: 'predict' })).toMatchObject({ status: 409, body: { error: 'wrong_phase' } });
    expect((await t.op({ type: 'choose', experimentId: 'nope' })).status).toBe(400);
    await t.op({ type: 'choose', experimentId: x.id });
    await t.op({ type: 'phase', phase: 'predict' });
    expect((await a.op({ type: 'predict', outcome: x.choices[0] })).status).toBe(200);
    expect(await a.op({ type: 'predict', outcome: x.choices[1] })).toMatchObject({ status: 409, body: { error: 'locked' } });
    await t.op({ type: 'phase', phase: 'observe' });
    expect((await a.op({ type: 'observe', note: 'شفت نقط' })).status).toBe(200);
    await t.op({ type: 'phase', phase: 'revise' });
    expect((await a.op({ type: 'revise', text: 'في مي بالهوا بتبرد وبتصير نقط' })).status).toBe(200);
    await t.op({ type: 'phase', phase: 'transfer' });
    expect((await a.op({ type: 'transfer', text: 'الندى من الهوا', choice: 0 })).status).toBe(200);
    const end = await t.op({ type: 'phase', phase: 'insight' });
    expect(end.body.participants[0].record.events.map((e) => e.type)).toEqual(['explain', 'prereq', 'remedy', 'prereq', 'predict', 'observe', 'explain', 'transfer']);
  });

  it('removes a learner, then closes the room to everyone but its teacher', async () => {
    const t = await open();
    const a = await join(t.code), b = await join(t.code);
    expect((await t.op({ type: 'remove', participantId: a.participantId })).body.participants).toHaveLength(1);
    expect((await a.view()).status).toBe(403);
    expect((await a.op({ type: 'explain', text: 'x' })).status).toBe(403);
    const before = (await t.view()).body.version;
    const c = await join(t.code);
    // one left, one joined: the version still moves
    expect((await t.view()).body.version).not.toBe(before);

    expect((await t.op({ type: 'close' })).status).toBe(200);
    const closed = { status: 410, body: { error: 'room_closed' } };
    expect(await call(room, { action: 'join', code: t.code })).toMatchObject(closed);
    expect(await b.view()).toMatchObject(closed);
    expect(await c.op({ type: 'explain', text: 'x' })).toMatchObject(closed);
    expect(await call(room, { action: 'view', code: t.code, role: 'screen' })).toMatchObject(closed);
    expect(await t.op({ type: 'phase', phase: 'map' })).toMatchObject(closed);
    expect((await t.view()).body.meta.closed).toBe(true);
  });

  it('expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t = await open();
    const a = await join(t.code);
    vi.setSystemTime(Date.now() + ROOM_TTL_MS - 1_000);
    expect((await a.view()).status).toBe(200);
    vi.setSystemTime(Date.now() + 2_000);
    for (const r of [await a.view(), await t.view(), await t.op({ type: 'close' }), await a.op({ type: 'explain', text: 'x' }), await call(room, { action: 'join', code: t.code })]) {
      expect(r).toMatchObject({ status: 404, body: { error: 'no_room' } });
    }
  });

  it('keeps every simultaneous submission, also while the teacher writes to everyone', async () => {
    const t = await open();
    const seats = await Promise.all(Array.from({ length: 30 }, () => join(t.code)));
    expect(new Set(seats.map((s) => s.alias)).size).toBe(30);
    await t.op({ type: 'phase', phase: 'explain' });
    const explained = await Promise.all(seats.map((s) => s.op({ type: 'explain', text: SECRET_TEXT })));
    expect(explained.map((r) => r.status)).toEqual(seats.map(() => 200));
    await t.op({ type: 'choose', experimentId: x.id });
    await t.op({ type: 'phase', phase: 'predict' });
    const raced = await Promise.all([
      ...seats.slice(0, 15).map((s) => s.op({ type: 'predict', outcome: x.choices[0] })),
      t.op({ type: 'phase', phase: 'predict' }),
      ...seats.slice(15).map((s) => s.op({ type: 'predict', outcome: x.choices[1] })),
    ]);
    expect(raced.every((r) => r.status === 200)).toBe(true);
    await t.op({ type: 'phase', phase: 'observe' });
    const notes = await Promise.all([
      ...seats.map((s, i) => s.op({ type: 'observe', note: `ملاحظة ${i}` })),
      // observing again touches every participant
      t.op({ type: 'phase', phase: 'observe' }),
      t.op({ type: 'phase', phase: 'discuss' }),
    ]);
    expect(notes.every((r) => r.status === 200)).toBe(true);
    const all = (await t.view()).body.participants;
    expect(all).toHaveLength(30);
    for (const s of seats) {
      const events = all.find((p) => p.id === s.participantId)!.record.events;
      expect(events.map((e) => e.type)).toEqual(['explain', 'predict', 'observe']);
      expect((events[2] as { note: string }).note).toBe(`ملاحظة ${seats.indexOf(s)}`);
    }
  });

  it('a double submission is judged by the room rules, once', async () => {
    const t = await open();
    const a = await join(t.code);
    await t.op({ type: 'choose', experimentId: x.id });
    await t.op({ type: 'phase', phase: 'predict' });
    const twice = await Promise.all([a.op({ type: 'predict', outcome: x.choices[0] }), a.op({ type: 'predict', outcome: x.choices[1] })]);
    expect(twice.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await t.view()).body.participants[0].record.events).toHaveLength(1);
  });
}

describe('classroom (memory store)', () => {
  classroomSuite(() => {});

  it('stores only hashes of the keys', async () => {
    const t = await open();
    const a = await join(t.code);
    const stored = JSON.stringify([...(globalThis as unknown as { __silsilaRooms: Map<string, unknown> }).__silsilaRooms]);
    expect(stored).toContain(t.code);
    expect(stored).not.toContain(t.teacherKey);
    expect(stored).not.toContain(a.key);
  });

  it('asks the model only when the rules allow, sends no identity, and keeps out-of-order answers', async () => {
    const t = await open();
    const seats = await Promise.all(Array.from({ length: 12 }, (_, i) => join(t.code, `Zed${i}`)));
    let n = 0;
    const sent = mockModel(async () => {
      await new Promise((r) => setTimeout(r, (12 - (n++ % 12)) * 3));
      return toolReply(evidence);
    });
    expect((await seats[0].op({ type: 'explain', text: SECRET_TEXT })).status).toBe(409);
    expect(sent).toHaveLength(0);
    await t.op({ type: 'phase', phase: 'explain' });
    const done = await Promise.all(seats.map((s) => s.op({ type: 'explain', text: SECRET_TEXT })));
    expect(done.every((r) => r.status === 200)).toBe(true);
    expect(sent).toHaveLength(12);
    for (const s of sent) {
      const prompt = JSON.stringify(s.body);
      for (const seat of seats) {
        expect(prompt).not.toContain(seat.participantId);
        expect(prompt).not.toContain('Zed');
      }
      expect(prompt).not.toContain(t.code);
    }
    const all = (await t.view()).body.participants;
    expect(all.every((p) => p.record.events.length === 1)).toBe(true);
    expect(all.every((p) => (p.record.events[0] as { diagnosis: { source: string } }).diagnosis.source === 'ai')).toBe(true);
  });

  it('re-checks the rules after the model answers: the teacher may have moved on', async () => {
    const t = await open();
    const a = await join(t.code);
    await t.op({ type: 'phase', phase: 'revise' });
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    let asked!: () => void;
    const calling = new Promise<void>((r) => { asked = r; });
    mockModel(async () => { asked(); await held; return toolReply(evidence); });
    const pending = a.op({ type: 'revise', text: SECRET_TEXT });
    await calling;
    // the room is not locked while the model works
    expect((await t.op({ type: 'phase', phase: 'transfer' })).status).toBe(200);
    release();
    expect(await pending).toMatchObject({ status: 409, body: { error: 'wrong_phase' } });
    expect((await t.view()).body.participants[0].record.events).toHaveLength(0);
  });
});

/* ───────── a small Upstash stand-in (REST commands and the two scripts) ───────── */

function fakeUpstash() {
  const strings = new Map<string, { value: string; until: number }>();
  const hashes = new Map<string, { fields: Map<string, string>; until: number }>();
  const control = { loseLocks: 0, commits: 0 };
  const str = (k: string) => { const e = strings.get(k); if (e && e.until <= Date.now()) strings.delete(k); return strings.get(k)?.value ?? null; };
  const hash = (k: string) => { const e = hashes.get(k); if (e && e.until <= Date.now()) hashes.delete(k); return hashes.get(k); };

  function run(cmd: (string | number)[]): unknown {
    const [name, ...a] = cmd.map(String);
    if (name === 'SET') {
      const [key, value, ...opts] = a;
      if (opts.includes('NX') && str(key) !== null) return null;
      const px = opts.indexOf('PX'), at = opts.indexOf('PXAT');
      strings.set(key, { value, until: px >= 0 ? Date.now() + Number(opts[px + 1]) : at >= 0 ? Number(opts[at + 1]) : Infinity });
      return 'OK';
    }
    if (name === 'GET') return str(a[0]);
    if (name === 'HGETALL') return [...(hash(a[0])?.fields ?? [])].flat();
    if (name === 'EVAL') {
      const [script, count, ...rest] = a;
      const keys = rest.slice(0, Number(count)), argv = rest.slice(Number(count));
      if (!script.includes('HSET')) { if (str(keys[0]) === argv[0]) { strings.delete(keys[0]); return 1; } return 0; }
      if (control.loseLocks > 0) { control.loseLocks--; strings.delete(keys[0]); }
      if (str(keys[0]) !== argv[0]) return 0;
      const until = Number(argv[2]), gone = Number(argv[3]);
      strings.set(keys[1], { value: argv[1], until });
      const entry = hash(keys[2]) ?? { fields: new Map<string, string>(), until };
      argv.slice(4, 4 + gone).forEach((f) => entry.fields.delete(f));
      for (let i = 4 + gone; i < argv.length; i += 2) entry.fields.set(argv[i], argv[i + 1]);
      entry.until = until;
      hashes.set(keys[2], entry);
      strings.delete(keys[0]);
      control.commits++;
      return 1;
    }
    throw new Error(`fake redis: ${name}`);
  }

  const handle = async (url: string, init: RequestInit): Promise<Response> => {
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer redis-token');
    // a little latency, so simultaneous requests really interleave
    await Promise.resolve();
    const body = JSON.parse(init.body as string);
    return url.endsWith('/pipeline') || url.endsWith('/multi-exec')
      ? Response.json((body as (string | number)[][]).map((c) => ({ result: run(c) })))
      : Response.json({ result: run(body) });
  };
  return { handle, control, strings, hashes };
}

describe('classroom (Upstash Redis store)', () => {
  let redis: ReturnType<typeof fakeUpstash>;
  classroomSuite(() => {
    redis = fakeUpstash();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-token');
    vi.stubGlobal('fetch', redis.handle);
  });

  it('says so in health, and stores hashes only, one entry per learner', async () => {
    expect((await call(health, {})).body.store).toBe('redis');
    const t = await open();
    const a = await join(t.code);
    await join(t.code);
    const people = redis.hashes.get(`silsila:room:${t.code}:p`)!;
    expect(people.fields.size).toBe(2);
    expect(people.until).toBeGreaterThan(Date.now());
    const stored = JSON.stringify([[...redis.strings], [...people.fields]]);
    expect(stored).not.toContain(t.teacherKey);
    expect(stored).not.toContain(a.key);
    expect(redis.strings.has(`silsila:room:${t.code}:lock`)).toBe(false);
  });

  it('writes nothing after losing the lock, and tries again', async () => {
    const t = await open();
    const a = await join(t.code);
    redis.control.loseLocks = 2;
    const commits = redis.control.commits;
    expect((await t.op({ type: 'phase', phase: 'explain' })).status).toBe(200);
    expect(redis.control.commits).toBe(commits + 1);
    expect((await a.view()).body.meta.phase).toBe('explain');
  });

  it('waits for a lock another instance holds', async () => {
    const t = await open();
    redis.strings.set(`silsila:room:${t.code}:lock`, { value: 'someone-else', until: Date.now() + 150 });
    const started = Date.now();
    expect((await t.op({ type: 'phase', phase: 'explain' })).status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(140);
  });

  it('reports a store failure as store_failed', async () => {
    vi.stubGlobal('fetch', async () => new Response('no', { status: 500 }));
    expect(await call(room, { action: 'create', settings: settings() })).toMatchObject({ status: 503, body: { error: 'store_failed' } });
  });
});
