#!/usr/bin/env node
/**
 * Screenshots for the user guide (site/guide/). Usage:
 *   npm run build && npx vite preview --port 4173 &
 *   NODE_PATH=/opt/node22/lib/node_modules node scripts/guide-screenshots.mjs [url]
 * (`npm run guide:shots` runs this script.) The images are written as WebP to site/guide/img/.
 *
 * Speech is replaced by a silent stand-in with a few made-up voices, so the screens look like they
 * do on a real device (headless browsers have no voices) and no error toasts appear.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const url = process.argv[2] ?? 'http://localhost:4173/';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'site/guide/img');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const made = [];
let failed = 0;

const FAKE_SPEECH = () => {
  const voices = [
    { name: 'English (US) – Ava', lang: 'en-US', voiceURI: 'guide-ava', localService: true, default: true },
    { name: 'English (UK) – Oliver', lang: 'en-GB', voiceURI: 'guide-oliver', localService: true, default: false },
    { name: 'English (US) – Sam', lang: 'en-US', voiceURI: 'guide-sam', localService: false, default: false },
    { name: 'Español – Lucía', lang: 'es-ES', voiceURI: 'guide-lucia', localService: true, default: false },
  ];
  try {
    const ss = window.speechSynthesis;
    ss.getVoices = () => voices;
    ss.speak = (u) => {
      setTimeout(() => {
        u.onstart?.(new Event('start'));
        setTimeout(() => u.onend?.(new Event('end')), 250);
      }, 10);
    };
    ss.cancel = () => {};
  } catch { /* no speech in this browser */ }
};

async function newPage(viewport, scale = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, serviceWorkers: 'block' });
  await ctx.addInitScript(FAKE_SPEECH);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  return { ctx, page };
}

/** Save a screenshot (of the page or of one element) as WebP. */
async function shot(target, name, opts = {}) {
  try {
    const png = await target.screenshot({ animations: 'disabled', ...opts });
    const webp = await sharp(png).webp({ quality: 74, effort: 6 }).toBuffer();
    await writeFile(join(outDir, `${name}.webp`), webp);
    const { width, height } = await sharp(webp).metadata();
    made.push({ name, width, height, kb: Math.round(webp.length / 1024) });
  } catch (e) {
    failed++;
    console.warn(`✗ ${name}: ${e.message.split('\n')[0]}`);
  }
}

const pause = (page, ms = 300) => page.waitForTimeout(ms);

async function onboard(page, { name, layout, starter = false }) {
  await page.goto(url);
  await page.waitForSelector('.onboarding');
  await page.fill('.onboarding input', name);
  await page.click('.ob-actions button:has-text("Next")');
  await page.click(`.layout-card:has-text("${layout}")`);
  if (starter) await page.check('.onboarding .check input');
  await page.click('.ob-actions button:has-text("Next")');
  await page.click('.ob-actions button:has-text("Next")');
  await page.click('text=Start talking');
  await page.waitForSelector('.grid');
  await pause(page, 500);
}

async function unlock(page) {
  const box = await page.locator('.lockbtn').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(2300); await page.mouse.up();
  await page.waitForSelector('.grownup');
  await pause(page);
}

const panel = async (page, name) => { await page.click(`.gu-tab:has-text("${name}")`); await pause(page, 400); };
const section = (page, title) => page.locator(`.gu-section:has(h3:text-is("${title}"))`);
const tap = (page, label) => page.click(`.grid .cell[aria-label="${label}"]`);
const closeModal = async (page) => { await page.keyboard.press('Escape'); await pause(page); };
const toggle = (page, label) => page.click(`.setting:has-text("${label}") .switch`);

