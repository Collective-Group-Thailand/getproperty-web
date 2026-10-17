import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { defineStatuses } from "./define";

/**
 * `ExportStatus` — contract enum, platform.export_job (B4.3, D-202). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type ExportStatus = Schemas["ExportStatus"];

export const EXPORT_JOB_STATUS = defineStatuses<ExportStatus>("exportJob", {
  queued: { tone: "neutral", icon: IconClock },
  running: { tone: "info", icon: IconRefresh },
  done: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "danger", icon: IconAlert },
});

export const EXPORT_JOB_VALUES = Object.keys(EXPORT_JOB_STATUS) as ExportStatus[];
