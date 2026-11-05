import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * The juristic light GL (pack J, JW2a; api J2.1, D-329). A rejection or a cancellation is a decision, not an error:
 * neutral. Approved-but-not-paid is the office's next job (info); only money actually paid is success.
 */

/** `ExpenseState` — an expense request: draft → submitted → approved | rejected → paid; cancelled before paid. */
export const EXPENSE_STATUS = defineStatuses<Schemas["ExpenseState"]>("expense", {
  draft: { tone: "neutral", icon: IconEdit },
  submitted: { tone: "warning", icon: IconClock },
  approved: { tone: "info", icon: IconPayment },
  rejected: { tone: "neutral", icon: IconXCircle },
  paid: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/** `FundTransferState` — a transfer waits for a second user, then is posted. */
export const FUND_TRANSFER_STATUS = defineStatuses<Schemas["FundTransferState"]>("fundTransfer", {
  requested: { tone: "warning", icon: IconClock },
  posted: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "neutral", icon: IconXCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/** `BankLineMatch` — what a bank statement line is matched to. */
export const BANK_LINE_STATUS = defineStatuses<Schemas["BankLineMatch"]>("bankLine", {
  none: { tone: "warning", icon: IconClock },
  payment: { tone: "success", icon: IconLink },
  expense: { tone: "success", icon: IconLink },
  fund_transfer: { tone: "success", icon: IconLink },
  ignored: { tone: "neutral", icon: IconHide },
});
