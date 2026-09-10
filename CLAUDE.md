# CLAUDE.md — Surakshak

> Read this file fully before doing anything. It is the single source of truth.
> Do not make any decision not covered here without asking first.

## Project

- Name: Surakshak ("Protector/Guardian")
- Tagline: "Har Kadam, Surakshit" (Every Step, Protected)
- Purpose: Women's safety mobile app for India
- GitHub Account: surakshak-redx-org
- App Repo: surakshak-redx-org/app
- Other Repos: landing, admin, functions, docs, design

## Environments

| APP_ENV | Firebase Project     | App Name          | Bundle ID             | Icon            | MixPanel | Sentry |
| ------- | -------------------- | ----------------- | --------------------- | --------------- | -------- | ------ |
| dev     | surakshak-staging    | Surakshak-dev     | com.surakshak.dev     | #FA8C16 Saffron | ❌       | ❌     |
| staging | surakshak-staging    | Surakshak-staging | com.surakshak.staging | #722ED1 Purple  | ✅       | ✅     |
| prod    | surakshak-production | Surakshak         | com.surakshak.app     | #D4380D Red     | ✅       | ✅     |

- dev + staging share surakshak-staging Firebase project
- prod exclusively uses surakshak-production Firebase project
- Local development: always APP_ENV=dev, always staging Firebase credentials
- MixPanel and Sentry must NOT initialize when APP_ENV=dev — log console.warn instead
- app.json does NOT exist — app.config.ts is the only config file
- google-services\*.json and GoogleService-Info\*.plist are never committed to git
- One config-file pair per APP_ENV (dev/staging/prod), selected by bundle id in
  app.config.ts. CI native builds read them from EAS file-type Environment
  Variables (GOOGLE_SERVICES_ANDROID_FILE / _IOS_FILE), scoped per tier — not
  from GitHub secrets. OTA deploys need no Firebase file at all.

## Branch Strategy

production ← staging ← develop ← feature/xxx | fix/xxx | chore/xxx

- Juniors only open PRs targeting develop
- Direct push to develop, staging, production: blocked for everyone including Dhruv
- All PRs require: all pipeline checks pass + Claude bot review + 1 human approval
- Commit messages and PR descriptions: do NOT add `Co-Authored-By: Claude`,
  `Claude-Session:`, "Generated with Claude Code", or any other AI-attribution
  trailer/footer
- develop CI: pr-checks.yml only (typecheck/lint/prettier/no-eslint-disable/test)
  — **no build, no OTA**. develop is the integration branch every PR lands on,
  often several times a day; deploying on every merge there is unnecessary
  cost and noise. Promote to `staging` deliberately when it's time to deploy.
- staging CI: pr-checks.yml + deploy.yml (APP_ENV=staging, surakshak-staging Firebase)
- production CI: pr-checks.yml + deploy.yml (APP_ENV=prod, surakshak-production Firebase)

## Branch → EAS Channel → APP_ENV Mapping

Only `staging` and `production` pushes trigger `deploy.yml` — `develop` never
does (see above). The `develop` EAS profile in `eas.json` still exists, for
on-demand local builds only (`eas build --profile develop`), never automated.

| Branch     | EAS Channel | APP_ENV |
| ---------- | ----------- | ------- |
| staging    | staging     | staging |
| production | production  | prod    |

## Tech Stack

| Tool               | Choice                                         |
| ------------------ | ---------------------------------------------- |
| Framework          | Expo SDK 57, Managed Workflow + Dev Builds     |
| Language           | TypeScript 5.x strict                          |
| Routing            | Expo Router v4 (file-based)                    |
| Styling            | NativeWind v4 — no inline styles ever          |
| State              | Zustand                                        |
| Backend            | Firebase (Auth, Firestore, Storage, Functions) |
| Realtime           | Firestore realtime listeners                   |
| Push Notifications | OneSignal                                      |
| Analytics          | MixPanel (staging + prod only)                 |
| Error Tracking     | Sentry (staging + prod only)                   |
| SMS                | expo-sms (device SIM)                          |
| Maps               | react-native-maps + Google Maps provider       |
| i18n               | react-i18next + expo-localization              |
| Forms              | react-hook-form + zod                          |
| Testing            | Jest + @testing-library/react-native           |
| Icons              | @expo/vector-icons                             |
| Task Tracking      | GitHub Issues                                  |
| Package Manager    | Yarn 4 (via corepack) — never npm              |

