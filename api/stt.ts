/**
 * POST /api/stt {audio: base64, format, lang?} → {text}. Optional cloud speech-to-text through OpenRouter
 * (/audio/transcriptions). Off unless STT_MODEL is set; the browser's own speech recognition is the default.
 * The audio is forwarded and never stored or logged.
 */
import { z } from 'zod';
import { Lang } from '../src/contracts';
import { llmBase, llmKey } from '../src/brain/server';
import { transcriptionBody } from '../src/brain/speech';
import { take } from './_limit';
import { clientIp, error, json, logError, readBody } from './_util';

const MAX_B64 = 2_000_000;
const FORMATS = ['webm', 'wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac', 'aac'];

const SttRequest = z.object({
  audio: z.string().min(1).max(MAX_B64).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  format: z.string().max(10).optional(),
  lang: Lang.optional(),
});

export async function POST(request: Request): Promise<Response> {
  const wait = take('stt', clientIp(request));
  if (wait) return error('rate_limited', 429, wait);
  const model = process.env.STT_MODEL;
  if (!model || !llmKey()) return error('stt_off', 503);
  const body = await readBody(request, MAX_B64 + 1_024);
  if (!body.ok) return error('bad_request', body.status);
  const input = SttRequest.safeParse(body.value);
  if (!input.success) return error('bad_request', 400);
  const format = FORMATS.includes(input.data.format?.toLowerCase() ?? '') ? input.data.format!.toLowerCase() : 'webm';
  try {
    const r = await fetch(`${llmBase()}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${llmKey()}` },
      body: JSON.stringify(transcriptionBody(model, input.data.audio, format, input.data.lang ?? 'ar')),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`stt_http_${r.status}`);
    const j = (await r.json()) as { text?: unknown };
    return json({ text: typeof j.text === 'string' ? j.text.trim().slice(0, 600) : '' });
  } catch (e) {
    logError('stt', e);
    return error('stt_failed', 502);
  }
}
