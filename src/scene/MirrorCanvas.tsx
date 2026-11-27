import { useEffect, useRef } from 'react';
import type { ChildModel, Conditions } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { MirrorEngine } from './MirrorEngine';

interface Props {
  pack: ConceptPack;
  model: ChildModel | null;
  cond: Conditions;
  ideaOutcome: string;
  referenceOutcome: string;
  label: string;
  onFail: () => void;
}

export function MirrorCanvas({ pack, model, cond, ideaOutcome, referenceOutcome, label, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<MirrorEngine | null>(null);

  useEffect(() => {
    if (!host.current) return;
    try { engine.current = new MirrorEngine(host.current, { pack }); }
    catch { onFail(); }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [pack, onFail]);

  useEffect(() => {
    engine.current?.setModel(model);
    engine.current?.run(cond, !!model);
  }, [pack, cond, model]);

  useEffect(() => {
    engine.current?.setOutcomes(ideaOutcome, referenceOutcome);
  }, [pack, cond, model, ideaOutcome, referenceOutcome]);

  return <div ref={host} className="mirror-host" aria-label={label} role="img" />;
}
