import { areaPerimeter } from './area-perimeter';
import { buoyancy } from './buoyancy';
import { condensation } from './condensation';
import { evaporation } from './evaporation';
import { fractions } from './fractions';
import { shadows } from './shadows';
import type { ConceptPack } from './types';

export const PACK_LIST: ConceptPack[] = [condensation, evaporation, shadows, fractions, buoyancy, areaPerimeter];
export const PACKS: Record<string, ConceptPack> = Object.fromEntries(PACK_LIST.map((p) => [p.id, p]));
export const DEFAULT_PACK = 'condensation';

export function getPack(id: string | null | undefined): ConceptPack {
  return (id && PACKS[id]) || PACKS[DEFAULT_PACK];
}
export type { ConceptPack } from './types';
