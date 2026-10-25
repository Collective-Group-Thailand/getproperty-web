import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconHistory } from "@/ui/icons/glyphs/history";

import { defineStatuses } from "./define";

/** `MessagingRateState` — contract enum (the shared LINE OA's charge, D-254). */
export type MessagingRateState = Schemas["MessagingRateState"];

export const MESSAGING_RATE_STATUS = defineStatuses<MessagingRateState>("messagingRate", {
  entered: { tone: "warning", icon: IconClock },
  published: { tone: "success", icon: IconCheckCircle },
  withdrawn: { tone: "neutral", icon: IconHistory },
});
