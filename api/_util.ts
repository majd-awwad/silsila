/** Shared helpers for the API functions (files starting with _ are not deployed as endpoints). */
import { getPack, PACKS } from '../src/packs';
import type { ConceptPack } from '../src/packs/types';

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const j = await request.json();
    return j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function packFrom(body: Record<string, unknown> | null): ConceptPack | null {
  const id = body?.pack;
  return typeof id === 'string' && PACKS[id] ? getPack(id) : null;
}

export const bad = () => Response.json({ error: 'bad_request' }, { status: 400 });

export function cleanText(x: unknown, max = 600): string | null {
  return typeof x === 'string' && x.trim() && x.length <= max ? x.trim() : null;
}

export function logFallback(where: string, e: unknown) {
  console.error(`[${where}] AI failed, using fallback:`, (e as Error)?.message ?? e);
}
