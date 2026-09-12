# Surakshak Security Checklist

## Before Production Launch (when Play Store/App Store accounts are ready)

### Google Maps API Keys

- [ ] Android key restricted to package names: com.surakshak.dev,
      com.surakshak.staging, com.surakshak.app (+ each tier's release SHA-1)
- [ ] iOS key restricted to bundle IDs: com.surakshak.dev,
      com.surakshak.staging, com.surakshak.app
- [ ] Both keys scoped to: Maps SDK (Android/iOS), Places, Geocoding,
      Directions, Distance Matrix
- [ ] Production Android SHA-1 added
      (`eas credentials -p android --profile production` → View keystore)

### Firebase

- [ ] App Check enabled (Firebase Console → App Check)
- [ ] Firestore/Storage security rules reviewed
- [ ] Anonymous sign-in disabled (Phone auth only)

### Sentry

- [ ] Errors verified in the staging dashboard (use the `[STAGING] Test
Sentry Error` button at the bottom of Settings — staging builds only)
- [ ] Phone numbers scrubbed from all events (see `scrubPhoneNumbers` in
      `src/config/sentry.ts`, covered by `tests/config/sentry.test.ts`)
- [ ] Source maps uploaded for production builds

### Secrets

- [ ] No `.env*` files in git history
- [ ] No `google-services*.json` / `GoogleService-Info*.plist` files in git
      history
- [ ] GitHub secrets rotated if ever accidentally exposed

## Currently Complete

- [x] No hardcoded API keys in source code (`grep -r "AIzaSy" src/ app/`
      returns nothing)
- [x] Firebase config files gitignored and never committed (confirmed: zero
      commits in this repo's history touch `google-services*.json` or
      `GoogleService-Info*.plist`)
- [x] Phone numbers scrubbed from Sentry events before they leave the device
- [x] Offline persistence enabled by default in RNFirebase's native
      Firestore SDKs — no data loss on a network drop (see
      `src/config/firebase.ts`)

## Out of scope for this repo

**Firestore/Storage security rules are not tracked in this repository.**
They are authored and deployed directly through the Firebase Console for the
`surakshak-2869a` project, not via a `firestore.rules` file in git — there is
no such file here, and none should be added without also wiring up
`firebase deploy --only firestore:rules` from somewhere. Until that changes,
rule changes and rule review happen in the Console, not in a PR to this repo.
