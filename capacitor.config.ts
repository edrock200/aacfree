import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.calebaac.app',
  appName: 'Caleb',
  webDir: 'dist',
  // The app is served from https://localhost (Capacitor's default androidScheme 'https').
  // Don't change the scheme or hostname: it is the origin that owns the saved boards
  // (IndexedDB), and it is 'self' in the Content-Security-Policy in index.html.
  android: {
    backgroundColor: '#f6f3ee',
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
