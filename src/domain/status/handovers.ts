import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconSend } from "@/ui/icons/glyphs/send";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * Developer handovers and management contracts (pack J, JW3b; api J3.2 + J3.3, D-333, D-334). A handover waiting for
 * review is the office's next job (warning); accepted is success; a rejection or a superseded payload is history
 * (neutral). An offer waiting for the PM company's answer is info; a running contract is success; everything that ended
 * is neutral — an ended contract is a decision, never a fault (J-DESIGN §1.2).
 */

/** `HandoverState` — received → pending_review → accepted | rejected; superseded by a re-send. */
export const HANDOVER_STATUS = defineStatuses<Schemas["HandoverState"]>("handover", {
  received: { tone: "neutral", icon: IconInbox },
  pending_review: { tone: "warning", icon: IconClock },
  accepted: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "neutral", icon: IconUndo },
  superseded: { tone: "neutral", icon: IconHistory },
});

/** `ManagementContractState` — draft → offered → active → ended | terminated; declined, cancelled. */
export const MANAGEMENT_CONTRACT_STATUS = defineStatuses<Schemas["ManagementContractState"]>("managementContract", {
  draft: { tone: "neutral", icon: IconEdit },
  offered: { tone: "info", icon: IconSend },
  active: { tone: "success", icon: IconCheckCircle },
  declined: { tone: "neutral", icon: IconXCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
  ended: { tone: "neutral", icon: IconHistory },
  terminated: { tone: "neutral", icon: IconXCircle },
});
