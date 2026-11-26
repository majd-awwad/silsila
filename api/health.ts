/** POST /api/health → {ai, model, stt, tts, liveStore}: what is configured. Never returns secrets. */
import { aiConfigured, llmModel } from '../src/brain/server';
import { storeKind } from './_store';

export async function POST(): Promise<Response> {
  const ai = aiConfigured();
  return Response.json({
    ai, model: ai ? llmModel() : null,
    stt: ai && !!process.env.STT_MODEL, tts: ai && !!process.env.TTS_MODEL,
    liveStore: storeKind(),
  });
}
