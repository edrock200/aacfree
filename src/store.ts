import { create } from 'zustand';
import type { AACButton, AppData, GrownUpLock, LayoutId, MessageWord, Profile, Settings, SymbolLibrary } from './types';
import { buildProfile } from './data/defaults';
import { addSnapshot, clearLog, gcAssets, getMeta, getRev, loadData, logUsage, requestPersistence, saveDataChecked, setMeta } from './lib/db';
import { cleanLibrary, repairProfile } from './lib/validate';
import { debounce, uid } from './lib/util';
import { joinWords } from './lib/sentence';
import { setSpeakingListener, speak, stopSpeaking } from './lib/tts';
import { applyEnding } from './lib/morphology';
import { tokenize } from './lib/predict';
import { getLang, pack, setLangs, type Lang } from './i18n';
import { translateProfile } from './lib/translate';
import { alarm } from './lib/feedback';
import { t, ts } from './i18n';
import { DEFAULT_LOCK, keepDeviceLock, migrateLock } from './lib/lock';

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
  /** The person's message or phrase is being spoken: Speak shows Stop. */
  speaking: boolean;
  /** Message emptied by clear-after-speak: Speak on an empty bar brings it back and says it again. */
  lastSpoken: MessageWord[] | null;
  /** "Private for now": Recent and the usage log are paused until it is turned off or Caleb restarts. */
  isPrivate: boolean;
  /** A grown-up is editing phrases, schedules or About me (an explicit pencil, never a plain tap). */
  contentEdit: boolean;
  /** Text shown full screen (Big text), e.g. by "Show, don't speak". */
  bigText: string | null;
  /** Open tool on the Tools screen. */
  tool: string | null;
  /** A partner is modelling: taps are tagged in the log and don't train prediction. */
  modeling: boolean;
}

export type ContentTarget = 'phrases' | 'schedule' | 'aboutme';

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
  /** `form`: a word form picked by long-press (go → going); the button's word is kept as its base. */
  pressButton: (b: AACButton, opts?: { form?: string }) => void;
  addWord: (w: Omit<MessageWord, 'id'>) => void;
  addText: (text: string) => void;
  setDraft: (d: string) => void;
  commitDraft: () => void;
  backspace: () => void;
  clearMessage: () => void;
  replaceWord: (index: number, text: string) => void;
  removeWord: (index: number) => void;
  applyEnding: (e: 's' | 'ing' | 'ed') => void;
  /** Speaks the message; while it is being spoken it stops instead. On an empty bar it brings back the last cleared message. */
  speakMessage: () => void;
  /**
   * `stoppable`: the person's message or phrase (Speak becomes Stop).
   * `echo`: the word-tap echo, which stays silent (and is not shown) in "Show, don't speak".
   */
  speakText: (text: string, opts?: { audio?: string; log?: 'word' | 'phrase' | 'sentence'; stoppable?: boolean; echo?: boolean }) => void;
  stopSpeech: () => void;
  /** Puts the message emptied by clear-after-speak back in the bar. */
  restoreLastSpoken: () => boolean;
  /** Recent sentences: the person can delete them without the grown-up lock. */
  clearRecent: () => void;
  deleteRecent: (id: string) => void;
  setPrivate: (on: boolean) => void;
  setContentEdit: (on: boolean) => void;
  /** Grown-ups shortcut: go to phrases, a schedule or About me with editing on (staying unlocked). */
  openContentEditor: (target: ContentTarget) => void;
  setBigText: (text: string | null) => void;
  setUnlocked: (v: boolean) => void;
  /** Lock grown-up mode and return the person to their Home board. */
  lock: () => void;
  /** Change the app-wide grown-up lock (method, PIN, notice). */
  setLock: (patch: Partial<GrownUpLock>) => void;
  setTool: (t: string | null) => void;
  setModeling: (v: boolean) => void;
  /** The visual timer keeps running when you leave the Timer tool. */
  setTimer: (t: Partial<UIState['timer']>) => void;
  setFirstThen: (p: Partial<UIState['firstThen']>) => void;
  setChoices: (p: Partial<UIState['choices']>) => void;
  setEditMode: (v: boolean) => void;
  /** `sticky`: stays until the next word is added (or another message replaces it). */
  showToast: (msg: string, action?: { label: string; run: () => void }, opts?: { sticky?: boolean }) => void;
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

