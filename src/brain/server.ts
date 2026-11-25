/**
 * Server-side calls to Claude. Imported only by api/*.ts and scripts (never by the browser),
 * so the API key never reaches the child's device.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ActivityPlan, BrainContext, ChallengeResult, Diagnosis, TeachResult, TransferResult } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { normaliseActivity, normaliseChallenge, normaliseDiagnosis, normaliseTeach, normaliseTransfer } from './normalise';
import {
  activitySystem, activityTool, challengeSystem, challengeTool, challengeUser, diagnoseSystem, diagnoseTool, diagnoseUser,
  teachSystem, teachTool, transferSystem, transferTool,
} from './prompts';

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function callTool(system: string, user: string, tool: { name: string; description: string; input_schema: object }): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('missing_api_key');
  const client = new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 });
  const res = await client.messages.create({
    model: MODEL(),
    max_tokens: 1000,
    system,
    tools: [tool as Anthropic.Tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: user }],
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('no_tool_output');
  return block.input as Record<string, unknown>;
}

export async function diagnoseWithClaude(pack: ConceptPack, text: string, ctx: BrainContext): Promise<Diagnosis> {
  const raw = await callTool(diagnoseSystem(pack), diagnoseUser(text, ctx), diagnoseTool(pack));
  return normaliseDiagnosis(pack, raw, text, ctx, 'ai');
}

export async function teachWithClaude(pack: ConceptPack, text: string): Promise<TeachResult> {
  const raw = await callTool(teachSystem(pack), `CHILD REPLIED: «${text}»\n\nCall record_teaching.`, teachTool());
  return normaliseTeach(pack, raw, 'ai');
}

export async function challengeWithClaude(pack: ConceptPack, teachings: string[]): Promise<ChallengeResult> {
  const raw = await callTool(challengeSystem(pack), challengeUser(teachings), challengeTool());
  return normaliseChallenge(pack, raw, 'ai');
}

export async function transferWithClaude(pack: ConceptPack, text: string): Promise<TransferResult> {
  const raw = await callTool(transferSystem(pack), `CHILD SAID: «${text}»\n\nCall record_transfer.`, transferTool());
  return normaliseTransfer(raw, 'ai');
}

export async function activityWithClaude(pack: ConceptPack, summary: string, fallback: Omit<ActivityPlan, 'source'>): Promise<ActivityPlan> {
  const raw = await callTool(activitySystem(pack), `Class data:\n${summary}\n\nCall record_activity.`, activityTool());
  return normaliseActivity(raw, fallback, 'ai');
}
