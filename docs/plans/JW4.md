# JW4 — gate tablet surface and gate admin (plan)

Step JW4 of `docs/prompts/J-juristic-web.md` (api J4.1 + J4.2 at `b3e89b83`; D-315, D-316, D-317, D-320, D-327, D-328;
J-DESIGN §1.4, §3 gate-tablet, §4 gate kiosk kit). Branch `feat/JW4-gate-surface` from `main` `3d513cf`.

## 0. Contract
- `API_CONTRACT_REF=b3e89b8386233086c51f8f0c131e8f0a74200b6f pnpm gen:api --adopt`; `scripts/gen-api.ts` adds the
  `/v1/guard/` surface to the generated mock operations (the tablet's BFF reaches it).
- Owner menu keys `juristic_gate` (juristic tenants) and `gate` (apartment / PM behind `module.gate`) → `/juristic/gate`.

## 1. Guard session (owner host, its own cookies and BFF)
- `/gate` lives on the owner host (`[locale]/(gate)/gate`): a separate root-less layout (no console rail, no
  `ConsoleProviders`), Thai at `/gate`, English at `/en/gate`.
- Cookies (httpOnly, `__Host-`): `gp_gdev` = device id + device secret from enrolment (400 days, never readable by
  JS), `gp_gat` / `gp_grt` = the guard token pair (aud `guard`). Operator cookies are untouched.
- `/bff/guard/*` (`createGuardBffHandler`): allow-list `/v1/guard` only, the BFF rules of ADR-0004 (CSRF on unsafe
  methods, body limit 3 MB for the inline photo, refresh once with `gp_grt`, streaming for SSE with
  `Last-Event-ID`, `Idempotency-Key` for flagged operations) plus four session actions that never send a secret to the
  browser: `session/enrol` {code, name} → `gp_gdev`; `session/roster` → guards; `session/sign-in` {guardId, pin} →
  token cookies + `{ subject }` (423 keeps `lockedUntil`); `session/sign-out` (end shift: `shift/actions/end`, cookies
  cleared, device kept); `session/forget` (device cookie removed — a revoked tablet).
- `Permissions-Policy: camera=(self)` and `media-src blob: mediastream:` on the owner host for `/gate` paths only.

## 2. Kiosk (J-DESIGN §3 / §4)
- States: enrol → roster → PIN pad (lockout countdown from `lockedUntil`) → desk; auto lock to PIN after inactivity
  (configurable constant, paused while offline because the PIN is checked by the API); switch shift ends the shift.
- Header: gate + estate, clock (Bangkok), online / offline with queue count, barrier state, guard + shift start,
  switch shift.
- Desk two columns (60 / 40) landscape, stacked in portrait: entry card (plate: category + number boxes opening
  the plate keypad — consonants grouped by class, digits, province list with recent first; kind tiles 64 px; destination
  search by house / soi / owner through `GET /v1/guard/units?q=`; optional photo (camera capture, compressed ≤ 2 MB);
  optional name; optional ID last 4; privacy notice from the API next to the fields); primary "แจ้งเจ้าของบ้าน",
  outlined "สแกน QR เชิญ" (BarcodeDetector, `jsqr` fallback loaded on demand); right column: LPR pending card
  (claim pre-fills / dismiss), waiting list (live timer, progress toward the house policy, call-back flag and name,
  "ให้เข้า" override with reason), approved rows "เปิดไม้กั้น" (blue filled — documented exception), inside list
  with exit stamp and the overstay line, tablet SOS (outlined danger) at the foot.
- SOS takeover banner above everything while an incident is open (acknowledge / resolve), also over the PIN pad.
- Offline-first: every create is written to IndexedDB with its `clientRef` + Idempotency-Key first, replayed in order
  with backoff (2xx → sent, 4xx → conflict shown on the row, network / 5xx / 429 → retry); visits recorded while
  offline carry `recordedAt` + `enteredOffline`. SSE via fetch (`Last-Event-ID`, backoff with jitter, refetch lists +
  incidents on every reconnect); `visits/changes?after=` polling while the stream is down.
- Kiosk hygiene: screen wake lock, no hover-only affordances, body 17 px, plate 28 px mono, targets ≥ 64 px for the
  main actions (≥ 48 px elsewhere), 8-px gaps, high contrast, no dark tiles.

## 3. Admin `/juristic/gate` (console)
Tabs (LinkTabs): gates & tablets (create gate, edit, new tablet → enrolment code shown once, revoke; edge devices
attach / detach) · guards (create with PIN, rename, reset PIN, revoke, lock state) · house policies (unit picker →
timeout / action / delivery / note) · blacklist (add with reason, revoke with reason) · contractor invites (approve /
reject) · visit log (reason first, filters, record) · incidents (reason first, filters, record with timeline + linked
visits, acknowledge / resolve) · registered cars · gate settings (`gate.*` values from the owner settings API).

## 4. Tests and gates
Vitest: plate keypad / normaliser, offline queue replay, timers / policy progress, SSE parser + reconnect, PIN lockout,
guard BFF; MSW mocks for every guard and owner gate endpoint + a mock SSE stream (`/__mock/gate/*` controls);
Playwright specs written (not run): visitor loop, offline queue, invite scan with a mocked camera, SOS banner;
Storybook stories for the kiosk kit. Gates: lint, format:check, typecheck, unit, gen:api --check, icons / design
language / dead-ends, build, build-storybook, Lighthouse `gate` set (`/gate` first-load JS ≤ 180 KB).
