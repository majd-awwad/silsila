import { condensation } from './condensation';
import { evaporation } from './evaporation';
import type { ConceptPack } from './types';

export const PACKS: Record<string, ConceptPack> = { condensation, evaporation };
export const PACK_LIST: ConceptPack[] = [condensation, evaporation];
export const DEFAULT_PACK = 'condensation';

export function getPack(id: string | null | undefined): ConceptPack {
  return (id && PACKS[id]) || PACKS[DEFAULT_PACK];
}
export type { ConceptPack } from './types';
