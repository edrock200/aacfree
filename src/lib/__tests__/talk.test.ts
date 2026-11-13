import { beforeEach, describe, expect, it, vi } from 'vitest';

// The store persists to IndexedDB and logs usage: stub the database so the talk loop can run in Node.
const logUsage = vi.fn();
vi.mock('../db', () => ({
  addSnapshot: vi.fn(async () => {}),
  clearLog: vi.fn(async () => {}),
  gcAssets: vi.fn(async () => {}),
  getMeta: vi.fn(async () => undefined),
  getRev: vi.fn(async () => 0),
  loadData: vi.fn(async () => undefined),
  logUsage: (...a: unknown[]) => logUsage(...a),
  requestPersistence: vi.fn(),
  saveDataChecked: vi.fn(async (_d: unknown, rev: number) => rev + 1),
  setMeta: vi.fn(async () => {}),
  assetURL: vi.fn(async () => null),
  setUsageLogPaused: vi.fn(),
  loadDataWithRev: vi.fn(async () => ({ data: undefined, rev: 0 })),
}));

import { useStore, withForm, learnWords, addToHistory, recentId, updateCanReload } from '../../store';
import { tokenize, fold, predict } from '../predict';
import { reportFailure, resetFailures, setTtsFailureHandler, FAILURE_QUIET_MS, type TtsFailure } from '../tts';
import { insightStats, localDay, nearestVolumePreset, resetStaleTicks, stepRate, toolShown, usageCsv } from '../talk';
import { setLang } from '../../i18n';
import type { AACButton, Schedule } from '../../types';
import type { LogEntry } from '../db';

const st = () => useStore.getState();
const words = () => st().message.map((w) => w.text);
const btn = (label: string, type: AACButton['type'] = 'noun', extra: Partial<AACButton> = {}): AACButton => ({ id: 'b-' + label, label, type, ...extra });

beforeEach(() => {
  setLang('en');
  logUsage.mockClear();
  useStore.setState({ message: [], draft: '', speaking: false, lastSpoken: null, privateMode: false, bigText: null, toast: null, toastAction: null, unlocked: false, contentEdit: false, editMode: false, screen: 'talk', tool: null });
  st().updateSettings({ speakOnTap: true, clearAfterSpeak: false, showNotSpeak: false, keepRecent: 'on', logging: false, learnWords: false, returnHome: true });
  st().updateProfile((p) => { p.history = []; p.lexicon = {}; }, { shallow: true });
});

describe('defect 15: Unicode-aware tokeniser and prediction', () => {
  it('keeps accented letters, apostrophes and hyphens', () => {
    expect(tokenize('¿Está bien, niño?')).toEqual(['está', 'bien', 'niño']);
    expect(tokenize("Aujourd’hui c'est peut-être la fête")).toEqual(["aujourd'hui", "c'est", 'peut-être', 'la', 'fête']);
    expect(tokenize("I don't want 3 apples - 'now'")).toEqual(['i', "don't", 'want', 'apples', 'now']);
    expect(tokenize('Ação, coração e pão')).toEqual(['ação', 'coração', 'e', 'pão']);
  });
  it('learns whole accented words, never fragments, and is safe with odd keys', () => {
    const lex = learnWords({}, 'El niño está feliz. El niño come.');
    expect(lex['niño']).toBe(2);
    expect(lex['está']).toBe(1);
    expect(lex).not.toHaveProperty('ni');
    expect(lex).not.toHaveProperty('est');
    const odd = learnWords({}, 'constructor toString constructor');
    expect(odd.constructor).toBe(2);
    expect(odd.tostring).toBe(1);
  });
  it('predicts the next word after an accented word, ignoring accents and case', () => {
    const ctx = { vocabulary: [], lexicon: {}, history: [{ text: 'Mamá está aquí' }, { text: 'mama está feliz' }] };
    expect(predict('', 'mamá', ctx)).toContain('está');
    expect(predict('', 'Mama', ctx)[0]).toBe('está');
    expect(predict('', 'está', ctx)).toEqual(expect.arrayContaining(['aquí', 'feliz']));
  });
  it('matches learned and board words without accents', () => {
    const ctx = { vocabulary: ['piñata'], lexicon: { 'niño': 3 }, history: [] };
    expect(predict('nin', undefined, ctx)[0]).toBe('niño');
    expect(predict('pina', undefined, ctx)).toContain('piñata');
    expect(fold('Garçon')).toBe('garcon');
  });
  it('speaking learns Unicode words when learning is on', () => {
    st().updateSettings({ learnWords: true });
    st().addText('El niño está aquí');
    st().speakMessage();
    expect(st().profile().lexicon['niño']).toBe(1);
    expect(st().profile().lexicon['está']).toBe(1);
  });
});

