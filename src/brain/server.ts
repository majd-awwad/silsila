/**
 * Server-side calls to the language model. Imported only by api/*.ts and scripts (never by the browser),
 * so the API key never reaches the child's device.
 *
 * Provider: any OpenAI-compatible chat endpoint, OpenRouter by default (one key, many models; the model is
 * a config value so we can justify and swap it: see `npm run eval:models`).
 *   OPENROUTER_API_KEY  (or LLM_API_KEY)   secret, server only
 *   LLM_MODEL                              e.g. google/gemini-3.8-flash (OpenRouter slug)
 *   LLM_BASE_URL                           default https://openrouter.ai/api/v1
 *
 * Every function here either returns a validated result with source 'ai' or throws. It never falls back by
 * itself: api/ decides to answer with the offline rules (and says so), and the evaluation counts a failure as
 * a failure. Thrown messages are short codes only, never prompts, learner text or keys.
 */
import { z } from 'zod';
import type {
  ActivityPlan, ActivityRequest, BrainContext, Diagnosis, Lang, LessonDraft, LessonInput, TeachResult, TransferResult,
} from '../contracts';
import { ActivityPlan as ActivityPlanSchema, LessonDraft as LessonDraftSchema } from '../contracts';
import { RESOURCES, RESOURCE_IDS } from '../packs/resources';
import type { ResourceId } from '../packs/resources';
import type { ConceptPack } from '../packs/types';
import { fallbackActivity } from './classInsights';
import { matchPack } from './lesson';
import { normaliseDiagnosis, normaliseTeach, normaliseTransfer } from './normalise';
import type { RawDiagnosis } from './normalise';
import {
  activitySystem, activityTool, activityUser, diagnoseSystem, diagnoseTool, diagnoseUser, lessonSystem, lessonTool, lessonUser,
  teachSystem, teachTool, teachUser, transferSystem, transferTool, transferUser,
} from './prompts';
import type { Tool } from './prompts';
import { quoteIn } from './text';

export const DEFAULT_MODEL = 'google/gemini-3.8-flash';

/** Server-side time limits. Each is below the browser's own limit, so a fallback still reaches the screen. */
export const TIMEOUTS = { diagnose: 10_000, teach: 10_000, transfer: 10_000, activity: 25_000, lesson: 40_000 } as const;

