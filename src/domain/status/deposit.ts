import type { ContractEnum } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `DepositStatus` — schema-design v2 §ops.deposit (`ops.deposit_status`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type DepositStatus = ContractEnum<
  "DepositStatus",
  "pending" | "held" | "settling" | "refunded" | "forfeited_partially" | "forfeited" | "disputed"
>;

export const DEPOSIT_STATUS = defineStatuses<DepositStatus>("deposit", {
  pending: { tone: "neutral", icon: IconClock },
  held: { tone: "primary", icon: IconShield },
  settling: { tone: "warning", icon: IconClock },
  refunded: { tone: "success", icon: IconCheckCircle },
  forfeited_partially: { tone: "warning", icon: IconAlert },
  forfeited: { tone: "neutral", icon: IconXCircle },
  disputed: { tone: "danger", icon: IconAlert },
});

export const DEPOSIT_VALUES = Object.keys(DEPOSIT_STATUS) as DepositStatus[];
