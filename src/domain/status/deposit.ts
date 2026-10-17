import type { ContractEnum } from "@/lib/api/types";

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
  pending: { tone: "neutral", icon: "clock" },
  held: { tone: "primary", icon: "shield" },
  settling: { tone: "warning", icon: "clock" },
  refunded: { tone: "success", icon: "check-circle" },
  forfeited_partially: { tone: "warning", icon: "alert" },
  forfeited: { tone: "neutral", icon: "x-circle" },
  disputed: { tone: "danger", icon: "alert" },
});

export const DEPOSIT_VALUES = Object.keys(DEPOSIT_STATUS) as DepositStatus[];
