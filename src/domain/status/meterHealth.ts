import type { ContractEnum } from "@/lib/api/types";

import { defineStatuses } from "./define";

/**
 * `MeterHealth` — schema-design v2 §smart.meter_status (`smart.meter_health`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type MeterHealth = ContractEnum<"MeterHealth", "ok" | "stale" | "silent" | "no_device" | "unknown">;

export const METER_HEALTH_STATUS = defineStatuses<MeterHealth>("meterHealth", {
  ok: { tone: "success", icon: "check-circle" },
  stale: { tone: "warning", icon: "clock" },
  silent: { tone: "warning", icon: "offline" },
  no_device: { tone: "neutral", icon: "gateway" },
  unknown: { tone: "neutral", icon: "help" },
});

export const METER_HEALTH_VALUES = Object.keys(METER_HEALTH_STATUS) as MeterHealth[];
