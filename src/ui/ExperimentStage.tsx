/**
 * The Reality Debugger's stage: the learner's idea world beside the reference world, for any concept pack.
 * Before `revealed` it draws only the setup, so nothing about the result is shown ahead of the prediction.
 * All outcomes come from the pack's deterministic functions.
 */
import { Component, Suspense, lazy, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChildModel, Conditions } from '../contracts';
import { compare } from '../brain/world';
import { useI18n } from '../i18n';
import type { ConceptPack } from '../packs/types';
import { SCENES } from '../scenes';
import { Icon } from './icons';

// three.js loads only when someone asks for the 3D view
const MirrorCanvas = lazy(() => import('../scene/MirrorCanvas').then((m) => ({ default: m.MirrorCanvas })));

class Guard extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export interface StageProps {
  pack: ConceptPack;
  cond: Conditions;
  /** the hypothesis to run beside reality; null shows the real setup only */
  model: ChildModel | null;
  revealed: boolean;
  /** label for the hypothesis world, e.g. «عالم فكرتك» */
  ideaLabel?: string;
  /** allow switching to the 3D view where the pack has one */
  allow3d?: boolean;
  quietSetup?: boolean;
}

export function ExperimentStage({ pack, cond, model, revealed, ideaLabel, allow3d = true, quietSetup = false }: StageProps) {
  const { t, lang } = useI18n();
  const Scene = SCENES[pack.id];
  const [view3d, setView3d] = useState(false);
  const [failed, setFailed] = useState(false);
  const on3dFail = useCallback(() => setFailed(true), []);
  const cmp = model ? compare(pack, model, cond) : null;
  const real = pack.realOutcome(cond);
  const can3d = allow3d && !!pack.scene3d && !failed && revealed;
  const show3d = can3d && view3d;
  const measure = revealed ? pack.measure?.(cond) : null;
  const ideaName = ideaLabel ?? t({ ar: 'عالم الفكرة', en: 'The idea’s world' });
  const realName = revealed ? t({ ar: 'النموذج العلمي', en: 'Reference model' }) : t({ ar: 'التجهيز', en: 'The setup' });

  const world = (kind: 'idea' | 'real', outcome: string | null, name: string) => (
    <figure className={`world ${kind} m-0`}>
      <figcaption className="world-tag">
        <span>{name}</span>
        {revealed && kind === 'idea' && cmp && (
          <span className={`chip ${cmp.contradicted ? 'chip-probe' : 'chip-real'}`}>
            <Icon name={cmp.contradicted ? 'cross' : 'check'} size={13} />
            {cmp.contradicted ? t({ ar: 'اختلفت عن النتيجة', en: 'Differs' }) : t({ ar: 'صمدت هون', en: 'Holds here' })}
          </span>
        )}
      </figcaption>
      <div className="world-canvas">{Scene ? <Scene cond={cond} outcome={outcome} tone={kind} lang={lang} /> : null}</div>
      {(revealed || !quietSetup) && <div className="world-out" aria-live="polite">{outcome ? t(pack.outcomes[outcome]) : <span className="muted">{t({ ar: 'النتيجة لسا مخبّاية', en: 'Result still hidden' })}</span>}</div>}
    </figure>
  );

  return (
    <div className="stage p-3 flex flex-col gap-3">
      {can3d && (
        <div className="flex justify-end">
          <button type="button" className="btn btn-secondary btn-sm" aria-pressed={view3d} onClick={() => setView3d(!view3d)}>
            <Icon name="eye" size={16} />{view3d ? t({ ar: 'العرض الخفيف (2D)', en: 'Lite 2D view' }) : t({ ar: 'شوفها ثلاثية الأبعاد', en: 'View in 3D' })}
          </button>
        </div>
      )}
      {show3d ? (
        <div className="stage-3d">
          <Guard onError={on3dFail}>
            <Suspense fallback={<div className="absolute inset-0 grid place-items-center"><span className="spinner" /></div>}>
              <MirrorCanvas pack={pack} model={model} cond={cond} onFail={on3dFail}
                ideaOutcome={cmp ? t(pack.outcomes[cmp.kid]) : ''} referenceOutcome={t(pack.outcomes[real])}
                label={t({ ar: 'مشهد ثلاثي الأبعاد للمحاكاة', en: 'Three-dimensional simulation' })} />
            </Suspense>
          </Guard>
        </div>
      ) : (
        <div className="worlds">
          {model && world('idea', revealed && cmp ? cmp.kid : null, ideaName)}
          {(revealed || !model) && world('real', revealed ? real : null, realName)}
        </div>
      )}
      {measure && <p className="text-center m-0 text-[14px]" dir="auto">{t(measure)}</p>}
    </div>
  );
}
