import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// BASE lets the site be served from a sub-path (e.g. GitHub Pages: /caleb/).
const base = process.env.BASE ?? './';

/**
 * index.html carries the app's Content-Security-Policy. The dev server injects inline scripts
 * (React refresh), so the policy is left out while developing; builds always keep it.
 */
function devWithoutCsp(): Plugin {
  return {
    name: 'caleb-dev-without-csp',
    apply: 'serve',
    transformIndexHtml: (html) => html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
  };
}

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    devWithoutCsp(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Caleb AAC',
        short_name: 'Caleb',
        description: 'Free, open-source AAC communication app for autistic people and their families.',
        theme_color: '#f6f3ee',
        background_color: '#f6f3ee',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        categories: ['education', 'medical', 'productivity'],
      },
      workbox: {
        // Precache the app shell and every bundled symbol so Caleb works fully offline, plus the
        // on-device OCR runtime and language data for "Import a board from a picture" (public/ocr,
        // about 10 MB: the WASM core and each language model are under 3 MB, so they fit the limit below).
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}', 'ocr/*.{wasm,traineddata}'],
        // The head/eye pointer runtime (~13 MB) is cached on first use instead of precached.
        globIgnores: ['vision/**'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/vision/'),
          handler: 'CacheFirst',
          options: { cacheName: 'caleb-vision', expiration: { maxEntries: 10 } },
        }],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/landing/],
      },
    }),
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Separate long-lived chunks: the framework, the camera pointer (MediaPipe), OBF
        // (fflate) and OCR (tesseract.js, loaded only by "Import a board from a picture").
        // Grown-up screens are a lazy route (App.tsx). Every chunk is still precached by the
        // service worker and bundled in the APK, so all of it works offline.
        codeSplitting: {
          groups: [
            { name: 'mediapipe', test: /node_modules[\\/]@mediapipe[\\/]/, priority: 30 },
            { name: 'obf', test: /node_modules[\\/]fflate[\\/]|src[\\/]lib[\\/]obf\.ts/, priority: 20 },
            { name: 'ocr', test: /node_modules[\\/](tesseract\.js|bmp-js|is-url|regenerator-runtime|wasm-feature-detect|zlibjs|idb-keyval)[\\/]|src[\\/]lib[\\/]ocr\.ts/, priority: 25 },
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|zustand|idb|@capacitor)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
