import { describe, expect, it } from 'vitest';
import { autoConjugate, conjugate, formsForEs, pluralEs } from '../morphology-es';
import { buildProfile } from '../../data/defaults';
import { translateProfile } from '../translate';
import { ES_LABELS } from '../../data/i18n/es-vocab';
import { predict } from '../predict';
import { setLang } from '../../i18n';

describe('Spanish grammar', () => {
  it('conjugates regular and irregular verbs', () => {
    expect(conjugate('hablar', 0)).toBe('hablo');
    expect(conjugate('comer', 3)).toBe('comemos');
    expect(conjugate('vivir', 4)).toBe('viven');
    expect(conjugate('querer', 0)).toBe('quiero');
    expect(conjugate('ir', 2)).toBe('va');
    expect(conjugate('lavarse', 0)).toBe('me lavo');
    expect(conjugate('lavar manos', 0)).toBe('lavo manos');
  });
  it('makes plurals', () => {
    expect(pluralEs('manzana')).toBe('manzanas');
    expect(pluralEs('lápiz')).toBe('lápices');
    expect(pluralEs('camión')).toBe('camiones');
    expect(pluralEs('flor')).toBe('flores');
    expect(pluralEs('lunes')).toBe('lunes');
  });
  it('offers word forms', () => {
    expect(formsForEs('comer', 'verb')).toEqual(expect.arrayContaining(['como', 'comí', 'comiendo']));
    expect(formsForEs('gustar', 'verb')).toContain('me gusta');
    expect(formsForEs('contento', 'descriptor')).toEqual(expect.arrayContaining(['contenta', 'contentos']));
    expect(formsForEs('yo', 'pronoun')).toEqual([]);
  });
  it('auto-conjugates after a subject pronoun', () => {
    expect(autoConjugate(['yo'], 'querer')).toEqual({ text: 'quiero', dropPrevious: 0 });
    expect(autoConjugate(['ella', 'no'], 'comer')).toEqual({ text: 'come', dropPrevious: 0 });
    expect(autoConjugate(['yo'], 'gustar')).toEqual({ text: 'me gusta', dropPrevious: 1 });
    expect(autoConjugate(['yo', 'no'], 'gustar')).toEqual({ text: 'no me gusta', dropPrevious: 2 });
    expect(autoConjugate(['más'], 'comer')).toBeNull();
    expect(autoConjugate(['yo'], 'casa')).toBeNull();
  });
});

describe('language switching', () => {
  for (const layout of ['big', 'compact', 'medium', 'full'] as const) {
    it(`translates the ${layout} layout in place and back again`, () => {
      const en = buildProfile('Sam', layout);
      const es = translateProfile(en, 'es');
      const back = translateProfile(es, 'en');
      for (const id of Object.keys(en.boards)) {
        const a = en.boards[id].cells;
        const b = es.boards[id].cells;
        const c = back.boards[id].cells;
        expect(b.length).toBe(a.length); // same grid
        a.forEach((cell, i) => {
          expect(!!b[i]).toBe(!!cell); // same positions
          if (cell) expect(c[i]!.label.toLowerCase()).toBe(cell.label.toLowerCase()); // exact round trip
        });
      }
      expect(es.settings.language).toBe('es');
      expect(es.settings.lang).toMatch(/^es/);
    });
  }
  it('translates every built-in word', () => {
    const es = buildProfile('', 'full', 'es');
    const words = Object.values(es.boards).flatMap((b) => b.cells).filter((c) => c && !c.link && !c.action);
    const untranslated = words.filter((c) => !c!.key);
    expect(untranslated.map((c) => c!.label)).toEqual([]);
    expect(es.boards.home.cells[0]!.label).toBe((ES_LABELS.I as string) ?? 'yo');
    expect(es.quickBar.map((q) => q.label)).toContain('no');
  });
  it('predicts Spanish words with or without accents', () => {
    setLang('es');
    expect(predict('mas', undefined, { vocabulary: [], lexicon: {}, history: [] })).toContain('más');
    expect(predict('', 'yo', { vocabulary: [], lexicon: {}, history: [] }).length).toBeGreaterThan(3);
    setLang('en');
  });
});
