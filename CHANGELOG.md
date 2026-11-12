# Changelog

## 0.3.0 — 2026-11-12
Roadmap release.
- **Español:** full Spanish interface, about 785 translated board words, phrases and schedules, Spanish word forms
  (plurals, gender, verb conjugation), automatic conjugation after a subject pronoun (yo + querer → quiero, yo + gustar → me gusta),
  a Spanish keyboard (ñ, accents, ¿ ¡), and Spanish prediction. Switching language translates boards **in place**, so every button keeps its position, and switching back is exact.
- **Eye gaze & head pointer:** dwell selection for mouse, head-mice and hardware eye trackers; a camera head pointer;
  experimental camera eye gaze with 9-point calibration; optional long-blink select. Everything runs on the device and nothing is recorded.
- **Encrypted sync between devices** with no account or server: a passcode-locked file (AES-256-GCM), where the newest profile wins and libraries are combined.
- **Weekly automatic backup file:** Documents/Caleb on Android (survives uninstalling); a chosen folder on desktop Chrome.
- **Google Play ready:** store listing (English and Spanish), screenshots, feature graphic, privacy policy, checklist (docs/play-store.md), and the AAB build.

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
