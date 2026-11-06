import type { Schemas } from "@/lib/api/types";
import { IconBlock } from "@/ui/icons/glyphs/block";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconSend } from "@/ui/icons/glyphs/send";
import { IconTrendDown } from "@/ui/icons/glyphs/trend-down";
import { IconTrendSteady } from "@/ui/icons/glyphs/trend-steady";
import { IconTrendUp } from "@/ui/icons/glyphs/trend-up";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * Vendors, service contracts and quotation rounds (pack J, JW2b; api J2.2, D-331). A blocked vendor is a decision the
 * office took (neutral with a ban icon, never red); an ended contract is history (neutral); only a running contract
 * and an awarded round read as success. Waiting for approvals is the office's next job (warning, as expenses).
 */

/** `VendorState`. */
export const VENDOR_STATUS = defineStatuses<Schemas["VendorState"]>("vendor", {
  active: { tone: "success", icon: IconCheckCircle },
  blocked: { tone: "neutral", icon: IconBlock },
});

/** `VendorContractState` — draft → active → expired | terminated. */
export const VENDOR_CONTRACT_STATUS = defineStatuses<Schemas["VendorContractState"]>("vendorContract", {
  draft: { tone: "neutral", icon: IconEdit },
  active: { tone: "success", icon: IconCheckCircle },
  expired: { tone: "neutral", icon: IconHistory },
  terminated: { tone: "neutral", icon: IconXCircle },
});

/** `QuotationRoundState` — open → awaiting_approval → awarded | cancelled (a rejection reopens it). */
export const QUOTATION_ROUND_STATUS = defineStatuses<Schemas["QuotationRoundState"]>("quotationRound", {
  open: { tone: "info", icon: IconClock },
  awaiting_approval: { tone: "warning", icon: IconClock },
  awarded: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/** `ContractInstalmentState` — scheduled → requested (an expense request exists) | cancelled. */
export const CONTRACT_INSTALMENT_STATUS = defineStatuses<Schemas["ContractInstalmentState"]>("contractInstalment", {
  scheduled: { tone: "neutral", icon: IconClock },
  requested: { tone: "info", icon: IconSend },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/** `EvaluationTrend` — the last score against the average before it (±0.25). Declining is a warning, never red. */
export const EVALUATION_TREND_STATUS = defineStatuses<Schemas["EvaluationTrend"]>("evaluationTrend", {
  improving: { tone: "success", icon: IconTrendUp },
  steady: { tone: "neutral", icon: IconTrendSteady },
  declining: { tone: "warning", icon: IconTrendDown },
});