describe('defect 14: word forms never stack', () => {
  it('records the base and inflects from it', () => {
    st().addWord({ text: 'go', type: 'verb' });
    st().applyEnding('ing');
    expect(words()).toEqual(['going']);
    expect(st().message[0].base).toBe('go');
    st().applyEnding('ed');
    expect(words()).toEqual(['went']);
    st().applyEnding('s');
    expect(words()).toEqual(['goes']);
  });
  it('double plural stays a plural', () => {
    st().addWord({ text: 'cat', type: 'noun' });
    st().applyEnding('s');
    st().applyEnding('s');
    expect(words()).toEqual(['cats']);
  });
  it('picking a form keeps the base, picking the base goes back to it', () => {
    st().addWord({ text: 'go', type: 'verb', audio: 'clip' });
    st().replaceWord(0, 'went');
    expect(st().message[0]).toMatchObject({ text: 'went', base: 'go' });
    expect(st().message[0].audio).toBeUndefined();
    st().replaceWord(0, 'going');
    expect(st().message[0]).toMatchObject({ text: 'going', base: 'go' });
    st().replaceWord(0, 'go');
    expect(st().message[0].text).toBe('go');
    expect(st().message[0].base).toBeUndefined();
  });
  it('withForm keeps an existing base (Spanish conjugation)', () => {
    expect(withForm({ id: 'w', text: 'quiero', base: 'querer' }, 'quieres')).toMatchObject({ text: 'quieres', base: 'querer' });
  });
  it('a long-press form goes through pressButton: base, usage log and return-home', () => {
    st().updateSettings({ logging: true });
    useStore.setState({ boardStack: [st().profile().rootId, 'folder'] });
    st().pressButton(btn('run', 'verb', { audio: 'run-clip' }), { form: 'running' });
    expect(st().message[0]).toMatchObject({ text: 'running', base: 'run' });
    expect(st().message[0].audio).toBeUndefined();
    expect(logUsage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'word', text: 'running' }));
    expect(st().boardStack).toEqual([st().profile().rootId]);
  });
});

describe('defect 48: clear-after-speak keeps the last message', () => {
  it('Speak on the empty bar brings the message back and says it again', () => {
    st().updateSettings({ clearAfterSpeak: true });
    st().addText('I want juice');
    st().speakMessage();
    expect(words()).toEqual([]);
    expect(st().profile().history.length).toBe(1);
    st().speakMessage();
    expect(words()).toEqual(['I', 'want', 'juice']);
    expect(st().profile().history.length).toBe(1);
  });
  it('a new word forgets the cleared message', () => {
    st().updateSettings({ clearAfterSpeak: true });
    st().addText('hello');
    st().speakMessage();
    st().addText('bye');
    st().backspace();
    st().speakMessage();
    expect(words()).toEqual([]);
  });
  it('without clear-after-speak, Speak on an empty bar does nothing', () => {
    st().addText('hello');
    st().clearMessage();
    st().speakMessage();
    expect(words()).toEqual([]);
  });
});

describe('feature 1: output control', () => {
  it('Speak is Stop while the message is being spoken', () => {
    st().addText('hello there');
    useStore.setState({ speaking: true });
    st().speakMessage();
    expect(st().speaking).toBe(false);
    expect(st().profile().history.length).toBe(0);
    expect(words()).toEqual(['hello', 'there']);
  });
  it('"Show, don\'t speak" shows the message in Big text; word echoes stay quiet', () => {
    st().updateSettings({ showNotSpeak: true });
    st().pressButton(btn('apple'));
    expect(st().bigText).toBeNull();
    st().addText('please');
    st().speakMessage();
    expect(st().bigText).toBe('apple please');
    expect(st().profile().history[0].text).toBe('apple please');
    st().setBigText(null);
    st().speakText('It hurts a lot.');
    expect(st().bigText).toBe('It hurts a lot.');
  });
});

