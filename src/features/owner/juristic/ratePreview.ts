import type { Schemas } from "@/lib/api/types";

type Preview = Schemas["RatePreviewDto"];

/**
 * What the basis preview shows (J-DESIGN §4 "Basis preview"): the smallest, median and largest amount one unit pays a
 * cycle and whether the units add up to the budget's cycle amount. Every amount is the API's string — this only picks
 * and labels them; the Σ check is the API's `sumMatches`, never a sum done here.
 */
export interface PreviewRow {
  key: "min" | "median" | "max";
  amount: string;
}

export type PreviewCheck =
  /** Σ units = the cycle amount to the satang ("รวม = งบ ✓"). */
  | { state: "match"; sum: string; cycleAmount: string }
  /** Units without the weight (ratio, m², ตร.วา): nobody can be billed until they have it. */
  | { state: "missing"; missing: number; sum: string; cycleAmount: string }
  /** The API says the units do not add up (should not happen; shown, never hidden). */
  | { state: "mismatch"; sum: string; cycleAmount: string };

export interface PreviewDisplay {
  rows: PreviewRow[];
  check: PreviewCheck;
  unitsCount: number;
  /** A draft may be created only when nothing is missing and the units add up. */
  canDraft: boolean;
  /** The few units at either end, for "who pays least / most" (the API's order: by amount ascending). */
  lowest: Schemas["RatePreviewUnitDto"][];
  highest: Schemas["RatePreviewUnitDto"][];
}

/** Compares two decimal strings with two decimals without floats (`"1200.50"` vs `"999.99"`). */
export function compareAmounts(a: string, b: string): number {
  const cents = (value: string) => {
    const negative = value.trim().startsWith("-");
    const [whole = "0", fraction = ""] = value.trim().replace(/^-/, "").split(".");
    const digits = `${whole.replace(/^0+(?=\d)/, "")}${fraction.padEnd(2, "0").slice(0, 2)}`;
    return { negative, digits: digits.replace(/^0+(?=\d)/, "") };
  };
  const x = cents(a);
  const y = cents(b);
  if (x.negative !== y.negative) return x.negative ? -1 : 1;
  const sign = x.negative ? -1 : 1;
  if (x.digits.length !== y.digits.length) return sign * (x.digits.length - y.digits.length);
  return sign * (x.digits < y.digits ? -1 : x.digits > y.digits ? 1 : 0);
}

export function previewDisplay(preview: Preview, ends = 3): PreviewDisplay {
  const rows: PreviewRow[] = [
    { key: "min", amount: preview.min },
    { key: "median", amount: preview.median },
    { key: "max", amount: preview.max },
  ];
  const missing = preview.missingUnitIds.length;
  const check: PreviewCheck =
    missing > 0
      ? { state: "missing", missing, sum: preview.sum, cycleAmount: preview.cycleAmount }
      : preview.sumMatches
        ? { state: "match", sum: preview.sum, cycleAmount: preview.cycleAmount }
        : { state: "mismatch", sum: preview.sum, cycleAmount: preview.cycleAmount };
  const sorted = [...preview.units].sort(
    (a, b) => compareAmounts(a.amount, b.amount) || a.unitNo.localeCompare(b.unitNo, "th"),
  );
  return {
    rows,
    check,
    unitsCount: preview.unitsCount,
    canDraft: check.state === "match",
    lowest: sorted.slice(0, Math.min(ends, sorted.length)),
    highest: sorted.length > ends ? sorted.slice(-Math.min(ends, sorted.length - ends)).reverse() : [],
  };
}

/** The split bases a budget can be billed by, and which property kinds they suit (the picker's order). */
export const SPLIT_BY: readonly Schemas["BudgetSplitBy"][] = [
  "ownership_ratio",
  "area_sqm",
  "land_area_sqwa",
  "per_unit",
];

/** The first basis to suggest: the ratio for a condominium, the land for an estate, else floor area. */
export function suggestedSplit(kind: Schemas["PropertyKind"] | null | undefined): Schemas["BudgetSplitBy"] {
  if (kind === "village" || kind === "community") return "land_area_sqwa";
  if (kind === "condo" || kind === "mixed") return "ownership_ratio";
  return "area_sqm";
}
