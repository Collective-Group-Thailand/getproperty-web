/*
 * Arithmetic of the public free tools (D-271). These are illustrative estimates for a visitor's own records, run in
 * the browser — the product's real bills are computed by the API. Every value is a decimal string in and out, and the
 * maths is done on integers (hundredths) so 0.1 + 0.2 never shows up on a page.
 */

/** Parses "1,234.5" → 123450 hundredths; null when it is not a non-negative number with ≤ 2 decimals. */
export function toHundredths(input: string): bigint | null {
  const clean = input.replace(/[,\s]/g, "");
  const match = /^(\d{1,12})(?:\.(\d{0,2}))?$/.exec(clean);
  if (!match) return null;
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
}

/** 123450 hundredths → "1234.50". */
export function fromHundredths(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

/** a × b where both are in hundredths, rounded half up back to hundredths. */
function multiply(a: bigint, b: bigint): bigint {
  const product = a * b;
  return product >= 0n ? (product + 50n) / 100n : -((-product + 50n) / 100n);
}

export interface MeterInput {
  previous: string;
  current: string;
  rate: string;
  /** Charged when the usage costs less than this (a minimum bill); "" for none. */
  minimum: string;
}

export interface MeterResult {
  units: string;
  usageCost: string;
  charged: string;
  minimumApplied: boolean;
}

/** One meter on one bill: units = current − previous; cost = units × rate, never below the minimum. */
export function meterCharge(input: MeterInput): MeterResult | { error: "invalid" | "backwards" } {
  const previous = toHundredths(input.previous);
  const current = toHundredths(input.current);
  const rate = toHundredths(input.rate);
  const minimum = input.minimum.trim() === "" ? 0n : toHundredths(input.minimum);
  if (previous === null || current === null || rate === null || minimum === null) return { error: "invalid" };
  if (current < previous) return { error: "backwards" };
  const units = current - previous;
  const usageCost = multiply(units, rate);
  const charged = usageCost < minimum ? minimum : usageCost;
  return {
    units: fromHundredths(units),
    usageCost: fromHundredths(usageCost),
    charged: fromHundredths(charged),
    minimumApplied: charged !== usageCost,
  };
}

/** Sum of decimal strings; null when any is invalid. Empty strings count as zero. */
export function sum(values: string[]): string | null {
  let total = 0n;
  for (const value of values) {
    if (value.trim() === "") continue;
    const parsed = toHundredths(value);
    if (parsed === null) return null;
    total += parsed;
  }
  return fromHundredths(total);
}

export interface YieldInput {
  price: string;
  monthlyRent: string;
  /** Yearly costs: common fee, insurance, repairs, land & building tax… */
  yearlyCosts: string;
  /** Expected empty months per year (0–12). */
  vacantMonths: string;
}

export interface YieldResult {
  yearlyRent: string;
  netIncome: string;
  /** Percent with two decimals, as a string ("5.25"). */
  grossYield: string;
  netYield: string;
  /** Years to earn the price back from net income; null when net income ≤ 0. */
  paybackYears: string | null;
}

/** Gross and net rental yield. Percentages are rounded half up to two decimals. */
export function rentalYield(input: YieldInput): YieldResult | { error: "invalid" } {
  const price = toHundredths(input.price);
  const rent = toHundredths(input.monthlyRent);
  const costs = input.yearlyCosts.trim() === "" ? 0n : toHundredths(input.yearlyCosts);
  const vacant = /^\d{1,2}$/.test(input.vacantMonths.trim() || "0") ? BigInt(input.vacantMonths.trim() || "0") : null;
  if (price === null || rent === null || costs === null || vacant === null || price === 0n || vacant > 12n) {
    return { error: "invalid" };
  }
  const yearlyRent = rent * (12n - vacant);
  const net = yearlyRent - costs;
  const percent = (part: bigint) => {
    // part / price × 100, in hundredths of a percent, half up.
    const scaled = part * 10000n;
    const q = scaled >= 0n ? (scaled + price / 2n) / price : -((-scaled + price / 2n) / price);
    return fromHundredths(q);
  };
  const payback = net > 0n ? fromHundredths((price * 100n + net / 2n) / net) : null;
  return {
    yearlyRent: fromHundredths(yearlyRent),
    netIncome: fromHundredths(net),
    grossYield: percent(rent * 12n),
    netYield: percent(net),
    paybackYears: payback,
  };
}
