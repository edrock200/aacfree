// Smoke test + screenshots. Usage: node scripts/e2e/screens.mjs <url> <outdir>
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? '.';
const browser = await chromium.launch();
const errors = [];
async function run(name, viewport, steps) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
  await page.goto(url);
  await steps(page);
  await ctx.close();
}
const shot = (page, n) => page.screenshot({ path: `${out}/${n}.png` });

await run('tablet', { width: 1180, height: 820 }, async (page) => {
  await page.waitForSelector('.onboarding');
  await shot(page, '01-onboarding');
  await page.fill('input', 'Caleb');
  await page.click('text=Next');
  await page.click('.layout-card:has-text("Full core")');
  await shot(page, '02-layouts');
  await page.click('text=Next');
  await page.click('text=Next');
  await page.click('text=Start talking');
  await page.waitForSelector('.grid');
  await page.waitForTimeout(500);
  await shot(page, '03-home-full');
  for (const w of ['I', 'want', 'eat']) await page.click(`.grid .cell[aria-label="${w}"]`);
  await page.click('.grid .cell[aria-label="Food folder"]');
  await page.waitForTimeout(300);
  await shot(page, '04-food');
  await page.click('.grid .cell[aria-label="pizza"]');
  await page.waitForTimeout(300);
  await shot(page, '05-sentence');
  await page.click('.msg-word >> nth=2');
  await page.waitForTimeout(200);
  await shot(page, '06-forms');
  await page.click('.form-btn:has-text("ate")');
  await page.click('.navbtn[aria-label="Keyboard"]');
  await page.click('.key[aria-label="h"]'); await page.click('.key[aria-label="e"]');
  await shot(page, '07-keyboard');
  await page.click('.navbtn[aria-label="Phrases"]');
  await shot(page, '08-phrases');
  await page.click('.navbtn[aria-label="Tools"]');
  await shot(page, '09-tools');
  await page.click('.tool-tile[aria-label="Schedule"]');
  await shot(page, '10-schedule');
  await page.click('text=Tools');
  await page.click('.tool-tile[aria-label="Timer"]');
  await shot(page, '11-timer');
  // Grown-ups (hold)
  const lock = page.locator('.lockbtn');
  const box = await lock.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  await page.waitForSelector('.grownup');
  await shot(page, '12-grownups');
  await page.click('.gu-tab:has-text("Display")');
  await shot(page, '13-display');
  await page.click('text=Edit Home board >> nth=0').catch(async () => { await page.click('.gu-tab:has-text("Boards")'); await page.click('text=Edit Home board'); });
  await page.waitForTimeout(300);
  await shot(page, '14-edit');
  await page.click('.grid .cell[aria-label="want"]');
  await page.waitForTimeout(300);
  await shot(page, '15-editor');
});

await run('phone', { width: 390, height: 844 }, async (page) => {
  await page.waitForSelector('.onboarding');
  await page.click('text=Skip setup');
  await page.waitForSelector('.grid');
  await page.waitForTimeout(400);
  await shot(page, '20-phone-home');
  await page.click('.grid .cell[aria-label="Food folder"]');
  await page.waitForTimeout(300);
  await shot(page, '21-phone-food');
});
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No page errors');
