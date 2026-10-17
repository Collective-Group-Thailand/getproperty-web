import type { ContractEnum } from "@/lib/api/types";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconResident } from "@/ui/icons/glyphs/resident";
import { IconRoom } from "@/ui/icons/glyphs/room";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `UnitStatus` — contract `UnitStatus` (B2.1).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type UnitStatus = ContractEnum<"UnitStatus", "vacant" | "reserved" | "occupied" | "maintenance" | "inactive">;

export const UNIT_STATUS = defineStatuses<UnitStatus>("unit", {
  vacant: { tone: "info", icon: IconRoom },
  reserved: { tone: "primary", icon: IconCalendar },
  occupied: { tone: "success", icon: IconResident },
  maintenance: { tone: "warning", icon: IconStaff },
  inactive: { tone: "neutral", icon: IconXCircle },
});

export const UNIT_VALUES = Object.keys(UNIT_STATUS) as UnitStatus[];
