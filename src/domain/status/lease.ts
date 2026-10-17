import type { ContractEnum } from "@/lib/api/types";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `LeaseStatus` — schema-design v2 §ops.lease (`ops.lease_status`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type LeaseStatus = ContractEnum<
  "LeaseStatus",
  "draft" | "pending_signature" | "active" | "notice_given" | "ending" | "ended" | "terminated" | "cancelled"
>;

export const LEASE_STATUS = defineStatuses<LeaseStatus>("lease", {
  draft: { tone: "neutral", icon: IconEdit },
  pending_signature: { tone: "info", icon: IconLease },
  active: { tone: "success", icon: IconCheckCircle },
  notice_given: { tone: "warning", icon: IconCalendar },
  ending: { tone: "warning", icon: IconClock },
  ended: { tone: "neutral", icon: IconCheck },
  terminated: { tone: "danger", icon: IconXCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const LEASE_VALUES = Object.keys(LEASE_STATUS) as LeaseStatus[];
