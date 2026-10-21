import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconTimer } from "@/ui/icons/glyphs/timer";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `Tm30Status` — contract enum, ops.tm30_export (B6.2, D-052, D-216): a foreign occupant's notification to
 * the Immigration Bureau, from "due" (24 h after the move-in) to the owner's recorded manual submission.
 * Amber while it is open — a legal deadline, not money (D-100).
 */
export type Tm30Status = Schemas["Tm30Status"];

export const TM30_STATUS = defineStatuses<Tm30Status>("tm30", {
  due: { tone: "warning", icon: IconTimer },
  generated: { tone: "warning", icon: IconUpload },
  downloaded: { tone: "warning", icon: IconDownload },
  submitted_manually: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const TM30_VALUES = Object.keys(TM30_STATUS) as Tm30Status[];

/** Notifications still waiting for the owner to submit them (the dashboard's TM30 duties). */
export const TM30_OPEN: readonly Tm30Status[] = ["due", "generated", "downloaded"];