## Absolute Rules — Zero Exceptions

1. No `any` type — use `unknown` + type guard if truly needed
2. No `// @ts-ignore` or `// @ts-expect-error`
3. No `// eslint-disable` comments anywhere in src/ or app/
4. No hardcoded user-facing strings — every string through `t()` from i18n
5. No inline styles — NativeWind `className` only
6. No magic numbers or strings — use `src/constants/`
7. All async functions must handle errors via try/catch or .catch()
8. All functions must have explicit return types
9. All component props must have typed interfaces
10. All screens must be wrapped in ErrorBoundary
11. All service functions must have unit tests
12. All screens must have at minimum a smoke test
13. No direct Firebase calls from screen components — always via `src/services/`
14. No navigation logic inside service files
15. Environment variables accessed only via `src/config/env.ts`

## File Structure

app/ ← Expo Router screens (file = route)
├── _layout.tsx
├── index.tsx
├── (auth)/
│ ├── _layout.tsx
│ ├── welcome.tsx
│ ├── phone.tsx
│ ├── otp.tsx
│ └── onboarding.tsx
├── (tabs)/
│ ├── _layout.tsx
│ ├── index.tsx # Home / SOS Dashboard
│ ├── map.tsx # Geofencing + Unsafe Areas
│ ├── community.tsx # Community Chat
│ ├── info.tsx # Laws / FAQ / Tips / News
│ └── profile.tsx
├── emergency-contacts.tsx
├── live-location.tsx
├── safe-journey.tsx
├── safe-checkin.tsx
├── incident-report.tsx
├── nearby-help.tsx
├── silent-recording.tsx
├── settings.tsx
├── language-select.tsx
├── law/[id].tsx
├── news/[id].tsx
└── +not-found.tsx

src/
├── components/
│ ├── ui/
│ │ ├── Button.tsx
│ │ ├── Text.tsx
│ │ ├── Input.tsx
│ │ ├── Card.tsx
│ │ ├── Badge.tsx
│ │ ├── Avatar.tsx
│ │ ├── Spinner.tsx
│ │ ├── EmptyState.tsx
│ │ ├── ErrorBoundary.tsx
│ │ └── SafeScreen.tsx
│ └── features/
│ ├── sos/
│ ├── map/
│ ├── community/
│ ├── emergency/
│ └── location/
├── services/
│ ├── firebase/
│ │ ├── auth.service.ts
│ │ ├── user.service.ts
│ │ ├── community.service.ts
│ │ ├── unsafe-areas.service.ts
│ │ ├── news.service.ts
│ │ ├── laws.service.ts
│ │ ├── live-location.service.ts
│ │ ├── incident.service.ts
│ │ └── safe-journey.service.ts
│ ├── sms.service.ts
│ ├── location.service.ts
│ ├── notification.service.ts
│ └── analytics.service.ts
├── hooks/
│ ├── useAuth.ts
│ ├── useLocation.ts
│ ├── useSOS.ts
│ ├── useShakeDetection.ts
│ ├── useLiveLocation.ts
│ ├── useCommunity.ts
│ ├── useBatteryAlert.ts
│ └── useFakeCall.ts
├── stores/
│ ├── auth.store.ts
│ ├── user.store.ts
│ ├── location.store.ts
│ └── sos.store.ts
├── utils/
│ ├── phone.utils.ts
│ ├── location.utils.ts
│ ├── date.utils.ts
│ ├── permissions.utils.ts
│ └── sms.utils.ts
├── constants/
│ ├── colors.ts
│ ├── typography.ts
│ ├── spacing.ts
│ ├── emergency-numbers.ts
│ ├── routes.ts
│ └── config.ts
├── types/
│ ├── user.types.ts
│ ├── community.types.ts
│ ├── location.types.ts
│ ├── emergency.types.ts
│ └── navigation.types.ts
├── i18n/
│ ├── index.ts
│ └── locales/
│ ├── en.json
│ ├── hi.json
│ └── mr.json
└── config/
├── env.ts
├── firebase.ts
├── sentry.ts
├── mixpanel.ts
└── onesignal.ts

