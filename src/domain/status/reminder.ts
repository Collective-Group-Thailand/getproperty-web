import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `ReminderStatus` — contract enum, ops.dunning_reminder (B4.5, D-200). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type ReminderStatus = Schemas["ReminderStatus"];

export const REMINDER_STATUS = defineStatuses<ReminderStatus>("reminder", {
  scheduled: { tone: "neutral", icon: IconClock },
  sent: { tone: "primary", icon: IconChat },
  skipped_paid: { tone: "success", icon: IconCheckCircle },
  deferred_quiet_hours: { tone: "info", icon: IconClock },
  cancelled: { tone: "neutral", icon: IconXCircle },
  failed: { tone: "danger", icon: IconAlert },
});

export const REMINDER_VALUES = Object.keys(REMINDER_STATUS) as ReminderStatus[];
