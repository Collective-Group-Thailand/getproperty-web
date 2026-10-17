# src/lib/pwa — staff PWA (ADR-0007)

`sw/staff-sw.ts` (the service worker source, own tsconfig) → `pnpm sw` → `generated/staff-sw.ts`
(served at `/sw.js` on the staff host); `queue.ts` (IndexedDB offline queue with fixed idempotency keys,
presigned photo upload, conflict handling); `register.ts` (registration, Background Sync relay);
`push.ts` (web push subscription after a meaningful action).
