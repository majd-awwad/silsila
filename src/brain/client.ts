/**
 * What the screens call. Each call tries the AI through /api; if it is slow, down, or has no key,
 * it falls back to the offline brain with the same contract. The UI shows which one answered.
 */
import type { ActivityPlan, BrainContext, ChallengeResult, ClassEntry, Diagnosis, TeachResult, TransferResult } from '../contracts';
import { ActivityPlan as ActivitySchema, ChallengeResult as ChallengeSchema, Diagnosis as DiagnosisSchema, TeachResult as TeachSchema, TransferResult as TransferSchema } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { fallbackActivity, summarise } from './classInsights';
import { heuristicChallenge, heuristicDiagnose, heuristicTeach, heuristicTransfer } from './heuristic';

const TIMEOUT_MS = 9000;

async function post<T>(url: string, body: unknown, parse: (x: unknown) => T, timeout = TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) throw new Error('http_' + r.status);
    return parse(await r.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function diagnose(pack: ConceptPack, text: string, context: BrainContext): Promise<Diagnosis> {
  try { return await post('/api/diagnose', { text, context }, (x) => DiagnosisSchema.parse(x)); }
  catch { return heuristicDiagnose(pack, text, context); }
}

export async function teach(pack: ConceptPack, text: string): Promise<TeachResult> {
  try { return await post('/api/teach', { pack: pack.id, text }, (x) => TeachSchema.parse(x)); }
  catch { return { ...heuristicTeach(pack, text), source: 'fallback' }; }
}

export async function challenge(pack: ConceptPack, teachings: string[]): Promise<ChallengeResult> {
  try { return await post('/api/challenge', { pack: pack.id, teachings }, (x) => ChallengeSchema.parse(x)); }
  catch { return { ...heuristicChallenge(pack, teachings), source: 'fallback' }; }
}

export async function transfer(pack: ConceptPack, text: string): Promise<TransferResult> {
  try { return await post('/api/transfer', { pack: pack.id, text }, (x) => TransferSchema.parse(x)); }
  catch { return { ...heuristicTransfer(pack, text), source: 'fallback' }; }
}

export async function activity(pack: ConceptPack, entries: ClassEntry[]): Promise<ActivityPlan> {
  try { return await post('/api/activity', { pack: pack.id, entries }, (x) => ActivitySchema.parse(x), 20000); }
  catch { return { ...fallbackActivity(pack, summarise(pack, entries).topWrong), source: 'fallback' }; }
}

export interface Health { ai: boolean; model: string | null; stt: boolean; tts: boolean; liveStore: 'redis' | 'memory' | null }
export async function health(): Promise<Health> {
  try {
    const r = await fetch('/api/health', { method: 'POST' });
    if (!r.ok) return { ai: false, model: null, stt: false, tts: false, liveStore: null };
    const j = (await r.json()) as Partial<Health>;
    return { ai: !!j.ai, model: j.model ?? null, stt: !!j.stt, tts: !!j.tts, liveStore: j.liveStore ?? null };
  } catch {
    return { ai: false, model: null, stt: false, tts: false, liveStore: null };
  }
}

/* ---------- live class ---------- */
export const liveClass = {
  async create(pack: string): Promise<string | null> {
    try { return (await post('/api/class', { action: 'create', pack }, (x) => x as { code: string })).code; } catch { return null; }
  },
  async post(code: string, entry: ClassEntry): Promise<void> {
    try { await post('/api/class', { action: 'post', code, entry }, (x) => x, 5000); } catch { /* the lesson goes on without the live map */ }
  },
  async list(code: string): Promise<{ pack: string; entries: ClassEntry[] } | null> {
    try { return await post('/api/class', { action: 'list', code }, (x) => x as { pack: string; entries: ClassEntry[] }, 5000); } catch { return null; }
  },
};
