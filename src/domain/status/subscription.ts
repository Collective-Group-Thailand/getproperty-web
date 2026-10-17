import type { ContractEnum } from "@/lib/api/types";

import { defineStatuses } from "./define";

/**
 * `SubscriptionState` — contract `SubscriptionState` (B1.3).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 * Suspended means read-only (D-082); the banner is driven by `me.subscription.readOnly`, not by this map.
 */
export type SubscriptionState = ContractEnum<
  "SubscriptionState",
  "trial" | "active" | "past_due" | "suspended" | "cancelled"
>;

export const SUBSCRIPTION_STATUS = defineStatuses<SubscriptionState>("subscription", {
  trial: { tone: "info", icon: "clock" },
  active: { tone: "success", icon: "check-circle" },
  past_due: { tone: "warning", icon: "wallet" },
  suspended: { tone: "danger", icon: "lock" },
  cancelled: { tone: "neutral", icon: "x-circle" },
});

export const SUBSCRIPTION_VALUES = Object.keys(SUBSCRIPTION_STATUS) as SubscriptionState[];
