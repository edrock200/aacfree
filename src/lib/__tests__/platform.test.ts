import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { cleanLock, DEFAULT_LOCK, keepDeviceLock, migrateLock, withoutPin } from '../lock';
import { keepAwakeAvailable, setKeepAwake } from '../wakelock';
import { migrate, useStore } from '../../store';
import { mergeData } from '../sync';
import { buildProfile, DEFAULT_SETTINGS } from '../../data/defaults';
import type { AppData, Profile } from '../../types';

import indexHtml from '../../../index.html?raw';
import screenJava from '../../../android/app/src/main/java/org/calebaac/app/AACFreeScreenPlugin.java?raw';
import mainJava from '../../../android/app/src/main/java/org/calebaac/app/MainActivity.java?raw';
import filePaths from '../../../android/app/src/main/res/xml/file_paths.xml?raw';
import androidYml from '../../../.github/workflows/android.yml?raw';
import ciYml from '../../../.github/workflows/ci.yml?raw';
import pagesYml from '../../../.github/workflows/pages.yml?raw';

const FILES: Record<string, string> = {
  'index.html': indexHtml,
  'android/app/src/main/java/org/calebaac/app/AACFreeScreenPlugin.java': screenJava,
  'android/app/src/main/java/org/calebaac/app/MainActivity.java': mainJava,
  'android/app/src/main/res/xml/file_paths.xml': filePaths,
  '.github/workflows/android.yml': androidYml,
  '.github/workflows/ci.yml': ciYml,
  '.github/workflows/pages.yml': pagesYml,
};
const read = (p: string) => FILES[p];

/** A profile as saved by v0.4 and earlier (lock and PIN inside settings). */
function legacyProfile(name: string, lock?: string, pin?: string, updatedAt = 1): Profile {
  const p = buildProfile(name, 'medium');
  const s = p.settings as unknown as Record<string, unknown>;
  if (lock !== undefined) s.lock = lock;
  if (pin !== undefined) s.pin = pin;
  p.updatedAt = updatedAt;
  return p;
}

function data(profiles: Profile[], active = 0): AppData {
  return { version: 1, profiles, activeProfileId: profiles[active].id, onboarded: true, library: { categories: [], additions: {} } };
}

const settingsOf = (p: Profile) => p.settings as unknown as Record<string, unknown>;

