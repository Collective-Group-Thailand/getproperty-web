import type { Instrumentation } from "next";

/**
 * Runs once when a server process starts (Next instrumentation hook). It validates the environment
 * first — an invalid deployment exits here listing every bad variable (F1 1.1) — then wires the
 * server-side observability (F1 1.3 §4):
 *
 * - OpenTelemetry (`@vercel/otel`) when `OTEL_EXPORTER_OTLP_ENDPOINT` is set: spans for requests and
 *   for every `fetch`, with `traceparent` propagated to getproperty-api only, so an API trace joins
 *   the page that caused it.
 * - Sentry when `SENTRY_DSN` is set, tagged with the zone, scrubbed of cookies, headers and secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { serverEnv } = await import("@/lib/env/server");
  const env = serverEnv();

  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { registerOTel } = await import("@vercel/otel");
    const api = new URL(env.API_INTERNAL_URL);
    registerOTel({
      serviceName: env.OTEL_SERVICE_NAME,
      instrumentationConfig: {
        fetch: {
          propagateContextUrls: [new RegExp(`^${api.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)],
          dontPropagateContextUrls: [/^https?:\/\/(?!127\.0\.0\.1|localhost)/],
        },
      },
    });
  }

  if (env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    const { scrubEvent } = await import("@/lib/observability/scrub");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
      beforeSend: (event) => scrubEvent(event),
    });
  }
}

/**
 * Every server error of a page, route handler or action. The log line ties Next's error digest (what
 * the error boundary shows) to the API's request id when the cause was an `ApiError`, so support can
 * go from a user's screenshot to the API's logs. Reported to Sentry when configured.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = (error as { digest?: string }).digest;
  const requestId = (error as { requestId?: string }).requestId;
  const zone = (request.headers["x-gp-zone"] as string | undefined) ?? "unknown";
  console.error("request error", {
    digest,
    requestId,
    zone,
    routePath: context.routePath,
    routeType: context.routeType,
  });
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.withScope((scope) => {
      scope.setTag("zone", zone);
      if (requestId) scope.setTag("api_request_id", requestId);
      Sentry.captureRequestError(error, request, context);
    });
  }
};
