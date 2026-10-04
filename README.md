# 🛡️ Surakshak — Har Kadam, Surakshit

**Har Kadam, Surakshit** — Every Step, Protected.

A women's safety app for India. Expo SDK 57, TypeScript, Firebase.

|                      |                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------ |
| Android Setup (Win)  | [docs/ANDROID_SETUP.md](docs/ANDROID_SETUP.md) — Windows & Android development guide |
| Setup                | [docs/SETUP.md](docs/SETUP.md) — general setup guide                                 |
| Contributing         | [CONTRIBUTING.md](CONTRIBUTING.md) — read before your first PR                       |
| Working with Claude  | [docs/SKILL.md](docs/SKILL.md)                                                       |
| Architecture & rules | [CLAUDE.md](CLAUDE.md) — the single source of truth                                  |
| Security checklist   | [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md)                             |

## Features

### Emergency Core

- 🆘 One-tap SOS — triple-tap the button or shake the phone to trigger
- 📞 Direct call on Android (no dialer shown, no extra tap)
- 📲 Silent SMS on Android (no compose UI, works offline over the device SIM)
- 🔊 Loud siren alarm
- 📱 Fake incoming call
- 🔋 Low-battery auto-alert

### Location & Maps

- 📍 Live location sharing (up to 8 hours, background updates)
- 🗺️ Geofencing — report and view unsafe areas
- 🚶 Safe Journey Mode with check-in and an auto-alert on a missed arrival
- 🏥 Nearby police, hospitals, fire stations and pharmacies

### Community

- 💬 Real-time city community chat
- 📸 Share a location, an image, or a help request
- 🔒 Anonymous posting
- 🛡️ Auto-moderated (hidden after enough reports)

### Information Hub (offline-capable)

- ⚖️ Women's legal rights
- ❓ Safety FAQ
- 💡 Safety tips
- 📰 Safety news

### Advanced Safety

- 🎙️ Silent evidence recording with auto-upload
- 📋 Incident reporting with photos + GPS
- 👁️ Suspicious-follow detection
- ✅ Safe check-in with a missed-check-in alert
- 🔢 Disguise mode (calculator screen with a PIN unlock)

### Multilingual

- 🇬🇧 English · हिन्दी · मराठी

## Emergency features — platform reality

| Feature        | Android                        | iOS                                |
| -------------- | ------------------------------ | ---------------------------------- |
| SMS alert      | Silent, no user tap            | One tap (`expo-sms` compose sheet) |
| Emergency call | Direct, no dialer shown        | One tap (dialer opens pre-filled)  |
| Shake to SOS   | Background, foreground service | Foreground only                    |
| Offline SOS    | Full (device SIM, no internet) | Full (device SIM, no internet)     |

The iOS column isn't a gap to close later — Apple's OS does not expose an API
to send SMS or place a call without a user tap, for any app. Android's direct
paths are implemented as a small local Expo module
(`modules/surakshak-native`); see its `src/index.ts` for both platforms'
implementations side by side.

## Tech stack

| Layer         | Technology                                                               |
| ------------- | ------------------------------------------------------------------------ |
| App           | Expo SDK 57, React Native, Hermes                                        |
| Language      | TypeScript 5 (strict)                                                    |
| Routing       | Expo Router v4                                                           |
| Styling       | NativeWind v4 (Tailwind), light/dark via `prefers-color-scheme`          |
| Native module | Local Expo module — direct SMS + call on Android                         |
| Backend       | Firebase (Auth, Firestore, Storage)                                      |
| Offline       | Firestore's built-in offline persistence + an AsyncStorage cache for SOS |
| Push          | OneSignal                                                                |
| Analytics     | MixPanel (staging + prod only)                                           |
| Errors        | Sentry (staging + prod only)                                             |
| State         | Zustand                                                                  |
| i18n          | react-i18next                                                            |
| Testing       | Jest + @testing-library/react-native, Maestro for E2E                    |

## Repository structure

```
surakshak-redx-org/
├── app/         ← React Native app (this repo)
├── admin/       ← Web CMS and moderation dashboard
├── functions/   ← Firebase Cloud Functions
├── landing/     ← Marketing landing page
├── docs/        ← Internal docs, architecture decisions
└── design/      ← Figma exports, brand assets, tokens
```

## Getting started

```bash
corepack enable                 # this project uses Yarn 4, never npm
yarn install
cp .env.example .env.local      # then fill it in — see docs/ANDROID_SETUP.md
yarn setup:check                # validate your environment, Android SDK & keys
yarn android                    # build & install dev app on your Android device (first time)
yarn start:dev                  # daily Fast Refresh development server
```

For a comprehensive Windows & Android setup guide, see [docs/ANDROID_SETUP.md](docs/ANDROID_SETUP.md). For general setup and iOS, see [docs/SETUP.md](docs/SETUP.md).

## Scripts

```bash
yarn setup:check                  # validate Node, Java, Android SDK, adb, and .env
yarn android                      # build and run the Android development build
yarn start:dev                    # start Metro for the Expo development client
yarn check                        # typecheck + lint + prettier + eslint-disable guard + tests
yarn test --ci --coverage         # tests with a coverage report
yarn validate:translations        # verify hi/mr key parity against en
maestro test .maestro/            # run the E2E flows (needs a dev build)
```

## Environments

| APP_ENV | App name          | Bundle ID               | Icon       |
| ------- | ----------------- | ----------------------- | ---------- |
| dev     | Surakshak-dev     | `com.surakshak.dev`     | 🟠 Saffron |
| staging | Surakshak-staging | `com.surakshak.staging` | 🟣 Purple  |
| prod    | Surakshak         | `com.surakshak.app`     | 🔴 Red     |

Store submission (Play Store / App Store) is intentionally out of scope until
those developer accounts are set up.

## Branches

```
production  ←  staging  ←  develop  ←  feature/xxx | fix/xxx | chore/xxx
```

All PRs target `develop`. Direct pushes to the three long-lived branches are
blocked for everyone. Code review is run on demand via `/code-review`
(Claude Code) rather than an automated CI workflow — see CONTRIBUTING.md.

## License

Private — all rights reserved.
