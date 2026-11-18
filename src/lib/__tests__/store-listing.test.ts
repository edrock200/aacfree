import { describe, expect, it } from 'vitest';

// App Store listing text (fastlane/apple/metadata/<locale>/*.txt) must stay within Apple's limits.
const files = import.meta.glob('../../../fastlane/apple/metadata/*/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const LIMITS: Record<string, number> = { name: 30, subtitle: 30, promotional_text: 170, description: 4000, release_notes: 4000 };

describe('App Store listing text', () => {
  const locales = new Set(Object.keys(files).map((f) => f.split('/').slice(-2)[0]));

  it('has every field for every language', () => {
    expect([...locales].sort()).toEqual(['en-US', 'es-MX', 'fr-FR', 'pt-BR']);
    for (const loc of locales) {
      for (const field of ['name', 'subtitle', 'promotional_text', 'description', 'keywords', 'support_url', 'privacy_url']) {
        expect(Object.keys(files).some((f) => f.endsWith(`/${loc}/${field}.txt`)), `${loc}/${field}`).toBe(true);
      }
    }
  });

  it('stays within the character limits', () => {
    for (const [file, text] of Object.entries(files)) {
      const field = file.split('/').pop()!.replace('.txt', '');
      const s = text.trim();
      if (field === 'keywords') {
        expect(new TextEncoder().encode(s).length, file).toBeLessThanOrEqual(100);
        expect(s, file).not.toMatch(/,\s/); // spaces after commas waste characters
      } else if (LIMITS[field]) {
        expect(s.length, file).toBeLessThanOrEqual(LIMITS[field]);
      }
    }
  });

  it('never uses the earlier name or mentions other platforms', () => {
    for (const [file, text] of Object.entries(files)) {
      expect(text, file).not.toMatch(/caleb|android|google play/i);
    }
  });
});
