# App Store listing for AACFree

Everything App Store Connect asks for, made to Apple's [asset best practices](https://developer.apple.com/app-store/asset-best-practices/).

## Images

| What | File(s) | Size | Where it goes in App Store Connect |
|---|---|---|---|
| iPhone 6.9" screenshots (6) | `screenshots/en-US/iPhone69_*.png` | 1320 × 2868 | Version page → Previews and Screenshots → **iPhone 6.9" Display**. Smaller iPhones use these automatically. |
| iPhone 6.1"/6.3" screenshots (6) | `screenshots/en-US/iPhone63_*.png` | 1206 × 2622 | **iPhone 6.1" or 6.3" Display** slot, if that's the one App Store Connect shows. |
| iPhone 6.5" screenshots (6) | `screenshots/en-US/iPhone65_*.png` | 1284 × 2778 | Only if App Store Connect shows an **iPhone 6.5" Display** slot: that slot doesn't accept the 6.9" size. |
| iPad screenshots (6) | `screenshots/en-US/iPad_*.png` | 2752 × 2064 (iPad 13") | Same, iPad 13" Display. Smaller iPads use these automatically. |
| Product page header (optional) | `creative/header-21x9.png` | 3840 × 1646, 21:9 | App Store → Creative assets (where offered) |
| Search results art (optional) | `creative/search-3x2.png` | 3840 × 2560, 3:2 | Same |
| Universal art (optional) | `creative/universal-16x9.png` | 5244 × 2950, 16:9 | Same |
| Icon (1024) | `icon-1024.png` | 1024 × 1024 | Not uploaded: the build carries the icon. For press and listings. |

All PNG, no transparency. Fill **one** iPhone slot (whichever App Store Connect shows) and the iPad 13" slot; Apple scales them for the other sizes. Screenshots go in the screenshot area, not **App Previews**, which takes only 15–30 second videos. Screenshots are numbered in the order to upload them: they tell one story, best feature first, with one short caption each, and no prices, web addresses, awards or other platforms. In the creative assets the logo and headline sit inside Apple's art safe area.

Regenerate: `IOS=1 node scripts/store-screenshots.cjs <preview url>` (screenshots; see the script's header) and `node scripts/apple-creative.cjs` (creative assets and icon).

## Text

One folder per language: `metadata/en-US`, `metadata/es-MX` (Spanish, Mexico), `metadata/fr-FR` and `metadata/pt-BR`. Add a language in App Store Connect (App Information → Localizable information) and paste each file into its field:

| File | Field | Limit |
|---|---|---|
| `name.txt` | Name | 30 characters |
| `subtitle.txt` | Subtitle | 30 |
| `promotional_text.txt` | Promotional Text (can change any time without a new version) | 170 |
| `description.txt` | Description | 4000 |
| `keywords.txt` | Keywords (comma-separated, no spaces) | 100 bytes |
| `support_url.txt`, `marketing_url.txt` | Support URL, Marketing URL | |
| `privacy_url.txt` | Privacy Policy URL (App Privacy) | |

Plus, for every language: `copyright.txt` (Copyright) and `review_notes.txt` (App Review Information → Notes).

`src/lib/__tests__/store-listing.test.ts` checks the limits, that every language has every field, and that the text never mentions other platforms.

Keywords don't repeat words from the name or subtitle (Apple already indexes those) and name no other apps.
