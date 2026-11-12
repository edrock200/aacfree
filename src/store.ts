import { create } from 'zustand';
import type { AACButton, AppData, LayoutId, MessageWord, Profile, Settings, SymbolLibrary } from './types';
import { buildProfile } from './data/defaults';
import { addSnapshot, clearLog, gcAssets, getMeta, getRev, loadData, logUsage, requestPersistence, saveDataChecked, setMeta } from './lib/db';
import { cleanLibrary, repairProfile } from './lib/validate';
import { debounce, uid } from './lib/util';
import { joinWords } from './lib/sentence';
import { speak, stopSpeaking } from './lib/tts';
import { applyEnding } from './lib/morphology';
import { getLang, pack, setLangs, type Lang } from './i18n';
import { translateProfile } from './lib/translate';
import { t, ts } from './i18n';

export const DATA_VERSION = 1;

export type Screen = 'talk' | 'keyboard' | 'phrases' | 'tools' | 'grownup';

export interface PickedItem { label: string; symbol?: string }

interface UIState {
  timer: { total: number; left: number; endAt: number | null };
  firstThen: { first: PickedItem | null; then: PickedItem | null; firstDone: boolean };
  choices: { items: PickedItem[]; offering: boolean; chosen: number | null };
  loaded: boolean;
  data: AppData;
  screen: Screen;
  boardStack: string[];
  message: MessageWord[];
  /** Word being typed on the keyboard (not yet committed). */
  draft: string;
  unlocked: boolean;
  editMode: boolean;
  /** Undo stack of previous profile states (edit mode). */
  undo: UndoEntry[];
  toast: string | null;
  /** Saving keeps failing (e.g. storage full) — shown as a persistent banner. */
  saveError: boolean;
  toastAction: { label: string; run: () => void } | null;
  /** Word id whose forms popover is open. */
  formsFor: { index: number } | null;
  /** Button ids to highlight (Find word / modelling). */
  highlight: string[];
}

interface Actions {
  init: () => Promise<void>;
  profile: () => Profile;
  settings: () => Settings;
  setScreen: (s: Screen) => void;
  /** `shallow`: fn only replaces top-level fields (fast path, no deep clone). */
  updateProfile: (fn: (p: Profile) => void, opts?: { undoable?: boolean; shallow?: boolean }) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** `undo`: show an Undo toast with this message (and snapshot first) — used for deletions. */
  updateLibrary: (fn: (lib: SymbolLibrary) => void, opts?: { undo?: string }) => void;
  undoEdit: () => void;
  replaceData: (data: AppData, reason?: string) => Promise<void>;
  completeOnboarding: (name: string, layout: LayoutId, patch?: Partial<Settings>) => void;
  /** Switch language: translates the boards in place (positions never change). */
  setLanguage: (lang: Lang) => void;
  addProfile: (name: string, layout: LayoutId) => void;
  switchProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  // navigation
  openBoard: (id: string) => void;
  back: () => void;
  home: () => void;
  // message
  pressButton: (b: AACButton) => void;
  addWord: (w: Omit<MessageWord, 'id'>) => void;
  addText: (text: string) => void;
  setDraft: (d: string) => void;
  commitDraft: () => void;
  backspace: () => void;
  clearMessage: () => void;
  replaceWord: (index: number, text: string) => void;
  removeWord: (index: number) => void;
  applyEnding: (e: 's' | 'ing' | 'ed') => void;
  speakMessage: () => void;
  speakText: (text: string, opts?: { audio?: string; log?: 'word' | 'phrase' | 'sentence' }) => void;
  setUnlocked: (v: boolean) => void;
  /** Lock grown-up mode and return the person to their Home board. */
  lock: () => void;
  tool: string | null;
  setTool: (t: string | null) => void;
  /** A partner is modelling: taps are tagged in the log and don't train prediction. */
  modeling: boolean;
  setModeling: (v: boolean) => void;
  /** Visual timer keeps running when you leave the Timer tool. */
  timer: { total: number; left: number; endAt: number | null };
  setTimer: (t: Partial<UIState['timer']>) => void;
  firstThen: { first: PickedItem | null; then: PickedItem | null; firstDone: boolean };
  setFirstThen: (p: Partial<UIState['firstThen']>) => void;
  choices: { items: PickedItem[]; offering: boolean; chosen: number | null };
  setChoices: (p: Partial<UIState['choices']>) => void;
  setEditMode: (v: boolean) => void;
  showToast: (msg: string, action?: { label: string; run: () => void }) => void;
  setFormsFor: (v: { index: number } | null) => void;
  setHighlight: (ids: string[]) => void;
}