// ------------------------------------------------------------------ tablet
{
  const { ctx, page } = await newPage({ width: 1180, height: 820 });
  await page.goto(url);
  await page.waitForSelector('.onboarding');
  await page.fill('.onboarding input', 'Sam');
  await shot(page.locator('.ob-card'), 'onboarding-welcome');
  await page.click('.ob-actions button:has-text("Next")');
  await page.click('.layout-card:has-text("Full core")');
  await shot(page.locator('.ob-card'), 'onboarding-layout');
  await page.click('.ob-actions button:has-text("Next")');
  await page.click('.ob-actions button:has-text("Next")');
  await page.click('text=Start talking');
  await page.waitForSelector('.grid');
  await pause(page, 500);

  // A little history for Insights and Recent.
  await unlock(page);
  await panel(page, 'Insights');
  await toggle(page, 'Keep a usage log');
  await page.click('button:has-text("Lock & return")');
  for (const words of [['I', 'want', 'more'], ['you', 'help'], ['I', 'like', 'it'], ['stop'], ['I', 'want', 'go']]) {
    for (const w of words) await tap(page, w);
    await page.click('.speakbtn');
    await pause(page, 500);
    while (await page.$('.msg-word')) await page.click('.nav-bs');
  }

  // The Talk screen with a sentence.
  await tap(page, 'I'); await tap(page, 'want'); await tap(page, 'more');
  await tap(page, 'Food folder'); await pause(page);
  await tap(page, 'pizza'); await pause(page, 2600);
  await shot(page, 'talk-tablet');
  await shot(page.locator('.msgbar'), 'message-bar');

  await page.click('.msg-word >> nth=1'); await pause(page);
  await shot(page.locator('.modal'), 'word-forms');
  await closeModal(page);


  await page.click('.navbtn[aria-label="Find a word"]');
  await page.fill('.modal input', 'drink');
  await pause(page, 400);
  await shot(page.locator('.modal'), 'find-word');
  await closeModal(page);

  await page.click('.navbtn[aria-label="Keyboard"]');
  for (const k of 'hu') await page.click(`.key[aria-label="${k}"]`);
  await pause(page);
  await shot(page, 'keyboard');
  for (let i = 0; i < 2; i++) await page.click('.key[aria-label="Delete letter"]');

  await page.click('.navbtn[aria-label="Phrases"]'); await pause(page);
  await shot(page, 'phrases-folders');
  await page.click('.phrase-folder:has-text("Recent")'); await pause(page);
  await shot(page, 'phrases-recent');
  await page.click('.phrases-head button:has-text("Phrases")');

  await page.click('.navbtn[aria-label="Tools"]'); await pause(page);
  await shot(page, 'tools-menu');
  await page.click('.tool-tile[aria-label="Schedule"]'); await pause(page);
  await page.click('.step .check >> nth=0'); await page.click('.step .check >> nth=1'); await pause(page, 600);
  await shot(page, 'tool-schedule');
  await page.click('.tool-head button:has-text("Tools")');
  await page.click('.tool-tile[aria-label="First / Then"]'); await pause(page);
  await page.click('.ft-slot.first');
  await page.fill('.modal input', 'bath'); await pause(page);
  await page.click('.modal .sym-opt:not(.text-only) >> nth=0'); await pause(page);
  await page.click('.ft-slot.then');
  await page.fill('.modal input', 'story'); await pause(page);
  await page.click('.modal .sym-opt:not(.text-only) >> nth=0'); await pause(page);
  await shot(page, 'tool-firstthen');
  await page.click('.tool-head button:has-text("Tools")');
  await page.click('.tool-tile[aria-label="My voice"]'); await pause(page);
  await shot(page, 'tool-myvoice');
  await page.click('.tool-head button:has-text("Tools")');
  await page.click('.nav-home');

  // Settings
  await unlock(page);
  await panel(page, 'Boards & words');
  await shot(page, 'settings-boards');
  await panel(page, 'Symbols');
  await shot(page, 'settings-symbols');
  await panel(page, 'Voice');
  await shot(page, 'settings-voice');
  await panel(page, 'Display');
  await shot(page, 'settings-display');
  await panel(page, 'Access');
  await page.click('.seg button:has-text("Eye gaze (camera, experimental)")'); await pause(page);
  await shot(section(page, 'Eye gaze & head pointer'), 'settings-pointer');
  await page.click('.seg button:text-is("Off") >> nth=0'); await pause(page);
  await toggle(page, 'Turn on scanning'); await pause(page);
  await shot(section(page, 'Switch scanning'), 'settings-scanning');
  await toggle(page, 'Turn on scanning'); await pause(page);
  await panel(page, 'Insights');
  await shot(page, 'settings-insights');
  await panel(page, 'Backup');
  await shot(page, 'settings-backup');
  await shot(section(page, 'Sync between devices (encrypted)'), 'settings-sync');
  const setup = page.locator('button:has-text("Set up automatic sync…")');
  if (await setup.count()) {
    await setup.click(); await pause(page);
    await shot(page.locator('.modal'), 'sync-setup');
    await closeModal(page);
  }
  await panel(page, 'Lock');
  await shot(page, 'settings-lock');

  // Edit mode and the editors
  await panel(page, 'Boards & words');
  await page.click('text=Edit Home board');
  await page.waitForSelector('.editing'); await pause(page);
  await shot(page, 'edit-mode');
  await tap(page, 'want'); await pause(page);
  await shot(page.locator('.modal'), 'button-editor');
  await page.click('.editor-preview button:has-text("Change picture")'); await pause(page, 300);
  await page.fill('.modal >> nth=-1 >> input', ''); await pause(page, 600);
  await shot(page.locator('.modal >> nth=-1'), 'symbol-picker');
  await closeModal(page); await closeModal(page);
  await page.click('.edit-tools button:has-text("Category")'); await pause(page);
  await page.fill('.modal input', 'Swimming');
  await page.selectOption('.modal select', { index: 2 });
  await pause(page);
  await shot(page.locator('.modal'), 'new-category');
  await closeModal(page);
  await page.click('.edit-tools button:has-text("Done")');

  // PIN lock
  await page.click('.navbtn.lockbtn'); await page.waitForSelector('.grownup');
  await panel(page, 'Lock');
  await page.fill('input[aria-label="PIN"]', '1234');
  await page.click('button:has-text("Save PIN")');
  await page.click('button:has-text("Lock & return")'); await pause(page);
  await page.click('.lockbtn'); await page.waitForSelector('.lockgate');
  await page.click('.pinpad .btn:text-is("1")'); await page.click('.pinpad .btn:text-is("2")');
  await pause(page, 200);
  await shot(page.locator('.modal'), 'lock-pin');
  await page.click('.pinpad .btn:text-is("3")'); await page.click('.pinpad .btn:text-is("4")');
  await page.waitForSelector('.grownup');

  // Switch scanning highlight
  await panel(page, 'Access');
  await toggle(page, 'Turn on scanning');
  await page.click('button:has-text("Lock & return")');
  await page.waitForSelector('.grid .scan-hl', { timeout: 30000 }).catch(() => null);
  await pause(page, 200);
  await shot(page, 'scanning');
  await ctx.close();
}

