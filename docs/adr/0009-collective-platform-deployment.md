# ADR-0009 — Deployment on the Collective platform (D-230)

**Status:** Accepted (2026-10-21, founder decision D-230 — supersedes the Cloud Run assumption of D-160)

## Context
getproperty runs where getpack runs: Collective's shared AWS platform (collective-infra, "Config C") — one EC2 box
per environment running docker compose, Caddy as the only proxy (auto-TLS, routing by host), Grafana Alloy scraping
Prometheus endpoints and receiving OTLP, images built natively for `linux/arm64` and deployed by SSM
(`deploy-product.sh`). The infrastructure lives only in collective-infra (branch `getproperty/r1-platform`:
`platform/products/getproperty/docker-compose.yml`, `platform/caddy/templates/getproperty.caddy`,
`caddy/sites.<env>.yml`); getproperty-api `docs/deployment.md` states what getproperty needs from it. This app is
the compose service `web` (container `getproperty-web`, 384 MB): the three zones on the hosts `OWNER_HOST`,
`STAFF_HOST`, `ADMIN_HOST`, reaching the API at `http://getproperty-api:3000` on the docker network `collective`.

## Decision
- **Image** (`Dockerfile`): `output: "standalone"`, `node server.js` on :3000 under tini as user `node`,
  `TZ=Asia/Bangkok` with `tzdata`, `wget` for the compose healthcheck. No build arguments.
- **One image for every environment.** collective-infra `promote.yml` re-tags the image that passed UAT as `:prod`
  without a rebuild, so nothing environment-specific is compiled in. The hosts, `API_INTERNAL_URL`, `TRUSTED_HOPS`
  and also the public `NEXT_PUBLIC_*` values are read **at run time on the server** (`src/lib/env`, from
  `collective/<env>/getproperty/web` rendered into `/run/collective/getproperty-web.env`) and reach the browser as
  props or as `<html data-sentry-dsn data-env>` (`ZoneDocument` → `src/instrumentation-client.ts`). A literal
  `process.env.NEXT_PUBLIC_…` read, which `next build` would inline, fails `src/lib/env/runtime-env.test.ts`.
- **Container endpoints**, outside every zone (the proxy's matcher skips exactly these two paths, because the
  healthcheck and Alloy reach the container by its address, which is no zone's host):
  - `GET /api/healthz` — liveness (200 once booted, after the environment validation); it does not call the API,
    so a front end is never rolled back because the API is down.
  - `GET /api/metrics` — Prometheus text: Node.js runtime metrics labelled `service="getproperty-web"` and
    `getproperty_web_bff_request_duration_seconds{zone,method,status}` (status class; never a path). Answered only
    to `METRICS_ALLOWED_CIDRS` (default loopback + private ranges, the API's rule), judged on the right-most
    `X-Forwarded-For` entry — Next's own socket peer for a direct scrape, Caddy's for a proxied request; everyone
    else gets 404. Caddy answers 404 for the path on every public host as well.
- **Traces**: `@vercel/otel` exports OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` (the compose file sets Alloy,
  `http://platform-alloy-1:4318`) with `OTEL_SERVICE_NAME=getproperty-web`; `traceparent` goes to the API only.
- **Client address** (`TRUSTED_HOPS=1`, set by the compose file): Caddy replaces the `X-Forwarded-For` of an
  internet client with the address it saw, so the right-most entry is the end user; the BFFs, Server Actions and
  Server Components forward only that entry to the API (ADR-0004 amendment, D-229). The API trusts the docker
  network `172.30.0.0/16` as the BFF's hop.
- **Public origin**: TLS ends at Caddy and Next's standalone server builds `request.url` from its listen address
  (`https://0.0.0.0:3000/…`). The proxy hands next-intl the URL the browser asked for — the `Host` header Caddy
  keeps plus `X-Forwarded-Proto` — so the owner zone's locale redirects (`/th/x` → `/x`) stay on the public host.
  The BFF's same-origin check already compares `Origin` with `X-Forwarded-Host` / `X-Forwarded-Proto`.
- **CI/CD**: `.github/workflows/deploy.yml` calls collective-infra's reusable workflows (`main` → `:uat` → deploy
  UAT; tag `vX.Y.Z` → `:prod` → deploy production with approval) with `component: web`, `migrate: false`.
  `ci.yml` job `image` builds the Dockerfile and smoke-tests it with the platform's real hostnames.
- **Local and test runs use the shipped server**: `pnpm start` runs `.next/standalone/server.js`
  (`scripts/start-standalone.mjs` copies `.next/static` and `public/` beside it, as the Dockerfile does), so e2e,
  integration and Lighthouse exercise the self-contained server and its file trace.

## Consequences
- Changing a public value (asset origin, LINE OA id, VAPID key, Sentry DSN, environment badge) is a secret update
  and a container restart, not a rebuild.
- Pages that read the public values are dynamic (they already were: the per-request CSP nonce needs it).
- The image is only as deployable as collective-infra: until `getproperty/r1-platform` is merged and tagged (the
  reusable workflows are referenced at `@v1`), nothing deploys. The API image must be deployed first.
