/**
 * Live class storage. With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set (free Upstash Redis),
 * classes are shared across all serverless instances. Without them, an in-memory map is used: fine when the
 * app runs on one laptop (`npm run dev -- --host`) and judges join over the same Wi-Fi, not reliable on Vercel.
 */
import type { ClassEntry } from '../src/contracts';

const TTL = 60 * 60 * 24;
const g = globalThis as unknown as { __silsilaClasses?: Map<string, { created: number; pack: string; entries: Map<string, ClassEntry> }> };
const mem = (g.__silsilaClasses ??= new Map());

const url = () => process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN;
export const storeKind = (): 'redis' | 'memory' => (url() && token() ? 'redis' : 'memory');

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const r = await fetch(url()!, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'content-type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('redis_' + r.status);
  return ((await r.json()) as { result: unknown }).result;
}

export async function createClass(code: string, pack: string): Promise<void> {
  if (storeKind() === 'redis') { await redis(['SET', `silsila:class:${code}`, pack, 'EX', TTL]); return; }
  mem.set(code, { created: Date.now(), pack, entries: new Map() });
}

export async function classPack(code: string): Promise<string | null> {
  if (storeKind() === 'redis') return (await redis(['GET', `silsila:class:${code}`])) as string | null;
  return mem.get(code)?.pack ?? null;
}

export async function putEntry(code: string, e: ClassEntry): Promise<void> {
  if (storeKind() === 'redis') {
    await redis(['HSET', `silsila:entries:${code}`, e.id, JSON.stringify(e)]);
    await redis(['EXPIRE', `silsila:entries:${code}`, TTL]);
    return;
  }
  mem.get(code)?.entries.set(e.id, e);
}

export async function listEntries(code: string): Promise<ClassEntry[]> {
  if (storeKind() === 'redis') {
    const flat = ((await redis(['HGETALL', `silsila:entries:${code}`])) as string[] | null) ?? [];
    const out: ClassEntry[] = [];
    for (let i = 1; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i])); } catch { /* skip */ } }
    return out;
  }
  return [...(mem.get(code)?.entries.values() ?? [])];
}
