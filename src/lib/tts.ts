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

export async function listVoices(): Promise<VoiceInfo[]> {
  if (native) {
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
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

type VoiceSettings = Pick<Settings, 'rate' | 'pitch' | 'volume' | 'lang' | 'voiceURI' | 'voiceIndex'>;

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
    try {
      await TextToSpeech.speak({
        text: clean,
        lang: s.lang,
        rate: s.rate,
        pitch: s.pitch,
        volume: s.volume,
        voice: s.voiceIndex,
        category: 'playback',
        queueStrategy: QueueStrategy.Flush,
      });
    } catch (e) {
      console.warn('TTS failed', e);
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
