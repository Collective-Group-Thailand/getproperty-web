import type { MenuDefinition } from "@/features/shared/shell/menu";

/** Staff PWA routes per menu key (F4 builds the pages). "Today" is always there; the rest is entitled. */
export const STAFF_MENU: Readonly<Record<string, MenuDefinition>> = {
  readings: { href: "/readings", icon: "meter", group: "work" },
  inspections: { href: "/inspections", icon: "camera", group: "work" },
  installs: { href: "/devices", icon: "gateway", group: "work" },
  service_requests: { href: "/work-orders", icon: "staff", group: "work" },
  parcels: { href: "/parcels", icon: "parcel", group: "work" },
};

/** Big-target bottom nav: Today, Readings, Inspect, Work orders (R2) or Devices, More. */
export const STAFF_BOTTOM_NAV = ["readings", "inspections", "service_requests", "installs"] as const;
