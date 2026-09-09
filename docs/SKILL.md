# Surakshak — Claude context file

Paste this whole file into Claude at the start of every conversation about this
codebase. It is self-contained.

---

## 1. Project context and the 15 rules

**Surakshak** ("Protector") is a women's safety app for India.
Tagline: _Har Kadam, Surakshit_ — Every Step, Protected.

Stack: Expo SDK 57 (managed + dev builds), TypeScript 6 strict, Expo Router,
NativeWind v4, Zustand, Firebase via `@react-native-firebase`, OneSignal push,
MixPanel, Sentry, react-i18next, react-hook-form + zod, Jest + React Native
Testing Library v14. Package manager is **Yarn 4** (via corepack) — never npm.

Absolute rules, enforced by CI, zero exceptions:

1. No `any` — use `unknown` plus a type guard.
2. No `@ts-ignore` / `@ts-expect-error`.
3. No `eslint-disable` anywhere in `src/` or `app/`.
4. No hardcoded user-facing strings — everything through `t()`.
5. No inline styles — NativeWind `className` only.
6. No magic numbers or strings — use `src/constants/`.
7. Every async function handles errors via `try/catch` or `.catch()`.
8. Every function has an explicit return type.
9. Every component's props have a typed interface.
10. Every screen is wrapped in `ErrorBoundary`.
11. Every service function has a unit test.
12. Every screen has at least a smoke test.
13. No Firebase calls from screens — always via `src/services/`.
14. No navigation logic inside service files.
15. Environment variables only via `src/config/env.ts`.

---

## 2. Component pattern

```tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { Text } from '@/components/ui/Text';

export default function MyScreen(): React.JSX.Element {
  const { t } = useTranslation();

  function handlePress(): void {
    // …
  }

  return (
    <ErrorBoundary>
      <SafeScreen>
        <Text variant="h1" tKey="myScreen.title" />
        <Button variant="primary" size="md" label={t('common.save')} onPress={handlePress} />
      </SafeScreen>
    </ErrorBoundary>
  );
}
```

`<Text>` takes either `tKey` (preferred) or `children`. `tKey` wins if both are
given. Interpolation goes through `tOptions`.

---

## 3. Service pattern

```ts
import type { User } from '@/types/user.types';

export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    // Firestore call here
    return null;
  } catch (error) {
    console.error('getUserProfile failed:', error);
    throw error;
  }
}
```

A not-yet-implemented service is a non-async function returning a rejected
promise, so it does not trip `require-await`:

```ts
/**
 * What it will do.
 * @phase Phase 4 — Location & Maps
 */
export function getNearbyUnsafeAreas(_latitude: number): Promise<UnsafeArea[]> {
  return Promise.reject(new Error('Not implemented — Phase 4'));
}
```

Unused stub parameters keep their real names prefixed with `_`.

---

## 4. Store and hook patterns

```ts
// src/stores/example.store.ts
import { create } from 'zustand';

interface ExampleStore {
  value: string | null;
  setValue: (value: string | null) => void;
  reset: () => void;
}

const initialState = { value: null } as const;

export const useExampleStore = create<ExampleStore>((set) => ({
  ...initialState,
  setValue: (value): void => set({ value }),
  reset: (): void => set({ ...initialState }),
}));
```

Read one field per selector so a component re-renders only when that field
changes:

```ts
const user = useAuthStore((state) => state.user); // ✅
const { user } = useAuthStore(); // ❌ re-renders on any change
```

Hooks compose stores and services, and always declare a result interface:

```ts
export interface UseThingResult {
  value: string | null;
  refresh: () => Promise<void>;
}

export function useThing(): UseThingResult { … }
```

---

## 5. Imports

```ts
// ✅ always the alias
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants/colors';

// ❌ never relative
import { Button } from '../../../components/ui/Button';
```

`@/*` → `src/*`, `@app/*` → `app/*`, `@assets/*` → `assets/*`.

Import order is enforced with a blank line between groups: builtin, external,
internal (`@/`), parent, sibling, index — alphabetised within each group.

