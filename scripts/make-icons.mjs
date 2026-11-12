#!/usr/bin/env node
/** Generates PWA + Android launcher icons from public/icon.svg. */
import sharp from 'sharp';
import { mkdir, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(join(root, 'public/icon.svg'));
const out = (p) => join(root, p);
const png = (size, file, pad = 0, bg) => {
  const inner = Math.round(size * (1 - pad * 2));
  return sharp(svg).resize(inner, inner).extend({
    top: Math.round((size - inner) / 2), bottom: size - inner - Math.round((size - inner) / 2),
    left: Math.round((size - inner) / 2), right: size - inner - Math.round((size - inner) / 2),
    background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toFile(out(file));
};

await png(192, 'public/icon-192.png');
await png(512, 'public/icon-512.png');
await png(512, 'public/icon-512-maskable.png', 0.1, '#1f8a75');
await png(180, 'public/apple-touch-icon.png');

// Android launcher icons (if the android project exists)
try {
  await access(out('android/app/src/main/res'));
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  const fg = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const [d, s] of Object.entries(sizes)) {
    const dir = `android/app/src/main/res/mipmap-${d}`;
    await mkdir(out(dir), { recursive: true });
    await png(s, `${dir}/ic_launcher.png`);
    await png(s, `${dir}/ic_launcher_round.png`);
    // Adaptive icon foreground: logo within the 66% safe zone on transparent background.
    await png(fg[d], `${dir}/ic_launcher_foreground.png`, 0.17);
  }
  console.log('Android icons written');
} catch { /* no android project yet */ }
console.log('Icons done');