describe('app-wide settings lock (defect 29)', () => {
  it('defaults to hold-to-open when nothing was stored', () => {
    const d = migrateLock(data([buildProfile('A', 'medium')]));
    expect(d.grownUpLock).toEqual(DEFAULT_LOCK);
  });

  it('keeps the strongest lock: a PIN on any profile wins, even if it is not the active one', () => {
    const d = migrateLock(data([legacyProfile('A', 'none'), legacyProfile('B', 'pin', '4321'), legacyProfile('C', 'hold')], 0));
    expect(d.grownUpLock).toEqual({ lock: 'pin', pin: '4321' });
    expect(d.grownUpLock?.pinNotice).toBeUndefined();
  });

  it('removes the per-profile fields from every profile', () => {
    const d = migrateLock(data([legacyProfile('A', 'pin', '1111'), legacyProfile('B', 'math')]));
    for (const p of d.profiles) {
      expect('lock' in settingsOf(p)).toBe(false);
      expect('pin' in settingsOf(p)).toBe(false);
    }
  });

  it('orders the others none < hold < math', () => {
    expect(migrateLock(data([legacyProfile('A', 'none'), legacyProfile('B', 'math')])).grownUpLock?.lock).toBe('math');
    expect(migrateLock(data([legacyProfile('A', 'none'), legacyProfile('B', 'hold')])).grownUpLock?.lock).toBe('hold');
    expect(migrateLock(data([legacyProfile('A', 'none'), legacyProfile('B', 'none')])).grownUpLock?.lock).toBe('none');
  });

  it('with different PINs keeps the active profile\'s PIN and flags a one-time notice', () => {
    const d = migrateLock(data([legacyProfile('Ana', 'pin', '1111', 5), legacyProfile('Ben', 'pin', '2222', 9)], 0));
    expect(d.grownUpLock).toEqual({ lock: 'pin', pin: '1111', pinNotice: 'Ana' });
  });

  it('when the active profile has no PIN, keeps the most recently changed profile\'s PIN', () => {
    const d = migrateLock(data([legacyProfile('Kid', 'hold'), legacyProfile('Old', 'pin', '1111', 5), legacyProfile('New', 'pin', '2222', 9)], 0));
    expect(d.grownUpLock?.pin).toBe('2222');
    expect(d.grownUpLock?.pinNotice).toBe('New');
  });

  it('the same PIN on several profiles needs no notice', () => {
    const d = migrateLock(data([legacyProfile('A', 'pin', '1234'), legacyProfile('B', 'pin', '1234')]));
    expect(d.grownUpLock).toEqual({ lock: 'pin', pin: '1234' });
  });

  it('never leaves a PIN lock without a valid PIN', () => {
    expect(migrateLock(data([legacyProfile('A', 'pin')])).grownUpLock?.lock).toBe('hold');
    expect(migrateLock(data([legacyProfile('A', 'pin', '12')])).grownUpLock?.lock).toBe('hold');
    expect(migrateLock(data([legacyProfile('A', 'pin', 'abcd')])).grownUpLock).toEqual({ lock: 'hold' });
    expect(cleanLock({ lock: 'pin', pin: '<b>' })).toEqual({ lock: 'hold' });
    expect(cleanLock({ lock: 'evil' })).toBeUndefined();
    expect(cleanLock('pin')).toBeUndefined();
  });

  it('an existing app-wide lock wins over leftovers from an older device', () => {
    const d = data([legacyProfile('A', 'none')]);
    d.grownUpLock = { lock: 'pin', pin: '9999' };
    expect(migrateLock(d).grownUpLock).toEqual({ lock: 'pin', pin: '9999' });
    expect('lock' in settingsOf(d.profiles[0])).toBe(false);
  });

  it('a garbage app-wide lock is replaced from the profiles', () => {
    const d = data([legacyProfile('A', 'math')]);
    (d as unknown as Record<string, unknown>).grownUpLock = { lock: 42 };
    expect(migrateLock(d).grownUpLock).toEqual({ lock: 'math' });
  });

  it('tolerates junk profiles (migrate drops them afterwards)', () => {
    const d = data([legacyProfile('A', 'pin', '5555')]);
    (d.profiles as unknown[]).push(null, 7, { settings: 'x' });
    expect(migrateLock(d).grownUpLock?.pin).toBe('5555');
  });

  it('runs inside migrate(), and the default settings no longer carry a lock', () => {
    const m = migrate(data([legacyProfile('A', 'pin', '2468')]));
    expect(m.grownUpLock).toEqual({ lock: 'pin', pin: '2468' });
    expect('lock' in settingsOf(m.profiles[0])).toBe(false);
    expect('lock' in (DEFAULT_SETTINGS as unknown as Record<string, unknown>)).toBe(false);
  });

  it('restores and syncs keep this device\'s lock', () => {
    const local = migrate(data([legacyProfile('A', 'pin', '1357')]));
    const incoming = migrate(data([legacyProfile('B', 'none')]));
    expect(keepDeviceLock(structuredClone(incoming), local).grownUpLock).toEqual({ lock: 'pin', pin: '1357' });
    expect(mergeData(local, incoming).data.grownUpLock).toEqual({ lock: 'pin', pin: '1357' });
  });

  it('withoutPin strips the PIN for unencrypted files without touching the original', () => {
    const d = migrate(data([legacyProfile('A', 'pin', '8642')]));
    const out = withoutPin(d);
    expect(out.grownUpLock).toEqual({ lock: 'hold' });
    expect(d.grownUpLock?.pin).toBe('8642');
    expect(JSON.stringify(out)).not.toContain('8642');
  });
});

