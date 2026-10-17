import { CSRF_HEADER } from "@/lib/api/headers";
import type { WebVital } from "@/lib/api/pending";

/**
 * Web Vitals RUM (F1 1.3 §4): LCP, INP, CLS, FCP, TTFB of real visits, batched and sent through the
 * zone's BFF to `POST /v1/{zone}/telemetry/web-vitals` (a contract request) when the page is hidden.
 * The route is the path template-ish pathname without query (no ids beyond the path, no tokens).
 */
type Zone = "owner" | "staff" | "admin";

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
        route: window.location.pathname,
        navigationType: metric.navigationType,
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
