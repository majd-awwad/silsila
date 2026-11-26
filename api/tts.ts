/**
 * POST /api/tts {text} → audio/mpeg. Optional cloud voice for Noor through OpenRouter (/audio/speech).
 * Off unless TTS_MODEL is set; the browser's speechSynthesis is the default. Only Noor's own lines are sent, never the child's.
 */
import { llmBase, llmKey } from '../src/brain/server';
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
      body: JSON.stringify({ model, input: text, voice: process.env.TTS_VOICE || undefined, response_format: 'mp3' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return Response.json({ error: 'tts_failed' }, { status: 502 });
    return new Response(await r.arrayBuffer(), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=3600' } });
  } catch (e) {
    console.error('[tts]', (e as Error).message);
    return Response.json({ error: 'tts_failed' }, { status: 502 });
  }
}
