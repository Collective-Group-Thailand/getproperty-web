import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `SlipStatus` — contract enum, ops.slip_verification (B4.4, D-043, D-198). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type SlipStatus = Schemas["SlipStatus"];

export const SLIP_STATUS = defineStatuses<SlipStatus>("slip", {
  pending_verification: { tone: "neutral", icon: IconClock },
  auto_confirmed: { tone: "success", icon: IconCheckCircle },
  pending_review: { tone: "warning", icon: IconFlag },
  approved: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "neutral", icon: IconXCircle },
  duplicate: { tone: "danger", icon: IconCopy },
});

export const SLIP_VALUES = Object.keys(SLIP_STATUS) as SlipStatus[];
