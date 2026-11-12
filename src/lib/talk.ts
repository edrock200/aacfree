import type { Profile, Schedule } from '../types';
import type { LogEntry } from './db';

const DAY = 86400000;

/**
 * Usage insights for one period. `log` must be the WHOLE log (not just the period), so
 * "new words" really means "not used before this period". When nothing was logged before
 * the period, `hasEarlier` is false and no word is called new.
 */
export function insightStats(log: LogEntry[], range: number, now = Date.now()) {
  const since = now - range * DAY;
  const all = log.filter((e) => e.t >= since);
  // Partner modelling is shown separately: it is not the person's own communication.
  const modeled = all.filter((e) => e.modeled).length;
  const inRange = all.filter((e) => !e.modeled);
  const words = inRange.filter((e) => e.kind === 'word');
  const counts = new Map<string, number>();
  words.forEach((w) => counts.set(w.text.toLowerCase(), (counts.get(w.text.toLowerCase()) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const days: { label: string; n: number }[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const t0 = start.getTime() - i * DAY;
    const n = inRange.filter((e) => e.t >= t0 && e.t < t0 + DAY).length;
    days.push({ label: new Date(t0).toLocaleDateString(undefined, { weekday: 'narrow', day: 'numeric' }), n });
  }
  const earlier = log.filter((e) => e.t < since && !e.modeled);
  const hasEarlier = earlier.length > 0;
  const before = new Set(earlier.filter((e) => e.kind === 'word').map((e) => e.text.toLowerCase()));
  const newWords = hasEarlier ? [...counts.keys()].filter((w) => !before.has(w)) : [];
  const sentences = inRange.filter((e) => e.kind === 'sentence');
  const avgLen = sentences.length ? sentences.reduce((a, e) => a + e.text.split(/\s+/).length, 0) / sentences.length : 0;
  return { modeled, total: inRange.length, words: words.length, unique: counts.size, top, days, newWords, hasEarlier, sentences, avgLen, phrases: inRange.filter((e) => e.kind === 'phrase').length };
}

/** CSV of the whole usage log (oldest first), for a therapist. */
export function usageCsv(log: LogEntry[]): string {
  const rows = [['time', 'kind', 'by', 'text'], ...[...log].sort((a, b) => a.t - b.t).map((e) => [new Date(e.t).toISOString(), e.kind, e.modeled ? 'partner' : 'user', `"${e.text.replace(/"/g, '""')}"`])];
  return rows.map((r) => r.join(',')).join('\n');
}

/** Local calendar day, e.g. "2026-11-12" (schedule ticks belong to one day). */
export function localDay(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Schedules whose ticks are from an earlier day, with the ticks cleared (null when nothing changes). */
export function resetStaleTicks(schedules: Schedule[], today: string): Schedule[] | null {
  let changed = false;
  const out = schedules.map((s) => {
    const ticked = s.steps.some((st) => st.done);
    if (!ticked || s.tickedOn === today) return s;
    changed = true;
    // Ticks saved before dates were kept: count them as today's, so nobody loses progress mid-routine.
    if (!s.tickedOn) return { ...s, tickedOn: today };
    return { ...s, tickedOn: undefined, steps: s.steps.map((st) => ({ ...st, done: false })) };
  });
  return changed ? out : null;
}

/** Is this tool shown in the Tools menu? About me also follows its own on/off switch. */
export function toolShown(p: Pick<Profile, 'aboutMe' | 'settings'>, id: string): boolean {
  const hidden = Array.isArray(p.settings.hiddenTools) ? p.settings.hiddenTools : [];
  if (hidden.includes(id)) return false;
  if (id === 'aboutme') return p.aboutMe?.enabled !== false;
  return true;
}

/** Three volume presets for "My voice" (the person's own control). */
export const VOLUME_PRESETS = [
  { id: 'quiet', label: 'Quiet', value: 0.4 },
  { id: 'medium', label: 'Normal', value: 0.7 },
  { id: 'loud', label: 'Loud', value: 1 },
] as const;

/** The preset closest to a volume (so a slider value set in Grown-ups still shows a choice). */
export function nearestVolumePreset(volume: number): (typeof VOLUME_PRESETS)[number]['id'] {
  let best: (typeof VOLUME_PRESETS)[number] = VOLUME_PRESETS[2];
  for (const p of VOLUME_PRESETS) if (Math.abs(p.value - volume) < Math.abs(best.value - volume)) best = p;
  return best.id;
}

export const RATE_MIN = 0.5;
export const RATE_MAX = 1.8;
/** Speed stepper: one step slower or faster, kept in range and rounded to 0.1. */
export function stepRate(rate: number, dir: -1 | 1): number {
  const r = Math.round(((Number.isFinite(rate) ? rate : 1) + dir * 0.1) * 10) / 10;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, r));
}
