# Live tracking: Cloud Functions spec

**Run this as a prompt in `surakshak-redx-org/functions`.** The matching web page is specced in `landing-spec.md`. This repo (app) already writes the data described below.

## Goal

Contacts receive an SMS with `https://landing-surakshak.vercel.app/track/<token>`. The web page needs a **public, read-only, token-gated** API that returns the sender's live position, route trail and status. Firestore stays owner-only; this function is the only public read path.

## What the app writes (already implemented, PR1)

`liveLocationSessions/{sessionId}`

| Field               | Type                                                  | Notes                                                                                                        |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `userId`            | string                                                | **Never expose.**                                                                                            |
| `deviceId`          | string?                                               | **Never expose.**                                                                                            |
| `sharedWithUserIds` | string[]                                              | Local contact ids. **Never expose.**                                                                         |
| `latitude`          | number                                                | Latest fix.                                                                                                  |
| `longitude`         | number                                                | Latest fix.                                                                                                  |
| `locationUrl`       | string                                                | Static Maps URL of the latest fix. Not needed.                                                               |
| `startedAt`         | Timestamp                                             |                                                                                                              |
| `expiresAt`         | Timestamp                                             | The sender can extend it (capped at 8h from start).                                                          |
| `isActive`          | boolean                                               | `false` once stopped.                                                                                        |
| `shareToken`        | string?                                               | 32 lowercase hex chars (128 bits). **Absent = link revoked.**                                                |
| `status`            | `'active' \| 'arrived' \| 'ended' \| 'lost_contact'`? | App sets `active` on create and `ended` on stop. Absent on pre-v2 sessions: treat as `active` if `isActive`. |
| `lastFixAt`         | Timestamp?                                            | Server time of the latest fix.                                                                               |

`liveLocationSessions/{sessionId}/points/{pointId}`: `{ latitude, longitude, recordedAt }`. One point per ≥25 m moved, so a trail is already decimated.

**Fields arriving in later app PRs** (the function must tolerate their absence and pass them through when present): `batteryLevel` (0–1), `isCharging`, `speed` (m/s), `heading` (deg), `accuracy` (m), `trackingProfile`, `destination { name, latitude, longitude }`.

## 1. `liveTrack` (HTTPS, public)

`GET /liveTrack?t=<token>`: expose it to the web through whatever URL scheme fits the functions repo (a Hosting rewrite such as `/api/track` is preferred over a raw `cloudfunctions.net` URL).

### Behaviour

1. Validate `t` against `^[0-9a-f]{32}$` **before touching Firestore.** Anything else is `404`.
2. Query `liveLocationSessions` where `shareToken == t`, `limit(1)`. (Single-field index; automatic.)
3. No match is `404`. A revoked token (field deleted) is therefore indistinguishable from a token that never existed. Do not leak which.
4. Derive the public state:
   - `expired`: `isActive == false` with `status != 'arrived'`, or `expiresAt < now`. Return `410 { "state": "ended" }` with **no coordinates**.
   - `arrived`: `status == 'arrived'`. Return `200` with `state: "arrived"`, the destination name if any, and **no coordinates**.
   - `lost_contact`: `status == 'lost_contact'` **or** `now - lastFixAt > LOST_CONTACT_SECONDS` (derive at read time too, so the page is correct even if the scheduler is late). Return `200` with the last known position, `state: "lost_contact"` and `lastFixAt`.
   - otherwise `active`.
   - A fresh `lastFixAt` beats a stored `lost_contact` (the app only resets `status` in a later PR), so the page recovers on its own.
5. Load the trail: `points` ordered by `recordedAt` desc, `limit(TRAIL_MAX_POINTS)`, then return them oldest-first.
6. Resolve the **first name only** from `users/{userId}.name` (the SMS already names the sender). Fall back to `null`; the page shows a generic label.

### Response (200)

```jsonc
{
  "state": "active" | "lost_contact" | "arrived",
  "name": "Asha" | null,
  "position": { "lat": 19.076, "lng": 72.8777, "at": "2026-11-06T10:15:02Z" },  // omitted for arrived
  "startedAt": "…", "expiresAt": "…",
  "trail": [ { "lat": 0, "lng": 0, "t": "…" } ],
  "battery": { "level": 0.62, "charging": false },     // only if the app wrote it
  "speedMps": 1.4, "heading": 90, "accuracyM": 12,     // only if present
  "destination": { "name": "Home", "lat": 0, "lng": 0 }, // only if present
  "eta": { "minutes": 14, "computedAt": "…" }           // see section 3
}
```