tests/
├── config/ # jest resolver
├── screens/
├── services/
├── components/
├── stores/
├── constants/
├── hooks/
├── utils/
└── setup.ts

assets/
├── images/
├── fonts/
└── icons/

.github/
├── workflows/
│ ├── pr-checks.yml
│ ├── deploy.yml
│ └── claude-review.yml
├── ISSUE_TEMPLATE/
│ ├── bug_report.yml
│ ├── feature_request.yml
│ └── phase_task.yml
└── PULL_REQUEST_TEMPLATE.md

scripts/
└── check-no-eslint-disable.sh

plugins/
└── withReactNativeFirebaseStaticFramework.js # sets $RNFirebaseAsStaticFramework

docs/
├── SKILL.md
└── SETUP.md

CLAUDE.md
CONTRIBUTING.md
README.md
app.config.ts
eas.json
babel.config.js
metro.config.js
tailwind.config.js
tsconfig.json
nativewind-env.d.ts
eslint.config.js
.prettierrc
.prettierignore
jest.config.js
commitlint.config.js
.env.example
.yarnrc.yml
yarn.lock
package.json

## Brand Colors

```ts
export const COLORS = {
  PRIMARY_RED: '#D4380D',
  SHAKTI_PURPLE: '#722ED1',
  SAFFRON: '#FA8C16',
  FOREST_GREEN: '#389E0D',
  OFF_WHITE: '#F5F5F5',
  WHITE: '#FFFFFF',
  DEEP_INK: '#141414',
  STONE: '#595959',
  ERROR_RED: '#CF1322',
  NEAR_BLACK: '#0A0A0A',
  CHARCOAL: '#1A1A1A',
} as const;
```

## Emergency Numbers (Never Modify)

```ts
[
  { id: 'pre_1', name: 'National Emergency', phone: '112', isPredefined: true, order: 0 },
  { id: 'pre_2', name: 'Police', phone: '100', isPredefined: true, order: 1 },
  { id: 'pre_3', name: 'Ambulance', phone: '108', isPredefined: true, order: 2 },
  { id: 'pre_4', name: 'Women Helpline', phone: '1091', isPredefined: true, order: 3 },
  { id: 'pre_5', name: 'Mahila Helpline', phone: '181', isPredefined: true, order: 4 },
  { id: 'pre_6', name: 'Child Helpline', phone: '1098', isPredefined: true, order: 5 },
  { id: 'pre_7', name: 'Maternity', phone: '102', isPredefined: true, order: 6 },
];
```

## Firestore Schema

users/{userId}
name: string
phone: string
profilePhotoUrl: string
city: string
state: string
language: 'en' | 'hi' | 'mr'
isGuest: boolean
createdAt: Timestamp
updatedAt: Timestamp

users/{userId}/emergencyContacts/{contactId}
name: string
phone: string
relationship: string
isPredefined: boolean
order: number

community/{postId}
authorId: string
authorName: string
authorPhotoUrl: string
content: string
type: 'text' | 'location' | 'image' | 'help_request'
isAnonymous: boolean
locationUrl: string | null
imageUrl: string | null
city: string
state: string
reportCount: number
isHidden: boolean
createdAt: Timestamp

unsafeAreas/{areaId}
reportedBy: string
latitude: number
longitude: number
radiusMeters: number
title: string
description: string
category: 'poorly_lit' | 'isolated' | 'harassment_reported' | 'other'
status: 'pending' | 'approved'
pinColor: 'orange' | 'red'
upvotes: number
downvotes: number
voterIds: string[]
createdAt: Timestamp

