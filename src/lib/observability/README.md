# src/lib/observability

`scrub.ts` (what an error report may carry), `web-vitals.ts` (RUM through the zone BFF). Wired by
`src/instrumentation.ts` (server: env validation, OpenTelemetry, Sentry, `onRequestError`) and
`src/instrumentation-client.ts` (browser: Web Vitals, Sentry when a DSN is set). ADR-0004 §F1 1.3.
