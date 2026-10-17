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
