/**
 * Sessions live on this device only (IndexedDB). No accounts, no cloud, no real names, no audio.
 * The teacher exports them as JSON from the teacher screen.
 */
import { createStore, del, entries, set } from 'idb-keyval';
import type { Session } from '../contracts';
import { Session as SessionSchema } from '../contracts';

const store = createStore('silsila', 'sessions');

export async function saveSession(s: Session): Promise<void> {
  await set(s.id, s, store);
}

export async function loadSessions(): Promise<Session[]> {
  const all = await entries<string, unknown>(store);
  return all
    .map(([, v]) => SessionSchema.safeParse(v))
    .filter((r) => r.success)
    .map((r) => r.data as Session)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function deleteSession(id: string): Promise<void> {
  await del(id, store);
}

export function newSession(pseudonym: string, grade: number): Session {
  return {
    id: (crypto.randomUUID?.() ?? String(Date.now())) as string,
    pseudonym, grade, startedAt: Date.now(), finishedAt: null,
    pre: null, post: null, explanations: [], experiments: [], teach: null, demo: false,
  };
}