describe('store: lock actions', () => {
  it('adding, switching and deleting profiles never changes the lock', () => {
    const st = useStore.getState();
    useStore.setState({ data: migrate(data([legacyProfile('A', 'pin', '1212')])) });
    st.addProfile('B', 'medium');
    expect(useStore.getState().data.grownUpLock).toEqual({ lock: 'pin', pin: '1212' });
    const [a, b] = useStore.getState().data.profiles;
    st.switchProfile(a.id);
    st.deleteProfile(b.id);
    expect(useStore.getState().data.grownUpLock).toEqual({ lock: 'pin', pin: '1212' });
  });

  it('setLock never stores a PIN lock without a PIN and clears the notice', () => {
    const st = useStore.getState();
    useStore.setState({ data: migrate(data([legacyProfile('A', 'pin', '1111'), legacyProfile('B', 'pin', '2222')])) });
    expect(useStore.getState().data.grownUpLock?.pinNotice).toBe('A');
    st.setLock({ pinNotice: undefined });
    expect(useStore.getState().data.grownUpLock).toEqual({ lock: 'pin', pin: '1111' });
    st.setLock({ lock: 'hold', pin: undefined });
    expect(useStore.getState().data.grownUpLock).toEqual({ lock: 'hold' });
    st.setLock({ lock: 'pin' });
    expect(useStore.getState().data.grownUpLock?.lock).toBe('hold');
  });

  it('replaceData (restore) keeps the device lock', async () => {
    useStore.setState({ data: migrate(data([legacyProfile('A', 'pin', '3030')])) });
    await useStore.getState().replaceData(data([legacyProfile('From file', 'none')]));
    expect(useStore.getState().data.grownUpLock).toEqual({ lock: 'pin', pin: '3030' });
    expect(useStore.getState().data.profiles[0].name).toBe('From file');
  });
});

describe('keep screen awake (defect 30)', () => {
  it('does nothing harmful where neither the Wake Lock API nor the native plugin exists', async () => {
    expect(keepAwakeAvailable()).toBe(false);
    await expect(setKeepAwake(true)).resolves.toBeUndefined();
    await expect(setKeepAwake(false)).resolves.toBeUndefined();
  });

  it('the native plugin exists and is registered in MainActivity', () => {
    const java = read('android/app/src/main/java/org/calebaac/app/AACFreeScreenPlugin.java');
    expect(java).toContain('@CapacitorPlugin(name = "AACFreeScreen")');
    expect(java).toContain('FLAG_KEEP_SCREEN_ON');
    expect(read('android/app/src/main/java/org/calebaac/app/MainActivity.java')).toContain('registerPlugin(AACFreeScreenPlugin.class)');
  });
});

describe('platform hardening', () => {
  it('index.html has a strict Content-Security-Policy (defect 52)', () => {
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(read('index.html'))?.[1] ?? '';
    const dir = (name: string) => csp.split(';').map((x) => x.trim()).find((x) => x.startsWith(name + ' ')) ?? '';
    expect(dir('default-src')).toBe("default-src 'self'");
    expect(dir('script-src')).toBe("script-src 'self' 'wasm-unsafe-eval'");
    expect(dir('img-src')).toContain('https://static.arasaac.org');
    expect(dir('img-src')).toContain('blob:');
    expect(dir('media-src')).toContain('blob:');
    expect(dir('connect-src')).toContain('https://api.arasaac.org');
    expect(dir('object-src')).toBe("object-src 'none'");
  });

  it('FileProvider shares only Documents, camera photos and the cache', () => {
    const xml = read('android/app/src/main/res/xml/file_paths.xml');
    expect(xml).not.toMatch(/<external-path[^>]*path="\."/);
    expect(xml).toMatch(/<external-path[^>]*path="Documents\/"/);
    expect(xml).toMatch(/<external-files-path[^>]*path="Pictures\/"/);
  });

  it('workflows pin third-party actions to commit SHAs (defect 56)', () => {
    for (const f of ['android.yml', 'ci.yml', 'pages.yml']) {
      const yml = read(`.github/workflows/${f}`);
      for (const m of yml.matchAll(/uses:\s*([^\s#]+)/g)) expect(m[1], `${f}: ${m[1]}`).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it('pull requests never sign with the release key, and the keystore is deleted', () => {
    const yml = read('.github/workflows/android.yml');
    expect(yml).toMatch(/event_name.*pull_request/);
    expect(yml).toMatch(/if: always\(\)[\s\S]*rm -f[^\n]*release\.jks/);
    expect(yml).toContain('overwrite');
  });

  it('pages deploy waits for the end-to-end checks (defect 45)', () => {
    expect(read('.github/workflows/pages.yml')).toMatch(/npm run e2e/);
  });
});
