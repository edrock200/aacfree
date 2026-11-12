---
name: release
description: Cut a new Caleb release — bump versions, run checks, build the website and signed APK, and publish the artifacts. Use when asked to release, publish, ship, or "compile the APK and website".
---

# Releasing Caleb

1. **Version bump:** only `package.json` → `"version"`. Android `versionName`/`versionCode` are derived from it (versionCode = major·10000 + minor·100 + patch).
   Add a Play changelog at `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (≤500 chars).
   Check translations: every `t('…')` string needs a Spanish entry in `src/i18n/es.ts`.
2. **Checks**
   ```bash
   npx tsc --noEmit -p . && npm test && npm run build
   npx vite preview --port 4173 &   # then:
   node scripts/e2e/screens.mjs http://localhost:4173/ /tmp/shots   # expects "No page errors"
   ```
   Look at a few screenshots (home, food board, grown-ups) before shipping.
3. **AAB for Google Play:** `cd android && ./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab` (see docs/play-store.md).
4. **APK:** follow the `build-android` skill. Copy the result to `release/caleb-latest.apk` (committed so families can download it straight from GitHub).
5. **Website:** `npm run build:site` builds the landing page (`site/`) plus the web app under `app/` into `dist-site/`. The GitHub Pages workflow (`.github/workflows/pages.yml`) deploys it automatically on pushes to `main`.
6. Update `CHANGELOG.md` with a `## <version> — <date>` section (it becomes the release notes), commit, and push.
7. **GitHub Release:** after the change is on `main`, either push a tag (`git tag v<version> && git push origin v<version>`) or, where tag pushes are blocked (cloud sessions), run the **Android APK** workflow on `main` with `publish: true` (workflow_dispatch). It creates the `v<version>` tag itself. Either way, `.github/workflows/android.yml`
   publishes a Release named `Caleb v<version>` with the CHANGELOG section as notes and two assets: `caleb-v<version>.apk` and `caleb.apk`.
   The fixed name keeps one permanent link to the newest APK: `https://github.com/edrock200/caleb/releases/latest/download/caleb.apk`.
   Never rename `caleb.apk`, since the README and families' bookmarks use that link.
   With the signing secrets set, CI builds and signs the APK itself. Without them, it publishes the committed `release/caleb-latest.apk`,
   but only if that file's versionName matches the tag and it is signed with the release key. Otherwise the run fails, so step 4 must come first.

Don't break existing users' data. Any change to the data shape needs `migrate()` in `src/store.ts`.
