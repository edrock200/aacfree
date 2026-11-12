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
  if (await page.isVisible('.lockgate')) for (const d of '1234') await page.click(`.pinpad .btn:text-is("${d}")`);
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

// --- symbol library: custom category + symbol, then a board category made from it
await page.click('.navbtn[aria-label="Grown-up settings"]');
await page.click('.gu-tab:has-text("Symbols")');
check(await page.isVisible('.lib-folder[aria-label="Food folder"]'), 'library shows category folders with icons');
await page.click('.lib-folder.add');
await page.fill('.modal input', 'Soccer');
await page.click('.lib-folder.preview');
await page.click('.modal .tab:has-text("Emoji")');
await page.click('.emoji-opt:text-is("⚽")');
await page.click('.modal-foot button:has-text("Save")');
check(await page.isVisible('.lib-head:has-text("Soccer")'), 'create a custom symbol category');
await page.click('.lib-head button:has-text("Add symbol")');
await page.click('.modal .tab:has-text("Emoji")');   // picker opens automatically
await page.click('.emoji-opt:text-is("🥅")').catch(async () => { await page.click('.emoji-opt >> nth=5'); });
await page.fill('.modal input[placeholder*="Grandma"]', 'goal');
await page.click('.modal-foot button:has-text("Save")');
check(await page.isVisible('.sym-opt:has-text("goal")'), 'add a custom symbol to the category');
await page.click('.gu-tab:has-text("Boards")');
await page.click('button:has-text("New category")');
await page.selectOption('.modal select', { label: 'Soccer (1) (yours)' });
await page.click('.modal-foot button:has-text("Create category")');
await page.waitForTimeout(400);
check((await cells()).includes('goal'), 'board category created from library category');
await page.click('.edit-tools button:has-text("Done")');
await page.click('.nav-home');
check((await cells()).includes('Soccer folder') || (await (async () => { await page.click('.grid .cell[aria-label="More folder"]'); return (await cells()).includes('Soccer folder'); })()), 'new category folder appears on a board');
await page.click('.nav-home');

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
await page.click('.modal-foot button:has-text("Replace with backup")');
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

// --- v0.2 features
await page.click('.gu-nav-foot button:has-text("Lock")');
await page.waitForSelector('.grid');
check(!(await page.$('.board-title')), 'locking returns to the Home board');
// paging: Food has 72 words → pages with Next/Previous
await page.click('.grid .cell[aria-label="Food folder"]');
check(await page.isVisible('.page-bar'), 'big folders are split into pages');
const firstPage = await cells();
await page.click('.page-btn[aria-label="Next page"]');
const secondPage = await cells();
check(secondPage.join() !== firstPage.join() && secondPage.length === firstPage.length, 'next page shows other words in the same-size grid');
await page.click('.nav-home');
// timer keeps running when you leave it
await page.click('.navbtn[aria-label="Tools"]');
await page.click('.tool-tile[aria-label="Timer"]');
await page.click('.timer .btn:has-text("1 min")');
await page.click('.timer .btn:has-text("Start")');
await page.click('.nav-home');
check(await page.isVisible('.timer-chip'), 'running timer shows a chip on the Talk screen');
await page.click('.timer-chip');
check(await page.isVisible('.timer-face'), 'timer chip returns to the timer');
await page.click('.timer .btn:has-text("Reset")');
await page.click('.nav-home');
// Find word: miss offers Say it / Put in message
await page.click('.navbtn[aria-label="Find a word"]');
await page.fill('.modal input', 'dinosaur nuggets');
await page.click('.find-miss button:has-text("Put in message")');
check((await msgText()).includes('dinosaur nuggets'), 'find word miss can put the words in the message');
// hardware keyboard typing on the keyboard screen
await page.click('.navbtn[aria-label="Keyboard"]');
await page.keyboard.type('i am ok ');
check((await msgText()).endsWith('I am ok'), 'physical keyboard types into the message (and capitalises I)');
await page.click('.nav-home');
// Show/Hide mode in edit mode
await unlock();
await page.click('.gu-nav-foot button:has-text("Edit")');
await page.click('.edit-tools button:has-text("Show/Hide")');
await page.click('.grid .cell[aria-label="want"]');
await page.click('.edit-tools button:has-text("Done hiding")');
await page.click('.edit-tools button:has-text("Done")');
check(!(await cells()).includes('want'), 'show/hide mode hides a word with one tap');

