# syntax=docker/dockerfile:1.7
#
# getproperty-web on the Collective platform (D-230; getproperty-api docs/deployment.md §1–2, §7): one image for the
# owner console, the staff PWA and the platform admin (zones by host), built natively for linux/arm64 by
# collective-infra's `reusable-build-push.yml` and run by `platform/products/getproperty/docker-compose.yml`
# (service `web`, container `getproperty-web`, :3000, 384M).
#
# Contract with the platform:
#   - `node server.js` on :3000 (`output: "standalone"`), PID 1 = tini, user `node`
#   - `GET /api/healthz` (compose healthcheck with wget), `GET /api/metrics` (Prometheus, METRICS_ALLOWED_CIDRS)
#   - OTLP traces to OTEL_EXPORTER_OTLP_ENDPOINT (set by the compose file), TZ=Asia/Bangkok
#   - no build arguments: every environment value — the hosts, API_INTERNAL_URL, TRUSTED_HOPS and the public
#     NEXT_PUBLIC_* values too — is read at run time, so the image that passed UAT is promoted to production
#     unchanged (collective-infra promote.yml)
#
# Local: docker build -t getproperty/web . && docker run --rm -p 3000:3000 \
#   -e OWNER_HOST=localhost:3000 -e STAFF_HOST=staff.localhost:3000 -e ADMIN_HOST=admin.localhost:3000 \
#   -e API_INTERNAL_URL=http://host.docker.internal:4000 getproperty/web
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# @collective/web-kit + @collective/content (D-275): installed from the sibling checkout
# (`file:../../collective-shared/packages/*`, i.e. /collective-shared from /app) until they are on GitHub Packages.
#   docker build --build-context collective-shared-src=../../collective-shared .
# UNVERIFIED: written without a Docker daemon (Cowork sandbox, 2026-10-25).
FROM base AS collective-shared
WORKDIR /collective-shared
COPY --from=collective-shared-src package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY --from=collective-shared-src packages ./packages
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm --filter @collective/web-kit --filter @collective/content build

FROM base AS deps
COPY --from=collective-shared /collective-shared /collective-shared
COPY package.json pnpm-lock.yaml ./
# `postinstall` copies the font files from the installed packages (they are committed too).
COPY scripts/copy-fonts.ts ./scripts/copy-fonts.ts
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Bangkok
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini wget ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/healthz >/dev/null || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
