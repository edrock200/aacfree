import { Capacitor } from '@capacitor/core';
import { QueueStrategy, TextToSpeech } from '@capacitor-community/text-to-speech';
import type { Settings } from '../types';
import { assetURL } from './db';

/**
 * Speech output. Uses the native Android TTS engine inside the app (Android
 * WebView has no speechSynthesis) and the Web Speech API in browsers.
 */

export interface VoiceInfo {
  id: string; // voiceURI on web, index on native
  name: string;
  lang: string;
  local: boolean;
}

const native = Capacitor.isNativePlatform();
let currentAudio: HTMLAudioElement | null = null;
/** True while the person's own message is being spoken (scan prompts must not cut it off). */
let userSpeaking = false;
let speechToken = 0;
export const isUserSpeaking = () => userSpeaking;

let nativeVoices: { name: string; lang: string }[] | null = null;

/** Why speech failed, so the message can say how to fix it. */
export type TtsFailure = 'native' | 'no-engine' | 'no-voices' | 'not-allowed' | 'error';
let onFailure: ((kind: TtsFailure) => void) | null = null;
const lastFailure = new Map<TtsFailure, number>();
/** How long the same failure stays quiet after it has been reported once. */
export const FAILURE_QUIET_MS = 30000;
/** Called when speech fails (no engine, no voices, blocked by the browser, engine error). */
export function setTtsFailureHandler(fn: ((kind: TtsFailure) => void) | null) { onFailure = fn; }
/** Report a failure, at most once per kind every FAILURE_QUIET_MS (one calm message, not a flood). */
export function reportFailure(kind: TtsFailure, now = Date.now()): boolean {
  const last = lastFailure.get(kind);
  if (last !== undefined && now - last < FAILURE_QUIET_MS) return false;
  lastFailure.set(kind, now);
  onFailure?.(kind);
  return true;
}
/** Test helper: forget reported failures. */
export function resetFailures() { lastFailure.clear(); }

let speakingListener: ((on: boolean) => void) | null = null;
/** Told when the person's own (stoppable) speech starts and ends, so Speak can become Stop. */
export function setSpeakingListener(fn: ((on: boolean) => void) | null) { speakingListener = fn; }

/** Forget the cached native voice list (after installing voices, or when the app comes back). */
export function refreshVoices() { nativeVoices = null; }
export const openTtsInstall = () => {
  if (!native) return;
  refreshVoices();
  TextToSpeech.openInstall().catch(() => {});
};
if (typeof document !== 'undefined') {
  // Coming back from the system's voice settings: the installed voices may have changed.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshVoices(); });
}

/** Web: has anyone touched or typed yet? Browsers may refuse speech until then (dwell/head/eye clicks don't count). */
export function needsUserGesture(): boolean {
  if (native || typeof navigator === 'undefined') return false;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? !ua.hasBeenActive : false;
}

let primed = false;
/** Call from a real touch or key press: unlocks speech in browsers that need a gesture first (iOS Safari). */
export function primeSpeech() {
  if (primed || native || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  primed = true;
  try {
    speechSynthesis.getVoices();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

async function nativeVoiceIndex(name?: string, fallback?: number): Promise<number | undefined> {
  if (!name) return fallback;
  try {
    const cached = nativeVoices;
    nativeVoices ??= (await TextToSpeech.getSupportedVoices()).voices;
    let i = nativeVoices.findIndex((v) => v.name === name);
    if (i < 0 && cached) {
      // The cached list may be stale (voices installed or removed since): ask the engine again.
      nativeVoices = (await TextToSpeech.getSupportedVoices()).voices;
      i = nativeVoices.findIndex((v) => v.name === name);
    }
    return i >= 0 ? i : undefined;
  } catch {
    return fallback;
  }
}

/** On Android, make sure the chosen language is installed; otherwise fall back to the device language. */
export async function checkNativeLanguage(lang: string): Promise<string | null> {
  if (!native) return null;
  try {
    const { supported } = await TextToSpeech.isLanguageSupported({ lang });
    if (supported) return null;
    const device = navigator.language || 'en-US';
    if (device !== lang && (await TextToSpeech.isLanguageSupported({ lang: device })).supported) return device;
  } catch { /* ignore */ }
  return null;
}

export async function listVoices(): Promise<VoiceInfo[]> {
  if (native) {
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      nativeVoices = voices;
      return voices.map((v, i) => ({ id: String(i), name: v.name, lang: v.lang, local: v.localService }));
    } catch {
      return [];
    }
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const get = () => speechSynthesis.getVoices();
  let voices = get();
  if (!voices.length) {
    voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const done = () => resolve(get());
      speechSynthesis.addEventListener('voiceschanged', done, { once: true });
      setTimeout(done, 1500);
    });
  }
  return voices.map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, local: v.localService }));
}

