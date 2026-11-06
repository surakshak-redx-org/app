# Live tracking: manual steps checklist

Everything that cannot be done from code and must be done by a person, in the order to do it. Do these together once all the PRs (app, functions, landing) are merged. This list grows as PR3 and PR4 land.

## 0. Merge order

1. App PRs: #180, #181 and #182 (merged), then PR4 (share-sheet, copy-link, revoke-link, iOS wording).
2. Functions PR into `develop`.
3. Landing PR into `develop`.

Nothing deploys from `develop` in any repo. Deploys happen when you promote `develop` to `staging` / `production`, so the steps below come _after_ merging.

## 1. Firebase Console (project `surakshak-2869a`)

- [ ] **Publish the updated Firestore rules.** The full file is in the chat history and the `liveLocationSessions` + `points` block is described in `functions-spec.md` §5. Rules live only in the Console. Test in the Rules Playground first (owner can write a session and a point; a stranger cannot read either). **Do this before any app build containing PR #180 reaches users**: until then the new trail-point writes are rejected by the catch-all deny, which fails the whole location-update batch.
- [ ] **Create the composite index** on `liveLocationSessions`: `isActive` ASC, `status` ASC, `lastFixAt` ASC (needed by `detectLostContact`). The first failed query logs a one-click creation link if you prefer.
- [ ] (Optional) Enable a Firestore **TTL policy** only if the functions PR chose it over the scheduled cleanup; by default it does not need one.

## 2. Google Cloud Console (same project)

- [ ] **Create a new web Maps key** for the tracking page: API restriction = **Maps JavaScript API** only; application restriction = **HTTP referrers**:
  - `https://landing-surakshak.vercel.app/*`
  - `https://surakshak.app/*` (only if the real domain will serve the page)
  - `http://localhost:3000/*` (local dev)
  - any Vercel preview pattern you want working
