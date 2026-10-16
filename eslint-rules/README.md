# eslint-rules

Project-local ESLint rules, loaded by `eslint.config.mjs` as the `getproperty` plugin.

| Rule                  | Where it applies                | What it refuses                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zone-boundaries`     | `src/**`                        | an import from another zone's `src/features/<zone>/` (alias or relative) between the three zones owner · staff · admin — 00-master-plan.md §3; any file under, or import of, the retired `tenant` / `resident` segments (the resident app is `getproperty-liff`, D-154) |
| `no-money-arithmetic` | `src/features/**`, `src/app/**` | arithmetic on, or `Number()` of, an API money / meter field — CLAUDE.md                                                                                                                                                                                                 |

Each rule has a fixture test beside it (`*.test.ts`, run by `pnpm test`) that proves it fails on the
code it exists to catch.
