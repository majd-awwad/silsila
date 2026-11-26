/**
 * Optional cloud voice through our own /api (OpenRouter behind it). Used only when /api/health says it is configured;
 * otherwise the browser's own voice (stt.ts / tts.ts) stays in charge. The child's audio is sent for transcription
 * and never stored. Same interfaces as the browser versions, so the Lab does not care which one is active.
 */
import type { Dictation } from './stt';
import type { Voice } from './tts';

const blobToBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(b);
});

export function createCloudDictation(): Dictation | null {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  return {
    start(onText, onEnd) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        stream = s;
        const chunks: Blob[] = [];
        rec = new MediaRecorder(s);
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = async () => {
          s.getTracks().forEach((t) => t.stop());
          try {
            const type = rec?.mimeType || 'audio/webm';
            const audio = await blobToBase64(new Blob(chunks, { type }));
            const r = await fetch('/api/stt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audio, format: type.includes('mp4') ? 'mp4' : 'webm' }) });
            if (r.ok) onText(((await r.json()) as { text?: string }).text ?? '', true);
          } catch { /* the child can type instead */ }
          onEnd();
        };
        rec.start();
        setTimeout(() => { if (rec?.state === 'recording') rec.stop(); }, 20_000);
      }).catch(() => onEnd());
    },
    stop() { if (rec?.state === 'recording') rec.stop(); else stream?.getTracks().forEach((t) => t.stop()); },
  };
}

export function createCloudVoice(): Voice {
  let audio: HTMLAudioElement | null = null;
  let seq = 0;
  return {
    available: () => true,
    speak(text, onStart, onEnd) {
      const mine = ++seq;
      audio?.pause();
      fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('tts'))))
        .then((b) => {
          if (mine !== seq) return;
          audio = new Audio(URL.createObjectURL(b));
          audio.onplay = () => onStart?.();
          audio.onended = () => onEnd?.();
          audio.onerror = () => onEnd?.();
          return audio.play();
        })
        .catch(() => onEnd?.());
    },
    stop() { seq++; audio?.pause(); },
  };
}
