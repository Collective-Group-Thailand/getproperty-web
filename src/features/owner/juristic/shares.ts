/**
 * Ownership shares as the register keeps them (D-323): percent as a decimal string with up to four decimals. The
 * console checks what the owner types before sending — each share is a number in (0, 100] and the shares of a unit
 * never pass 100 — and the API checks again (`register.shares_exceeded`). Shares are not money: they are compared in
 * whole ten-thousandths of a percent (integers), never as floats.
 */

const SHARE = /^(100(\.0{1,4})?|\d{1,2}(\.\d{1,4})?)$/;
/** 100 % in ten-thousandths of a percent. */
export const WHOLE = 1_000_000;

/** A typed share in ten-thousandths of a percent (`"33.3333"` → 333333), or `null` when it is not a share. */
export function parseShare(text: string): number | null {
  const value = text.trim().replace(/%$/, "").trim();
  if (!SHARE.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));
}

/** Ten-thousandths of a percent back to the API's string (`600000` → `"60"`, `333333` → `"33.3333"`). */
export function shareString(parts: number): string {
  const whole = Math.floor(parts / 10_000);
  const fraction = String(parts % 10_000)
    .padStart(4, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/** The API's `"60.0000"` as people read it: `60`. */
export function formatShare(value: string): string {
  const parts = parseShare(value);
  return parts === null ? value : shareString(parts);
}

export type ShareError = "format" | "zero";
export type TotalState = "complete" | "under" | "over";

export interface ShareCheck {
  /** Per row: what is wrong with the typed share, or `null`. */
  errors: (ShareError | null)[];
  /** Σ of the valid rows plus the shares already on the unit, in ten-thousandths. */
  total: number;
  state: TotalState;
  /** What is left to 100 % (0 when complete or over). */
  remaining: number;
  /** True when every row is a share and the total does not pass 100 %. */
  ok: boolean;
}

/**
 * Checks typed shares against what the unit already holds (`existing`, e.g. the current owners when adding one; 0 for
 * a whole-unit transfer, where every current owner leaves). Under 100 % is allowed — the register is then incomplete
 * and the unit's common-fee drafts wait (`ownership_shares_incomplete`) — over 100 % is not.
 */
export function checkShares(typed: readonly string[], existing = 0): ShareCheck {
  const errors = typed.map((text): ShareError | null => {
    const parts = parseShare(text);
    if (parts === null) return "format";
    return parts === 0 ? "zero" : null;
  });
  const total = existing + typed.reduce((sum, text, index) => (errors[index] ? sum : sum + (parseShare(text) ?? 0)), 0);
  const state: TotalState = total === WHOLE ? "complete" : total < WHOLE ? "under" : "over";
  return {
    errors,
    total,
    state,
    remaining: Math.max(0, WHOLE - total),
    ok: errors.every((error) => error === null) && state !== "over",
  };
}

/**
 * Splits 100 % evenly over `count` buyers as strings the API accepts (4 decimals), the remainder on the first — the
 * wizard's "แบ่งเท่ากัน" suggestion, editable afterwards.
 */
export function evenShares(count: number): string[] {
  if (count < 1) return [];
  const base = Math.floor(WHOLE / count);
  return Array.from({ length: count }, (_, index) => shareString(index === 0 ? WHOLE - base * (count - 1) : base));
}
