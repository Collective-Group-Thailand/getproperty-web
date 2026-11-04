import type { Schemas } from "@/lib/api/types";

/** Where an inner screen sits in the staff PWA: the section it belongs to and whether it is a task screen. */
export interface StaffInnerRoute {
  /** The list the back arrow returns to. */
  back: string;
  /** The section's nav key: its label is the top bar title. */
  section: Schemas["StaffMenuKey"];
  /**
   * A task screen (a work order, a request, an inspection, an install wizard) hides the bottom nav: the screen's own
   * sticky action bar takes the thumb zone instead.
   */
  task: boolean;
}

const INNER: { pattern: RegExp; route: StaffInnerRoute }[] = [
  { pattern: /^\/work-orders\/[^/]+$/, route: { back: "/work-orders", section: "service_requests", task: true } },
  { pattern: /^\/service-requests\/[^/]+$/, route: { back: "/work-orders", section: "service_requests", task: true } },
  { pattern: /^\/inspections\/[^/]+$/, route: { back: "/inspections", section: "inspections", task: true } },
  { pattern: /^\/devices\/(install|provision|swap)$/, route: { back: "/devices", section: "installs", task: true } },
  { pattern: /^\/devices\/[^/]+$/, route: { back: "/devices", section: "installs", task: false } },
];

/** The inner route a pathname is, or `null` on a tab root (Today, Readings, Work orders, Parcels, …). */
export function staffInnerRoute(pathname: string): StaffInnerRoute | null {
  return INNER.find((entry) => entry.pattern.test(pathname))?.route ?? null;
}
