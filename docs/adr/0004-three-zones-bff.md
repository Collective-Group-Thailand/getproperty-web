# ADR-0004 — One app, three host-based zones, BFF and httpOnly cookies

**Status:** Accepted (2026-10-16) · Amended 2026-10-16 for D-154 (four zones → three; the resident zone
moved to `getproperty-liff`, see ADR-0008) · F1 1.1–1.2 add implementation notes

## Context
D-002 put every getproperty user interface in one Next.js app with host-based zones. F0 built four:
owner, tenant (the resident LINE Mini App), staff and admin. The platform blueprint then renamed the
domain (D-151: the SaaS customer organisation is a **tenant**; people in units are **residents**, never
"tenants") and the founder decided that the resident LINE Mini App is a separate repository from day
one (D-154), so its bundle stays light inside the LINE in-app browser and it can ship on its own
cadence. The three remaining audiences are operators (a tenant's owners, managers, accountants and
building staff) and the platform (Collective Group staff).

## Decision
- **Three zones, one app, one image** — chosen by the request `Host`, not by path:

  | Zone | Host env | Route segment | API audience | Upstream prefixes the zone BFF allows |
  |---|---|---|---|---|
  | owner | `OWNER_HOST` (default host) | `src/app/[locale]` (next-intl) | `operator` | `/v1/owner`, `/v1/auth/operator` |
  | staff | `STAFF_HOST` | `src/app/staff` | `operator` (Staff role) | `/v1/staff`, `/v1/owner/me`, `/v1/auth/operator` |
  | admin | `ADMIN_HOST` | `src/app/admin` | `platform` | `/v1/admin`, `/v1/auth/platform` |

  `/v1/resident/*` (audience `resident`) and `/v1/technician/*` (audience `technician`, R2) are refused
  by every BFF in this app; they are served by `getproperty-liff`.
- `src/proxy.ts` maps host → zone (`src/lib/zones`), rewrites onto the zone's segment, and (F1) 404s
  another zone's segment, unknown hosts and `/bff/*` on the wrong host. Each zone has its own root
  layout (`<html lang data-theme data-zone>`), CSP, manifest and analytics. No zone loads the LIFF SDK
  or allows LINE domains in its CSP.
- **BFF**: browser code calls `/bff/*` on its own host; the handler allow-lists the prefixes above,
  attaches the bearer from the httpOnly cookie, refreshes once on `401`, streams the response, and
  requires same-origin `Origin` + `x-getproperty-csrf: 1` on non-GET. Server Components call
  `API_INTERNAL_URL` directly.
- **Cookies** — host-only, `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` prefix: `__Host-gp_at` /
  `__Host-gp_rt` per host, **`__Host-gp_tenant`** (the current tenant for users who belong to several;
  sent upstream as `X-Tenant-Id`). Display preferences `gp_theme` / `gp_locale` are JS-readable and carry
  no identity. The F0-era name `gp_org` is never used (D-151).
- `eslint-rules/zone-boundaries.mjs` enforces three zones and refuses any file under, or import of, a
  `tenant` or `resident` zone segment anywhere in `src/`.

## Consequences
- An XSS on one host cannot ride another host's session; a staff bundle never contains admin code.
- The resident experience no longer shares this deployment: `src/ui` changes that the resident app uses
  must be noted in `docs/PROGRESS.md` so `getproperty-liff` can re-sync its copies (D-155) until
  `collective-shared` exists.
- Operator invitations and invoice deliveries link residents to the `getproperty-liff` LIFF URL, never to
  a host of this app.

## Implementation notes

### F1 1.1 — zones, proxy, root layouts, security headers
- **Environment** (`src/lib/env`): one zod schema validated at boot by `src/instrumentation.ts`; the
  process refuses to start and lists every bad variable. Outside production the hosts and
  `API_INTERNAL_URL` default to the local-dev values; in production they are required. `ZONES` is a
  subset of `owner,staff,admin` (anything else, e.g. `tenant`, is refused).
