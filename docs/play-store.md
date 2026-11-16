# Publishing AACFree on Google Play: owner checklist

Everything that doesn't need the developer account is already done and lives in the repo:

| What | Where |
|---|---|
| Store text (English) | `fastlane/metadata/android/en-US/title.txt`, `short_description.txt`, `full_description.txt` |
| Store text (Latin-American Spanish) | `fastlane/metadata/android/es-419/` (same three files) |
| Release notes for v0.2.0 (versionCode 200) | `fastlane/metadata/android/en-US/changelogs/200.txt` |
| App icon 512×512 | `fastlane/metadata/android/en-US/images/icon.png` |
| Feature graphic 1024×500 | `fastlane/metadata/android/en-US/images/featureGraphic.png` |
| Phone screenshots (6, 1080×1920) | `fastlane/metadata/android/en-US/images/phoneScreenshots/` |
| 10-inch tablet screenshots (4, 2560×1600) | `fastlane/metadata/android/en-US/images/tenInchScreenshots/` |
| Privacy policy | `site/privacy.html` → `https://aacappfree.com/privacy.html` |
| Screenshot generator | `scripts/store-screenshots.cjs` (see [Regenerating the graphics](#regenerating-the-graphics)) |

Package name: **`org.calebaac.app`**. It can never change after the first upload.

---

## 1. Create the developer account

1. Go to <https://play.google.com/console/signup> and sign in with the Google account that should own AACFree long-term. A dedicated account, not a personal Gmail you might lose, is a good idea.
2. Choose the account type:
   - **Personal**: fastest. **New personal accounts must run a closed test with at least 12 testers who stay opted in for 14 days in a row** before they can publish to production. Plan for this (see step 5).
   - **Organization**: needs a D-U-N-S number. It skips the 12-tester rule, but takes longer to set up.
3. Pay the one-time US$25 registration fee.
4. Complete identity verification (government ID) and verify a contact phone number and email address. This can take a few days.
5. Set the **public developer name** (shown under the app title, for example "AACFree") and a **public contact email**. Play requires an email address on the store listing. Consider a dedicated address.

## 2. Create the app in the Console

**Home → Create app**:
- App name: `AACFree – Talk with pictures` (from `title.txt`)
- Default language: **English (United States) – en-US**
- App or game: **App**
- Free or paid: **Free**. A free app can never become paid, which is correct here: the ARASAAC pictograms are non-commercial (CC BY-NC-SA).
- Accept the declarations (Developer Program Policies, US export laws).

## 3. Signing: upload key and Play App Signing

Play distributes apps signed with an **app signing key** that Google holds. You sign each upload with a separate **upload key**. If you lose the upload key, Google can reset it. If you lose the app signing key, you can never update the app, which is why Google keeps it.

Your existing release key lives in `android/signing/release.jks`, described by `android/keystore.properties` (both git-ignored; **keep an offline backup of both**).

There are two ways to set this up. Choose before the first upload, because it can't be changed afterwards.

### Option A (simplest): your existing key becomes the upload key
1. **Test and release → Setup → App signing**: keep the default, **"Use a Google-generated key"**.
2. Build the AAB (step 4) signed with your existing `release.jks`. The first upload registers it as the upload key.

Downside: the Play version is then signed by Google's key, and the APKs on GitHub/the website by yours. Android treats them as different apps for updates. A family that installed the GitHub APK can't update to the Play version in place. They would have to **save a backup (Settings → Backup), uninstall, install from Play, and restore**. Uninstalling erases the app's data.

### Option B (keeps existing installs upgradable): your existing key becomes the app signing key
1. Create a **new** private upload key, and keep it outside git:
   ```bash
   keytool -genkeypair -v -keystore android/signing/upload.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **App signing → "Use a different app signing key" → "Export and upload a key from Java keystore"**. Download `pepk.jar` and the encryption public key from that page, then run the exact command the Console shows against `android/signing/release.jks` (alias `caleb`). Upload the resulting zip.
3. Upload `upload.jks`'s certificate when asked:
   ```bash
   keytool -export -rfc -keystore android/signing/upload.jks -alias upload -file upload_certificate.pem
   ```
4. Point `android/keystore.properties` at `upload.jks` for Play builds. Keep a separate copy that points at `release.jks` for GitHub APKs. Play and GitHub builds are then interchangeable for updates.

Either way, update the CI secrets (`ANDROID_KEYSTORE_BASE64` etc., see README) if you want CI to build signed bundles.

## 4. Build the Android App Bundle (AAB)

Play only accepts `.aab` files, not APKs. You need the Android SDK and JDK 21 (see `.claude/skills/build-android/SKILL.md`).

```bash
npm ci
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
```

Output: **`android/app/build/outputs/bundle/release/app-release.aab`**

It is signed with whatever `android/keystore.properties` points to. If that file is missing, the bundle is unsigned and Play will reject it. Check the signature with:
```bash
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab | tail -5
```
`versionCode` and `versionName` come from `package.json` automatically (see step 11). v0.2.0 is versionCode **200**.

## 5. Testing tracks: internal first

1. **Test and release → Testing → Internal testing → Create new release**. Upload `app-release.aab`. Release name: `0.2.0`. Paste `fastlane/metadata/android/en-US/changelogs/200.txt` as the release notes.
2. **Testers** tab: create an email list (you, family, your SLP; up to 100 people). Share the opt-in link. Internal releases reach testers within minutes, with little or no review.
3. Install from the opt-in link on a phone **and** a tablet. Check that:
   - speech works (native TTS), recording a voice clip, taking a photo, and Back never exits the app
   - a backup restores
4. Look at the **Pre-launch report** (Quality → Pre-launch report) for crashes or accessibility warnings.
5. **Personal accounts:** next create a **Closed testing** track, add **at least 12 testers**, and keep them opted in for **14 consecutive days**. Then use **Apply for production** on the Dashboard. Google asks a few questions about the test.
6. Production: **Test and release → Production → Create new release** (or promote the tested release). Consider a staged rollout (for example 20% → 100%).

## 6. Store listing (Grow users → Store presence → Main store listing)

| Console field | File |
|---|---|
| App name (30) | `fastlane/metadata/android/en-US/title.txt` |
| Short description (80) | `fastlane/metadata/android/en-US/short_description.txt` |
| Full description (4000) | `fastlane/metadata/android/en-US/full_description.txt` |
| App icon | `fastlane/metadata/android/en-US/images/icon.png` |
| Feature graphic | `fastlane/metadata/android/en-US/images/featureGraphic.png` |
| Phone screenshots | all 6 files in `…/images/phoneScreenshots/`, in file-name order |
| 7-inch tablet screenshots | optional; you can reuse the 10-inch set |
| 10-inch tablet screenshots | all 4 files in `…/images/tenInchScreenshots/` |
| Video | leave empty |

**Store settings** (Store presence → Store settings):
- App category: **Communication**. Avoid "Medical", which brings extra health declarations and implies medical claims.
- Tags: pick things like *Communication*, *Accessibility* and *Education* if they're offered.
- Contact details: your public email, and the website `https://aacappfree.com/`.

**Spanish translation:** Main store listing → **Manage translations → Add your own translation text → Spanish (Latin America) – es-419**. Paste the three files from `fastlane/metadata/android/es-419/`. The graphics fall back to the English ones. The description already says the app is in English for now and that Spanish support comes in 0.3. **Remove that sentence** once 0.3 ships.

## 7. App content (Policy → App content)

Work through every item. Suggested answers:

- **Privacy policy:** `https://aacappfree.com/privacy.html`.
- **Ads:** No, the app does not contain ads.
- **App access:** "All or some functionality is restricted". Instructions for the reviewer: *"No login. Settings and editing are behind the 'Settings' button in the bottom bar: press and hold it for 2 seconds. No password or PIN is set by default."*
- **Content rating:** see step 8.
- **Target audience and content:** see step 9.
- **News app:** No.
- **Advertising ID:** No. AACFree doesn't use it, and the manifest has no `AD_ID` permission.
- **Government app:** No.
- **Financial features:** None.
- **Health apps:** AACFree is a communication tool. Choose that it has **no health features**. The pain scale and body map only help someone *say* how they feel; nothing is measured, diagnosed or tracked. If a reviewer disagrees, the "not a medical device" declaration below covers it.
- **Data safety:** see step 10.

### Not-a-medical-device declaration
This is already in the full description and README. Use the same wording wherever the Console or a reviewer asks:
> AACFree is a communication tool (augmentative and alternative communication). It is not a medical device. It does not diagnose, treat, cure, monitor or prevent any disease or condition, and it makes no medical claims. Families should work with a speech-language pathologist when choosing and setting up AAC.

## 8. Content rating questionnaire (IARC)

- Email: your contact email. Category: **"All other app types"** (utility, productivity, communication or other). It is not a game, social network or news app.
- Violence, fear, sexuality, nudity, profanity or crude humour, drugs, alcohol, tobacco, gambling: **No** to all. The vocabulary includes everyday body and toilet words for communicating needs. That is not crude humour.
- Does the app let users interact or exchange content with other users? **No.** There is no chat, accounts or online features between users. Sharing a message goes through Android's share sheet to another app, which doesn't count.
- Does the app share the user's current location? **No.**
- Does the app allow digital purchases? **No.**
- Is it a web browser or search engine? **No.** The ARASAAC symbol search only returns pictograms.

The expected result is **Everyone / PEGI 3 / USK 0 / IARC 3+**.

## 9. Target audience and the Families policy

- **Target age groups:** AACFree is for **all ages, including children**. Tick every group from **"5 and under" to "18 and over"**.
- Because children are included, the app falls under the **Google Play Families policy**, and the listing gets an extra review. AACFree is compliant:
  - **No ads** and no ad SDKs, so there are no certified-ad-network requirements.
  - **No data collection** of any kind: no analytics, crash reporting, advertising ID or device identifiers, and no third-party SDKs that collect data.
  - No accounts, so there's no account-deletion requirement.
  - A **privacy policy** is linked, and it states what the camera and microphone are used for.
  - Camera and microphone are requested only at the moment of use, for a feature the user starts (button photo, voice clip, head/eye pointer).
  - The store listing doesn't target children with misleading content, and the icon and graphics are age-appropriate.
- "Could your store listing unintentionally appeal to children?" Answer truthfully: the app *is* intended for children as well as adults.
- Ignore the optional "Teacher Approved" program for now.

## 10. Data safety form

AACFree collects and shares nothing. Suggested answers:

1. **Does your app collect or share any of the required user data types?** → **No.**
   - Collection means sending data off the device to you or a third party. AACFree has no servers, analytics or SDKs that do that. Boards, photos, voice clips, settings and the optional usage log stay in on-device storage.
   - **Camera and microphone** are used only on the device. Photos and voice clips are saved locally, and head/eye pointer frames are processed in memory and never stored or sent. Under Play's definitions, on-device processing is not collection.
   - **Online symbol search:** when a grown-up searches for more pictures, the search words are sent directly to the ARASAAC API, and the images are downloaded from ARASAAC. No identifiers are attached and AACFree keeps no search history. This is an anonymous, user-initiated content fetch. If you prefer to be extra conservative, you can instead declare *App activity → "In-app search history": collected, not shared, processed ephemerally, optional, purpose "App functionality"*. Both answers are defensible; "No" is accurate for AACFree itself.
   - **Text-to-speech:** speech goes through the system TTS engine the user chose. If that engine uses online voices, the engine's provider handles that data, not AACFree.
   - **Backups, sync and share** files are created only when the user chooses, and the user decides where they go. Sync files are encrypted with a passcode. Android Auto Backup belongs to the user's own Google account and is not collection by the developer.
2. Since the answer is "No", the form skips the security-practice questions. Review the preview: it should say **"No data collected"** and **"No data shared with third parties"**.

## 11. Releasing an update

1. Bump `"version"` in **`package.json`** only, for example `0.3.0`. `android/app/build.gradle` derives `versionName` from it, and **`versionCode = major×10000 + minor×100 + patch`** (0.3.0 → 300, 0.3.1 → 301). Play rejects a versionCode it has already seen, so every upload needs a new version. (The `release` skill still mentions editing `build.gradle` by hand. That is no longer needed.)
2. Update `CHANGELOG.md`, and add **`fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`** (500 characters max) with user-facing notes. Add an `es-419/changelogs/<versionCode>.txt` once the app speaks Spanish.
3. If the UI changed, regenerate the graphics (below) and re-upload them in the store listing.
4. Build the AAB (step 4) with the **same upload key**. Upload it to **Internal testing**, check it on a device, then **promote** it to Production (Release → *Promote release*).
5. Keep building the GitHub/website APK as before (`npm run android:apk`), signed per your choice in step 3.

### Optional: automate uploads with fastlane
The metadata is already in fastlane `supply` layout. To push text, graphics and AABs from the command line later, create a Google Cloud service account with Play Console access (Setup → API access), save its JSON key **outside git**, and run:
```bash
fastlane supply --package_name org.calebaac.app --json_key /path/to/key.json \
  --aab android/app/build/outputs/bundle/release/app-release.aab --track internal
```
This is optional. Copying and pasting in the Console works fine.

## Regenerating the graphics

The screenshots are taken from the real app with Playwright, then framed with a caption.
```bash
npm ci                                   # if node_modules is missing
npx vite build
npx vite preview --port 4199 --strictPort &
node scripts/store-screenshots.cjs       # or: node scripts/store-screenshots.cjs http://localhost:4199/
```
- It rewrites `icon.png`, `featureGraphic.png`, `phoneScreenshots/*` and `tenInchScreenshots/*`, and exits non-zero on any page error.
- `ONLY=phone`, `ONLY=tablet` or `ONLY=art` regenerates one part. `RAW=1` also keeps the unframed captures in `images/raw/` for checking (git-ignored).
- Captions, the sentences being built and which screens are shown are all set in the script. Phone shots use a 432×768 viewport at 2.5× (1080×1920), and tablet shots use 1280×800 at 2× (2560×1600). Screenshots are written as 24-bit PNG (no alpha), as Play requires.
- Play's limits: 2–8 phone screenshots, each side 320–3840 px, aspect ratio no more than 2:1, under 8 MB each. Icon 512×512 under 1 MB. Feature graphic exactly 1024×500, no transparency.

## Before you press "Publish": final checks

- [ ] Privacy policy URL loads publicly
- [ ] Store listing, translations, all App content items and the Data safety preview are complete (the Dashboard shows a green check for each)
- [ ] The internal test build installed and worked on a phone and a tablet
- [ ] (Personal accounts) 12+ closed testers for 14 days, and production access granted
- [ ] Signing keys backed up offline in two places, with their passwords
