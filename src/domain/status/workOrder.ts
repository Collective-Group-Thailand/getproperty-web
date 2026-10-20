import type { Schemas } from "@/lib/api/types";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconTicket } from "@/ui/icons/glyphs/ticket";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `WorkOrderStatus` — contract enum, ops.work_order (B5.1, D-072, D-210). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type WorkOrderStatus = Schemas["WorkOrderStatus"];

export const WORK_ORDER_STATUS = defineStatuses<WorkOrderStatus>("workOrder", {
  open: { tone: "info", icon: IconTicket },
  assigned: { tone: "primary", icon: IconStaff },
  accepted: { tone: "primary", icon: IconCheck },
  in_progress: { tone: "primary", icon: IconClock },
  done: { tone: "success", icon: IconCheckCircle },
  verified: { tone: "success", icon: IconShield },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const WORK_ORDER_VALUES = Object.keys(WORK_ORDER_STATUS) as WorkOrderStatus[];
