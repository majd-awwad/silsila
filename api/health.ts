/** POST /api/health → {ai, model, stt, tts, store}: what is configured. Never returns secrets or addresses. */
import { aiConfigured, llmModel } from '../src/brain/server';
import { PACKS } from '../src/packs';
import { aiLast, aiPaused, probeAi } from './_ai';
import { take } from './_limit';
import { storeKind } from './_store';
import { clientIp, error, json } from './_util';

export async function POST(request: Request): Promise<Response> {
  const wait = take('health', clientIp(request));
  if (wait) return error('rate_limited', 429, wait);
  const ai = aiConfigured();
  // {probe:true} makes one tiny real call (the judge page's button); never on page load
  const probe = ai && ((await request.json().catch(() => null)) as { probe?: unknown } | null)?.probe === true;
  const last = probe ? await probeAi(PACKS.condensation) : aiLast();
  return json({
    ai,
    model: ai ? llmModel() : null,
    stt: ai && !!process.env.STT_MODEL,
    tts: ai && !!process.env.TTS_MODEL,
    // null: hosted without Redis, so the live classroom is not available
    store: storeKind(),
    // last: null until a real model call happened on this server; reason is a short code, never a message or a key
    last: ai ? last : null,
    paused: ai && aiPaused(),
  });
}
