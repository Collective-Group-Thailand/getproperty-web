import type { Locale } from "@/i18n/routing";

/**
 * Withholding-tax rates as data (setting `juristic.wht_rates`, ⚖ O-041): a key, Thai / English label, the income type
 * printed on the 50 ทวิ, the rate in percent and whether a tax adviser has confirmed it. The console shows the API's
 * rows and marks the unconfirmed ones; it never holds a rate of its own.
 */
export interface WhtRate {
  key: string;
  labelTh: string;
  labelEn: string;
  incomeType: string;
  ratePct: string;
  verified: boolean;
}

export function parseWhtRates(value: unknown): WhtRate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): WhtRate[] => {
    if (!entry || typeof entry !== "object") return [];
    const rate = entry as Record<string, unknown>;
    if (typeof rate.key !== "string" || typeof rate.ratePct !== "string") return [];
    return [
      {
        key: rate.key,
        labelTh: typeof rate.labelTh === "string" ? rate.labelTh : rate.key,
        labelEn: typeof rate.labelEn === "string" ? rate.labelEn : rate.key,
        incomeType: typeof rate.incomeType === "string" ? rate.incomeType : "",
        ratePct: rate.ratePct,
        verified: rate.verified === true,
      },
    ];
  });
}

/** `"3.00"` → `"3"`, `"1.50"` → `"1.5"` — text only. */
export function percentText(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return value;
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return fraction ? `${match[1]}.${fraction}` : match[1]!;
}

/** "3% · ค่าบริการ / ค่าจ้างทำของ" for a select option or a line. */
export function whtRateLabel(rate: Pick<WhtRate, "ratePct" | "labelTh" | "labelEn">, locale: Locale): string {
  return `${percentText(rate.ratePct)}% · ${locale === "th" ? rate.labelTh : rate.labelEn}`;
}

/** A line's withholding as the record shows it: the snapshotted rate and income type, or none. */
export function lineWht(
  line: { whtKey: string | null; whtRatePct: string | null; whtIncomeType: string | null },
  rates: readonly WhtRate[],
): { key: string; ratePct: string; incomeType: string | null; label: WhtRate | null; verified: boolean } | null {
  if (!line.whtKey || !line.whtRatePct) return null;
  const rate = rates.find((candidate) => candidate.key === line.whtKey) ?? null;
  return {
    key: line.whtKey,
    ratePct: line.whtRatePct,
    incomeType: line.whtIncomeType,
    label: rate,
    // A key no longer in the setting cannot be shown as confirmed.
    verified: rate?.verified ?? false,
  };
}

/** Whether any of the rates in use is still unconfirmed (the record then shows the O-041 note once). */
export function anyUnverified(rates: readonly { verified: boolean }[]): boolean {
  return rates.some((rate) => !rate.verified);
}

export type WhtRateProblem = "key" | "duplicate" | "label" | "incomeType" | "rate";

/** Checks edited rates before sending (the API checks again with the same rules). */
export function checkWhtRates(rates: readonly WhtRate[]): { rows: WhtRateProblem[][]; ok: boolean } {
  const keys = new Set<string>();
  const rows = rates.map((rate) => {
    const out: WhtRateProblem[] = [];
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(rate.key)) out.push("key");
    else if (keys.has(rate.key)) out.push("duplicate");
    else keys.add(rate.key);
    if (!rate.labelTh.trim() || !rate.labelEn.trim()) out.push("label");
    if (!rate.incomeType.trim()) out.push("incomeType");
    const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(rate.ratePct.trim());
    const hundredths = match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : 0;
    if (!match || hundredths <= 0 || hundredths > 10_000) out.push("rate");
    return out;
  });
  return { rows, ok: rows.length <= 30 && rows.every((row) => row.length === 0) };
}
