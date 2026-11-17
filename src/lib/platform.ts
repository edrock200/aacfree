import { Capacitor } from '@capacitor/core';

/** Running inside the iPhone/iPad app (not Safari). */
export const isIOSApp = () => Capacitor.getPlatform() === 'ios';
/** Running inside the Android app (not Chrome). */
export const isAndroidApp = () => Capacitor.getPlatform() === 'android';
/** An iPhone or iPad, in the app or in a browser (iPadOS reports itself as a Mac with touch). */
export const isIOSDevice = () =>
  isIOSApp() || (typeof navigator !== 'undefined' &&
    (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)));
