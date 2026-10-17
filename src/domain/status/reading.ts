import type { ContractEnum } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

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
  accepted: { tone: "success", icon: IconCheckCircle },
  pending_review: { tone: "warning", icon: IconClock },
  rejected: { tone: "danger", icon: IconXCircle },
  corrected: { tone: "info", icon: IconEdit },
});

export const READING_VALUES = Object.keys(READING_STATUS) as ReadingReviewState[];
