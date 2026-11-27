import type { Conditions } from '../contracts';
import { useI18n } from '../i18n';
import type { ConceptPack } from '../packs/types';
import { SCENES } from '../scenes';

const examples: Record<string, { change: Conditions; outcome: string | null }[]> = {
  condensation: [{ change: {}, outcome: 'drops' }],
  evaporation: [{ change: { area: 'plate' }, outcome: null }, { change: { area: 'plate' }, outcome: 'normal' }],
  shadows: [{ change: { light: 'near' }, outcome: 'bigger' }, { change: { light: 'far' }, outcome: 'smaller' }],
  fractions: [{ change: {}, outcome: null }],
  buoyancy: [{ change: { object: 'big_steel_boat' }, outcome: 'floats' }, { change: { object: 'steel_ball' }, outcome: 'sinks' }],
  'area-perimeter': [{ change: {}, outcome: null }],
};

export function PhenomenonPreview({ pack, compact = false }: { pack: ConceptPack; compact?: boolean }) {
  const { t, lang } = useI18n();
  const Scene = SCENES[pack.id];
  const setups = examples[pack.id];
  return <figure className={'stage phenomenon' + (compact ? ' phenomenon-compact' : '')}>
    {!compact && <figcaption>{t({ ar: 'لاحظ الظاهرة', en: 'Observe the phenomenon' })}</figcaption>}
    <div className="phenomenon-scenes">
      {setups.map(({ change, outcome }, i) => <div key={i}><Scene cond={{ ...pack.baseline, ...change }} outcome={outcome} tone="real" lang={lang} /></div>)}
    </div>
  </figure>;
}
