# Live tracking: landing page spec

**Run this as a prompt in `surakshak-redx-org/landing`** (deployed on Vercel at `https://landing-surakshak.vercel.app`). It depends on the `liveTrack` API in `functions-spec.md`. Read that first for the response contract.

## Goal

A contact taps the SMS link `https://landing-surakshak.vercel.app/track/<token>` on their phone and sees the sender moving on a map in real time, like WhatsApp live location or a Swiggy delivery. No app install, no login. Most visitors are on a phone, often on a slow or flaky mobile network, and may be worried. The page must load fast and say clearly what is happening.

Follow the landing repo's existing framework and conventions. Inspect it before choosing between a route or a page file.

## Route

`/track/[token]`: a client-driven page. The token is the only input.

## Data

Poll `GET {NEXT_PUBLIC_TRACKING_API_URL}?t=<token>` every **5 seconds**.

- Pause polling while the tab is hidden (`visibilitychange`) and refetch immediately on return.
- On network error, keep showing the last known position, show a small "Reconnecting…" notice, and back off (5 s → 10 s → 20 s, capped at 30 s). Reset on success.
- Stop polling on `404`, `410`, or `state: "arrived"`.
- Honour `429` + `Retry-After`.
- Do not use WebSockets or SSE in v1.

## States (each needs its own clear design)

| State             | Trigger                                     | What the page shows                                                                                             |
| ----------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Loading           | first request                               | skeleton map and header; no spinner-only screen                                                                 |
| Active            | `state: "active"`                           | map + marker + trail, "{Name} is sharing her live location", sharing-until time, "Updated Xs ago"               |
| Stale             | `active` but `position.at` older than 2 min | same, with an amber "Last updated X min ago" badge                                                              |
| Lost contact      | `state: "lost_contact"`                     | red banner "We lost contact with {Name} at HH:MM". Last known position on the map. Suggest calling her and 112. |
| Arrived           | `state: "arrived"`                          | calm confirmation, "{Name} has arrived{ at destination}". No map.                                               |
| Ended / expired   | `410`                                       | "This live location has ended." No map, no coordinates.                                                         |
| Invalid / revoked | `404`                                       | "This link is not valid or has been stopped." No hint about which.                                              |
| Offline / error   | fetch failure                               | keep the last view, plus the reconnect notice                                                                   |

`{Name}` is the first name from the API. If `name` is null, use a neutral "Your contact". The SMS wording uses "her", but avoid assuming pronouns on the page where wording allows.

## Map

- Google Maps JavaScript API (**already in the project's enabled-API list**). Use a **new, web-only key** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY_WEB`, restricted by **HTTP referrer** to the landing domain(s) and to the Maps JavaScript API only. Do not reuse the app's Android or iOS keys; they are app-restricted and will not work here.
- Lazy-load the Maps script after first paint so the status header renders immediately.
- Marker animates smoothly from the previous fix to the new one (about 1 s interpolation) instead of jumping. Rotate it by `heading` when present.
- Draw `trail` as a polyline in `SHAKTI_PURPLE`; marker and accent in `PRIMARY_RED`. Brand colors are in app `CLAUDE.md`: `#D4380D`, `#722ED1`, `#FA8C16`.
- Auto-follow the marker until the viewer pans or zooms, then show a "Re-centre" button.
- Show a translucent accuracy circle when `accuracyM` is present.
- If `destination` is present, show a destination pin, and the ETA chip when `eta` is present ("About 14 min away").
- Show the battery chip when `battery` is present (red under 15%, "charging" icon when charging). Show speed only when above walking pace.

## Privacy and security (non-negotiable)

- The token in the URL is a bearer secret. Therefore:
  - `Referrer-Policy: strict-origin`. This sends only the origin, never the path, to Google Maps and to links. Do **not** use `no-referrer`: it would break the referrer-restricted Maps key.
  - `X-Robots-Tag: noindex, nofollow` and a `robots` meta tag; exclude `/track/*` from the sitemap and `robots.txt` crawling.
  - `Cache-Control: no-store` on the page.
  - **No analytics, session replay or error tracking may capture the full URL or the response body.** If Sentry or any analytics script is on the site, scrub `/track/<token>` to `/track/[token]` and disable replay on this route.
- Never put the token or coordinates in logs, `localStorage` or cookies.
- Do not render anything the API did not return. There is nothing else to leak, so do not add endpoints.

## Design and UX

- Mobile-first. The map fills the viewport, with a bottom sheet for details (it must not hide the marker). Works at 360 px width, safe-area insets respected, no horizontal scroll.
- Light and dark themes (`prefers-color-scheme`), with a matching dark map style.
- Fast on slow networks: keep the route's JS small, lazy-load the map, cache nothing sensitive.
- Languages: **English, Hindi, Marathi**, chosen from `navigator.language` with an English fallback and a visible language switch. All strings go through the site's i18n mechanism, none hard-coded. Relative times ("2 min ago") use `Intl.RelativeTimeFormat`.
- Accessibility: status changes announced via an `aria-live="polite"` region; the map is not the only carrier of information (all key facts also appear as text); sufficient contrast; 44 px touch targets.
- Footer: a quiet "Get Surakshak: Har Kadam, Surakshit" link to the app. It must not distract from the tracking view and must not appear in the way of the map.
- Add a plain-language line: "Only people with this link can see this. The sender can stop sharing at any time."

## Configuration

| Variable                              | Purpose                                                 |
| ------------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_TRACKING_API_URL`        | URL of `liveTrack`, supplied after the functions deploy |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY_WEB` | referrer-restricted Maps JavaScript key                 |

Set them per Vercel environment (preview and production). The preview origin must be allowed in the function's CORS list, or previews will fail.

## Delivery checklist

- TypeScript strict, no `any`, explicit return types, typed props.
- Tests: the poll loop (pause when hidden, backoff, stop on terminal states), each state's rendering, and that the token never appears in rendered text, `document.title` or outgoing requests other than the API call.
- Manual test with a real device: start live location in the dev build, open the link on a second phone, then walk. Check that the marker moves, the trail grows, the stale badge appears if you turn on airplane mode, the page recovers when you turn it off, and the page shows the ended state after you stop sharing or revoke.
- Lighthouse mobile performance check on `/track/<any-valid-looking-token>`.
- Deploy independently of the app. Verify the URL path matches the app's `EXPO_PUBLIC_TRACKING_BASE_URL` (`https://landing-surakshak.vercel.app/track`).
