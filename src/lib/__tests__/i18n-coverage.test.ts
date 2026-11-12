import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PACKS } from '../../i18n/packs';

/** Every literal t('…') / ts('…') / tIn(lang, '…') in src must have a translation in every non-English pack. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' || f === 'i18n' ? [] : sources(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

function literalKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const re = /\b(?:t|ts|tIn\([^,()]+,)\(?\s*(['"])((?:\\.|(?!\1).)*?)\1\s*[,)]/g;
  for (const file of sources(join(__dirname, '..', '..'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(re)) {
      const raw = m[2];
      const key = raw.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');
      if (key.trim()) keys.set(key, file.replace(/.*\/src\//, 'src/'));
    }
  }
  return keys;
}

describe('UI translations', () => {
  const keys = literalKeys();
  it('finds the wrapped strings', () => expect(keys.size).toBeGreaterThan(300));
  for (const id of ['es', 'fr', 'pt'] as const) {
    it(`${id} has every wrapped string`, () => {
      const ui = PACKS[id].ui;
      const missing = [...keys].filter(([k]) => !(k in ui)).map(([k, f]) => `${f}: ${k}`);
      expect(missing).toEqual([]);
    });
  }
});