export type Store = UIState & Actions;

/** Undo restores vocabulary only — never settings, PINs, phrases or history. */
interface UndoEntry {
  profileId: string;
  boards: Profile['boards'];
  quickBar: Profile['quickBar'];
  rootId: string;
  layout: Profile['layout'];
}

/** Replace whole words with their pronunciation fixes (case-insensitive). */
export function applyPronunciations(text: string, map?: Record<string, string>): string {
  if (!map) return text;
  let out = text;
  for (const [word, say] of Object.entries(map)) {
    if (!word.trim() || !say.trim()) continue;
    const esc = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}'])${esc}(?=$|[^\\p{L}\\p{N}'])`, 'giu'), (_m, pre) => pre + say);
  }
  return out;
}

export const emptyLibrary = (): SymbolLibrary => ({ categories: [], additions: {} });

function emptyData(): AppData {
  const p = buildProfile('', 'medium');
  return { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: false, library: emptyLibrary() };
}

let saveBlocked = false;
/** Revision of the data we last loaded/saved (detects writes from other tabs). */
let rev = 0;
let dirty = false;
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('caleb-data') : null;

async function doSave(data: AppData, attempt = 0): Promise<void> {
  if (saveBlocked) return;
  try {
    const next = await saveDataChecked(data, rev);
    if (next === null) {
      // Another window saved newer data: never overwrite it. Load theirs instead.
      dirty = false;
      await reloadFromDisk();
      useStore.getState().showToast(t('Caleb was changed in another window. Showing the latest version.'));
      return;
    }
    rev = next;
    if (useStore.getState().data === data) dirty = false;
    channel?.postMessage({ rev });
    if (useStore.getState().saveError) useStore.setState({ saveError: false });
  } catch (e) {
    console.error('save failed', e);
    if (attempt < 2) {
      setTimeout(() => doSave(useStore.getState().data, attempt + 1), 1000 * (attempt + 1));
    } else {
      useStore.setState({ saveError: true });
    }
  }
}

async function reloadFromDisk() {
  const fresh = await loadData();
  rev = await getRev();
  if (!fresh?.profiles?.length) return;
  const d = migrate(fresh);
  const st = useStore.getState();
  const p = d.profiles.find((x) => x.id === st.data.activeProfileId) ?? d.profiles[0];
  const stack = st.boardStack.filter((id) => p.boards[id]);
  useStore.setState({ data: { ...d, activeProfileId: p.id }, boardStack: stack.length ? stack : [p.rootId], undo: [] });
}

channel?.addEventListener('message', (e: MessageEvent<{ rev: number }>) => {
  // Another window saved. If we have no unsaved edits, pick up its data.
  if (!dirty && e.data?.rev !== rev) reloadFromDisk().catch(() => {});
});

const persistDebounced = debounce((data: AppData) => { doSave(data); }, 400);
const persist = Object.assign((data: AppData) => { dirty = true; persistDebounced(data); }, {
  flush: (data: AppData) => { dirty = true; persistDebounced.flush(data); },
});

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<Store>((set, get) => ({
  loaded: false,
  data: emptyData(),
  screen: 'talk',
  boardStack: ['home'],
  message: [],
  draft: '',
  unlocked: false,
  editMode: false,
  undo: [],
  toast: null,
  toastAction: null,
  saveError: false,
  formsFor: null,
  highlight: [],

  async init() {
    requestPersistence();
    let data: AppData | undefined;
    try {
      data = await loadData();
    } catch {
      // Retry once; if storage still can't be read, run from memory WITHOUT overwriting saved data.
      try { data = await loadData(); } catch (e) {
        console.error('Could not read saved data', e);
        saveBlocked = true;
        data = emptyData();
        data.onboarded = true;
        setTimeout(() => get().showToast(t('Could not open saved boards. Changes will not be saved. Please restart Caleb.')), 500);
      }
    }
    try { rev = await getRev(); } catch { /* fresh */ }
    let repaired: AppData | null = null;
    if (data?.profiles?.length) {
      try { repaired = migrate(data); } catch (e) { console.error('Saved data could not be repaired', e); }
    }
    if (!repaired) {
      data = { ...emptyData(), library: data?.library ? cleanLibrary(data.library) : emptyLibrary() };
      doSave(data);
    } else {
      data = repaired;
      // Automatic daily snapshot (versioned backup). Runs in the background: never blocks talking.
      const snapData = data;
      setTimeout(async () => {
        try {
          const last = (await getMeta<number>('lastSnapshot')) ?? 0;
          if (Date.now() - last > 20 * 3600 * 1000) {
            await addSnapshot(snapData, 'Automatic daily backup');
            await setMeta('lastSnapshot', Date.now());
            const { referencedAssets } = await import('./lib/backup');
            await gcAssets(referencedAssets(useStore.getState().data), referencedAssets);
          }
          // Weekly automatic backup file (if enabled and a destination exists).
          const { runAutoBackup } = await import('./lib/autobackup');
          await runAutoBackup(useStore.getState().data); // checks the family's backup settings
        } catch (e) {
          console.warn('Snapshot failed', e);
        }
      }, 1500);
    }
    const p = data.profiles.find((x) => x.id === data!.activeProfileId) ?? data.profiles[0];
    set({ data: { ...data, activeProfileId: p.id }, loaded: true, boardStack: [p.rootId] });
  },

  profile() {
    const { data } = get();
    return data.profiles.find((p) => p.id === data.activeProfileId) ?? data.profiles[0];
  },
  settings() {
    return get().profile().settings;
  },

  setScreen(screen) {
    set({ screen, formsFor: null });
  },

  updateProfile(fn, opts = {}) {
    const { data } = get();
    const current = get().profile();
    const next = opts.shallow ? { ...current } : structuredClone(current);
    fn(next);
    next.updatedAt = Date.now();
    const profiles = data.profiles.map((p) => (p.id === current.id ? next : p));
    const newData = { ...data, profiles };
    const entry: UndoEntry = { profileId: current.id, boards: current.boards, quickBar: current.quickBar, rootId: current.rootId, layout: current.layout };
    const undo = opts.undoable ? [...get().undo.slice(-29), entry] : get().undo;
    set({ data: newData, undo });
    persist(newData);
  },

  updateSettings(patch) {
    get().updateProfile((p) => {
      p.settings = { ...p.settings, ...patch };
    }, { shallow: true });
  },

  updateLibrary(fn, opts = {}) {
    const { data } = get();
    const prev = data.library ?? emptyLibrary();
    const library = structuredClone(prev);
    fn(library);
    const newData = { ...data, library };
    set({ data: newData });
    persist(newData);
    if (opts.undo) {
      addSnapshot(data, 'Before deleting from the symbol library').catch(() => {});
      get().showToast(opts.undo, {
        label: 'Undo',
        run: () => {
          const d = { ...get().data, library: prev };
          set({ data: d });
          persist(d);
        },
      });
    }
  },

  undoEdit() {
    const { undo, data } = get();
    const prev = undo[undo.length - 1];
    if (!prev) return;
    const profiles = data.profiles.map((p) => (p.id === prev.profileId
      ? { ...p, boards: prev.boards, quickBar: prev.quickBar, rootId: prev.rootId, layout: prev.layout }
      : p));
    const newData = { ...data, profiles };
    const root = profiles.find((p) => p.id === prev.profileId)!.rootId;
    const boardStack = get().boardStack.filter((id) => newData.profiles.find((p) => p.id === prev.profileId)!.boards[id]);
    set({ data: newData, undo: undo.slice(0, -1), boardStack: boardStack.length ? boardStack : [root] });
    persist(newData);
    get().showToast(t('Undone'));
  },

  async replaceData(newData, reason = 'Before restore') {
    const d = migrate(structuredClone(newData)); // validates first: throws on a bad file
    d.onboarded = true;
    await addSnapshot(get().data, reason);
    const p = d.profiles.find((x) => x.id === d.activeProfileId) ?? d.profiles[0];
    d.activeProfileId = p.id;
    set({ data: d, boardStack: [p.rootId], message: [], undo: [] });
    persist.flush(d);
  },

  setLanguage(lang) {
    const cur = get().profile();
    if ((cur.settings.language ?? 'en') === lang) return;
    addSnapshot(get().data, 'Before changing language').catch(() => {});
    get().updateProfile((p) => {
      const tr = translateProfile(p, lang);
      Object.assign(p, tr);
    }, { undoable: true });
    const ui = get().settings().uiLanguage;
    setLangs(ui && ui !== 'auto' ? ui : lang, lang);
  },

  completeOnboarding(name, layout, patch = {}) {
    const p = buildProfile(name, layout, patch.language ?? 'en');
    p.settings = { ...p.settings, ...patch };
    const data: AppData = { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: true, library: get().data.library ?? emptyLibrary() };
    set({ data, boardStack: [p.rootId], message: [] });
    persist.flush(data);
  },

  addProfile(name, layout) {
    const p = buildProfile(name, layout, get().settings().language ?? 'en');
    const { data } = get();
    const newData = { ...data, profiles: [...data.profiles, p], activeProfileId: p.id };
    set({ data: newData, boardStack: [p.rootId], message: [], undo: [] });
    persist(newData);
  },

  switchProfile(id) {
    const { data } = get();
    const p = data.profiles.find((x) => x.id === id);
    if (!p) return;
    const newData = { ...data, activeProfileId: id };
    set({ data: newData, boardStack: [p.rootId], message: [], undo: [] });
    persist(newData);
  },

  deleteProfile(id) {
    const { data } = get();
    if (data.profiles.length <= 1) return;
    addSnapshot(data, 'Before deleting a profile');
    const profiles = data.profiles.filter((p) => p.id !== id);
    const activeProfileId = data.activeProfileId === id ? profiles[0].id : data.activeProfileId;
    const newData = { ...data, profiles, activeProfileId };
    set({ data: newData, boardStack: [profiles.find((p) => p.id === activeProfileId)!.rootId], undo: [] });
    clearLog(id).catch(() => {});
    persist(newData);
  },

  openBoard(id) {
    if (!get().profile().boards[id]) return;
    set((s) => ({ boardStack: [...s.boardStack, id], screen: 'talk' }));
  },
  back() {
    set((s) => ({ boardStack: s.boardStack.length > 1 ? s.boardStack.slice(0, -1) : s.boardStack }));
  },
  home() {
    set({ boardStack: [get().profile().rootId], screen: 'talk' });
  },

  pressButton(b) {
    const s = get().settings();
    if (b.link) {
      if (s.speakFolders) get().speakText(b.label);
      get().openBoard(b.link);
      return;
    }
    switch (b.action) {
      case 'keyboard': return get().setScreen('keyboard');
      case 'phrases': return get().setScreen('phrases');
      case 'tools': return get().setScreen('tools');
      case 'home': return get().home();
      case 'back': return get().back();
      case 'speak': return get().speakMessage();
      case 'clear': return get().clearMessage();
      case 'backspace': return get().backspace();
      case 'morph-s': return get().applyEnding('s');
      case 'morph-ing': return get().applyEnding('ing');
      case 'morph-ed': return get().applyEnding('ed');
      case 'forms': {
        const n = get().message.length;
        if (n) set({ formsFor: { index: n - 1 } });
        else get().showToast(t('Pick a word first, then tap Word forms'));
        return;
      }
      default: break;
    }
    let text = b.speak ?? b.label;
    let base: string | undefined;
    // Spanish: conjugate a verb after a subject pronoun (yo + querer → quiero; yo + gustar → me gusta).
    const conj = pack().autoConjugate;
    if (conj && getLang() !== 'en' && s.autoConjugate && b.type === 'verb' && !b.speakOnly) {
      const prev = get().message.map((w) => w.text);
      const c = conj(prev, text);
      if (c) {
        if (c.dropPrevious) set((st) => ({ message: st.message.slice(0, -c.dropPrevious) }));
        base = text;
        text = c.text;
      }
    }
    if (b.speakOnly) {
      get().speakText(text, { audio: b.audio, log: 'word' });
      return;
    }
    get().addWord({ text, base, symbol: b.symbol, type: b.type, audio: base ? undefined : b.audio });
    if (s.speakOnTap) get().speakText(text, { audio: b.audio });
    if (s.logging) logUsage({ profileId: get().profile().id, kind: 'word', text, modeled: get().modeling || undefined });
    // Auto-return to the home board after choosing a word inside a folder.
    const stack = get().boardStack;
    if (s.returnHome && stack.length > 1 && !get().editMode) {
      set({ boardStack: [stack[0]] });
    }
  },

  addWord(w) {
    set((s) => ({ message: [...s.message, { ...w, id: uid('w') }], formsFor: null }));
  },

  addText(text) {
    // Always capitalise the pronoun "I" (and I'm, I'll, I've, I'd).
    const words = text.split(/\s+/).filter(Boolean).map((w) => (/^i('(m|ll|ve|d))?$/i.test(w) ? 'I' + w.slice(1) : w));
    set((s) => ({ message: [...s.message, ...words.map((t) => ({ id: uid('w'), text: t }))] }));
  },

  setDraft(draft) {
    set({ draft });
  },
  commitDraft() {
    const d = get().draft.trim();
    if (d) get().addText(d);
    set({ draft: '' });
  },
  backspace() {
    if (get().draft) return set((s) => ({ draft: s.draft.slice(0, -1) }));
    set((s) => ({ message: s.message.slice(0, -1), formsFor: null }));
  },
  clearMessage() {
    stopSpeaking();
    const { message, draft } = get();
    set({ message: [], draft: '', formsFor: null });
    if (message.length > 1) {
      get().showToast(t('Message cleared'), { label: 'Undo', run: () => set({ message, draft }) });
    }
  },
  replaceWord(index, text) {
    set((s) => ({
      message: s.message.map((w, i) => (i === index ? { ...w, text, audio: undefined } : w)),
      formsFor: null,
    }));
    const s = get().settings();
    if (s.speakOnTap) get().speakText(text);
  },
  removeWord(index) {
    set((s) => ({ message: s.message.filter((_, i) => i !== index), formsFor: null }));
  },
  applyEnding(e) {
    const msg = get().message;
    if (!msg.length) return;
    const last = msg[msg.length - 1];
    get().replaceWord(msg.length - 1, applyEnding(last.text, e, last.type));
  },

  speakMessage() {
    get().commitDraft();
    const { message } = get();
    if (!message.length) return;
    const s = get().settings();
    const text = joinWords(message);
    // Single word with a recorded clip → play that clip.
    const audio = message.length === 1 ? message[0].audio : undefined;
    get().speakText(text, { audio, log: 'sentence' });
    get().updateProfile((p) => {
      if (p.history[0]?.text !== text) p.history = [{ text, t: Date.now() }, ...p.history].slice(0, 100);
      if (s.learnWords && !get().modeling) {
        const lexicon = { ...p.lexicon };
        for (const w of text.toLowerCase().match(/[a-z']+/g) ?? []) lexicon[w] = (lexicon[w] ?? 0) + 1;
        p.lexicon = lexicon;
      }
    }, { shallow: true });
    if (s.clearAfterSpeak) set({ message: [], draft: '' });
  },

  speakText(text, opts = {}) {
    const s = get().settings();
    speak(applyPronunciations(text, s.pronunciations), s, { audio: opts.audio });
    if (opts.log && s.logging) logUsage({ profileId: get().profile().id, kind: opts.log, text, modeled: get().modeling || undefined });
  },

  setUnlocked(v) {
    set({ unlocked: v, editMode: v ? get().editMode : false });
  },
  lock() {
    set({ unlocked: false, editMode: false, screen: 'talk', boardStack: [get().profile().rootId], formsFor: null });
  },
  tool: null,
  setTool(tool) {
    set({ tool });
  },
  modeling: false,
  setModeling(modeling) {
    set({ modeling });
  },
  timer: { total: 300, left: 300, endAt: null },
  setTimer(t) {
    set((st) => ({ timer: { ...st.timer, ...t } }));
  },
  firstThen: { first: null, then: null, firstDone: false },
  setFirstThen(p) {
    set((st) => ({ firstThen: { ...st.firstThen, ...p } }));
  },
  choices: { items: [], offering: false, chosen: null },
  setChoices(p) {
    set((st) => ({ choices: { ...st.choices, ...p } }));
  },
  setEditMode(v) {
    set({ editMode: v, screen: v ? 'talk' : get().screen });
  },
  showToast(msg, action) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg, toastAction: action ?? null });
    toastTimer = setTimeout(() => set({ toast: null, toastAction: null }), action ? 5000 : 2200);
  },
  setFormsFor(v) {
    set({ formsFor: v });
  },
  setHighlight(ids) {
    set({ highlight: ids });
  },
}));

// Timer tick lives outside any component so it keeps running (and alarms) on every screen.
if (typeof window !== 'undefined') {
  setInterval(() => {
    const { timer } = useStore.getState();
    if (!timer.endAt) return;
    const left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
    if (left !== timer.left) useStore.setState({ timer: { ...timer, left } });
    if (left === 0) {
      useStore.setState({ timer: { ...timer, left: 0, endAt: null } });
      import('./lib/feedback').then(({ alarm }) => alarm());
      setTimeout(() => useStore.getState().speakText(ts('Time is up! All done.')), 1800);
    }
  }, 250);
}

// Never lose the last edit when the app is backgrounded or closed.
if (typeof document !== 'undefined') {
  const flush = () => {
    const st = useStore.getState();
    if (st.loaded && dirty) persistDebounced.flush(st.data);
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);
}

/** Upgrades older saved data to the current shape. */
export function migrate(data: AppData): AppData {
  if (!data || typeof data !== 'object' || !Array.isArray(data.profiles)) throw new Error('This file has no Caleb profiles.');
  if (typeof data.version === 'number' && data.version > DATA_VERSION) {
    throw new Error('This file was made by a newer version of Caleb. Please update the app first.');
  }
  const fresh = buildProfile('', 'medium');
  data.profiles = data.profiles.map(repairProfile).filter((p): p is Profile => !!p);
  if (!data.profiles.length) throw new Error('This file has no usable boards.');
  for (const p of data.profiles) {
    p.settings = { ...fresh.settings, ...p.settings };
    p.lexicon ??= {};
    p.history ??= [];
    p.phrases ??= [];
    p.phraseCategories ??= fresh.phraseCategories;
    p.schedules ??= [];
    p.quickBar ??= fresh.quickBar;
    p.aboutMe ??= fresh.aboutMe;
    if (!Array.isArray(p.history)) p.history = [];
    if (!Array.isArray(p.phrases)) p.phrases = [];
    if (!Array.isArray(p.schedules)) p.schedules = [];
    if (typeof p.lexicon !== 'object') p.lexicon = {};
    // A PIN lock without a PIN would lock grown-ups out for good.
    if (p.settings.lock === 'pin' && !/^\d{4,6}$/.test(p.settings.pin ?? '')) p.settings.lock = 'hold';
    p.createdAt = typeof p.createdAt === 'number' ? p.createdAt : Date.now();
  }
  if (!data.profiles.some((p) => p.id === data.activeProfileId)) data.activeProfileId = data.profiles[0].id;
  data.onboarded = data.onboarded !== false;
  data.library = cleanLibrary(data.library);
  data.version = DATA_VERSION;
  return data;
}

export const useProfile = () => useStore((s) => s.data.profiles.find((p) => p.id === s.data.activeProfileId) ?? s.data.profiles[0]);
export const useSettings = () => useProfile().settings;
