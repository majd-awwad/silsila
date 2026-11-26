/**
 * Server-side calls to the language model. Imported only by api/*.ts and scripts (never by the browser),
 * so the API key never reaches the child's device.
 *
 * Provider: any OpenAI-compatible chat endpoint, OpenRouter by default (one key, many models; the model is
 * a config value so we can justify and swap it: see `npm run eval:models`).
 *   OPENROUTER_API_KEY  (or LLM_API_KEY)   secret, server only
 *   LLM_MODEL                              e.g. google/gemini-2.5-flash (OpenRouter slug)
 *   LLM_BASE_URL                           default https://openrouter.ai/api/v1
 */
import type { ActivityPlan, BrainContext, ChallengeResult, Diagnosis, TeachResult, TransferResult } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { normaliseActivity, normaliseChallenge, normaliseDiagnosis, normaliseTeach, normaliseTransfer } from './normalise';
import {
  activitySystem, activityTool, challengeSystem, challengeTool, challengeUser, diagnoseSystem, diagnoseTool, diagnoseUser,
  teachSystem, teachTool, transferSystem, transferTool,
} from './prompts';

export const DEFAULT_MODEL = 'google/gemini-2.5-flash';

const env = (k: string) => (typeof process !== 'undefined' ? process.env[k] : undefined);
export const llmKey = () => env('OPENROUTER_API_KEY') || env('LLM_API_KEY') || '';
export const llmModel = () => env('LLM_MODEL') || DEFAULT_MODEL;
export const llmBase = () => (env('LLM_BASE_URL') || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

export function aiConfigured(): boolean {
  return !!llmKey();
}

/** Token and cost accounting, so the model choice can be justified with real numbers. */
export interface Usage { calls: number; promptTokens: number; completionTokens: number; costUsd: number }
const usage: Usage = { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 };
export const getUsage = (): Usage => ({ ...usage });
export const resetUsage = () => { usage.calls = 0; usage.promptTokens = 0; usage.completionTokens = 0; usage.costUsd = 0; };

type Tool = { name: string; description: string; input_schema: object };

interface ChatResponse {
  choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
}

/** Pull a JSON object out of plain text (some models answer in text even when a tool is forced). */
export function parseLooseJson(text: string): Record<string, unknown> | null {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(t.slice(start, end + 1));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function callTool(system: string, user: string, tool: Tool, timeoutMs = 15_000): Promise<Record<string, unknown>> {
  const apiKey = llmKey();
  if (!apiKey) throw new Error('missing_api_key');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${llmBase()}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, 'x-title': 'Silsila' },
      body: JSON.stringify({
        model: llmModel(),
        max_tokens: 1000,
        temperature: 0.2,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        tools: [{ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
        tool_choice: { type: 'function', function: { name: tool.name } },
        // OpenRouter: only route to providers that really support tools; ask for token and cost accounting
        provider: { require_parameters: true },
        usage: { include: true },
      }),
    });
    if (!res.ok) throw new Error(`llm_http_${res.status}`);
    const j = (await res.json()) as ChatResponse;
    usage.calls++;
    usage.promptTokens += j.usage?.prompt_tokens ?? 0;
    usage.completionTokens += j.usage?.completion_tokens ?? 0;
    usage.costUsd += j.usage?.cost ?? 0;
    const msg = j.choices?.[0]?.message;
    const args = msg?.tool_calls?.[0]?.function?.arguments;
    if (args) {
      try { return JSON.parse(args) as Record<string, unknown>; } catch { /* fall through to loose parsing */ }
      const loose = parseLooseJson(args);
      if (loose) return loose;
    }
    const fromText = msg?.content ? parseLooseJson(msg.content) : null;
    if (fromText) return fromText;
    throw new Error('no_tool_output');
  } finally {
    clearTimeout(timer);
  }
}

export async function diagnoseWithLLM(pack: ConceptPack, text: string, ctx: BrainContext): Promise<Diagnosis> {
  const raw = await callTool(diagnoseSystem(pack), diagnoseUser(text, ctx), diagnoseTool(pack));
  return normaliseDiagnosis(pack, raw, text, ctx, 'ai');
}

export async function teachWithLLM(pack: ConceptPack, text: string): Promise<TeachResult> {
  const raw = await callTool(teachSystem(pack), `CHILD REPLIED: «${text}»\n\nCall record_teaching.`, teachTool());
  return normaliseTeach(pack, raw, 'ai');
}

export async function challengeWithLLM(pack: ConceptPack, teachings: string[]): Promise<ChallengeResult> {
  const raw = await callTool(challengeSystem(pack), challengeUser(teachings), challengeTool());
  return normaliseChallenge(pack, raw, 'ai');
}

export async function transferWithLLM(pack: ConceptPack, text: string): Promise<TransferResult> {
  const raw = await callTool(transferSystem(pack), `CHILD SAID: «${text}»\n\nCall record_transfer.`, transferTool());
  return normaliseTransfer(raw, 'ai');
}

export async function activityWithLLM(pack: ConceptPack, summary: string, fallback: Omit<ActivityPlan, 'source'>): Promise<ActivityPlan> {
  const raw = await callTool(activitySystem(pack), `Class data:\n${summary}\n\nCall record_activity.`, activityTool(), 25_000);
  return normaliseActivity(raw, fallback, 'ai');
}
