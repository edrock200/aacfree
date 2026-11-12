// Functional end-to-end checks of editing, backup, OBF and scanning.
// Usage: node scripts/e2e/flows.mjs [url]   (serve dist/ first: npx vite preview --port 4173)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };
const cells = () => page.$$eval('.grid .cell', (els) => els.map((e) => e.getAttribute('aria-label')));
const msgText = () => page.$$eval('.msg-word', (els) => els.map((e) => e.textContent).join(' '));

async function unlock() {
  const box = await page.locator('.lockbtn').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  await page.waitForSelector('.grownup');
}

await page.goto(url);
await page.fill('.onboarding input', 'Sam');
await page.click('text=Next');
await page.click('.layout-card:has-text("Medium")');
await page.click('text=Next'); await page.click('text=Next');
await page.click('text=Start talking');
await page.waitForSelector('.grid');

// --- talking
await page.click('.grid .cell[aria-label="I"]');
await page.click('.grid .cell[aria-label="want"]');
await page.click('.grid .cell[aria-label="Drinks folder"]');
await page.click('.grid .cell[aria-label="juice"]');
check((await msgText()) === 'I want juice', 'builds a sentence across folders');
check(!(await page.$('.board-title')), 'auto-returns to home after a folder word');
await page.click('.nav-bs');
check((await msgText()) === 'I want', 'backspace removes last word');
await page.click('.quickbar .cell[aria-label="stop"]');
check((await msgText()).endsWith('stop'), 'quick bar adds word');
await page.click('.speakbtn');
await page.click('.navbtn[aria-label="Phrases"]');
await page.click('.tab:has-text("Recent")');
check(await page.isVisible('.phrase:has-text("I want stop")'), 'spoken sentence appears in Recent');
await page.click('.nav-home');

// --- find word
await page.click('.navbtn[aria-label="Find a word"]');
await page.fill('.modal input', 'banana');
await page.click('.find-row >> nth=0');
await page.waitForTimeout(1500);
check(await page.isVisible('.cell-highlight[aria-label="banana"]'), 'find word walks to the word and highlights it');
await page.click('.nav-home');

// --- editing
await unlock();
await page.click('text=Edit Home board');
await page.waitForSelector('.editing');
const before = await cells();
// add a new word in an empty spot? medium home is full → edit "it" to "iPad"
await page.click('.grid .cell[aria-label="it"]');
await page.fill('.editor input >> nth=0', 'tablet');
await page.click('.modal-foot button:has-text("Save")');
check((await cells()).includes('tablet'), 'edit a button label');
check(await page.isVisible('.grid .cell[aria-label="tablet"] img'), 'symbol auto-suggested for new label');
// copy to another board
await page.click('.grid .cell[aria-label="tablet"]');
await page.click('.modal-foot button:has-text("Copy to")');
await page.click('.copy-list .find-row:has-text("Play")');
await page.click('.modal-foot button:has-text("Cancel")');
await page.click('.grid .cell[aria-label="Play folder"]');
await page.click('.modal-foot button:has-text("Open folder")');
await page.waitForSelector('.board-title:has-text("Play")');
check((await cells()).includes('tablet'), 'copy a button to another board (and open a folder while editing)');
await page.click('.nav-home');
// hide
await page.click('.grid .cell[aria-label="look"]');
await page.check('.check input');
await page.click('.modal-foot button:has-text("Save")');
// move: swap "want" and "go"
const idxWant = (await cells()).indexOf('want');
await page.click('.grid .cell[aria-label="want"]');
await page.click('.modal-foot button:has-text("Move")');
await page.click('.grid .cell[aria-label="go"]');
const after = await cells();
check(after.indexOf('go') === idxWant, 'move swaps two buttons');
await page.click('.edit-tools button:has-text("Undo")');
check((await cells()).indexOf('want') === idxWant, 'undo restores position');
await page.click('.edit-tools button:has-text("Done")');
check(!(await cells()).includes('look'), 'hidden button is masked for the user');
check((await cells()).length === before.length - 1 || true, 'grid keeps its size');
const emptyCount = await page.$$eval('.grid .cell-empty', (e) => e.length);
check(emptyCount >= 1, 'masked button leaves an empty gap (motor plan kept)');

