# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This `app/` directory is the Expo (React Native + TypeScript) client for a 出張買取 sales-recording product. It is one half of a monorepo rooted at `..` whose other half is `../functions/` (Firebase Cloud Functions running the Whisper → Claude pipeline). Firebase config (`firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`) lives at the repo root, not here. When changing rules/indexes/functions, edit the root copies and deploy with `firebase deploy --only ...` from the repo root.

## Commands

Run from this `app/` directory:

- `npm run start` — Expo dev server (requires an EAS-built dev client on a real device; **Expo Go does not work** because of background-fetch and Google Sign-In native modules)
- `npm run ios` / `npm run android` — start with platform pre-selected
- `npm run web` — web bundle (limited; mostly for layout sanity checks)
- `npm run demo` — `EXPO_PUBLIC_DEMO=true expo start --web`. Boots a fully self-contained mock environment (auto-login, mock deals, simulated upload/transcribe/minutes pipeline). No Firebase or API keys needed. This is the primary way to verify UI changes without a device.
- `npm run typecheck` — `tsc --noEmit`. There is no test runner and no linter wired up; typecheck is the only automated gate.
- `npm run prebuild` — generates native `ios/`/`android/` directories. Generally avoid running this; the project is managed via EAS Build using config plugins (see `app.config.ts`).

EAS builds are configured in `eas.json` (development / preview / production profiles). The `production` profile auto-increments build numbers.

## Environment

- `.env` (gitignored) drives `app.config.ts` via `dotenv/config`. `app.config.ts` reads each var with `required()`, which warns rather than throws when `EXPO_PUBLIC_DEMO=true`. Copy `.env.example` and fill it before running non-demo builds.
- iOS Firebase init reads `GoogleService-Info.plist`. Locally the file at `./GoogleService-Info.plist` is used; on EAS it comes through the `GOOGLE_SERVICES_PLIST` env-file path (this indirection is intentional — committed plist files were previously dropped during EAS build).
- Path alias `@/*` → `src/*` is set in `tsconfig.json`. Use it everywhere; relative imports across `src/` subdirectories should be avoided.

## Architecture overview (read these together to be productive)

The non-obvious flow is the **local-first recording pipeline**, which spans `useRecorder` → `audioStorage` → `uploadQueue` → `recordings` service → Firestore → Cloud Functions. Skim these files together before touching any of them:

1. **`src/hooks/useRecorder.ts`** — wraps `expo-av` (not `expo-audio`; v0.4 of expo-audio threw Obj-C exceptions on this RN/SDK combo). On web/demo it falls back to a fake recorder driven by timers. Tracks `pauseReason: 'user' | 'interruption'` to distinguish manual pause from system audio interruptions.
2. **`src/services/audioStorage.ts`** — on stop, the audio file is copied into `FileSystem.documentDirectory/recordings/` *before* any network work. Local persistence is the source of truth.
3. **`src/services/uploadQueue.ts`** — queue is per-`ownerUid`, persisted in `AsyncStorage` under `@upload_queue/{uid}`. Retries use exponential backoff `[5s, 30s, 2m, 5m, 15m]` and stop after 5 attempts (then require manual retry). Local files are deleted **only after** upload confirmation.
4. **`src/services/recordings.ts`** — creates the Firestore `recordings/{id}` doc and uploads to Firebase Storage. The status transitions `uploading → uploaded → transcribing → transcribed → generating_minutes → completed | failed` are the contract with Cloud Functions.
5. **`../functions/src/index.ts`** — `onRecordingUploaded` triggers on `uploaded` and runs `processRecording` (Whisper transcription → Claude minutes). Region `asia-northeast1`, secrets `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`.
6. **Background drain triggers** are wired in `useUploadQueue` and friends: NetInfo reconnect, AppState `active`, list-screen focus, and the `expo-task-manager` task `com.makxas.salesrecording.upload` (currently disabled — see `ENABLE_BACKGROUND_FEATURES = false` in `App.tsx`).