/** Finish callbacks of speech still in progress (stopSpeaking ends them all). */
const pending = new Set<() => void>();

export function stopSpeaking() {
  userSpeaking = false;
  speechToken++; // anything still awaiting (a clip URL, a native call) is now stale
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (native) {
    TextToSpeech.stop().catch(() => {});
  } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  for (const fn of [...pending]) fn();
}

let voicesOk = false;
/** Web: warn if the browser has a speech engine but no voices at all. */
async function checkVoices() {
  if (voicesOk) return;
  const n = (await listVoices()).length;
  if (n) voicesOk = true;
  else reportFailure('no-voices');
}

type VoiceSettings = Pick<Settings, 'rate' | 'pitch' | 'volume' | 'lang' | 'voiceURI' | 'voiceIndex' | 'voiceName'>;

export interface SpeakOptions {
  audio?: string;
  interrupt?: boolean;
  /** Scanning prompt: never cuts off the person's own speech and never reports failures. */
  prompt?: boolean;
  /** The person's message or phrase: Speak shows Stop until it ends. */
  stoppable?: boolean;
}

export async function speak(text: string, s: VoiceSettings, opts: SpeakOptions = {}) {
  const clean = text.trim();
  // Scanning prompts never interrupt the person's own speech.
  if (opts.prompt && userSpeaking) return;
  if (opts.interrupt !== false) stopSpeaking();
  const token = ++speechToken;
  const stale = () => token !== speechToken;
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    pending.delete(done);
    if (!stale()) userSpeaking = false;
    if (opts.stoppable) speakingListener?.(false);
  };
  pending.add(done);
  userSpeaking = !opts.prompt;
  if (opts.stoppable) speakingListener?.(true);
  if (opts.audio) {
    const url = await assetURL(opts.audio);
    // A newer tap (or Stop) came in while the clip was loading: never play over it.
    if (stale()) return done();
    if (url) {
      const a = new Audio(url);
      a.volume = s.volume;
      currentAudio = a;
      a.onended = done;
      a.onerror = done;
      try {
        await a.play();
        if (stale()) { a.pause(); done(); }
        return;
      } catch {
        if (stale()) return done();
        /* fall back to TTS */
      }
    }
  }
  if (!clean) return done();
  if (native) {
    const base = { text: clean, rate: s.rate, pitch: s.pitch, volume: s.volume, category: 'playback', queueStrategy: QueueStrategy.Flush };
    const voice = await nativeVoiceIndex(s.voiceName, s.voiceIndex);
    if (stale()) return done();
    try {
      await TextToSpeech.speak({ ...base, lang: s.lang, voice });
    } catch (e) {
      if (stale()) return done(); // stopped on purpose: don't retry
      console.warn('TTS failed, retrying with the device language', e);
      try {
        await TextToSpeech.speak({ ...base, lang: navigator.language || 'en-US' });
      } catch {
        if (!opts.prompt && !stale()) reportFailure('native');
      }
    }
    done();
    return;
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (!opts.prompt) reportFailure('no-engine');
    return done();
  }
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = s.rate;
  u.pitch = s.pitch;
  u.volume = s.volume;
  u.lang = s.lang;
  if (s.voiceURI) {
    const v = speechSynthesis.getVoices().find((x) => x.voiceURI === s.voiceURI);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
  }
  u.onend = done;
  u.onerror = (e: SpeechSynthesisErrorEvent) => {
    const err = e?.error;
    // "interrupted"/"canceled" are a new tap or Stop, not a failure.
    if (!opts.prompt && !stale() && err !== 'interrupted' && err !== 'canceled') {
      reportFailure(err === 'not-allowed' ? 'not-allowed' : 'error');
    }
    done();
  };
  // Safety net in case the engine never fires onend.
  setTimeout(done, 3000 + (clean.length * 120) / Math.max(0.3, s.rate || 1));
  // Chrome sometimes stays paused after a cancel(); resume defensively.
  speechSynthesis.resume();
  speechSynthesis.speak(u);
  if (!opts.prompt) checkVoices().catch(() => {});
}

export const ttsAvailable = () => native || (typeof window !== 'undefined' && 'speechSynthesis' in window);
