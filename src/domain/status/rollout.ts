import type { Schemas } from "@/lib/api/types";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `RolloutStatus` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type RolloutStatus = Schemas["RolloutStatus"];

export const ROLLOUT_STATUS = defineStatuses<RolloutStatus>("rollout", {
  planned: { tone: "neutral", icon: IconCalendar },
  running: { tone: "info", icon: IconPlay },
  paused: { tone: "warning", icon: IconClock },
  completed: { tone: "success", icon: IconCheckCircle },
  rolled_back: { tone: "warning", icon: IconUndo },
  aborted: { tone: "danger", icon: IconXCircle },
});

export const ROLLOUT_VALUES = Object.keys(ROLLOUT_STATUS) as RolloutStatus[];
