---
name: smoke-test
description: Run Caleb in a headless browser, click through the main flows and capture screenshots to verify UI changes. Use after any UI change, before releases, or when asked to run/screenshot the app.
---

# Smoke test Caleb

```bash
npm run build
npx vite preview --port 4173 --strictPort &      # serves dist/
node scripts/e2e/screens.mjs http://localhost:4173/ <outdir>
```
- The script goes through onboarding, builds a sentence, opens word forms, the keyboard, phrases, tools (schedule, timer), unlocks Settings (2-second hold), opens the editor, and checks phone size. It prints `No page errors` or lists console and page errors.
- Screenshots are saved as `<outdir>/NN-name.png`. Open the relevant ones to check visually: tablet 1180×820, phone 390×844.
- Playwright is preinstalled globally. The script loads it with `createRequire`, so there is no local dependency.
- To test a single flow, copy the script and trim the steps. Selectors use `aria-label`, e.g. `.grid .cell[aria-label="want"]`, folders as `"Food folder"`.
- Images can load lazily in pickers. Wait about 300 ms before screenshots that need symbols.

## Functional checks
`npm run e2e` (or `node scripts/e2e/flows.mjs [url]`) asserts the important behaviours and exits non-zero on failure: sentence building across folders, auto-return, quick bar, Recent, Find word, editing, auto symbol, hide/mask, move and undo, backup download and restore, OBZ export and import, and 1-switch scanning. Run it before every release.
