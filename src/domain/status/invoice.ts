import type { ContractEnum } from "@/lib/api/types";

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
  draft: { tone: "neutral", icon: "edit" },
  issued: { tone: "primary", icon: "bill" },
  partially_paid: { tone: "info", icon: "wallet" },
  paid: { tone: "success", icon: "check-circle" },
  overdue: { tone: "warning", icon: "clock" },
  void: { tone: "neutral", icon: "x-circle" },
});

export const INVOICE_VALUES = Object.keys(INVOICE_STATUS) as InvoiceStatus[];
