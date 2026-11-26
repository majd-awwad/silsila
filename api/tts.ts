/**
 * POST /api/tts {text} → audio (wav for Gemini, mp3 otherwise). Optional cloud voice for Noor through OpenRouter (/audio/speech).
 * Off unless TTS_MODEL is set; the browser's speechSynthesis is the default. Only Noor's own lines are sent, never the child's.
 */
import { llmBase, llmKey } from '../src/brain/server';
import { speechBody } from '../src/brain/speech';
import { bad, cleanText, readJson } from './_util';

export async function POST(request: Request): Promise<Response> {
  const model = process.env.TTS_MODEL;
  if (!model || !llmKey()) return Response.json({ error: 'tts_off' }, { status: 503 });
  const text = cleanText((await readJson(request))?.text, 500);
  if (!text) return bad();
  try {
    const r = await fetch(`${llmBase()}/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${llmKey()}` },
      body: JSON.stringify(speechBody(model, text, process.env.TTS_VOICE, process.env.TTS_STYLE || undefined)),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) {
      console.error('[tts]', r.status, (await r.text()).slice(0, 300));
      return Response.json({ error: 'tts_failed' }, { status: 502 });
    }
    const type = r.headers.get('content-type') ?? (model.startsWith('google/') ? 'audio/wav' : 'audio/mpeg');
    return new Response(await r.arrayBuffer(), { headers: { 'content-type': type, 'cache-control': 'private, max-age=3600' } });
  } catch (e) {
    console.error('[tts]', (e as Error).message);
    return Response.json({ error: 'tts_failed' }, { status: 502 });
  }
}
