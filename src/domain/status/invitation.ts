import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `InvitationState` — contract enum, core.invitation (D-145, D-175). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type InvitationState = Schemas["InvitationState"];

export const INVITATION_STATUS = defineStatuses<InvitationState>("invitation", {
  pending: { tone: "warning", icon: IconClock },
  accepted: { tone: "success", icon: IconCheckCircle },
  expired: { tone: "neutral", icon: IconClock },
  revoked: { tone: "neutral", icon: IconXCircle },
});

export const INVITATION_VALUES = Object.keys(INVITATION_STATUS) as InvitationState[];
