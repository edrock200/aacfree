import type { LibraryCategory, LibrarySymbol, SymbolLibrary } from '../types';
import { builtInLibrary, searchBundled, symbolFor } from '../data/defaults';
import { getLang } from '../i18n';
import { englishMatches, fold, localCategory, localLabel } from './translate';

export interface ViewCategory extends LibraryCategory {
  /** Built-in categories can't be renamed or deleted (but the family can add symbols to them). */
  builtIn: boolean;
  /** Ids of symbols the family added (editable / removable). */
  customIds: Set<string>;
}

/** All categories: family-made first, then built-in ones (with the family's additions). */
export function allCategories(lib: SymbolLibrary | undefined): ViewCategory[] {
  const l = lib ?? { categories: [], additions: {} };
  const custom: ViewCategory[] = l.categories.map((c) => ({ ...c, builtIn: false, customIds: new Set(c.symbols.map((s) => s.id)) }));
  const lang = getLang();
  const builtIn: ViewCategory[] = builtInLibrary().map((c) => {
    const extra = l.additions[c.id] ?? [];
    const own = lang === 'en' ? c.symbols : c.symbols.map((s) => ({ ...s, label: localLabel(s.label, lang) }));
    return { ...c, name: localCategory(c.id, c.name, lang), symbols: [...extra, ...own], builtIn: true, customIds: new Set(extra.map((s) => s.id)) };
  });
  // Additions whose built-in category no longer exists (e.g. renamed in an update) stay visible.
  const known = new Set(builtIn.map((c) => c.id));
  const orphans = Object.entries(l.additions).filter(([k]) => !known.has(k) && k !== ORPHANS_ID).flatMap(([, v]) => v);
  const own = l.additions[ORPHANS_ID] ?? [];
  if (orphans.length || own.length) {
    const symbols = [...own, ...orphans];
    custom.push({ id: ORPHANS_ID, name: localCategory(ORPHANS_ID, 'My extra symbols', getLang()), symbols, builtIn: true, customIds: new Set(symbols.map((s) => s.id)) });
  }
  return [...custom, ...builtIn];
}

const ORPHANS_ID = 'lib-extra';

/** Search every category plus the whole bundled symbol index (accent-insensitive: "cafe" finds "café"). */
export function searchLibrary(lib: SymbolLibrary | undefined, query: string, limit = 80): LibrarySymbol[] {
  const q = fold(query.trim());
  if (!q) return [];
  const out: LibrarySymbol[] = [];
  const seen = new Set<string>();
  const add = (s: LibrarySymbol) => {
    const k = s.symbol + '|' + s.label.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };
  const cats = allCategories(lib);
  // Family symbols first, exact then partial matches.
  // Very short queries ("I", "go") only match whole words or word starts.
  for (const pass of q.length >= 3 ? [0, 1, 2] : [0, 1]) {
    for (const c of cats) for (const s of c.symbols) {
      const label = fold(s.label);
      const hit = pass === 0 ? label === q : pass === 1 ? label.startsWith(q) : label.includes(q);
      if (hit) add(s);
    }
  }
  const lang = getLang();
  if (lang !== 'en') {
    // The bundled index is keyed by English words: reach it through the language pack's words.
    for (const m of englishMatches(query, lang, limit)) {
      const symbol = symbolFor(m.en);
      if (symbol) add({ id: symbol, label: m.label, symbol });
    }
    return out.slice(0, limit);
  }
  for (const r of searchBundled(q, limit)) {
    if (q.length < 3 && !r.keyword.startsWith(q)) continue;
    add({ id: r.symbol, label: r.keyword, symbol: r.symbol });
  }
  return out.slice(0, limit);
}
