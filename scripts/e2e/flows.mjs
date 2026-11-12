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
/** Wait for a selector instead of sleeping; a timeout is reported by the check that follows. */
const waitFor = (sel, opts = {}) => page.waitForSelector(sel, { timeout: 5000, ...opts }).catch(() => null);
const modalGone = () => waitFor('.modal', { state: 'detached', timeout: 8000 });

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
await waitFor('.cell-highlight[aria-label="banana"]');
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
{
  const now = await cells();
  check(now.length === before.length && now[before.indexOf('look')] === null, 'grid keeps its size (the hidden word leaves an empty gap in place)');
}
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
await waitFor('.grid .cell[aria-label="goal"]');
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
await modalGone();
await page.click('.gu-nav-foot button:has-text("Lock")');
await page.waitForSelector('.grid');
check((await cells()).includes('tablet'), 'backup restore brings back edited board');

// OBZ import → new profile
await unlock();
await page.click('.gu-tab:has-text("Backup")');
const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Import boards…')]);
await chooser2.setFiles(obzPath);
await waitFor('.toast:has-text("new profile")', { timeout: 10000 });
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
await waitFor('.scan-hl');
check(await page.$('.scan-hl') !== null, 'scanning highlights an item');
const initialMsg = await msgText();
// Wait for highlight to land on a grid row then press switch twice (row then item).
await waitFor('.grid .scan-hl', { timeout: 20000 });
await page.keyboard.press('Space');
await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForTimeout(600);
check((await msgText()) !== initialMsg, 'switch selection adds a word');

