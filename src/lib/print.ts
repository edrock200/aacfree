import { Capacitor } from '@capacitor/core';
import type { Profile } from '../types';
import { buttonColor } from './colors';
import { getAsset } from './db';
import { blobToDataURL } from './util';
import { saveFile } from './files';

/**
 * Printable paper boards: a low-tech backup for when the device is charging,
 * at the pool, or broken. Generates a self-contained HTML page.
 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function symbolData(ref?: string): Promise<string> {
  if (!ref) return '';
  if (ref.startsWith('e:')) return `<span class="e">${esc(ref.slice(2))}</span>`;
  try {
    let blob: Blob | undefined;
    if (ref.startsWith('a:')) blob = await (await fetch(`${import.meta.env.BASE_URL}symbols/${ref.slice(2)}.webp`)).blob();
    else if (ref.startsWith('img:')) blob = await getAsset(ref.slice(4));
    if (!blob) return '';
    return `<img src="${await blobToDataURL(blob)}" alt="">`;
  } catch {
    return '';
  }
}

export async function buildPrintHTML(p: Profile, boardIds: string[], includeHidden = false): Promise<string> {
  const cache = new Map<string, string>();
  const sym = async (ref?: string) => {
    if (!ref) return '';
    if (!cache.has(ref)) cache.set(ref, await symbolData(ref));
    return cache.get(ref)!;
  };
  const pages: string[] = [];
  const quick = await Promise.all(p.quickBar.map(async (b) =>
    `<div class="c" style="background:${buttonColor(b.type, false, b.color)}">${await sym(b.symbol)}<b>${esc(b.label)}</b></div>`));
  for (const id of boardIds) {
    const board = p.boards[id];
    if (!board) continue;
    const cells = await Promise.all(board.cells.map(async (b) => {
      if (!b || (b.hidden && !includeHidden)) return '<div class="c empty"></div>';
      const folder = b.link ? ` folder` : '';
      return `<div class="c${folder}" style="background:${buttonColor(b.type, false, b.color)}">${await sym(b.symbol)}<b>${esc(b.label)}</b></div>`;
    }));
    pages.push(`<section><h2>${esc(board.name)}</h2>
      <div class="q" style="grid-template-columns:repeat(${p.quickBar.length},1fr)">${quick.join('')}</div>
      <div class="g" style="grid-template-columns:repeat(${board.cols},1fr)">${cells.join('')}</div></section>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.name || 'Caleb')} — communication boards</title>
<style>
  @page { size: landscape; margin: 10mm; }
  body { font-family: 'Atkinson Hyperlegible', Arial, sans-serif; margin: 0; padding: 12px; color: #111; }
  .bar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
  .bar button { font: inherit; font-size: 16px; padding: 10px 18px; border-radius: 999px; border: 2px solid #1d7a6a; background: #1d7a6a; color: #fff; }
  section { page-break-after: always; break-after: page; }
  h2 { margin: 0 0 6px; font-size: 18px; }
  .q, .g { display: grid; gap: 4px; }
  .q { margin-bottom: 6px; }
  .q .c { height: 18mm; }
  .g .c { height: 30mm; }
  .c { border: 1px solid #999; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2px; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .c img { flex: 1; min-height: 0; max-width: 100%; object-fit: contain; }
  .c .e { font-size: 28px; }
  .c b { font-size: 12px; text-align: center; line-height: 1.1; }
  .c.empty { border: none; background: transparent !important; }
  .c.folder { border-top: 4px solid #8a7a5c; }
  .note { color: #666; font-size: 11px; margin-top: 8px; }
  @media print { .bar { display: none; } }
</style></head><body>
<div class="bar"><button onclick="window.print()">Print</button><span>Tip: print in colour, landscape. Laminate for durability.</span></div>
${pages.join('\n')}
<p class="note">Made with Caleb AAC. Pictograms: Sergio Palao, ARASAAC (Government of Aragón), CC BY-NC-SA 4.0.</p>
</body></html>`;
}

/** Opens the print view (web) or saves/shares the HTML file (Android). */
export async function printBoards(p: Profile, boardIds: string[]): Promise<string> {
  const html = await buildPrintHTML(p, boardIds);
  if (!Capacitor.isNativePlatform()) {
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      return 'Print view opened';
    }
  }
  return saveFile(`${(p.name || 'caleb').toLowerCase().replace(/\W+/g, '-')}-boards.html`, new Blob([html], { type: 'text/html' }));
}
