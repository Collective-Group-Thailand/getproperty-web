import type { Schemas } from "@/lib/api/types";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHistory } from "@/ui/icons/glyphs/history";

import { defineStatuses } from "./define";

/** `TariffVersionState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type TariffVersionState = Schemas["TariffVersionState"];

export const TARIFF_VERSION_STATUS = defineStatuses<TariffVersionState>("tariffVersion", {
  draft: { tone: "neutral", icon: IconEdit },
  entered: { tone: "warning", icon: IconClock },
  verified: { tone: "info", icon: IconCheck },
  published: { tone: "success", icon: IconCheckCircle },
  superseded: { tone: "neutral", icon: IconHistory },
});

export const TARIFF_VERSION_VALUES = Object.keys(TARIFF_VERSION_STATUS) as TariffVersionState[];
