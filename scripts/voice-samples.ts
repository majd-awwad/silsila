/**
 * Voice bake-off. Needs OPENROUTER_API_KEY in .env.local.
 *   npm run voice:samples
 * 1. Speaks the same Noor lines with several TTS models → voice-samples/index.html (listen and pick by ear).
 * 2. Transcribes every recording you put in voice-in/ with several STT models. If voice-in/<name>.txt holds the
 *    exact words, it prints the word error rate. Use the team's own voices only: never record real children here.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { llmBase, llmKey } from '../src/brain/server';
import { speechBody, transcriptionBody } from '../src/brain/speech';
import { wordErrorRate } from './wer';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const TTS: [string, string][] = [
  ['google/gemini-3.8-flash-tts', 'Leda'],
  ['google/gemini-3.8-flash-tts', 'Puck'],
  ['google/gemini-3.8-flash-lite-tts', 'Leda'],
  ['elevenlabs/eleven-v3', 'jessica'],
  ['elevenlabs/eleven-v4-turbo', 'jessica'],
];
const STT = ['openai/gpt-4o-transcribe', 'openai/gpt-4o-mini-transcribe', 'google/gemini-3.5-transcribe', 'elevenlabs/scribe-v2', 'openai/whisper-large-v3-turbo'];
const LINES = [
  'أهلاً! أنا نور. شايف النقط اللي عم تطلع ع الكاسة من برّا؟ احكيلي بكلامك: من وين إجت؟',
  'يعني إذا جبنا كاسة فاضية من الفريزر، شو رح يصير عليها؟ يلا نجرّب ونشوف!',
  'ولا يهمك، إحنا بنتعلّم مع بعض. جرّب كمان مرة، أنا متحمّسة أسمع فكرتك.',
];
const headers = () => ({ 'content-type': 'application/json', authorization: `Bearer ${llmKey()}` });

async function speak() {
  mkdirSync('voice-samples', { recursive: true });
  let rows = '';
  for (const [model, voice] of TTS) {
    let cells = '';
    for (const [i, line] of LINES.entries()) {
      const body = speechBody(model, line, voice);
      const t0 = Date.now();
      try {
        const r = await fetch(`${llmBase()}/audio/speech`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
        const file = `${model.replace(/[^a-z0-9.-]+/gi, '_')}-${voice}-${i + 1}.${body.response_format}`;
        writeFileSync(join('voice-samples', file), Buffer.from(await r.arrayBuffer()));
        const ms = Date.now() - t0;
        console.log(`TTS ${model} ${voice} line ${i + 1}: ${ms} ms`);
        cells += `<td><audio controls preload="none" src="${file}"></audio><br><small>${ms} ms</small></td>`;
      } catch (e) {
        console.log(`TTS ${model} ${voice} line ${i + 1}: FAILED ${(e as Error).message}`);
        cells += '<td>فشل</td>';
      }
    }
    rows += `<tr><th dir="ltr">${model}<br>${voice}</th>${cells}</tr>`;
  }
  writeFileSync('voice-samples/index.html', `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>أصوات نور</title>
<style>body{font-family:sans-serif;padding:16px}td,th{border:1px solid #ccc;padding:8px}audio{width:220px}</style>
<h1>اختاروا صوت نور: مين أقرب للهجتنا؟</h1><ol>${LINES.map((l) => `<li>${l}</li>`).join('')}</ol><table>${rows}</table></html>`);
  console.log('\nافتحوا voice-samples/index.html واسمعوا. بعدين حطّوا الاختيار بـTTS_MODEL و TTS_VOICE.');
}

async function transcribe() {
  const dir = 'voice-in';
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(wav|mp3|m4a|ogg|webm|flac|aac)$/i.test(f)) : [];
  if (!files.length) {
    console.log('\nما في تسجيلات بـvoice-in/ . حطّوا تسجيلاتكم (مع ملف .txt فيه الكلام بالضبط) لقياس فهم اللهجة.');
    return;
  }
  for (const model of STT) {
    const rates: number[] = [];
    for (const f of files) {
      const txt = join(dir, `${f.slice(0, -extname(f).length)}.txt`);
      const t0 = Date.now();
      try {
        const body = transcriptionBody(model, readFileSync(join(dir, f)).toString('base64'), extname(f).slice(1).toLowerCase());
        const r = await fetch(`${llmBase()}/audio/transcriptions`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
        const said = ((await r.json()) as { text?: string }).text ?? '';
        const wer = existsSync(txt) ? wordErrorRate(readFileSync(txt, 'utf8'), said) : null;
        if (wer !== null) rates.push(wer);
        console.log(`STT ${model} ${f} (${Date.now() - t0} ms${wer === null ? '' : `, WER ${(wer * 100).toFixed(0)}%`}): ${said}`);
      } catch (e) {
        console.log(`STT ${model} ${f}: FAILED ${(e as Error).message}`);
      }
    }
    if (rates.length) console.log(`== ${model}: mean WER ${((rates.reduce((a, b) => a + b, 0) / rates.length) * 100).toFixed(1)}% over ${rates.length} files`);
  }
}

async function main() {
  if (!llmKey()) {
    console.error('ما في مفتاح: حطّوا OPENROUTER_API_KEY بملف .env.local');
    process.exit(1);
  }
  await speak();
  await transcribe();
}
main();
