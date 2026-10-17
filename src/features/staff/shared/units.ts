import type { Schemas } from "@/lib/api/types";

/** The formatter's unit for a utility (`formatUnits`: kWh, m³). */
export function meterUnit(utility: Schemas["Utility"]): "kWh" | "m3" {
  return utility === "electric" ? "kWh" : "m3";
}

/** The formatter's unit for the API's `MeterUnit` (`kwh`, `m3`). */
export function readingUnit(unit: Schemas["MeterUnit"]): "kWh" | "m3" {
  return unit === "kwh" ? "kWh" : "m3";
}

/**
 * A 0–1 ratio from the API (`"0.950"`, OCR confidence) as a percentage string (`"95"`), by moving the
 * decimal point — no float arithmetic on an API decimal.
 */
export function ratioToPercent(ratio: string): string | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(ratio.trim());
  if (!match) return null;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const whole = `${match[1]}${fraction.slice(0, 2)}`.replace(/^0+(?=\d)/, "");
  const rest = fraction.slice(2).replace(/0+$/, "").slice(0, 1);
  return rest ? `${whole}.${rest}` : whole;
}
