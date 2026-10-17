# getproperty-web

**getproperty — บิลทำเอง เก็บเงินเอง ถูกกฎหมาย** · Collective Group (Thailand)

The single Next.js 16 application of getproperty: one codebase, one deployment, three host-based zones —
**owner** console, **staff** PWA, **admin** back office. The resident LINE Mini App (LIFF) is the separate
repository [`getproperty-liff`](../getproperty-liff) (D-154); in the platform's naming a _tenant_ is the
SaaS customer organisation and the people who live in units are _residents_ (D-151). The backend is
[`getproperty-api`](../getproperty-api) (NestJS); this app renders what the API returns and never computes
money, tariffs, dates or compliance.

Read `CLAUDE.md`, then `docs/prompts/00-master-plan.md`, `docs/decisions.md` and `docs/prompts/design-system.md`.

## Run

```sh
pnpm i                 # Node 24, pnpm 10 — copies the font files from npm on postinstall
pnpm dev:mock          # the app against the mock API (no backend): personas in mocks/README.md
pnpm dev               # against getproperty-api at API_INTERNAL_URL (default http://localhost:4000)
pnpm storybook         # http://localhost:6006
```

http://localhost:3000 (owner) · http://staff.localhost:3000 · http://admin.localhost:3000 — Chromium
resolves `*.localhost` to loopback by itself; no hosts-file entry is needed. Sessions are httpOnly
`__Host-` cookies per host (ADR-0004). With `pnpm dev:mock` sign in with `0810000001` and code `123456`
(owner), `0810000004` (staff) or `support@example.com` / `correct horse battery staple` / `123456` (admin).

## Contract

`pnpm gen:api --adopt` vendors a committed `getproperty-api` contract (`API_CONTRACT_REF`, default
`HEAD` of the sibling checkout) and pins it in `contract.lock.json`; `pnpm gen:api` regenerates the types,
the per-operation client flags and the MSW base data; `pnpm gen:api:check` is the CI drift gate
(ADR-0005). Endpoints the contract lacks are in `docs/contract-requests.md`.

## Check

```sh
pnpm format:check && pnpm lint && pnpm typecheck && pnpm gen:api:check && pnpm sw:check && pnpm test \
  && pnpm build && pnpm release:hygiene && pnpm e2e && pnpm build-storybook && pnpm e2e:visual
```

`pnpm test` includes the WCAG 2.2 AA contrast gate for every token pair in all three themes, axe over
every Storybook story, the BFF/auth/queue/realtime unit tests and the ESLint rule fixtures. `pnpm e2e`
builds the app and runs it against the mock API: zones, sign-in flows, shells (axe), marketing, PWA.
`pnpm e2e:visual` compares the shell stories with their baselines. `pnpm e2e:integration` runs the
sign-in flows against the real getproperty-api at the pinned commit (embedded PostgreSQL; slow).
`pnpm lhci` runs the Lighthouse budgets per zone (`docs/performance-budgets.md`).

On a machine that cannot download browsers: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PW_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm e2e`.

## Layout

```
src/app/[locale]  owner root layout     src/ui        design system (tokens → generated CSS, components)
src/app/staff     staff root layout     src/domain    status presentation, next actions, form rules
src/app/admin     admin root layout     src/i18n      next-intl, th/en messages per zone, formatters
src/app/**/bff    the zone BFFs         src/lib       env · zones · security · api · auth · bff · pwa ·
src/proxy.ts      host → zone gate                    realtime · observability
mocks/            the mock API          src/features  shared · owner · staff · admin (zone-isolated)
```

Docs: `docs/adr/` (ADR-0001 fonts, 0002 component base, 0003 theming, 0004 three zones + BFF,
0005 contract consumption & mocks, 0007 staff PWA offline queue, 0008 resident app in a separate
repository), `docs/contract-requests.md`, `docs/ui/brand.md`,
`docs/ui/voice-and-tone.md`, `docs/performance-budgets.md`, `docs/PROGRESS.md`.
