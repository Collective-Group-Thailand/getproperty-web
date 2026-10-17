import { CSRF_HEADER } from "@/lib/api/headers";
import type { Schemas } from "@/lib/api/types";

type WebVital = Schemas["WebVitalDto"];

/**
 * Web Vitals RUM (F1 1.3 §4): LCP, INP, CLS, FCP, TTFB of real visits, batched and sent through the
 * zone's BFF to `POST /v1/{zone}/telemetry/web-vitals` (D-180) when the page is hidden. The route is a
 * pattern: the pathname without query, with every id-like segment replaced by `[id]` (no personal data).
 */
type Zone = "owner" | "staff" | "admin";

const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[A-Za-z0-9_-]{20,})$/i;

/** `/readings/3b24…a962` → `/readings/[id]`: route patterns only, never ids (contract `WebVitalDto.route`). */
export function routePattern(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => (segment && ID_SEGMENT.test(segment) ? "[id]" : segment))
    .join("/");
}

export function startWebVitals(zone: Zone): void {
  const queue: WebVital[] = [];
  const flush = () => {
    if (queue.length === 0) return;
    const body = JSON.stringify({ metrics: queue.splice(0, queue.length) });
    void fetch(`/bff/v1/${zone}/telemetry/web-vitals`, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body,
    }).catch(() => undefined);
  };
  void import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    const record = (metric: { name: string; value: number; rating: string; id: string; navigationType?: string }) => {
      queue.push({
        name: metric.name as WebVital["name"],
        value: metric.value,
        rating: metric.rating as WebVital["rating"],
        id: metric.id,
        route: routePattern(window.location.pathname),
        navigationType: metric.navigationType as WebVital["navigationType"],
      });
    };
    onCLS(record);
    onFCP(record);
    onINP(record);
    onLCP(record);
    onTTFB(record);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}
