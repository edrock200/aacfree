import { create } from 'zustand';
import type { AACButton, AppData, GrownUpLock, LayoutId, MessageWord, Profile, Settings, SymbolLibrary } from './types';
import { buildProfile } from './data/defaults';
import {
  addSnapshot, blockStoredWrites, clearLog, DAILY_SNAPSHOT_REASON, gcAssets, getMeta, loadDataWithRev, logUsage, requestPersistence,
  saveDataChecked, setMeta, setUsageLogPaused,
} from './lib/db';
import { cleanData, cleanLibrary, withoutTransient } from './lib/validate';
import { SaveQueue } from './lib/savequeue';
import { debounce, uid } from './lib/util';
import { joinWords } from './lib/sentence';
import { speak, stopSpeaking } from './lib/tts';
import { applyEnding } from './lib/morphology';
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
  /** "Private for now": recent sentences, the usage log and learned words are paused (never saved; resets on restart). */
  privateMode: boolean;
  /**
   * Saved data could not be used, so Caleb runs from memory and saves nothing:
   * 'newer' (made by a newer Caleb), 'unreadable' (damaged; a copy was kept), 'storage' (storage could not be read).
   */
  loadProblem: LoadProblem | null;
  /** Open tool on the Tools screen. */
  tool: string | null;
  /** A partner is modelling: taps are tagged in the log and don't train prediction. */
  modeling: boolean;
}

export type LoadProblem = 'newer' | 'unreadable' | 'storage';

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
  /** Snapshots first; if the safety copy can't be saved, nothing is deleted. */
  deleteProfile: (id: string) => Promise<void>;
  // recent sentences (no lock needed: the person controls their own history)
  /** Clear the current profile's recent sentences (with an Undo toast). */
  clearRecent: () => void;
  /** Delete one recent sentence by its id (with an Undo toast). */
  deleteRecent: (id: string) => void;
  /** "Private for now": pause recent sentences, the usage log and learned words until switched off or Caleb restarts. */
  setPrivate: (on: boolean) => void;
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
  /** Change the app-wide grown-up lock (method, PIN, notice). */
  setLock: (patch: Partial<GrownUpLock>) => void;
  setTool: (t: string | null) => void;
  setModeling: (v: boolean) => void;
  /** The visual timer keeps running when you leave the Timer tool. */
  setTimer: (t: Partial<UIState['timer']>) => void;
  setFirstThen: (p: Partial<UIState['firstThen']>) => void;
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
  return { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: false, library: emptyLibrary(), grownUpLock: { ...DEFAULT_LOCK } };
}

let saveBlocked = false;
let dirty = false;
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('caleb-data') : null;

/** Stop every write of app data, snapshots and backups (data in memory is a placeholder or must not overwrite storage). */
export function blockSaves() {
  saveBlocked = true;
  blockStoredWrites(true);
  queue.clear();
}
export const isSaveBlocked = () => saveBlocked;

function unblockSaves() {
  saveBlocked = false;
  blockStoredWrites(false);
}

/** Every save goes through this one queue (one write at a time, coalesced to the latest state). */
export const queue = new SaveQueue<AppData>({
  write: (data, expected) => saveDataChecked(withoutTransient(data), expected),
  blocked: () => saveBlocked,
  async onConflict() {
    // Another window saved newer data: never overwrite it. Load theirs instead.
    dirty = false;
    await reloadFromDisk();
    useStore.getState().showToast(t('Caleb was changed in another window. Showing the latest version.'));
  },
  onSaved(data, next) {
    if (useStore.getState().data === data) dirty = false;
    channel?.postMessage({ rev: next });
    if (useStore.getState().saveError) useStore.setState({ saveError: false });
  },
  onFailed() {
    useStore.setState({ saveError: true });
  },
});

