import { describe, expect, it } from 'vitest';
import { aboutMeText, translateProfile } from '../translate';
import { buildProfile } from '../../data/defaults';

describe('About me card (v0.7 wording)', () => {
  it('the default text no longer assumes autism', () => {
    for (const lang of ['en', 'es', 'fr', 'pt'] as const) {
      expect(aboutMeText(lang, 'Sam')).not.toMatch(/autis/i);
      expect(aboutMeText(lang, 'Sam')).toContain('Sam');
    }
  });

  it('an untouched card with the old "I am autistic" text still follows a language switch', () => {
    const p = buildProfile('Sam', 'medium');
    p.aboutMe = { ...p.aboutMe, text: 'Hi! My name is Sam. I am autistic and I use this app to communicate. Please be patient and give me extra time to answer. I understand more than I can say.' };
    const es = translateProfile(p, 'es');
    expect(es.aboutMe.text).toBe(aboutMeText('es', 'Sam'));
  });

  it('a card the family wrote is never replaced', () => {
    const p = buildProfile('Sam', 'medium');
    p.aboutMe = { ...p.aboutMe, text: 'I love trains. Ask me about the Flying Scotsman.' };
    expect(translateProfile(p, 'fr').aboutMe.text).toBe('I love trains. Ask me about the Flying Scotsman.');
  });
});
