# AAC user & caregiver research (Nov 2026)

What we found about existing AAC apps (Proloquo2Go, TD Snap, LAMP WFL, TouchChat,
Avaz, Cboard, CoughDrop, Speak for Yourself, Grid …), and how it shapes AACFree.

## Biggest pain points with existing apps

| Pain point | Strength | AACFree's answer |
|---|---|---|
| Cost: $200–300 one-time, or subscriptions just to make the app speak. Many apps are iOS-only. | Very high | Free and open source. Works as a web/PWA on any device and as an Android APK. |
| Speed: symbol apps are slow, and their built-in typing is weak. | High (adult users) | Integrated keyboard with word prediction, saved phrases, recent sentences, and speaking each word on tap. |
| Lost customizations after a device restore or crash. | Rare but devastating | Automatic versioned snapshots, an undo history, manual export/import, and a request for persistent storage. |
| Crashes and freezes. | Common in 1-star reviews | Offline-first, no server, small bundle, defensive storage. |
| Navigation confusion ("I'm lost all the time"). | Common | Core vocabulary on home, folders only one level deep, auto-return home, and a "Find word" search that shows where a word lives. |
| Clunky editing. | Moderate | Edit in place: tap a button to edit it, tap two cells to swap them, and pick symbols from a search. |
| Accidental exiting or editing. | Moderate | Grown-up lock (hold, PIN or math question), Android back button captured, and screen-pinning guidance. |
| Voices: childish, quiet, few options. | Moderate | Uses any system voice, with rate, pitch and volume controls and a test button. Buttons can also play a recorded voice. |

## What users value

- **Motor-planning consistency.** Words never move. To grow vocabulary, buttons are *masked* (hidden but keeping their place) instead of deleted.
- **Core vocabulary on the home page**, with fringe words one level deep (Universal Core 36 + categories).
- **Symbols and keyboard in one app.**
- **Scripts and gestalts** for gestalt language processors. They are easy to save, but they live in Phrases rather than replacing core words.
- **Word forms on demand** (go → went/going/goes), with no forced auto-inflection.
- **Alternative access:** switch scanning, hold-to-select, ignore repeated taps, select on release.

## What caregivers and SLPs want

- Fast, safe editing behind a lock.
- Automatic backups, plus export/import and portable boards (Open Board Format, `.obf`/`.obz`).
- Data logging that is **private, opt-in and switchable**. A press count is not the same as communication.
- Modeling support: a way to show where words are.
- Hide without moving, plus a **Babble mode** that temporarily reveals everything for exploration.
- Visual schedules, first/then boards, choice boards and timers.

## Design rules we follow

- Modified Fitzgerald Key colours: yellow pronouns, green verbs, blue descriptors, orange nouns, pink social/prepositions, purple questions, red negation. The colouring can be switched to border-only or off.
- Words are laid out left to right in rough sentence order (pronoun → verb → descriptor → noun).
- A robust vocabulary from day one, including words for protest and boundaries.
- **"No", "stop" and "break" are always reachable.** The quick bar stays on every board.
- 24/7 access with no readiness gatekeeping. Babbling and stimming on the device is welcome.
- Autonomy over automation. Learning prediction and logging are opt-in, and everything stays on the device.
- Not childish: a "Clean" adult theme, adult-suitable phrases and real voices.
- Part-time use: fast launch, an "About me / I need extra time" card, and scripts prepared in advance.

## Key sources

- arXiv 2404.17730, interviews with autistic adult AAC users (speed, autonomy, voices, privacy)
- arXiv 2507.00202, part-time AAC use
- NHS AAC West, "Editing vocabulary dos & don'ts" (mask, don't delete)
- AbleNet: core vocabulary on the home page; Speak for Yourself's babble mode
- PrAACtical AAC: colour coding, CoughDrop and OBF
- AssistiveWare: gestalt language processing and AAC; word forms
- Autistic AAC Underground and Alyssa Zisk: 24/7 access, stimming on the device
- r/slp: TD Snap subscription backlash
