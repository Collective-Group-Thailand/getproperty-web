import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `MessagingChannelState` — contract enum (an operator's own LINE OA, D-254). */
export type MessagingChannelState = Schemas["MessagingChannelState"];

export const MESSAGING_CHANNEL_STATUS = defineStatuses<MessagingChannelState>("messagingChannel", {
  pending: { tone: "neutral", icon: IconClock },
  verified: { tone: "success", icon: IconCheckCircle },
  failing: { tone: "danger", icon: IconAlert },
  revoked: { tone: "neutral", icon: IconXCircle },
});
