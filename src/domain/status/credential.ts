import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconTimer } from "@/ui/icons/glyphs/timer";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `CredentialStatus` — contract enum, smart.access_credential (B5.2, D-071, D-211). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type CredentialStatus = Schemas["CredentialStatus"];

export const CREDENTIAL_STATUS = defineStatuses<CredentialStatus>("credential", {
  pending: { tone: "neutral", icon: IconClock },
  active: { tone: "success", icon: IconKey },
  revoked: { tone: "neutral", icon: IconXCircle },
  expired: { tone: "neutral", icon: IconTimer },
  failed: { tone: "danger", icon: IconAlert },
});

export const CREDENTIAL_VALUES = Object.keys(CREDENTIAL_STATUS) as CredentialStatus[];
