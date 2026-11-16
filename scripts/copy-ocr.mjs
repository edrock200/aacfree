#!/usr/bin/env node
/**
 * Copies the on-device OCR runtime into public/ocr/ so "Import a board from a picture" works fully
 * offline (web + Android). Nothing is fetched from a CDN at run time; src/lib/ocr.ts points
 * tesseract.js at these same-origin files.
 *
 *  - worker.min.js                     tesseract.js worker (Apache-2.0)
 *  - tesseract-core-simd-lstm.js/.wasm tesseract.js-core, LSTM-only SIMD build (Apache-2.0). Only this
 *    build is shipped: the worker loads the exact file we name, and the core finds its .wasm next to the
 *    worker. (The *.wasm.js variant embeds the same WASM as base64 and is about 1 MB bigger.)
 *  - <lang>.traineddata                @tesseract.js-data 4.0.0_best_int models (MIT): eng, spa, fra, por.
 *    Copied from <lang>.traineddata.gz and still gzip-compressed (tesseract.js recognises the gzip
 *    header and inflates it), but named without ".gz": the Android build (aapt) strips a ".gz"
 *    extension and inflates the file, so a ".gz" URL would not exist in the APK.
 *
 * The copied files are git-ignored (about 10 MB); `npm run build` and `npm run dev` run this script.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (p) => join(root, 'node_modules', p);
const out = join(root, 'public/ocr');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const files = [
  [nm('tesseract.js/dist/worker.min.js'), 'worker.min.js'],
  [nm('tesseract.js-core/tesseract-core-simd-lstm.js'), 'tesseract-core-simd-lstm.js'],
  [nm('tesseract.js-core/tesseract-core-simd-lstm.wasm'), 'tesseract-core-simd-lstm.wasm'],
  ...['eng', 'spa', 'fra', 'por'].map((l) => [nm(`@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`), `${l}.traineddata`]),
];
let total = 0;
for (const [src, name] of files) {
  await cp(src, join(out, name));
  total += (await stat(src)).size;
}
console.log(`OCR runtime copied to public/ocr (${(total / 1048576).toFixed(1)} MB)`);
