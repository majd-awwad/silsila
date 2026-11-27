/**
 * Small, safe localStorage helpers for the teacher's own device data (groups, saved drafts and activities).
 * Every read is validated by the caller: stored data is never trusted to have the expected shape.
 */
export function readStored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** false when the browser refused (private window, full storage): the screen says so instead of pretending. */
export function writeStored(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to remove */
  }
}

export const shortId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const isStringList = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');
