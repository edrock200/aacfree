import { describe, expect, it } from 'vitest';
import { autoConjugateFr, conjugateFr, formsForFr, pluralFr } from '../morphology-fr';
import { autoConjugatePt, conjugatePt, formsForPt, pluralPt } from '../morphology-pt';
import { buildProfile } from '../../data/defaults';
import { secondWord, translateProfile } from '../translate';
import { LANGUAGES, PACKS, type Lang } from '../../i18n/packs';
import { HOME_LAYOUTS, QUICK_BAR, CATEGORIES, parseSpec } from '../../data/vocab';

describe('French grammar', () => {
  it('conjugates and elides', () => {
    expect(conjugateFr('vouloir', 0)).toBe('veux');
    expect(conjugateFr('manger', 3)).toBe('mangeons');
    expect(conjugateFr('finir', 2)).toBe('finit');
    expect(conjugateFr('attendre', 0)).toBe('attends');
    expect(autoConjugateFr(['je'], 'aimer')).toEqual({ text: "j'aime", dropPrevious: 1 });
    expect(autoConjugateFr(['tu'], 'aller')).toEqual({ text: 'vas', dropPrevious: 0 });
    expect(autoConjugateFr(['chat'], 'manger')).toBeNull();
  });
  it('makes plurals and forms', () => {
    expect(pluralFr('chat')).toBe('chats');
    expect(pluralFr('gâteau')).toBe('gâteaux');
    expect(pluralFr('cheval')).toBe('chevaux');
    expect(pluralFr('nez')).toBe('nez');
    expect(formsForFr('content', 'descriptor')).toContain('contente');
    expect(formsForFr('manger', 'verb')).toContain('mangé');
  });
});

describe('Portuguese grammar', () => {
  it('conjugates', () => {
    expect(conjugatePt('querer', 0)).toBe('quero');
    expect(conjugatePt('falar', 3)).toBe('falamos');
    expect(conjugatePt('comer', 4)).toBe('comem');
    expect(autoConjugatePt(['eu'], 'gostar')).toEqual({ text: 'gosto de', dropPrevious: 0 });
    expect(autoConjugatePt(['eu', 'não'], 'ir')).toEqual({ text: 'vou', dropPrevious: 0 });
    expect(autoConjugatePt(['a', 'gente'], 'brincar')).toEqual({ text: 'brinca', dropPrevious: 0 });
  });
  it('makes plurals and forms', () => {
    expect(pluralPt('casa')).toBe('casas');
    expect(pluralPt('avião')).toBe('aviões');
    expect(pluralPt('animal')).toBe('animais');
    expect(pluralPt('flor')).toBe('flores');
    expect(formsForPt('feliz', 'descriptor')).toContain('felizes');
    expect(formsForPt('comer', 'verb')).toEqual(expect.arrayContaining(['como', 'comi', 'comendo']));
  });
});

describe('language packs', () => {
  const langs = LANGUAGES.map((l) => l.id).filter((l) => l !== 'en') as Lang[];
  it('every pack translates every built-in word', () => {
    const labels = new Set<string>();
    const add = (spec: string) => { if (spec && !spec.startsWith('>') && !spec.startsWith('!')) labels.add(parseSpec(spec).label); };
    CATEGORIES.forEach((c) => c.items.forEach(add));
    Object.values(HOME_LAYOUTS).forEach((l) => l.cells.forEach(add));
    QUICK_BAR.forEach(add);
    for (const l of langs) {
      const missing = [...labels].filter((x) => !(x in PACKS[l].vocab!.labels) && !(x.toLowerCase() in PACKS[l].vocab!.labels));
      expect(missing, l).toEqual([]);
    }
  });
  for (const a of ['en', ...langs] as Lang[]) {
    for (const b of langs.filter((x) => x !== a)) {
      it(`switches ${a} → ${b} → ${a} without moving or losing words`, () => {
        const start = buildProfile('Sam', 'full', a);
        const there = translateProfile(start, b);
        const back = translateProfile(there, a);
        for (const id of Object.keys(start.boards)) {
          const s0 = start.boards[id].cells.map((c) => c?.label ?? null);
          expect(there.boards[id].cells.map((c) => !!c)).toEqual(s0.map((x) => !!x));
          expect(back.boards[id].cells.map((c) => c?.label ?? null), `${id}`).toEqual(s0);
          expect(back.boards[id].name).toBe(start.boards[id].name);
        }
        expect(there.settings.language).toBe(b);
        expect(there.settings.lang).toBe(PACKS[b].voice);
      });
    }
  }
  it('shows a second-language label', () => {
    const es = buildProfile('', 'medium', 'es');
    const yo = es.boards.home.cells[0]!;
    expect(secondWord(yo, 'es', 'en')).toBe('I');
    expect(secondWord(yo, 'es', 'fr')).toBe(PACKS.fr.vocab!.labels.I as string);
    const en = buildProfile('', 'medium', 'en');
    expect(secondWord(en.boards.home.cells[0]!, 'en', 'es')).toBe('yo');
    const food = en.boards.home.cells.find((c) => c?.link === 'food')!;
    expect(secondWord(food, 'en', 'pt')).toBe(PACKS.pt.vocab!.categories.food);
  });
  it('builds profiles with a translated About me', () => {
    expect(buildProfile('Léa', 'big', 'fr').aboutMe.text).toContain('Léa');
    expect(buildProfile('Ana', 'big', 'pt').aboutMe.text).toMatch(/^Oi!/);
  });
});
