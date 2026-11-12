---
name: release
description: Cut a new Caleb release — bump versions, run checks, build the website and signed APK, and publish the artifacts. Use when asked to release, publish, ship, or "compile the APK and website".
---

# Releasing Caleb

1. **Version bump** (keep them in sync):
   - `package.json` → `"version"`
   - `android/app/build.gradle` → `versionCode` (+1 every release) and `versionName`
2. **Checks**
   ```bash
   npx tsc --noEmit -p . && npm test && npm run build
   npx vite preview --port 4173 &   # then:
   node scripts/e2e/screens.mjs http://localhost:4173/ /tmp/shots   # expects "No page errors"
   ```
   Look at a few screenshots (home, food board, grown-ups) before shipping.
3. **APK:** follow the `build-android` skill. Copy the result to `release/caleb-<version>.apk` and `release/caleb-latest.apk`. Both are committed so families can download them straight from GitHub.
4. **Website:** `npm run build:site` builds the landing page (`site/`) plus the web app under `app/` into `dist-site/`. The GitHub Pages workflow (`.github/workflows/pages.yml`) deploys it automatically on pushes to `main`.
5. Update `CHANGELOG.md`, commit, and push. Tagging `v<version>` triggers `.github/workflows/android.yml`, which builds the APK and attaches it to a GitHub Release.

Don't break existing users' data. Any change to the data shape needs `migrate()` in `src/store.ts`.
