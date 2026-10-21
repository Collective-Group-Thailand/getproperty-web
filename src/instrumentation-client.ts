/**
 * Browser-side observability for every zone (F1 1.3 §4), loaded by Next before the app hydrates.
 * Everything heavy is a dynamic import, so a zone pays for Sentry only when a DSN is configured.
 * The zone, the Sentry DSN and the environment come from `<html data-zone data-sentry-dsn data-env>` (stamped by
 * each root layout from the run-time environment — the image is the same in every environment, D-230).
 */
import { scrubEvent } from "@/lib/observability/scrub";
import { startWebVitals } from "@/lib/observability/web-vitals";

const { zone, sentryDsn: dsn, env } = document.documentElement.dataset;

if (zone === "owner" || zone === "staff" || zone === "admin") {
  startWebVitals(zone);
  if (dsn) {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn,
        environment: env ?? "production",
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
