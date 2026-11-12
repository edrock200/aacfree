#!/usr/bin/env node
/**
 * Copies the MediaPipe vision WASM runtime into public/vision/ so the head/eye
 * pointer works fully offline (web + Android). The face model itself
 * (face_landmarker.task, Apache-2.0) is committed in public/vision/.
 */
import { cp, mkdir, access, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const out = join(root, 'public/vision/wasm');
await mkdir(out, { recursive: true });
// Only the SIMD build: every supported Android WebView and modern browser has WASM SIMD.
// (Browsers without it — e.g. Safari < 16.4 — simply can't use the camera pointer; dwell still works.)
await rm(join(out, 'vision_wasm_nosimd_internal.js'), { force: true });
await rm(join(out, 'vision_wasm_nosimd_internal.wasm'), { force: true });
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  await cp(join(src, f), join(out, f));
}
try { await access(join(root, 'public/vision/face_landmarker.task')); } catch {
  console.warn('public/vision/face_landmarker.task is missing — the head/eye pointer will not work offline.');
}
console.log('Vision runtime copied to public/vision/wasm');
