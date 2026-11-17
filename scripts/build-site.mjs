#!/usr/bin/env node
/**
 * Assembles the public website into dist-site/:
 *   /            landing page (site/)
 *   /app/        the AACFree web app / PWA (dist/)
 *   /download/   the latest Android APK (release/aacfree-latest.apk)
 * Run `npm run build` first (npm run build:site does both).
 */
import { cp, mkdir, rm, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-site');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'site'), out, { recursive: true });
await cp(join(root, 'dist'), join(out, 'app'), { recursive: true });
try {
  await access(join(root, 'release/aacfree-latest.apk'));
  await mkdir(join(out, 'download'), { recursive: true });
  await cp(join(root, 'release/aacfree-latest.apk'), join(out, 'download/aacfree.apk'));
} catch { console.warn('No APK in release/ — download link will be broken'); }
await writeFile(join(out, '.nojekyll'), '');
console.log('Site ready in dist-site/');
