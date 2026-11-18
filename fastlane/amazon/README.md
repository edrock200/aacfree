# Amazon Appstore listing for AACFree

| What | File | Size |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512 PNG, transparent corners |
| Small icon | `icon-114.png` | 114 × 114 PNG, transparent corners |
| Screenshots (6, upload in order) | `screenshots/1_home.png` … `6_library.png` | 1920 × 1080 PNG |

Text: reuse the Google Play text in `fastlane/metadata/android/en-US/` (`title.txt`, `short_description.txt`, `full_description.txt`).
Optional promotional image (1024 × 500): `fastlane/metadata/android/en-US/images/featureGraphic.png`.
App file: `aacfree.apk` from the latest GitHub release.

Regenerate: `AMAZON=1 ONLY=tablet node scripts/store-screenshots.cjs <preview url>` (see the script's header).
