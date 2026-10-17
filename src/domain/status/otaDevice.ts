import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconCommand } from "@/ui/icons/glyphs/command";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconUndo } from "@/ui/icons/glyphs/undo";

import { defineStatuses } from "./define";

/** `OtaDeviceStatus` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type OtaDeviceStatus = Schemas["OtaDeviceStatus"];

export const OTA_DEVICE_STATUS = defineStatuses<OtaDeviceStatus>("otaDevice", {
  queued: { tone: "neutral", icon: IconClock },
  commanded: { tone: "info", icon: IconCommand },
  started: { tone: "info", icon: IconPlay },
  applied: { tone: "success", icon: IconCheckCircle },
  rolled_back: { tone: "warning", icon: IconUndo },
  failed: { tone: "danger", icon: IconAlert },
});

export const OTA_DEVICE_VALUES = Object.keys(OTA_DEVICE_STATUS) as OtaDeviceStatus[];