async function reloadFromDisk() {
  const { data: fresh, rev: freshRev } = await loadDataWithRev();
  if (fresh == null) return;
  let d: AppData;
  try {
    d = migrate(fresh);
  } catch (e) {
    // Another window wrote data this copy of Caleb can't use: stop saving rather than overwrite it.
    console.error('Data from another window could not be read', e);
    blockSaves();
    useStore.setState({ loadProblem: /newer version/.test((e as Error).message) ? 'newer' : 'unreadable' });
    return;
  }
  queue.rev = freshRev;
  const st = useStore.getState();
  // Recent sentences kept "for this session" live only in memory: carry them over.
  for (const p of d.profiles) {
    if (p.settings.keepRecent !== 'session') continue;
    const mine = st.data.profiles.find((x) => x.id === p.id);
    if (mine?.history.length) p.history = mine.history;
  }
  const p = d.profiles.find((x) => x.id === st.data.activeProfileId) ?? d.profiles[0];
  const stack = st.boardStack.filter((id) => Object.hasOwn(p.boards, id));
  useStore.setState({ data: { ...d, activeProfileId: p.id }, boardStack: stack.length ? stack : [p.rootId], undo: [] });
}

channel?.addEventListener('message', (e: MessageEvent<{ rev: number }>) => {
  // Another window saved. If we have no unsaved edits, pick up its data.
  if (!dirty && !queue.busy && !saveBlocked && e.data?.rev !== queue.rev) reloadFromDisk().catch(() => {});
});

const persistDebounced = debounce((data: AppData) => { queue.save(data); }, 400);
const persist = Object.assign((data: AppData) => { dirty = true; persistDebounced(data); }, {
  flush: (data: AppData) => { dirty = true; persistDebounced.flush(data); },
});

// ---------- maintenance (daily snapshot, asset clean-up, scheduled backup) ----------
let maintaining = false;
let lastMaintenance = 0;
const HOUR = 3600 * 1000;

/**
 * Background housekeeping. Runs after start-up, when Caleb comes back to the
 * foreground and every hour, so a tablet that keeps Caleb open still gets its
 * snapshots and backups. Never interactive, never while saving is blocked.
 */
export async function runMaintenance(): Promise<void> {
  const st = useStore.getState();
  if (maintaining || saveBlocked || !st.loaded || !st.data.onboarded) return;
  maintaining = true;
  lastMaintenance = Date.now();
  try {
    const last = (await getMeta<number>('lastSnapshot')) ?? 0;
    const now = Date.now();
    if (now - last > 20 * HOUR || last > now + HOUR) {
      await addSnapshot(useStore.getState().data, DAILY_SNAPSHOT_REASON);
      await setMeta('lastSnapshot', now);
      const { referencedAssets } = await import('./lib/backup');
      await gcAssets(referencedAssets(useStore.getState().data), referencedAssets);
    }
    if (saveBlocked) return;
    const { runAutoBackup } = await import('./lib/autobackup');
    await runAutoBackup(useStore.getState().data); // checks the family's backup settings; never asks for anything
  } catch (e) {
    console.warn('Maintenance failed', e);
  } finally {
    maintaining = false;
  }
}

let maintenanceScheduled = false;
function scheduleMaintenance() {
  if (maintenanceScheduled || typeof window === 'undefined' || typeof document === 'undefined') return;
  maintenanceScheduled = true;
  setTimeout(() => { runMaintenance(); }, 1500);
  setInterval(() => { runMaintenance(); }, HOUR);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastMaintenance > 10 * 60 * 1000) runMaintenance();
  });
}

