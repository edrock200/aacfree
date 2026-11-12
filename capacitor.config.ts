import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.calebaac.app',
  appName: 'Caleb',
  webDir: 'dist',
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
