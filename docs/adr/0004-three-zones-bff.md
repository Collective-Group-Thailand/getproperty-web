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
