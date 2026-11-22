/**
 * Speech to text with the browser's Web Speech API (Chrome / Edge).
 * Returns null where unsupported; the UI then hides the mic and typing stays available.
 * The text is always shown in the box before sending, so the child can fix what was misheard.
 */
interface SR extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SR;

export interface Dictation {
  start(onText: (text: string, final: boolean) => void, onEnd: () => void): void;
  stop(): void;
}

const LANGS = ['ar-PS', 'ar-JO', 'ar'];

export function createDictation(): Dictation | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  let rec: SR | null = null;
  let langIdx = 0;
  return {
    start(onText, onEnd) {
      const run = () => {
        rec = new Ctor();
        rec.lang = LANGS[langIdx];
        rec.continuous = true;
        rec.interimResults = true;
        let finalText = '';
        rec.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText += r[0].transcript + ' ';
            else interim += r[0].transcript;
          }
          onText((finalText + interim).trim(), !interim);
        };
        rec.onerror = (e) => {
          if (e.error === 'language-not-supported' && langIdx < LANGS.length - 1) { langIdx++; run(); }
        };
        rec.onend = onEnd;
        rec.start();
      };
      run();
    },
    stop() { rec?.stop(); },
  };
}
