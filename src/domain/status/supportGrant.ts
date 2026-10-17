import type { Schemas } from "@/lib/api/types";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `SupportGrantState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type SupportGrantState = Schemas["SupportGrantState"];

export const SUPPORT_GRANT_STATUS = defineStatuses<SupportGrantState>("supportGrant", {
  requested: { tone: "warning", icon: IconClock },
  approved: { tone: "info", icon: IconCheck },
  active: { tone: "success", icon: IconKey },
  expired: { tone: "neutral", icon: IconClock },
  revoked: { tone: "neutral", icon: IconXCircle },
  denied: { tone: "danger", icon: IconXCircle },
});

export const SUPPORT_GRANT_VALUES = Object.keys(SUPPORT_GRANT_STATUS) as SupportGrantState[];
