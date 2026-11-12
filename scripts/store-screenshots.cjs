#!/usr/bin/env node
/**
 * Regenerates the Google Play store graphics in fastlane/metadata/android/en-US/images/:
 *   icon.png (512×512), featureGraphic.png (1024×500),
 *   phoneScreenshots/*.png (1080×1920) and tenInchScreenshots/*.png (2560×1600).
 *
 * The screenshots come from the real app, driven with Playwright, then framed with a short caption.
 *
 * Usage:
 *   npx vite build
 *   npx vite preview --port 4199 --strictPort &
 *   node scripts/store-screenshots.cjs [http://localhost:4199/]
 *
 * Options (environment variables):
 *   RAW=1       also keep the unframed captures in images/raw/ (for checking; git-ignored)
 *   ONLY=phone  or ONLY=tablet or ONLY=art: regenerate one part only
 *
 * Needs `playwright` (Chromium already installed; do not run `playwright install`) and `sharp` (dev dependency).
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const url = process.argv[2] || 'http://localhost:4199/';
const outDir = path.join(root, 'fastlane/metadata/android/en-US/images');
const phoneDir = path.join(outDir, 'phoneScreenshots');
const tabletDir = path.join(outDir, 'tenInchScreenshots');
const rawDir = path.join(outDir, 'raw');
const only = process.env.ONLY || '';
const keepRaw = !!process.env.RAW;

const fontData = (w) =>
  fs.readFileSync(path.join(root, `node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${w}-normal.woff2`)).toString('base64');
const FONT_CSS = `
  @font-face { font-family: 'Atkinson Hyperlegible'; font-weight: 400; src: url(data:font/woff2;base64,${fontData(400)}) format('woff2'); }
  @font-face { font-family: 'Atkinson Hyperlegible'; font-weight: 700; src: url(data:font/woff2;base64,${fontData(700)}) format('woff2'); }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Atkinson Hyperlegible', sans-serif; overflow: hidden; }`;
const iconSvg = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
const dataUrl = (buf, type = 'image/png') => `data:${type};base64,${buf.toString('base64')}`;
const symbol = (id) => dataUrl(fs.readFileSync(path.join(root, `public/symbols/${id}.webp`)), 'image/webp');

const errors = [];

// ---------- helpers for driving the app ----------
async function newApp(browser, viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('.onboarding');
  return { ctx, page };
}
const tap = (page, label) => page.click(`.grid .cell[aria-label="${label}"]`);
const settle = (page, ms = 400) => page.waitForTimeout(ms);
async function holdLock(page) {
  const box = await page.locator('.lockbtn').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForSelector('.grownup');
}
async function goHome(page) {
  await page.click('.nav-home');
  await page.waitForSelector('.grid');
}
async function clearMessage(page) {
  const btn = page.locator('[aria-label="Clear message"]');
  if (await btn.isVisible()) await btn.click();
  else {
    await page.click('.msg-tools-more');
    await page.click('.msg-menu .btn:has-text("Clear")');
  }
  // Wait for the "Message cleared / Undo" toast to go away so it is not in the next shot.
  await page.waitForSelector('.toast', { state: 'detached', timeout: 8000 }).catch(() => {});
}
async function typeKeys(page, text) {
  for (const ch of text) await page.click(ch === ' ' ? '.key.space' : `.key[aria-label="${ch}"]`);
}

// ---------- framing ----------
// The capture is placed on a teal background (the icon's colours) below a one-line caption.
async function frame(browser, raw, { width, height, caption, captionSize, top, radius }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const meta = await sharp(raw).metadata();
  const shotH = height - top - Math.round(height * 0.035);
  const shotW = Math.round((meta.width / meta.height) * shotH);
  await page.setContent(`<!doctype html><html><head><style>${FONT_CSS}
    body { width: ${width}px; height: ${height}px; background: linear-gradient(160deg, #26a38b, #176b5c); color: #fff; }
    h1 { position: absolute; top: 0; left: 0; right: 0; height: ${top}px; display: flex; align-items: center; justify-content: center;
         text-align: center; padding: 0 ${Math.round(width * 0.06)}px; font-size: ${captionSize}px; line-height: 1.12; font-weight: 700; letter-spacing: -0.01em; }
    img { position: absolute; top: ${top}px; left: ${Math.round((width - shotW) / 2)}px; width: ${shotW}px; height: ${shotH}px;
          border-radius: ${radius}px; box-shadow: 0 ${radius}px ${radius * 3}px rgba(0, 30, 20, .35); }
  </style></head><body><h1>${caption}</h1><img src="${dataUrl(raw)}"></body></html>`);
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: 'png' });
  await page.close();
  return buf;
}

async function save(browser, kind, n, slug, raw, caption) {
  const phone = kind === 'phone';
  const dir = phone ? phoneDir : tabletDir;
  const framed = await frame(browser, raw, phone
    ? { width: 1080, height: 1920, caption, captionSize: 76, top: 300, radius: 36 }
    : { width: 2560, height: 1600, caption, captionSize: 92, top: 230, radius: 36 });
  const file = path.join(dir, `${n}_${slug}.png`);
  // Play wants screenshots as 24-bit PNG (no alpha).
  await sharp(framed).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
  if (keepRaw) fs.writeFileSync(path.join(rawDir, `${kind}-${n}_${slug}.png`), raw);
  console.log('wrote', path.relative(root, file));
}

// ---------- phone: 432×768 CSS px at 2.5× = 1080×1920 ----------
async function phoneShots(browser) {
  const shot = async (page) => page.screenshot({ type: 'png' });
  const { ctx, page } = await newApp(browser, { width: 432, height: 768 }, 2.5);
  await page.click('text=Skip setup');
  await page.waitForSelector('.grid');
  await settle(page);

  for (const w of ['I', 'want']) await tap(page, w);
  await tap(page, 'Food folder');
  await settle(page);
  await save(browser, 'phone', 2, 'folder', await shot(page), 'Topic folders with<br>hundreds of words');

  if (!(await page.$('.grid .cell[aria-label="pizza"]'))) {
    await page.click('text=Next');
    await settle(page, 300);
  }
  await tap(page, 'pizza');
  await settle(page);
  if (!(await page.$('.grid .cell[aria-label="Food folder"]'))) await goHome(page);
  await settle(page);
  await save(browser, 'phone', 1, 'sentence', await shot(page), 'Tap pictures.<br>Caleb speaks.');

  await clearMessage(page);
  await page.click('.navbtn[aria-label="Keyboard"]');
  await typeKeys(page, 'can we go to the pa');
  await settle(page, 300);
  await save(browser, 'phone', 3, 'keyboard', await shot(page), 'A keyboard with<br>private word prediction');
  await clearMessage(page);

  await page.click('.navbtn[aria-label="Phrases"]');
  await page.click('.tabs .tab:has-text("Boundaries")');
  await settle(page, 300);
  await save(browser, 'phone', 4, 'phrases', await shot(page), 'Ready-made phrases,<br>including boundaries');

  await page.click('.navbtn[aria-label="Tools"]');
  await page.click('.tool-tile[aria-label="Schedule"]');
  await settle(page);
  await save(browser, 'phone', 5, 'schedule', await shot(page), 'Visual schedules,<br>timers and more');

  await holdLock(page);
  await page.click('.gu-tab:has-text("Symbols")');
  await settle(page);
  await page.locator('.library .search').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await settle(page, 600);
  await save(browser, 'phone', 6, 'library', await shot(page), 'Add your own photos<br>and symbols');
  await ctx.close();
}

// ---------- 10-inch tablet: 1280×800 CSS px at 2× = 2560×1600 ----------
async function tabletShots(browser) {
  const shot = async (page) => page.screenshot({ type: 'png' });
  const { ctx, page } = await newApp(browser, { width: 1280, height: 800 }, 2);
  await page.fill('input', 'Sam');
  await page.click('text=Next');
  await page.click('.layout-card:has-text("Full core")');
  await page.click('text=Next');
  await page.click('text=Next');
  await page.click('text=Start talking');
  await page.waitForSelector('.grid');
  await settle(page);

  for (const w of ['I', 'want']) await tap(page, w);
  await tap(page, 'Food folder');
  await settle(page);
  await tap(page, 'pizza');
  await settle(page);
  if (!(await page.$('.grid .cell[aria-label="Food folder"]'))) await goHome(page);
  await settle(page);
  await save(browser, 'tablet', 1, 'home', await shot(page), 'Core words that always stay in the same place');

  await clearMessage(page);
  for (const w of ['I', 'feel']) await tap(page, w);
  await tap(page, 'Feelings folder');
  await settle(page);
  await save(browser, 'tablet', 2, 'feelings', await shot(page), 'Feelings, food, people, places and more');

  await clearMessage(page);
  await goHome(page);
  await page.click('.navbtn[aria-label="Tools"]');
  await page.click('.tool-tile[aria-label="Schedule"]');
  await settle(page);
  await save(browser, 'tablet', 3, 'schedule', await shot(page), 'Visual schedules with Now and Next');

  await holdLock(page);
  await page.click('.gu-tab:has-text("Symbols")');
  await settle(page, 800);
  await save(browser, 'tablet', 4, 'library', await shot(page), 'A symbol library you can make your own');
  await ctx.close();
}

// ---------- icon + feature graphic ----------
async function art(browser) {
  // Play applies its own rounded mask, so the store icon is a full-bleed square.
  const square = iconSvg.replace('rx="112"', 'rx="0"');
  await sharp(Buffer.from(square)).resize(512, 512).png().toFile(path.join(outDir, 'icon.png'));
  console.log('wrote fastlane/metadata/android/en-US/images/icon.png');

  // Real bundled ARASAAC pictograms, coloured with the Modified Fitzgerald Key like in the app.
  const buttons = [
    ['I', 2617, '#fff1a8'], ['want', 5441, '#c5efb4'], ['more', 5508, '#c4dcff'],
    ['help', 4570, '#c5efb4'], ['happy', 3245, '#c4dcff'], ['pizza', 2527, '#ffd8b0'],
  ];
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>${FONT_CSS}
    body { width: 1024px; height: 500px; background: linear-gradient(150deg, #26a38b 0%, #1d8a75 55%, #176b5c 100%); color: #fff; position: relative; }
    .brand { position: absolute; left: 72px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; }
    .logo { display: flex; align-items: center; gap: 22px; }
    .logo svg { width: 104px; height: 104px; filter: drop-shadow(0 6px 14px rgba(0,0,0,.18)); }
    .logo b { font-size: 104px; line-height: 1; letter-spacing: -0.02em; }
    .tag { font-size: 40px; font-weight: 700; margin-top: 26px; }
    .sub { font-size: 23px; margin-top: 12px; opacity: .9; }
    .board { position: absolute; right: 64px; top: 50%; transform: translateY(-50%) rotate(-3deg); background: #f6f3ee; border-radius: 26px; padding: 16px;
             box-shadow: 0 22px 50px rgba(0, 30, 20, .35); }
    .msg { background: #fff; border: 2px solid #e3ddd2; border-radius: 14px; height: 52px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px;
           padding: 0 16px; font-size: 25px; font-weight: 700; color: #1d1d1f; }
    .msg span:last-child { color: #1d7a6a; }
    .grid { display: grid; grid-template-columns: repeat(3, 120px); gap: 10px; }
    .cell { height: 118px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
            box-shadow: 0 2px 0 rgba(0,0,0,.08); color: #1d1d1f; font-weight: 700; font-size: 21px; }
    .cell img { width: 74px; height: 74px; object-fit: contain; }
  </style></head><body>
    <div class="brand">
      <div class="logo">${iconSvg}<b>Caleb</b></div>
      <div class="tag">A voice for every word</div>
      <div class="sub">Free AAC · Works offline · No ads</div>
    </div>
    <div class="board">
      <div class="msg"><span>I</span><span>want</span><span>more</span></div>
      <div class="grid">${buttons.map(([l, id, c]) => `<div class="cell" style="background:${c}"><img src="${symbol(id)}" alt=""><span>${l}</span></div>`).join('')}</div>
    </div>
  </body></html>`);
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  // Play rejects transparency in the feature graphic: flatten to an opaque RGB PNG.
  const buf = await page.screenshot({ type: 'png' });
  await sharp(buf).flatten({ background: '#1d8a75' }).removeAlpha().png().toFile(path.join(outDir, 'featureGraphic.png'));
  await page.close();
  console.log('wrote fastlane/metadata/android/en-US/images/featureGraphic.png');
}

(async () => {
  for (const d of [outDir, phoneDir, tabletDir, ...(keepRaw ? [rawDir] : [])]) fs.mkdirSync(d, { recursive: true });
  const browser = await chromium.launch();
  try {
    if (!only || only === 'art') await art(browser);
    if (!only || only === 'phone') await phoneShots(browser);
    if (!only || only === 'tablet') await tabletShots(browser);
  } finally {
    await browser.close();
  }
  if (errors.length) {
    console.error('Page errors:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('Done, no page errors.');
})();
