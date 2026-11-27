/**
 * Live classroom storage. With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or Vercel's KV_REST_API_URL +
 * KV_REST_API_TOKEN) rooms live in Upstash Redis and are shared by all serverless instances. Without them they
 * live in memory, written to a local file after every committed change (.data/rooms.json, or SILSILA_DATA_DIR), so a
 * laptop restart keeps the rooms, the learners and the teacher's key. SILSILA_STORE=memory turns the file off (tests).
 * Not available on Vercel, where a file would not be shared between instances.
 *
 * A room is one «head» document (meta, key hashes, revision) plus one entry per participant, so a learner's write
 * rewrites that learner only. Every change runs under a per-room lock: a promise chain inside this process, and in
 * Redis also SET NX PX, with a commit script that writes nothing if the lock was lost.
 *
 * Redis keys (all expire with the room):
 *   silsila:room:CODE        head JSON
 *   silsila:room:CODE:p      hash participantId → {seq, p}
 *   silsila:room:CODE:lock   lock token
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RoomMeta, RoomParticipant } from '../src/contracts';

export interface Head {
  meta: RoomMeta;
  /** SHA-256 of the teacher key, hex */
  teacherHash: string;
  /** participant id → SHA-256 of that learner's key, hex */
  keys: Record<string, string>;
  /** grows with every committed change */
  rev: number;
}

export interface Snapshot { head: Head; participants: RoomParticipant[] }

export interface Change<T> {
  value: T;
  /** absent: nothing is written */
  commit?: { meta: RoomMeta; participants: RoomParticipant[]; keys: Record<string, string> };
}

export interface RoomStore {
  kind: 'memory' | 'file' | 'redis';
  /** false when the code is already in use */
  create(head: Head): Promise<boolean>;
  /** null when there is no such room or it has expired */
  head(code: string): Promise<Head | null>;
  /** the room at least as new as `head` */
  read(head: Head): Promise<Snapshot | null>;
  /**
   * Run `change` on the latest state, with exclusive access, and write what it commits. `change` must be
   * synchronous and may run again if the lock was lost. Unchanged participants must keep their object identity.
   */
  update<T>(code: string, change: (snapshot: Snapshot | null) => Change<T>): Promise<T>;
}

const expired = (head: Head) => head.meta.expiresAt <= Date.now();

const g = globalThis as unknown as {
  __silsilaRooms?: Map<string, Snapshot>;
  __silsilaRoomQueues?: Map<string, Promise<unknown>>;
};
// on globalThis so rooms survive Vite reloading this module during development
const rooms = (g.__silsilaRooms ??= new Map<string, Snapshot>());
const queues = (g.__silsilaRoomQueues ??= new Map<string, Promise<unknown>>());

/** One change at a time per room inside this process. */
function inTurn<T>(code: string, work: () => Promise<T>): Promise<T> {
  const result = (queues.get(code) ?? Promise.resolve()).then(work);
  const tail = result.then(() => undefined, () => undefined);
  queues.set(code, tail);
  void tail.then(() => { if (queues.get(code) === tail) queues.delete(code); });
  return result;
}

const nextHead = (head: Head, commit: NonNullable<Change<unknown>['commit']>): Head =>
  ({ teacherHash: head.teacherHash, meta: commit.meta, keys: commit.keys, rev: head.rev + 1 });

/* ───────────────────────── memory ───────────────────────── */

const MAX_MEMORY_ROOMS = 500;

function live(code: string): Snapshot | null {
  const s = rooms.get(code);
  if (!s) return null;
  if (expired(s.head)) { rooms.delete(code); return null; }
  return s;
}

/* ───────────────────────── file (local laptop) ───────────────────────── */

const dataFile = () => join(process.env.SILSILA_DATA_DIR || '.data', 'rooms.json');
const state = globalThis as unknown as { __silsilaRoomsLoaded?: boolean };

