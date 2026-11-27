/**
 * React hooks over the voice modules. Noor speaks with the browser's voice, or with the cloud voice when the server
 * says it is configured; a mute switch is remembered on this device. The microphone exists only where it works,
 * and typing is always available.
 *
 * The cloud voice and cloud transcription are tuned for Arabic on the server, so English lessons use the browser's.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Health, Lang } from '../contracts';
import { health } from '../brain/client';
import { createCloudDictation, createCloudVoice } from './cloud';
import { createDictation } from './stt';
import type { Dictation, DictationProblem } from './stt';
import { createVoice } from './tts';
import type { Voice } from './tts';

let healthCache: Promise<Health> | null = null;
function useVoiceConfig(): { stt: boolean; tts: boolean } {
  const [config, setConfig] = useState({ stt: false, tts: false });
  useEffect(() => {
    let alive = true;
    (healthCache ??= health()).then((h) => {
      // an unreachable server is asked again next time
      if (!h.online) healthCache = null;
      if (alive) setConfig({ stt: h.stt, tts: h.tts });
    });
    return () => { alive = false; };
  }, []);
  return config;
}

/* ───────── mute, shared by every speaker on the page ───────── */
const MUTE_KEY = 'silsila-mute';
const listeners = new Set<() => void>();
let choice: boolean | null | undefined;
const readChoice = (): boolean | null => {
  if (choice === undefined) {
    try { const v = localStorage.getItem(MUTE_KEY); choice = v === null ? null : v === '1'; } catch { choice = null; }
  }
  return choice;
};
function setMutedChoice(muted: boolean) {
  choice = muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
  listeners.forEach((f) => f());
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/* ───────── Noor's voice ───────── */
const browserVoices: Partial<Record<Lang, Voice>> = {};
let cloudVoice: Voice | null = null;
const browserVoice = (lang: Lang): Voice => (browserVoices[lang] ??= createVoice(lang));

export interface NoorVoice {
  available: boolean;
  muted: boolean;
  toggle(): void;
  /** speaks unless muted */
  say(text: string): void;
  /** speaks because the learner asked, even when muted */
  sayNow(text: string): void;
  stop(): void;
}

export function useNoorVoice(lang: Lang, mutedByDefault = false): NoorVoice {
  const { tts } = useVoiceConfig();
  const saved = useSyncExternalStore(subscribe, readChoice, readChoice);
  const muted = saved ?? mutedByDefault;
  const browser = useMemo(() => browserVoice(lang), [lang]);
  const voice = useMemo(() => (tts && lang === 'ar' ? (cloudVoice ??= createCloudVoice(browser)) : browser), [tts, lang, browser]);
  const [available, setAvailable] = useState(() => voice.available());
  useEffect(() => {
    setAvailable(voice.available());
    return browser.onChange?.(() => setAvailable(voice.available()));
  }, [voice, browser]);

  const current = useRef({ voice, muted });
  current.current = { voice, muted };
  const say = useCallback((text: string) => { if (!current.current.muted) current.current.voice.speak(text); }, []);
  const sayNow = useCallback((text: string) => current.current.voice.speak(text), []);
  const stop = useCallback(() => current.current.voice.stop(), []);
  const toggle = useCallback(() => {
    const next = !current.current.muted;
    if (next) current.current.voice.stop();
    setMutedChoice(next);
  }, []);
  return { available, muted, toggle, say, sayNow, stop };
}

/* ───────── the learner's voice ───────── */
export interface DictationState {
  supported: boolean;
  /** audio leaves the device for the cloud transcription service */
  cloud: boolean;
  listening: boolean;
  problem: DictationProblem | null;
  start(onText: (text: string) => void): void;
  stop(): void;
}

export function useDictation(lang: Lang): DictationState {
  const { stt } = useVoiceConfig();
  const cloudEngine = useMemo(() => createCloudDictation(), []);
  const browserEngine = useMemo(() => createDictation(lang), [lang]);
  const cloud = stt && lang === 'ar' && !!cloudEngine;
  const engine: Dictation | null = cloud ? cloudEngine : browserEngine;
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<DictationProblem | null>(null);
  const active = useRef<Dictation | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; active.current?.stop(); };
  }, []);

  const start = useCallback((onText: (text: string) => void) => {
    if (!engine) return;
    setProblem(null);
    setListening(true);
    active.current = engine;
    engine.start(
      (text) => { if (alive.current && text) onText(text); },
      (why) => {
        if (!alive.current) return;
        setListening(false);
        setProblem(why ?? null);
      },
    );
  }, [engine]);
  const stop = useCallback(() => active.current?.stop(), []);
  return { supported: !!engine, cloud, listening, problem, start, stop };
}