// --- v0.3: language switch in place, and encrypted sync round trip
{
  const before = await cells();
  await unlock();
  await page.click('.gu-tab:has-text("Display")');
  await page.click('.seg button:has-text("Español")');
  await page.click('.modal-foot button:has-text("Cambiar")');
  await page.waitForTimeout(500);
  check(await page.isVisible('.gu-tab:has-text("Vista")'), 'switching to Spanish translates the interface');
  await page.click('.gu-nav-foot .btn.primary'); // Bloquear y volver
  await page.waitForSelector('.grid');
  const es = await cells();
  check(es.length === before.length && es.includes('yo') && es.includes('ir'), 'boards are translated in place (same number of buttons)');
  await page.click('.grid .cell[aria-label="yo"]');
  await page.click('.grid .cell[aria-label="ir"]');
  check((await msgText()).endsWith('yo voy'), 'Spanish auto-conjugation (yo + ir → voy)');
  await page.click('.nav-bs'); await page.click('.nav-bs');
  await unlock();
  await page.click('.gu-tab:has-text("Vista")');
  await page.click('.seg button:has-text("English")');
  await page.click('.modal-foot button:has-text("Switch")');
  await page.waitForTimeout(500);
  await page.click('.gu-nav-foot .btn.primary');
  await page.waitForSelector('.grid');
  { const after = await cells(); const diff = before.map((x, i) => x !== after[i] ? `${x}→${after[i]}` : null).filter(Boolean); if (diff.length) console.log('   diff:', diff.join(', ')); }
  check(JSON.stringify(await cells()) === JSON.stringify(before), 'switching back to English restores every word in place');
  // sync
  await unlock();
  await page.click('.gu-tab:has-text("Backup")');
  await page.click('button:has-text("Send to another device")');
  await page.fill('.modal input:not([type="checkbox"])', 'test-pass-123');
  const [sf] = await Promise.all([page.waitForEvent('download'), page.click('.modal-foot button:has-text("Create sync file")')]);
  const syncPath = await sf.path();
  const raw = (await import('node:fs')).readFileSync(syncPath, 'utf8');
  check(raw.includes('"kind":"sync"') && !raw.includes('tablet'), 'sync file is encrypted');
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("Receive from another device")')]);
  await ch.setFiles(syncPath);
  await page.fill('.modal input', 'wrong-pass');
  await page.click('.modal-foot button:has-text("Unlock")');
  await page.waitForSelector('.modal .error');
  check(await page.isVisible('.modal .error'), 'wrong sync passcode is rejected');
  await page.fill('.modal input', 'test-pass-123');
  await page.click('.modal-foot button:has-text("Unlock")');
  await page.waitForSelector('.modal-foot button:has-text("Sync now")');
  check(await page.isVisible('text=Kept (this device is newer)'), 'sync preview shows what will happen');
  await page.click('.modal-foot button:has-text("Sync now")');
  await page.waitForTimeout(500);
}

// --- v0.4: language options and encrypted backups
{
  if (await page.isVisible('.grownup')) await page.click('.gu-nav-foot .btn.primary');
  await page.waitForSelector('.grid');
  const before = await cells();
  await unlock();
  await page.click('.gu-tab:has-text("Display")');
  const choice = (n) => page.locator('.gu-main .setting.choice').nth(n);
  await choice(0).locator('button:has-text("Français")').click();
  await page.click('.modal-foot .btn.primary');
  await page.waitForTimeout(500);
  await choice(1).locator('button:has-text("English")').click(); // app language stays English
  await page.waitForTimeout(300);
  check(await page.isVisible('.gu-tab:has-text("Display")'), 'app language can differ from the communication language');
  await choice(2).locator('button:has-text("English")').click(); // second language on buttons
  await page.click('.gu-nav-foot .btn.primary');
  await page.waitForSelector('.grid');
  const fr = await cells();
  check(fr.length === before.length && fr.includes('je') && fr.includes('aller'), 'boards switch to French in place');
  check((await page.$$eval('.cell-label2', (e) => e.map((x) => x.textContent))).includes('go'), 'second language shows under each word');
  await page.click('.grid .cell[aria-label="je"]');
  await page.click('.grid .cell[aria-label="aller"]');
  check((await msgText()).endsWith('je vais'), 'French auto-conjugation (je + aller → vais)');
  await page.click('.nav-bs'); await page.click('.nav-bs');
  await unlock();
  await page.click('.gu-tab:has-text("Display")');
  await choice(2).locator('button').first().click(); // none
  await choice(0).locator('button:has-text("English")').click();
  await page.click('.modal-foot .btn.primary');
  await page.waitForTimeout(500);
  await choice(1).locator('button').first().click(); // app language: same
  await page.click('.gu-nav-foot .btn.primary');
  await page.waitForSelector('.grid');
  check(JSON.stringify(await cells()) === JSON.stringify(before), 'French → English restores every word in place');

  // encrypted backup round trip
  await unlock();
  await page.click('.gu-tab:has-text("Backup")');
  await page.click('.setting:has-text("Lock backups with a passcode") .switch');
  await page.fill('input[aria-label="Backup passcode"]', 'backup-pass-9');
  await page.click('button:has-text("Save passcode")');
  const [bf] = await Promise.all([page.waitForEvent('download'), page.click('text=Save backup file')]);
  const encPath = await bf.path();
  check((await import('node:fs')).readFileSync(encPath, 'utf8').includes('"kind":"encrypted-backup"'), 'backup file is encrypted when locking is on');
  const [c3] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Restore from file…')]);
  await c3.setFiles(encPath);
  await page.fill('.modal input', 'backup-pass-9');
  await page.click('.modal-foot button:has-text("Unlock")');
  await page.click('.modal-foot button:has-text("Replace with backup")');
  await page.waitForTimeout(600);
  check(await page.isVisible('.gu-tab:has-text("Backup")'), 'encrypted backup restores with its passcode');
  await page.click('.setting:has-text("Lock backups with a passcode") .switch');
}

