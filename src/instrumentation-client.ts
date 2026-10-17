/**
 * Browser-side observability for every zone (F1 1.3 §4), loaded by Next before the app hydrates.
 * Everything heavy is a dynamic import, so a zone pays for Sentry only when a DSN is configured.
 * The zone comes from `<html data-zone>` (stamped by each root layout).
 */
import { scrubEvent } from "@/lib/observability/scrub";
import { startWebVitals } from "@/lib/observability/web-vitals";

const zone = document.documentElement.dataset.zone;
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (zone === "owner" || zone === "staff" || zone === "admin") {
  startWebVitals(zone);
  if (dsn) {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_ENV_BADGE ?? "production",
        tracesSampleRate: 0,
        initialScope: { tags: { zone } },
        beforeSend: (event) => scrubEvent(event),
        beforeBreadcrumb: (breadcrumb) => {
          if (breadcrumb.category === "console") return null;
          return breadcrumb;
        },
      });
    });
  }
}
