import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aacappfree.app',
  appName: 'AACFree',
  webDir: 'dist',
  // The app is served from https://localhost (Capacitor's default androidScheme 'https').
  // Don't change the scheme or hostname: it is the origin that owns the saved boards
  // (IndexedDB), and it is 'self' in the Content-Security-Policy in index.html.
  android: {
    backgroundColor: '#f6f3ee',
  },
  // iOS serves the app from capacitor://localhost (the default iosScheme). Don't change it either:
  // that origin owns the saved boards on iPhone and iPad.
  ios: {
    backgroundColor: '#f6f3ee',
    // The page never scrolls (only content areas do), so stop the whole web view from bouncing.
    scrollEnabled: false,
    // A long press is how grown-ups open Settings; no link previews or callouts.
    allowsLinkPreview: false,
    contentInset: 'never',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#f6f3ee',
      showSpinner: false,
    },
  },
};

export default config;
