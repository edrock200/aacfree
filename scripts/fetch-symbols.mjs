#!/usr/bin/env node
/**
 * Resolves every symbol keyword in src/data/vocab.ts to an ARASAAC pictogram,
 * downloads it, converts to a small WebP in public/symbols/, and writes
 * src/data/symbols.json ({ keyword: id }).
 *
 * ARASAAC pictograms: Sergio Palao, Government of Aragón, CC BY-NC-SA 4.0.
 *
 * Usage: node scripts/fetch-symbols.mjs [--force]
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { allKeywords, CATEGORIES, HOME_LAYOUTS, QUICK_BAR, parseSpec } from '../src/data/vocab.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'symbols');
const mapFile = join(root, 'src', 'data', 'symbols.json');
const overridesFile = join(root, 'scripts', 'symbol-overrides.json');
const force = process.argv.includes('--force');
const API = 'https://api.arasaac.org/v1/pictograms/en';

await mkdir(outDir, { recursive: true });
let map = {};
try { map = JSON.parse(await readFile(mapFile, 'utf8')); } catch { /* new */ }
let overrides = {};
try { overrides = JSON.parse(await readFile(overridesFile, 'utf8')); } catch { /* none */ }

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  return null;
}

async function resolve(keyword) {
  if (overrides[keyword] !== undefined) return overrides[keyword];
  const enc = encodeURIComponent(keyword);
  let res = await getJson(`${API}/bestsearch/${enc}`);
  if (!res || !res.length) res = await getJson(`${API}/search/${enc}`);
  // ARASAAC returns unrelated "fallback" pictograms for unknown phrases.
  const JUNK = new Set([39109, 36530, 35829, 35637, 35389, 34741]);
  res = (res ?? []).filter((p) => !JUNK.has(p._id));
  if (!res.length) return null;
  // Prefer an exact keyword match, then a non-schematic one.
  const exact = res.find((p) => p.keywords?.some((k) => k.keyword?.toLowerCase() === keyword));
  return (exact ?? res[0])._id;
}

async function download(id) {
  const file = join(outDir, `${id}.webp`);
  if (!force && (await exists(file))) return true;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://static.arasaac.org/pictograms/${id}/${id}_300.png`);
      if (!r.ok) throw new Error(String(r.status));
      const buf = Buffer.from(await r.arrayBuffer());
      await sharp(buf).resize(200, 200, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 78, alphaQuality: 80, effort: 5 }).toFile(file);
      return true;
    } catch { await new Promise((res) => setTimeout(res, 600 * (i + 1))); }
  }
  return false;
}

const keywords = allKeywords();
const explicitIds = new Set();
const collect = (spec) => { if (spec && !spec.startsWith('>') && !spec.startsWith('!')) { const p = parseSpec(spec); if (p.id) explicitIds.add(p.id); } };
CATEGORIES.forEach((c) => c.items.forEach(collect));
Object.values(HOME_LAYOUTS).forEach((l) => l.cells.forEach(collect));
QUICK_BAR.forEach(collect);

console.log(`Resolving ${keywords.length} keywords…`);
const queue = keywords.filter((k) => force || map[k] === undefined || overrides[k] !== undefined);
let done = 0;
async function worker() {
  while (queue.length) {
    const k = queue.shift();
    map[k] = await resolve(k);
    if (++done % 50 === 0) console.log(`  ${done} resolved`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const missing = keywords.filter((k) => map[k] == null);
if (missing.length) console.log(`No symbol for: ${missing.join(', ')}`);

const ids = new Set([...Object.values(map).filter((v) => v != null), ...explicitIds]);
console.log(`Downloading ${ids.size} pictograms…`);
const idq = [...ids];
let failed = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (idq.length) { const id = idq.shift(); if (!(await download(id))) failed++; }
}));

const sorted = Object.fromEntries(Object.entries(map).filter(([k]) => keywords.includes(k)).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(mapFile, JSON.stringify(sorted, null, 0).replace(/,"/g, ',\n"') + '\n');
console.log(`Done. ${failed} downloads failed.`);
