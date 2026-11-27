/** POST /api/health → {ai, model, stt, tts, store}: what is configured. Never returns secrets or addresses. */
import { aiConfigured, llmModel } from '../src/brain/server';
import { take } from './_limit';
import { storeKind } from './_store';
import { clientIp, error, json } from './_util';

export async function POST(request: Request): Promise<Response> {
  const wait = take('health', clientIp(request));
  if (wait) return error('rate_limited', 429, wait);
  const ai = aiConfigured();
  return json({
    ai,
    model: ai ? llmModel() : null,
    stt: ai && !!process.env.STT_MODEL,
    tts: ai && !!process.env.TTS_MODEL,
    // null: hosted without Redis, so the live classroom is not available
    store: storeKind(),
  });
}
