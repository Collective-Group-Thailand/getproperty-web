import type { ContractEnum } from "@/lib/api/types";

import { defineStatuses } from "./define";

/**
 * `WorkOrderStatus` — schema-design v2 §ops.work_order (`ops.work_order_status`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type WorkOrderStatus = ContractEnum<
  "WorkOrderStatus",
  "open" | "assigned" | "accepted" | "in_progress" | "done" | "verified" | "cancelled"
>;

export const WORK_ORDER_STATUS = defineStatuses<WorkOrderStatus>("workOrder", {
  open: { tone: "info", icon: "ticket" },
  assigned: { tone: "primary", icon: "staff" },
  accepted: { tone: "primary", icon: "check" },
  in_progress: { tone: "primary", icon: "clock" },
  done: { tone: "success", icon: "check-circle" },
  verified: { tone: "success", icon: "shield" },
  cancelled: { tone: "neutral", icon: "x-circle" },
});

export const WORK_ORDER_VALUES = Object.keys(WORK_ORDER_STATUS) as WorkOrderStatus[];
