/**
 * The utility tariff structure (getproperty-api `src/core/utility-tariffs/tariff-structure.ts`, schema
 * design §4.2.1) as the contract publishes it: `structure: object`. The editor builds one from what
 * the maker typed — strings exactly as the utility publishes them, never derived — and the diff
 * compares two versions value by value. No arithmetic on any rate happens here (CLAUDE.md).
 */
export interface TariffTier {
  fromUnits: string;
  toUnits: string | null;
  pricePerUnit: string;
}

export interface TariffStructure {
  kind: "tiered" | "flat" | "tou";
  unit: "kwh" | "m3";
  currency: "THB";
  tiers?: TariffTier[] | null;
  flatPricePerUnit?: string | null;
  tou?: {
    onPeak: { pricePerUnit: string; window?: string };
    offPeak: { pricePerUnit: string; window?: string };
  } | null;
  ft?: { pricePerUnit: string; period: string; sourceUrl?: string } | null;
  serviceCharge?: { amount: string; basis: "per_month" } | null;
  minimumCharge?: { amount: string } | null;
  vat: { rate: string; included: boolean };
  ceilingPerUnit: string;
  capBasis: "effective_average_rate";
  needsCheck?: string[];
  notes_th?: string;
  notes_en?: string;
}

/** The structure object of a version, typed for reading (unknown fields are kept by the diff). */
export function asStructure(value: unknown): Partial<TariffStructure> {
  return value && typeof value === "object" ? (value as Partial<TariffStructure>) : {};
}

export interface StructureDraft {
  kind: "tiered" | "flat";
  tiers: { toUnits: string; pricePerUnit: string }[];
  flatPricePerUnit: string;
  ftPricePerUnit: string;
  ftPeriod: string;
  serviceCharge: string;
  minimumCharge: string;
  vatRate: string;
  vatIncluded: boolean;
  ceilingPerUnit: string;
  needsCheck: string;
}

const DECIMAL = /^-?\d{1,6}(\.\d{1,6})?$/;

/** The draft of the editor from an existing structure (to start a new version from the one in force). */
export function draftFrom(structure: Partial<TariffStructure> | null): StructureDraft {
  const tiers = structure?.tiers ?? [];
  return {
    kind: structure?.kind === "flat" ? "flat" : "tiered",
    tiers: tiers.length
      ? tiers.map((tier) => ({ toUnits: tier.toUnits ?? "", pricePerUnit: tier.pricePerUnit }))
      : [{ toUnits: "", pricePerUnit: "" }],
    flatPricePerUnit: structure?.flatPricePerUnit ?? "",
    ftPricePerUnit: structure?.ft?.pricePerUnit ?? "",
    ftPeriod: structure?.ft?.period ?? "",
    serviceCharge: structure?.serviceCharge?.amount ?? "",
    minimumCharge: structure?.minimumCharge?.amount ?? "",
    vatRate: structure?.vat?.rate ?? "7",
    vatIncluded: structure?.vat?.included ?? false,
    ceilingPerUnit: structure?.ceilingPerUnit ?? "",
    needsCheck: (structure?.needsCheck ?? []).join(", "),
  };
}

export type DraftProblem =
  | { field: "tiers"; index: number; problem: "price" | "to" | "order" | "lastOpen" }
  | {
      field: "flat" | "ft" | "ftPeriod" | "serviceCharge" | "minimumCharge" | "vat" | "ceiling";
      problem: "invalid" | "required";
    };

/**
 * What the maker can fix before sending (the API validates again, `tariff.invalid_structure`): each
 * tier's upper bound must be above the previous one (compared as numbers, nothing computed), only the
 * last tier is open-ended, every price is a decimal string.
 */
