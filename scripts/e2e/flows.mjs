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
await page.click('.navbtn[aria-label="Settings"]');
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
await page.click('.navbtn[aria-label="Settings"]');
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
await page.click('.navbtn[aria-label="Settings"]').catch(() => {});
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
  check(await page.isVisible('text=Nothing new for this device.'), 'sync preview shows what will happen');
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

// --- v0.5 data ---
{
  if (await page.isVisible('.grownup')) await page.click('.gu-nav-foot .btn.primary');
  await page.waitForSelector('.grid');
  // A word edit and a spoken sentence must both survive a reload.
  await unlock();
  await page.click('.gu-tab:has-text("Boards")');
  await page.click('text=Edit Home board');
  await page.waitForSelector('.editing');
  const word = (await cells()).find((l) => l && !/folder$/.test(l) && l !== 'zoom');
  await page.click(`.grid .cell[aria-label="${word}"]`);
  await page.fill('.editor input >> nth=0', 'zoom');
  await page.click('.modal-foot button:has-text("Save")');
  await page.click('.edit-tools button:has-text("Done")');
  await page.waitForSelector('.grid');
  await page.click('.grid .cell[aria-label="zoom"]');
  await page.click('.speakbtn');
  const beforeReload = await cells();
  await page.waitForTimeout(800); // past the save debounce
  await page.reload();
  await page.waitForSelector('.grid');
  const afterReload = await cells();
  check(afterReload.includes('zoom') && JSON.stringify(afterReload) === JSON.stringify(beforeReload), 'edits survive a page reload');
  check(!(await page.isVisible('.save-error')), 'no load or save problem after a reload');
  await page.click('.navbtn[aria-label="Phrases"]');
  await page.click('.tab:has-text("Recent")');
  check(await page.isVisible('.phrase:has-text("zoom")'), 'recent sentences survive a reload');
  await page.click('.nav-home');
  // A second window sees the same data.
  const page2 = await ctx.newPage();
  await page2.goto(url);
  await page2.waitForSelector('.grid');
  const other = await page2.$$eval('.grid .cell', (els) => els.map((e) => e.getAttribute('aria-label')));
  check(other.includes('zoom'), 'a second window opens the same saved boards');
  await page2.close();
  // Offline reload (only when the service worker already controls the page).
  if (await page.evaluate(() => !!navigator.serviceWorker?.controller)) {
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('.grid');
    check((await cells()).includes('zoom'), 'reloads offline with saved boards');
    await ctx.setOffline(false);
  } else {
    console.log('- offline reload skipped (service worker not controlling yet)');
  }
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

// --- v0.5 lang ---
{
  // A backup made on this device restores straight from the first onboarding step.
  await page.goto(url);
  await page.waitForSelector('.grid');
  await unlock();
  await page.click('.gu-tab:has-text("Backup")');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Save backup file')]);
  const backupPath = await dl.path();
  const fresh = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const ob = await fresh.newPage();
  ob.on('pageerror', (e) => errors.push(e.message));
  await ob.goto(url);
  await ob.waitForSelector('.onboarding');
  check(await ob.isVisible('[data-testid="ob-restore"]'), 'onboarding offers "I have a backup"');
  const [fc] = await Promise.all([ob.waitForEvent('filechooser'), ob.click('[data-testid="ob-restore"]')]);
  await fc.setFiles(backupPath);
  await ob.waitForSelector('.grid', { timeout: 8000 }).catch(() => null);
  check(await ob.isVisible('.grid') && !(await ob.isVisible('.onboarding')), 'restoring from onboarding opens the restored boards');

  // Spanish onboarding with "Start with fewer words" keeps the starter words (matched on the English originals).
  const es = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
  es.on('pageerror', (e) => errors.push(e.message));
  await es.goto(url);
  await es.click('.lang-pick button:has-text("Español")');
  await es.click('.ob-actions .btn.primary');
  await es.click('.layout-card >> nth=2');
  await es.check('.check input[type=checkbox]');
  await es.click('.ob-actions .btn.primary');
  await es.click('.ob-actions .btn.primary');
  await es.click('.ob-actions .btn.primary.big');
  await es.waitForSelector('.grid');
  const esCells = await es.$$eval('.grid .cell', (els) => els.map((e) => e.getAttribute('aria-label')));
  check(esCells.includes('querer') && esCells.includes('yo'), `Spanish "fewer words" start keeps the starter words (${esCells.filter(Boolean).join(", ")})`);
  await es.context().close();
  await fresh.close();
}

// --- v0.5 sync ---
// Automatic sync through one shared file. Playwright can't drive the native file
// dialogs, so the pickers return a stand-in file handle kept in page memory.
// Each browser context is one "device"; the shared file is copied between them.
{
  const usePrivateFile = () => {
    window.__sync = '';
    const h = {
      kind: 'file', name: 'caleb-sync.calebsync.json',
      getFile: async () => new File([window.__sync], 'caleb-sync.calebsync.json'),
      createWritable: async () => {
        let buf = '';
        return { write: async (d) => { buf += typeof d === 'string' ? d : await d.text(); }, close: async () => { window.__sync = buf; } };
      },
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    };
    window.showSaveFilePicker = async () => h;
    window.showOpenFilePicker = async () => [h];
  };
  const readFile = (pg) => pg.evaluate(() => window.__sync);
  const writeFile = (pg, text) => pg.evaluate((t) => { window.__sync = t; }, text);
  const openBackup = async (pg, unlockFn) => {
    if (!(await pg.isVisible('.grownup'))) await unlockFn();
    await pg.click('.gu-tab:has-text("Backup")');
  };
  const toastText = async (pg) => (await pg.waitForSelector('.toast')).textContent();

  // Device A (the main page): create the sync file.
  await page.addInitScript(usePrivateFile);
  await page.reload();
  await page.waitForSelector('.grid');
  await openBackup(page, unlock);
  await page.click('button:has-text("Set up automatic sync")');
  await page.click('.modal button:has-text("Yes: create a new sync file")');
  const pass = await page.inputValue('.modal input[aria-label="Sync passcode"]');
  check(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(pass), `a strong passcode is suggested (${pass})`);
  check(await page.isVisible('.modal small:has-text("Strong passcode")'), 'the passcode strength hint is shown');
  await page.click('.modal-foot button:has-text("Start syncing")');
  await page.waitForSelector('text=Last synced', { timeout: 30000 });
  const f1 = await readFile(page);
  const h1 = JSON.parse(f1);
  check(h1.v === 2 && h1.iter > 0 && !JSON.stringify({ ...h1, data: '' }).includes('Sam'), 'the shared file is a v2 sync file with no names in its header');
  check(await page.isVisible('text=Automatic sync is on'), 'sync status shows it is on and when it last synced');

  // Device B: a fresh install joins with the passcode.
  const ctxB = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const b = await ctxB.newPage();
  b.on('pageerror', (e) => errors.push('B: ' + e.message));
  await b.addInitScript(usePrivateFile);
  await b.goto(url);
  await b.fill('.onboarding input', 'Bo');
  await b.click('text=Next');
  await b.click('.layout-card:has-text("Big")');
  await b.click('text=Next'); await b.click('text=Next');
  await b.click('text=Start talking');
  await b.waitForSelector('.grid');
  await writeFile(b, f1);
  const unlockB = async () => {
    const box = await b.locator('.lockbtn').boundingBox();
    await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await b.mouse.down(); await b.waitForTimeout(2200); await b.mouse.up();
    await b.waitForSelector('.grownup');
  };
  await openBackup(b, unlockB);
  await b.click('button:has-text("Set up automatic sync")');
  await b.click('.modal button:has-text("No: choose the sync file")');
  await b.fill('.modal input[aria-label="Sync passcode"]', 'WRONG-WRONG-WRONG');
  await b.click('.modal-foot button:has-text("Start syncing")');
  await b.waitForSelector('.modal .error');
  check(await b.isVisible('.modal .error'), 'joining with the wrong passcode is refused (and the file is left alone)');
  check((await readFile(b)) === f1, 'a wrong passcode never overwrites the shared file');
  await b.fill('.modal input[aria-label="Sync passcode"]', pass.toLowerCase().replace(/-/g, ' '));
  await b.click('.modal-foot button:has-text("Start syncing")');
  const tb = await toastText(b);
  check(/New profiles: Sam/.test(tb), `joining brings the family's profiles (${tb})`);
  await b.waitForSelector('text=Automatic sync is on');
  const f2 = await readFile(b);
  check(f2 !== f1, 'the joining device writes its own profile to the shared file');

  // Back on A: the new profile from B arrives with "Sync now".
  await writeFile(page, f2);
  await page.click('button:has-text("Sync now")');
  const ta = await toastText(page);
  check(/New profiles: Bo/.test(ta), `"Sync now" brings changes from the other device (${ta})`);
  await page.waitForSelector('.snap-list li:has-text("New profiles: Bo")');
  check(await page.isVisible('text=Recent syncs'), 'recent merges are listed');
  await page.waitForSelector('.toast', { state: 'detached' });
  await page.click('button:has-text("Sync now")');
  const again = await toastText(page);
  check(/Already up to date|Synced/.test(again), `syncing again changes nothing (${again})`);
  await ctxB.close();
}

// --- v0.5.1 phone ---
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const ph = await ctx.newPage();
  ph.on('pageerror', (e) => errors.push(String(e)));
  await ph.goto(url);
  await ph.click('text=Next'); await ph.click('text=Next'); await ph.click('text=Next'); await ph.click('text=Start talking');
  await ph.waitForSelector('.grid .cell');
  const quick = await ph.$$eval('.quickbar .cell', (els) => els.map((e) => e.getAttribute('aria-label')).filter(Boolean));
  check(await ph.isVisible('.quickbar-all'), 'phone: an "All quick words" button shows when the quick bar is too wide');
  const allBox = await ph.locator('.quickbar-all').boundingBox();
  const qbBox = await ph.locator('.quickbar').boundingBox();
  check(allBox && qbBox && Math.abs(allBox.y - qbBox.y) < 4, 'phone: the All button sits in the quick bar row (no extra row)');
  await ph.click('.quickbar-all');
  await ph.waitForSelector('.quickbar-grid .cell');
  const inDialog = await ph.$$eval('.quickbar-grid .cell', (els) => els.map((e) => e.getAttribute('aria-label')).filter(Boolean));
  check(inDialog.length === quick.length && quick.every((w, i) => inDialog[i] === w), `phone: the dialog lists every quick word in the same order (${inDialog.join(', ')})`);
  await ph.click(`.quickbar-grid .cell[aria-label="${inDialog[0]}"]`); // "Hey!" only speaks; use a word that goes in the message
  check(!(await ph.isVisible('.quickbar-grid')) && (await ph.$$('.msg-word')).length === 1, 'phone: choosing a word from the dialog adds it and closes the dialog');
  const clipped = await ph.$$eval('.grid .cell-label', (els) => els.filter((l) => l.scrollWidth > l.clientWidth + 1).length);
  check(clipped === 0, `phone: no board label is cut off sideways (${clipped})`);
  // Feelings scale: speaks only the size the person chose.
  await ph.click('.navbtn[aria-label="Tools"]');
  await ph.click('.tool-tile[aria-label="How big?"]');
  check((await ph.$$('.scale-btn.intensity')).length === 5 && (await ph.$$('.scale-meter')).length === 5, 'feelings scale: five levels, each with a size meter');
  check(await ph.isVisible('text=Not sure'), 'feelings scale: "Not sure" is offered');
  await ctx.close();
}

console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'No page errors');
await browser.close();
process.exit(failures || errors.length ? 1 : 0);
