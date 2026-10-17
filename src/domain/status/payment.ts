import type { ContractEnum } from "@/lib/api/types";

import { defineStatuses } from "./define";

/**
 * `PaymentStatus` — schema-design v2 §ops.payment (`ops.payment_status`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type PaymentStatus = ContractEnum<"PaymentStatus", "pending" | "confirmed" | "failed" | "refunded" | "reversed">;

export const PAYMENT_STATUS = defineStatuses<PaymentStatus>("payment", {
  pending: { tone: "warning", icon: "clock" },
  confirmed: { tone: "success", icon: "check-circle" },
  failed: { tone: "danger", icon: "x-circle" },
  refunded: { tone: "neutral", icon: "refresh" },
  reversed: { tone: "neutral", icon: "refresh" },
});

export const PAYMENT_VALUES = Object.keys(PAYMENT_STATUS) as PaymentStatus[];
