import type { ReactNode } from 'react';
import { areaPerimeter, RECTS } from '../packs/area-perimeter';
import { buoyancy, CARGO, OBJECTS } from '../packs/buoyancy';
import { condensation } from '../packs/condensation';
import { evaporation } from '../packs/evaporation';
import { fractions, FRACTIONS, pieceWeights, wholeSize } from '../packs/fractions';
import type { Side } from '../packs/fractions';
import { BASE_SHADOW_CM, shadows, shadowDims, shadowHeight } from '../packs/shadows';
import type { ConceptPack } from '../packs/types';
import type { Scene, SceneProps } from './types';

function Diagram({ pack, props, children }: { pack: ConceptPack; props: SceneProps; children: ReactNode }) {
  const { cond, outcome, lang, tone } = props;
  const setup = pack.variables.map((variable) => {
    const option = variable.options.find((item) => item.id === cond[variable.id]);
    return option ? variable.label[lang] + ' ' + option.label[lang] : '';
  }).filter(Boolean);
  const label = [pack.title[lang], ...setup, outcome && pack.outcomes[outcome]?.[lang]].filter(Boolean).join('. ');
  return (
    <svg viewBox="0 0 340 180" width="100%" height="100%" role="img" aria-label={label}
      color={tone === 'idea' ? 'var(--idea)' : 'var(--real)'}>
      {children}
    </svg>
  );
}

const drops = [[107, 55], [231, 63], [113, 81], [224, 92], [118, 110], [221, 124], [122, 132], [218, 142]];
const water = '#69cde8';
const ink = 'var(--stage-ink)';

function WaterScene(props: SceneProps & { pack: ConceptPack }) {
  const { pack, cond, outcome } = props;
  const drying = pack.id === 'evaporation';
  const wide = drying && cond.area !== 'cup';
  const left = wide ? 80 : 120;
  const top = wide ? 76 : 35;
  const edge = (level: number) => left + 13 * (level - top) / (147 - top);
  const level = drying ? 102 + (outcome === 'fast' ? 29 : outcome === 'normal' ? 18 : outcome === 'slow' ? 8 : 0) : 79;
  const count = outcome === 'fewer' ? 2 : outcome === 'blue' || outcome === 'drops' ? drops.length : 0;
  return (
    <Diagram pack={pack} props={props}>
      <ellipse cx="170" cy="154" rx={wide ? 112 : 78} ry="11" fill="currentColor" opacity=".12" />
      {drying && cond.napkin === 'yes' && <rect x="94" y="138" width="152" height="17" rx="4" fill={outcome === 'wet' ? water : ink} opacity=".65" />}
      {(drying || cond.contents !== 'empty') && (
        <path d={'M' + edge(level) + ' ' + level + ' H' + (340 - edge(level)) + ' L' + (327 - left) + ' 147 H' + (left + 13) + ' Z'}
          fill={!drying && cond.contents === 'blue' ? '#618cff' : water} opacity=".65" />
      )}
      <path d={'M' + left + ' ' + top + ' H' + (340 - left) + ' L' + (327 - left) + ' 147 H' + (left + 13) + ' Z'}
        fill="none" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      {(cond.lid === 'on' || cond.lid === 'closed') && <rect x={left - 5} y={top - 7} width={350 - 2 * left} height="9" rx="3" fill={ink} />}
      {drying && cond.sun === 'yes' && <circle cx="274" cy="37" r="13" fill="#ffca76" />}
      {!drying && cond.temp === 'cold' && <path d="M155 104h30m-15-15v30m-11-26 22 22m0-22-22 22" stroke={ink} opacity=".7" />}
      {drops.slice(0, count).map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx="3.8" ry="5.4" fill={outcome === 'blue' ? '#618cff' : water} />)}
    </Diagram>
  );
}

function ShadowScene(props: SceneProps) {
  const { cond, outcome } = props;
  const { d1, d2, h } = shadowDims(cond);
  const objectX = 46 + d1 / (d1 + d2) * 226;
  const objectHeight = h * 4;
  const actual = shadowHeight(cond);
  const displayed = outcome === 'equals_object' ? h : outcome === 'same' ? BASE_SHADOW_CM
    : outcome === 'bigger' ? Math.max(actual, BASE_SHADOW_CM + 2) : Math.min(actual, BASE_SHADOW_CM - 2);
  const height = Math.min(displayed * 4, 142);
  return (
    <Diagram pack={shadows} props={props}>
      <path d="M285 15v150M21 150h290" stroke={ink} opacity=".5" strokeWidth="3" />
      <circle cx="46" cy="90" r="10" fill="#ffca76" />
      <rect x={objectX - 5} y={90 - objectHeight / 2} width="10" height={objectHeight} rx="2" fill={ink} />
      {outcome && <>
        <path d={'M46 90 285 ' + (90 - height / 2) + ' M46 90 285 ' + (90 + height / 2)} stroke="currentColor" strokeDasharray="4 5" />
        <line x1="285" x2="285" y1={90 - height / 2} y2={90 + height / 2} stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      </>}
    </Diagram>
  );
}

