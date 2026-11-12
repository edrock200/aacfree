# CLAUDE.md — Caleb AAC

Caleb (AGPL-3.0-or-later) is a free, open-source **AAC (augmentative & alternative communication)** app for autistic
people and their families. It ships as a **web app / PWA** and an **Android APK** (Capacitor).
Everything is offline-first and stored on the device. There is no server and no accounts.

## Stack
- React 19, TypeScript, Vite 8 (`src/`), zustand store (`src/store.ts`), IndexedDB via `idb` (`src/lib/db.ts`)
- PWA: `vite-plugin-pwa`, which precaches the app and every bundled symbol
- Android: Capacitor 8 (`android/`, `capacitor.config.ts`). Native TTS uses `@capacitor-community/text-to-speech`, because the Android WebView has no `speechSynthesis`.
- Symbols: ARASAAC pictograms (CC BY-NC-SA) bundled as WebP in `public/symbols/` and mapped in `src/data/symbols.json`
- Font: Atkinson Hyperlegible (bundled via @fontsource)

## Commands
```bash
npm run dev          # dev server
npm run build        # typecheck + production build → dist/
npm test             # vitest unit tests (src/**/*.test.ts)
npx tsc --noEmit -p . # typecheck only
npm run symbols      # resolve/download ARASAAC symbols for vocab keywords
node scripts/make-icons.mjs        # regenerate PWA + Android icons/splash from public/icon.svg
node scripts/e2e/screens.mjs <url> <outdir>   # Playwright smoke test + screenshots
npm run e2e          # functional e2e (editing, undo, backup/OBF round-trip, scanning); needs `npx vite preview --port 4173`
npm run android:apk  # build web, cap sync, gradle assembleRelease (needs Android SDK, see skill)
```

