/**
 * Rate plan tiers as the billing engine reads them (schema-design §4.2.2) — built from what the owner
 * typed and described back for the table. Only shapes and strings: the console never prices anything.
 */
export type TierRow = { upTo: string; pricePerUnit: string };

export type RateTiers =
  | { kind: "flat"; pricePerUnit: string; unit?: string }
  | { kind: "tiered"; tiers: { fromUnits: string; toUnits: string | null; pricePerUnit: string }[]; unit?: string }
  | { kind: "fixed"; amount: string }
  | { kind: "budget"; amount: string };

const DECIMAL = /^\d{1,8}(\.\d{1,4})?$/;

/** The unit a utility plan is priced in. */
export function unitOf(kind: string): "kwh" | "m3" | undefined {
  return kind === "power" ? "kwh" : kind === "water" ? "m3" : undefined;
}

/**
 * The `tiers` object of a new version, or the name of the first problem: a flat price per unit, tiers
 * that each start where the previous one ended (the last open-ended), or a fixed amount.
 */
export function buildTiers(
  input: { mode: "flat"; price: string } | { mode: "tiered"; rows: TierRow[] } | { mode: "fixed"; amount: string },
  planKind: string,
): { tiers: RateTiers } | { error: "price" | "rows" | "order" | "amount" } {
  const unit = unitOf(planKind);
  if (input.mode === "flat") {
    if (!DECIMAL.test(input.price.trim())) return { error: "price" };
    return { tiers: { kind: "flat", pricePerUnit: input.price.trim(), ...(unit ? { unit } : {}) } };
  }
  if (input.mode === "fixed") {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(input.amount.trim())) return { error: "amount" };
    return { tiers: { kind: "fixed", amount: input.amount.trim() } };
  }
  const rows = input.rows.filter((row) => row.upTo.trim() !== "" || row.pricePerUnit.trim() !== "");
  if (rows.length === 0 || rows.some((row) => !DECIMAL.test(row.pricePerUnit.trim()))) return { error: "rows" };
  const tiers: { fromUnits: string; toUnits: string | null; pricePerUnit: string }[] = [];
  let from = "0";
  for (const [index, row] of rows.entries()) {
    const last = index === rows.length - 1;
    const upTo = row.upTo.trim();
    if (!last && !DECIMAL.test(upTo)) return { error: "rows" };
    if (last && upTo !== "" && !DECIMAL.test(upTo)) return { error: "rows" };
    if (upTo !== "" && Number(upTo) <= Number(from)) return { error: "order" };
    tiers.push({ fromUnits: from, toUnits: upTo === "" ? null : upTo, pricePerUnit: row.pricePerUnit.trim() });
    from = upTo;
  }
  return { tiers: { kind: "tiered", tiers, ...(unit ? { unit } : {}) } };
}

/** A version's tiers as lines to read ("0–150: 4.0000 / unit", "flat 7.0000"), from the API's object as stored. */
export function describeTiers(tiers: unknown): { label: string; price: string }[] {
  const value = tiers as Partial<Record<string, unknown>> | null;
  if (!value || typeof value !== "object") return [];
  switch (value.kind) {
    case "flat":
      return [{ label: "flat", price: String(value.pricePerUnit ?? "") }];
    case "tiered":
      return (Array.isArray(value.tiers) ? value.tiers : []).map(
        (tier: { fromUnits?: unknown; toUnits?: unknown; pricePerUnit?: unknown }) => ({
          label: `${String(tier.fromUnits ?? "0")}–${tier.toUnits === null || tier.toUnits === undefined ? "∞" : String(tier.toUnits)}`,
          price: String(tier.pricePerUnit ?? ""),
        }),
      );
    case "fixed":
    case "budget":
      return [{ label: String(value.kind), price: String(value.amount ?? "") }];
    default:
      return [];
  }
}
