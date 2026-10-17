import { STAFF_SW_SOURCE, STAFF_SW_VERSION } from "@/lib/pwa/generated/staff-sw";

/**
 * The staff PWA's service worker at `/sw.js` (the proxy rewrites the staff host's `/sw.js` here; the
 * owner and admin hosts have none). `Service-Worker-Allowed: /` lets it control the whole host;
 * `no-cache` makes browsers check for a new version on every navigation (ADR-0007).
 */
export function GET() {
  return new Response(STAFF_SW_SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
      "X-SW-Version": STAFF_SW_VERSION,
    },
  });
}
