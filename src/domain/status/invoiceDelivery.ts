import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconRemove } from "@/ui/icons/glyphs/remove";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `InvoiceDeliveryStatus` — contract enum, notifications of an invoice (D-208). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type InvoiceDeliveryStatus = Schemas["InvoiceDeliveryStatus"];

export const INVOICE_DELIVERY_STATUS = defineStatuses<InvoiceDeliveryStatus>("invoiceDelivery", {
  queued: { tone: "neutral", icon: IconClock },
  held: { tone: "warning", icon: IconClock },
  sent: { tone: "info", icon: IconMail },
  delivered: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "danger", icon: IconXCircle },
  cancelled: { tone: "neutral", icon: IconRemove },
});

export const INVOICE_DELIVERY_VALUES = Object.keys(INVOICE_DELIVERY_STATUS) as InvoiceDeliveryStatus[];
