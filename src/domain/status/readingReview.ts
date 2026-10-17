import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `ReviewStatus` — contract enum, smart.reading_review (B3.3, D-035, D-142). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type ReadingReviewStatus = Schemas["ReviewStatus"];

export const READING_REVIEW_STATUS = defineStatuses<ReadingReviewStatus>("readingReview", {
  open: { tone: "warning", icon: IconFlag },
  accepted: { tone: "success", icon: IconCheckCircle },
  corrected: { tone: "info", icon: IconEdit },
  rejected: { tone: "neutral", icon: IconXCircle },
});

export const READING_REVIEW_VALUES = Object.keys(READING_REVIEW_STATUS) as ReadingReviewStatus[];
