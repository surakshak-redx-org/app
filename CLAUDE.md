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
- google-services.json and GoogleService-Info.plist are never committed to git
- In CI they are decoded from base64 GitHub secrets at build time

## Branch Strategy

production ← staging ← develop ← feature/xxx | fix/xxx | chore/xxx

- Juniors only open PRs targeting develop
- Direct push to develop, staging, production: blocked for everyone including Dhruv
- All PRs require: all pipeline checks pass + Claude bot review + 1 human approval
- develop CI: APP_ENV=staging, surakshak-staging Firebase
- staging CI: APP_ENV=staging, surakshak-staging Firebase
- production CI: APP_ENV=prod, surakshak-production Firebase

## Branch → EAS Channel → APP_ENV Mapping

| Branch     | EAS Channel | APP_ENV |
| ---------- | ----------- | ------- |
| develop    | develop     | staging |
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

## Google Cloud APIs (enable in both GCP projects)

- Maps SDK for Android
- Maps SDK for iOS
- Places API
- Geocoding API
- Directions API
- Distance Matrix API
- Maps JavaScript API (admin dashboard — Phase 9)

## API Keys

EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set per EAS environment:

- development + preview environments → surakshak-staging GCP key
- production environment → surakshak-production GCP key
- Local dev (.env.local) → always use staging key

## Build vs OTA Rules

Full native EAS build triggered when ANY of these files change:

- package.json
- app.config.ts
- eas.json

Everything else → OTA update via eas update.
Build decision reason always printed in GitHub Actions summary.

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

| Topic             | Original                                                              | Shipped                                         | Reason                                                                              |
| ----------------- | --------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| ESLint config     | `.eslintrc.js`                                                        | **`eslint.config.js`** (flat), `eslint@^9`      | ESLint 10 removed eslintrc support entirely                                         |
| Audio             | `expo-av`                                                             | **`expo-audio`**                                | expo-av was never published for SDK 53+; it is dead at SDK 57                       |
| Firebase env vars | 6 × `EXPO_PUBLIC_FIREBASE_*` in `env.ts`                              | **removed**                                     | `@react-native-firebase` reads the native config files and ignores env vars         |
| Push              | OneSignal + `@react-native-firebase/messaging` + `expo-notifications` | **OneSignal + expo-notifications (local only)** | messaging and OneSignal both claim the FCM/APNs delegate                            |
| Metro             | not mentioned                                                         | **`metro.config.js` added**                     | NativeWind v4 does not work without `withNativeWind`                                |
| Tailwind          | unpinned                                                              | **`tailwindcss@^3.4.19`**                       | NativeWind 4's `react-native-css-interop` peer is `tailwindcss: "~3"`; v4 breaks it |
| Tests location    | `tests/` here, `__tests__/` in the Phase-1 brief                      | **`tests/`**                                    | this file is the source of truth                                                    |
| `SOSButton`       | `components/ui/` in the brief                                         | **`components/features/sos/`**                  | this file is the source of truth                                                    |
| Package manager   | unspecified                                                           | **Yarn 4**                                      | see the Tech Stack table                                                            |

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
