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
pnpm dev               # http://localhost:3000 (owner) · staff.localhost · admin.localhost :3000
pnpm storybook         # http://localhost:6006
```

Chromium resolves `*.localhost` to loopback by itself; no hosts-file entry is needed.

## Check

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e && pnpm build-storybook
```

`pnpm test` includes the WCAG 2.2 AA contrast gate for every token pair in all three themes, axe over
every Storybook story, the formatter tests and the ESLint rule fixtures. `pnpm e2e` builds the app and
checks the three zone shells with axe. `pnpm lhci` runs the Lighthouse budgets (`docs/performance-budgets.md`).

On a machine that cannot download browsers: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PW_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm e2e`.

## Layout

```
src/app/[locale]  owner root layout     src/ui        design system (tokens → generated CSS, components)
src/app/staff     staff root layout     src/domain    status presentation, (F1) form schemas
src/app/admin     admin root layout     src/i18n      next-intl, th/en messages, formatTHB/formatUnits/formatDate
src/proxy.ts      host → zone rewrite   src/lib       zones, (F1) api · auth · bff · pwa · observability
                                        src/features  shared · owner · staff · admin (zone-isolated)
```

Docs: `docs/adr/` (ADR-0001 fonts, 0002 component base, 0003 theming, 0004 three zones + BFF,
0008 resident app in a separate repository), `docs/ui/brand.md`,
`docs/ui/voice-and-tone.md`, `docs/performance-budgets.md`, `docs/PROGRESS.md`.
