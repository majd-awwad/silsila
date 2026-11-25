import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ChildModel, Conditions } from '../contracts';
import type { ConceptPack } from '../packs/types';
import type { NoorState } from './MirrorEngine';
import { MirrorEngine } from './MirrorEngine';

export interface MirrorHandle {
  run(cond: Conditions, split: boolean): void;
  setOutcomes(kid: string, real: string): void;
}

interface Props {
  pack: ConceptPack;
  model: ChildModel | null;
  noor: NoorState;
  quality?: 'high' | 'low';
  /** WebGL missing or failed → the Lab switches to the 2D Lite scene */
  onFail: () => void;
}

/** Thin React wrapper around MirrorEngine. The engine owns the canvas; React never re-renders it. */
export const MirrorCanvas = forwardRef<MirrorHandle, Props>(function MirrorCanvas({ pack, model, noor, quality, onFail }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<MirrorEngine | null>(null);
  const latest = useRef({ model, noor });
  latest.current = { model, noor };

  useEffect(() => {
    if (!host.current) return;
    try {
      const e = new MirrorEngine(host.current, { quality, pack });
      e.setModel(latest.current.model);
      e.setNoorState(latest.current.noor);
      engine.current = e;
    } catch {
      onFail();
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [quality, pack, onFail]);

  useEffect(() => engine.current?.setModel(model), [model]);
  useEffect(() => engine.current?.setNoorState(noor), [noor]);

  useImperativeHandle(ref, () => ({
    run: (c, split) => engine.current?.run(c, split),
    setOutcomes: (k, r) => engine.current?.setOutcomes(k, r),
  }), []);

  return <div ref={host} className="mirror-host" aria-label="مشهد ثلاثي الأبعاد: فكرة الطفل والعالم الحقيقي" role="img" />;
});
