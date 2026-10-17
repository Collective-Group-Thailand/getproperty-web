import type { Schemas } from "@/lib/api/types";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconRemove } from "@/ui/icons/glyphs/remove";
import { IconSwap } from "@/ui/icons/glyphs/swap";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `HaasState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type HaasState = Schemas["HaasState"];

export const HAAS_STATUS = defineStatuses<HaasState>("haas", {
  allocated: { tone: "info", icon: IconParcel },
  installed: { tone: "primary", icon: IconCheck },
  in_service: { tone: "success", icon: IconCheckCircle },
  replaced: { tone: "neutral", icon: IconSwap },
  deinstalled: { tone: "neutral", icon: IconRemove },
  written_off: { tone: "danger", icon: IconXCircle },
});

export const HAAS_VALUES = Object.keys(HAAS_STATUS) as HaasState[];
