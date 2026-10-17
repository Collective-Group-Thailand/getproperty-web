/**
 * Decimal strings as the staff keypad types them (registers: `^\d{1,9}(\.\d{1,3})?$`). Kept apart from
 * `NumericKeypad` so a screen can validate without downloading the keypad.
 */

export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "backspace" | "clear";

export interface DecimalLimits {
  /** Digits before the decimal point (contract registers: 9). */
  maxIntegerDigits?: number;
  /** Digits after it (meter registers: 3); 0 = whole numbers only. */
  maxDecimals?: number;
}

/**
 * One key applied to a decimal string, as typed on the keypad: no leading zeros ("007" → "7"), one
 * decimal point, at most `maxIntegerDigits` + `maxDecimals` digits. A key that would break a limit is
 * ignored rather than clipped, so the value on screen is always exactly what was typed.
 */
export function applyKey(value: string, key: KeypadKey, limits: DecimalLimits = {}): string {
  const maxInt = limits.maxIntegerDigits ?? 9;
  const maxDec = limits.maxDecimals ?? 3;
  if (key === "clear") return "";
  if (key === "backspace") return value.slice(0, -1);
  const [integer = "", decimals] = value.split(".");
  if (key === ".") {
    if (maxDec === 0 || decimals !== undefined) return value;
    return `${integer || "0"}.`;
  }
  if (decimals !== undefined) return decimals.length >= maxDec ? value : `${value}${key}`;
  if (integer === "0") return key;
  return integer.length >= maxInt ? value : `${integer}${key}`;
}

/** A pasted or physically typed string reduced to what the keypad would have produced. */
export function sanitizeDecimal(raw: string, limits: DecimalLimits = {}): string {
  let value = "";
  for (const char of raw.replace(/,/g, "")) {
    if (/[0-9.]/.test(char)) value = applyKey(value, char as KeypadKey, limits);
  }
  return value;
}

/** A complete decimal string (no trailing point) — what the API's `^\d{1,9}(\.\d{1,3})?$` accepts. */
export function isCompleteDecimal(value: string, limits: DecimalLimits = {}): boolean {
  const maxInt = limits.maxIntegerDigits ?? 9;
  const maxDec = limits.maxDecimals ?? 3;
  const pattern =
    maxDec > 0 ? new RegExp(`^\\d{1,${maxInt}}(\\.\\d{1,${maxDec}})?$`) : new RegExp(`^\\d{1,${maxInt}}$`);
  return pattern.test(value);
}
