# Changelog

## 0.6.0 — 2026-11-16
- **Import a board from a picture.** Settings → Boards & words → **Import a board from a picture** (or "Or import a board from a picture…" in New category). Take a photo or a screenshot of a board in another AAC app (TD Snap, Proloquo2Go, TouchChat, LAMP, Cboard…) or of a paper board, and Caleb rebuilds it with the same grid and the same word in every square, so the person keeps their motor plan.
  - **Finds the grid by itself**: the background, the gaps between tiles, and the number of rows and columns. Toolbars, message bars and side panels are left out, and empty squares inside the grid still count. You can drag the edges (on touch too), nudge them with arrow buttons, and change the rows and columns.
  - **Reads every word on the device.** Text recognition (Tesseract) is built into the app and runs offline in the board's language plus English. The picture never leaves the device. A 6 × 8 board takes a few seconds on a computer.
  - **Pictures and colours:** each word gets Caleb's own symbol, and the tile's colour becomes the nearest word type in the Modified Fitzgerald Key. Or keep the pictures from your screenshot (for one square or all of them), stored on the device like photos; a note explains they may belong to the app that made them.
  - **Check before saving:** the preview shows the board as it will look. Tap a square to fix the word, change the picture or word type, empty it, or make it a folder (an empty folder board with that name).
  - **Save** as a new folder on any board (first empty square, else a new row: nothing moves) or as a new profile. A snapshot is taken first, and Undo works.
- Help & tips explains how to bring a board from another app.

## 0.5.5 — 2026-11-16
- **Only the content scrolls.** Swiping in Settings (and anywhere else) scrolls just that area. The screen, the message bar and the bottom bar stay put. Hidden screen-reader labels deep in the settings were stretching the page, so the whole screen could slide up. The page itself can no longer scroll, and first-time setup and the error screen scroll inside themselves.
- **Setting sliders need Save.** Moving a slider in Settings (speed, pitch, volume, text size, timings and the like) shows the new value with **Save** and **Cancel**, plus what it was before. Nothing changes until Save. Vertical swipes over a slider scroll the page instead of grabbing it, so scrolling past a slider can't change it by accident.

## 0.5.4 — 2026-11-16
- **Home and More in the bottom bar**, between Phrases and Tools.
  - **Home** does the same as the Home button at the top left: back to the home board, from any screen.
  - **More** opens the More board (all the topic folders) in one tap, from any screen. It only appears when the profile has a More board, so imported boards without one don't get a dead button.
  - The current place is highlighted, and both buttons work with scanning, dwell, and hold and debounce settings.
- **The bottom bar fits on small phones:** buttons share the width equally, so every button, Settings included, stays on screen down to 320 px.
- The sync passcode meter always rates Caleb's own suggested passcodes as strong. About 1 in 30 suggestions was shown as only "ok" or "weak", even though they are random and strong.

## 0.5.3 — 2026-11-15
- **Phrases open on folder cards.** Recent, Needs, Feelings, Boundaries, Chat, Questions, Emergency and the family's own groups are shown as folder cards with a picture and the number of phrases inside, in a fixed order. Tapping a card opens its phrases, and a Back button (or Android Back) returns to the folders.
  - Built-in groups keep their pictures in every language. A family's own group shows the picture of its first phrase that has one, or a folder.
  - Phrases always opens on the folders, so it starts from the same place every time. Editing (the Edit phrases pencil, + Group, add or delete phrases) works as before, inside the folders.
  - The cards work with scanning, dwell, and hold and debounce settings.

## 0.5.2 — 2026-11-14
Eye-gaze fixes.
- **Camera calibration works again.** The quality check added in 0.5 rejected almost every real webcam calibration, especially on phones held upright. Calibration now:
  - averages each dot's samples before fitting, so noise no longer pulls every prediction toward the middle;
  - uses more of the face model's information (eye openness and its eye-look scores) for up/down gaze;
  - judges quality by whether the dots can be told apart, not by a fixed pixel error.

  It still rejects calibrations from a face that was mostly lost. A dot whose face can't be seen for 8 seconds is skipped instead of hanging. A failed calibration says what to change, and an approximate one is accepted with a hint that larger buttons work best.
- **Rest really stops.** Tapping Rest now pauses everything: the camera switches off, the cursor hides, and only a tap on Resume carries on. Resting hands-free (by dwell or switch) still lets the person resume by looking at Resume, but it now takes a long, deliberate look (at least 2.5 s), so a wandering cursor can't resume by itself. A long blink no longer resumes.

## 0.5.1 — 2026-11-13
Phone readability and more autonomy, adopted from pull request #8 with improvements.
- **Labels wrap on phones** instead of being cut off. They break at word boundaries, hyphenate long words in the board's language, and show at most two lines, so pictures keep their room. The Speak button keeps its label on phones.
- **All quick words:** when the quick bar is too wide for the screen, an **All** button appears at the end of the same row and opens every quick word in a dialog, in the same order. Protest words stay one tap away on any phone, including by scanning.
- **The feelings scale only says how big the feeling is** ("This feeling is big."), instead of assuming the person is upset or adding requests. Separate **Not sure**, **I need help** and **I need a break** buttons. Levels have a neutral tint and a size meter that fills with the level, with no colour meaning good or bad.
- **"Grown-ups" is now "Settings"** in the app, the help, the website and the store listing. The locked button shows a lock.
- The "folders not linked" note in edit mode is translated, and the language test now catches that kind of untranslated text.
- New `scripts/e2e/phone-layouts.mjs` checks every layout at 320, 360 and 412 px. New e2e checks cover the All button, the dialog and the feelings scale.

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