// ------------------------------------------------------------------ phone
{
  const { ctx, page } = await newPage({ width: 390, height: 844 }, 1.5);
  await onboard(page, { name: 'Alex', layout: 'Phone core' });
  await tap(page, 'I'); await tap(page, 'want'); await tap(page, 'go');
  await pause(page, 2600);
  await shot(page, 'talk-phone');
  await page.click('.msg-tools-more'); await pause(page);
  await shot(page, 'message-menu-phone', { clip: { x: 0, y: 0, width: 390, height: 330 } });
  await page.click('.msg-tools-more'); await pause(page);
  await tap(page, 'Food folder'); await pause(page, 600);
  await shot(page, 'folder-pages');
  await ctx.close();
}

// ------------------------------------------------------------------ picture import
{
  // A made-up board in another app's style: a toolbar, then 4 × 3 coloured tiles with pictures and words.
  const { ctx, page: bp } = await newPage({ width: 1180, height: 1000 });
  await bp.setViewportSize({ width: 820, height: 620 });
  const html = await (await fetch(url)).text();
  const cssPath = html.match(/href="\.?\/?(assets\/index-[^"]+\.css)"/)?.[1];
  const cssText = cssPath ? await (await fetch(new URL(cssPath, url))).text() : '';
  const fontFile = cssText.match(/atkinson-hyperlegible-latin-700-normal-[\w-]+\.woff2/)?.[0];
  const words = [['want', '#c5efb4', 5441], ['more', '#c4dcff', 5508], ['help', '#c5efb4', 4570], ['stop', '#ffc2c2', 7195],
    ['eat', '#c5efb4', 2349], ['drink', '#c5efb4', 2276], ['play', '#c5efb4', 2439], ['go', '#c5efb4', 2432],
    ['happy', '#c4dcff', 3245], ['dog', '#ffd8b0', 2517], ['ball', '#ffd8b0', 2269], ['you', '#fff1a8', 2608]];
  const boardHtml = `<html><head><style>
    @font-face { font-family: AH; font-weight: 700; src: url(${new URL(`assets/${fontFile}`, url)}) format('woff2'); }
    body { margin: 0; background: #f2efe9; font-family: AH, sans-serif; }
    .bar { height: 70px; background: #33415c; color: #fff; display: flex; align-items: center; padding: 0 20px; font-size: 22px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px; height: 518px; }
    .t { border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
    .t img { width: 72px; height: 72px; } .t b { font-size: 26px; color: #1d1d1f; margin-top: 6px; }
  </style></head><body><div class="bar">I want</div><div class="grid">${words.map(([w, c, id]) => `<div class="t" style="background:${c}"><img src="${new URL(`symbols/${id}.webp`, url)}"><b>${w}</b></div>`).join('')}</div></body></html>`;
  // Served from the app's own origin, so the app's font may load.
  const boardUrl = new URL('guide-board.html', url).href;
  await bp.route(boardUrl, (r) => r.fulfill({ contentType: 'text/html', body: boardHtml }));
  await bp.goto(boardUrl);
  await bp.waitForLoadState('networkidle');
  await bp.evaluate(() => document.fonts.ready);
  const board = await bp.screenshot();
  await bp.close();

  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('import: ' + e.message));
  await onboard(page, { name: 'Pat', layout: 'Medium' });
  await unlock(page);
  await panel(page, 'Boards & words');
  await page.click('.gu-section button:has-text("Import a board from a picture")');
  await page.waitForSelector('.bi-file', { state: 'attached' }); await pause(page);
  await page.setInputFiles('.bi-file', { name: 'board.png', mimeType: 'image/png', buffer: board });
  await page.waitForSelector('.bi-stage'); await pause(page, 500);
  await shot(page.locator('.modal'), 'import-grid');
  await page.click('.bi-read');
  await page.waitForSelector('.bi-preview', { timeout: 180000 }).catch(() => null);
  await pause(page, 500);
  await shot(page.locator('.modal'), 'import-preview');
  await page.click('.bi-grid .bi-cell >> nth=9'); await pause(page);
  await shot(page.locator('.modal >> nth=-1'), 'import-fix');
  await ctx.close();
}

await browser.close();
const total = made.reduce((n, x) => n + x.kb, 0);
for (const m of made) console.log(`${m.name}.webp  ${m.width}×${m.height}  ${m.kb} KB`);
console.log(`${made.length} images, ${total} KB in total${failed ? `, ${failed} failed` : ''}`);
if (errors.length) console.log('Page errors:\n' + errors.join('\n'));
process.exit(failed ? 1 : 0);