liveLocationSessions/{sessionId}
userId: string
latitude: number
longitude: number
locationUrl: string
sharedWithUserIds: string[]
startedAt: Timestamp
expiresAt: Timestamp
isActive: boolean

safeJourneySessions/{sessionId}
userId: string
destinationName: string
destinationLatitude: number
destinationLongitude: number
etaMinutes: number
sharedWithUserIds: string[]
startedAt: Timestamp
expectedArrivalAt: Timestamp
status: 'active' | 'arrived' | 'alert_sent' | 'cancelled'

incidentReports/{reportId}
userId: string
title: string
description: string
latitude: number
longitude: number
photoUrls: string[]
createdAt: Timestamp
status: 'submitted' | 'under_review' | 'resolved'

news/{newsId}
title: string
summary: string
content: string
imageUrl: string
category: string
publishedAt: Timestamp
isPublished: boolean

laws/{lawId}
title: string
shortDescription: string
fullContent: string
category: string
tags: string[]
order: number
isPublished: boolean

safetyTips/{tipId}
title: string
content: string
category: string
order: number
isPublished: boolean

faqs/{faqId}
question: string
answer: string
category: string
order: number
isPublished: boolean

## Location URL Format

```ts
const locationUrl = `https://www.google.com/maps/place/${latitude},${longitude}`;
```

## Google Cloud APIs (enable in the GCP project)

- Maps SDK for Android
- Maps SDK for iOS
- Places API
- Geocoding API
- Directions API
- Distance Matrix API
- Maps JavaScript API (admin dashboard — Phase 9)

> See the Phase 1 Corrections section — this is one shared GCP project now,
> not one per environment.

## API Keys

**Two Maps keys, not one** — a Google Maps API key's application restriction
is either "Android apps" or "iOS apps", never both at once, so one key per
platform is required to have any app-identity restriction at all:

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID` — restricted to the Android app
  restriction (package name + SHA-1, all three bundle IDs), scoped to the
  Maps SDK for Android + the four non-platform-specific APIs above.
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS` — restricted to the iOS app
  restriction (bundle ID, all three), same API scope.
- Local dev (`.env.local`) → use both staging keys.
- `eas build` / `eas update` → EAS's own hosted Environment Variables, one
  value shared across all three tiers — see "Where config values live" below.

Both are `EXPO_PUBLIC_*`, so both get inlined into **both** platforms' JS
bundles — the Android build ships the iOS key string too, and vice versa.
This is not a leak: each key's own restriction is enforced server-side by
Google regardless of which bundle it's sitting in, so a key that ends up in
the wrong build is simply unusable there. Don't mistake the presence of
"the other platform's key" in a bundle for a misconfiguration.

## Where config values live

Three separate systems, easy to conflate:

| System                    | Reaches                                                                                 | Set via                                 |
| ------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| `.env.local`              | Local `yarn start` only                                                                 | hand-edited, gitignored                 |
| GitHub Secrets            | GitHub Actions steps directly (Firebase file decode, `EXPO_TOKEN`, `ANTHROPIC_API_KEY`) | repo Settings → Secrets                 |
| EAS Environment Variables | `eas build` (remote container) and `eas update` (via `--environment`)                   | `eas env:set` or the expo.dev dashboard |

**Why three, not one:** `eas build` runs entirely on Expo's own remote
infrastructure — a GitHub Actions job's `env:` block never reaches that
container, no matter how it's set. Only `eas.json`'s own file-based `env`
(not used here) or EAS's hosted Environment Variables do. `eas update`
bundles locally in the calling job, so it could use either mechanism, but
`--environment` is **required for SDK 55+** to pull hosted variables at all
— omit it and `eas update` gets none of them, silently.

`EXPO_PUBLIC_APP_ENV` and both Maps keys live in EAS Environment Variables,
scoped per tier:

```bash
eas env:set --name KEY --value VALUE \
  --environment development --environment preview --environment production \
  --visibility plaintext|sensitive|secret --non-interactive
