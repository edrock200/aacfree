---
name: build-android
description: Set up the Android SDK in a fresh container and build AACFree's signed release APK with Capacitor + Gradle. Use when asked to build/compile the APK, test the Android project, or after changing anything in android/ or capacitor.config.ts.
---

# Build the AACFree Android APK

## 1. Android SDK (skip if `/opt/android-sdk/platforms/android-36` exists)
```bash
mkdir -p /opt/android-sdk && cd /opt/android-sdk
# find the latest command-line tools zip name
curl -s https://dl.google.com/android/repository/repository2-3.xml | grep -o 'commandlinetools-linux-[0-9]*_latest.zip' | sort -t- -k3 -n | tail -1
curl -sSLo clt.zip https://dl.google.com/android/repository/<that-zip>
unzip -q clt.zip && mkdir -p cmdline-tools/latest && mv cmdline-tools/{bin,lib,NOTICE.txt,source.properties} cmdline-tools/latest/
export ANDROID_HOME=/opt/android-sdk
yes | cmdline-tools/latest/bin/sdkmanager --licenses >/dev/null
yes | cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```
Java 21 is needed (it is preinstalled in the cloud image). Capacitor 8 targets compileSdk 36 (`android/variables.gradle`).

## 2. Build
```bash
cd <repo>
echo "sdk.dir=/opt/android-sdk" > android/local.properties   # git-ignored
npm ci
npm run build && npx cap sync android
cd android && ANDROID_HOME=/opt/android-sdk ./gradlew assembleRelease --no-daemon
# → android/app/build/outputs/apk/release/app-release.apk
```
The first Gradle run downloads Gradle 8.14 and the dependencies, which takes several minutes. Run it in the background.

## 3. Signing
The signing key is **never committed** (both `android/signing/` and `android/keystore.properties` are git-ignored, and committing them is blocked). If they are missing, `assembleRelease` produces an *unsigned* APK. Either:
- ask the user for their keystore and recreate `android/keystore.properties` (storeFile/storePassword/keyAlias/keyPassword), or
- build `./gradlew assembleDebug` for testing only.
Updates must be signed with the same key as the installed app.

Verify the signature:
```bash
/opt/android-sdk/build-tools/36.0.0/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

## Gotchas
- The Android WebView has no `speechSynthesis`. Speech goes through the TTS plugin (`src/lib/tts.ts`). The manifest needs the `TTS_SERVICE` `<queries>` entry (Android 11+).
- Microphone and camera access for `getUserMedia` / file capture rely on the manifest permissions. Capacitor requests them at runtime.
- After changing icons, run `node scripts/make-icons.mjs` again. It also rewrites the splash PNGs and the adaptive icon background.
- Bump `versionCode`/`versionName` in `android/app/build.gradle` for each release (see the release skill).
