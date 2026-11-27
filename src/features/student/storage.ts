/**
 * Where the lesson lives on this device: the learner record in IndexedDB (src/store/records.ts) and a small pointer
 * to it in localStorage, written after the record. Private modes may refuse either: the lesson still runs.
 */
import type { LearnerRecord } from '../../contracts';
import type { Journey } from '../../flow/journey';
import { parsePointer, resumeJourney, toPointer } from '../../flow/persist';
import { PACKS } from '../../packs';
import { loadRecords, saveRecord } from '../../store/records';

const KEY = 'silsila-lesson';
const WAIT_MS = 3000;

const within = <T>(work: Promise<T>): Promise<T> =>
  Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('storage_timeout')), WAIT_MS))]);

/** raised by «start again», so a save still in flight cannot bring the old lesson back */
let generation = 0;
let queue: Promise<void> = Promise.resolve();

export function saveLesson(journey: Journey): Promise<void> {
  const mine = generation;
  queue = queue.then(async () => {
    let stored = true;
    try { await within(saveRecord(journey.record)); } catch { stored = false; }
    if (mine !== generation) return;
    try { localStorage.setItem(KEY, JSON.stringify(toPointer(journey, !stored))); } catch { /* private mode */ }
  });
  return queue;
}

export async function loadLesson(): Promise<Journey | null> {
  try {
    const pointer = parsePointer(localStorage.getItem(KEY));
    if (!pointer || !PACKS[pointer.pack]) return null;
    let record: LearnerRecord | undefined = pointer.record;
    record ??= (await within(loadRecords())).find((r) => r.id === pointer.recordId);
    return record && record.pack === pointer.pack ? resumeJourney(PACKS[pointer.pack], record, pointer) : null;
  } catch {
    return null;
  }
}

/** Forget which lesson is open. The finished record stays on the device for the teacher. */
export function forgetLesson(): void {
  generation++;
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
