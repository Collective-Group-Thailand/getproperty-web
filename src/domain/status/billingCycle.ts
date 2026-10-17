import type { Schemas } from "@/lib/api/types";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChecklist } from "@/ui/icons/glyphs/checklist";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `BillingCycleStatus` — contract enum, ops.billing_cycle (B4.2, D-191). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type BillingCycleStatus = Schemas["BillingCycleStatus"];

export const BILLING_CYCLE_STATUS = defineStatuses<BillingCycleStatus>("billingCycle", {
  open: { tone: "neutral", icon: IconClock },
  readings_pending: { tone: "warning", icon: IconMeter },
  computed: { tone: "info", icon: IconChecklist },
  issued: { tone: "primary", icon: IconBill },
  closed: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const BILLING_CYCLE_VALUES = Object.keys(BILLING_CYCLE_STATUS) as BillingCycleStatus[];