// Find word must not trap a switch user in its text box.
await page.evaluate(() => document.querySelector('.navbtn[aria-label="Find a word"]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })));
await page.waitForSelector('.modal input');
await waitFor('.modal .scan-hl');
await page.keyboard.press('Space'); // the switch selects the highlighted Close button…
await page.waitForTimeout(300);
check(!(await page.$('.modal input')), 'switch keys drive scanning inside Find word (not typed into the box)');

// A grown-up can still get in (PIN lock) while scanning, and turn scanning off.
{
  const box = await page.locator('.lockbtn').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  await waitFor('.lockgate');
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
  await waitFor('.gu-tab:has-text("Vista")');
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
  await waitFor('.gu-tab:has-text("Display")');
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
  await modalGone();
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
  await modalGone();
  await waitFor('.gu-main .setting.choice');
  await choice(1).locator('button:has-text("English")').click(); // app language stays English
  await waitFor('.gu-tab:has-text("Display")');
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
  await modalGone();
  await waitFor('.gu-main .setting.choice');
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
  await modalGone();
  check(await page.isVisible('.gu-tab:has-text("Backup")'), 'encrypted backup restores with its passcode');
  await page.click('.setting:has-text("Lock backups with a passcode") .switch');
}

// --- v0.5 talk ---
{
  const toolsMenu = async () => {
    await page.click('.navbtn[aria-label="Tools"]');
    if (await page.isVisible('.tool-head')) await page.click('.tool-head .btn:has-text("Tools")');
  };
  const speak = async () => { await page.waitForSelector('.speakbtn:not(.stopping)', { timeout: 10000 }); await page.click('.speakbtn'); };
  if (await page.isVisible('.grownup')) await page.click('.gu-nav-foot .btn.primary');
  await page.waitForSelector('.grid');

  // Phrases always speak; editing needs the explicit pencil (defect 2, UX 5)
  await unlock();
  await page.click('.gu-tab:has-text("Boards & words")');
  await page.click('.quick-edits button:has-text("Edit phrases")');
  await page.waitForSelector('.phrases-screen');
  check(await page.isVisible('.unlocked-banner'), 'an "Editing unlocked" bar shows outside Grown-ups');
  check(await page.isVisible('.phrase-grid .phrase-edit'), 'the Grown-ups shortcut opens Phrases with editing on');
  await page.click('.tab:has-text("Done editing")');
  await page.locator('.phrase-grid .phrase').first().click();
  await page.waitForTimeout(300);
  check(!(await page.isVisible('.modal')), 'a phrase tap speaks (no editor) while Grown-ups is unlocked');
  await page.click('.tab:has-text("Edit phrases")');
  await page.locator('.phrase-grid .phrase').first().click();
  check(await page.isVisible('.modal textarea'), 'with the pencil on, a tap opens the phrase editor');
  await page.fill('.modal textarea', 'changed but not saved');
  await page.mouse.click(4, 4); // tap outside the dialog
  check(await page.isVisible('text=Discard changes?'), 'tapping outside asks before discarding unsaved work');
  await page.click('.modal-foot button:has-text("Discard")');
  check(!(await page.isVisible('.modal')), 'Discard closes the editor');
  await page.click('.unlocked-banner button');
  check(!(await page.isVisible('.unlocked-banner')) && (await page.isVisible('.phrases-screen')), 'Lock in the bar locks without leaving the screen');

  // Recent: delete, clear, private, without the lock (feature 2, defect 54)
  await page.click('.nav-home');
  await page.click('.grid .cell[aria-label="I"]');
  await speak();
  await page.locator('.quickbar .cell').nth(1).click();
  await speak();
  await page.click('.navbtn[aria-label="Phrases"]');
  await page.click('.tab:has-text("Recent")');
  const rows = () => page.locator('.recent-row').count();
  const n = await rows();
  await page.locator('.recent-row button[aria-label="Delete this sentence"]').first().click();
  check((await rows()) === n - 1, 'the person can delete one recent sentence');
  await page.click('.toast-action');
  check((await rows()) === n, 'Undo brings the deleted sentence back');
  await page.click('.recent-tools button:has-text("Clear recent")');
  check((await rows()) === 0, 'Clear recent empties the list');
  await page.click('.recent-tools button:has-text("Private for now")');
  await page.click('.nav-home');
  await page.locator('.quickbar .cell').nth(2).click();
  await speak();
  await page.click('.navbtn[aria-label="Phrases"]');
  await page.click('.tab:has-text("Recent")');
  check((await rows()) === 0, '"Private for now" keeps nothing in Recent');
  await page.click('.recent-tools button:has-text("Private for now")');

  // Clearing can be undone until the next word (UX 2)
  await page.click('.nav-home');
  // (headless Chromium has no voices, so a "no voices" message may still be showing: let it go first)
  await page.waitForTimeout(1700);
  await page.waitForSelector('.toast', { state: 'detached', timeout: 10000 });
  await page.click('.msg-tools button[aria-label="Clear message"]');
  await page.waitForTimeout(5500);
  check(await page.isVisible('.toast-action'), 'Undo after clearing stays until the next word');
  await page.click('.toast-action');
  check((await msgText()).length > 0, 'Undo restores the cleared message');
  await page.click('.grid .cell[aria-label="I"]');
  check(!(await page.isVisible('.toast-action')), 'the next word dismisses the Undo');

  // My voice: never locked; "Show, don't speak" routes to Big text (feature 1)
  await toolsMenu();
  await page.click('.tool-tile[aria-label="My voice"]');
  await page.click('.myvoice button:has-text("Loud")');
  check(await page.getAttribute('.myvoice button:has-text("Loud")', 'aria-pressed') === 'true', 'My voice volume presets work without the lock');
  await page.click('.myvoice button:has-text("Off: speaking out loud")');
  await page.click('.nav-home');
  await speak();
  check(await page.isVisible('.bigtext'), '"Show, don\'t speak" shows the message in Big text');
  await page.click('.bigtext-tools button:has-text("Close")');
  await page.click('.navbtn[aria-label="Tools"]');
  await page.click('.myvoice button:has-text("On: showing")');
  await page.click('.nav-home');

  // A grown-up can hide a tool (UX 9)
  await unlock();
  await page.click('.gu-tab:has-text("Display")');
  await page.click('.gu-section:has(h3:text-is("Tools shown")) .setting:has-text("Draw") .switch');
  await page.click('.gu-nav-foot .btn.primary');
  await page.waitForSelector('.grid');
  await toolsMenu();
  check(!(await page.isVisible('.tool-tile[aria-label="Draw"]')) && (await page.isVisible('.tool-tile[aria-label="Timer"]')), 'a grown-up can hide one tool');
  await page.click('.nav-home');
}

// --- v0.5 platform ---
{
  // Content-Security-Policy: record every violation from here on (reload so the recorder runs first).
  const cspRecorder = () => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
  };
  const cspConsole = [];
  page.on('console', (m) => { if (/Content.Security.Policy/i.test(m.text())) cspConsole.push(m.text()); });
  await page.addInitScript(cspRecorder);
  if (await page.isVisible('.grownup')) await page.click('.gu-nav-foot .btn.primary');
  await page.reload();
  await page.waitForSelector('.grid');
  check(await page.$('meta[http-equiv="Content-Security-Policy"]') !== null, 'the built app has a Content-Security-Policy');
  check((await cells()).includes('tablet'), 'data survives a page reload');
  const swReady = await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready.then(() => true),
    new Promise((r) => setTimeout(() => r(false), 10000)),
  ]));
  check(swReady, 'service worker registers under the CSP (offline cache)');
  const media = await page.evaluate(async () => {
    const load = (el, src, ok, bad) => new Promise((r) => { el.addEventListener(ok, () => r(true)); el.addEventListener(bad, () => r(false)); el.src = src; setTimeout(() => r(false), 4000); });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>';
    const blobImg = await load(new Image(), URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), 'load', 'error');
    const dataImg = await load(new Image(), 'data:image/svg+xml,' + encodeURIComponent(svg), 'load', 'error');
    // 0.1 s of silence as a WAV (like a recorded voice clip from IndexedDB).
    const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    const audio = new Audio();
    audio.preload = 'auto';
    const blobAudio = await load(audio, URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })), 'loadeddata', 'error');
    const blobFetch = await fetch(URL.createObjectURL(new Blob(['x']))).then(() => true, () => false);
    const dataFetch = await fetch('data:text/plain,x').then(() => true, () => false);
    return { blobImg, dataImg, blobAudio, blobFetch, dataFetch };
  });
  check(media.blobImg && media.dataImg, 'photos from IndexedDB (blob:) and data: images load under the CSP');
  check(media.blobAudio, 'recorded voice clips (blob: audio) play under the CSP');
  check(media.blobFetch && media.dataFetch, 'backup photos can be decoded (fetch of data:/blob:) under the CSP');

  // The grown-up lock is app-wide: a new profile can't get round the PIN (defect 29).
  await unlock(); // PIN 1234 from the scanning checks
  await page.click('.gu-tab:has-text("Lock")');
  check(await page.isVisible('text=The lock covers every profile on this device.'), 'lock panel says it covers every profile');
  check(await page.isChecked('.setting:has-text("Download missing pictures from ARASAAC") input'), 'downloading missing pictures from ARASAAC is on by default (and can be turned off)');
  await page.click('.gu-tab:has-text("Profiles")');
  const profileNames = await page.$$eval('.profile-list li b', (els) => els.map((e) => e.textContent));
  await page.click('button:has-text("+ Add profile")');
  await page.fill('.modal input', 'Kid');
  await page.click('.modal-foot button:has-text("Create")');
  await modalGone();
  await page.click('.gu-nav-foot button:has-text("Lock")');
  await page.waitForSelector('.grid');
  {
    const box = await page.locator('.lockbtn').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  }
  await waitFor('.lockgate, .grownup');
  check(await page.isVisible('.lockgate') && !(await page.isVisible('.grownup')), 'a newly added profile still needs the PIN');
  for (const d of '1234') await page.click(`.pinpad .btn:text-is("${d}")`);
  await page.waitForSelector('.grownup');
  await page.click('.gu-tab:has-text("Profiles")');
  await page.click(`.profile-list li:has-text("${profileNames[0]}") button:has-text("Switch")`);
  await page.click('.profile-list li:has-text("Kid") button:has-text("Delete")');
  await page.click('.modal-foot button.danger');
  await modalGone();
  check((await page.$$eval('.profile-list li', (els) => els.length)) === profileNames.length, 'the extra profile can be removed again');
  await page.click('.gu-nav-foot button:has-text("Lock")');
  await page.waitForSelector('.grid');

  const violations = [...(await page.evaluate(() => window.__csp ?? [])), ...cspConsole];
  if (violations.length) console.log('   CSP:', violations.join(' | '));
  check(!violations.length, 'no Content-Security-Policy violations while using the app');

  // MediaPipe head pointer with a fake camera: the WASM and model must load under the CSP.
  const camBrowser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const camCtx = await camBrowser.newContext({ viewport: { width: 1180, height: 820 }, permissions: ['camera'] });
  const cam = await camCtx.newPage();
  const camConsole = [];
  cam.on('console', (m) => { if (/Content.Security.Policy/i.test(m.text())) camConsole.push(m.text()); });
  await cam.addInitScript(cspRecorder);
  await cam.goto(url);
  await cam.fill('.onboarding input', 'Cam');
  await cam.click('text=Next');
  await cam.click('.layout-card:has-text("Medium")');
  await cam.click('text=Next'); await cam.click('text=Next');
  await cam.click('text=Start talking');
  await cam.waitForSelector('.grid');
  {
    const box = await cam.locator('.lockbtn').boundingBox();
    await cam.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await cam.mouse.down(); await cam.waitForTimeout(2200); await cam.mouse.up();
  }
  await cam.waitForSelector('.grownup');
  await cam.click('.gu-tab:has-text("Access")');
  await cam.click('.setting.choice button:has-text("Head pointer (camera)")');
  await cam.click('.gu-nav-foot button:has-text("Lock")');
  await cam.waitForSelector('.grid');
  await cam.waitForSelector('.pointer-status.tracking, .pointer-status.no-face, .pointer-status.error', { timeout: 60000 }).catch(() => null);
  const status = await cam.$eval('.pointer-status', (e) => `${e.className} ${e.textContent}`).catch(() => 'none');
  // 'no-face' means the face model is running on the camera frames (the fake camera shows no face).
  check(/tracking|no-face/.test(status), `head pointer loads MediaPipe (WASM + face model) under the CSP (${status.trim()})`);
  const camViolations = [...(await cam.evaluate(() => window.__csp ?? [])), ...camConsole];
  if (camViolations.length) console.log('   CSP:', camViolations.join(' | '));
  check(!camViolations.length, 'no CSP violations while the camera pointer runs');
  await camBrowser.close();
}

console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'No page errors');
await browser.close();
process.exit(failures || errors.length ? 1 : 0);
