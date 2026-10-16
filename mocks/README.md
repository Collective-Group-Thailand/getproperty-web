# mocks — MSW

Installed in F0, wired in F1 1.2: `mocks/generated/` (handlers + example rows regenerated from the
contract by `pnpm gen:api`), `mocks/handlers/` (hand-written overrides, each missing endpoint marked
`// CONTRACT-REQUEST` and listed in `docs/contract-requests.md`), `src/instrumentation.ts` starting the
server-side mock when `API_MOCKS=1` (`pnpm dev:mock`).
