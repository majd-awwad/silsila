/** The outbox sends each waiting item once, in order, and keeps the rest while there is still no connection. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueue, flush, pendingFor, readOutbox } from '../src/flow/outbox';
import type { Delivery, Queued } from '../src/flow/outbox';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

const base = { code: 'ABC234', participantId: 'p1', key: 'k', kind: 'op' as const };
const say = (text: string) => ({ ...base, op: { type: 'explain' as const, text } });

describe('outbox', () => {
  it('keeps one copy of the same send and the latest hand-in', () => {
    enqueue(say('a')); enqueue(say('a')); enqueue(say('b'));
    expect(readOutbox().map((q) => (q.op as { text: string }).text)).toEqual(['a', 'b']);
    enqueue({ ...base, kind: 'submit', record: { id: 'r1' } as never });
    enqueue({ ...base, kind: 'submit', record: { id: 'r2' } as never });
    expect(readOutbox().filter((q) => q.kind === 'submit')).toHaveLength(1);
    expect((readOutbox().find((q) => q.kind === 'submit')!.record as { id: string }).id).toBe('r2');
    expect(pendingFor('ABC234')).toBe(3);
    expect(pendingFor('OTHER9')).toBe(0);
  });

  it('sends in order, once each, even if two flushes start together', async () => {
    enqueue(say('one')); enqueue(say('two'));
    const sent: string[] = [];
    const send = async (q: Queued): Promise<Delivery> => { await Promise.resolve(); sent.push((q.op as { text: string }).text); return 'sent'; };
    const [a, b] = await Promise.all([flush(send), flush(send)]);
    expect(sent).toEqual(['one', 'two']);
    expect(a).toBe(2);
    expect(b).toBe(2); // the second call is the same run, not a second send
    expect(readOutbox()).toEqual([]);
    expect(await flush(send)).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it('stops at the first item that still has no connection and keeps it first in line', async () => {
    enqueue(say('one')); enqueue(say('two'));
    const sent: string[] = [];
    expect(await flush(async (q) => { sent.push((q.op as { text: string }).text); return 'keep'; })).toBe(0);
    expect(sent).toEqual(['one']);
    expect(readOutbox().map((q) => (q.op as { text: string }).text)).toEqual(['one', 'two']);
    // later the connection is back
    const later: string[] = [];
    expect(await flush(async (q) => { later.push((q.op as { text: string }).text); return 'sent'; })).toBe(2);
    expect(later).toEqual(['one', 'two']);
  });

  it('drops what the room refuses for good, and treats a thrown error as no connection', async () => {
    enqueue(say('late')); enqueue(say('next'));
    expect(await flush(async (q) => ((q.op as { text: string }).text === 'late' ? 'drop' : 'sent'))).toBe(1);
    expect(readOutbox()).toEqual([]);
    enqueue(say('x'));
    expect(await flush(async () => { throw new Error('network'); })).toBe(0);
    expect(readOutbox()).toHaveLength(1);
  });
});
