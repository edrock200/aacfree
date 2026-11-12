import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createSyncFile, mergeData, openSyncFile, peekSyncFile } from '../sync';
import { buildProfile } from '../../data/defaults';
import type { AppData } from '../../types';

const data = (): AppData => {
  const p = buildProfile('Sam', 'medium');
  p.updatedAt = 1000;
  return { version: 1, profiles: [p], activeProfileId: p.id, onboarded: true, library: { categories: [], additions: {} } };
};

describe('encrypted device sync', () => {
  it('round-trips with the right passcode and rejects a wrong one', async () => {
    const d = data();
    d.profiles[0].boards.home.cells[0]!.label = 'ME';
    const blob = await createSyncFile(d, [d.profiles[0].id], 'tiger-cloud-41');
    const text = await blob.text();
    expect(text).not.toContain('"ME"'); // contents are encrypted
    const f = peekSyncFile(text);
    expect(f.profiles).toEqual(['Sam']);
    await expect(openSyncFile(f, 'wrong-pass')).rejects.toThrow(/Wrong passcode/);
    const out = await openSyncFile(f, 'tiger-cloud-41');
    expect(out.profiles[0].boards.home.cells[0]!.label).toBe('ME');
  }, 30000);

  it('rejects short passcodes', async () => {
    const d = data();
    await expect(createSyncFile(d, [d.profiles[0].id], '123')).rejects.toThrow();
  });

  it('merges: newest profile wins, new profiles are added, libraries combine', () => {
    const local = data();
    const incoming = structuredClone(local);
    incoming.profiles[0].name = 'Sam (tablet)';
    incoming.profiles[0].updatedAt = 2000;
    const extra = buildProfile('Ava', 'big');
    incoming.profiles.push(extra);
    incoming.library.categories.push({ id: 'c1', name: 'Soccer', symbols: [{ id: 's1', label: 'goal', symbol: 'e:🥅' }] });
    const { data: merged, summary } = mergeData(local, incoming);
    expect(summary.updated).toEqual(['Sam (tablet)']);
    expect(summary.added).toEqual(['Ava']);
    expect(merged.profiles.length).toBe(2);
    expect(merged.library.categories[0].name).toBe('Soccer');
    // older incoming copy is ignored
    const older = structuredClone(local);
    older.profiles[0].updatedAt = 10;
    older.profiles[0].name = 'Old';
    expect(mergeData(local, older).summary.kept).toEqual(['Sam']);
  });
});

import { createBackup, decryptBackup, isEncryptedBackup, readBackup } from '../backup';

describe('backup options', () => {
  it('encrypts backups with a passcode and restores them', async () => {
    const d = data();
    d.profiles[0].history = [{ text: 'secret sentence', t: 1 }];
    const text = await (await createBackup(d, { passcode: 'family-pass-1' })).text();
    expect(isEncryptedBackup(text)).toBe(true);
    expect(text).not.toContain('secret sentence');
    await expect(decryptBackup(text, 'nope-nope')).rejects.toThrow(/Wrong passcode/);
    const restored = await readBackup(await decryptBackup(text, 'family-pass-1'));
    expect(restored.profiles[0].history[0].text).toBe('secret sentence');
  }, 30000);
  it('can leave out history and learned words', async () => {
    const d = data();
    d.profiles[0].history = [{ text: 'private', t: 1 }];
    d.profiles[0].lexicon = { zzlearnedword: 3 };
    const text = await (await createBackup(d, { includeHistory: false })).text();
    expect(isEncryptedBackup(text)).toBe(false);
    expect(text).not.toContain('private');
    expect(text).not.toContain('zzlearnedword');
  });
});
