import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `EtaxStatus` — contract enum, ops.etax_submission (B6.2, D-050, D-215): a receipt / tax invoice on its way
 * to the tenant's e-Tax service provider. A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type EtaxStatus = Schemas["EtaxStatus"];

export const ETAX_STATUS = defineStatuses<EtaxStatus>("etax", {
  queued: { tone: "neutral", icon: IconClock },
  submitted: { tone: "info", icon: IconRefresh },
  signed: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "danger", icon: IconXCircle },
  failed: { tone: "danger", icon: IconAlert },
});

export const ETAX_VALUES = Object.keys(ETAX_STATUS) as EtaxStatus[];