```

`development`/`preview`/`production` here are EAS's own tier names — matched
1:1 to each build profile's `environment` field in `eas.json`. They are not
the same namespace as `APP_ENV` (`dev`/`staging`/`prod`) or `channel`
(`develop`/`staging`/`production`); check `eas.json` before assuming which
maps to which.

## Build vs OTA Rules

Full native EAS build triggered when ANY of these files change:

- package.json
- app.config.ts
- eas.json

A build is also forced regardless of file changes when the target profile has
**no finished build yet** — checked live against EAS's own build history, not
inferred from the diff. Without this, the very first deploy on a profile would
OTA-update a native shell that has never existed anywhere.

Everything else → OTA update via eas update.
Build decision reason always printed in GitHub Actions summary.

**`runtimeVersion` is `{ policy: "appVersion" }`** — an OTA update only
reaches a native build sharing the exact same `version` string in
`app.config.ts`. This means any native-affecting change that ships without a
`version` bump is silently OTA-shippable to a build it isn't actually
compatible with. Bump `version` whenever a change touches native code or
config, not just when it feels like a "release." The `fingerprint` policy
removes this footgun entirely by keying compatibility off a hash of the
native project instead — worth it if this bites in practice.

## Component Pattern

```tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';

export default function MyScreen(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <ErrorBoundary>
      <SafeScreen>
        <Text variant="h1">{t('myScreen.title')}</Text>
      </SafeScreen>
    </ErrorBoundary>
  );
}
```

## Service Pattern

```ts
import type { SomeType } from '@/types/some.types';

export async function myFunction(param: string): Promise<SomeType[]> {
  try {
    return [];
  } catch (error) {
    console.error('myFunction failed:', error);
    throw error;
  }
}
```

## Import Pattern

```ts
// ✅ Always use alias
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants/colors';

