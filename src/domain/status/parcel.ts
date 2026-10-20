import type { Schemas } from "@/lib/api/types";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconPackageCheck } from "@/ui/icons/glyphs/package-check";
import { IconParcel } from "@/ui/icons/glyphs/parcel";

import { defineStatuses } from "./define";

/**
 * `ParcelStatus` — contract enum, ops.parcel (B5.3, D-212). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type ParcelStatus = Schemas["ParcelStatus"];

export const PARCEL_STATUS = defineStatuses<ParcelStatus>("parcel", {
  received: { tone: "info", icon: IconParcel },
  notified: { tone: "warning", icon: IconBell },
  picked_up: { tone: "success", icon: IconPackageCheck },
  returned: { tone: "neutral", icon: IconBack },
});

export const PARCEL_VALUES = Object.keys(PARCEL_STATUS) as ParcelStatus[];
