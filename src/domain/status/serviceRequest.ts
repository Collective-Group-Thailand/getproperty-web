import type { Schemas } from "@/lib/api/types";
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
 * `ServiceRequestStatus` — contract enum, ops.service_request (B5.1, D-072, D-210). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type ServiceRequestStatus = Schemas["ServiceRequestStatus"];

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