describe('feature 2 / defect 54: recent sentences', () => {
  const speakAll = (...xs: string[]) => xs.forEach((x, i) => {
    st().addText(x);
    st().speakMessage();
    st().clearMessage();
    // distinct time stamps
    st().updateProfile((p) => { if (p.history[0]) p.history[0] = { ...p.history[0], t: 1000 + i }; }, { shallow: true });
  });
  it('delete one sentence, with Undo', () => {
    speakAll('one', 'two', 'three');
    const two = st().profile().history.find((h) => h.text === 'two')!;
    st().deleteRecent(recentId(two));
    expect(st().profile().history.map((h) => h.text)).toEqual(['three', 'one']);
    st().toastAction!.run();
    expect(st().profile().history.map((h) => h.text)).toEqual(['three', 'two', 'one']);
  });
  it('clear all, with Undo', () => {
    speakAll('one', 'two');
    st().clearRecent();
    expect(st().profile().history).toEqual([]);
    st().toastAction!.run();
    expect(st().profile().history.length).toBe(2);
  });
  it('"Private for now" keeps nothing and logs nothing', () => {
    st().updateSettings({ logging: true, learnWords: true });
    st().setPrivate(true);
    st().pressButton(btn('secret'));
    st().speakMessage();
    expect(st().profile().history).toEqual([]);
    expect(st().profile().lexicon).toEqual({});
    expect(logUsage).not.toHaveBeenCalled();
    st().setPrivate(false);
    st().speakMessage();
    expect(st().profile().history.length).toBe(1);
    expect(logUsage).toHaveBeenCalled();
  });
  it('keepRecent "off" adds nothing to Recent', () => {
    st().updateSettings({ keepRecent: 'off' });
    st().addText('hello');
    st().speakMessage();
    expect(st().profile().history).toEqual([]);
  });
  it('addToHistory skips a repeat and caps at 100', () => {
    let h = addToHistory([], 'a', 1);
    h = addToHistory(h, 'a', 2);
    expect(h.length).toBe(1);
    for (let i = 0; i < 120; i++) h = addToHistory(h, 'x' + i, 10 + i);
    expect(h.length).toBe(100);
  });
});

describe('UX 2: clearing can always be undone until the next word', () => {
  it('one word clear gets a sticky Undo that the next word dismisses', () => {
    st().addWord({ text: 'help' });
    st().clearMessage();
    expect(st().toast).toBeTruthy();
    expect(st().toastAction?.label).toBe('Undo');
    st().toastAction!.run();
    expect(words()).toEqual(['help']);
    st().clearMessage();
    st().addWord({ text: 'more' });
    expect(st().toast).toBeNull();
  });
  it('a draft-only clear can be undone too', () => {
    st().setDraft('hel');
    st().clearMessage();
    st().toastAction!.run();
    expect(st().draft).toBe('hel');
  });
});

describe('defect 2: phrases always speak; editing needs an explicit switch', () => {
  it('content editing needs Settings unlocked and ends when leaving the screen', () => {
    st().openContentEditor('phrases');
    expect(st().screen).toBe('talk');
    useStore.setState({ unlocked: true });
    st().openContentEditor('phrases');
    expect(st()).toMatchObject({ screen: 'phrases', contentEdit: true });
    st().setScreen('talk');
    expect(st().contentEdit).toBe(false);
    st().openContentEditor('schedule');
    expect(st()).toMatchObject({ screen: 'tools', tool: 'schedule', contentEdit: true, unlocked: true });
    st().setUnlocked(false);
    expect(st().contentEdit).toBe(false);
    st().setContentEdit(true);
    expect(st().contentEdit).toBe(false);
  });
});

describe('service-worker update waits', () => {
  const idle = { message: [], draft: '', editMode: false, unlocked: false, contentEdit: false, timer: { total: 0, left: 0, endAt: null } };
  it('reloads only when nothing is going on', () => {
    expect(updateCanReload(idle)).toBe(true);
    expect(updateCanReload({ ...idle, timer: { total: 60, left: 30, endAt: Date.now() + 30000 } })).toBe(false);
    expect(updateCanReload({ ...idle, unlocked: true })).toBe(false);
    expect(updateCanReload({ ...idle, editMode: true })).toBe(false);
    expect(updateCanReload({ ...idle, draft: 'h' })).toBe(false);
    expect(updateCanReload(idle, true)).toBe(false);
  });
});

