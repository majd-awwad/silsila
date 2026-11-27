/** Makes sure the labelled sample classroom exists on this device and matches the packs the app has. */
import type { Lang } from '../../../contracts';
import { sampleStore } from '../../../brain/client';
import { DEFAULT_PACK, PACKS } from '../../../packs';

/** false when the sample classroom could not be built (nothing is shown as if it had been). */
export function ensureSample(lang: Lang): boolean {
  const data = sampleStore.load();
  if (data?.meta?.settings && PACKS[data.meta.settings.pack] && Array.isArray(data.participants)) return true;
  return resetSample(DEFAULT_PACK, lang);
}

export function resetSample(packId: string, lang: Lang): boolean {
  try {
    sampleStore.reset(packId, lang);
    return true;
  } catch {
    return false;
  }
}
