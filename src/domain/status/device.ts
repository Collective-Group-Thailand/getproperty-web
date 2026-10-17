import type { ContractEnum } from "@/lib/api/types";

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
  inventory: { tone: "neutral", icon: "parcel" },
  assigned: { tone: "info", icon: "building" },
  provisioned: { tone: "primary", icon: "check" },
  online: { tone: "success", icon: "check-circle" },
  degraded: { tone: "warning", icon: "warning" },
  offline: { tone: "danger", icon: "offline" },
  retired: { tone: "neutral", icon: "x-circle" },
});

export const DEVICE_VALUES = Object.keys(DEVICE_STATUS) as DeviceStatus[];
