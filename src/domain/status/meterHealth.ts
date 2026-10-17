import type { ContractEnum } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconHelp } from "@/ui/icons/glyphs/help";
import { IconOffline } from "@/ui/icons/glyphs/offline";

import { defineStatuses } from "./define";

/**
 * `MeterHealth` — schema-design v2 §smart.meter_status (`smart.meter_health`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type MeterHealth = ContractEnum<"MeterHealth", "ok" | "stale" | "silent" | "no_device" | "unknown">;

export const METER_HEALTH_STATUS = defineStatuses<MeterHealth>("meterHealth", {
  ok: { tone: "success", icon: IconCheckCircle },
  stale: { tone: "warning", icon: IconClock },
  silent: { tone: "warning", icon: IconOffline },
  no_device: { tone: "neutral", icon: IconGateway },
  unknown: { tone: "neutral", icon: IconHelp },
});

export const METER_HEALTH_VALUES = Object.keys(METER_HEALTH_STATUS) as MeterHealth[];