export function draftProblems(draft: StructureDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (draft.kind === "tiered") {
    let previous = 0;
    draft.tiers.forEach((tier, index) => {
      const last = index === draft.tiers.length - 1;
      if (!DECIMAL.test(tier.pricePerUnit)) problems.push({ field: "tiers", index, problem: "price" });
      if (last) {
        if (tier.toUnits.trim() !== "") problems.push({ field: "tiers", index, problem: "lastOpen" });
      } else if (!DECIMAL.test(tier.toUnits)) {
        problems.push({ field: "tiers", index, problem: "to" });
      } else if (Number(tier.toUnits) <= previous) {
        problems.push({ field: "tiers", index, problem: "order" });
      } else {
        previous = Number(tier.toUnits);
      }
    });
  } else if (!DECIMAL.test(draft.flatPricePerUnit)) {
    problems.push({ field: "flat", problem: draft.flatPricePerUnit ? "invalid" : "required" });
  }
  if (draft.ftPricePerUnit && !DECIMAL.test(draft.ftPricePerUnit)) problems.push({ field: "ft", problem: "invalid" });
  if (draft.ftPricePerUnit && !/^\d{4}-\d{2}/.test(draft.ftPeriod))
    problems.push({ field: "ftPeriod", problem: "required" });
  if (draft.serviceCharge && !DECIMAL.test(draft.serviceCharge))
    problems.push({ field: "serviceCharge", problem: "invalid" });
  if (draft.minimumCharge && !DECIMAL.test(draft.minimumCharge))
    problems.push({ field: "minimumCharge", problem: "invalid" });
  if (!DECIMAL.test(draft.vatRate)) problems.push({ field: "vat", problem: "invalid" });
  if (!DECIMAL.test(draft.ceilingPerUnit))
    problems.push({ field: "ceiling", problem: draft.ceilingPerUnit ? "invalid" : "required" });
  return problems;
}

/** The structure to send: tiers chained by copying each upper bound as the next lower bound (strings). */
export function structureFrom(draft: StructureDraft, unit: "kwh" | "m3"): TariffStructure {
  const tiers: TariffTier[] = [];
  let from = "0";
  for (const [index, tier] of draft.tiers.entries()) {
    const last = index === draft.tiers.length - 1;
    const to = last ? null : tier.toUnits.trim();
    tiers.push({ fromUnits: from, toUnits: to, pricePerUnit: tier.pricePerUnit.trim() });
    from = to ?? from;
  }
  const needsCheck = draft.needsCheck
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
  return {
    kind: draft.kind,
    unit,
    currency: "THB",
    tiers: draft.kind === "tiered" ? tiers : null,
    flatPricePerUnit: draft.kind === "flat" ? draft.flatPricePerUnit.trim() : null,
    ft: draft.ftPricePerUnit ? { pricePerUnit: draft.ftPricePerUnit.trim(), period: draft.ftPeriod.trim() } : null,
    serviceCharge: draft.serviceCharge ? { amount: draft.serviceCharge.trim(), basis: "per_month" } : null,
    minimumCharge: draft.minimumCharge ? { amount: draft.minimumCharge.trim() } : null,
    vat: { rate: draft.vatRate.trim(), included: draft.vatIncluded },
    ceilingPerUnit: draft.ceilingPerUnit.trim(),
    capBasis: "effective_average_rate",
    ...(needsCheck.length ? { needsCheck } : {}),
  };
}

export interface DiffRow {
  path: string;
  before: string | null;
  after: string | null;
}

function flatten(value: unknown, prefix: string, out: Map<string, string>) {
  if (value === null || value === undefined) {
    if (prefix) out.set(prefix, "—");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0 && prefix) out.set(prefix, "[]");
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, String(value));
}

/** Every value that differs between two structures, by JSON path (`tiers[1].pricePerUnit`), in path order. */
export function diffStructures(before: unknown, after: unknown): DiffRow[] {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  flatten(before, "", a);
  flatten(after, "", b);
  const paths = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x.localeCompare(y, "en", { numeric: true }));
  return paths
    .filter((path) => a.get(path) !== b.get(path))
    .map((path) => ({ path, before: a.get(path) ?? null, after: b.get(path) ?? null }));
}
