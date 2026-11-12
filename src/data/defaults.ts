import type { AACButton, Board, Cell, LayoutId, Profile, Settings, WordType } from '../types';
import { uid } from '../lib/util';
import symbolMap from './symbols.json';
import {
  CATEGORIES, DEFAULT_PHRASES, DEFAULT_SCHEDULES, HOME_LAYOUTS, MORE_BOARD, PHRASE_CATEGORIES,
  QUICK_BAR, parseSpec,
} from './vocab';

const SYMBOLS = symbolMap as Record<string, number | null>;

export function symbolFor(keyword: string): string | undefined {
  const id = SYMBOLS[keyword.toLowerCase()];
  return id ? `a:${id}` : undefined;
}

export const DEFAULT_SETTINGS: Settings = {
  rate: 1,
  pitch: 1,
  volume: 1,
  lang: 'en-US',
  speakOnTap: true,
  speakFolders: false,
  clearAfterSpeak: false,
  returnHome: true,
  theme: 'light',
  style: 'playful',
  colorMode: 'fill',
  showLabels: true,
  labelTop: false,
  textCase: 'as-is',
  fontScale: 1,
  gap: 6,
  showQuickBar: true,
  showSymbolsInBar: true,
  reduceMotion: false,
  keepAwake: false,
  babble: false,
  showKeyboardNav: true,
  showPhrasesNav: true,
  showToolsNav: true,
  holdMs: 0,
  debounceMs: 0,
  pressOnDown: false,
  clickSound: false,
  haptics: true,
  scanning: false,
  scanMode: 'auto',
  scanPattern: 'row-col',
  scanMs: 1500,
  scanSpeak: true,
  keyboardLayout: 'qwerty',
  learnWords: false,
  lock: 'hold',
  logging: false,
};

const ACTIONS: Record<string, Partial<AACButton>> = {
  keyboard: { label: 'Keyboard', action: 'keyboard', symbol: '' },
  phrases: { label: 'Phrases', action: 'phrases', symbol: '' },
  tools: { label: 'Tools', action: 'tools', symbol: '' },
  morph: { label: 'Word forms', action: 'forms', symbol: '' },
};

/** Builds a button from a vocab spec. */
export function buttonFromSpec(spec: string, defaultType: string, catNames: Record<string, { name: string; icon: string }>): Cell {
  if (!spec) return null;
  if (spec.startsWith('>')) {
    const id = spec.slice(1);
    const cat = catNames[id];
    if (!cat) return null;
    const p = parseSpec(cat.icon);
    return {
      id: uid('b'), label: cat.name, type: 'folder', link: id,
      symbol: p.emoji ? `e:${p.emoji}` : p.id ? `a:${p.id}` : symbolFor(p.keyword),
    };
  }
  if (spec.startsWith('!')) {
    const a = ACTIONS[spec.slice(1)];
    if (!a) return null;
    return { id: uid('b'), type: 'misc', label: a.label!, action: a.action, symbol: symbolFor(ACTION_ICONS[spec.slice(1)] ?? '') };
  }
  const p = parseSpec(spec, defaultType);
  const b: AACButton = {
    id: uid('b'),
    label: p.label,
    type: p.type as WordType,
    symbol: p.emoji ? `e:${p.emoji}` : p.id ? `a:${p.id}` : symbolFor(p.keyword),
  };
  if (p.speak && p.speak !== p.label) b.speak = p.speak;
  if (p.label === 'Hey!') b.speakOnly = true;
  return b;
}

const ACTION_ICONS: Record<string, string> = {
  keyboard: 'keyboard', phrases: 'phrase', tools: 'tools', morph: 'grammar',
};

function makeBoard(id: string, name: string, cols: number, specs: string[], defaultType: string,
  catNames: Record<string, { name: string; icon: string }>, minRows = 1, symbol?: string): Board {
  const rows = Math.max(minRows, Math.ceil(specs.length / cols));
  const cells: Cell[] = Array.from({ length: rows * cols }, (_, i) =>
    i < specs.length ? buttonFromSpec(specs[i], defaultType, catNames) : null);
  return { id, name, cols, rows, cells, symbol };
}

export function buildProfile(name: string, layout: LayoutId): Profile {
  const catNames: Record<string, { name: string; icon: string }> = {
    more: { name: 'More', icon: 'more' },
  };
  CATEGORIES.forEach((c) => (catNames[c.id] = { name: c.name, icon: c.icon }));

  const home = HOME_LAYOUTS[layout];
  const boards: Record<string, Board> = {};
  const homeBoard = makeBoard('home', 'Home', home.cols, home.cells, 'misc', catNames, home.rows);
  boards.home = homeBoard;

  // Category boards share the home board's column count where sensible.
  const catCols = layout === 'big' ? 4 : layout === 'medium' ? 6 : 8;
  for (const c of CATEGORIES) {
    boards[c.id] = makeBoard(c.id, c.name, catCols, c.items, c.type, catNames, 1, symbolFor(c.icon));
  }
  boards.more = makeBoard('more', 'More', catCols, MORE_BOARD, 'folder', catNames, 1, symbolFor('more'));

  // Make sure folders not reachable from home are reachable from "More".
  const quickBar = QUICK_BAR.map((s) => buttonFromSpec(s, 'misc', catNames)!).filter(Boolean);

  return {
    id: uid('p'),
    name,
    layout,
    boards,
    rootId: 'home',
    quickBar,
    phrases: DEFAULT_PHRASES.map((p) => ({
      id: uid('ph'), text: p.text, category: p.category, symbol: p.icon ? symbolFor(p.icon) : undefined,
    })),
    phraseCategories: [...PHRASE_CATEGORIES],
    schedules: DEFAULT_SCHEDULES.map((s) => ({
      id: uid('s'),
      name: s.name,
      steps: s.steps.map((spec) => {
        const p = parseSpec(spec);
        return { id: uid('st'), label: p.label, symbol: p.id ? `a:${p.id}` : symbolFor(p.keyword) };
      }),
    })),
    aboutMe: {
      enabled: true,
      text: `Hi! My name is ${name || '…'}. I am autistic and I use this app to communicate. Please be patient and give me extra time to answer. I understand more than I can say.`,
      contacts: '',
    },
    settings: { ...DEFAULT_SETTINGS },
    lexicon: {},
    history: [],
    createdAt: Date.now(),
  };
}

/** Search the bundled symbol index (offline). */
export function searchBundled(query: string, limit = 60): { keyword: string; symbol: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact: { keyword: string; symbol: string }[] = [];
  const starts: typeof exact = [];
  const contains: typeof exact = [];
  const seen = new Set<number>();
  for (const [k, id] of Object.entries(SYMBOLS)) {
    if (!id || seen.has(id)) continue;
    const item = { keyword: k, symbol: `a:${id}` };
    if (k === q) { exact.push(item); seen.add(id); }
    else if (k.startsWith(q)) { starts.push(item); seen.add(id); }
    else if (k.includes(q)) { contains.push(item); seen.add(id); }
  }
  return [...exact, ...starts, ...contains].slice(0, limit);
}