// ❌ Never use relative paths
import { Button } from '../../../components/ui/Button';
```

## Phases

- Phase 1: Foundation & CI/CD
- Phase 2: Auth & Onboarding
- Phase 3: Emergency Core
- Phase 4: Location & Maps
- Phase 5: Community
- Phase 6: Information Hub
- Phase 7: Advanced Safety
- Phase 8: Multilingual
- Phase 9: Admin Dashboard
- Phase 10: QA & Production Polish

---

## Phase 1 Corrections (2026-09-09)

The scaffold above was written against an older Expo baseline. These are the
points where the shipped repo deliberately differs, and why. Do not "fix" the
code back to match the original text — CI will fail.

| Topic             | Original                                                              | Shipped                                                                                                                                                         | Reason                                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint config     | `.eslintrc.js`                                                        | **`eslint.config.js`** (flat), `eslint@^9`                                                                                                                      | ESLint 10 removed eslintrc support entirely                                                                                                                                                    |
| Audio             | `expo-av`                                                             | **`expo-audio`**                                                                                                                                                | expo-av was never published for SDK 53+; it is dead at SDK 57                                                                                                                                  |
| Firebase env vars | 6 × `EXPO_PUBLIC_FIREBASE_*` in `env.ts`                              | **removed**                                                                                                                                                     | `@react-native-firebase` reads the native config files and ignores env vars                                                                                                                    |
| Push              | OneSignal + `@react-native-firebase/messaging` + `expo-notifications` | **OneSignal + expo-notifications (local only)**                                                                                                                 | messaging and OneSignal both claim the FCM/APNs delegate                                                                                                                                       |
| Metro             | not mentioned                                                         | **`metro.config.js` added**                                                                                                                                     | NativeWind v4 does not work without `withNativeWind`                                                                                                                                           |
| Tailwind          | unpinned                                                              | **`tailwindcss@^3.4.19`**                                                                                                                                       | NativeWind 4's `react-native-css-interop` peer is `tailwindcss: "~3"`; v4 breaks it                                                                                                            |
| Tests location    | `tests/` here, `__tests__/` in the Phase-1 brief                      | **`tests/`**                                                                                                                                                    | this file is the source of truth                                                                                                                                                               |
| `SOSButton`       | `components/ui/` in the brief                                         | **`components/features/sos/`**                                                                                                                                  | this file is the source of truth                                                                                                                                                               |
| Package manager   | unspecified                                                           | **Yarn 4**                                                                                                                                                      | see the Tech Stack table                                                                                                                                                                       |
| iOS Firebase pods | not mentioned                                                         | **`expo-build-properties` `ios.useFrameworks: "static"` + `plugins/withReactNativeFirebaseStaticFramework.js` + `@react-native-firebase/app` `ios.disableSPM`** | firebase-ios-sdk Swift pods can't build as static libraries (non-modular deps); under `use_frameworks!` the RNFirebase podspecs need `$RNFirebaseAsStaticFramework = true` and SPM must be off |

> ⚠️ **One Firebase project, three registered apps — overrides the Environments table above.**
> Every tier uses a single Firebase project (`surakshak-2869a`; the
> `surakshak-staging` / `surakshak-production` names in the table are labels,
> not real project IDs). Within it each bundle id (`com.surakshak.dev` /
> `.staging` / `.app`) is registered as its own app, so there are three
> `google-services.<env>.json` + three `GoogleService-Info.<env>.plist` files at
> the repo root (all gitignored), selected by `APP_ENV` through the
> `Record<AppEnv, string>` maps in `app.config.ts`. Per-tier config reaches CI
> native builds via EAS file-type env vars (`GOOGLE_SERVICES_ANDROID_FILE` /
> `_IOS_FILE` on the `preview` and `production` tiers).
> The APP_ENV split still governs app name, bundle id, icon colour, EAS channel
> and whether MixPanel/Sentry initialise. To split into separate Firebase
> _projects_ later: point each map entry at that project's file and update the
> per-tier EAS file variables to match.

### GitHub secrets

Just `EXPO_TOKEN` and `ANTHROPIC_API_KEY`.

Firebase config files are **not** GitHub secrets. Native `eas build` runs on a
remote worker that never sees a file decoded onto the CI runner, so the config
lives in EAS **file-type** Environment Variables instead, scoped per tier:

| EAS variable                   | Tier         | Value                                |
| ------------------------------ | ------------ | ------------------------------------ |
| `GOOGLE_SERVICES_ANDROID_FILE` | `preview`    | `./google-services.staging.json`     |
| `GOOGLE_SERVICES_IOS_FILE`     | `preview`    | `./GoogleService-Info.staging.plist` |
| `GOOGLE_SERVICES_ANDROID_FILE` | `production` | `./google-services.prod.json`        |
| `GOOGLE_SERVICES_IOS_FILE`     | `production` | `./GoogleService-Info.prod.plist`    |

The Maps keys and `EXPO_PUBLIC_APP_ENV` also live in EAS Environment Variables,
for the same reason. See "Where config values live" above.

Also worth knowing:

- **Jest env bootstrap.** `babel-preset-expo` inlines `EXPO_PUBLIC_*` at
  transform time, so test env vars are set at module scope in `jest.config.js`.
  Setting them in a setup file is too late and every screen test fails.
- **`process.env` is typed `any`** by the Metro ambient declarations. It is
  narrowed once in `src/config/env.ts` and once in `app.config.ts`. Reads must
  stay static member access — Babel does not inline `process.env[key]`.
- **RNTL v14 is async.** `render`, `renderHook`, `act` and `fireEvent` all
  return promises and must be awaited.
- **Reanimated 4 under Jest** needs the composed resolver at
  `tests/config/resolver.js`; jest-expo already installs React Native's
  resolver and Jest allows only one.
- **Yarn's 24-hour age gate** (`npmMinimalAgeGate` in `.yarnrc.yml`) blocks
  freshly published packages. First-party Expo / React Native scopes are
  preapproved; everything else waits a day.