type HistoryItem = Profile['history'][number];
/** Stable id of a Recent sentence (its time stamp). */
export const recentId = (h: HistoryItem) => String(h.t);

/** Adds a spoken sentence to the top of Recent (no duplicate in a row, at most 100 kept). */
export function addToHistory(history: HistoryItem[], text: string, now = Date.now()): HistoryItem[] {
  if (history[0]?.text === text) return history;
  return [{ text, t: now }, ...history].slice(0, 100);
}

/** Learned words for prediction, Unicode-aware ("niño", "está", "aujourd'hui"). */
export function learnWords(lexicon: Record<string, number>, text: string): Record<string, number> {
  const out = { ...lexicon };
  for (const w of tokenize(text)) {
    const n = Object.hasOwn(out, w) && typeof out[w] === 'number' ? out[w] : 0;
    out[w] = n + 1;
  }
  return out;
}

/** Message word after picking another form: always remembers the dictionary form, so forms never stack. */
export function withForm(w: MessageWord, text: string): MessageWord {
  const { audio: _audio, base: oldBase, ...rest } = w;
  const base = oldBase ?? w.text;
  return text === base ? { ...rest, text } : { ...rest, text, base };
}

/**
 * May a waiting app update reload the page now? Never mid-sentence, while a timer runs,
 * while Grown-ups is unlocked, or while something is being edited (edit mode or an open dialog).
 */
export function updateCanReload(st: Pick<Store, 'message' | 'draft' | 'editMode' | 'unlocked' | 'contentEdit' | 'timer'>, dialogOpen = false): boolean {
  return !st.message.length && !st.draft && !st.editMode && !st.unlocked && !st.contentEdit && !st.timer.endAt && !dialogOpen;
}

export const emptyLibrary = (): SymbolLibrary => ({ categories: [], additions: {} });

