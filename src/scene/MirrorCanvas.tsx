import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ChildModel, SceneExperiment } from '../contracts';
import type { NoorState } from './MirrorEngine';
import { MirrorEngine } from './MirrorEngine';

export interface MirrorHandle {
  runExperiment(exp: SceneExperiment): void;
  setOutcomes(kid: string, real: string): void;
}

interface Props {
  model: ChildModel | null;
  noor: NoorState;
  quality?: 'high' | 'low';
}

/** Thin React wrapper around MirrorEngine. The engine owns the canvas; React never re-renders it. */
export const MirrorCanvas = forwardRef<MirrorHandle, Props>(function MirrorCanvas({ model, noor, quality }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<MirrorEngine | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    try {
      engine.current = new MirrorEngine(host.current, { quality });
    } catch {
      setFailed(true);
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [quality]);

  useEffect(() => engine.current?.setModel(model), [model]);
  useEffect(() => engine.current?.setNoorState(noor), [noor]);

  useImperativeHandle(ref, () => ({
    runExperiment: (exp) => engine.current?.runExperiment(exp),
    setOutcomes: (k, r) => engine.current?.setOutcomes(k, r),
  }), []);

  return (
    <div ref={host} className="mirror-host" aria-label="مشهد ثلاثي الأبعاد: فكرة الطفل والعالم الحقيقي" role="img">
      {failed && (
        <div className="mirror-fail">المتصفح هاد ما بيدعم الرسم ثلاثي الأبعاد. جرّبوا Chrome أو Edge على لابتوب.</div>
      )}
    </div>
  );
});
