/**
 * Speech to text with the browser's Web Speech API (Chrome / Edge).
 * Returns null where unsupported; the UI then hides the mic and typing stays available.
 * The text is always shown in the box before sending, so the child can fix what was misheard.
 */
import type { Lang } from '../contracts';

interface SR extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SR;

/** blocked: no permission for the microphone · failed: recording or transcription did not work */
export type DictationProblem = 'blocked' | 'failed';

export interface Dictation {
  start(onText: (text: string, final: boolean) => void, onEnd: (problem?: DictationProblem) => void): void;
  stop(): void;
}

const LANGS: Record<Lang, string[]> = { ar: ['ar-PS', 'ar-JO', 'ar'], en: ['en-GB', 'en-US', 'en'] };

export function createDictation(lang: Lang = 'ar'): Dictation | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  let rec: SR | null = null;
  let langIdx = 0;
  return {
    start(onText, onEnd) {
      const run = () => {
        const mine = new Ctor();
        rec = mine;
        let problem: DictationProblem | undefined;
        mine.lang = LANGS[lang][langIdx];
        mine.continuous = true;
        mine.interimResults = true;
        let finalText = '';
        mine.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText += r[0].transcript + ' ';
            else interim += r[0].transcript;
          }
          onText((finalText + interim).trim(), !interim);
        };
        mine.onerror = (e) => {
          if (e.error === 'language-not-supported' && langIdx < LANGS[lang].length - 1) { langIdx++; run(); return; }
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') problem = 'blocked';
          else if (e.error !== 'no-speech' && e.error !== 'aborted') problem = 'failed';
        };
        // a recogniser replaced by the next language must not end the session
        mine.onend = () => { if (rec === mine) onEnd(problem); };
        try { mine.start(); } catch { onEnd('failed'); }
      };
      run();
    },
    stop() { rec?.stop(); },
  };
}
