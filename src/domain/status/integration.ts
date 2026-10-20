import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `IntegrationStatus` — contract enum (bridge events, D-205). A new value fails the build here until it has a look. */
export type IntegrationStatus = Schemas["IntegrationStatus"];

export const INTEGRATION_STATUS = defineStatuses<IntegrationStatus>("integration", {
  received: { tone: "info", icon: IconClock },
  validated: { tone: "info", icon: IconRefresh },
  applied: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "danger", icon: IconXCircle },
  pending: { tone: "warning", icon: IconClock },
  sent: { tone: "info", icon: IconRefresh },
  acked: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "danger", icon: IconAlert },
  dead: { tone: "danger", icon: IconXCircle },
});

export const INTEGRATION_VALUES = Object.keys(INTEGRATION_STATUS) as IntegrationStatus[];
