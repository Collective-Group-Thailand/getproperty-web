import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChecklist } from "@/ui/icons/glyphs/checklist";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";

import { defineStatuses } from "./define";

/**
 * `SettlementStatus` — contract enum, ops.deposit_settlement (B2.4, D-023, D-177). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type SettlementStatus = Schemas["SettlementStatus"];

export const SETTLEMENT_STATUS = defineStatuses<SettlementStatus>("settlement", {
  opened: { tone: "neutral", icon: IconClock },
  inspected: { tone: "info", icon: IconChecklist },
  proposed: { tone: "primary", icon: IconEdit },
  agreed: { tone: "success", icon: IconCheck },
  disputed: { tone: "danger", icon: IconAlert },
  refunded: { tone: "success", icon: IconCheckCircle },
  closed: { tone: "neutral", icon: IconCheckCircle },
});

export const SETTLEMENT_VALUES = Object.keys(SETTLEMENT_STATUS) as SettlementStatus[];
