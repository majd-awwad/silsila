import { afterEach, describe, expect, it, vi } from 'vitest';
import { wordErrorRate } from '../scripts/wer';
import { diagnoseWithLLM, REQUEST_VARIANTS } from '../src/brain/server';
import { speechBody, transcriptionBody } from '../src/brain/speech';
import { getPack } from '../src/packs';
import { encodeWav } from '../src/voice/wav';

describe('cloud voice requests', () => {
  it('asks Gemini for wav with a Palestinian style, never mp3', () => {
    const b = speechBody('google/gemini-3.8-flash-tts', 'مرحبا');
    expect(b.response_format).toBe('wav');
    expect(b.voice).toBe('Leda');
    expect(b.instructions).toContain('Palestinian');
  });
  it('asks ElevenLabs for mp3 and sends no style field it does not know', () => {
    const b = speechBody('elevenlabs/eleven-v3', 'مرحبا');
    expect(b.response_format).toBe('mp3');
    expect('instructions' in b).toBe(false);
  });
  it('transcribes in Arabic and hints the dialect without science words', () => {
    const b = transcriptionBody('openai/gpt-4o-transcribe', 'AAAA', 'wav');
    expect(b.language).toBe('ar');
    expect(b.prompt).toContain('الفلسطينية');
    for (const w of ['بخار', 'تكاثف', 'تبخر', 'نقط', 'برد']) expect(b.prompt).not.toContain(w);
  });
  it('writes a valid mono 16-bit WAV', () => {
    const v = new DataView(encodeWav(new Float32Array([0, 1, -1]), 16000));
    expect(v.byteLength).toBe(44 + 6);
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32768);
  });
  it('word error rate ignores spelling variants and counts real mistakes', () => {
    expect(wordErrorRate('أنا شفت الكاسة.', 'انا شفت الكاسه')).toBe(0);
    expect(wordErrorRate('المي بتنز من الكاسة', 'المي بتنط من الكاسة')).toBeCloseTo(0.25);
  });
});

describe('models that reject a setting', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it('tries the next variant, then remembers the one that worked', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test');
    vi.stubEnv('LLM_MODEL', 'test/no-temperature');
    const sent: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      sent.push(body);
      if ('temperature' in body) return new Response('{}', { status: 404 });
      return Response.json({ choices: [{ message: { content: '{"status":"unclear"}' } }] });
    });
    const pack = getPack('condensation');
    const ctx = { pack: pack.id, phase: 'explain' as const, previous: [], experiments: [] };
    await diagnoseWithLLM(pack, 'ما بعرف', ctx);
    expect(sent.length).toBe(3);
    expect(sent[2]).toMatchObject(REQUEST_VARIANTS[2]);
    await diagnoseWithLLM(pack, 'ما بعرف', ctx);
    expect(sent.length).toBe(4);
  });
});

import { normaliseDiagnosis } from '../src/brain/normalise';

describe('the broken link follows from the idea, whatever the model says', () => {
  const pack = getPack('condensation');
  const ctx = { pack: pack.id, phase: 'explain' as const, previous: [], experiments: [] };
  const diag = (sources: string[], broken: string) => normaliseDiagnosis(pack, { status: 'model', sources, broken_link: broken, confidence: 0.9, noor: 'شو رأيك؟' }, 'نص', ctx, 'ai');
  it('a wrong source breaks at C2', () => {
    expect(diag(['inside_water'], 'C1').broken_link).toBe('C2');
    expect(diag(['ice'], 'C4').broken_link).toBe('C2');
  });
  it('the right source breaks later in the chain', () => {
    expect(diag(['air_vapor'], 'C2').broken_link).toBe('C3');
    expect(diag(['air_vapor'], 'C4').broken_link).toBe('C4');
  });
});