const env = (k: string) => (typeof process !== 'undefined' ? process.env[k] : undefined);
export const llmKey = () => env('OPENROUTER_API_KEY') || env('LLM_API_KEY') || '';
export const llmModel = () => env('LLM_MODEL') || DEFAULT_MODEL;
export const llmBase = () => (env('LLM_BASE_URL') || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

export function aiConfigured(): boolean {
  return !!llmKey();
}

/** Token and cost accounting, so the model choice can be justified with real numbers. */
export interface Usage {
  calls: number; promptTokens: number; completionTokens: number; costUsd: number;
  /** calls for which the provider reported a cost: 0 means «cost unknown», not «free» */
  costedCalls: number;
}
const usage: Usage = { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, costedCalls: 0 };
export const getUsage = (): Usage => ({ ...usage });
export const resetUsage = () => { usage.calls = 0; usage.promptTokens = 0; usage.completionTokens = 0; usage.costUsd = 0; usage.costedCalls = 0; };

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

/**
 * Models differ in what they accept: some reject `temperature`, some require reasoning, some cannot reason with a
 * forced tool. These optional settings are tried in order; the first that the model accepts is remembered.
 */
export const REQUEST_VARIANTS: Record<string, unknown>[] = [
  { temperature: 0.2, reasoning: { effort: 'low' } },
  { temperature: 0.2 },
  { reasoning: { effort: 'low' } },
  { reasoning: { effort: 'none' } },
  {},
  // some providers (Claude Haiku) accept a forced tool but do not advertise it, so strict routing finds nobody
  { provider: {} },
];
const accepted = new Map<string, number>();
/** HTTP codes that mean "this combination of settings is not supported": worth trying the next one. */
const UNSUPPORTED = new Set([400, 404, 422]);

export interface CallOptions { timeoutMs?: number }

async function callTool(system: string, user: string, tool: Tool, timeoutMs: number, maxTokens = 3000): Promise<Record<string, unknown>> {
  const apiKey = llmKey();
  if (!apiKey) throw new Error('missing_api_key');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const model = llmModel();
    const post = (extra: Record<string, unknown>) => fetch(`${llmBase()}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, 'x-title': 'Silsila' },
      body: JSON.stringify({
        model,
        // room for models that think before answering; only used tokens are billed
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        tools: [{ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
        tool_choice: { type: 'function', function: { name: tool.name } },
        // OpenRouter: only route to providers that really support tools; ask for token and cost accounting
        provider: { require_parameters: true },
        usage: { include: true },
        ...extra,
      }),
    });
    let i = accepted.get(model) ?? 0;
    let res = await post(REQUEST_VARIANTS[i]);
    while (UNSUPPORTED.has(res.status) && i < REQUEST_VARIANTS.length - 1) res = await post(REQUEST_VARIANTS[++i]);
    if (!res.ok) throw new Error(`llm_http_${res.status}`);
    accepted.set(model, i);
    const j = (await res.json()) as ChatResponse;
    usage.calls++;
    usage.promptTokens += j.usage?.prompt_tokens ?? 0;
    usage.completionTokens += j.usage?.completion_tokens ?? 0;
    if (typeof j.usage?.cost === 'number') { usage.costUsd += j.usage.cost; usage.costedCalls++; }
    const msg = j.choices?.[0]?.message;
    const args = msg?.tool_calls?.[0]?.function?.arguments;
    if (args) {
      try {
        const v = JSON.parse(args) as unknown;
        if (v && typeof v === 'object') return v as Record<string, unknown>;
      } catch { /* fall through to loose parsing */ }
      const loose = parseLooseJson(args);
      if (loose) return loose;
    }
    const fromText = msg?.content ? parseLooseJson(msg.content) : null;
    if (fromText) return fromText;
    throw new Error('no_tool_output');
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error('llm_timeout');
    if (e instanceof Error && /^[a-z]+(_[a-z]+)*(_\d{3})?$/.test(e.message)) throw e;
    throw new Error(e instanceof SyntaxError ? 'llm_bad_response' : 'llm_network');
  } finally {
    clearTimeout(timer);
  }
}

const nonce = () => globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12);

function parsed<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  // the zod message could echo model output (and so learner words): only a code leaves this function
  if (!r.success) throw new Error('malformed_output');
  return r.data;
}

/* ───────────────────────── learner calls: evidence only ───────────────────────── */

const RawSteps = z.array(z.object({
  met: z.union([z.boolean(), z.literal(0), z.literal(1)]),
  evidence: z.string().nullish(),
})).length(3);

const RawEvidence = z.object({
  relevance: z.enum(['answer', 'unsupported', 'unclear', 'offtopic']),
  contradiction: z.boolean().default(false),
  ideas: z.array(z.object({ id: z.string(), evidence: z.string() })).max(12),
  rejected: z.array(z.string()).max(20).default([]),
  steps: RawSteps,
  chain: z.array(z.string()).max(8).catch([]),
  wrong_step: z.number().int().nullable().catch(null),
  clarify_id: z.string().nullable().catch(null),
});

/**
 * Shape check plus two guards that sit in front of normalise.ts:
 *  - only the pack's own idea ids pass;
 *  - the causal chain is kept only when every piece is a quote of the learner, so no model-written sentence can
 *    reach a child's screen (otherwise normalise.ts shows the pack's authored story).
 */
export function checkedEvidence(pack: ConceptPack, raw: unknown, text: string): RawDiagnosis {
  const r = parsed(RawEvidence, raw);
  const known = (id: string) => Object.hasOwn(pack.ideas, id);
  const pieces = r.chain.map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const grounded = pieces.length >= 2 && pieces.every((s) => quoteIn(text, s));
  const chain = grounded ? pieces : [];
  const wrong = r.wrong_step;
  return {
    relevance: r.relevance,
    contradiction: r.contradiction,
    ideas: r.ideas.filter((i) => known(i.id)),
    rejected: r.rejected.filter(known),
    steps: r.steps,
    chain,
    wrong_step: grounded && wrong !== null && wrong >= 0 && wrong < chain.length ? wrong : null,
    clarify_id: r.clarify_id,
  };
}

export async function diagnoseWithLLM(pack: ConceptPack, text: string, ctx: BrainContext, options: CallOptions = {}): Promise<Diagnosis> {
  const raw = await callTool(diagnoseSystem(pack), diagnoseUser(text, ctx, nonce()), diagnoseTool(pack), options.timeoutMs ?? TIMEOUTS.diagnose);
  return normaliseDiagnosis(pack, checkedEvidence(pack, raw, text), text, ctx, { source: 'ai' });
}

const RawTeach = z.object({ caught: z.boolean(), rejects: z.boolean().default(true), reason_evidence: z.string().nullish(), steps: RawSteps });

export async function teachWithLLM(pack: ConceptPack, text: string, options: CallOptions = {}): Promise<TeachResult> {
  const raw = parsed(RawTeach, await callTool(teachSystem(pack), teachUser(text, nonce()), teachTool(), options.timeoutMs ?? TIMEOUTS.teach));
  // a correction counts only with a reason the learner really wrote
  const caught = raw.caught && raw.rejects && quoteIn(text, raw.reason_evidence ?? '');
  return normaliseTeach({ caught, steps: raw.steps }, text, 'ai');
}

const RawTransfer = z.object({ steps: RawSteps });

export async function transferWithLLM(pack: ConceptPack, text: string, options: CallOptions = {}): Promise<TransferResult> {
  const raw = parsed(RawTransfer, await callTool(transferSystem(pack), transferUser(text, nonce()), transferTool(), options.timeoutMs ?? TIMEOUTS.transfer));
  return normaliseTransfer(raw, text, 'ai');
}

/* ───────────────────────── teacher calls: drafted text ───────────────────────── */

/** Model-written text for a teacher: plain text only (no markup, code or links), clamped. */
export function plainText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const t = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?(<\/\1\s*>|$)/gi, ' ')
    .replace(/<\/?[a-z!][^>]*>/gi, ' ')
    .replace(/\b(?:javascript|vbscript):\S*|\bdata:[\w.+-]+\/[\w.+-]+[;,]\S*/gi, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/`/g, '')
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Is the draft written in the requested language? */
export function inLanguage(text: string, lang: Lang): boolean {
  const arabic = text.match(/[ء-ي]/g)?.length ?? 0;
  const latin = text.match(/[a-z]/gi)?.length ?? 0;
  if (!arabic && !latin) return false;
  const share = arabic / (arabic + latin);
  return lang === 'ar' ? share >= 0.7 : share <= 0.1;
}

/** A last line of defence behind the prompt and the closed list of materials. Deliberately short. */
const UNSAFE = /\b(candles?|bleach|knife|knives|open flames?|light a match|bunsen)\b|(?<![ء-ي])(?:و|ب|ال|وال|بال)?(شمع[ةه]|شموع|ولاع[ةه]|كبريت|سكين|سكاكين|كلور)(?![ء-ي])/i;
const SHAMING = /\b(stupid|dumb|idiot|foolish)\b|(?<![ء-ي])(?:و|ال|وال)?(غبي|اغبياء|أغبياء|غباء|سخيف[ةه]?)(?![ء-ي])/i;

interface TimedStep { minutes: number; title: string; detail: string }

/** Scale step minutes so they add up exactly to `total`, merging the extra steps when there are more steps than minutes. */
export function fitMinutes<T extends TimedStep>(steps: T[], total: number): T[] {
  const whole = Math.max(1, Math.round(total));
  let list = steps;
  if (list.length > whole) {
    const rest = list.slice(whole - 1);
    list = [...list.slice(0, whole - 1), { ...rest[0], detail: rest.map((s, i) => (i ? `${s.title}: ${s.detail}` : s.detail)).join(' ') }];
  }
  if (!list.length) return list;
  const sum = list.reduce((a, s) => a + Math.max(0, s.minutes), 0) || 1;
  const exact = list.map((s) => (Math.max(0, s.minutes) * whole) / sum);
  const out = exact.map((x) => Math.max(1, Math.floor(x)));
  let left = whole - out.reduce((a, b) => a + b, 0);
  while (left !== 0) {
    // give a minute to the step that lost most by rounding, or take one back from the longest
    const step = left > 0 ? 1 : -1;
    let pick = -1;
    for (let i = 0; i < out.length; i++) {
      if (step < 0 && out[i] <= 1) continue;
      if (pick < 0 || (step > 0 ? exact[i] - out[i] > exact[pick] - out[pick] : out[i] > out[pick])) pick = i;
    }
    out[pick] += step;
    left -= step;
  }
  return list.map((s, i) => ({ ...s, minutes: out[i] }));
}

/** Keep only ids and materials the pack and the app know: nothing else from the request reaches a prompt or a plan. */
export function cleanActivityRequest(pack: ConceptPack, req: ActivityRequest): ActivityRequest {
  return {
    ...req,
    pack: pack.id,
    resources: [...new Set(req.resources.filter((r) => (RESOURCE_IDS as string[]).includes(r)))],
    evidence: {
      ...req.evidence,
      ideas: req.evidence.ideas.filter((i) => Object.hasOwn(pack.ideas, i.id)),
      gaps: req.evidence.gaps.filter((g) => pack.prerequisites.some((p) => p.id === g.id)),
    },
  };
}

const text = z.string().min(1);
const RawActivity = z.object({
  title: text,
  target: text,
  objective: text,
  grouping: text,
  materials: z.array(z.unknown()).max(30).default([]),
  steps: z.array(z.object({ minutes: z.coerce.number().positive().max(240), title: text, detail: text })).min(2).max(8),
  teacher: text,
  check: text,
  adapt: z.string().default(''),
});

/** Validate and clamp a model's activity. Throws when anything is malformed, unsafe or in the wrong language. */
export function checkedActivity(pack: ConceptPack, req: ActivityRequest, raw: unknown): ActivityPlan {
  const r = parsed(RawActivity, raw);
  const must = (v: string, max: number) => {
    const t = plainText(v, max);
    if (!t) throw new Error('malformed_output');
    return t;
  };
  if (r.steps.length > req.minutes) throw new Error('malformed_output');
  const steps = r.steps.map((s) => ({ minutes: s.minutes, title: must(s.title, 100), detail: must(s.detail, 500) }));
  const allowed: string[] = req.resources.length ? req.resources : RESOURCE_IDS;
  const materials = [...new Set(r.materials.filter((m): m is ResourceId => typeof m === 'string' && allowed.includes(m)))]
    .slice(0, 12).map((m) => RESOURCES[m][req.lang]);
  const plan = {
    title: must(r.title, 120),
    type: req.type,
    // the reason is a statement about this class's counts, so it is computed, never written by the model
    why: fallbackActivity(pack, req).why,
    target: must(r.target, 300),
    objective: must(r.objective, 300),
    grouping: must(r.grouping, 200),
    materials,
    minutes: req.minutes,
    steps: fitMinutes(steps, req.minutes),
    teacher: must(r.teacher, 600),
    check: must(r.check, 300),
    adapt: plainText(r.adapt, 600),
    source: 'ai' as const,
  };
  const all = [plan.title, plan.target, plan.objective, plan.grouping, plan.teacher, plan.check, plan.adapt, ...steps.flatMap((s) => [s.title, s.detail])].join(' ');
  if (UNSAFE.test(all) || SHAMING.test(all)) throw new Error('unsafe_output');
  if (!inLanguage(all, req.lang)) throw new Error('wrong_language');
  return ActivityPlanSchema.parse(plan);
}

export async function activityWithLLM(pack: ConceptPack, request: ActivityRequest, options: CallOptions = {}): Promise<ActivityPlan> {
  const req = cleanActivityRequest(pack, request);
  const allowed = (req.resources.length ? req.resources : RESOURCE_IDS) as ResourceId[];
  const raw = await callTool(activitySystem(pack, req.lang), activityUser(pack, req, allowed, nonce()), activityTool(allowed), options.timeoutMs ?? TIMEOUTS.activity, 4000);
  return checkedActivity(pack, req, raw);
}

const rawList = z.array(z.unknown()).default([]);
const RawLesson = z.object({
  objectives: z.array(z.unknown()),
  concepts: rawList,
  prerequisites: rawList,
  misconceptions: rawList,
  questions: z.array(z.unknown()),
  experiments: rawList,
  activities: z.array(z.unknown()),
  assessment: rawList,
  transfer: rawList,
  guidance: rawList,
});

const record = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});

