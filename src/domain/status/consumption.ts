import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `ConsumptionState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type ConsumptionState = Schemas["ConsumptionState"];

export const CONSUMPTION_STATUS = defineStatuses<ConsumptionState>("consumption", {
  processed: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "warning", icon: IconAlert },
  dead: { tone: "danger", icon: IconXCircle },
});

export const CONSUMPTION_VALUES = Object.keys(CONSUMPTION_STATUS) as ConsumptionState[];
