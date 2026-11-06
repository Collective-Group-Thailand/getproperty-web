import { decimalSatang, parseSatang } from "../accounting/money";

/**
 * Quotation rounds (D-310, D-331): the comparison table and the "three quotations" rule. The API lists quotations
 * cheapest first and decides every award; this file only orders what it sent (a defensive sort — comparing amounts,
 * never adding them) and says in which state the rule is, so the page can explain it before anyone awards.
 */

export interface QuoteLike {
  id: string;
  amount: string;
  receivedOn: string;
  validUntil: string;
}

/** Cheapest first; equal amounts by the earlier quotation; otherwise the API's order. */
export function compareQuotations<Quote extends QuoteLike>(quotations: readonly Quote[]): Quote[] {
  return quotations
    .map((quote, index) => ({ quote, index, value: decimalSatang(quote.amount) }))
    .sort((a, b) => {
      if (a.value !== null && b.value !== null && a.value !== b.value) return a.value < b.value ? -1 : 1;
      return a.quote.receivedOn.localeCompare(b.quote.receivedOn) || a.index - b.index;
    })
    .map(({ quote }) => quote);
}

/** A quotation no longer valid on `today` (Bangkok `YYYY-MM-DD`): it cannot be awarded (422 `quotation.expired`). */
export function quoteExpired(quote: Pick<QuoteLike, "validUntil">, today: string): boolean {
  return quote.validUntil < today;
}

export type QuoteRuleState =
  /** Enough quotations for any amount. */
  | "met"
  /** Fewer than the minimum and the lowest quotation is above the threshold: an award needs a recorded reason. */
  | "short"
  /** Fewer than the minimum, but every quotation is at or below the threshold: the rule does not bind. */
  | "below"
  /** Nothing quoted yet. */
  | "empty";

export interface QuoteRule {
  state: QuoteRuleState;
  count: number;
  minimum: number;
  threshold: string;
}

/**
 * Where a round stands against the rule (D-310): above `threshold` an award needs `minimumQuotations` quotations or a
 * reason. "short" when the cheapest quotation is already above the threshold (any award will be), "below" when even
 * the dearest is not (none will be); in between the award dialog decides per quotation (`awardNeedsReason`).
 */
export function quoteRule(round: {
  quotations: readonly Pick<QuoteLike, "amount">[];
  threshold: string;
  minimumQuotations: number;
}): QuoteRule {
  const count = round.quotations.length;
  const base = { count, minimum: round.minimumQuotations, threshold: round.threshold };
  if (count === 0) return { ...base, state: "empty" };
  if (count >= round.minimumQuotations) return { ...base, state: "met" };
  const limit = decimalSatang(round.threshold);
  const values = round.quotations.map((quote) => decimalSatang(quote.amount)).filter((v): v is bigint => v !== null);
  if (limit === null || values.length === 0) return { ...base, state: "short" };
  const anyAbove = values.some((value) => value > limit);
  return { ...base, state: anyAbove ? "short" : "below" };
}

/**
 * Whether awarding this amount needs `fewerQuotationsReason` (422 `quotation.minimum_not_met`): strictly above the
 * threshold and fewer quotations than the minimum. Amounts are the API's decimal strings (or a typed amount).
 */
export function awardNeedsReason(input: {
  amount: string;
  threshold: string;
  count: number;
  minimum: number;
}): boolean {
  if (input.count >= input.minimum) return false;
  const amount = decimalSatang(input.amount) ?? parseSatang(input.amount);
  const limit = decimalSatang(input.threshold);
  if (amount === null || limit === null) return true;
  return amount > limit;
}

/** The reason's own limits (QuotationAwardDto: 10–1000 characters). */
export const REASON_MIN = 10;
export const REASON_MAX = 1000;

export function reasonProblem(reason: string): "short" | "long" | null {
  const length = reason.trim().length;
  if (length < REASON_MIN) return "short";
  if (length > REASON_MAX) return "long";
  return null;
}
