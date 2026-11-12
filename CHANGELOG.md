# Changelog

## 0.5.0 — 2026-11-12
Built from the v0.4 review (nine reviewers plus adversarial checks; see docs/reviews/v0.4-review.md). Every defect it found is addressed.

**Sync across devices, change by change**
- Devices merge **item by item** (each button, board, phrase, schedule, setting and library symbol) instead of keeping whichever whole profile is newest. Changes made on several devices are all kept, and deletions carry over.
- When the same thing was changed on two devices, the newer change wins, the conflict is listed, and a snapshot is kept first.
- **Automatic sync** through one file the family picks in Google Drive, OneDrive or Dropbox (Android, and desktop Chrome/Edge). It runs when Caleb opens, after edits and every few minutes, and never interrupts talking. iPad, iPhone and Firefox use Send/Receive files with the same merge.
- Talking, recent sentences and learned words never overwrite another device's edits. Each device keeps its own voice, PIN and access settings.
- Stronger suggested passcodes, and a better-protected file format. v0.4 sync files still open, but every device needs 0.5.

**Talking**
- Phrases always speak; editing needs the Edit pencil. Talking no longer keeps Grown-ups unlocked, and an "Editing unlocked" bar shows when it is.
- Speak turns into **Stop** while talking. **Tools → My voice**: Quiet/Normal/Loud, speed, and "Show, don't speak".
- **Recent sentences belong to the person:** delete one, clear all, or "Private for now" (pauses recent sentences, learned words and the usage log), with no lock. Grown-ups can keep them always, only until restart, or never.
- Clearing a message always offers Undo, and Speak on an empty bar brings back the last message.
- Word forms no longer stack (no more "goinged"), and you can go back to the base word.
- Prediction and learning handle accented words (niño, está, aujourd'hui).
- Speech problems now show a message with a fix. Dwell, head and eye users get a one-tap prompt to turn the voice on.

**Switch, dwell, head and eye access**
- Scanning ignores a held switch and key repeat, with a switch acceptance time and a lockout after each selection.
- New scanning settings: assign any key, first-item delay, scan loops, a Leave-row step and a softer cue voice.
- Every control can be reached by scanning, including dialogs, Find word, the First/Then picker, message words, toasts and the timer.
- Dwell starts only after real movement, re-arms after a new board, and stops when the face is lost. The camera recovers by itself and switches off while Caleb is hidden.
- New Rest, Centre (hands-free re-centre) and Restart-camera controls.
- Two-tone highlights readable on every colour, with a choice of colour and thickness. Text size now scales the whole app.
- Dialogs keep keyboard and screen-reader focus inside them. Grown-ups can be reached by keyboard under the hold lock.
- Every button the person uses applies hold and debounce. The PIN pad hides the PIN length and slows down after wrong tries.

**Languages**
- "Start with fewer words", layout changes and label edits now work properly in Spanish, French and Portuguese.
- Every verb form is corrected in all three languages, including stem changes, spelling changes and reflexives.
- The voice picker and previews follow the communication language.
- About me is translated, and OBF import and export keep the right language.
- French keyboard gains â, û, ë, ï and œ. Symbol search ignores accents.
- No English-only text is left (a test now checks every string in every language). "I have a backup" in first-time setup.

**Data safety**
- Every loaded, restored or imported file is fully checked and repaired. Damaged or newer-version data is set aside, never overwritten.
- Snapshots are kept by kind, so daily snapshots aren't pushed out by snapshots taken before changes.
- Saves go through one queue. Maintenance (snapshots and backups) also runs on tablets that stay open.
- Backups are written in chunks and checked after writing. A failing destination no longer evicts good copies.
- A layout change takes a snapshot and offers Undo. Confirm or Undo before deleting folders, schedules and phrases.
- Plain backups never contain the PIN.

**Grown-ups and platform**
- **One grown-up lock for the whole device**, so switching or adding profiles can't bypass the PIN.
- Shortcuts to edit phrases, schedules and About me. Schedules reset each day. Hide individual tools.
- "Keep screen awake" works in the Android app. Faster start-up (smaller first download).
- A content security policy. An option to stop downloading missing pictures. Safer CI signing, and a guard against overwriting a release.

## 0.4.0 — 2026-11-12
**Language options**
- New languages: **Français** and **Português (Brasil)**, alongside English and Español. Each has full interface and board vocabulary, grammar (plurals, agreement, verb conjugation; French elision such as “j'aime”; Portuguese “gosto de”), a keyboard with accents (plus an AZERTY option), prediction, and voice.
- Separate **app language** and **communication language**: a parent can use English menus while the person talks in another language. Anything spoken (tools, timer, body map) follows the communication language.
- **Second language on buttons** for bilingual families and classrooms.
- Language switches go through English, so any language ↔ any language round-trips exactly, and buttons never move.

**Backup options**
- Automatic backups **daily, weekly or monthly**, as dated files, with **how many copies to keep**.
- **Android: keep a copy in Google Drive, OneDrive, Dropbox or on an SD card**, chosen once with the system file picker; Caleb updates it on every backup.
- **Passcode-locked (encrypted) backups**: the passcode stays on the device; restoring asks for it.
- Choose whether backups include **photos/recordings** and **message history**.
- **Restore any automatic copy**, or open a backup from Drive or another app.

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
