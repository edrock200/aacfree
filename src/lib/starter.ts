import type { AACButton, AppData, Board } from '../types';

/** Highest-value first words for beginners (Project Core / common first core words), as English originals. */
export const STARTER_WORDS = ['i', 'you', 'want', 'more', 'help', 'stop', 'go', 'like', 'not', 'all done', 'eat', 'drink', 'play', 'what', 'look', 'open', 'turn', 'different', 'get', 'it'];

/**
 * True if a button is one of the starter words, in any language: built-in
 * buttons are matched on their English original (`key`), so "quiero" counts as
 * "want"; the family's own buttons on their label.
 */
export function isStarterWord(c: Pick<AACButton, 'key' | 'label'>): boolean {
  return STARTER_WORDS.includes((c.key ?? c.label).trim().toLowerCase());
}

/**
 * Starter mode for a board: show only the starter words, folders and action
 * buttons; every other word is hidden but keeps its place (motor planning).
 */
export function applyStarterWords(board: Board): void {
  for (const c of board.cells) {
    if (!c || c.link || c.action) continue;
    if (isStarterWord(c)) delete c.hidden;
    else c.hidden = true;
  }
}

/**
 * True while the data is still the untouched default (a fresh install, before
 * anything was set up or changed): nothing worth backing up, and an automatic
 * backup must not rotate out a family's real backups.
 */
export function isUntouchedDefault(data: AppData): boolean {
  if (!data.onboarded) return true;
  return data.profiles.every((p) => !p.updatedAt && !p.history?.length)
    && !data.library?.categories?.length && !Object.keys(data.library?.additions ?? {}).length;
}
