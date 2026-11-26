/**
 * POST /api/stt {audio: base64, format} → {text}. Optional cloud speech-to-text through OpenRouter (/audio/transcriptions).
 * Off unless STT_MODEL is set; the browser's own speech recognition is the default. The audio is forwarded and never stored.
 */
import { llmBase, llmKey } from '../src/brain/server';
import { transcriptionBody } from '../src/brain/speech';
import { bad, readJson } from './_util';

const MAX_B64 = 2_000_000;

export async function POST(request: Request): Promise<Response> {
  const model = process.env.STT_MODEL;
  if (!model || !llmKey()) return Response.json({ error: 'stt_off' }, { status: 503 });
  const body = await readJson(request);
  const audio = body?.audio;
  const format = typeof body?.format === 'string' && /^[a-z0-9]{2,5}$/i.test(body.format) ? body.format : 'webm';
  if (typeof audio !== 'string' || !audio || audio.length > MAX_B64) return bad();
  try {
    const r = await fetch(`${llmBase()}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${llmKey()}` },
      body: JSON.stringify(transcriptionBody(model, audio, format)),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) {
      console.error('[stt]', r.status, (await r.text()).slice(0, 300));
      return Response.json({ error: 'stt_failed' }, { status: 502 });
    }
    const j = (await r.json()) as { text?: string };
    return Response.json({ text: (j.text ?? '').trim().slice(0, 600) });
  } catch (e) {
    console.error('[stt]', (e as Error).message);
    return Response.json({ error: 'stt_failed' }, { status: 502 });
  }
}
