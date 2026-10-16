# src/lib/bff — F1

`createBffHandler(zone)`: per-zone upstream allow-list, bearer from the cookie, streaming, one refresh on
401, same-origin + `x-getproperty-csrf: 1` on non-GET (ADR-0004). Nothing in F0.
