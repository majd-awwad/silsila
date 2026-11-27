import { createContext, useContext, useState } from 'react';

export const SoloDraftContext = createContext<{ prefix: string; write(name: string, value: string): void } | null>(null);

/** Classroom controls share the components but do not write to solo storage. */
export function useLessonDraft<T>(field: string, initial: T, validate: (value: unknown) => value is T) {
  const scope = useContext(SoloDraftContext);
  const key = scope ? 'silsila-student-draft:' + scope.prefix + ':' + field : null;
  const [state, setState] = useState<{ key: string | null; value: T }>(() => ({ key, value: read() }));
  function read(): T {
    try {
      const raw = key && localStorage.getItem(key);
      const value: unknown = raw ? JSON.parse(raw) : initial;
      return validate(value) ? value : initial;
    } catch { return initial; }
  }
  const value = state.key === key ? state.value : read();
  return [value, (next: T) => {
    setState({ key, value: next });
    if (key) scope?.write(key, JSON.stringify(next));
  }] as const;
}

export const textDraft = (value: unknown): value is string => typeof value === 'string' && value.length <= 600;
