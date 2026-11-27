/**
 * POST /api/tts {text} → audio (wav for Gemini, mp3 otherwise). Optional cloud voice for Noor through OpenRouter
 * (/audio/speech). Off unless TTS_MODEL is set; the browser's speechSynthesis is the default. The app sends only
 * Noor's own lines; the server cannot verify that, so the length and rate are limited.
 */
import { z } from 'zod';
import { llmBase, llmKey } from '../src/brain/server';
import { speechBody } from '../src/brain/speech';
import { take } from './_limit';
import { clientIp, error, logError, readBody } from './_util';

const TtsRequest = z.object({ text: z.string().min(1).max(500) });

export async function POST(request: Request): Promise<Response> {
  const wait = take('tts', clientIp(request));
  if (wait) return error('rate_limited', 429, wait);
  const model = process.env.TTS_MODEL;
  if (!model || !llmKey()) return error('tts_off', 503);
  const body = await readBody(request, 4_096);
  if (!body.ok) return error('bad_request', body.status);
  const input = TtsRequest.safeParse(body.value);
  const text = input.success ? input.data.text.trim() : '';
  if (!text) return error('bad_request', 400);
  try {
    // TTS_STYLE describes the Arabic voice; English lines keep the built-in English style
    const style = /[؀-ۿ]/.test(text) ? process.env.TTS_STYLE || undefined : undefined;
    const r = await fetch(`${llmBase()}/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${llmKey()}` },
      body: JSON.stringify(speechBody(model, text, process.env.TTS_VOICE, style)),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`tts_http_${r.status}`);
    const sent = r.headers.get('content-type') ?? '';
    const type = sent.startsWith('audio/') ? sent : model.startsWith('google/') ? 'audio/wav' : 'audio/mpeg';
    return new Response(await r.arrayBuffer(), { headers: { 'content-type': type, 'cache-control': 'private, max-age=3600' } });
  } catch (e) {
    logError('tts', e);
    return error('tts_failed', 502);
  }
}