describe('defect 13: speech failures surface, calmly', () => {
  it('reports each kind once per quiet period', () => {
    resetFailures();
    const seen: TtsFailure[] = [];
    setTtsFailureHandler((k) => seen.push(k));
    expect(reportFailure('no-voices', 1000)).toBe(true);
    expect(reportFailure('no-voices', 2000)).toBe(false);
    expect(reportFailure('not-allowed', 2000)).toBe(true);
    expect(reportFailure('no-voices', 1000 + FAILURE_QUIET_MS)).toBe(true);
    expect(seen).toEqual(['no-voices', 'not-allowed', 'no-voices']);
    setTtsFailureHandler(null);
  });
  it('a browser with no speech engine reports it', () => {
    resetFailures();
    const seen: TtsFailure[] = [];
    setTtsFailureHandler((k) => seen.push(k));
    st().speakText('hello'); // Node has no speechSynthesis
    expect(seen).toEqual(['no-engine']);
    setTtsFailureHandler(null);
  });
});

describe('UX 6: schedule ticks belong to one day', () => {
  const sched = (tickedOn?: string, done = true): Schedule => ({ id: 's', name: 'Morning', tickedOn, steps: [{ id: 'a', label: 'Eat', done }, { id: 'b', label: 'Dress' }] });
  it('resets ticks from an earlier day', () => {
    const out = resetStaleTicks([sched('2026-11-11')], '2026-11-12')!;
    expect(out[0].steps.every((x) => !x.done)).toBe(true);
    expect(out[0].tickedOn).toBeUndefined();
  });
  it("keeps today's ticks and leaves untouched schedules alone", () => {
    expect(resetStaleTicks([sched('2026-11-12')], '2026-11-12')).toBeNull();
    expect(resetStaleTicks([sched(undefined, false)], '2026-11-12')).toBeNull();
  });
  it('ticks saved before dates existed count as today (no surprise reset after updating)', () => {
    const out = resetStaleTicks([sched(undefined)], '2026-11-12')!;
    expect(out[0].steps[0].done).toBe(true);
    expect(out[0].tickedOn).toBe('2026-11-12');
  });
  it('localDay is the local calendar date', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('UX 9: tools can be hidden', () => {
  const p = (hiddenTools: string[], enabled = true) => ({ aboutMe: { enabled, text: '', contacts: '' }, settings: { hiddenTools } as never });
  it('hides listed tools and follows aboutMe.enabled', () => {
    expect(toolShown(p([]), 'timer')).toBe(true);
    expect(toolShown(p(['timer']), 'timer')).toBe(false);
    expect(toolShown(p([], false), 'aboutme')).toBe(false);
    expect(toolShown(p(['aboutme'], true), 'aboutme')).toBe(false);
    expect(toolShown({ aboutMe: { enabled: true, text: '', contacts: '' }, settings: {} as never }, 'draw')).toBe(true);
  });
});

describe('My voice controls', () => {
  it('speed stepper stays in range', () => {
    expect(stepRate(1, 1)).toBe(1.1);
    expect(stepRate(1.05, -1)).toBe(1);
    expect(stepRate(0.5, -1)).toBe(0.5);
    expect(stepRate(1.8, 1)).toBe(1.8);
    expect(stepRate(Number.NaN, 1)).toBe(1.1);
  });
  it('volume presets pick the nearest', () => {
    expect(nearestVolumePreset(1)).toBe('loud');
    expect(nearestVolumePreset(0.65)).toBe('medium');
    expect(nearestVolumePreset(0.1)).toBe('quiet');
  });
});

describe('Insights: new words and export', () => {
  const DAY = 86400000;
  const now = Date.UTC(2026, 10, 12, 12);
  const e = (daysAgo: number, text: string, kind: LogEntry['kind'] = 'word'): LogEntry => ({ t: now - daysAgo * DAY, profileId: 'p', kind, text });
  it('compares with everything before the period, even at 90 days', () => {
    const log = [e(200, 'want'), e(100, 'more'), e(10, 'want'), e(5, 'juice'), e(3, 'more')];
    const s90 = insightStats(log, 90, now);
    expect(s90.hasEarlier).toBe(true);
    expect(s90.newWords).toEqual(['juice']); // "want" and "more" were used more than 90 days ago
    expect(insightStats(log, 7, now).newWords).toEqual(['juice']);
  });
  it('calls nothing new when there is no earlier log', () => {
    const s = insightStats([e(3, 'want'), e(1, 'juice')], 90, now);
    expect(s.hasEarlier).toBe(false);
    expect(s.newWords).toEqual([]);
  });
  it('exports the whole log, oldest first', () => {
    const csv = usageCsv([e(1, 'b'), e(400, 'a "quoted"')]).split('\n');
    expect(csv.length).toBe(3);
    expect(csv[1]).toContain('"a ""quoted"""');
  });
});
