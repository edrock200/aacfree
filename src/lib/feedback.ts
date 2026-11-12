import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

function tone(freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.08, when = 0) {
  const a = audio();
  if (!a) return;
  if (a.state === 'suspended') a.resume();
  const t0 = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + ms / 1000 + 0.02);
}

export function click() {
  tone(880, 40, 'triangle', 0.05);
}

/** Gentle two-tone chime for "get attention" and timers. */
export function chime() {
  tone(660, 350, 'sine', 0.15);
  tone(880, 500, 'sine', 0.15, 0.25);
}

export function alarm() {
  for (let i = 0; i < 3; i++) {
    tone(784, 220, 'sine', 0.18, i * 0.6);
    tone(1046, 320, 'sine', 0.18, i * 0.6 + 0.2);
  }
}

export function vibrate(ms = 15) {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  } else if (navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

// Keep screen awake (Screen Wake Lock API, or the native Android plugin): see wakelock.ts.
export { setKeepAwake } from './wakelock';
