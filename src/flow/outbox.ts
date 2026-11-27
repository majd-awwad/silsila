/**
 * A small local outbox for learner sends that failed only because the network was down (live class and homework). Items
 * are kept in localStorage and sent again when the connection returns, in order, each at most once: the server already
 * refuses an identical explanation or a second prediction, so a retry that arrives twice is harmless, and a hand-in just
 * replaces the earlier one. Nothing here changes what is sent, only when.
 */
import { useEffect, useState } from 'react';
import type { LearnerRecord, RoomError, StudentOp } from '../contracts';

export interface Queued {
  id: string;
  code: string;
  participantId: string;
  key: string;
  kind: 'op' | 'submit';
  op?: StudentOp;
  record?: LearnerRecord;
  at: number;
}

/** what the sender found out: sent (or already received), refused for good, or still no connection */
export type Delivery = 'sent' | 'drop' | 'keep';

const KEY = 'silsila-outbox';
const MAX_ITEMS = 40;

export function readOutbox(): Queued[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(list) ? (list as Queued[]).filter((q) => q && typeof q.id === 'string' && typeof q.code === 'string') : [];
  } catch { return []; }
}

function write(list: Queued[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS))); } catch { /* storage blocked: the send stays on screen */ }
  listeners.forEach((f) => f());
}

const listeners = new Set<() => void>();

/** The same send twice is one item; a newer hand-in replaces the older one. */
const sameAs = (a: Queued, b: Queued): boolean =>
  a.code === b.code && a.participantId === b.participantId && a.kind === b.kind
  && (a.kind === 'submit' || JSON.stringify(a.op) === JSON.stringify(b.op));

export function enqueue(item: Omit<Queued, 'id' | 'at'>, now = Date.now()): Queued {
  const next: Queued = { ...item, id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at: now };
  write([...readOutbox().filter((q) => !sameAs(q, next)), next]);
  return next;
}

export const pendingFor = (code: string): number => readOutbox().filter((q) => q.code === code).length;

let flushing: Promise<number> | null = null;

/** Send what is waiting, oldest first, stopping at the first item that still cannot go. Returns how many were delivered. */
export function flush(send: (item: Queued) => Promise<Delivery>, onlyCode?: string): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let delivered = 0;
    for (const item of readOutbox().filter((q) => !onlyCode || q.code === onlyCode)) {
      // taken out first, so a second flush (another tab, another timer) can never send it again
      write(readOutbox().filter((q) => q.id !== item.id));
      let result: Delivery = 'keep';
      try { result = await send(item); } catch { result = 'keep'; }
      if (result === 'keep') { write([item, ...readOutbox()]); break; }
      if (result === 'sent') delivered++;
    }
    return delivered;
  })().finally(() => { flushing = null; });
  return flushing;
}

/** Errors after which sending again can never work. */
export const FINAL_ERRORS: RoomError[] = ['locked', 'wrong_phase', 'forbidden', 'room_closed', 'no_room', 'bad_request'];

export const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/** True while the browser says it is online. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => !isOffline());
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** How many sends of this room are waiting, and a flush that runs when the connection returns and every few seconds. */
export function useOutbox(code: string, send: (item: Queued) => Promise<Delivery>, afterSend?: () => void): number {
  const [count, setCount] = useState(() => pendingFor(code));
  useEffect(() => {
    const refresh = () => setCount(pendingFor(code));
    listeners.add(refresh);
    const run = () => {
      if (isOffline() || !pendingFor(code)) return;
      void flush(send, code).then((n) => { if (n) afterSend?.(); });
    };
    window.addEventListener('online', run);
    const timer = window.setInterval(run, 6000);
    run();
    return () => { listeners.delete(refresh); window.removeEventListener('online', run); window.clearInterval(timer); };
  }, [code]);
  return count;
}
