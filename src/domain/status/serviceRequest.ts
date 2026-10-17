import type { ContractEnum } from "@/lib/api/types";

import { defineStatuses } from "./define";

/**
 * `ServiceRequestStatus` — schema-design v2 §ops.service_request (`ops.service_request_status`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type ServiceRequestStatus = ContractEnum<
  "ServiceRequestStatus",
  "new" | "triaged" | "assigned" | "in_progress" | "waiting_parts" | "done" | "closed" | "cancelled"
>;

export const SERVICE_REQUEST_STATUS = defineStatuses<ServiceRequestStatus>("serviceRequest", {
  new: { tone: "info", icon: "ticket" },
  triaged: { tone: "primary", icon: "filter" },
  assigned: { tone: "primary", icon: "staff" },
  in_progress: { tone: "primary", icon: "clock" },
  waiting_parts: { tone: "warning", icon: "parcel" },
  done: { tone: "success", icon: "check-circle" },
  closed: { tone: "neutral", icon: "check" },
  cancelled: { tone: "neutral", icon: "x-circle" },
});

export const SERVICE_REQUEST_VALUES = Object.keys(SERVICE_REQUEST_STATUS) as ServiceRequestStatus[];
