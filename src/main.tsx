import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/app.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { updateCanReload, useStore } from './store';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  // Updates never reload the page mid-sentence: apply them only when Caleb is idle
  // and hidden (or on the next launch, when the new service worker takes over).
  let pending = false;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { pending = true; },
  });
  document.addEventListener('visibilitychange', () => {
    const dialogOpen = !!document.querySelector('.modal-root, .bigtext');
    if (pending && document.visibilityState === 'hidden' && updateCanReload(useStore.getState(), dialogOpen)) {
      pending = false;
      updateSW(true);
    }
  });
}

useStore.getState().init().catch((e) => {
  // Talking must never be blocked: fall through to a usable app.
  console.error('init failed', e);
  useStore.setState({ loaded: true });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
