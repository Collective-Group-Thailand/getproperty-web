import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconWallet } from "@/ui/icons/glyphs/wallet";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `PlatformInvoiceStatus` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type PlatformInvoiceStatus = Schemas["PlatformInvoiceStatus"];

export const PLATFORM_INVOICE_STATUS = defineStatuses<PlatformInvoiceStatus>("platformInvoice", {
  draft: { tone: "neutral", icon: IconEdit },
  issued: { tone: "info", icon: IconBill },
  paid: { tone: "success", icon: IconCheckCircle },
  partially_paid: { tone: "warning", icon: IconWallet },
  overdue: { tone: "danger", icon: IconAlert },
  void: { tone: "neutral", icon: IconXCircle },
  credited: { tone: "neutral", icon: IconUndo },
});

export const PLATFORM_INVOICE_VALUES = Object.keys(PLATFORM_INVOICE_STATUS) as PlatformInvoiceStatus[];
