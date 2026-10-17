import type { MenuDefinition } from "@/features/shared/shell/menu";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconStaff } from "@/ui/icons/glyphs/staff";

/** Staff PWA routes per menu key (F4 builds the pages). "Today" is always there; the rest is entitled. */
export const STAFF_MENU: Readonly<Record<string, MenuDefinition>> = {
  readings: { href: "/readings", icon: IconMeter, group: "work" },
  inspections: { href: "/inspections", icon: IconCamera, group: "work" },
  installs: { href: "/devices", icon: IconGateway, group: "work" },
  service_requests: { href: "/work-orders", icon: IconStaff, group: "work" },
  parcels: { href: "/parcels", icon: IconParcel, group: "work" },
};

/** Big-target bottom nav: Today, Readings, Inspect, Work orders (R2) or Devices, More. */
export const STAFF_BOTTOM_NAV = ["readings", "inspections", "service_requests", "installs"] as const;
