/**
 * Amounts the office **types** (a manual journal line, an approval band limit, a petty cash count) as whole satang
 * (`bigint`), so the console can check its own input — is the journal balanced, are the bands ascending — without
 * floating point. Figures the API sends are never summed here: they are formatted as they came (CLAUDE.md money rule).
 */

const TYPED = /^\d{1,12}(\.\d{1,2})?$/;

/** A typed amount in satang (`"1,250.5"` → 125050n); `null` when it is not an amount of baht. Blank → `null`. */
export function parseSatang(text: string | null | undefined): bigint | null {
  const value = (text ?? "").trim().replace(/,/g, "");
  if (!TYPED.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

/** Satang back to the API's decimal string (`125050n` → `"1250.50"`, `-5n` → `"-0.05"`). */
export function satangString(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 100n;
  const fraction = String(abs % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** A typed amount normalised for the API (`" 1,250.5 "` → `"1250.50"`); `null` when not an amount. */
export function normaliseAmount(text: string | null | undefined): string | null {
  const parsed = parseSatang(text);
  return parsed === null ? null : satangString(parsed);
}

/** An API decimal string in satang for comparisons only (`"-12.30"` → -1230n); `null` when malformed. */
export function decimalSatang(value: string): bigint | null {
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const amount = BigInt(match[2]!) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
  return match[1] ? -amount : amount;
}

/** Whether the API's decimal string is exactly zero (`"0.00"`, `"-0.00"`). */
export function isZero(value: string): boolean {
  return decimalSatang(value) === 0n;
}

/** Whether the API's decimal string is negative (money out, a shortage, a credit balance). */
export function isNegative(value: string): boolean {
  const parsed = decimalSatang(value);
  return parsed !== null && parsed < 0n;
}

/** The API's signed decimal without its sign (`"-1500.00"` → `"1500.00"`) — text only, for "money out" columns. */
export function unsigned(value: string): string {
  return value.trim().replace(/^-/, "");
}
