# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memoro is a React Native + Expo mobile app for learning English vocabulary (A1–C2). Users pick a level, get daily words, and generate lock-screen images with those words for passive learning. It also ships a dictionary, grammar WebView, exercises, word lists, and games. The app is fully offline-capable, with word data served from a remote JSON API on first load and cached in SQLite.

Supported UI languages: Turkish (`tr`) and Portuguese (`pt`). All user-facing strings must go through the language system — see "Localization" below.

## Commands

```bash
npm install              # install deps
npm start                # expo start (Metro + QR for Expo Go / dev client)
npm run android          # build & run on Android (creates native project on first run)
npm run ios              # iOS (macOS only)
npm run web              # web target via expo
```

Release/preview builds go through EAS — see `eas.json` (`development`, `preview`, `production` profiles). No lint or test scripts are configured in `package.json`.

Notes:
- The app uses `expo-dev-client`, so several native modules (expo-sqlite, expo-notifications, expo-media-library, react-native-view-shot, etc.) will not run properly in plain Expo Go — use `npm run android` / `npm run ios` for a dev build when touching anything native.
- `newArchEnabled: true` is set in `app.json` — keep compatibility with the React Native new architecture in mind when adding native libs.

## Architecture

### Entry & navigation
- `index.ts` → `App.tsx` is the root. `App.tsx` wires `ThemeProvider` → `LanguageProvider` → `SafeAreaProvider` → `NavigationContainer` and defines the single native stack navigator with all screens. `RootStackParamList` in [app/types/navigation](app/types/navigation) is the source of truth for routes and params — add new screens there first.
- First-launch flow is gated by the `hasSeenOnboarding` flag in AsyncStorage; initial route is `Onboarding` or `LevelSelection`.

### Layered structure under [app/](app/)
- `screens/` — one file per route, matches the Stack.Screen list in `App.tsx`.
- `components/` — shared presentational building blocks (LevelButton, WordCard, NumberSelector, modals, DataLoader, etc.).
- `context/ThemeContext.tsx` + `contexts/LanguageContext.tsx` — **note the two different folder names** (`context` vs `contexts`). Don't "fix" this by consolidating without checking imports across the project; both paths are referenced throughout.
- `services/` — side-effectful singletons:
  - `database.ts` — `dbService` wraps `expo-sqlite` (`memoro.db`). Exposes `getFirstAsync`/`getAllAsync`/`withTransaction` helpers and domain methods for words, word lists, learned words, and unfinished exercises. Uses batched inserts (`BATCH_SIZE = 500`) and PRAGMA tuning.
  - `storage.ts` — AsyncStorage wrapper for settings/preferences.
  - `notifications.ts` — daily reminder scheduling via `expo-notifications`.
  - `backup.ts` — export/import of word lists and settings.
- `data/wordLists.ts` — fetches word data from the remote API `https://raw.githubusercontent.com/eyupduran/english-words-api/main/languages/{learningLanguage}-{nativeLanguage}/all-words.json` on first load, then reads from SQLite for subsequent requests. The `{learning}-{native}` language pair determines which dataset is used.
- `locales/tr.ts`, `locales/pt.ts` — translation dictionaries. `app/translations/` is empty (legacy, ignore).
- `theme/` — palette and style tokens consumed via `useTheme()`.
- `types/` — shared TypeScript types (`words.ts`, `navigation.ts`, etc.).
- `utils/` — pure helpers.

### Data flow pattern
Screens consume data via services (`dbService`, `storageService`) rather than importing JSON directly. Word content lives in SQLite after the first sync; static bundled JSON under `/groups` and `/assets` is only used for initial seeding / filtering and should not be imported into the app runtime code.

### Image generation
The "create lock-screen image" feature composes a selected background with chosen words using `react-native-view-shot`, then saves to the gallery via `expo-media-library`. `WordOverlayScreen` + `ImageSelectionScreen` own this flow and support ~10 layout formats (standard, flashcard, bubble, modern, etc.).

### Lock-screen wallpaper (Android native module)
A local Expo module at [modules/expo-wallpaper/](modules/expo-wallpaper/) exposes direct lock-screen wallpaper APIs that the JS layer cannot reach otherwise. This powers both the manual "Kilit Ekranı Yap" button and the automatic daily rotation feature.

