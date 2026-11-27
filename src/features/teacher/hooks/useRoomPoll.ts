/**
 * Polls one classroom for one role about every two seconds, sending the version it already has. The last good
 * view stays on screen while the connection is down. Used by the control room and the projector.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomError, RoomView } from '../../../contracts';
import { roomApi } from '../../../brain/client';
import type { Seat } from '../../../brain/client';

const EVERY_MS = 2000;
const RETRY_MS = 3500;
/** a room that is gone is asked about rarely, in case the server comes back with it */
const GONE_MS = 10_000;

export interface RoomPoll<V extends RoomView> {
  view: V | null;
  error: RoomError | null;
  /** show a view this device just received (after a teacher action) */
  apply(view: V): void;
  /** forget the known version and ask again now */
  refresh(): void;
}

export function useRoomPoll<V extends RoomView>(
  code: string, role: V['role'], teacherKey?: string, enabled = true, everyMs = EVERY_MS, seat?: Seat,
): RoomPoll<V> {
  const [state, setState] = useState<{ for: string; view: V | null; error: RoomError | null }>({ for: code, view: null, error: null });
  const [nonce, setNonce] = useState(0);
  const version = useRef<string | undefined>(undefined);
  const generation = useRef(0);

  const apply = useCallback((view: V) => {
    generation.current++;
    version.current = view.version;
    setState({ for: code, view, error: null });
  }, [code]);

  const refresh = useCallback(() => {
    generation.current++;
    version.current = undefined;
    setNonce((x) => x + 1);
  }, []);

  useEffect(() => {
    version.current = undefined;
  }, [code]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const asked = generation.current;
      let delay = everyMs;
      try {
        const r = await roomApi.view<V>(code, { role, teacherKey, since: version.current, participantId: seat?.participantId, key: seat?.key });
        if (!alive) return;
        // an answer that started before a newer action must not overwrite what that action returned
        if (asked === generation.current) {
          if (!r.ok) {
            setState((s) => ({ for: code, view: s.for === code ? s.view : null, error: r.error }));
          } else if ('unchanged' in r.data) {
            setState((s) => (s.error ? { ...s, error: null } : s));
          } else {
            version.current = r.data.version;
            setState({ for: code, view: r.data, error: null });
          }
        }
        if (!r.ok) delay = r.error === 'no_room' || r.error === 'forbidden' || r.error === 'bad_request' ? Math.max(GONE_MS, everyMs) : Math.max(RETRY_MS, everyMs);
      } catch {
        // the sample classroom runs on this device: damaged stored data ends up here
        if (!alive) return;
        setState((s) => ({ ...s, for: code, error: 'store_failed' }));
        delay = RETRY_MS;
      }
      timer = setTimeout(poll, delay);
    };
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [code, role, teacherKey, enabled, everyMs, nonce, seat]);

  const mine = state.for === code;
  return { view: mine ? state.view : null, error: mine ? state.error : null, apply, refresh };
}
