import type { ContractEnum } from "@/lib/api/types";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconOffline } from "@/ui/icons/glyphs/offline";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `DeviceStatus` — contract `DeviceStatus` (B1.3).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type DeviceStatus = ContractEnum<
  "DeviceStatus",
  "inventory" | "assigned" | "provisioned" | "online" | "degraded" | "offline" | "retired"
>;

export const DEVICE_STATUS = defineStatuses<DeviceStatus>("device", {
  inventory: { tone: "neutral", icon: IconParcel },
  assigned: { tone: "info", icon: IconBuilding },
  provisioned: { tone: "primary", icon: IconCheck },
  online: { tone: "success", icon: IconCheckCircle },
  degraded: { tone: "warning", icon: IconWarning },
  offline: { tone: "danger", icon: IconOffline },
  retired: { tone: "neutral", icon: IconXCircle },
});

export const DEVICE_VALUES = Object.keys(DEVICE_STATUS) as DeviceStatus[];