## Layout of the code
- `src/types.ts`: the data model (Profile → boards → cells of AACButton, plus Settings)
- `src/data/vocab.ts`: **all default vocabulary** in a compact spec notation (see the header comment). It must stay dependency-free because the symbol script imports it with Node type stripping.
- `src/data/defaults.ts`: builds a Profile from the vocab (`buildProfile`), plus `DEFAULT_SETTINGS`
- `src/store.ts`: app state and actions (message bar, navigation, edits with undo, persistence, snapshots)
- `src/lib/library.ts` + `src/components/LibraryBrowser.tsx`: the symbol library. Built-in categories come from the vocab (`builtInLibrary()` in defaults.ts); family categories and additions live in `AppData.library`, shared across profiles. Each category is shown as a folder with an icon.
- `src/components/NewCategoryDialog.tsx`: creates a board category (folder button + board), optionally from a library category
- `src/lib/validate.ts`: **all** loaded or restored data passes through `migrate()` → `migrateLock` → `cleanData()` (settings typed and clamped against `DEFAULT_SETTINGS`, phrases, schedules, history, boards, library). Never trust stored or imported data, and allow hex-only colours. A new setting with a non-trivial shape needs a cleaner in `cleanSettings`.
- Saves go through one coalescing queue (`src/lib/savequeue.ts`), are revision-checked (`saveDataChecked`) and broadcast to other tabs. Don't bypass `persist()`. While saved data couldn't be loaded (`loadProblem`), `blockSaves()` stops every write: snapshots, backups and sync included.
- Maintenance (`runMaintenance()`: daily snapshot, asset GC, scheduled backup) runs after start, on return to the foreground and hourly. Snapshots are kept by kind (daily / before-action / manual).
- **Sync:** every local change to profiles or the library goes through `stampChanges(prev, next)` in `store.ts`, which records per-item change stamps (`src/lib/stamps.ts`). `src/lib/merge.ts` merges item by item (newest stamp wins, tombstones for deletes, conflicts listed). Data arriving from sync goes through `applySyncedData()` and is not re-stamped. `src/lib/autosync.ts` runs automatic sync through one family-chosen file. Device-only data (device id, sync passcode and file, voice, calibration, the grown-up lock) never syncs.
- The grown-up lock and PIN are app-wide: `AppData.grownUpLock` (`src/lib/lock.ts`). Plain backups strip it (`withoutPin`), and restores keep this device's lock.
- `BoardGrid` pages boards that don't fit (fixed Previous/Next). Don't reintroduce free scrolling.
- Tool state (timer, first/then, choices) lives in the store, so it survives leaving the Tools screen.
- Editing that lives outside Grown-ups (phrases, schedules, About me) needs `unlocked && contentEdit` (an explicit Edit pencil), never `unlocked` alone, so a tap always speaks.
- **i18n / language packs:** `src/i18n/packs.ts` registers each language (en, es, fr, pt): UI strings (`src/i18n/<id>.ts`), vocabulary keyed by the English originals (`src/data/i18n/<id>-vocab.ts`), words/bigrams, grammar (`src/lib/morphology-<id>.ts`), keyboard and body-map phrasing. `t()` translates into the **app language**, and `ts()` into the **communication language**; use `ts()` for anything spoken. Wrap every new visible string in `t()` and add its translations to `src/i18n/v05/<area>.ts` (es, fr, pt). `i18n-coverage.test.ts` fails if any literal `t()`/`ts()` string lacks a translation, and `lang.test.ts` fails on raw JSX text. New verb buttons need a fixture in `lang.test.ts`. Switching language calls `translateProfile()`, which goes via English using each button's `key` (its English original), so positions never change and round trips are exact.
- **Switch scanning:** the state machine is `src/lib/scanner.ts` (pure, tested); `useScanner` is the DOM layer. Scan items belong to their nearest `data-scan-group`. Overlays use `Modal` (or `data-scan-scope` plus `useDialog()`), which scopes scanning and traps focus.
- **Pointer access:** `src/lib/pointer.ts` (dwell, head, eyes) + `PointerLayer`/`GazeCalibration`. The MediaPipe model is committed in `public/vision/`; the WASM is copied from node_modules by `scripts/copy-vision.mjs` (runs in `npm run build`).
- **Sync/backup:** `src/lib/crypto.ts` (AES-GCM + PBKDF2), `src/lib/sync.ts` (passcode files + merge), and `src/lib/autobackup.ts` (scheduled dated backups with rotation, encryption and include options; the device-level prefs and passcode live in IndexedDB meta, never in backups). On Android, `CalebFilesPlugin.java` (registered in MainActivity) writes to a file the user picked via the system file picker, such as Google Drive (chunked, verified after writing). `CalebScreenPlugin.java` keeps the screen awake.
- `src/lib/`: tts, morphology (word forms), prediction, scanning (`useScanner`), touch accommodations (`usePress`), backup, OBF import/export, files (web download vs Android share)
- `src/components/`: grid/cell/message bar/quick bar/nav bar/editors/pickers
- `src/screens/`: Talk, Keyboard, Phrases, Tools (+ `tools/*`), GrownUp (+ `grownup/*`), Onboarding
- `docs/research.md`: user research that drives product decisions. Read it before changing UX.

## Product rules (from AAC research; don't break these)
1. **Motor planning:** buttons never move on their own. Boards are fixed `cols × rows` arrays, and resizing keeps row/column positions. Prefer **hiding (masking)** over deleting.
2. **Protest words are always reachable:** the quick bar (yes/no/stop/help/wait/break…) shows on every screen except Grown-ups.
3. **Talking is never locked.** Only editing and settings sit behind the grown-up lock.
4. **Privacy and autonomy:** usage logging and learned prediction are **opt-in** and stay on the device.
5. **Never lose data:** persist every change (debounced), snapshot daily and before destructive actions, and keep undo in edit mode.
6. Android back button navigates inside the app and must never exit it.
7. Keep everything usable offline. A new runtime dependency must work offline in the WebView. A new external host must also be added to the CSP in `index.html`.

## Conventions
- Data shape changes need a `migrate()` update in `src/store.ts` (fills defaults for older saves).
- New settings: add them to `Settings` in `types.ts` and to `DEFAULT_SETTINGS`. `migrate()` merges defaults automatically.
- Mark scannable controls with `data-scan-item` inside a `data-scan-group` container.
- Use `<PressButton onPress>` (wraps `usePress()`) for any button the AAC user activates, so hold/debounce settings apply.
- Symbol refs: `a:<arasaacId>` (bundled), `e:<emoji>`, `img:<assetId>` (user photo/downloaded, stored in IndexedDB).
- Colours follow the Modified Fitzgerald Key (`src/lib/colors.ts`).
- Don't put model identifiers in commits or code.

## Skills
See `.claude/skills/`: `build-android`, `add-vocabulary`, `release`, `smoke-test`.
