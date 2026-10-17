import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `OutboxState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type OutboxState = Schemas["OutboxState"];

export const OUTBOX_STATUS = defineStatuses<OutboxState>("outbox", {
  pending: { tone: "warning", icon: IconClock },
  publishing: { tone: "info", icon: IconRefresh },
  published: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "danger", icon: IconAlert },
  dead: { tone: "danger", icon: IconXCircle },
});

export const OUTBOX_VALUES = Object.keys(OUTBOX_STATUS) as OutboxState[];
