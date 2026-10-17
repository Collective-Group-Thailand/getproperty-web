import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `InstallOrderState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type InstallOrderState = Schemas["InstallOrderState"];

export const INSTALL_ORDER_STATUS = defineStatuses<InstallOrderState>("installOrder", {
  open: { tone: "warning", icon: IconClock },
  in_progress: { tone: "info", icon: IconPlay },
  done: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const INSTALL_ORDER_VALUES = Object.keys(INSTALL_ORDER_STATUS) as InstallOrderState[];
