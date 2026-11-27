/** Shared helpers for the API functions (files starting with _ are not deployed as endpoints). */
import type { z } from 'zod';
import { PACKS } from '../src/packs';
import type { ConceptPack } from '../src/packs/types';
import { take } from './_limit';
import type { LimitName } from './_limit';

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

export const error = (code: string, status: number, retryAfter = 0): Response =>
  json({ error: code }, status, retryAfter ? { 'retry-after': String(retryAfter) } : {});

/**
 * The caller's address, for rate limits only. Vercel sets x-forwarded-for itself; the dev server strips whatever
 * the client sent and sets x-silsila-ip from the socket.
 */
export function clientIp(request: Request): string {
  const h = request.headers;
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || h.get('x-silsila-ip') || 'unknown';
  return ip.slice(0, 64);
}

export type Body = { ok: true; value: unknown; bytes: number } | { ok: false; status: 400 | 413 | 415 };

/** Read a JSON body without ever holding more than `max` bytes of it. */
export async function readBody(request: Request, max: number): Promise<Body> {
  // a JSON content type also forces a CORS preflight, so another website cannot post here from a visitor's browser
  if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) return { ok: false, status: 415 };
  if (Number(request.headers.get('content-length') ?? 0) > max) return { ok: false, status: 413 };
  try {
    const reader = request.body?.getReader();
    if (!reader) return { ok: false, status: 400 };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.byteLength; }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(all)), bytes: size };
  } catch {
    return { ok: false, status: 400 };
  }
}

/** Rate limit, size limit and contract validation for one endpoint: the parsed input, or the error to return. */
export async function accept<T>(request: Request, schema: z.ZodType<T>, limit: LimitName, maxBytes: number): Promise<{ input: T } | { refuse: Response }> {
  const wait = take(limit, clientIp(request));
  if (wait) return { refuse: error('rate_limited', 429, wait) };
  const body = await readBody(request, maxBytes);
  if (!body.ok) return { refuse: error('bad_request', body.status) };
  const parsed = schema.safeParse(body.value);
  return parsed.success ? { input: parsed.data } : { refuse: error('bad_request', 400) };
}

/** A pack by id: own keys only, so ids like "constructor" are not packs. */
export const packById = (id: string): ConceptPack | null => (Object.hasOwn(PACKS, id) ? PACKS[id] : null);

/** Logs carry a short code only: never learner text, request bodies, provider replies or keys. */
export function logError(where: string, e: unknown): void {
  const message = e instanceof Error ? e.message : '';
  const code = /^[a-z]+(_[a-z]+)*(_\d{3})?$/.test(message) ? message : e instanceof Error ? e.name : 'unknown';
  console.error(`[${where}] ${code}`);
}
