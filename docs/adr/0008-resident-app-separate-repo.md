# ADR-0008 — Resident app in a separate repository (D-154)

**Status:** Accepted (2026-10-16, founder decision D-154) · supersedes the planned ADR-0006 "LIFF-first
tenant zone"

## Context
F0 built a fourth zone, `tenant`, for the LINE Mini App (LIFF) and mobile web used by the people who
live in units. The platform blueprint (D-150) widens the audience of that app — residents of
apartments and condos, landlords' lessees, external technicians (R2, "my work orders") and later
landlords — and renames it: the SaaS customer organisation is a **tenant**, the people in units are
**residents** (D-151). The blueprint's architecture lists `getproperty-liff` as its own client "to keep
the bundle light", and the founder decided (D-154) that it is a separate repository from day one.

## Decision
- The resident app lives in **`getproperty-liff`**: single zone, LIFF-first, no host routing, its own BFF
  for `/v1/resident/*` (audience `resident`) and, in R2, `/v1/technician/*` (audience `technician`), auth
  by LIFF id-token exchange into httpOnly cookies with a magic-link fallback. Its prompt pack is L0–L4
  (the content of this repo's former `docs/prompts/F3-tenant-liff.md`, adapted to the new terms).
- This repo removes the tenant zone entirely: `src/app/tenant/**`, `src/features/tenant`,
  `TENANT_HOST`, the `tenant` i18n namespaces, the `tenant` Lighthouse set and e2e host, the tenant
  Storybook toolbar entry, `src/lib/liff`, and the `tenant` theme default. The F number F3 is left
  empty; nothing else is renumbered.
- Until `collective-shared` exists (D-155), `getproperty-liff` **copies** the `src/ui` tokens, theme,
  fonts and the components a resident app needs, plus the `src/i18n` formatters, each file headed
  `// copied from getproperty-web@<commit> until collective-shared exists (D-155)` and listed in its
  `docs/shared-copies.md`; its `pnpm shared:check` diffs the copies against `../getproperty-web` and
  warns. This repo remains the source of truth for those files.

## Consequences
- Two deployments (Cloud Run, D-160) and two CI pipelines; the resident bundle no longer pays for
  owner/admin code paths and its CSP is the only one that allows LINE domains.
- Design drift is possible between the copies; it is made visible (manifest + `shared:check`) rather
  than prevented, and ends when `collective-shared` replaces the copies.
- Domain components needed by both audiences (invoice line table, reading card with photo, timeline)
  are built here first and copied, or built in `collective-shared` once it exists.
