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
let onFailure: (() => void) | null = null;
/** Called when speech fails completely (e.g. no voice data for the language). */
export function setTtsFailureHandler(fn: (() => void) | null) { onFailure = fn; }
export const openTtsInstall = () => { if (native) TextToSpeech.openInstall().catch(() => {}); };

async function nativeVoiceIndex(name?: string, fallback?: number): Promise<number | undefined> {
  if (!name) return fallback;
  try {
    nativeVoices ??= (await TextToSpeech.getSupportedVoices()).voices;
    const i = nativeVoices.findIndex((v) => v.name === name);
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
  if (!('speechSynthesis' in window)) return [];
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

export function stopSpeaking() {
  userSpeaking = false;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (native) {
    TextToSpeech.stop().catch(() => {});
  } else if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

type VoiceSettings = Pick<Settings, 'rate' | 'pitch' | 'volume' | 'lang' | 'voiceURI' | 'voiceIndex' | 'voiceName'>;

export async function speak(text: string, s: VoiceSettings, opts: { audio?: string; interrupt?: boolean; prompt?: boolean } = {}) {
  const clean = text.trim();
  // Scanning prompts never interrupt the person's own speech.
  if (opts.prompt && userSpeaking) return;
  if (opts.interrupt !== false) stopSpeaking();
  const token = ++speechToken;
  const done = () => { if (token === speechToken) userSpeaking = false; };
  userSpeaking = !opts.prompt;
  if (opts.audio) {
    const url = await assetURL(opts.audio);
    if (url) {
      const a = new Audio(url);
      a.volume = s.volume;
      currentAudio = a;
      a.onended = done;
      a.onerror = done;
      try {
        await a.play();
        return;
      } catch { /* fall back to TTS */ }
    }
  }
  if (!clean) return done();
  if (native) {
    const base = { text: clean, rate: s.rate, pitch: s.pitch, volume: s.volume, category: 'playback', queueStrategy: QueueStrategy.Flush };
    try {
      await TextToSpeech.speak({ ...base, lang: s.lang, voice: await nativeVoiceIndex(s.voiceName, s.voiceIndex) });
    } catch (e) {
      console.warn('TTS failed, retrying with the device language', e);
      try {
        await TextToSpeech.speak({ ...base, lang: navigator.language || 'en-US' });
      } catch {
        if (!opts.prompt) onFailure?.();
      }
    }
    done();
    return;
  }
  if (!('speechSynthesis' in window)) return done();
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
  u.onerror = done;
  // Safety net in case the engine never fires onend.
  setTimeout(done, 2000 + clean.length * 120);
  // Chrome sometimes stays paused after a cancel(); resume defensively.
  speechSynthesis.resume();
  speechSynthesis.speak(u);
}

export const ttsAvailable = () => native || 'speechSynthesis' in window;