function FractionScene(props: SceneProps) {
  const { cond, outcome, lang } = props;
  const maxWhole = Math.max(wholeSize(cond, 'a'), wholeSize(cond, 'b'));
  return (
    <Diagram pack={fractions} props={props}>
      {(['a', 'b'] as Side[]).map((side, index) => {
        const weights = pieceWeights(cond, side);
        const [selected, denominator] = FRACTIONS[cond[side]];
        const emphasized = outcome === side + '_more' || outcome === 'equal';
        const x = 88 + 164 * index;
        const relativeWhole = wholeSize(cond, side) / maxWhole;
        const label = lang === 'ar' ? ['أ', 'ب'][index] : ['A', 'B'][index];
        const number = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en');
        const sum = weights.reduce((total, weight) => total + weight, 0);
        const stops = weights.reduce((marks, weight) => [...marks, marks.at(-1)! + weight / sum], [0]);
        if (cond.model === 'line') {
          const width = 240 * relativeWhole;
          const end = width * stops[selected];
          return <g key={side} transform={'translate(53 ' + (49 + index * 74) + ')'}>
            <line x2={width} stroke={ink} strokeWidth="3" />
            <line x2={end} stroke="currentColor" strokeWidth={emphasized ? 7 : 4} />
            {stops.map((tick, i) => <line key={i} x1={tick * width} x2={tick * width} y1="-6" y2="6" stroke={ink} strokeWidth="1.5" />)}
            <circle cx={end} r={emphasized ? 6 : 4.5} fill="currentColor" stroke={ink} />
            <text x="-16" y="5" fill={ink} textAnchor="end" fontSize="16">{label}</text>
            <text x="0" y="26" fill={ink} textAnchor="middle" fontSize="14">{number.format(0)}</text>
            <text x={width} y="26" fill={ink} textAnchor="middle" fontSize="14">{number.format(1)}</text>
          </g>;
        }
        const radius = 55 * (cond.model === 'pizza' ? Math.sqrt(relativeWhole) : relativeWhole);
        return <g key={side} transform={'translate(' + x + ' 78)'}>
          {weights.map((_, i) => {
            const from = stops[i];
            const to = stops[i + 1];
            const common = { fill: i < selected ? 'currentColor' : '#31405c', stroke: ink, strokeWidth: 1.5 };
            if (cond.model === 'bar') return <rect key={i} x={radius * (2 * from - 1)} y="-19" width={2 * radius * (to - from)} height="38" {...common} />;
            if (weights.length === 1) return <circle key={i} r={radius} {...common} />;
            const point = (part: number) => [radius * Math.sin(part * Math.PI * 2), -radius * Math.cos(part * Math.PI * 2)].join(' ');
            return <path key={i} d={'M0 0 L' + point(from) + ' A' + radius + ' ' + radius + ' 0 ' + (to - from > .5 ? 1 : 0) + ' 1 ' + point(to) + ' Z'} {...common} />;
          })}
          <text x="0" y="84" fill={emphasized ? 'currentColor' : ink} textAnchor="middle" fontSize="17" fontWeight="700">
            {label + '  ' + (cond.cutting === 'unequal' && side === 'b' ? '' : number.format(selected) + '/' + number.format(denominator))}
          </text>
        </g>;
      })}
    </Diagram>
  );
}

function AreaScene(props: SceneProps) {
  const { cond, outcome, lang } = props;
  return (
    <Diagram pack={areaPerimeter} props={props}>
      {(['a', 'b'] as const).map((side, index) => {
        const [width, height] = RECTS[cond[side]];
        const tile = 13;
        const emphasized = outcome === side + '_more' || outcome === 'equal';
        const cells = Array.from({ length: width * height }, (_, cell) => (
          <rect key={cell} x={cell % width * tile} y={Math.floor(cell / width) * tile} width={tile} height={tile}
            fill={emphasized ? 'currentColor' : '#31405c'} stroke={ink} strokeWidth=".7" />
        ));
        return <g key={side} transform={'translate(' + (90 + 160 * index - width * tile / 2) + ' 22)'}>
          {cells}
          <text x={width * tile / 2} y="138" fill={ink} textAnchor="middle" fontSize="17" fontWeight="700">
            {lang === 'ar' ? ['أ', 'ب'][index] : ['A', 'B'][index]}
          </text>
        </g>;
      })}
    </Diagram>
  );
}

function FloatScene(props: SceneProps) {
  const { cond, outcome } = props;
  const item = OBJECTS[cond.object];
  const floating = outcome === 'floats';
  const y = outcome === null ? 41 : floating ? 78 : 137;
  return (
    <Diagram pack={buoyancy} props={props}>
      <path d="M68 78 H272 V154 H68 Z" fill={water} opacity=".23" />
      <path d="M68 78 H272" stroke={water} strokeWidth="3" />
      <path d="M68 60 V154 H272 V60" fill="none" stroke={ink} strokeWidth="3" />
      {item.boat
        ? <path d={'M138 ' + (y - 9) + ' H202 L190 ' + (y + 9) + ' H150 Z'} fill="currentColor" stroke={ink} strokeWidth="2" />
        : <circle cx="170" cy={y} r="13" fill="currentColor" stroke={ink} strokeWidth="2" />}
      {CARGO[cond.cargo] > 0 && <rect x="161" y={y - 18} width="18" height="11" rx="2" fill="#ffca76" />}
    </Diagram>
  );
}

export const SCENES: Record<string, Scene> = {
  condensation: (props) => <WaterScene {...props} pack={condensation} />,
  evaporation: (props) => <WaterScene {...props} pack={evaporation} />,
  shadows: ShadowScene,
  fractions: FractionScene,
  buoyancy: FloatScene,
  'area-perimeter': AreaScene,
};

export type { Scene, SceneProps } from './types';