`410`: `{ "state": "ended" }`. `404`: `{ "error": "not_found" }`. `429`: `{ "error": "rate_limited" }`.

### Security (non-negotiable)

- Allow-list the response fields as above. **Never** return `userId`, `deviceId`, `sharedWithUserIds`, phone numbers or the token itself.
- `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- CORS: allow only the landing origin(s) (`https://landing-surakshak.vercel.app`, plus the preview origin pattern if needed). `GET` only.
- Rate limit per IP and per token (suggested: 30 req/min/IP, 20 req/min/token; the page polls about every 5 s). Return `429` with `Retry-After`.
- **Never log the raw token.** Log a short SHA-256 prefix.
- Set `maxInstances` to cap cost from abuse.

### Constants (put in the functions repo's config, not inline)

`LOST_CONTACT_SECONDS` (**300**: the app's slowest profile is about 60 s, so 5 minutes avoids false alarms), `TRAIL_MAX_POINTS` (**500**), the rate limits above.

## 2. `detectLostContact` (scheduled, every 1 minute)

Query `isActive == true`, `status == 'active'`, `lastFixAt < now - LOST_CONTACT_SECONDS`, `expiresAt > now`. (**Composite index** `isActive, status, lastFixAt`.) For each, in a batch: set `status: 'lost_contact'`, `lostContactAt: serverTimestamp()`.

**Escalation: open decision, do not guess.** The session stores only local contact ids, not phone numbers, so the function cannot message anyone today. Options to put to the product owner before building:

1. **Status flip only (v1 minimum).** The web page turns red: "Lost contact since HH:MM". Contacts only see it if they have the page open.
2. **SMS to contacts.** This needs the app to also write contact phone numbers to the session (privacy trade-off: a phone list lives in Firestore) plus an SMS provider. India requires DLT registration of senders and templates. Ask for the provider and budget first.
3. **Push to contacts who are Surakshak users** (OneSignal, matched by phone). This needs the same phone numbers as option 2.

Note: the phone being off or offline is exactly when the app cannot act, so this must be server-side.

## 3. ETA (only once `destination` exists; app PR3)

On a `liveTrack` read (or in the scheduler) for sessions with a `destination`: call the Directions API (origin = latest fix, destination = `destination`), store `eta { minutes, computedAt }` on the session, and **recompute at most every 3 minutes, and only if the sender moved more than 200 m since the last computation.** Otherwise serve the cached value. The Directions API is already enabled in the GCP project; use a **server-side** key kept in function config, not the app's keys.

## 4. Cleanup

Scheduled daily: for sessions ended or expired more than 24 h ago, delete the `points` subcollection (use the Admin SDK's recursive delete in batches). Keep the session document itself for support and audit unless the product owner says otherwise.

## 5. Firestore rules (manual: they live only in the Firebase Console)

The Admin SDK used by these functions bypasses rules. The app's rules must allow **only the owner** to touch sessions and trail points. Apply before shipping the app build that has PR1:

```
match /liveLocationSessions/{sessionId} {
  allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
  allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;

  match /points/{pointId} {
    allow create: if request.auth != null
      && get(/databases/$(database)/documents/liveLocationSessions/$(sessionId)).data.userId == request.auth.uid;
    allow read: if request.auth != null
      && get(/databases/$(database)/documents/liveLocationSessions/$(sessionId)).data.userId == request.auth.uid;
    allow update, delete: if false;
  }
}
```

Review against the existing rules before pasting; do not replace unrelated rules. The app no longer reads a session before each write, so the rules are the only ownership check.

## 6. Delivery checklist

- TypeScript strict, no `any`; explicit return types.
- Unit tests: token validation, each state derivation (active / lost_contact / arrived / ended / expired / revoked), response allow-listing (assert no `userId`, `deviceId` or `sharedWithUserIds` ever appears), rate limiting.
- Deploy independently of the app (functions repo CI). Staging first, against the shared Firebase project.
- Add the response type to the **docs** repo as the shared contract (copy the JSON above).
- Hand the final URL to the landing repo as `NEXT_PUBLIC_TRACKING_API_URL`.