/** Read the file once per process. A damaged file is set aside, never overwritten blindly. */
function loadFile(): void {
  if (state.__silsilaRoomsLoaded) return;
  state.__silsilaRoomsLoaded = true;
  let raw: string;
  try { raw = readFileSync(dataFile(), 'utf8'); } catch { return; }
  try {
    const list = JSON.parse(raw) as [string, Snapshot][];
    for (const [code, snapshot] of list) if (!expired(snapshot.head) && !rooms.has(code)) rooms.set(code, snapshot);
  } catch {
    try { renameSync(dataFile(), dataFile() + '.damaged-' + Date.now()); } catch { /* keep going in memory */ }
  }
}

/** Temp file, then rename: a crash in the middle leaves the previous complete file. */
function saveFile(): void {
  try {
    const file = dataFile();
    mkdirSync(join(file, '..'), { recursive: true });
    const live = [...rooms.entries()].filter(([, s]) => !expired(s.head));
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(live));
    renameSync(temp, file);
  } catch (e) {
    // the room still works from memory; say why it will not survive a restart
    console.error('room file not written:', e instanceof Error ? e.message : 'unknown');
  }
}

function local(kind: 'memory' | 'file'): RoomStore {
  const persist = kind === 'file';
  return {
    kind,
    async create(head) {
      if (persist) loadFile();
      for (const code of rooms.keys()) live(code);
      if (rooms.has(head.meta.code)) return false;
      if (rooms.size >= MAX_MEMORY_ROOMS) throw new Error('store_full');
      rooms.set(head.meta.code, { head, participants: [] });
      if (persist) saveFile();
      return true;
    },
    async head(code) {
      if (persist) loadFile();
      return live(code)?.head ?? null;
    },
    async read(head) {
      if (persist) loadFile();
      return live(head.meta.code);
    },
    update(code, change) {
      if (persist) loadFile();
      return inTurn(code, async () => {
        const snapshot = live(code);
        const { value, commit } = change(snapshot);
        if (commit && snapshot) {
          rooms.set(code, { head: nextHead(snapshot.head, commit), participants: commit.participants });
          if (persist) saveFile();
        }
        return value;
      });
    },
  };
}

const memory = local('memory');
const file = local('file');

/* ───────────────────────── Upstash Redis (REST) ───────────────────────── */

const LOCK_MS = 8_000;
/** below the browser's own timeouts for join, teacher and student calls */
const LOCK_WAIT_MS = 12_000;
const MAX_CACHED = 50;

const COMMIT = `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'PXAT', ARGV[3])
local gone = tonumber(ARGV[4])
for i = 5, 4 + gone do redis.call('HDEL', KEYS[3], ARGV[i]) end
for i = 5 + gone, #ARGV, 2 do redis.call('HSET', KEYS[3], ARGV[i], ARGV[i + 1]) end
redis.call('PEXPIREAT', KEYS[3], ARGV[3])
redis.call('DEL', KEYS[1])
return 1`;

const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

const config = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
};

async function send(path: '' | '/pipeline' | '/multi-exec', body: unknown): Promise<unknown> {
  const c = config()!;
  const r = await fetch(c.url + path, {
    method: 'POST',
    headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  });
  if (!r.ok) throw new Error(`redis_http_${r.status}`);
  return r.json();
}

type Reply = { result?: unknown; error?: string };
const unwrap = (reply: Reply): unknown => {
  if (reply.error) throw new Error('redis_command');
  return reply.result;
};
const command = async (cmd: (string | number)[]) => unwrap((await send('', cmd)) as Reply);
const batch = async (path: '/pipeline' | '/multi-exec', cmds: (string | number)[][]) => ((await send(path, cmds)) as Reply[]).map(unwrap);

const keysOf = (code: string) => ({ head: `silsila:room:${code}`, people: `silsila:room:${code}:p`, lock: `silsila:room:${code}:lock` });

function parseHead(raw: unknown): Head | null {
  if (typeof raw !== 'string') return null;
  const head = JSON.parse(raw) as Head;
  return expired(head) ? null : head;
}

interface Cached { snapshot: Snapshot; seqs: Map<string, number> }
/** the last state seen per room, so polling screens reload participants only after a change */
const cache = new Map<string, Cached>();

function remember(code: string, entry: Cached): Cached {
  cache.delete(code);
  cache.set(code, entry);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return entry;
}

const cachedFor = (head: Head): Cached | null => {
  const c = cache.get(head.meta.code);
  return c && c.snapshot.head.rev === head.rev && c.snapshot.head.meta.createdAt === head.meta.createdAt ? c : null;
};

