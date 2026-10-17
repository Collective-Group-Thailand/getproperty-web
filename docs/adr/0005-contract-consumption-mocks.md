# ADR-0005 — Contract consumption and mocks

**Status:** Accepted (2026-10-17, F1 1.2)

## Context
`getproperty-api` owns every endpoint, DTO and enum (contract §1). This app must never hand-write a
response type, must work ahead of the backend, and must be "done" only against the real API. CI has
no sibling checkout of the backend and no credentials for private release assets.

## Decision
- **Vendored, pinned contract.** `contract/openapi.json` is a byte-for-byte copy of a **committed**
  version of the backend's contract; `contract.lock.json` records its `version`, `sha256`, `source` and
  `apiCommit`. `pnpm gen:api --adopt` is the only way to change it: from a git checkout it reads
  `git show <API_CONTRACT_REF|HEAD>:contract/openapi.json` and refuses a working copy with uncommitted
  contract changes (`--allow-dirty` records `<sha>+dirty` for local experiments only).
- **Generated, committed outputs** (`pnpm gen:api`; `pnpm gen:api:check` fails CI on any drift):
  - `src/lib/api/schema.d.ts` — openapi-typescript; the only source of API types (`src/lib/api/types.ts`
    only indexes into it, `ContractEnum` lets `src/domain/status` be typed against an enum the backend
    has planned but not exposed yet and switches to the generated one automatically);
  - `src/lib/api/generated/operations.ts` — per-operation flags keyed by `METHOD /path/{template}`
    (`Idempotency-Key` required, `If-Match` required, accepts `X-Tenant-Id`) that the client middleware
    acts on, so call sites cannot forget an idempotency key;
  - `mocks/generated/operations.ts` — every operation of the surfaces this app reaches (auth, owner,
    staff, admin) with its documented success example;
  - `mocks/generated/problems.ts` — every documented problem example and the codes each operation
    documents per status.
- **One client, two transports.** `createApiClient` (openapi-fetch) adds `X-Request-Id`, the
  idempotency key for flagged operations and typed errors (`ApiError` with `code`, `detail`,
  `legalRef`, field `errors`; `SubscriptionSuspendedError` for `tenant.read_only`; `NetworkError`).
  `serverApi(zone)` goes to `API_INTERNAL_URL` with the bearer and tenant from cookies; `browserApi()`
  goes to `/bff` with the CSRF header. Field errors map onto react-hook-form with `applyFieldErrors`.
- **Mock API as a separate HTTP process** (`mocks/server.ts`, `pnpm dev:mock`, the `chromium` e2e
  project): MSW handlers answered through `getResponse` behind a plain Node HTTP server, instead of
  MSW patching `fetch` inside the Next server. The app — proxy refresh, BFF streaming, cookies,
  headers — is exercised exactly as against the backend, and the suite can read what the "API"
  received (`/__mock/requests`). Hand-written stateful handlers (auth, `/me`) override the generated
  base handlers, which still enforce audience, tenant context and read-only mode. A mock may only
  answer a problem code the operation documents (`problem()` throws otherwise). Endpoints the
  contract lacks are mocked under `// CONTRACT-REQUEST` and listed in `docs/contract-requests.md`.
- **Real-API verification** (`pnpm e2e:integration`, `playwright.integration.config.ts`): the backend
  at `apiCommit` is exported with `git archive` (never the sibling's working tree), built, run on an
  embedded PostgreSQL with migrations and the dev seed, `DATA_STORES_MODE=real`, fake integrations;
  the sign-in flows run against it. Nightly / on demand in CI (needs the sibling repositories).

## Consequences
- A backend enum value, a renamed field or a removed endpoint fails `typecheck` here the day the
  contract is adopted; the status maps fail until the new value has a label, tone and icon.
- Mocks cannot drift into shapes the API does not have: their data is the contract's examples or
  typed with the generated schema.
- Adopting a new contract is a reviewable diff of four generated files plus the lock.
