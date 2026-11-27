/** Sends one queued item to the room API and says what happened, for the outbox. */
import { roomApi } from '../brain/client';
import { FINAL_ERRORS } from './outbox';
import type { Delivery, Queued } from './outbox';

export async function deliver(item: Queued): Promise<Delivery> {
  const seat = { participantId: item.participantId, key: item.key, alias: '', pack: '', lang: 'ar' as const };
  const r = item.kind === 'submit' && item.record
    ? await roomApi.submit(item.code, seat, item.record)
    : item.op ? await roomApi.student(item.code, seat, item.op) : null;
  if (!r) return 'drop';
  if (r.ok) return 'sent';
  // «locked» means the room already has this answer: the earlier attempt did arrive
  if (r.error === 'locked') return 'sent';
  return FINAL_ERRORS.includes(r.error) ? 'drop' : 'keep';
}
