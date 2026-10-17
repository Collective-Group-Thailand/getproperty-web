import type { Schemas } from "@/lib/api/types";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";

import { defineStatuses } from "./define";

/** `InspectionStatus` — contract (B2.4, D-023): scheduled → in progress → completed → signed. */
export type InspectionStatus = Schemas["InspectionStatus"];

export const INSPECTION_STATUS = defineStatuses<InspectionStatus>("inspection", {
  scheduled: { tone: "info", icon: IconCalendar },
  in_progress: { tone: "primary", icon: IconEdit },
  completed: { tone: "success", icon: IconCheck },
  signed: { tone: "success", icon: IconCheckCircle },
});

export const INSPECTION_VALUES = Object.keys(INSPECTION_STATUS) as InspectionStatus[];