---

## 6. Adding a translation key

1. Add it to `src/i18n/locales/en.json` in the right section.
2. Add the **same key** to `hi.json` and `mr.json` with `""` as the value.
3. Use it: `<Text variant="body" tKey="section.myKey" />`.
4. `yarn test tests/utils/i18n.test.ts` — a test asserts all three files have
   identical key sets, so a missing key fails CI.

Empty `hi`/`mr` values fall back to English at runtime (`returnEmptyString:
false`), so a blank translation shows English rather than nothing.

---

## 7. Adding a screen

1. Create the file under `app/` — the path _is_ the route.
   `app/my-thing.tsx` → `/my-thing`.
2. Use the component pattern from §2. Wrap it in `ErrorBoundary`.
3. Add its title key to all three locale files.
4. Add the route to `src/constants/routes.ts`.
5. Add a smoke test in `tests/screens/my-thing.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import React from 'react';

import MyThingScreen from '@app/my-thing';

describe('MyThingScreen', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<MyThingScreen />);
    expect(getByText('My Thing')).toBeTruthy();
  });
});
```

---

## 8. Adding a service function

1. Put it in the right file under `src/services/`.
2. Explicit return type, `try/catch`, rethrow after logging.
3. No navigation inside it — return data or throw.
4. Add a test in `tests/services/`:

```ts
await expect(myFunction('param')).rejects.toThrow('Not implemented');
```

5. Call it from a hook or a screen, never Firebase directly.

---

## 9. Five TypeScript errors you will hit

**"Object is possibly 'undefined'" on an array index.**
`noUncheckedIndexedAccess` is on. Indexing always yields `T | undefined`:

```ts
const first = items[0];              // Item | undefined
if (first !== undefined) { … }       // narrow before use
const name = items[0]?.name ?? '';   // or optional-chain
```

**"Type 'undefined' is not assignable…" when spreading an optional prop.**
`exactOptionalPropertyTypes` is on, so you cannot assign `undefined` to an
optional property. Spread conditionally:

```ts
...(value !== undefined ? { key: value } : {})
```

**"Not all code paths return a value."**
`noImplicitReturns` is on — every branch must return, including the `else`.

**"Type 'string' is not assignable to type '\"a\" | \"b\"'."**
A union is expected. Narrow it or type the variable as the union up front.
Beware `as const` objects: `useState(APP_CONFIG.SOME_NUMBER)` infers the literal
type, so write `useState<number>(…)`.

**"Property 'className' does not exist."**
The NativeWind types are missing. `nativewind-env.d.ts` at the repo root
provides them — do not delete it.

---

## 10. Constants

```ts
COLORS = {
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
};
```

Tailwind class names for the same palette: `primary-red`, `shakti-purple`,
`saffron`, `forest-green`, `off-white`, `ink`, `stone`, `error-red`,
`near-black`, `charcoal`.

```ts
ROUTES = {
  WELCOME,
  PHONE,
  OTP,
  ONBOARDING,
  HOME,
  MAP,
  COMMUNITY,
  INFO,
  PROFILE,
  EMERGENCY_CONTACTS,
  LIVE_LOCATION,
  SAFE_JOURNEY,
  SAFE_CHECKIN,
  INCIDENT_REPORT,
  NEARBY_HELP,
  SILENT_RECORDING,
  SETTINGS,
  LANGUAGE_SELECT,
  LAW_DETAIL,
  NEWS_DETAIL,
};

APP_CONFIG = {
  LIVE_LOCATION_DEFAULT_HOURS: 1,
  LIVE_LOCATION_MAX_HOURS: 8,
  LIVE_LOCATION_UPDATE_INTERVAL_SECONDS: 30,
  SOS_COUNTDOWN_SECONDS: 5,
  SOS_TAP_COUNT: 3,
  SOS_TAP_WINDOW_MS: 1500,
  SHAKE_THRESHOLD: 2.5,
  SHAKE_COUNT_REQUIRED: 3,
  SHAKE_WINDOW_MS: 2000,
  LOW_BATTERY_THRESHOLD_PERCENT: 20,
  COMMUNITY_REPORT_HIDE_THRESHOLD: 3,
  SAFE_JOURNEY_CHECK_INTERVAL_MINUTES: 5,
  SAFE_CHECKIN_MISSED_COUNT_BEFORE_ALERT: 2,
  MAX_EVIDENCE_RECORDING_MINUTES: 30,
  MAX_COMMUNITY_IMAGE_MB: 5,
  UNSAFE_AREA_SEARCH_RADIUS_KM: 50,
  CACHE_EXPIRY_HOURS: 24,
};
```

