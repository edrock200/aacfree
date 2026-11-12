import type { LibraryCategory, LibrarySymbol, SymbolLibrary } from '../types';
import { builtInLibrary, searchBundled } from '../data/defaults';

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
  const builtIn: ViewCategory[] = builtInLibrary().map((c) => {
    const extra = l.additions[c.id] ?? [];
    return { ...c, symbols: [...extra, ...c.symbols], builtIn: true, customIds: new Set(extra.map((s) => s.id)) };
  });
  return [...custom, ...builtIn];
}

/** Search every category plus the whole bundled symbol index. */
export function searchLibrary(lib: SymbolLibrary | undefined, query: string, limit = 80): LibrarySymbol[] {
  const q = query.trim().toLowerCase();
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
      const label = s.label.toLowerCase();
      const hit = pass === 0 ? label === q : pass === 1 ? label.startsWith(q) : label.includes(q);
      if (hit) add(s);
    }
  }
  for (const r of searchBundled(q, limit)) {
    if (q.length < 3 && !r.keyword.startsWith(q)) continue;
    add({ id: r.symbol, label: r.keyword, symbol: r.symbol });
  }
  return out.slice(0, limit);
}
