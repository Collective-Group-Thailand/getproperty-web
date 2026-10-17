import type { ContractEnum } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconWallet } from "@/ui/icons/glyphs/wallet";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

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
  trial: { tone: "info", icon: IconClock },
  active: { tone: "success", icon: IconCheckCircle },
  past_due: { tone: "warning", icon: IconWallet },
  suspended: { tone: "danger", icon: IconLock },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const SUBSCRIPTION_VALUES = Object.keys(SUBSCRIPTION_STATUS) as SubscriptionState[];
