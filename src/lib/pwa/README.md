# src/lib/pwa — staff PWA (ADR-0007)

`sw/staff-sw.ts` (the service worker source, own tsconfig; caches only static assets and the static `/offline`
page, never a rendered page — ADR-0007 amendment) → `pnpm sw` → `generated/staff-sw.ts` (served at `/sw.js` on the
staff host), unit-tested by `staff-sw.test.ts` against a fake worker scope; `caches.ts` (cache names, the sign-out
purge); `queue.ts` (IndexedDB offline queue with fixed idempotency keys, presigned photo upload, conflict handling,
a cross-tab replay lock, entries bound to the staff member and tenant that queued them); `register.ts`
(registration, Background Sync relay); `push.ts` (web push subscription after a meaningful action, removed at
sign-out).
