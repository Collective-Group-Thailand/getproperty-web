# src/lib/api

The typed API surface (ADR-0005). `schema.d.ts` and `generated/operations.ts` are written by
`pnpm gen:api` from the pinned contract — never edited. `types.ts` names the generated types
(`Schemas`, `OperatorMe`, `ContractEnum`); `client.ts` is the openapi-fetch client with the request-id,
idempotency and error middleware plus `unwrap`; `server.ts` (`serverApi(zone)`, Server Components) and
`browser.ts` (`browserApi()`, via the zone BFF) are its two transports; `errors.ts` holds `ApiError`,
`SubscriptionSuspendedError`, `NetworkError` and `applyFieldErrors`; `query.ts` the TanStack Query key
factory; `query-client.ts` the defaults; `headers.ts` the header names everyone agrees on.
