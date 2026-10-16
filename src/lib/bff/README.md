# src/lib/bff — F1

`createBffHandler(zone)`: per-zone upstream allow-list (owner → `/v1/owner`, `/v1/auth/operator`;
staff → `/v1/staff`, `/v1/owner/me`; admin → `/v1/admin`, `/v1/auth/platform`), `X-Tenant-Id` from
`__Host-gp_tenant`, bearer from the cookie, streaming, one refresh on
401, same-origin + `x-getproperty-csrf: 1` on non-GET (ADR-0004). Nothing in F0.
