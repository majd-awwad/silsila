/**
 * Lessons done on this device are stored on this device only (IndexedDB). No accounts, no real names, no audio.
 */
import { createStore, del, entries, set } from 'idb-keyval';
import type { LearnerRecord } from '../contracts';
import { LearnerRecord as RecordSchema } from '../contracts';

let cached: ReturnType<typeof createStore> | null = null;
const store = () => (cached ??= createStore('silsila-records', 'records'));

export async function saveRecord(r: LearnerRecord): Promise<void> {
  await set(r.id, r, store());
}

export async function loadRecords(): Promise<LearnerRecord[]> {
  const all = await entries<string, unknown>(store());
  return all
    .map(([, v]) => RecordSchema.safeParse(v))
    .flatMap((r) => (r.success ? [r.data] : []))
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function deleteRecord(id: string): Promise<void> {
  await del(id, store());
}

export async function clearRecords(): Promise<void> {
  for (const r of await loadRecords()) await deleteRecord(r.id);
}

export const newId = (): string => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