/** Keeps recent sentences only when the profile's settings (and private mode) allow it. */
function recordsHistory(s: Settings, privateMode: boolean) {
  return (s.keepRecent ?? 'on') !== 'off' && !privateMode;
}

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
  privateMode: false,
  loadProblem: null,

  async init() {
    requestPersistence();
    let raw: unknown;
    let storedRev = 0;
    let readFailed = false;
    try {
      ({ data: raw, rev: storedRev } = await loadDataWithRev());
    } catch {
      // Retry once; if storage still can't be read, run from memory WITHOUT overwriting saved data.
      try { ({ data: raw, rev: storedRev } = await loadDataWithRev()); } catch (e) {
        console.error('Could not read saved data', e);
        readFailed = true;
      }
    }
    let data: AppData;
    let problem: LoadProblem | null = null;
    if (readFailed) {
      problem = 'storage';
      data = { ...emptyData(), onboarded: true };
    } else if (raw == null) {
      data = emptyData(); // first start
    } else {
      try {
        data = migrate(raw as AppData);
      } catch (e) {
        // Never overwrite what is stored: keep a copy aside, save nothing, and tell the family.
        console.error('Saved data could not be used', e);
        try { await setMeta(`data-unreadable-${Date.now()}`, raw); } catch { /* the original record is still untouched */ }
        problem = /newer version/.test((e as Error)?.message ?? '') ? 'newer' : 'unreadable';
        let library = emptyLibrary();
        try { library = cleanLibrary((raw as AppData)?.library); } catch { /* ignore */ }
        data = { ...emptyData(), onboarded: true, library };
      }
    }
    if (problem) {
      blockSaves();
      const msg = problem === 'newer'
        ? t('Your boards were saved by a newer version of Caleb. Please update Caleb. Until then, changes are not saved.')
        : problem === 'unreadable'
          ? t('Your saved boards could not be opened. A copy was kept on this device. Restore a backup in Grown-ups → Backup. Until then, changes are not saved.')
          : t('Could not open saved boards. Changes will not be saved. Please restart Caleb.');
      setTimeout(() => get().showToast(msg), 500);
    }
    queue.rev = storedRev;
    const p = data.profiles.find((x) => x.id === data.activeProfileId) ?? data.profiles[0];
    set({ data: { ...data, activeProfileId: p.id }, loaded: true, boardStack: [p.rootId], loadProblem: problem });
    if (!problem) scheduleMaintenance();
    // A crash-screen restore steps back one snapshot per attempt; once Caleb runs fine, start again from the newest.
    setTimeout(() => { try { sessionStorage.removeItem('caleb:crashRestoreBefore'); } catch { /* ignore */ } }, 60000);
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
      // Turning recent sentences off forgets the ones already kept.
      if (patch.keepRecent === 'off') p.history = [];
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
        label: t('Undo'),
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
    const problem = get().loadProblem;
    // The grown-up lock belongs to this device, not to the file (a placeholder's lock means nothing).
    if (!problem) keepDeviceLock(d, get().data);
    if (saveBlocked) {
      // Data in memory is only a placeholder: never snapshot it. A deliberate restore may replace
      // stored data that couldn't be used (a copy was kept aside), but not storage that can't be read.
      if (problem !== 'newer' && problem !== 'unreadable') throw new Error('Caleb cannot save right now. Please restart Caleb and try again.');
      unblockSaves();
      set({ loadProblem: null });
      scheduleMaintenance();
    } else {
      await addSnapshot(get().data, reason); // throws → nothing is replaced
    }
    const p = d.profiles.find((x) => x.id === d.activeProfileId) ?? d.profiles[0];
    d.activeProfileId = p.id;
    queue.clear();
    set({ data: d, boardStack: [p.rootId], message: [], undo: [] });
    persist.flush(d);
    await queue.idle();
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

  async deleteProfile(id) {
    const { data } = get();
    const removed = data.profiles.find((p) => p.id === id);
    if (data.profiles.length <= 1 || !removed) return;
    const index = data.profiles.indexOf(removed);
    // The safety snapshot holds the data from before the deletion. The screen updates at once,
    // but the deletion is only saved (and the usage log cleared) once the snapshot is stored.
    const snapshot = addSnapshot(data, 'Before deleting a profile');
    const profiles = data.profiles.filter((p) => p.id !== id);
    const activeProfileId = data.activeProfileId === id ? profiles[0].id : data.activeProfileId;
    set({ data: { ...data, profiles, activeProfileId }, boardStack: [profiles.find((p) => p.id === activeProfileId)!.rootId], undo: [] });
    try {
      await snapshot;
    } catch (e) {
      console.error('Snapshot before deleting a profile failed', e);
      const cur = get().data;
      if (!cur.profiles.some((p) => p.id === id)) {
        const back = [...cur.profiles];
        back.splice(Math.min(index, back.length), 0, removed);
        const restored = { ...cur, profiles: back };
        set({ data: restored });
        persist(restored);
      }
      get().showToast(t('Could not save a safety copy, so nothing was deleted. Try again, or save a backup file first.'));
      return;
    }
    clearLog(id).catch(() => {});
    persist(get().data);
  },

  clearRecent() {
    const p = get().profile();
    const prev = p.history;
    if (!prev.length) return;
    patchProfile(p.id, (pp) => ({ ...pp, history: [] }));
    get().showToast(t('Recent sentences cleared'), {
      label: t('Undo'),
      run: () => patchProfile(p.id, (pp) => ({ ...pp, history: mergeHistory(pp.history, prev) })),
    });
  },
  deleteRecent(id) {
    const p = get().profile();
    const gone = p.history.find((h) => h.id === id || String(h.t) === id);
    if (!gone) return;
    patchProfile(p.id, (pp) => ({ ...pp, history: pp.history.filter((h) => h !== gone) }));
    get().showToast(t('Sentence removed'), {
      label: t('Undo'),
      run: () => patchProfile(p.id, (pp) => ({ ...pp, history: mergeHistory(pp.history, [gone]) })),
    });
  },
  setPrivate(on) {
    set({ privateMode: on });
    setUsageLogPaused(on);
  },

  openBoard(id) {
    if (!Object.hasOwn(get().profile().boards, id)) return;
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
    const keep = recordsHistory(s, get().privateMode);
    const learn = s.learnWords && !get().modeling && !get().privateMode;
    if (keep || learn) get().updateProfile((p) => {
      if (keep && p.history[0]?.text !== text) p.history = [{ id: uid('h'), text, t: Date.now() }, ...p.history].slice(0, 100);
      if (learn) {
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

  // ---- Grown-up lock (app-wide, v0.5) ----
  setUnlocked(v) {
    set({ unlocked: v, editMode: v ? get().editMode : false });
    // Tell the grown-up once that profiles' different PINs became one.
    const from = get().data.grownUpLock?.pinNotice;
    if (v && from !== undefined) {
      get().showToast(t('Profiles had different PINs. Caleb now uses one PIN for the whole app: the one from {v0}.', { v0: from }),
        { label: t('OK'), run: () => get().setLock({ pinNotice: undefined }) });
    }
  },
  lock() {
    set({ unlocked: false, editMode: false, screen: 'talk', boardStack: [get().profile().rootId], formsFor: null });
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

/**
 * Upgrades older saved data to the current shape and validates every field
 * (the single gate for stored, restored, synced and imported data).
 * Throws only a friendly Error when nothing usable is left.
 */
export function migrate(data: AppData): AppData {
  // Per-profile lock → app-wide, before profiles are repaired (newer files are refused by cleanData unchanged).
  if (data && typeof data === 'object' && Array.isArray(data.profiles) && !(typeof data.version === 'number' && data.version > DATA_VERSION)) {
    migrateLock(data);
  }
  return cleanData(data, DATA_VERSION);
}

/** Replace one profile (by id) without touching undo, active profile or navigation. */
function patchProfile(id: string, fn: (p: Profile) => Profile) {
  const { data } = useStore.getState();
  if (!data.profiles.some((p) => p.id === id)) return;
  const profiles = data.profiles.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p));
  const newData = { ...data, profiles };
  useStore.setState({ data: newData });
  persist(newData);
}

/** Put removed recent sentences back (newest first, no duplicates, capped). */
function mergeHistory(cur: Profile['history'], back: Profile['history']): Profile['history'] {
  const key = (h: Profile['history'][number]) => h.id ?? `${h.t}:${h.text}`;
  const ids = new Set(cur.map(key));
  return [...cur, ...back.filter((h) => !ids.has(key(h)))].sort((a, b) => b.t - a.t).slice(0, 100);
}

export const useProfile = () => useStore((s) => s.data.profiles.find((p) => p.id === s.data.activeProfileId) ?? s.data.profiles[0]);
export const useSettings = () => useProfile().settings;
/** The app-wide grown-up lock. */
export const useLock = () => useStore((s) => s.data.grownUpLock ?? DEFAULT_LOCK);
