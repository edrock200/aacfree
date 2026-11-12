---
name: add-vocabulary
description: Add or change Caleb's default words, categories, phrases or schedules, and fetch/curate their ARASAAC symbols. Use when asked to add words, new topic folders, default phrases, fix a wrong picture, or change the home layouts.
---

# Adding vocabulary

All default vocabulary lives in `src/data/vocab.ts`, written in a compact spec notation:

| Spec | Meaning |
|---|---|
| `"apple"` | label "apple", category's default type, symbol keyword "apple" |
| `"v:run"` | type code (`p` pronoun, `v` verb, `d` descriptor, `n` noun, `s` social, `q` question, `r` preposition, `x` negation, `t` determiner, `c` conjunction, `m` misc) |
| `"label|spoken"` | speaks/inserts different text |
| `"label@keyword"` | ARASAAC search keyword override |
| `"label#1234"` | explicit ARASAAC pictogram id |
| `"label~🙂"` | emoji instead of a pictogram |
| `">food"` / `"!keyboard"` | folder link / action button (home & More boards) |

## Steps
1. Edit `CATEGORIES`, `HOME_LAYOUTS`, `QUICK_BAR`, `DEFAULT_PHRASES` or `DEFAULT_SCHEDULES`.
   - Home layouts must have exactly `cols × rows` cells, and **each must link to `>more`** so every category stays reachable. A unit test checks this.
   - New categories also go in `MORE_BOARD`.
   - Never reorder existing home cells without a good reason (motor planning for current users).
2. `npm run symbols` resolves new keywords, downloads 200px WebPs into `public/symbols/` and updates `src/data/symbols.json`.
3. **Curate.** ARASAAC search can return odd matches (e.g. "stop" → bus stop, "can" → tin can). Look at a contact sheet of what you added. To fix one:
   - search alternatives: `curl -s https://api.arasaac.org/v1/pictograms/en/search/<word>` and view `https://static.arasaac.org/pictograms/<id>/<id>_300.png`
   - pin the right id in `scripts/symbol-overrides.json` (keyword → id), or use `label#id` in the spec when a keyword has two meanings (e.g. `dress#2613` the garment vs the "dress" verb)
   - run `npm run symbols` again
4. `npm test` must pass (links valid, every board reachable, more than 95% of words have symbols).
5. Existing users' boards are **not** changed. Defaults apply only to new profiles or a layout change. Mention this in release notes.

Licence: ARASAAC pictograms are CC BY-NC-SA 4.0 (Sergio Palao / Government of Aragón). Keep the attribution in the README and in Help.