/** HGETALL comes back as [field, value, field, value, …]. */
function parsePeople(head: Head, raw: unknown): Cached {
  const flat = Array.isArray(raw) ? (raw as string[]) : [];
  const rows: { seq: number; p: RoomParticipant }[] = [];
  for (let i = 1; i < flat.length; i += 2) rows.push(JSON.parse(flat[i]) as { seq: number; p: RoomParticipant });
  rows.sort((a, b) => a.seq - b.seq);
  return { snapshot: { head, participants: rows.map((r) => r.p) }, seqs: new Map(rows.map((r) => [r.p.id, r.seq])) };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const redis: RoomStore = {
  kind: 'redis',
  async create(head) {
    return (await command(['SET', keysOf(head.meta.code).head, JSON.stringify(head), 'NX', 'PXAT', head.meta.expiresAt])) === 'OK';
  },
  async head(code) {
    return parseHead(await command(['GET', keysOf(code).head]));
  },
  async read(head) {
    const hit = cachedFor(head);
    if (hit) return { head, participants: hit.snapshot.participants };
    const k = keysOf(head.meta.code);
    const [rawHead, rawPeople] = await batch('/multi-exec', [['GET', k.head], ['HGETALL', k.people]]);
    const fresh = parseHead(rawHead);
    return fresh ? remember(fresh.meta.code, parsePeople(fresh, rawPeople)).snapshot : null;
  },
  update(code, change) {
    return inTurn(code, async () => {
      const k = keysOf(code);
      const deadline = Date.now() + LOCK_WAIT_MS;
      for (let attempt = 0; ; attempt++) {
        const token = randomBytes(16).toString('hex');
        const [locked, rawHead] = await batch('/pipeline', [['SET', k.lock, token, 'NX', 'PX', LOCK_MS], ['GET', k.head]]);
        if (locked === 'OK') {
          let released = false;
          try {
            const head = parseHead(rawHead);
            const state = head ? cachedFor(head) ?? remember(code, parsePeople(head, await command(['HGETALL', k.people]))) : null;
            const snapshot = state && head ? { head, participants: state.snapshot.participants } : null;
            const { value, commit } = change(snapshot);
            if (!commit || !snapshot || !state) return value;

            const next = nextHead(snapshot.head, commit);
            const before = new Map(snapshot.participants.map((p) => [p.id, p]));
            const seqs = new Map<string, number>();
            const written: string[] = [];
            for (const p of commit.participants) {
              const seq = state.seqs.get(p.id) ?? next.rev;
              seqs.set(p.id, seq);
              if (before.get(p.id) !== p) written.push(p.id, JSON.stringify({ seq, p }));
              before.delete(p.id);
            }
            const gone = [...before.keys()];
            const done = await command(['EVAL', COMMIT, 3, k.lock, k.head, k.people, token, JSON.stringify(next), next.meta.expiresAt, gone.length, ...gone, ...written]);
            if (Number(done) === 1) {
              released = true;
              remember(code, { snapshot: { head: next, participants: commit.participants }, seqs });
              return value;
            }
            // the lock expired under us: nothing was written, so start again from the current state
          } finally {
            if (!released) await command(['EVAL', RELEASE, 1, k.lock, token]).catch(() => {});
          }
        }
        if (Date.now() >= deadline) throw new Error('lock_timeout');
        await sleep(Math.min(250, 20 + attempt * 15) + Math.random() * 30);
      }
    });
  },
};

/** null: hosted on Vercel without Redis, where memory would not be shared between instances. */
export const storeKind = (): 'redis' | 'file' | 'memory' | null =>
  config() ? 'redis' : process.env.VERCEL ? null : process.env.SILSILA_STORE === 'memory' ? 'memory' : 'file';

export function roomStore(): RoomStore | null {
  const kind = storeKind();
  return kind === 'redis' ? redis : kind === 'file' ? file : kind === 'memory' ? memory : null;
}

/** For tests. */
export function resetStores(): void {
  state.__silsilaRoomsLoaded = false;
  rooms.clear();
  queues.clear();
  cache.clear();
}
