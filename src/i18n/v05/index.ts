import { UI as data } from './data';
import { UI as access } from './access';
import { UI as lang } from './lang';
import { UI as talk } from './talk';
import { UI as sync } from './sync';

/** v0.5 strings, kept in one file per work area so parallel work never collides. */
export function v05(id: 'es' | 'fr' | 'pt'): Record<string, string> {
  return { ...data[id], ...access[id], ...lang[id], ...talk[id], ...sync[id] };
}
