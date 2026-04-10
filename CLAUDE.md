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
