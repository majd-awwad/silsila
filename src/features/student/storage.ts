/** Local solo checkpoints. IndexedDB remains the report archive, while each pack has one atomic resume snapshot. */
import type { LearnerRecord } from '../../contracts';
import type { Journey } from '../../flow/journey';
import { parsePointer, resumeJourney, toPointer } from '../../flow/persist';
import type { Pointer } from '../../flow/persist';
import { PACK_LIST, PACKS } from '../../packs';
import { loadRecords, saveRecord } from '../../store/records';

const LEGACY = 'silsila-lesson';
const key = (pack: string) => 'silsila-lesson:' + pack;
type Saved = { journey: Journey; savedAt: number; revision: string | null; recovered?: boolean };
type Checkpoint = { pointer: Pointer; savedAt: number; revision: string };
const read = (name: string) => { try { return localStorage.getItem(name); } catch { return null; } };
const write = (name: string, value: string) => {
  try { localStorage.setItem(name, value); return true; } catch { return false; }
};

function checkpoint(pack: string): Checkpoint | null {
  const raw = read(key(pack));
  if (!raw) return null;
  try {
    const item = JSON.parse(raw);
    const pointer = parsePointer(JSON.stringify(item.pointer));
    if (!pointer?.record || pointer.pack !== pack || pointer.record.id !== pointer.recordId
      || pointer.record.pack !== pack || pointer.record.classCode || typeof item.revision !== 'string'
      || !Number.isFinite(item.savedAt)) return null;
    return { pointer, savedAt: item.savedAt, revision: item.revision };
  } catch { return null; }
}

export function saveLesson(journey: Journey, expected?: string | null, archive = true) {
  const pack = journey.record.pack;
  const previous = checkpoint(pack);
  if (expected !== undefined && (previous?.revision ?? null) !== expected) return { status: 'conflict' as const };
  const revision = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const savedAt = Date.now();
  const stored = write(key(pack), JSON.stringify({ pointer: toPointer(journey, true), savedAt, revision }));
  // No delayed promise can replace an active checkpoint. The archive receives only committed journeys.
  if (stored && archive) void saveRecord(journey.record).catch(() => {});
  return stored ? { status: 'saved' as const, revision, savedAt } : { status: 'unavailable' as const };
}

function recover(record: LearnerRecord): Journey {
  const pack = PACKS[record.pack];
  const last = record.events.at(-1);
  const step = record.finishedAt ? 'summary'
    : last?.type === 'transfer' ? 'posttest'
    : last?.type === 'challenge' ? 'challenge'
    : last?.type === 'teach' ? 'teach'
    : last?.type === 'observe' ? 'reflect'
    : last?.type === 'explain' ? (last.diagnosis.model ? 'understood' : 'clarify')
    : last && ['prereq', 'remedy'].includes(last.type) ? 'prereq'
    : last?.type === 'quiz' ? 'phenomenon' : 'meet';
  const seen = [...record.events].reverse().find((event) => event.type === 'observe');
  return resumeJourney(pack, record, toPointer({
    record, step, quick: false, cond: seen?.cond ?? pack.baseline, experimentId: seen?.experimentId ?? null, pending: null,
  }));
}

export async function loadLessons(): Promise<Record<string, Saved>> {
  const out: Record<string, Saved> = {};
  for (const pack of PACK_LIST) {
    const saved = checkpoint(pack.id);
    if (saved) out[pack.id] = { journey: resumeJourney(pack, saved.pointer.record!, saved.pointer), savedAt: saved.savedAt, revision: saved.revision };
  }
  const legacy = parsePointer(read(LEGACY));
  let records: LearnerRecord[] = [];
  if (PACK_LIST.some((pack) => !out[pack.id] && read(key(pack.id)) !== 'reset')) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      records = await Promise.race([loadRecords(), new Promise<LearnerRecord[]>((resolve) => { timer = setTimeout(() => resolve([]), 1300); })]);
    } catch { /* device storage may be unavailable */ }
    finally { clearTimeout(timer); }
  }
  if (legacy && Object.hasOwn(PACKS, legacy.pack) && !out[legacy.pack] && read(key(legacy.pack)) !== 'reset') {
    const archived = records.find((item) => item.id === legacy.recordId && item.pack === legacy.pack);
    const embedded = legacy.record?.id === legacy.recordId && legacy.record.pack === legacy.pack ? legacy.record : undefined;
    const record = archived && (!embedded || archived.events.length > embedded.events.length) ? archived : embedded;
    if (record?.id === legacy.recordId && record.pack === legacy.pack && !record.classCode) {
      out[legacy.pack] = { journey: resumeJourney(PACKS[legacy.pack], record, legacy), savedAt: record.events.at(-1)?.at ?? record.startedAt, revision: null };
    }
  }
  for (const record of records) {
    if (record.classCode || record.sample || !record.events.length || !Object.hasOwn(PACKS, record.pack)
      || read(key(record.pack)) === 'reset' || out[record.pack]) continue;
    out[record.pack] = { journey: recover(record), savedAt: record.events.at(-1)?.at ?? record.startedAt, revision: null, recovered: true };
  }
  return out;
}

export async function loadLesson(pack?: string): Promise<Journey | null> {
  const all = await loadLessons();
  return (pack ? all[pack] : Object.values(all).sort((a, b) => b.savedAt - a.savedAt)[0])?.journey ?? null;
}

export function forgetLesson(pack: string, expected?: string | null): boolean {
  if (expected !== undefined && (checkpoint(pack)?.revision ?? null) !== expected) return false;
  // A tombstone prevents an intentionally restarted lesson from resurfacing from the report archive.
  return write(key(pack), 'reset');
}

export function clearSoloDrafts(): void {
  try {
    const storage = localStorage;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const name of keys) if (name?.startsWith('silsila-student-draft:')) storage.removeItem(name);
    for (const pack of PACK_LIST) storage.setItem(key(pack.id), 'reset');
    storage.removeItem(LEGACY);
  } catch { /* private mode */ }
}