/** Validate and clamp a lesson draft: text only, bounded, and the matching pack is decided by code. */
export function checkedLesson(input: LessonInput, raw: unknown): LessonDraft {
  const r = parsed(RawLesson, raw);
  const lines = (xs: unknown[], max = 10, length = 240) => xs.map((x) => plainText(x, length)).filter(Boolean).slice(0, max);
  const activities = r.activities.map(record).map((a) => ({
    title: plainText(a.title, 120),
    minutes: Math.min(input.minutes, Math.max(1, Math.round(Number(a.minutes)) || 1)),
    detail: plainText(a.detail, 500),
  })).filter((a) => a.title && a.detail).slice(0, 8);
  const draft = {
    title: input.title,
    objectives: lines(r.objectives),
    concepts: lines(r.concepts),
    prerequisites: lines(r.prerequisites),
    misconceptions: r.misconceptions.map(record)
      .map((m) => ({ idea: plainText(m.idea, 240), probe: plainText(m.probe, 300) }))
      .filter((m) => m.idea && m.probe).slice(0, 8),
    questions: lines(r.questions),
    experiments: r.experiments.map(record).map((x) => ({
      title: plainText(x.title, 120),
      steps: lines(Array.isArray(x.steps) ? x.steps : []),
      materials: lines(Array.isArray(x.materials) ? x.materials : [], 10, 80),
      safety: plainText(x.safety, 300) || (input.lang === 'ar' ? 'راجعوا السلامة قبل التنفيذ.' : 'Check safety before running this.'),
    })).filter((x) => x.title && x.steps.length).slice(0, 5),
    activities: fitMinutes(activities, input.minutes),
    assessment: lines(r.assessment),
    transfer: lines(r.transfer),
    guidance: lines(r.guidance, 10, 400),
    matchedPack: matchPack(input.title, input.content, input.objectives)?.id ?? null,
    source: 'ai' as const,
  };
  if (!draft.objectives.length || !draft.questions.length || !draft.activities.length) throw new Error('malformed_output');
  const all = [...draft.objectives, ...draft.questions, ...draft.guidance, ...draft.activities.flatMap((a) => [a.title, a.detail])].join(' ');
  if (SHAMING.test(all)) throw new Error('unsafe_output');
  if (!inLanguage(all, input.lang)) throw new Error('wrong_language');
  return LessonDraftSchema.parse(draft);
}

export async function lessonWithLLM(input: LessonInput, options: CallOptions = {}): Promise<LessonDraft> {
  const pack = matchPack(input.title, input.content, input.objectives);
  const raw = await callTool(lessonSystem(input.lang), lessonUser(input, pack, nonce()), lessonTool(), options.timeoutMs ?? TIMEOUTS.lesson, 6000);
  return checkedLesson(input, raw);
}