function emptyData(): AppData {
  const p = buildProfile('', 'medium');
  return { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: false, library: emptyLibrary(), grownUpLock: { ...DEFAULT_LOCK } };
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
/** The toast on screen is the sticky "Message cleared · Undo" (it goes away with the next word). */
let clearUndoShown = false;
function dismissClearUndo() {
  if (!clearUndoShown) return;
  clearUndoShown = false;
  useStore.setState({ toast: null, toastAction: null });
}

/** Usage log entry, unless logging is off or the person chose "Private for now". */
function logUse(kind: 'word' | 'phrase' | 'sentence', text: string) {
  const st = useStore.getState();
  if (!st.settings().logging || st.isPrivate) return;
  logUsage({ profileId: st.profile().id, kind, text, modeled: st.modeling || undefined });
}

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
  speaking: false,
  lastSpoken: null,
  isPrivate: false,
  contentEdit: false,
  bigText: null,

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
      // "Keep recent sentences: until Caleb restarts" — start each session with an empty Recent.
      let forgot = false;
      for (const p of data.profiles) {
        if (p.settings.keepRecent !== 'on' && p.history.length) { p.history = []; forgot = true; }
      }
      if (forgot) doSave(data);
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
    // Phrase/schedule/About-me editing is switched on per visit, so a plain tap speaks again after leaving.
    set({ screen, formsFor: null, contentEdit: false });
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
    keepDeviceLock(d, get().data); // the grown-up lock belongs to this device, not to the file
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
    const data: AppData = { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: true, library: get().data.library ?? emptyLibrary(), grownUpLock: get().data.grownUpLock ?? { ...DEFAULT_LOCK } };
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

  pressButton(b, opts = {}) {
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
    if (opts.form) {
      // A form picked by long-press: keep the button's word as the base (forms never stack).
      if (opts.form !== text) { base = text; text = opts.form; }
    } else if (conj && getLang() !== 'en' && s.autoConjugate && b.type === 'verb' && !b.speakOnly) {
      const prev = get().message.map((w) => w.text);
      const c = conj(prev, text);
      if (c) {
        if (c.dropPrevious) set((st) => ({ message: st.message.slice(0, -c.dropPrevious) }));
        base = text;
        text = c.text;
      }
    }
    // A recorded clip says the button's own word, never another form of it.
    const audio = base ? undefined : b.audio;
    if (b.speakOnly) {
      get().speakText(text, { audio, log: 'word' });
      return;
    }
    get().addWord({ text, base, symbol: b.symbol, type: b.type, audio });
    if (s.speakOnTap) get().speakText(text, { audio, echo: true });
    logUse('word', text);
    // Auto-return to the home board after choosing a word inside a folder.
    const stack = get().boardStack;
    if (s.returnHome && stack.length > 1 && !get().editMode) {
      set({ boardStack: [stack[0]] });
    }
  },

  addWord(w) {
    dismissClearUndo();
    set((s) => ({ message: [...s.message, { ...w, id: uid('w') }], formsFor: null, lastSpoken: null }));
  },

  addText(text) {
    // Always capitalise the pronoun "I" (and I'm, I'll, I've, I'd).
    const words = text.split(/\s+/).filter(Boolean).map((w) => (/^i('(m|ll|ve|d))?$/i.test(w) ? 'I' + w.slice(1) : w));
    if (!words.length) return;
    dismissClearUndo();
    set((s) => ({ message: [...s.message, ...words.map((t) => ({ id: uid('w'), text: t }))], lastSpoken: null }));
  },

  setDraft(draft) {
    if (draft) dismissClearUndo();
    set(draft ? { draft, lastSpoken: null } : { draft });
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
    set({ message: [], draft: '', formsFor: null, lastSpoken: null });
    // Any clear (hold-backspace, one word, a draft) can be undone until the next word.
    if (message.length || draft) {
      get().showToast(t('Message cleared'), { label: 'Undo', run: () => set({ message, draft }) }, { sticky: true });
      clearUndoShown = true;
    }
  },
  replaceWord(index, text) {
    set((s) => ({
      message: s.message.map((w, i) => (i === index ? withForm(w, text) : w)),
      formsFor: null,
    }));
    const s = get().settings();
    if (s.speakOnTap) get().speakText(text, { echo: true });
  },
  removeWord(index) {
    set((s) => ({ message: s.message.filter((_, i) => i !== index), formsFor: null }));
  },
  applyEnding(e) {
    const msg = get().message;
    if (!msg.length) return;
    const last = msg[msg.length - 1];
    // Always inflect the dictionary form: go → going, then +ed → went (never "goinged").
    get().replaceWord(msg.length - 1, applyEnding(last.base ?? last.text, e, last.type));
  },

  speakMessage() {
    // While the message is being spoken, Speak is Stop.
    if (get().speaking) return get().stopSpeech();
    get().commitDraft();
    let { message } = get();
    let again = false;
    if (!message.length) {
      // Clear-after-speak emptied the bar: Speak brings the message back and says it again.
      if (!get().restoreLastSpoken()) return;
      message = get().message;
      again = true;
    }
    const s = get().settings();
    const text = joinWords(message);
    // Single word with a recorded clip → play that clip.
    const audio = message.length === 1 ? message[0].audio : undefined;
    get().speakText(text, { audio, log: 'sentence', stoppable: true });
    if (again) return; // already in Recent and learned; leave it in the bar this time
    const recent = s.keepRecent !== 'off';
    const learn = s.learnWords && !get().modeling;
    if (!get().isPrivate && (recent || learn)) {
      get().updateProfile((p) => {
        if (recent) p.history = addToHistory(p.history, text);
        if (learn) p.lexicon = learnWords(p.lexicon, text);
      }, { shallow: true });
    }
    if (s.clearAfterSpeak) set({ message: [], draft: '', lastSpoken: message });
  },

  speakText(text, opts = {}) {
    const s = get().settings();
    if (s.showNotSpeak) {
      // "Show, don't speak": show it big for the partner instead. Word-tap echoes stay quiet.
      const last = get().message[get().message.length - 1]?.text;
      const echo = opts.echo || (!opts.log && !opts.stoppable && last?.toLowerCase() === text.toLowerCase());
      if (!echo && text.trim()) get().setBigText(text);
    } else {
      speak(applyPronunciations(text, s.pronunciations), s, { audio: opts.audio, stoppable: opts.stoppable });
    }
    if (opts.log) logUse(opts.log, text);
  },
  stopSpeech() {
    stopSpeaking();
    set({ speaking: false });
  },
  restoreLastSpoken() {
    const { lastSpoken, message, draft } = get();
    if (!lastSpoken?.length || message.length || draft) return false;
    set({ message: lastSpoken.map((w) => ({ ...w, id: uid('w') })), lastSpoken: null });
    return true;
  },
  clearRecent() {
    const removed = get().profile().history;
    if (!removed.length) return;
    get().updateProfile((p) => { p.history = []; }, { shallow: true });
    get().showToast(t('Recent sentences cleared'), { label: 'Undo', run: () => restoreHistory(removed) });
  },
  deleteRecent(id) {
    const removed = get().profile().history.filter((h) => recentId(h) === id);
    if (!removed.length) return;
    get().updateProfile((p) => { p.history = p.history.filter((h) => recentId(h) !== id); }, { shallow: true });
    get().showToast(t('Sentence removed'), { label: 'Undo', run: () => restoreHistory(removed) });
  },
  setPrivate(on) {
    set({ isPrivate: on });
  },
  setContentEdit(on) {
    set({ contentEdit: on && get().unlocked });
  },
  openContentEditor(target) {
    if (!get().unlocked) return;
    if (target === 'phrases') set({ screen: 'phrases', editMode: false, formsFor: null, contentEdit: true });
    else set({ screen: 'tools', tool: target, editMode: false, formsFor: null, contentEdit: true });
  },
  setBigText(bigText) {
    set({ bigText });
  },

  // ---- Grown-up lock (app-wide, v0.5) ----
  setUnlocked(v) {
    set({ unlocked: v, editMode: v ? get().editMode : false, contentEdit: v ? get().contentEdit : false });
    // Tell the grown-up once that profiles' different PINs became one.
    const from = get().data.grownUpLock?.pinNotice;
    if (v && from !== undefined) {
      get().showToast(t('Profiles had different PINs. Caleb now uses one PIN for the whole app: the one from {v0}.', { v0: from }),
        { label: t('OK'), run: () => get().setLock({ pinNotice: undefined }) });
    }
  },
  lock() {
    set({ unlocked: false, editMode: false, contentEdit: false, screen: 'talk', boardStack: [get().profile().rootId], formsFor: null });
  },
  setLock(patch) {
    const { data } = get();
    const grownUpLock: GrownUpLock = { ...(data.grownUpLock ?? DEFAULT_LOCK), ...patch };
    if (grownUpLock.pin === undefined) delete grownUpLock.pin;
    if (grownUpLock.pinNotice === undefined) delete grownUpLock.pinNotice;
    if (grownUpLock.lock === 'pin' && !grownUpLock.pin) grownUpLock.lock = 'hold';
    const newData = { ...data, grownUpLock };
    set({ data: newData });
    persist(newData);
  },
  // ---- end grown-up lock ----
  tool: null,
  setTool(tool) {
    set({ tool, contentEdit: false });
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
  showToast(msg, action, opts = {}) {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = undefined;
    clearUndoShown = false;
    set({ toast: msg, toastAction: action ?? null });
    if (!opts.sticky) toastTimer = setTimeout(() => set({ toast: null, toastAction: null }), action ? 5000 : 2200);
  },
  setFormsFor(v) {
    set({ formsFor: v });
  },
  setHighlight(ids) {
    set({ highlight: ids });
  },
}));

/** Undo for clearing or deleting Recent sentences: puts them back in time order, keeping anything said since. */
function restoreHistory(removed: HistoryItem[]) {
  useStore.getState().updateProfile((p) => {
    const have = new Set(p.history.map(recentId));
    p.history = [...p.history, ...removed.filter((h) => !have.has(recentId(h)))].sort((a, b) => b.t - a.t).slice(0, 100);
  }, { shallow: true });
}

// Speak shows Stop while the person's message or phrase is being spoken.
setSpeakingListener((on) => { if (useStore.getState().speaking !== on) useStore.setState({ speaking: on }); });

// Timer tick lives outside any component so it keeps running (and alarms) on every screen.
if (typeof window !== 'undefined') {
  setInterval(() => {
    const { timer } = useStore.getState();
    if (!timer.endAt) return;
    const left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
    if (left !== timer.left) useStore.setState({ timer: { ...timer, left } });
    if (left === 0) {
      useStore.setState({ timer: { ...timer, left: 0, endAt: null } });
      alarm();
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
  migrateLock(data); // per-profile lock → app-wide (before profiles are repaired)
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
/** The app-wide grown-up lock. */
export const useLock = () => useStore((s) => s.data.grownUpLock ?? DEFAULT_LOCK);
