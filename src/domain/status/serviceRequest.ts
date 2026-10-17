import type { ContractEnum } from "@/lib/api/types";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconFilter } from "@/ui/icons/glyphs/filter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconTicket } from "@/ui/icons/glyphs/ticket";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

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
  new: { tone: "info", icon: IconTicket },
  triaged: { tone: "primary", icon: IconFilter },
  assigned: { tone: "primary", icon: IconStaff },
  in_progress: { tone: "primary", icon: IconClock },
  waiting_parts: { tone: "warning", icon: IconParcel },
  done: { tone: "success", icon: IconCheckCircle },
  closed: { tone: "neutral", icon: IconCheck },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const SERVICE_REQUEST_VALUES = Object.keys(SERVICE_REQUEST_STATUS) as ServiceRequestStatus[];
