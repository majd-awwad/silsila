/**
 * Request bodies for cloud voice (OpenRouter /audio). Shared by api/tts, api/stt and scripts/voice-samples, so what
 * the team listens to in the samples is exactly what the app sends. Server side only.
 */
import type { Lang } from '../contracts';

/** How Noor should sound. Only some providers follow it (Gemini TTS, OpenAI, Fish Audio). */
export const NOOR_STYLE =
  'Speak Palestinian Arabic with a natural West Bank accent, never Modern Standard Arabic. You are Noor, a small ' +
  'friendly robot talking to a nine-year-old child: warm, curious, cheerful, clear and unhurried.';

export const NOOR_STYLE_EN =
  'Speak simple, clear English. You are Noor, a small friendly robot talking to a nine-year-old child: warm, ' +
  'curious, cheerful, clear and unhurried.';

/** Noor's lines are authored in one language; the script tells which style fits. */
export const spokenLang = (text: string): Lang => (/[؀-ۿ]/.test(text) ? 'ar' : 'en');

export const defaultVoice = (model: string): string | undefined =>
  model.startsWith('google/gemini') ? 'Leda' : model.startsWith('elevenlabs/') ? 'jessica' : model.startsWith('x-ai/') ? 'eve' : undefined;

export function speechBody(model: string, text: string, voice?: string, style = spokenLang(text) === 'ar' ? NOOR_STYLE : NOOR_STYLE_EN) {
  const gemini = model.startsWith('google/gemini');
  const styled = gemini || model.startsWith('openai/') || model.startsWith('fish-audio/');
  return {
    model,
    input: text,
    voice: voice || defaultVoice(model),
    // Gemini TTS refuses mp3 (wav or pcm only)
    response_format: gemini ? 'wav' : 'mp3',
    ...(styled ? { instructions: style } : {}),
  };
}

export function transcriptionBody(model: string, data: string, format: string, lang: Lang = 'ar') {
  return {
    model,
    input_audio: { data, format },
    language: lang,
    // a hint about the dialect, with no science words so it cannot steer what the child "said"
    ...(lang === 'ar' && model.startsWith('openai/') ? { prompt: 'طفل فلسطيني بيحكي باللهجة الفلسطينية. اكتب كلامه زي ما حكاه.' } : {}),
  };
}