`SPACING` (xs 4 → giant 64), `FONT_SIZES` (xs 12 → xxxl 30), `LINE_HEIGHTS`
(1.4× the size), `FONT_WEIGHTS`, and `MIN_TOUCH_TARGET` (44) live in
`src/constants/`.

---

## 11. Emergency numbers — never modify

```ts
[
  { id: 'pre_1', name: 'National Emergency', phone: '112', order: 0 },
  { id: 'pre_2', name: 'Police', phone: '100', order: 1 },
  { id: 'pre_3', name: 'Ambulance', phone: '108', order: 2 },
  { id: 'pre_4', name: 'Women Helpline', phone: '1091', order: 3 },
  { id: 'pre_5', name: 'Mahila Helpline', phone: '181', order: 4 },
  { id: 'pre_6', name: 'Child Helpline', phone: '1098', order: 5 },
  { id: 'pre_7', name: 'Maternity', phone: '102', order: 6 },
];
```

All are `isPredefined: true` and cannot be deleted from the UI. A test pins
every value — if you change one, CI fails, which is the point.

---

## 12. Location URL format

Exactly one format, everywhere:

```ts
`https://www.google.com/maps/place/${latitude},${longitude}`;
```

Always build it with `getLocationUrl(lat, lng)` from `@/utils/location.utils`.

---

## 13. Commands

```bash
yarn start           # Expo dev server
yarn start --clear   # …with a cleared Metro cache
yarn android         # run on Android
yarn ios             # run on iOS

yarn typecheck       # tsc --noEmit
yarn lint            # eslint, zero warnings
yarn lint:fix        # auto-fix what it can
yarn format          # prettier --write
yarn format:check    # prettier --check
yarn test            # jest
yarn test --ci --coverage
yarn check           # all of the above, in CI order
```

Add a dependency with `yarn add x` (or `yarn expo install x` for anything with
native code, so the SDK-compatible version is picked). Never `npm install`.

> ⚠️ `yarn expo install` writes an `app.json` to record any config plugin it
> auto-detects. This project must not have one — `app.config.ts` is the only
> config file. Delete the generated `app.json` and add the plugin to the
> `plugins` array in `app.config.ts` yourself. Verify with
> `yarn dlx expo-doctor@latest`.

---

## 14. Branch and PR rules

```
production  ←  staging  ←  develop  ←  feature/xxx | fix/xxx | chore/xxx
```

- Juniors only open PRs into `develop`.
- Direct pushes to `develop`, `staging` and `production` are blocked for
  everyone.
- To merge: all pipeline checks green, Claude bot review with no blocking
  items, one human approval.
- Commits are Conventional Commits, lowercase subject, ≤ 100 chars.
- Branch names: `feature/`, `fix/` or `chore/` then lowercase-hyphenated words.

### Environments

| APP_ENV | Firebase project     | App name          | Bundle id             | MixPanel | Sentry |
| ------- | -------------------- | ----------------- | --------------------- | -------- | ------ |
| dev     | surakshak-staging    | Surakshak-dev     | com.surakshak.dev     | ❌       | ❌     |
| staging | surakshak-staging    | Surakshak-staging | com.surakshak.staging | ✅       | ✅     |
| prod    | surakshak-production | Surakshak         | com.surakshak.app     | ✅       | ✅     |

Local development is always `APP_ENV=dev` with staging Firebase credentials.
MixPanel and Sentry must never initialise in dev — they log a `console.warn`
instead.