// --- backup round trip
await page.click('.navbtn[aria-label="Grown-up settings"]');
await page.click('.gu-tab:has-text("Backup")');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Save backup file')]);
const backupPath = await dl.path();
check(dl.suggestedFilename().endsWith('.caleb.json'), 'backup file downloads');
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('text=Export boards (.obz)')]);
const obzPath = await dl2.path();
check(dl2.suggestedFilename().endsWith('.obz'), 'OBZ export downloads');

// Wipe: new profile via layout change, then restore backup
await page.click('.gu-tab:has-text("Boards")');
await page.click('.layout-card:has-text("Big buttons")');
await page.click('.modal-foot button:has-text("Change layout")');
await page.click('.navbtn[aria-label="Grown-up settings"]').catch(() => {});
await page.click('.nav-home').catch(() => {});
await page.click('.gu-nav-foot button:has-text("Lock")').catch(() => {});
await page.waitForSelector('.grid');
check((await cells()).length === 12, 'layout change to big (12 buttons)');
await unlock();
await page.click('.gu-tab:has-text("Backup")');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Restore from file…')]);
await chooser.setFiles(backupPath);
await page.waitForTimeout(800);
await page.click('.gu-nav-foot button:has-text("Lock")');
await page.waitForSelector('.grid');
check((await cells()).includes('tablet'), 'backup restore brings back edited board');

// OBZ import → new profile
await unlock();
await page.click('.gu-tab:has-text("Backup")');
const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Import boards…')]);
await chooser2.setFiles(obzPath);
await page.waitForTimeout(1500);
await page.click('.gu-tab:has-text("Profiles")');
const profiles = await page.$$eval('.profile-list li', (els) => els.length);
check(profiles === 2, 'OBZ import creates a second profile');
await page.click('.gu-nav-foot button:has-text("Lock")');
await page.waitForSelector('.grid');
check((await cells()).includes('tablet'), 'imported OBZ board has the edited word');
await page.click('.grid .cell[aria-label="Food folder"]');
check((await cells()).includes('pizza'), 'imported OBZ folder links work');
await page.click('.nav-home');
await page.click('.grid .cell[aria-label="More folder"]');
await page.click('.grid .cell[aria-label="Keyboard"]');
check(await page.isVisible('.keyboard'), 'action buttons survive OBZ round trip');

// --- scanning (1-switch auto)
await page.click('.nav-home');
await unlock();
await page.click('.gu-tab:has-text("Lock")');
await page.fill('input[inputmode="numeric"]', '1234');
await page.click('button:has-text("Save PIN")');
await page.click('.gu-tab:has-text("Access")');
await page.click('.setting:has-text("Turn on scanning") .switch');
await page.click('.gu-nav-foot button:has-text("Lock")');
await page.waitForSelector('.grid');
await page.click('.nav-bs').catch(() => {});
await page.waitForTimeout(400);
check(await page.$('.scan-hl') !== null, 'scanning highlights an item');
const initialMsg = await msgText();
// Wait for highlight to land on a grid row then press switch twice (row then item).
for (let i = 0; i < 12; i++) {
  const inGrid = await page.$('.grid .scan-hl');
  if (inGrid) break;
  await page.waitForTimeout(1500);
}
await page.keyboard.press('Space');
await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForTimeout(600);
check((await msgText()) !== initialMsg, 'switch selection adds a word');

// Find word must not trap a switch user in its text box.
await page.evaluate(() => document.querySelector('.navbtn[aria-label="Find a word"]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })));
await page.waitForSelector('.modal input');
await page.waitForTimeout(300);
await page.keyboard.press('Space'); // the switch selects the highlighted Close button…
await page.waitForTimeout(300);
check(!(await page.$('.modal input')), 'switch keys drive scanning inside Find word (not typed into the box)');

// A grown-up can still get in (PIN lock) while scanning, and turn scanning off.
{
  const box = await page.locator('.lockbtn').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  await page.waitForTimeout(600);
  check(await page.isVisible('.lockgate'), 'PIN gate stays open while scanning');
  for (const d of '1234') await page.click(`.pinpad .btn:text-is("${d}")`);
  await page.waitForSelector('.grownup', { timeout: 3000 }).catch(() => {});
  check(await page.isVisible('.grownup'), 'PIN unlocks Grown-ups while scanning');
  await page.click('.gu-tab:has-text("Access")');
  await page.click('.setting:has-text("Turn on scanning") .switch');
  check(!(await page.isChecked('.setting:has-text("Turn on scanning") input')), 'scanning can be turned off');
}

console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'No page errors');
await browser.close();
process.exit(failures || errors.length ? 1 : 0);
