import type { MenuRegistry } from "@/features/shared/shell/menu";
import type { Schemas } from "@/lib/api/types";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconStaff } from "@/ui/icons/glyphs/staff";

/** Staff PWA routes per menu key (F4 builds the pages). "Today" is always there; the rest is entitled. */
export const STAFF_MENU: MenuRegistry<Schemas["StaffMenuKey"]> = {
  readings: { href: "/readings", icon: IconMeter, group: "work" },
  /** The reading round is the readings page (F4 4.1). */
  reading_rounds: null,
  inspections: { href: "/inspections", icon: IconCamera, group: "work" },
  installs: { href: "/devices", icon: IconGateway, group: "work" },
  service_requests: { href: "/work-orders", icon: IconStaff, group: "work" },
  parcels: { href: "/parcels", icon: IconParcel, group: "work" },
};

/**
 * Big-target bottom nav, by how often the work comes round (redesign G7): Today, Readings, Work orders (R2), Parcels,
 * then More — inspections (a few a month, and every open one is on Today) and devices (installers) live there.
 */
export const STAFF_BOTTOM_NAV = ["readings", "service_requests", "parcels", "inspections", "installs"] as const;
