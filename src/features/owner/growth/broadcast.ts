import type { Schemas } from "@/lib/api/types";

export { perRecipient, perRecipientDigits, ratePercent } from "@/features/shared/growth/sponsored";

/**
 * Pure helpers of the sponsored LINE broadcast screens (G6, D-300): the segment body from what the form holds (the
 * closed whitelist — nothing else is ever sent), the price per recipient as text, and the schedule refusals the
 * campaign page explains in its own words. No money arithmetic: amounts stay the API's decimal strings.
 */

export const UNIT_KINDS: Schemas["PortfolioUnitKind"][] = ["condo_unit", "room", "house", "townhouse"];
export const LANGUAGES: Schemas["ResidentLanguage"][] = ["th", "en", "my", "km", "lo", "zh"];

export interface SegmentForm {
  areas: string[];
  budgetMin: string;
  budgetMax: string;
  unitKinds: Schemas["PortfolioUnitKind"][];
  moveInFrom: string | null;
  moveInTo: string | null;
  languages: Schemas["ResidentLanguage"][];
}

export const EMPTY_SEGMENT: SegmentForm = {
  areas: [],
  budgetMin: "",
  budgetMax: "",
  unitKinds: [],
  moveInFrom: null,
  moveInTo: null,
  languages: [],
};

/** "12,000" / " 8000.5 " → "12000" / "8000.5"; anything that is not an amount → null (left out). */
export function amountOrNull(value: string): string | null {
  const plain = value.replace(/[,\s฿]/g, "");
  return /^\d{1,12}(\.\d{1,2})?$/.test(plain) ? plain : null;
}

/** Whether a typed budget is not an amount (empty is fine: the dimension does not restrict). */
export function invalidAmount(value: string): boolean {
  return value.trim() !== "" && amountOrNull(value) === null;
}

/** The segment exactly as the API's closed whitelist takes it (`SponsoredSegmentDto`). */
export function segmentBody(form: SegmentForm): Schemas["SponsoredSegmentDto"] {
  return {
    areas: [...form.areas],
    budgetMin: amountOrNull(form.budgetMin),
    budgetMax: amountOrNull(form.budgetMax),
    unitKinds: [...form.unitKinds],
    moveInFrom: form.moveInFrom,
    moveInTo: form.moveInTo,
    languages: [...form.languages],
  };
}

/** A whole number of recipients typed with separators ("1,000") → 1000; null when it is not one. */
export function recipientsOrNull(value: string): number | null {
  const plain = value.replace(/[,\s]/g, "");
  if (!/^\d{1,7}$/.test(plain)) return null;
  const n = Number(plain);
  return n >= 1 && n <= 1_000_000 ? n : null;
}

/** The schedule refusals with a designed explanation on the campaign page (O-023, O-027, D-300). */
export const SCHEDULE_PROBLEMS = [
  "broadcast.sponsored_disabled",
  "broadcast.not_on_sale",
  "broadcast.below_minimum",
  "broadcast.listing_not_public",
  "broadcast.invalid_state",
] as const;
export type ScheduleProblem = (typeof SCHEDULE_PROBLEMS)[number];

export function scheduleProblem(code: string | undefined): ScheduleProblem | null {
  return (SCHEDULE_PROBLEMS as readonly string[]).includes(code ?? "") ? (code as ScheduleProblem) : null;
}

/** What the product allows now: open, or why a campaign cannot be scheduled yet (both may hold). */
export function availability(product: Schemas["SponsoredProductDto"]): "open" | "off" | "unpriced" | "off_unpriced" {
  if (!product.enabled && !product.onSale) return "off_unpriced";
  if (!product.enabled) return "off";
  if (!product.onSale) return "unpriced";
  return "open";
}

/** Campaign states the buyer can still cancel (nothing sent, nothing billed). */
export const CANCELLABLE: Schemas["SponsoredCampaignState"][] = ["draft", "scheduled"];
/** Campaign states with a report (numbers only). */
export const REPORTED: Schemas["SponsoredCampaignState"][] = ["sending", "sent"];

/** The message key of a schedule refusal (`broadcast.below_minimum` → `below_minimum`). */
export const problemKey = (code: ScheduleProblem) => code.slice("broadcast.".length);
