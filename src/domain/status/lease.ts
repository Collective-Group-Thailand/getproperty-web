import type { ContractEnum } from "@/lib/api/types";

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
  draft: { tone: "neutral", icon: "edit" },
  pending_signature: { tone: "info", icon: "lease" },
  active: { tone: "success", icon: "check-circle" },
  notice_given: { tone: "warning", icon: "calendar" },
  ending: { tone: "warning", icon: "clock" },
  ended: { tone: "neutral", icon: "check" },
  terminated: { tone: "danger", icon: "x-circle" },
  cancelled: { tone: "neutral", icon: "x-circle" },
});

export const LEASE_VALUES = Object.keys(LEASE_STATUS) as LeaseStatus[];
