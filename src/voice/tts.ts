/**
 * Noor's voice with the browser's speechSynthesis. Picks an Arabic voice if the device has one;
 * otherwise speaking is unavailable and Noor's words stay on screen (they always do anyway).
 * Upgrade path: swap this file for a cloud TTS with a friendlier child-like voice.
 */
export interface Voice { speak(text: string, onStart?: () => void, onEnd?: () => void): void; stop(): void; available(): boolean }

export function createVoice(): Voice {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  let voice: SpeechSynthesisVoice | null = null;
  const pick = () => {
    if (!synth) return;
    const vs = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ar'));
    voice = vs.find((v) => /female|zeina|laila|hoda|salma|google/i.test(v.name)) ?? vs[0] ?? null;
  };
  pick();
  synth?.addEventListener?.('voiceschanged', pick);
  return {
    available: () => !!synth && !!voice,
    speak(text, onStart, onEnd) {
      if (!synth || !voice) { onEnd?.(); return; }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice; u.lang = voice.lang; u.rate = 0.95; u.pitch = 1.25;
      u.onstart = () => onStart?.();
      u.onend = () => onEnd?.();
      u.onerror = () => onEnd?.();
      synth.speak(u);
    },
    stop() { synth?.cancel(); },
  };
}
