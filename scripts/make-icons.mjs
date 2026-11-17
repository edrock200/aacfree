#!/usr/bin/env node
/** Generates PWA + Android launcher icons from public/icon.svg. */
import sharp from 'sharp';
import { mkdir, readFile, access, writeFile, readdir, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(join(root, 'public/icon.svg'));
const fgSvg = await readFile(join(root, 'public/icon-foreground.svg'));
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
    // Adaptive icon foreground: bubble within the 66% safe zone; background colour set in values.
    const inner = Math.round(fg[d] * 0.78);
    await sharp(fgSvg).resize(inner, inner).extend({
      top: Math.round((fg[d] - inner) / 2), bottom: fg[d] - inner - Math.round((fg[d] - inner) / 2),
      left: Math.round((fg[d] - inner) / 2), right: fg[d] - inner - Math.round((fg[d] - inner) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toFile(out(`${dir}/ic_launcher_foreground.png`));
  }
  await writeFile(out('android/app/src/main/res/values/ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F8A75</color>\n</resources>\n');
  // Splash screens: logo centred on the app background colour, at each existing size.
  const res = out('android/app/src/main/res');
  for (const dir of await readdir(res)) {
    if (!dir.startsWith('drawable')) continue;
    const f = join(res, dir, 'splash.png');
    try { await access(f); } catch { continue; }
    const { width, height } = await sharp(f).metadata();
    const logo = Math.round(Math.min(width, height) * 0.28);
    const buf = await sharp(svg).resize(logo, logo).png().toBuffer();
    await sharp({ create: { width, height, channels: 4, background: '#f6f3ee' } })
      .composite([{ input: buf, gravity: 'center' }]).png().toFile(f + '.tmp');
    await rename(f + '.tmp', f);
  }
  console.log('Android icons written');
} catch { /* no android project yet */ }
// iOS app icon (one 1024 px square, no transparency: iOS rounds the corners itself) and splash.
try {
  const set = out('ios/App/App/Assets.xcassets');
  await access(set);
  const full = Buffer.from(svg.toString().replace(/<rect width="512" height="512" rx="112"/, '<rect width="512" height="512"'));
  await sharp(full).resize(1024, 1024).flatten({ background: '#1f8a75' }).removeAlpha()
    .png().toFile(join(set, 'AppIcon.appiconset/AppIcon-512@2x.png'));
  const logo = await sharp(svg).resize(760, 760).png().toBuffer();
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await sharp({ create: { width: 2732, height: 2732, channels: 3, background: '#f6f3ee' } })
      .composite([{ input: logo, gravity: 'center' }]).png().toFile(join(set, 'Splash.imageset', f));
  }
  console.log('iOS icons written');
} catch { /* no ios project yet */ }
console.log('Icons done');