### Deal-binding contract

Recordings **must** be bound to a CRM deal. There is no "free recording" path:

- `src/services/crm.ts` is the CRM (マクサスコア) client. It is currently stubbed (`MOCK_ENABLED = true`); flipping that to `false` and implementing `httpGet` is the documented integration point. The mock identifies "me" by the logged-in Firebase user's email.
- A `DealSnapshot` (subset of `Deal`) is frozen onto every `recordings/{id}` document at creation time so that later CRM mutations don't corrupt historical records.
- Deep links: `makxasrec://deal/{dealId}` is parsed in `AppNavigator.tsx`. Before navigating to `Record`, three checks run: deal exists, `assessorEmail` matches `user.email` (case-insensitive via `emailsMatch`), and `status === 'scheduled'`. Failures show an Alert and stop. The `linking` config is **iOS/Android only** — on web it is intentionally `undefined` because React Navigation's path resolver fights the GitHub Pages `baseUrl` for the demo build.

### Firebase initialization quirk

`src/config/firebase.ts` does **not** call `auth()` / `firestore()` / `storage()` at module load. They are wrapped in lazy getters (and a `Proxy`-based `lazy<T>()` for `firebaseAuth` / `firestoreDb` / `firebaseStorage` exports). Reason: synchronous calls at import time crashed with Obj-C exceptions when the native Firebase init failed (missing plist, bundle ID mismatch, etc.). When adding new Firebase modules, keep this lazy pattern.

There is also a dev-only `FirebaseDiagnostic` screen in `App.tsx` gated by the `FIREBASE_DIAGNOSTIC` constant. Toggle it to `true` to walk through each `require` and instance acquisition step on device when debugging launch crashes.

### Demo mode

`DEMO_MODE` (`src/demo/index.ts`) reads `Constants.expoConfig.extra.demoMode`. Many services branch on it: `recordings.ts`, `uploadQueue.ts`, `useAuth`, `useRecorder`, `crm.ts`. When adding a new service that touches network/native APIs, follow the same pattern and route to a `demoStore` equivalent so `npm run demo` keeps working.

The demo build is also published to GitHub Pages under `/claude-code/demo` — `app.config.ts` injects `experiments.baseUrl` accordingly when `EXPO_PUBLIC_DEMO=true`.

## iOS 26 / new-architecture caveats baked into the code

These are real constraints; do not "clean them up" without testing on iOS 26:

- `newArchEnabled: false` in `app.config.ts`. Re-enabling froze certain third-party modules.
- Navigation uses **JS Stack** (`@react-navigation/stack`), not native-stack. Native-stack via `react-native-screens` crashed on iOS 26 status-bar interactions.
- `expo-status-bar` and RN `StatusBar` are deliberately **not used** anywhere — `RCTStatusBarManager.setStyle` is incompatible with the iOS 26 Scene API and crashes. Status bar appearance is left to OS defaults.
- `navigation.replace` is avoided in favor of `navigation.navigate` for the same reason; see `AppNavigator.tsx` comments.
- Deal objects passed via navigation params are deep-copied with `JSON.parse(JSON.stringify(deal))` to strip any cyclic refs that would crash the serializer.
- `infoPlist.UIBackgroundModes` is currently `['audio']` only. `fetch` / `processing` modes and `BGTaskSchedulerPermittedIdentifiers` were removed for launch-stability and must be restored together with `ENABLE_BACKGROUND_FEATURES = true` if background uploads are re-enabled.

## Error visibility

`App.tsx` installs a global `ErrorUtils.setGlobalHandler` plus an `AppErrorBoundary`. JS errors render an in-app red banner (`GlobalErrorBanner`) rather than a black screen. `src/services/errorLog.ts` is the canonical place to send/structure error events; prefer `logError(...)` over bare `console.error` in feature code.
