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

/** Interactions that load the library: LCP is final at the first one, and INP's own entries are buffered. */
const LOAD_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

/**
 * Starts RUM for a zone. The library (≈ 4 KB gz) is not part of a page's first load: it is fetched on the
 * first interaction — its observers are buffered, so LCP, FCP, TTFB and CLS of the load and the first
 * interaction's INP are still measured — or, on a visit without any, when the page is hidden, then
 * reported at once and flushed. A metric is reported again as it changes; the queue keeps its latest value.
 */
export function startWebVitals(zone: Zone): void {
  const queue = new Map<string, WebVital>();
  const flush = () => {
    if (queue.size === 0) return;
    const body = JSON.stringify({ metrics: [...queue.values()] });
    queue.clear();
    void fetch(`/bff/v1/${zone}/telemetry/web-vitals`, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body,
    }).catch(() => undefined);
  };
  const record = (metric: { name: string; value: number; rating: string; id: string; navigationType?: string }) => {
    queue.set(metric.id, {
      name: metric.name as WebVital["name"],
      value: metric.value,
      rating: metric.rating as WebVital["rating"],
      id: metric.id,
      route: routePattern(window.location.pathname),
      navigationType: metric.navigationType as WebVital["navigationType"],
    });
  };

  let loading: Promise<void> | undefined;
  const load = (reportAllChanges: boolean) => {
    for (const type of LOAD_EVENTS) window.removeEventListener(type, onInteraction, true);
    loading ??= import("web-vitals")
      .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
        const options = { reportAllChanges };
        onCLS(record, options);
        onFCP(record, options);
        onINP(record, options);
        onLCP(record, options);
        onTTFB(record, options);
      })
      .catch(() => {
        loading = undefined;
      });
    return loading;
  };
  function onInteraction() {
    void load(false);
  }
  for (const type of LOAD_EVENTS) window.addEventListener(type, onInteraction, { capture: true, passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    if (loading) flush();
    else void load(true).then(flush);
  });
  window.addEventListener("pagehide", flush);
}
