# eslint-rules

Project-local ESLint rules, loaded by `eslint.config.mjs` as the `getproperty` plugin.

| Rule                  | Where it applies                | What it refuses                                                                                 |
| --------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `zone-boundaries`     | `src/app/**`, `src/features/**` | an import from another zone's `src/features/<zone>/` (alias or relative) — 00-master-plan.md §3 |
| `no-money-arithmetic` | `src/features/**`, `src/app/**` | arithmetic on, or `Number()` of, an API money / meter field — CLAUDE.md                         |

Each rule has a fixture test beside it (`*.test.ts`, run by `pnpm test`) that proves it fails on the
code it exists to catch.
