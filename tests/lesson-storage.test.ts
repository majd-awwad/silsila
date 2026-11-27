import { beforeEach, expect, it, vi } from 'vitest';
import { startJourney } from '../src/flow/journey';
import { forgetLesson, loadLesson, saveLesson } from '../src/features/student/storage';
import { getPack } from '../src/packs';
import { toPointer } from '../src/flow/persist';

vi.mock('../src/store/records', () => ({ loadRecords: async () => [], saveRecord: () => new Promise(() => undefined) }));
const state = (pack: string, step: 'meet' | 'explain') =>
  ({ ...startJourney(getPack(pack), { id: pack, alias: 'Explorer', grade: 4, lang: 'en', quick: true, at: 1 }), step });
let data: Map<string, string>;

beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});

it('checkpoints exact screens immediately even while IndexedDB is waiting', async () => {
  void saveLesson(state('condensation', 'explain'));
  expect(data.size).toBeGreaterThan(0);
  expect((await loadLesson())?.step).toBe('explain');
});

it('maintains independent checkpoints and resets only the selected lesson', async () => {
  void saveLesson(state('condensation', 'explain'));
  void saveLesson(state('fractions', 'meet'));
  expect((await loadLesson('condensation'))?.step).toBe('explain');
  expect((await loadLesson('fractions'))?.step).toBe('meet');
  await forgetLesson('fractions');
  expect(await loadLesson('fractions')).toBeNull();
  expect((await loadLesson('condensation'))?.step).toBe('explain');
});

it('reads a legacy snapshot from the same browser origin', async () => {
  data.set('silsila-lesson', JSON.stringify(toPointer(state('condensation', 'explain'), true)));
  expect((await loadLesson('condensation'))?.step).toBe('explain');
});


it('rejects writes from a tab that resumed an older revision', async () => {
  const initial = state('condensation', 'meet');
  const first = saveLesson(initial, null);
  if (first.status !== 'saved') throw new Error('Test checkpoint was not saved');
  expect(saveLesson({ ...initial, step: 'explain' }, first.revision).status).toBe('saved');
  expect(saveLesson(initial, first.revision).status).toBe('conflict');
  expect((await loadLesson('condensation'))?.step).toBe('explain');
});

it('restores the transfer check and its pending response without submitting it twice', async () => {
  const base = state('condensation', 'explain');
  const pending = { text: 'Vapour cools at the mirror.', source: 'fallback' as const, steps: [
    { met: false, evidence: '' }, { met: true, evidence: 'cools' }, { met: false, evidence: '' },
  ] };
  const saved = { ...base, step: 'check' as const, pending };
  expect(saveLesson(saved, null).status).toBe('saved');
  expect(await loadLesson('condensation')).toEqual(saved);
});
