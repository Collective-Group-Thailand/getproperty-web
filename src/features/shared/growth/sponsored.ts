import { formatPercent, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";

/**
 * Formatting shared by the owner and admin screens of sponsored LINE broadcasts (G6, D-300). Text work only — the
 * amounts stay the API's decimal strings (no arithmetic on money).
 */

/**
 * The price per recipient (4 decimals from the API, "0.5000") with at least two decimals and no trailing zeros beyond
 * them: "0.50", "0.125", "1.2345".
 */
export function perRecipientDigits(price: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(price);
  if (!match) return price;
  const fraction = match[2]!.replace(/0+$/, "").padEnd(2, "0");
  return `${match[1]}.${fraction}`;
}

/** "฿0.50" — the price per recipient with only the decimals it needs (at least two). */
export function perRecipient(price: string, locale: Locale): string {
  const decimals = perRecipientDigits(price).split(".")[1]?.length ?? 2;
  return formatTHB(price, locale, { decimals });
}

/** A rate as the API sends it ("0.0700") as a percentage text ("7", "7.5") — the decimal point moved, as text. */
export function ratePercent(rate: string): string {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(rate);
  if (!match) return rate;
  // Any number of decimals ("0.07", "0.1", "1"): pad to two so the point can move two places (no float, review L3).
  const digits = (match[2] ?? "").padEnd(2, "0");
  const whole = `${match[1]}${digits.slice(0, 2)}`.replace(/^0+(?=\d)/, "");
  const fraction = digits.slice(2).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/** A VAT rate as the API sends it ("0.0725") as "7.25%" — moved as text and never through float arithmetic. */
export function vatPercent(rate: string, locale: Locale): string {
  return formatPercent(ratePercent(rate), locale);
}