- **Proxy order** (`src/proxy.ts`): unknown/disabled host → plain 404 · reserved first segment
  (`staff`, `admin`, `tenant`, `resident`, also percent-encoded or with a trailing dot) → the zone's own
  not-found page (rewritten onto `/<segment>/_not-found-zone`, caught by the zone's `[...rest]` page,
  status 404) · per-request nonce · routing (owner through next-intl with `localeCookie: false`; staff
  and admin rewritten onto their segment) · security headers.
- **BFF placement**: the owner BFF is `src/app/bff/[...path]`, the others `src/app/<zone>/bff/[...path]`;
  since every path on the staff/admin hosts is rewritten under the zone's segment, `/bff/*` on a host
  can only ever reach that host's BFF, and `/staff/bff/*` from outside is a reserved path.
- **CSP per zone**: `script-src 'self' 'nonce-…' 'strict-dynamic'` (Next stamps the nonce on its scripts
  from the request's CSP header, so every page is dynamically rendered — they all read cookies anyway);
  `style-src 'self' 'unsafe-inline'` (Radix inline positioning and sonner's runtime stylesheet; style
  injection cannot execute script); `img-src`/`connect-src` add only `NEXT_PUBLIC_ASSET_BASE_URL` and the
  Sentry ingest origin; `worker-src 'self'` and `blob:` media on staff only; admin has no `blob:`;
  `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`; dev adds
  `'unsafe-eval'` and `ws:` and drops `upgrade-insecure-requests`. No LINE/LIFF origin anywhere.
- **Other headers**: `Permissions-Policy` (camera `self` on staff, `()` elsewhere, every other sensor
  off), `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, COOP/CORP
  `same-origin`, HSTS (production), and `X-Robots-Tag: noindex, nofollow` on every response except the
  owner marketing pages (`src/lib/zones/marketing.ts`). Files the proxy never sees (public assets) get
  the zone-independent baseline from `next.config.ts`. `/robots.txt` on staff/admin disallows all.

### F1 1.2 — BFF, sessions, sign-in
- **Cookies** exactly as decided; the access cookie's `Max-Age` is the token's lifetime minus 30 s so
  the proxy refreshes *before* the API would answer 401. `__Host-gp_tenant` only ever carries a uuid
  (validated on read) and is written only by the `selectTenant` Server Action after checking the
  tenant against `/me`.
- **Refresh, once per refresh token per process** (`src/lib/auth/refresh.ts`): concurrent callers
  share the in-flight exchange and callers within 30 s get the same new pair, because a rotated
  refresh token presented twice revokes the whole sign-in (D-163). A refused refresh clears the
  session cookies (the tenant choice stays); an unavailable API leaves them for the next try.
  *Residual risk*: two server instances can still race in the instant of expiry; sticky sessions or
  a shared cache close it when the web tier scales out.
- **Proxy** refreshes for page requests only (`refreshBeforeRender`): the new tokens go on the
  request's `cookie` header (so this render's Server Components use them) and on the response.
- **BFF** (`createBffHandler`): allow-list on whole path segments plus a deny-list (`/v1/resident`,
  `/v1/technician`, `/v1/device`) that wins over it; `/v1/auth/refresh|logout` are not proxied (the
  server calls them). Non-GET requires `Origin` equal to the request's own origin, `Sec-Fetch-Site:
  same-origin` when present, and `x-getproperty-csrf: 1`. Bodies ≤ 1 MiB (presigned uploads for files).
  Client `Authorization`, `Cookie` and `X-Tenant-Id` are never forwarded. Responses are streamed
  (`text/event-stream` gets `X-Accel-Buffering: no`), `Cache-Control: no-store, private`, upstream
  `Set-Cookie`/`Content-Encoding`/`Content-Length` dropped. A token pair answered through the BFF is
  turned into cookies and the browser gets only `{ subject }`.
- **Sign-in** is Server Actions (`src/lib/auth/actions.ts`): operator OTP (`requestOperatorOtp`,
  `verifyOperatorOtp` with the D-145 invitation code), operator email + password + TOTP, platform
  email + password + TOTP with enrolment at first sign-in (QR rendered server-side, D-164), tenant
  choice, sign-out (revokes the refresh family upstream). After an operator sign-in a single active
  tenant is remembered; several without a valid remembered choice → the tenant picker. Staff and admin
  take `gp_locale` from `/me.user.language` at sign-in. `/join?code=` (the API's `inviteUrl`) forwards
  to sign-in with the invitation.
- **Guards** (`requireOperator`, `requirePlatform`) in the console layouts read `/me` once per
  request (React `cache`); `401`/`auth.wrong_audience` → sign-in with `?next=` (same-site paths only),
  a stale tenant choice is retried without `X-Tenant-Id`, no current tenant → picker. The API stays
  the enforcement point.

### F1 1.3 — shells, realtime, observability
- **Shells** are a server half (resolves `/me` menu entitlements to routes, labels and groups; fetches
  the buildings for the switcher) and a client frame (sidebar collapse, overlays). Menu keys the web does
  not know are skipped (contract request: named enums). Console providers (TanStack Query, tooltips,
  toasts) are added by the console layouts, never by the root document, so the owner host's public
  pages do not ship them.
- **Realtime**: `POST /bff/v1/{zone}/realtime/auth` then the stream through the same BFF (read with
  fetch and parsed in `src/lib/realtime/sse.ts`, because `EventSource` only delivers events subscribed
  by name); events invalidate TanStack Query keys (`invalidationKeys`); re-authorised with backoff.
- **Observability**: `@vercel/otel` when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (trace context propagated
  to `API_INTERNAL_URL` only); Sentry server and browser only when a DSN is set (browser SDK
  dynamically imported), tagged with the zone, events scrubbed of cookies, headers, bodies and secret
  query values; `onRequestError` logs Next's digest with the API request id; Web Vitals through the
  zone BFF (`POST /v1/{zone}/telemetry/web-vitals`, contract request).

### Amendment — pre-release review of 2026-10-21 (`REVIEW-web.md` H1, H3, L1, L3, L4, L6)
- **Edge trust** (H1, L1). Every server-to-API call made for a browser request — the BFFs, the Server Actions
  (sign-in, TOTP, tenant choice, sign-out), the Server Components' `serverApi`, the proxy's token refresh —
  sends the end user's address as the **only** `X-Forwarded-For` value: the entry `TRUSTED_HOPS` from the right
  of the inbound header (`src/lib/http/edge.ts`; on the Collective platform Caddy is the one proxy = 1, D-230; 0 = none). The client's own
  header is never forwarded as is and `X-Real-IP` is never read. This is what getproperty-api's right-most trust
  (D-229, RUNBOOK §11) and its per-IP sign-in throttle, session rows, audit and D-021a acknowledgements need; with
  `TRUSTED_HOPS=0` in production the server logs a warning at boot. An inbound `x-request-id` is kept only when it
  is a UUID; the proxy stamps a fresh one otherwise.
- **`?next=`** (H3) is parsed with `new URL(next, origin)` and must stay on that origin; control characters,
  whitespace and backslashes (raw or percent-encoded in the path) and protocol-relative paths are refused
  (`src/domain/forms/safe-next.ts`), on all three zones.
- **Proxy coverage** (L3): the matcher runs on every path except `/_next/*`, `/pwa/*` and `/brand/*` — dotted
  paths included — so the reserved-segment 404, the zone rewrite and the CSP / `X-Frame-Options` apply everywhere;
  `next.config.ts` adds `X-Frame-Options: DENY` to the files the proxy never sees.
- **Downloads that change state** (L4): the TM30 file is downloaded with a same-origin `POST` (a plain form; the
  route checks `Origin` / `Sec-Fetch-Site`, `GET` is 405), because the API audits it and marks the notifications.
- **Realtime stream token** (L6): `realtime/auth` answers through the BFF with the token in the httpOnly
  `__Host-gp_sst` cookie (≤ 60 s) and a `streamUrl` without it; the stream request gets it back into the API's
  query string in the BFF and the cookie is cleared as the stream opens. The token is in no browser-visible URL
  and no log of this app; the API still takes it only in the query (contract request: a header).
- **Realtime client** (M2): one stream per page — a generation counter makes `online` and reconnects supersede the
  previous connection, and `stop()` closes everything.
