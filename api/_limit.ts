/**
 * Token-bucket rate limits, in memory. IMPORTANT: on serverless hosting each instance keeps its own buckets, so
 * these are per-instance brakes against loops and casual abuse, not a global quota. The spending limit on the API
 * key is the real cost guard.
 *
 * Sized for a classroom of 40 learners behind ONE school Wi-Fi address, polling every 2 to 3 seconds.
 */
export const LIMITS = {
  /** per address: diagnose, teach, transfer */
  ai: { burst: 150, perSecond: 2 },
  /** per address: activity and lesson drafts */
  draft: { burst: 20, perSecond: 0.2 },
  stt: { burst: 90, perSecond: 1.5 },
  tts: { burst: 150, perSecond: 2 },
  health: { burst: 200, perSecond: 5 },
  roomCreate: { burst: 12, perSecond: 1 / 30 },
  /** per address, and per room code */
  roomJoin: { burst: 150, perSecond: 1 },
  roomJoinCode: { burst: 90, perSecond: 0.5 },
  /** learner writes: per address, per room and per seat; roomSeatAi covers the ones that may cost a model call */
  roomStudent: { burst: 400, perSecond: 8 },
  roomStudentCode: { burst: 300, perSecond: 5 },
  roomSeat: { burst: 30, perSecond: 0.5 },
  roomSeatAi: { burst: 10, perSecond: 0.2 },
  roomTeacher: { burst: 120, perSecond: 4 },
  /** per address: loose on purpose (about six classrooms polling behind one address) */
  roomView: { burst: 1200, perSecond: 120 },
  /** per address: unknown codes tried through join or the public screen view */
  roomMiss: { burst: 60, perSecond: 1 },
} as const;

export type LimitName = keyof typeof LIMITS;

interface Bucket { tokens: number; at: number; name: LimitName }

const g = globalThis as unknown as { __silsilaBuckets?: Map<string, Bucket> };
const buckets = (g.__silsilaBuckets ??= new Map<string, Bucket>());
const MAX_BUCKETS = 20_000;

const level = (b: Bucket, now: number) => Math.min(LIMITS[b.name].burst, b.tokens + ((now - b.at) / 1000) * LIMITS[b.name].perSecond);

function prune(now: number): void {
  for (const [k, b] of buckets) if (level(b, now) >= LIMITS[b.name].burst) buckets.delete(k);
  // still crowded (many active keys): drop the oldest
  for (const k of buckets.keys()) {
    if (buckets.size <= MAX_BUCKETS) break;
    buckets.delete(k);
  }
}

function bucket(name: LimitName, key: string, now: number): Bucket {
  const id = `${name}:${key}`;
  let b = buckets.get(id);
  if (!b) {
    if (buckets.size >= MAX_BUCKETS) prune(now);
    b = { tokens: LIMITS[name].burst, at: now, name };
    buckets.set(id, b);
  }
  b.tokens = level(b, now);
  b.at = now;
  return b;
}

/** Take one token. Returns 0 when allowed, otherwise the seconds to wait. */
export function take(name: LimitName, key: string, now = Date.now()): number {
  const b = bucket(name, key, now);
  if (b.tokens >= 1) { b.tokens -= 1; return 0; }
  return Math.max(1, Math.ceil((1 - b.tokens) / LIMITS[name].perSecond));
}

/** Like take, without consuming anything. */
export function wait(name: LimitName, key: string, now = Date.now()): number {
  const b = bucket(name, key, now);
  return b.tokens >= 1 ? 0 : Math.max(1, Math.ceil((1 - b.tokens) / LIMITS[name].perSecond));
}

export const resetLimits = (): void => buckets.clear();