**Native layer**
- **Kotlin module** ([WallpaperModule.kt](modules/expo-wallpaper/android/src/main/java/expo/modules/wallpaper/WallpaperModule.kt)): wraps `WallpaperManager.setBitmap(..., FLAG_LOCK)`. Does **not** touch the home-screen wallpaper. Includes MIUI/HyperOS detection and deep-links to MIUI's "Other permissions", "Autostart" and battery optimization screens, because on Xiaomi/Redmi devices `setBitmap` can fail silently without the "Change wallpaper" permission.
- **Bitmap scaling**: `scaleBitmapToScreen` in the native module rescales any PNG to the device's current lock-screen dimensions before calling `setBitmap`. This means the JS-side `ViewShot` can produce bitmaps at any size (e.g. `WINDOW.width × WINDOW.height`) and the native layer normalises them — do not try to force "real screen dimensions" in JS.
- **Alarm receiver** ([WallpaperAlarmReceiver.kt](modules/expo-wallpaper/android/src/main/java/expo/modules/wallpaper/WallpaperAlarmReceiver.kt)): `AlarmManager`-based daily trigger. Reads a pre-rendered PNG from the app cache dir and applies it **without involving JS/React** — so auto-rotation works even if the user never opens the app. Self-reschedules on each fire and on boot (via `WallpaperBootReceiver`).
- **iOS stub**: all methods return `UNSUPPORTED_PLATFORM`. Apple does not expose any public lock-screen wallpaper API — [WordOverlayScreen.tsx](app/screens/WordOverlayScreen.tsx) falls back to saving to the gallery and showing manual instructions on iOS.

**Auto lock-screen wallpaper — architecture**

Users configure auto mode entirely in [AutoWallpaperSettingsScreen.tsx](app/screens/AutoWallpaperSettingsScreen.tsx). This screen is a **full form**, not a status-only view — it holds all tunable settings plus a live preview.

- **`OverlaySnapshot` type** (in [autoWallpaper.ts](app/services/autoWallpaper.ts)): persists the overlay customisation state used for the daily rotation — `backgroundImage`, `layoutStyle`, `wordFormat`, `textColor`, `fontFamily`, `fontSizeScale`, `positionOffsetX/Y`, `wordCount`, `level`. **Most snapshot fields are hard-coded to the manual-flow defaults** (layout=`plain`, wordFormat=`inline`, textColor=`#FFFFFF`, etc.). Only two values are user-tunable in the settings screen: **`wordCount` (3–5)** and **`level` (A1–C2)**. This was a deliberate simplification after earlier iterations exposed too many options and confused users.
- **`DEFAULT_SNAPSHOT`** mirrors the initial state of `WordOverlayScreen` on first open. If you change manual-flow defaults, keep this in sync.
- **`getSettings()`** clamps `wordCount` to 3..5 on read for forward-compat with older installs that may have saved values up to 8.
- **Service methods** in `autoWallpaperService`:
  - `getSettings()` / `saveSettings()` — AsyncStorage roundtrip, auto-seeds defaults on first read.
  - `updateSnapshot(partial)` — patch the snapshot without touching time/enabled.
  - `pickWordsForSnapshot(snapshot, languagePair)` — picks a fresh word set, prioritising unlearned words (Fisher-Yates shuffle after sorting by `learnedSet`).
  - `resolveBackgroundImage(snapshot)` — returns the snapshot's stored background URI, or picks a random one from `dbService.getBackgroundImages()` if empty.
  - `registerPreparedWallpaper(capturedUri)` — copies a PNG to `${cacheDirectory}/auto_wallpaper.png` and calls `Wallpaper.setCachedWallpaperPath()`.
  - `enable(hour, minute)` — schedules the daily alarm via `Wallpaper.scheduleDailyWallpaper()`.
  - `updateTime(hour, minute)` — re-schedules without touching the snapshot.
  - `disable()` — cancels the native alarm, keeps the snapshot for a quick re-enable.

**Live preview in AutoWallpaperSettingsScreen**

The preview is a **real full-screen `ViewShot`** that is visually scaled down using `transform: scale(previewScale)` with `transformOrigin: 'top left'`. Critical invariants:
- The ViewShot uses **`Dimensions.get('window')`** (not `'screen'`) for its width/height. Earlier versions used `'screen'` which is taller than the actual rendered area and caused words with large `positionOffsetY` to be invisible in the preview but still present in the captured PNG.
- `WordOverlayScreen`'s `previewContainer` now also uses **`flex: 1`** so both surfaces operate in the same coordinate space. Preview and capture are pixel-for-pixel identical.
- When "Şimdi Dene" is pressed, the exact same ViewShot is captured and handed to `autoWallpaperService.registerPreparedWallpaper()`, then `Wallpaper.applyCachedWallpaperNow()` fires — so what the user sees in the preview is what lands on the lock screen.
- `getInitialVerticalPosition(wordCount)` uses **bottom-aligned positioning**: `windowHeight - (wordCount * 70) - 40`, floored at 150 dp. This places words in the lower half of the screen by default (the upper area is reserved for the MIUI clock widget in the real lock screen, and for the button bar in the WordOverlayScreen preview). If you change this formula, change it in **both** [WordOverlayScreen.tsx](app/screens/WordOverlayScreen.tsx) and [AutoWallpaperSettingsScreen.tsx](app/screens/AutoWallpaperSettingsScreen.tsx) or the preview will disagree with the capture.

