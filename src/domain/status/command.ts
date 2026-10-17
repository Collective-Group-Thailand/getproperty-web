import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconSyncPending } from "@/ui/icons/glyphs/sync-pending";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `CommandStatus` — a gateway command's acknowledgement state (device protocol §2, D-131). */
export type CommandStatus = Schemas["CommandStatus"];

export const COMMAND_STATUS = defineStatuses<CommandStatus>("command", {
  queued: { tone: "neutral", icon: IconClock },
  sent: { tone: "info", icon: IconSyncPending },
  accepted: { tone: "primary", icon: IconSyncPending },
  done: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "danger", icon: IconXCircle },
  expired: { tone: "warning", icon: IconClock },
});

export const COMMAND_VALUES = Object.keys(COMMAND_STATUS) as CommandStatus[];
