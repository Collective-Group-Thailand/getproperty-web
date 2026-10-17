import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `MembershipStatus` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type MembershipStatus = Schemas["MembershipStatus"];

export const MEMBERSHIP_STATUS = defineStatuses<MembershipStatus>("membership", {
  invited: { tone: "info", icon: IconMail },
  active: { tone: "success", icon: IconCheckCircle },
  suspended: { tone: "warning", icon: IconLock },
  removed: { tone: "neutral", icon: IconXCircle },
});

export const MEMBERSHIP_VALUES = Object.keys(MEMBERSHIP_STATUS) as MembershipStatus[];
