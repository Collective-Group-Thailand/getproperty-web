# src/lib/zones

Host → zone resolution shared by `src/proxy.ts`, the theme defaults, the BFF and the auth cookies:
`resolveZone` (unknown host → `null` → 404), `ZONE_SEGMENT` (where each zone's pages live),
`RESERVED_SEGMENTS`/`isReservedPath` (another zone's segment and the retired `tenant`/`resident`
segments are 404 on every host) and `isZoneEnabled` (the `ZONES` allow-list). Marketing paths that
may be indexed are `src/lib/zones/marketing.ts`.
