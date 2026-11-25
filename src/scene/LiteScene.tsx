/**
 * SILSILA Lite: a 2D scene for weak devices or when WebGL is unavailable.
 * Same two worlds, same deterministic outcomes, drawn as simple SVG. No GPU, tiny CPU.
 */
import type { ChildModel, Conditions } from '../contracts';
import type { ConceptPack } from '../packs/types';

interface Props {
  pack: ConceptPack;
  model: ChildModel | null;
  cond: Conditions;
  split: boolean;
  kidText: string;
  realText: string;
}

const DROPS = [[18, 40], [70, 52], [30, 86], [76, 100], [22, 128], [66, 140], [40, 64], [52, 116], [16, 160], [72, 168]];

function Glass({ outcome, cond, pack, tone }: { outcome: string; cond: Conditions; pack: ConceptPack; tone: 'warm' | 'cool' }) {
  const ring = tone === 'warm' ? '#FFB547' : '#5CE1E6';
  const evap = pack.scene === 'evaporation';
  const level = evap ? (outcome === 'fast' || outcome === 'wet' ? 0.45 : outcome === 'slow' ? 0.7 : 0.9) : cond.contents === 'empty' ? 0 : 0.78;
  const waterTop = 190 - 150 * level;
  const water = !evap && cond.contents === 'blue' ? '#3F7BFF' : '#BFE6FF';
  const dropCount = evap ? 0 : outcome === 'drops' || outcome === 'blue' ? 10 : outcome === 'fewer' ? 3 : 0;
  const dropColor = outcome === 'blue' ? '#3F7BFF' : '#EAF7FF';
  const lid = evap ? cond.lid === 'closed' : cond.lid === 'on';
  return (
    <svg viewBox="-20 0 140 230" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="50" cy="208" rx="62" ry="10" fill="none" stroke={ring} strokeWidth="2" opacity=".8" />
      {evap && cond.napkin === 'yes' && <ellipse cx="50" cy="200" rx="54" ry="7" fill={outcome === 'wet' ? '#9FB6C8' : '#F4F6F8'} />}
      {evap && cond.sun === 'yes' && <circle cx="108" cy="16" r="10" fill="#FFC66E" />}
      {level > 0 && <path d={`M10 ${waterTop} L90 ${waterTop} L84 196 L16 196 Z`} fill={water} opacity=".55" />}
      <path d="M4 20 L96 20 L86 200 L14 200 Z" fill="none" stroke="#DCEBFF" strokeWidth="3" strokeLinejoin="round" />
      {lid && <rect x="0" y="12" width="100" height="8" rx="3" fill="#CFD8E6" />}
      {DROPS.slice(0, dropCount).map(([x, y], i) => (
        <ellipse key={i} cx={x < 50 ? 6 + (x - 16) * 0.1 : 94 - (80 - x) * 0.1} cy={y} rx="3.2" ry="4.2" fill={dropColor} stroke="#9CC9E8" strokeWidth=".8" />
      ))}
      {evap && (outcome === 'fast' || outcome === 'slow') && !lid && [0, 1, 2].map((i) => (
        <circle key={i} cx={30 + i * 20} cy={waterTop - 18 - i * 10} r="3" fill="#5CE1E6" opacity=".7" />
      ))}
    </svg>
  );
}

export function LiteScene({ pack, model, cond, split, kidText, realText }: Props) {
  const kidOut = model ? pack.kidOutcome(model, cond) : pack.realOutcome(cond);
  const realOut = pack.realOutcome(cond);
  return (
    <div className="mirror-host lite-scene" role="img" aria-label="المشهد الخفيف: فكرة الطفل والعالم الحقيقي">
      <div className="lite-worlds">
        <figure className="lite-world">
          <figcaption className="mirror-tag"><span className="name">عالم فكرتك</span>{kidText && <span className="out">{kidText}</span>}</figcaption>
          <div className="lite-glass"><Glass outcome={kidOut} cond={cond} pack={pack} tone="warm" /></div>
        </figure>
        {split && (
          <figure className="lite-world">
            <figcaption className="mirror-tag real"><span className="name">العالم الحقيقي</span>{realText && <span className="out">{realText}</span>}</figcaption>
            <div className="lite-glass"><Glass outcome={realOut} cond={cond} pack={pack} tone="cool" /></div>
          </figure>
        )}
      </div>
    </div>
  );
}
