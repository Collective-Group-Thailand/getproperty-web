import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconPause } from "@/ui/icons/glyphs/pause";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * Money collection of a juristic office (pack J, JW1b; api J1.2a / J1.2b). Money that is merely owed is never red
 * (D-100): an open case is information, a defaulted plan or a failed batch is the only danger.
 */

/** `CollectionCaseState` — a party × unit followed by the ladder: open, paused (plan or dispute), resolved. */
export const COLLECTION_CASE_STATUS = defineStatuses<Schemas["CollectionCaseState"]>("collectionCase", {
  open: { tone: "info", icon: IconClock },
  paused: { tone: "neutral", icon: IconPause },
  resolved: { tone: "success", icon: IconCheckCircle },
});

/** `PaymentPlanState` (D-308). */
export const PAYMENT_PLAN_STATUS = defineStatuses<Schemas["PaymentPlanState"]>("paymentPlan", {
  proposed: { tone: "info", icon: IconClock },
  active: { tone: "primary", icon: IconRepeat },
  completed: { tone: "success", icon: IconCheckCircle },
  defaulted: { tone: "danger", icon: IconAlert },
  cancelled: { tone: "neutral", icon: IconXCircle },
  rejected: { tone: "neutral", icon: IconXCircle },
});

/** `InstalmentState` — one month of a plan. */
export const PLAN_INSTALMENT_STATUS = defineStatuses<Schemas["InstalmentState"]>("planInstalment", {
  scheduled: { tone: "neutral", icon: IconCalendar },
  billed: { tone: "info", icon: IconBill },
  paid: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/** `DebtClearanceState` (D-306) — a request, an issued certificate, or a refusal. */
export const DEBT_CLEARANCE_STATUS = defineStatuses<Schemas["DebtClearanceState"]>("debtClearance", {
  requested: { tone: "info", icon: IconClock },
  issued: { tone: "success", icon: IconCheckCircle },
  refused: { tone: "neutral", icon: IconXCircle },
});

/** `PaymentMandateState` (D-308) — auto-pay a resident set up. */
export const PAYMENT_MANDATE_STATUS = defineStatuses<Schemas["PaymentMandateState"]>("paymentMandate", {
  pending: { tone: "info", icon: IconClock },
  active: { tone: "success", icon: IconCheckCircle },
  revoked: { tone: "neutral", icon: IconXCircle },
  failed: { tone: "danger", icon: IconAlert },
});

/** `LetterBatchState` (D-307) — printed statements built by the worker. */
export const LETTER_BATCH_STATUS = defineStatuses<Schemas["LetterBatchState"]>("letterBatch", {
  queued: { tone: "info", icon: IconClock },
  ready: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "danger", icon: IconAlert },
});

/** `WorkspaceLinkState` (D-270) — a landlord's invitation of the condo's juristic office. */
export const WORKSPACE_LINK_STATUS = defineStatuses<Schemas["WorkspaceLinkState"]>("workspaceLink", {
  invited: { tone: "info", icon: IconMail },
  active: { tone: "success", icon: IconCheckCircle },
  revoked: { tone: "neutral", icon: IconXCircle },
});

/** `VerifiedDocumentStatus` — the public check of a certificate. */
export const VERIFIED_DOCUMENT_STATUS = defineStatuses<Schemas["VerifiedDocumentStatus"]>("verifiedDocument", {
  valid: { tone: "success", icon: IconCheckCircle },
  expired: { tone: "warning", icon: IconClock },
});
