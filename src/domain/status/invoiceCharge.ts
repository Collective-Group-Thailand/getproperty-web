import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `InvoiceChargeStatus` — contract enum, ops.invoice_charge (B4.2, D-193). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type InvoiceChargeStatus = Schemas["InvoiceChargeStatus"];

export const INVOICE_CHARGE_STATUS = defineStatuses<InvoiceChargeStatus>("invoiceCharge", {
  pending: { tone: "warning", icon: IconClock },
  applied: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const INVOICE_CHARGE_VALUES = Object.keys(INVOICE_CHARGE_STATUS) as InvoiceChargeStatus[];
