import type { ContractEnum } from "@/lib/api/types";

import { defineStatuses } from "./define";

/**
 * `UnitStatus` — contract `UnitStatus` (B2.1).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type UnitStatus = ContractEnum<"UnitStatus", "vacant" | "reserved" | "occupied" | "maintenance" | "inactive">;

export const UNIT_STATUS = defineStatuses<UnitStatus>("unit", {
  vacant: { tone: "info", icon: "room" },
  reserved: { tone: "primary", icon: "calendar" },
  occupied: { tone: "success", icon: "resident" },
  maintenance: { tone: "warning", icon: "staff" },
  inactive: { tone: "neutral", icon: "x-circle" },
});

export const UNIT_VALUES = Object.keys(UNIT_STATUS) as UnitStatus[];
