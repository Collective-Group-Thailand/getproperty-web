import { serverEnv } from "@/lib/env/server";
import { metricsAllowed, renderMetrics } from "@/lib/observability/metrics";

/**
 * Prometheus text for Grafana Alloy (D-230, collective-infra compose label `collective.metrics.path: /api/metrics`),
 * answered only to `METRICS_ALLOWED_CIDRS` (default loopback + private ranges, like getproperty-api); everyone else
 * gets the same 404 as an unknown path. Caddy answers 404 for the path on every public host too.
 */
export const dynamic = "force-dynamic";

const notFound = () =>
  new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

export async function GET(request: Request): Promise<Response> {
  if (!metricsAllowed(request.headers, serverEnv().METRICS_ALLOWED_CIDRS)) return notFound();
  const { contentType, body } = await renderMetrics();
  return new Response(body, { headers: { "content-type": contentType, "cache-control": "no-store" } });
}
