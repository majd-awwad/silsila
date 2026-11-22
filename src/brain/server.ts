/**
 * Server-side calls to Claude. Imported only by api/*.ts and scripts (never by the browser),
 * so the API key never reaches the child's device.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { BrainContext, Diagnosis, TeachResult } from '../contracts';
import { normaliseDiagnosis, normaliseTeach } from './normalise';
import { DIAGNOSE_SYSTEM, DIAGNOSE_TOOL, TEACH_SYSTEM, TEACH_TOOL, diagnoseUser, teachUser } from './prompts';

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('missing_api_key');
  return new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 });
}

async function callTool(system: string, user: string, tool: { name: string; description: string; input_schema: object }): Promise<Record<string, unknown>> {
  const res = await client().messages.create({
    model: MODEL(),
    max_tokens: 900,
    system,
    tools: [tool as Anthropic.Tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: user }],
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('no_tool_output');
  return block.input as Record<string, unknown>;
}

export async function diagnoseWithClaude(text: string, ctx: BrainContext): Promise<Diagnosis> {
  const raw = await callTool(DIAGNOSE_SYSTEM, diagnoseUser(text, ctx), DIAGNOSE_TOOL);
  return normaliseDiagnosis(raw, text, ctx, 'ai');
}

export async function teachWithClaude(text: string): Promise<TeachResult> {
  const raw = await callTool(TEACH_SYSTEM, teachUser(text), TEACH_TOOL);
  return normaliseTeach(raw, 'ai');
}
