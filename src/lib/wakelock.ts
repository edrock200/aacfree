import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * "Keep screen awake". Switch and gaze users make no touches, so without this
 * the tablet can sleep mid-sentence. Browsers get the Screen Wake Lock API.
 * The Android WebView usually lacks it, so the app falls back to the native
 * AACFreeScreen plugin (FLAG_KEEP_SCREEN_ON on the activity window).
 */

interface AACFreeScreenPlugin {
  setKeepOn(opts: { on: boolean }): Promise<void>;
}

const AACFreeScreen = registerPlugin<AACFreeScreenPlugin>('AACFreeScreen');

interface Sentinel { release: () => Promise<void> }
type WakeLockNav = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } };

let wanted = false;
let sentinel: Sentinel | null = null;
let nativeOn = false;

const nativeAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AACFreeScreen');
const webAvailable = () => typeof navigator !== 'undefined' && !!(navigator as WakeLockNav).wakeLock;

/** True when some way of keeping the screen on exists here. */
export function keepAwakeAvailable(): boolean {
  return webAvailable() || nativeAvailable();
}

async function setNative(on: boolean): Promise<boolean> {
  if (!nativeAvailable()) return false;
  try {
    await AACFreeScreen.setKeepOn({ on });
    nativeOn = on;
    return true;
  } catch {
    return false;
  }
}

export async function setKeepAwake(on: boolean): Promise<void> {
  wanted = on;
  if (on) {
    if (sentinel || nativeOn) return;
    if (webAvailable()) {
      try {
        sentinel = await (navigator as WakeLockNav).wakeLock!.request('screen');
        return;
      } catch { /* refused (e.g. page hidden, policy): try the native way */ }
    }
    await setNative(true);
    return;
  }
  const s = sentinel;
  sentinel = null;
  if (s) await s.release().catch(() => {});
  if (nativeOn) await setNative(false);
}

// Browsers drop a wake lock whenever the page is hidden: take it again on return.
// (The native flag belongs to the window and survives this.)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted && !nativeOn) {
      sentinel = null;
      setKeepAwake(true);
    }
  });
}
