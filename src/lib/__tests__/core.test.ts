import { describe, expect, it } from 'vitest';
import { applyEnding, comparatives, formsFor, plural, verbForms } from '../morphology';
import { joinWords } from '../sentence';
import { predict } from '../predict';
import { findWord, resizeBoard, boardPaths, orphanBoards, vocabularyWords } from '../boards';
import { referencedAssets } from '../backup';
import { buildProfile, searchBundled } from '../../data/defaults';
import { CATEGORIES, HOME_LAYOUTS, parseSpec } from '../../data/vocab';

describe('morphology', () => {
  it('pluralises nouns', () => {
    expect(plural('apple')).toBe('apples');
    expect(plural('box')).toBe('boxes');
    expect(plural('baby')).toBe('babies');
    expect(plural('toy')).toBe('toys');
    expect(plural('child')).toBe('children');
    expect(plural('mouse')).toBe('mice');
  });
  it('inflects verbs', () => {
    expect(verbForms('go')).toEqual({ s: 'goes', ing: 'going', ed: 'went', en: 'gone' });
    expect(verbForms('play')).toEqual({ s: 'plays', ing: 'playing', ed: 'played', en: 'played' });
    expect(verbForms('stop').ing).toBe('stopping');
    expect(verbForms('make').ing).toBe('making');
    expect(verbForms('cry').ed).toBe('cried');
    expect(verbForms('watch').s).toBe('watches');
    expect(verbForms('tie').ing).toBe('tying');
    expect(verbForms('see').ing).toBe('seeing');
    expect(verbForms('open').ing).toBe('opening');
  });
  it('compares adjectives', () => {
    expect(comparatives('big')).toEqual(['bigger', 'biggest']);
    expect(comparatives('happy')).toEqual(['happier', 'happiest']);
    expect(comparatives('good')).toEqual(['better', 'best']);
    expect(comparatives('nice')).toEqual(['nicer', 'nicest']);
    expect(comparatives('beautiful')).toEqual(['more beautiful', 'most beautiful']);
  });
  it('offers forms by type and skips pronouns', () => {
    expect(formsFor('eat', 'verb')).toContain('ate');
    expect(formsFor('wake up', 'verb')).toContain('woke up');
    expect(formsFor('dog', 'noun')).toContain('dogs');
    expect(formsFor('I', 'pronoun')).toEqual([]);
  });
  it('applies quick endings', () => {
    expect(applyEnding('jump', 'ed', 'verb')).toBe('jumped');
    expect(applyEnding('cat', 's', 'noun')).toBe('cats');
    expect(applyEnding('eat', 's', 'verb')).toBe('eats');
  });
});

describe('sentence joining', () => {
  it('joins words with smart spacing', () => {
    expect(joinWords([{ text: 'i' }, { text: 'want' }, { text: 'juice' }, { text: '.' }])).toBe('I want juice.');
    expect(joinWords([{ text: 'can' }, { text: "'t" }])).toBe("can't");
    expect(joinWords([])).toBe('');
  });
});

describe('prediction', () => {
  const ctx = { vocabulary: ['trampoline', 'want'], lexicon: { trampoline: 3 }, history: [{ text: 'I want juice' }, { text: 'I want juice' }] };
  it('completes prefixes, favouring the person\'s own words', () => {
    expect(predict('tra', undefined, ctx)[0]).toBe('trampoline');
    expect(predict('wa', undefined, ctx)).toContain('want');
  });
  it('predicts next word from history', () => {
    expect(predict('', 'want', ctx)[0]).toBe('juice');
  });
  it('capitalises I', () => {
    expect(predict('', undefined, { vocabulary: [], lexicon: {}, history: [] })).toContain('I');
  });
});

describe('default vocabulary', () => {
  for (const layout of ['big', 'medium', 'full'] as const) {
    it(`builds a valid ${layout} profile`, () => {
      const p = buildProfile('Test', layout);
      expect(p.boards[p.rootId]).toBeTruthy();
      for (const b of Object.values(p.boards)) {
        expect(b.cells.length).toBe(b.cols * b.rows);
        for (const c of b.cells) {
          if (c?.link) expect(p.boards[c.link], `${b.id} → ${c.link}`).toBeTruthy();
        }
      }
      // Every category board is reachable from home (via More).
      expect(orphanBoards(p)).toEqual([]);
      expect(p.quickBar.map((q) => q.label)).toEqual(expect.arrayContaining(['no', 'stop', 'help']));
    });
  }
  it('home layouts have the right number of cells', () => {
    for (const l of Object.values(HOME_LAYOUTS)) expect(l.cells.length).toBe(l.cols * l.rows);
  });
  it('most words have a bundled symbol', () => {
    const p = buildProfile('', 'full');
    const cells = Object.values(p.boards).flatMap((b) => b.cells).filter(Boolean);
    const withSym = cells.filter((c) => c!.symbol);
    expect(withSym.length / cells.length).toBeGreaterThan(0.95);
  });
  it('category ids are unique and do not clash with built-in boards', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('home');
    expect(ids).not.toContain('more');
  });
  it('parses specs', () => {
    expect(parseSpec('v:all done@finished')).toMatchObject({ label: 'all done', type: 'verb', keyword: 'finished' });
    expect(parseSpec("s:I don't know|I don't know@not know")).toMatchObject({ label: "I don't know", speak: "I don't know", keyword: 'not know' });
    expect(parseSpec('dress#2613', 'noun')).toMatchObject({ label: 'dress', id: 2613 });
    expect(parseSpec('m:Hey!~👋')).toMatchObject({ label: 'Hey!', emoji: '👋' });
  });
  it('searches bundled symbols', () => {
    expect(searchBundled('apple')[0].keyword).toBe('apple');
  });
});

describe('boards', () => {
  it('resizes keeping row/col positions', () => {
    const p = buildProfile('', 'big');
    const home = p.boards.home; // 4×3
    const { board, lost } = resizeBoard(home, 5, 3);
    expect(lost).toBe(0);
    expect(board.cells[0]?.label).toBe(home.cells[0]?.label);
    expect(board.cells[5]?.label).toBe(home.cells[4]?.label); // row 1 col 0
    expect(board.cells[4]).toBeNull();
    expect(resizeBoard(home, 3, 3).lost).toBe(3);
  });
  it('finds words and the path to them', () => {
    const p = buildProfile('', 'medium');
    const r = findWord(p, 'pizza')[0];
    expect(r.button.label).toBe('pizza');
    expect(r.path).toEqual(['home', 'food']);
    expect(r.folderButtonIds.length).toBe(1);
    expect(boardPaths(p).home).toEqual(['home']);
  });
  it('lists vocabulary words', () => {
    expect(vocabularyWords(buildProfile('', 'medium'))).toContain('banana');
  });
});

describe('backup', () => {
  it('collects referenced asset ids', () => {
    const ids = referencedAssets({ a: { symbol: 'img:photo-1', audio: 'audio-2' }, b: [{ symbol: 'a:123' }] });
    expect([...ids].sort()).toEqual(['audio-2', 'photo-1']);
  });
});
