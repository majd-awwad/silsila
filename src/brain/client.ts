/**
 * What the screens call. Tries the AI through /api; if it is slow, down, or has no key,
 * falls back to the offline heuristic with the same contract. The UI shows which one answered.
 */
import type { BrainContext, Diagnosis, TeachResult } from '../contracts';
import { Diagnosis as DiagnosisSchema, TeachResult as TeachSchema } from '../contracts';
import { heuristicDiagnose, heuristicTeach } from './heuristic';

const TIMEOUT_MS = 9000;

async function post<T>(url: string, body: unknown, parse: (x: unknown) => T): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) throw new Error('http_' + r.status);
    return parse(await r.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function diagnose(text: string, context: BrainContext): Promise<Diagnosis> {
  try {
    return await post('/api/diagnose', { text, context }, (x) => DiagnosisSchema.parse(x));
  } catch {
    return heuristicDiagnose(text, context);
  }
}

export async function teach(text: string): Promise<TeachResult> {
  try {
    return await post('/api/teach', { text }, (x) => TeachSchema.parse(x));
  } catch {
    return { ...heuristicTeach(text), source: 'fallback' };
  }
}

/** Ask the server once whether the AI is configured, for the status pill. */
export async function aiAvailable(): Promise<boolean> {
  try {
    const r = await fetch('/api/health', { method: 'POST' });
    if (!r.ok) return false;
    const j = (await r.json()) as { ai?: boolean };
    return !!j.ai;
  } catch {
    return false;
  }
}
