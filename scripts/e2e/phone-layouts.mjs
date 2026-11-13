import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2], out = process.argv[3];
const browser = await chromium.launch();
const report = [];
for (const [vw, vh] of [[320, 640], [360, 740], [412, 915]]) {
  for (let li = 0; li < 4; li++) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(url);
    await page.click('text=Next');
    const cards = page.locator('.layout-card');
    const name = (await cards.nth(li).innerText()).split('\n')[0];
    await cards.nth(li).click();
    await page.click('text=Next'); await page.click('text=Next');
    await page.click('text=Start talking');
    await page.waitForSelector('.grid .cell');
    const m = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.grid .cell')].filter((c) => c.getAttribute('aria-label'));
      let truncated = 0, minSym = 1e9, overlap = 0;
      for (const c of cells) {
        const l = c.querySelector('.cell-label');
        if (l && (l.scrollWidth > l.clientWidth + 1 || l.scrollHeight > l.clientHeight + 1)) truncated++;
        const s = c.querySelector('.sym');
        if (s) { const r = s.getBoundingClientRect(); minSym = Math.min(minSym, Math.min(r.width, r.height));
          if (l) { const lr = l.getBoundingClientRect(); if (lr.top < r.bottom - 2 && r.height > 0) overlap++; } }
      }
      const qb = document.querySelector('.quickbar');
      const all = document.querySelector('.quickbar-all');
      const page = document.documentElement;
      return { cells: cells.length, truncated, minSym: Math.round(minSym), overlap, qbOverflow: qb.scrollWidth > qb.clientWidth + 1, allBtn: !!all, hScroll: page.scrollWidth > page.clientWidth };
    });
    report.push({ vw, layout: name, ...m });
    await page.screenshot({ path: `${out}/${vw}-${li}.png` });
    await ctx.close();
  }
}
console.table(report);
await browser.close();
