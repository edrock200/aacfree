import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/app.css';
import { App } from './App';
import { useStore } from './store';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

useStore.getState().init().catch((e) => {
  // Talking must never be blocked: fall through to a usable app.
  console.error('init failed', e);
  useStore.setState({ loaded: true });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