- [ ] Do **not** reuse the app's Android / iOS Maps keys; they are app-restricted and will not work in a browser.
- [ ] Confirm **Maps JavaScript API** is enabled (it is in the project's list already).
- [ ] (Only when ETA ships, PR3) create a **server-side** key for the Directions API and store it as a Functions secret.

## 3. Expo / EAS

- [ ] Add `EXPO_PUBLIC_TRACKING_BASE_URL` as an EAS Environment Variable for all three tiers. Without it, staging and production builds silently fall back to the old static Maps pin:
  ```
  eas env:set --name EXPO_PUBLIC_TRACKING_BASE_URL --value https://landing-surakshak.vercel.app/track --environment development --environment preview --environment production --visibility plaintext --non-interactive
  ```
- [ ] The value must match the landing route path exactly (`/track`, no trailing slash needed).

## 4. Vercel (landing project)

- [ ] Set for **Preview and Production**:
  - `NEXT_PUBLIC_TRACKING_API_URL`: the deployed `liveTrack` URL (from step 5)
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY_WEB`: the key from step 2
- [ ] Remember the landing repo only deploys from `staging` (preview domain) and `production` (the real domain). `landing-surakshak.vercel.app` serves **production**, so the link in SMS only works after landing is promoted to `production`.
- [ ] Redeploy after setting env vars (they are inlined at build time).

## 5. Functions deploy

- [ ] Promote functions `develop` to `staging` / `production` (CI deploys). No new secrets are needed; the existing OneSignal ones are unchanged.
- [ ] Note the `liveTrack` URL (`https://asia-south1-surakshak-2869a.cloudfunctions.net/liveTrack`) and give it to Vercel (step 4).
- [ ] If landing previews should work, add the preview origin to `ALLOWED_ORIGINS` in the functions repo (`src/live-tracking/constants.ts`) and redeploy.
- [ ] Confirm the three new functions appear in the Firebase Console: `liveTrack`, `detectLostContact`, `cleanupLiveTracking`.

## 6. Release the app

- [ ] #180, #181 and #182 contain **no native change and no dependency addition**, so they ship as an **OTA** update to builds with the current `version`. Promote `develop` to `staging` first.
- [ ] PR4 changes `app.config.ts` (the iOS "Always location" usage string). By the repo's build rules that forces a **full EAS build** on the next `staging` / `production` deploy. `version` is deliberately **not** bumped, so the new build keeps `runtimeVersion` 1.4.2 and still receives OTA updates like every existing install. The new wording only takes effect on devices that install the new binary; older installs keep the old text until they update from the store. The change is only a permission string, so there is no native API difference between old and new builds.
- [ ] The first build with the new string must go to App Store review with the "Always" justification noted in step 8.

## 7. End-to-end test (two phones, staging)

- [ ] Phone A: start live location to a contact whose number you control; confirm the SMS contains `https://landing-surakshak.vercel.app/track/<32 hex chars>`.
- [ ] Phone B: open the link. The marker should appear and move; the trail should grow; battery and "updated X s ago" should show.
- [ ] Lock phone A and walk about 100 m: updates keep arriving (background tracking).
- [ ] Drive or ride: update rate speeds up. Stand still for 2+ minutes: it slows down. Check Firestore: `trackingProfile` on the session changes.
- [ ] Airplane mode on A for 6+ minutes: the page turns to "lost contact"; turn it off: the page recovers by itself.
- [ ] Deny "Always" location on A: the orange "Keep Surakshak open" card appears, and updates only flow while the app is open.
- [ ] Arrival: start sharing with a destination about 1 km away, walk or ride there. Sharing should stop on its own within a minute of arriving, you get an "You've arrived" notification, and the page shows the arrived state with no map. Check the Firestore session: `isActive: false`, `status: 'arrived'`. (Allow notifications for the app, or the notice is skipped; sharing still stops.)
- [ ] Arrival edge cases: start sharing while standing at the destination, which must **not** end the share; and pick a destination, then drive past it without stopping, which should end it only if the fixes land within about 100 m of the pin.
- [ ] Link controls on A: "Copy link" puts the full `…/track/<token>` URL on the clipboard, "Share link" opens the system share sheet with the message and link (try WhatsApp). Tap "Stop link" and confirm: phone B's page switches to "not valid / stopped" within a few seconds while A keeps sharing, and A shows the "tracking link is stopped" note. Force-quit and reopen A: the note is still there.
- [ ] iOS permission prompt: on a fresh install of the **new build**, the "Always" location prompt shows the new wording about trusted contacts and safe journeys.
- [ ] Stop sharing on A: the page shows "ended" and no coordinates. Re-open the old link a minute later: still "ended".
- [ ] Open `.../track/00000000000000000000000000000000` and a malformed token: both show the invalid-link state, not an error page.
- [ ] Check the Firestore usage graph for a few minutes of tracking and confirm write volume matches expectations (about one batched write per fix).

## 8. Store / compliance

- [ ] **Google Play:** `ACCESS_BACKGROUND_LOCATION` is already declared. Check that the Play Console **permissions declaration** and its demo video describe live location sharing, not only Safe Journey.
- [ ] **App Store:** the "Always" location justification in App Review notes should mention live location sharing with trusted contacts.
- [ ] Update the **privacy policy** page on the landing site: the live-location link exposes first name, position and battery to anyone holding the link until sharing ends; trail points are deleted 24 hours after a session expires.

## 9. Product decisions still open

- [ ] **How are contacts alerted when contact is lost?** v1 only turns the web page red. Options (functions spec §2): an SMS provider (needs DLT registration), or push to contacts who are Surakshak users (needs phone numbers stored). Decide before building escalation.
- **ETA: decided not to build.** The app stores the destination and the web page shows `eta` only if present; nothing writes it, so the page shows the destination but no "about 14 min away". If you ever want it, the spec is `functions-spec.md` §3 (server-side Directions key).
- [ ] Per-contact links with view receipts, and other ideas in the plan file, if wanted later.

## 10. Housekeeping

- [ ] Delete the merged feature branches in each repo.
- [ ] Update the `docs` repo with the shared response type (JSON in `functions-spec.md`).
- [ ] If you want a custom short domain for links (shorter SMS), buy it, add it to Vercel, then update `EXPO_PUBLIC_TRACKING_BASE_URL`, the functions CORS list, and the Maps key referrers.
