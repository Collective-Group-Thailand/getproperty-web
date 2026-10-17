import type { ContractEnum } from "@/lib/api/types";

import { defineStatuses } from "./define";

/**
 * `ReadingReviewState` — schema-design v2 §smart.meter_reading (`smart.reading_review_state`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type ReadingReviewState = ContractEnum<
  "ReadingReviewState",
  "accepted" | "pending_review" | "rejected" | "corrected"
>;

export const READING_STATUS = defineStatuses<ReadingReviewState>("reading", {
  accepted: { tone: "success", icon: "check-circle" },
  pending_review: { tone: "warning", icon: "clock" },
  rejected: { tone: "danger", icon: "x-circle" },
  corrected: { tone: "info", icon: "edit" },
});

export const READING_VALUES = Object.keys(READING_STATUS) as ReadingReviewState[];
