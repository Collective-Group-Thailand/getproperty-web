import type { ContractEnum } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `PaymentStatus` — schema-design v2 §ops.payment (`ops.payment_status`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 */
export type PaymentStatus = ContractEnum<"PaymentStatus", "pending" | "confirmed" | "failed" | "refunded" | "reversed">;

export const PAYMENT_STATUS = defineStatuses<PaymentStatus>("payment", {
  pending: { tone: "warning", icon: IconClock },
  confirmed: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "danger", icon: IconXCircle },
  refunded: { tone: "neutral", icon: IconRefresh },
  reversed: { tone: "neutral", icon: IconRefresh },
});

export const PAYMENT_VALUES = Object.keys(PAYMENT_STATUS) as PaymentStatus[];
