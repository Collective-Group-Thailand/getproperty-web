# src/lib/bff

`createBffHandler(zone)` — each zone's `/bff/*` route (`src/app/bff`, `src/app/staff/bff`,
`src/app/admin/bff`): allow-list, CSRF, body limit, bearer + tenant from cookies, refresh-once,
streaming, no caching, token pairs turned into cookies. Behaviour and reasons: ADR-0004 §F1 1.2.