**WordOverlayScreen button bar position**

The manual flow's button bar (Kilit Ekranı Yap / Otomatik Yap / Kaydet / Özelleştir / Ana Sayfa) is anchored at the **TOP** of the screen (`position: 'absolute', top: 0`) inside a rounded, semi-transparent container. This is a deliberate choice:
- Visually, the top-bar area in the preview maps to the MIUI clock widget area in the real lock screen. So whatever the button bar covers in the preview is the same region the clock covers in the output — preview and capture feel visually consistent.
- Because the button bar lives **outside the ViewShot tree** (sibling of `ViewShot`, not descendant), it is never captured. There is no "hide buttons during capture" hack — an earlier version had one and it caused a visible flicker on every save.

**"Otomatik Yap" button in WordOverlayScreen**

This button is **info-only**. It shows an alert telling the user whether auto mode is active and offers a "Ayarları Aç" action that navigates to `AutoWallpaperSettings`. It does **not** mutate any snapshot state, does **not** capture, and does **not** touch the native alarm. All auto-mode configuration happens in the settings screen. An earlier version of this button popped a time-picker modal and overwrote the snapshot on each press — this caused confusing state mutations and was removed.

**First-time promo**

[LevelSelectionScreen.tsx](app/screens/LevelSelectionScreen.tsx) shows a one-time promo modal (~600ms after first mount) for the auto-wallpaper feature. Gated by the AsyncStorage flag `auto_wallpaper_promo_seen_v1`. The promo must not be shown during onboarding itself — the onboarding slides run **before** `DataLoader` seeds the DB, so at that point `dbService.getWords()` is empty and the auto-wallpaper preview would be blank. Showing the promo on first LevelSelection mount means the DB is guaranteed to be populated.

**Entry points**
- [WordOverlayScreen.tsx](app/screens/WordOverlayScreen.tsx) → "Otomatik Yap" button (info alert → settings).
- [MoreModal.tsx](app/components/MoreModal.tsx) → "Otomatik Kilit Ekranı" menu item → settings.
- [LevelSelectionScreen.tsx](app/screens/LevelSelectionScreen.tsx) → first-time promo modal → settings.

## Project conventions (from `.cursor/rules/memoro-general-rules.mdc`)

- **Theme**: never hardcode colors, fonts, or spacing. Pull from `useTheme()` so light/dark/pastel all work. Any new component must render correctly under all three themes.
- **Localization**: no hardcoded user-facing strings. Add every new string to **both** `app/locales/tr.ts` and `app/locales/pt.ts` and read via `useLanguage().translations`. Missing a language will leave users of that locale with blank/English text.
- **Additive changes**: features must preserve existing behavior — this app is shipped (v1.0.0 on Play Store / APK). Don't refactor architecture opportunistically while adding features.
- **Performance**: avoid unnecessary re-renders, and use the batched DB helpers in `database.ts` for any bulk word operations instead of per-row inserts.
- **Responsive / accessibility**: new UI must adapt to screen sizes and support screen readers and keyboard navigation.

## Gotchas

- Two context folders (`app/context/` for Theme, `app/contexts/` for Language) — use the exact path that already exists for each.
- `WordListScreen` title uses `translations.wordList.title.replace('{0}', '')` — the `{0}` placeholder pattern is used throughout the localization files; preserve it when adding parameterized strings.
- Remote word API depends on both `selectedLanguage` (native/UI) and `learningLanguage` keys in AsyncStorage; the URL is `{learning}-{native}` in that order. Defaults are `en` learning, `tr` native.
- `groups/all_words.json` and `groups/filter_bad_words.go` are tooling/data-prep artifacts, not part of the runtime bundle.
- **Local native modules live under [modules/](modules/)**, not in `android/` or `ios/` directly. Expo autolinking picks them up at prebuild time — no manual registration in `app.json` `plugins` is needed. When adding native code, edit the module's own `AndroidManifest.xml` (merged automatically) and `build.gradle`.
- **Auto lock-screen wallpaper is Android-only by design.** Never try to "make it work" on iOS by generating widgets or photo library shortcuts pretending to be wallpapers — Apple does not allow programmatic lock-screen wallpaper and the fallback UX (save + instructions) is the correct answer.
- On MIUI/HyperOS (Xiaomi/Redmi), `WallpaperManager.setBitmap` can fail silently if the "Change wallpaper" permission under "Other permissions" is off. The native module surfaces `needsMiuiPermission=true` on permission errors — JS handlers should deep-link via `Wallpaper.openMiuiOtherPermissions()`.
