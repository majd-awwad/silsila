/**
 * Optional cloud voice through our own /api (OpenRouter behind it). Used only when /api/health says it is configured.
 * If the cloud voice fails, Noor falls back to the browser's voice. The child's audio is sent for transcription
 * and never stored. Same interfaces as the browser versions, so the Lab does not care which one is active.
 */
import type { Dictation } from './stt';
import type { Voice } from './tts';
import { encodeWav } from './wav';

const MAX_MS = 20_000;
/** stop by itself this long after the child goes quiet, or if nothing was heard at all */
const QUIET_AFTER_SPEECH_MS = 1_800;
const NOTHING_HEARD_MS = 8_000;
const LOUD = 0.025;

const blobToBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(b);
});

/** Recorded audio → 16 kHz mono WAV. If this browser cannot decode it, send the recording as it is. */
async function toUpload(blob: Blob): Promise<{ blob: Blob; format: string }> {
  try {
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    const rate = 16_000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const mono = await off.startRendering();
    return { blob: new Blob([encodeWav(mono.getChannelData(0), rate)], { type: 'audio/wav' }), format: 'wav' };
  } catch {
    return { blob, format: blob.type.includes('mp4') ? 'mp4' : 'webm' };
  }
}

/** Calls `stop` when the child finishes talking. Returns a cleanup function. */
function watchSilence(stream: MediaStream, stop: () => void): () => void {
  try {
    const ctx = new AudioContext();
    ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    const started = Date.now();
    let lastLoud = 0;
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((a, x) => a + x * x, 0) / data.length);
      const now = Date.now();
      if (rms > LOUD) lastLoud = now;
      if ((lastLoud && now - lastLoud > QUIET_AFTER_SPEECH_MS) || (!lastLoud && now - started > NOTHING_HEARD_MS)) stop();
    }, 150);
    return () => { clearInterval(timer); ctx.close(); };
  } catch {
    return () => {};
  }
}

export function createCloudDictation(): Dictation | null {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  let stopNow: (() => void) | null = null;
  return {
    start(onText, onEnd) {
      let cancelled = false;
      stopNow = () => { cancelled = true; };
      navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); onEnd(); return; }
        const chunks: Blob[] = [];
        const rec = new MediaRecorder(s);
        const stop = () => { if (rec.state === 'recording') rec.stop(); };
        stopNow = stop;
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        let unwatch = () => {};
        const limit = setTimeout(stop, MAX_MS);
        rec.onstop = async () => {
          clearTimeout(limit);
          unwatch();
          s.getTracks().forEach((t) => t.stop());
          try {
            const { blob, format } = await toUpload(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
            const audio = await blobToBase64(blob);
            const r = await fetch('/api/stt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audio, format }) });
            if (r.ok) onText(((await r.json()) as { text?: string }).text ?? '', true);
          } catch { /* the child can type instead */ }
          onEnd();
        };
        rec.start();
        unwatch = watchSilence(s, stop);
      }).catch(() => onEnd());
    },
    stop() { stopNow?.(); },
  };
}

export function createCloudVoice(fallback?: Voice): Voice {
  let audio: HTMLAudioElement | null = null;
  let seq = 0;
  /** lines already spoken in this visit are not paid for twice */
  const cache = new Map<string, string>();
  const fetchUrl = async (text: string) => {
    const hit = cache.get(text);
    if (hit) return hit;
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error('tts');
    const url = URL.createObjectURL(await r.blob());
    cache.set(text, url);
    return url;
  };
  return {
    available: () => true,
    speak(text, onStart, onEnd) {
      const mine = ++seq;
      audio?.pause();
      fallback?.stop();
      fetchUrl(text)
        .then((url) => {
          if (mine !== seq) return;
          audio = new Audio(url);
          audio.onplay = () => onStart?.();
          audio.onended = () => onEnd?.();
          audio.onerror = () => onEnd?.();
          return audio.play();
        })
        .catch(() => {
          if (mine !== seq) return;
          if (fallback) fallback.speak(text, onStart, onEnd);
          else onEnd?.();
        });
    },
    stop() { seq++; audio?.pause(); fallback?.stop(); },
  };
}