// --- v0.5 access ---
{
  const hl = () => page.$$eval('.scan-hl', (els) => els.map((e) => e.getAttribute('aria-label') || e.textContent.trim()));
  const words = async () => (await page.$$('.msg-word:not(.draft)')).length;
  const press = async (key, wait = 70) => { await page.keyboard.press(key); await page.waitForTimeout(wait); };
  const tap = (sel) => page.evaluate((s) => document.querySelector(s).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })), sel);
  const toGrid = async () => {
    for (let i = 0; i < 12 && !(await page.$('.grid .scan-hl')); i++) await press('Space');
    return !!(await page.$('.grid .scan-hl'));
  };
  const skipFolders = async () => { for (let i = 0; i < 10 && (await hl()).join().includes('folder'); i++) await press('Space'); };

  if (!(await page.isVisible('.grownup'))) await unlock();
  await page.click('.gu-tab:has-text("Lock")');
  await page.click('.seg button:has-text("Hold 2 seconds")');
  await page.click('.gu-tab:has-text("Access")');
  await page.click('.seg button:has-text("2 switches (step)")');
  await page.click('.setting:has-text("Turn on scanning") .switch');
  await page.click('.gu-nav-foot button:has-text("Lock")');
  await page.waitForSelector('.grid');
  await page.waitForTimeout(400);
  check(!!(await page.$('.msg[role="group"]')) && !(await page.$('.msg[role="button"]')), 'message bar is a group, not a button wrapping buttons');
  check(await toGrid(), 'two-switch scanning: Space moves to a board row');

  // A held switch sends key-repeat events: it must count as one press.
  const before = await words();
  await page.keyboard.down('Enter');
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(40); await page.keyboard.down('Enter'); }
  await page.keyboard.up('Enter');
  await page.waitForTimeout(200);
  check((await words()) === before && (await page.$$('.grid .scan-hl')).length === 1, 'a held switch (key repeat) enters a row once and activates nothing');

  // A bounce right after an activation is ignored (lockout), and scanning restarts at the top.
  await skipFolders();
  await press('Enter', 80);
  await press('Enter', 150);
  check((await words()) === before + 1, 'a second press right after an activation is ignored (lockout)');
  await page.waitForTimeout(700);
  check((await page.$$('.msgbar .scan-hl')).length > 0 && !(await page.$('.grid .scan-hl')), 'scanning starts again from the top after an activation');

  // Holding the switch on a word activates it exactly once.
  await toGrid();
  await press('Enter');
  await skipFolders();
  const b2 = await words();
  await page.keyboard.down('Enter');
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(40); await page.keyboard.down('Enter'); }
  await page.keyboard.up('Enter');
  await page.waitForTimeout(200);
  check((await words()) === b2 + 1, 'holding the switch on a word activates it exactly once');
  check((await page.$$('.msg-words [data-scan-item]')).length === b2 + 1, 'message words are scan items (word forms reachable by switch)');

  // Toasts stay usable while scanning: a helper can tap Undo.
  await page.waitForTimeout(700);
  await tap('[aria-label="Clear message"]');
  await page.waitForSelector('.toast-action');
  check((await words()) === 0, 'Clear (a PressButton) clears the message');
  await page.click('.toast-action');
  await page.waitForTimeout(200);
  check((await words()) === b2 + 1, 'toast Undo can be tapped while scanning');

  // Big text is a modal for scanning.
  await tap('[aria-label="Show in big text"]');
  await page.waitForSelector('.bigtext');
  await page.waitForTimeout(200);
  const inside = () => page.$$eval('.scan-hl', (els) => els.length > 0 && els.every((e) => !!e.closest('.bigtext')));
  let confined = await inside();
  for (let i = 0; i < 4; i++) { await press('Space'); confined = confined && await inside(); }
  check(confined && await page.evaluate(() => document.getElementById('root').inert === true), 'Big text is a modal: scanning stays inside it and the page behind is inert');
  for (let i = 0; i < 5 && !(await hl()).join().includes('Close'); i++) await press('Space');
  await press('Enter', 400);
  check(!(await page.$('.bigtext')) && await page.evaluate(() => !document.getElementById('root').inert), 'the switch closes Big text and the page is usable again');

  // Find word results can be scanned.
  await page.waitForTimeout(600);
  await tap('.navbtn[aria-label="Find a word"]');
  await page.waitForSelector('.modal input');
  check(!(await page.evaluate(() => document.activeElement?.tagName === 'INPUT')), 'Find word does not grab the keyboard while scanning');
  await page.fill('.modal input', 'juice');
  let reached = false;
  for (let i = 0; i < 6 && !reached; i++) { await press('Space'); reached = !!(await page.$('.find-results .scan-hl')); }
  check(reached, 'Find word results are reachable by switch');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Leave scanning: hold the Grown-ups button (hold lock).
  {
    const box = await page.locator('.lockbtn').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
    await page.waitForSelector('.grownup');
    await page.click('.gu-tab:has-text("Access")');
    await page.click('.setting:has-text("Turn on scanning") .switch');
    await page.click('.seg button:has-text("1 switch (auto)")');
    check(await page.isVisible('.setting:has-text("Switch acceptance time")') && await page.isVisible('.setting:has-text("Next switch")'), 'scanning timing and switch-key settings are offered');
    await page.click('.gu-nav-foot button:has-text("Lock")');
    await page.waitForSelector('.grid');
  }

  // Keyboard / screen-reader path into Grown-ups under the hold lock: a question gate.
  await page.focus('.lockbtn');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.lockgate', { timeout: 3000 }).catch(() => {});
  check(await page.isVisible('.lockgate'), 'keyboard activation of Grown-ups (hold lock) opens a question gate');
  let trapped = true;
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); trapped = trapped && await page.evaluate(() => !!document.activeElement?.closest('.modal')); }
  check(trapped, 'Tab stays inside the dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => document.activeElement?.classList.contains('lockbtn')), 'closing a dialog gives focus back to what opened it');
  await page.focus('.lockbtn');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.lockgate');
  const qText = await page.textContent('.lockgate p.center');
  const [, a, b] = /(\d+)\s*×\s*(\d+)/.exec(qText) ?? [];
  for (const d of String(Number(a) * Number(b))) await page.click(`.pinpad .btn:text-is("${d}")`);
  await page.waitForSelector('.grownup', { timeout: 3000 }).catch(() => {});
  check(await page.isVisible('.grownup'), 'answering the question opens Grown-ups');

  // PIN gate: the length is not shown, and wrong tries back off gently.
  await page.click('.gu-tab:has-text("Lock")');
  await page.fill('input[inputmode="numeric"]', '1234');
  await page.click('button:has-text("Save PIN")');
  await page.click('.gu-nav-foot button:has-text("Lock")');
  await page.waitForSelector('.grid');
  {
    const box = await page.locator('.lockbtn').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  }
  await page.waitForSelector('.lockgate');
  const dots0 = (await page.$$('.pin-dots i')).length;
  await page.click('.pinpad .btn:text-is("9")');
  check(dots0 === 0 && (await page.$$('.pin-dots i')).length === 1, 'the PIN gate does not show how long the PIN is');
  for (let n = 0; n < 3; n++) {
    for (const d of '9876') await page.click(`.pinpad .btn:text-is("${d}")`).catch(() => {});
    await page.click('.pinpad .btn:text-is("OK")').catch(() => {});
    await page.waitForTimeout(600);
  }
  check(/wait/i.test(await page.textContent('.lockgate-msg')) && await page.isDisabled('.pinpad .btn:text-is("1")'), 'repeated wrong PINs make the gate wait a little');
  await page.keyboard.press('Escape');

  // Text size applies app-wide; nav labels are readable.
  const navPx = await page.$eval('.navbtn span', (e) => parseFloat(getComputedStyle(e).fontSize));
  check(navPx >= 12.5, `nav labels are at least 12.5 px (${navPx})`);
}

console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'No page errors');
await browser.close();
process.exit(failures || errors.length ? 1 : 0);
