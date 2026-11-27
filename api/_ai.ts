/**
 * "Model, else offline rules" for the learner calls, shared by the single endpoints and the live classroom.
 * The answer always says which one produced it. Only the explanation text and the pack's own ids reach the model:
 * no alias, no learner id, no room code.
 */
import type { BrainContext, Diagnosis, TeachResult, TransferResult } from '../src/contracts';
import { heuristicDiagnose, heuristicTeach, heuristicTransfer } from '../src/brain/heuristic';
import { aiConfigured, diagnoseWithLLM, teachWithLLM, transferWithLLM } from '../src/brain/server';
import type { CallOptions } from '../src/brain/server';
import type { ConceptPack } from '../src/packs/types';
import { logError } from './_util';

/** Bound the history a caller sends: recent entries, short texts, known idea ids. */
export function cleanContext(pack: ConceptPack, context: BrainContext): BrainContext {
  return {
    pack: pack.id,
    lang: context.lang,
    previous: context.previous.slice(-8).map((p) => ({
      text: p.text.slice(0, 600),
      status: p.status,
      ideas: p.ideas.filter((id) => Object.hasOwn(pack.ideas, id)).slice(0, 3),
    })),
  };
}

/**
 * What the last real model call did, kept in memory (per server instance). /api/health reports it so the judge page can say
 * «key present» apart from «the last real request worked». After a transport failure the model is skipped for a short
 * while, so the next learners get the offline rules at once instead of each waiting for the same timeout.
 */
export interface AiLast { ok: boolean; at: number; reason: string | null }
let last: AiLast | null = null;
let skipUntil = 0;
const BREAKER_MS = 20_000;
const TRANSPORT = /^(llm_timeout|llm_network|llm_http_)/;

export function resetAi(): void { last = null; skipUntil = 0; }
export const aiLast =(): AiLast | null => last;
export const aiPaused = (): boolean => Date.now() < skipUntil;
export function noteAi(ok: boolean, e?: unknown): void {
  const reason = ok ? null : (e instanceof Error && /^[a-z0-9_]+$/.test(e.message) ? e.message : 'ai_error');
  last = { ok, at: Date.now(), reason };
  skipUntil = !ok && reason && TRANSPORT.test(reason) ? Date.now() + BREAKER_MS : 0;
}

/** One tiny real call, only when the judge asks for it (it costs a few tokens). */
export async function probeAi(pack: ConceptPack): Promise<AiLast> {
  if (!aiConfigured()) return { ok: false, at: Date.now(), reason: 'no_key' };
  skipUntil = 0;
  try {
    await diagnoseWithLLM(pack, 'الهوا فيه بخار مي وبيصير مي لما يبرد', { pack: pack.id, lang: 'ar', previous: [] }, { timeoutMs: 8000 });
    noteAi(true);
  } catch (e) {
    noteAi(false, e);
  }
  return last!;
}

export async function diagnose(pack: ConceptPack, text: string, context: BrainContext, options?: CallOptions): Promise<Diagnosis> {
  const ctx = cleanContext(pack, context);
  if (!aiConfigured()) return heuristicDiagnose(pack, text, ctx, 'no_key');
  if (aiPaused()) return heuristicDiagnose(pack, text, ctx, 'ai_error');
  try {
    const d = await diagnoseWithLLM(pack, text, ctx, options);
    noteAi(true);
    return d;
  } catch (e) {
    noteAi(false, e);
    logError('diagnose', e);
    return heuristicDiagnose(pack, text, ctx, 'ai_error');
  }
}

export async function teach(pack: ConceptPack, text: string, options?: CallOptions): Promise<TeachResult> {
  if (!aiConfigured() || aiPaused()) return heuristicTeach(pack, text);
  try {
    const r = await teachWithLLM(pack, text, options);
    noteAi(true);
    return r;
  } catch (e) {
    noteAi(false, e);
    logError('teach', e);
    return heuristicTeach(pack, text);
  }
}

export async function transfer(pack: ConceptPack, text: string, options?: CallOptions): Promise<TransferResult> {
  if (!aiConfigured() || aiPaused()) return heuristicTransfer(pack, text);
  try {
    const r = await transferWithLLM(pack, text, options);
    noteAi(true);
    return r;
  } catch (e) {
    noteAi(false, e);
    logError('transfer', e);
    return heuristicTransfer(pack, text);
  }
}
