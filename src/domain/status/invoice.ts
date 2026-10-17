import type { ContractEnum } from "@/lib/api/types";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconWallet } from "@/ui/icons/glyphs/wallet";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `InvoiceStatus` — schema-design v2 §ops.invoice (`ops.invoice_status`).
 * Typed with `ContractEnum`: the generated component wins as soon as the contract publishes it, and a
 * value the map does not cover fails the build until it has a tone, an icon and a label.
 * Overdue is amber, never red: money that is merely due is not an error (D-100).
 */
export type InvoiceStatus = ContractEnum<
  "InvoiceStatus",
  "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void"
>;

export const INVOICE_STATUS = defineStatuses<InvoiceStatus>("invoice", {
  draft: { tone: "neutral", icon: IconEdit },
  issued: { tone: "primary", icon: IconBill },
  partially_paid: { tone: "info", icon: IconWallet },
  paid: { tone: "success", icon: IconCheckCircle },
  overdue: { tone: "warning", icon: IconClock },
  void: { tone: "neutral", icon: IconXCircle },
});

export const INVOICE_VALUES = Object.keys(INVOICE_STATUS) as InvoiceStatus[];
