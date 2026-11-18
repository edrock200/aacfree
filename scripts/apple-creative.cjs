#!/usr/bin/env node
/**
 * App Store creative assets (optional "product page header", "search results" and "universal" art),
 * built to Apple's specifications, plus a 1024 px App Store icon:
 *   fastlane/apple/creative/header-21x9.png        3840 × 1646, art safe area 1646 × 661 at (1097, 493)
 *   fastlane/apple/creative/search-3x2.png         3840 × 2560, art safe area 2168 × 1030 at (836, 765)
 *   fastlane/apple/creative/universal-16x9.png     5244 × 2950, art safe area 1402 × 962 at (1921, 660)
 *   fastlane/apple/icon-1024.png                   1024 × 1024, no transparency
 * PNG, no alpha. The logo and the headline stay inside each safe area; the picture tiles around
 * them may be cropped on some devices, which is fine.
 *
 * Usage: node scripts/apple-creative.cjs        (SAFE=1 also draws the safe area, for checking)
 * Needs `playwright` (Chromium is preinstalled; do not run `playwright install`) and `sharp`.
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'fastlane/apple/creative');
const showSafe = !!process.env.SAFE;
const symbols = JSON.parse(fs.readFileSync(path.join(root, 'src/data/symbols.json'), 'utf8'));
const img = (id) => `data:image/webp;base64,${fs.readFileSync(path.join(root, `public/symbols/${id}.webp`)).toString('base64')}`;
const font = (w) => fs.readFileSync(path.join(root, `node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${w}-normal.woff2`)).toString('base64');
const icon = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');

// Word tiles in Modified Fitzgerald Key colours (as in the app).
const COLORS = { pron: '#fff1a8', verb: '#c5efb4', adj: '#c4dcff', noun: '#ffd8b0', neg: '#ffcfe3', q: '#e3d1ff', soc: '#ffcfe3' };
const WORDS = [
  ['I', 'pron'], ['want', 'verb'], ['more', 'adj'], ['help', 'verb'], ['stop', 'neg'], ['play', 'verb'], ['eat', 'verb'],
  ['drink', 'verb'], ['happy', 'adj'], ['you', 'pron'], ['go', 'verb'], ['where', 'q'], ['music', 'noun'], ['dog', 'noun'],
  ['ball', 'noun'], ['home', 'noun'], ['like', 'verb'], ['not', 'neg'], ['big', 'adj'], ['what', 'q'], ['book', 'noun'],
  ['look', 'verb'], ['tired', 'adj'], ['mom', 'noun'], ['all done', 'neg'], ['open', 'verb'], ['outside', 'noun'], ['sad', 'adj'],
].filter(([w]) => symbols[w] != null);

function page({ width, height, safe, title, sub, iconSize, titleSize, subSize, tile }) {
  // Tiles fill the whole canvas on a grid; those overlapping the (padded) safe area are left out.
  const gap = Math.round(tile * 0.18);
  const step = tile + gap;
  const pad = Math.round(tile * 0.35);
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  const offX = -Math.round(step * 0.3);
  const offY = -Math.round(step * 0.25);
  let cells = '';
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offX + c * step + (r % 2 ? Math.round(step / 2) : 0);
      const y = offY + r * step;
      const hit = x + tile > safe.x - pad && x < safe.x + safe.w + pad && y + tile > safe.y - pad && y < safe.y + safe.h + pad;
      if (hit) continue;
      const [word, type] = WORDS[(n++ * 7) % WORDS.length];
      cells += `<div class="cell" style="left:${x}px;top:${y}px;background:${COLORS[type]}"><img src="${img(symbols[word])}"><span>${word}</span></div>`;
    }
  }
  return `<!doctype html><html><head><style>
    @font-face { font-family: AH; font-weight: 400; src: url(data:font/woff2;base64,${font(400)}) format('woff2'); }
    @font-face { font-family: AH; font-weight: 700; src: url(data:font/woff2;base64,${font(700)}) format('woff2'); }
    * { box-sizing: border-box; margin: 0; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; position: relative; font-family: AH, sans-serif;
           background: linear-gradient(150deg, #26a38b 0%, #1d8a75 55%, #176b5c 100%); }
    .cell { position: absolute; width: ${tile}px; height: ${tile}px; border-radius: ${Math.round(tile * 0.14)}px; opacity: .9;
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${Math.round(tile * 0.04)}px;
            box-shadow: 0 ${Math.round(tile * 0.04)}px ${Math.round(tile * 0.1)}px rgba(0,0,0,.18); }
    .cell img { width: 62%; height: 62%; object-fit: contain; }
    .cell span { font-weight: 700; font-size: ${Math.round(tile * 0.13)}px; color: #1d1d1f; }
    .safe { position: absolute; left: ${safe.x}px; top: ${safe.y}px; width: ${safe.w}px; height: ${safe.h}px;
            display: flex; align-items: center; justify-content: center; gap: ${Math.round(iconSize * 0.3)}px; color: #fff;
            ${showSafe ? 'outline: 6px dashed #ff3b30;' : ''} }
    .safe svg { width: ${iconSize}px; height: ${iconSize}px; flex: none; filter: drop-shadow(0 ${Math.round(iconSize * 0.05)}px ${Math.round(iconSize * 0.12)}px rgba(0,0,0,.25)); }
    h1 { font-size: ${titleSize}px; line-height: 1.02; letter-spacing: -0.02em; }
    p { font-size: ${subSize}px; margin-top: ${Math.round(subSize * 0.4)}px; opacity: .95; font-weight: 700; }
  </style></head><body>${cells}<div class="safe">${icon}<div><h1>${title}</h1><p>${sub}</p></div></div></body></html>`;
}

const ASSETS = [
  { file: 'header-21x9.png', width: 3840, height: 1646, safe: { x: 1097, y: 493, w: 1646, h: 661 },
    title: 'A voice for every word', sub: 'Free AAC. Works offline.', iconSize: 300, titleSize: 118, subSize: 64, tile: 300 },
  { file: 'search-3x2.png', width: 3840, height: 2560, safe: { x: 836, y: 765, w: 2168, h: 1030 },
    title: 'Tap pictures.<br>AACFree speaks.', sub: 'Free AAC. Works offline.', iconSize: 420, titleSize: 160, subSize: 80, tile: 360 },
  { file: 'universal-16x9.png', width: 5244, height: 2950, safe: { x: 1921, y: 660, w: 1402, h: 962 },
    title: 'A voice for<br>every word', sub: 'Free AAC. Works offline.', iconSize: 300, titleSize: 128, subSize: 62, tile: 400 },
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const a of ASSETS) {
      const p = await browser.newPage({ viewport: { width: a.width, height: a.height }, deviceScaleFactor: 1 });
      await p.setContent(page(a), { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      const buf = await p.screenshot({ type: 'png' });
      await p.close();
      const file = path.join(out, showSafe ? a.file.replace('.png', '-safe.png') : a.file);
      await sharp(buf).flatten({ background: '#1d8a75' }).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
      console.log('wrote', path.relative(root, file));
    }
  } finally {
    await browser.close();
  }
  // App Store icon (the build carries its own; this copy is for listings and press).
  await sharp(path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'))
    .removeAlpha().png().toFile(path.join(root, 'fastlane/apple/icon-1024.png'));
  console.log('wrote fastlane/apple/icon-1024.png');
})();
