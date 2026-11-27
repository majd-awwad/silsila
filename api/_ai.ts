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

export async function diagnose(pack: ConceptPack, text: string, context: BrainContext, options?: CallOptions): Promise<Diagnosis> {
  const ctx = cleanContext(pack, context);
  if (!aiConfigured()) return heuristicDiagnose(pack, text, ctx, 'no_key');
  try {
    return await diagnoseWithLLM(pack, text, ctx, options);
  } catch (e) {
    logError('diagnose', e);
    return heuristicDiagnose(pack, text, ctx, 'ai_error');
  }
}

export async function teach(pack: ConceptPack, text: string, options?: CallOptions): Promise<TeachResult> {
  if (!aiConfigured()) return heuristicTeach(pack, text);
  try {
    return await teachWithLLM(pack, text, options);
  } catch (e) {
    logError('teach', e);
    return heuristicTeach(pack, text);
  }
}

export async function transfer(pack: ConceptPack, text: string, options?: CallOptions): Promise<TransferResult> {
  if (!aiConfigured()) return heuristicTransfer(pack, text);
  try {
    return await transferWithLLM(pack, text, options);
  } catch (e) {
    logError('transfer', e);
    return heuristicTransfer(pack, text);
  }
}
