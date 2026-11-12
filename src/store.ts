import { create } from 'zustand';
import type { AACButton, AppData, LayoutId, MessageWord, Profile, Settings } from './types';
import { buildProfile } from './data/defaults';
import { addSnapshot, getMeta, loadData, logUsage, requestPersistence, saveData, setMeta } from './lib/db';
import { debounce, uid } from './lib/util';
import { joinWords } from './lib/sentence';
import { speak, stopSpeaking } from './lib/tts';
import { applyEnding } from './lib/morphology';

export const DATA_VERSION = 1;

export type Screen = 'talk' | 'keyboard' | 'phrases' | 'tools' | 'grownup';

interface UIState {
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
  undo: Profile[];
  toast: string | null;
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
  updateProfile: (fn: (p: Profile) => void, opts?: { undoable?: boolean }) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  undoEdit: () => void;
  replaceData: (data: AppData, reason?: string) => Promise<void>;
  completeOnboarding: (name: string, layout: LayoutId, patch?: Partial<Settings>) => void;
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
  setEditMode: (v: boolean) => void;
  showToast: (msg: string) => void;
  setFormsFor: (v: { index: number } | null) => void;
  setHighlight: (ids: string[]) => void;
}

export type Store = UIState & Actions;

function emptyData(): AppData {
  const p = buildProfile('', 'medium');
  return { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: false };
}

const persist = debounce((data: AppData) => {
  saveData(data).catch((e) => console.error('save failed', e));
}, 400);

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
  formsFor: null,
  highlight: [],

  async init() {
    requestPersistence();
    let data = await loadData();
    if (!data || !data.profiles?.length) {
      data = emptyData();
      await saveData(data);
    } else {
      data = migrate(data);
      // Automatic daily snapshot (versioned backup).
      const last = (await getMeta<number>('lastSnapshot')) ?? 0;
      if (Date.now() - last > 20 * 3600 * 1000) {
        await addSnapshot(data, 'Automatic daily backup');
        await setMeta('lastSnapshot', Date.now());
      }
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
    const next = structuredClone(current);
    fn(next);
    const profiles = data.profiles.map((p) => (p.id === current.id ? next : p));
    const newData = { ...data, profiles };
    const undo = opts.undoable ? [...get().undo.slice(-29), current] : get().undo;
    set({ data: newData, undo });
    persist(newData);
  },

  updateSettings(patch) {
    get().updateProfile((p) => {
      p.settings = { ...p.settings, ...patch };
    });
  },

  undoEdit() {
    const { undo, data } = get();
    const prev = undo[undo.length - 1];
    if (!prev) return;
    const profiles = data.profiles.map((p) => (p.id === prev.id ? prev : p));
    const newData = { ...data, profiles };
    set({ data: newData, undo: undo.slice(0, -1) });
    persist(newData);
    get().showToast('Undone');
  },

  async replaceData(newData, reason = 'Before restore') {
    await addSnapshot(get().data, reason);
    const d = migrate(newData);
    const p = d.profiles.find((x) => x.id === d.activeProfileId) ?? d.profiles[0];
    d.activeProfileId = p.id;
    set({ data: d, boardStack: [p.rootId], message: [], undo: [] });
    persist.flush(d);
  },

  completeOnboarding(name, layout, patch = {}) {
    const p = buildProfile(name, layout);
    p.settings = { ...p.settings, ...patch };
    const data: AppData = { version: DATA_VERSION, profiles: [p], activeProfileId: p.id, onboarded: true };
    set({ data, boardStack: [p.rootId], message: [] });
    persist.flush(data);
  },

  addProfile(name, layout) {
    const p = buildProfile(name, layout);
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
    set({ data: newData, boardStack: [profiles.find((p) => p.id === activeProfileId)!.rootId] });
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
        else get().showToast('Pick a word first, then tap Word forms');
        return;
      }
      default: break;
    }
    const text = b.speak ?? b.label;
    if (b.speakOnly) {
      get().speakText(text, { audio: b.audio, log: 'word' });
      return;
    }
    get().addWord({ text, symbol: b.symbol, type: b.type, audio: b.audio });
    if (s.speakOnTap) get().speakText(text, { audio: b.audio });
    if (s.logging) logUsage({ profileId: get().profile().id, kind: 'word', text });
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
    const words = text.split(/\s+/).filter(Boolean);
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
    set({ message: [], draft: '', formsFor: null });
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
      if (s.learnWords) {
        for (const w of text.toLowerCase().match(/[a-z']+/g) ?? []) p.lexicon[w] = (p.lexicon[w] ?? 0) + 1;
      }
    });
    if (s.clearAfterSpeak) set({ message: [], draft: '' });
  },

  speakText(text, opts = {}) {
    const s = get().settings();
    speak(text, s, { audio: opts.audio });
    if (opts.log && s.logging) logUsage({ profileId: get().profile().id, kind: opts.log, text });
  },

  setUnlocked(v) {
    set({ unlocked: v, editMode: v ? get().editMode : false });
  },
  setEditMode(v) {
    set({ editMode: v, screen: v ? 'talk' : get().screen });
  },
  showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2200);
  },
  setFormsFor(v) {
    set({ formsFor: v });
  },
  setHighlight(ids) {
    set({ highlight: ids });
  },
}));

/** Upgrades older saved data to the current shape. */
export function migrate(data: AppData): AppData {
  const fresh = buildProfile('', 'medium');
  for (const p of data.profiles) {
    p.settings = { ...fresh.settings, ...p.settings };
    p.lexicon ??= {};
    p.history ??= [];
    p.phrases ??= [];
    p.phraseCategories ??= fresh.phraseCategories;
    p.schedules ??= [];
    p.quickBar ??= fresh.quickBar;
    p.aboutMe ??= fresh.aboutMe;
  }
  data.version = DATA_VERSION;
  return data;
}

export const useProfile = () => useStore((s) => s.data.profiles.find((p) => p.id === s.data.activeProfileId) ?? s.data.profiles[0]);
export const useSettings = () => useProfile().settings;
