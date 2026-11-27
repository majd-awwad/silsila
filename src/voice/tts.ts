/**
 * Noor's voice with the browser's speechSynthesis. Picks a voice in the lesson's language if the device has one;
 * otherwise speaking is unavailable and Noor's words stay on screen (they always do anyway).
 */
import type { Lang } from '../contracts';

export interface Voice {
  speak(text: string, onStart?: () => void, onEnd?: () => void): void;
  stop(): void;
  available(): boolean;
  /** voices often load after the page: called when availability may have changed; returns the unsubscribe */
  onChange?(listener: () => void): () => void;
}

const PREFERRED: Record<Lang, RegExp> = {
  ar: /female|zeina|laila|hoda|salma|google/i,
  en: /female|libby|sonia|zira|aria|jenny|samantha|google uk/i,
};

export function createVoice(lang: Lang = 'ar'): Voice {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  let voice: SpeechSynthesisVoice | null = null;
  const listeners = new Set<() => void>();
  const pick = () => {
    if (!synth) return;
    const vs = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    voice = vs.find((v) => PREFERRED[lang].test(v.name)) ?? vs[0] ?? null;
    listeners.forEach((f) => f());
  };
  pick();
  synth?.addEventListener?.('voiceschanged', pick);
  return {
    available: () => !!synth && !!voice,
    speak(text, onStart, onEnd) {
      if (!synth || !voice) { onEnd?.(); return; }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice; u.lang = voice.lang; u.rate = 0.95; u.pitch = 1.2;
      u.onstart = () => onStart?.();
      u.onend = () => onEnd?.();
      u.onerror = () => onEnd?.();
      synth.speak(u);
    },
    stop() { synth?.cancel(); },
    onChange(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
