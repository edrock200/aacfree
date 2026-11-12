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

export async function speak(text: string, s: VoiceSettings, opts: { audio?: string; interrupt?: boolean } = {}) {
  const clean = text.trim();
  if (opts.interrupt !== false) stopSpeaking();
  if (opts.audio) {
    const url = await assetURL(opts.audio);
    if (url) {
      const a = new Audio(url);
      a.volume = s.volume;
      currentAudio = a;
      try {
        await a.play();
        return;
      } catch { /* fall back to TTS */ }
    }
  }
  if (!clean) return;
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
    return;
  }
  if (!('speechSynthesis' in window)) return;
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
  // Chrome sometimes stays paused after a cancel(); resume defensively.
  speechSynthesis.resume();
  speechSynthesis.speak(u);
}

export const ttsAvailable = () => native || 'speechSynthesis' in window;
