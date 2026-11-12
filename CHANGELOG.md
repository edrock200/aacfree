# Changelog

## 0.2.0 — 2026-11-12
Built from two parallel reviews of v0.1 (see docs/reviews/v0.1-review.md).
- **Phone core layout** (5×6) and **paged folders** with fixed Previous/Next buttons instead of scrolling
- **Show/Hide mode** and **+ Word** in edit mode; Find word reveals hidden words and offers Say it / Put in message / Add
- **Timer keeps running** across screens with a countdown chip; First/Then and Choices remember their state
- **Schedules:** pictures, durations (start a timer from Now) and duplicate
- **Modelling mode:** partner taps are not counted in Insights or learning
- **Pronunciations** list; physical keyboard typing; auto-capitalised “I”; built-in next-word suggestions
- **Grown-ups:** usable on phones, auto-relock, lock returns Home, Forgot-PIN recovery
- **Reliability:** multi-window safe saves, validated restores with confirmation, crash recovery screen,
  save-failure banner, asset clean-up, hardened OBF import, print-view escaping, Android voice fallback,
  updates never reload mid-sentence, faster boards
- Dark and high-contrast themes put a light plate behind pictures

## 0.1.0 — 2026-11-12
First public build.
- **Symbol library:** pictures organised into category folders, each with an icon. Families can create their own categories and symbols (photos, online ARASAAC, emoji) and save online pictures and photos to the library while editing.
- **New category** on boards: a folder button with an icon that opens a new board, optionally pre-filled from a library category
- Licensed under the GNU AGPL-3.0-or-later
- Core vocabulary boards in three layouts (12 / 30 / 48 buttons), 25 topic folders, about 770 words, and 740 bundled ARASAAC symbols
- Printable paper boards; undo after clearing a message; backup reminders
- Starter vocabulary mode; copy a button to another board; open folders while editing
- Reliability: scanning users can't get trapped (PIN gate, text boxes), auditory scanning never cuts off speech,
  undo only affects boards, storage errors never block talking or overwrite data, voice clips are kept until saved,
  OBF round-trips keep actions and colours, Back closes only the top dialog
- Message bar with word forms, a quick bar of protest and help words, a keyboard with private prediction, and phrases with recent and favourites
- Tools: schedule, first/then, timer, choices, feeling and pain scales, body map, About me, drawing, get attention
- Grown-up area: in-place editor, photos, recorded voices, hide/mask, undo, board resize, voices, display, touch accommodations, switch scanning, insights, backups and snapshots, OBF import/export, profiles, lock
- PWA (fully offline) and Android APK (native text-to-speech, back button kept inside the app)
