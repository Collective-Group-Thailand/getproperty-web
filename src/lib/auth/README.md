# src/lib/auth

Sessions and sign-in (ADR-0004 §F1 1.2). `cookies.ts` (names, flags, lifetimes), `refresh.ts`
(single-flight rotation), `proxy-session.ts` (refresh before rendering), `session.ts` (cookie writes in
Server Actions), `actions.ts` (sign-in, tenant choice, sign-out — the only place tokens are handled),
`actor.ts` (`/me` per request), `guards.ts` (console route guards), `zones.ts` (audience, `/me` path and
BFF allow-list per zone).
