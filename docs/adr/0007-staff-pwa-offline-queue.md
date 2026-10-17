# ADR-0007 — Staff PWA: service worker and offline queue

**Status:** Accepted (2026-10-17, F1 1.3)

## Context
Building staff read meters in basements, stairwells and plant rooms where the signal comes and goes.
A reading that is typed and photographed must never be lost, must never be recorded twice, and must
not be "fixed" by the client when the API refuses it (a reading lower than the last one, a meter that
was swapped). The staff host is a separate origin (ADR-0004), so it can own a service worker without
affecting the owner or admin hosts.

## Decision
- **Service worker** (`src/lib/pwa/sw/staff-sw.ts`, Workbox routing/strategies/expiration) bundled by
  `pnpm sw` (esbuild) into the committed `src/lib/pwa/generated/staff-sw.ts` and served by
  `src/app/staff/sw.js/route.ts` at `/sw.js` on the staff host only (`Service-Worker-Allowed: /`,
  `Cache-Control: no-cache`; `pnpm sw:check` fails CI on drift). It is registered in production builds
  by the staff shell. Strategies: navigations network-first (4 s) with the cached page (else `/`) as
  the offline fallback; `/_next/static/*` cache-first; images stale-while-revalidate; `/bff/*` and
  every cross-origin request (signed upload URLs) network-only, never cached. A new worker version (hash
  of its bundle) drops the old page cache. The manifest (`/manifest.webmanifest`) is served in the
  staff member's language with icons generated from the brand mark (`scripts/build-pwa-icons.ts`).
- **Offline queue in the page, not the worker** (`src/lib/pwa/queue.ts`): IndexedDB (`idb`) holds each
  submission with its **`Idempotency-Key` fixed at enqueue time** and, for a photo, the `Blob`. The page
  replays — on start, on `online`, every 30 s while something waits, on demand, and when the worker
  relays a Background Sync event (Chromium). The page owns the replay because it has the session
  (httpOnly cookies via the BFF) and the CSRF header; a worker replay would need a second auth path.
- **Replay rules**: 2xx → done (a replay of an accepted request returns the original response,
  contract §3); 401 → stop, keep everything, ask for sign-in; 408/429/5xx/network → retry with backoff
  (5 s → 15 min); any other 4xx (409, 412, 422…) → **conflict**: kept with the API's problem (code,
  localised detail, request id) and shown in the sync sheet, retried only when the staff member says so
  or removed after a typed confirmation. The photo goes to object storage by presign → PUT → complete
  exactly once (the `fileId` is stored on the entry), never through the BFF body.
- **Web push** is asked for only after a meaningful action (the first queued submission that reached
  the API), with the VAPID key from `NEXT_PUBLIC_VAPID_PUBLIC_KEY` or `GET /v1/auth/web-push/public-key`;
  the subscription is registered with `POST /v1/staff/push-subscriptions`.
- **Device PIN** (optional): re-locks the PWA after 5 minutes without use; a salted PBKDF2 hash per
  browser, never sent to the API; five wrong tries sign the device out.

## Consequences
- Readings typed offline survive reloads and app restarts; duplicates are impossible because the key
  never changes; refusals stay visible instead of disappearing.
- The reading endpoint itself (`POST /v1/staff/readings`) is a contract request until B3; the queue is
  generic (method, path, body, optional photo) so F4 only adds the capture screen.
- iOS Safari has no Background Sync: replays happen while the PWA is open (the page timers), which is
  when staff use it.
