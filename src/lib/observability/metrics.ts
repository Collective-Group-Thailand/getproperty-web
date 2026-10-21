import { collectDefaultMetrics, Histogram, Registry } from "@prometheus-io/client";

import { ipAllowed, parseCidrList } from "@/lib/env/schema";
import { FORWARDED_FOR_HEADER } from "@/lib/http/edge";

/**
 * Prometheus metrics of this server process (D-230, the Collective platform's image contract: Grafana Alloy scrapes
 * every container labelled `collective.metrics`, here `GET /api/metrics` on :3000). The Node.js runtime metrics with
 * the label `service` (= `OTEL_SERVICE_NAME`, `getproperty-web`), plus what this app adds on top of the API's own
 * view of the same calls:
 *
 * - `getproperty_web_bff_request_duration_seconds{zone,method,status}` — every browser call through a zone BFF until
 *   its response headers (status class; a 502 is the API being unreachable from here). Never the path: ids would
 *   explode the series and could carry personal data.
 *
 * One registry per process, kept on `globalThis`: Next bundles route handlers separately, so a module-level
 * singleton could exist once per bundle and the scrape would miss the BFF's samples.
 */
interface WebMetrics {
  registry: Registry;
  bffDuration: Histogram<"zone" | "method" | "status">;
}

const KEY = Symbol.for("getproperty-web.metrics");

export function webMetrics(service = process.env.OTEL_SERVICE_NAME || "getproperty-web"): WebMetrics {
  const holder = globalThis as typeof globalThis & { [KEY]?: WebMetrics };
  if (holder[KEY]) return holder[KEY];
  const registry = new Registry();
  registry.setDefaultLabels({ service });
  collectDefaultMetrics({ register: registry });
  const bffDuration = new Histogram({
    name: "getproperty_web_bff_request_duration_seconds",
    help: "Browser calls through the zone BFFs until their response headers, by zone, method and status class",
    labelNames: ["zone", "method", "status"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 1.5, 2.5, 5, 10],
    registers: [registry],
  });
  holder[KEY] = { registry, bffDuration };
  return holder[KEY];
}

/** `2xx` … `5xx` (499 = the browser went away). */
export function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

/** Times one BFF call; never lets a metrics problem fail the request. */
export function timeBffCall(zone: string, method: string): (status: number) => void {
  let end: ((labels: { status: string }) => number) | undefined;
  try {
    end = webMetrics().bffDuration.startTimer({ zone, method });
  } catch {
    end = undefined;
  }
  return (status) => {
    try {
      end?.({ status: statusClass(status) });
    } catch {
      // metrics are best effort
    }
  };
}

/**
 * The address of the caller of `/api/metrics`. Next's server sets `X-Forwarded-For` to the socket peer when a
 * request arrives without one (Alloy on the docker network); a request through Caddy carries the one entry Caddy
 * vouches for (it replaces the header of an internet client) — the right-most entry either way. Caddy also answers
 * 404 for `/api/metrics` on every public host; this check is the second line, like the API's `METRICS_ALLOWED_CIDRS`.
 */
export function metricsCaller(headers: Pick<Headers, "get">): string | undefined {
  const entries = (headers.get(FORWARDED_FOR_HEADER) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.at(-1);
}

/** Whether `headers` come from an address `allowedCidrs` admits. */
export function metricsAllowed(headers: Pick<Headers, "get">, allowedCidrs: string): boolean {
  return ipAllowed(parseCidrList(allowedCidrs), metricsCaller(headers));
}

export async function renderMetrics(): Promise<{ contentType: string; body: string }> {
  const { registry } = webMetrics();
  return { contentType: registry.contentType, body: await registry.metrics() };
}
