import type { Locale } from "./routing";

/**
 * Formatters for the values the API hands us. Two rules run through all of them (CLAUDE.md):
 *
 * 1. **Money and meter quantities are decimal strings.** They are never parsed into a number to be
 *    added, subtracted or rounded — binary floating point cannot hold 0.1, and a baht is not ours to
 *    lose. The API computes every total and every consumption; this only renders them.
 * 2. **Dates are rendered in Asia/Bangkok**, in the Buddhist era for owners and residents, wherever
 *    the reader happens to be; ISO in exports.
 */

export const TIME_ZONE = "Asia/Bangkok";

/** Buddhist era is 543 years ahead of the Common Era. */
const BE_OFFSET = 543;

const localeTag = (locale: Locale) => (locale === "th" ? "th-TH" : "en-GB");

/**
 * `th-TH` defaults to the Buddhist calendar in `Intl`, so the year would be shifted twice — once by
 * Intl and once by us. Pinning `ca-gregory` makes the era an explicit choice per call site.
 */
const dateTag = (locale: Locale) => (locale === "th" ? "th-TH-u-ca-gregory" : "en-GB");

const DECIMAL = /^-?\d+(\.\d+)?$/;

/** Splits a decimal string into sign, grouped whole part and raw fraction — as text, no arithmetic. */
function splitDecimal(
  value: string | number,
  locale: Locale,
): { negative: boolean; whole: string; fraction: string } | null {
  const text = typeof value === "string" ? value.trim() : String(value);
  if (text === "" || !DECIMAL.test(text)) return null;
  const [whole, fraction = ""] = text.replace("-", "").split(".") as [string, string?];
  return {
    negative: text.startsWith("-") && /[1-9]/.test(text),
    whole: new Intl.NumberFormat(localeTag(locale)).format(BigInt(whole)),
    fraction,
  };
}

/**
 * `฿1,234.56` with tabular figures (the caller applies `.tabular-nums`).
 *
 * Takes the API's decimal string as-is. A value with more precision than two decimals is shown
 * truncated for display only — the string the API sent stays the truth.
 */
export function formatTHB(
  amount: string | number,
  locale: Locale = "th",
  options: { withSymbol?: boolean; decimals?: number } = {},
): string {
  const { withSymbol = true, decimals = 2 } = options;
  const parts = splitDecimal(amount, locale);
  // A malformed amount must never render as "NaN" in front of a resident.
  if (!parts) return withSymbol ? "฿—" : "—";
  const fraction = decimals > 0 ? `.${parts.fraction.padEnd(decimals, "0").slice(0, decimals)}` : "";
  return `${parts.negative ? "-" : ""}${withSymbol ? "฿" : ""}${parts.whole}${fraction}`;
}

export type MeterUnit = "kWh" | "m3";

const UNIT_LABEL: Record<MeterUnit, string> = { kWh: "kWh", m3: "m³" };

/**
 * A metered quantity — `123.456 kWh`, `12.5 m³` — from the API's decimal string: up to three decimals,
 * trailing zeros trimmed, never arithmetic (design-system.md §4).
 */
export function formatUnits(
  value: string | number,
  unit: MeterUnit,
  locale: Locale = "th",
  options: { maxDecimals?: number; withUnit?: boolean } = {},
): string {
  const { maxDecimals = 3, withUnit = true } = options;
  const parts = splitDecimal(value, locale);
  if (!parts) return "—";
  const shown = parts.fraction.slice(0, maxDecimals).replace(/0+$/, "");
  const number = `${parts.negative ? "-" : ""}${parts.whole}${shown ? `.${shown}` : ""}`;
  return withUnit ? `${number} ${UNIT_LABEL[unit]}` : number;
}

/** A plain count — units, residents, days. */
export function formatNumber(value: number, locale: Locale = "th", options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeTag(locale), options).format(value);
}

/** A percentage the API sent as a decimal string (`"12.5000"` → `12.5%`), trimmed as text. */
export function formatPercent(value: string | number, locale: Locale = "th", maxDecimals = 2): string {
  const text = formatDecimal(value, locale, maxDecimals);
  return text === "—" ? text : `${text}%`;
}

/** A plain decimal the API sent (a score, a ratio, months) — grouped, trailing zeros trimmed, as text. */
export function formatDecimal(value: string | number, locale: Locale = "th", maxDecimals = 2): string {
  const parts = splitDecimal(value, locale);
  if (!parts) return "—";
  const shown = parts.fraction.slice(0, maxDecimals).replace(/0+$/, "");
  return `${parts.negative ? "-" : ""}${parts.whole}${shown ? `.${shown}` : ""}`;
}

type DateInput = string | number | Date;

function toDate(input: DateInput): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface DateFormatOptions {
  /** `be` renders the Buddhist era, `ce` the Common Era. Thai defaults to `be`; English to `ce`. */
  era?: "be" | "ce";
  /**
   * `short` → 17 ก.ย. 2569 · `long` → 17 กันยายน 2569 · `numeric` → 17/09/2569 · `month` → ก.ย. 2569 ·
   * `dayMonth` → 17 ก.ย.
   */
  style?: "short" | "long" | "numeric" | "month" | "dayMonth";
}

/**
 * A date in Bangkok time. The year is shifted for the Buddhist era rather than relying on
 * `th-TH-u-ca-buddhist`, so the era is an explicit decision per call site — an export needs CE even
 * for a Thai reader.
 */
export function formatDate(input: DateInput, locale: Locale = "th", options: DateFormatOptions = {}): string {
  const date = toDate(input);
  if (!date) return "—";

  const { era = locale === "th" ? "be" : "ce", style = "short" } = options;

  const parts = new Intl.DateTimeFormat(dateTag(locale), {
    timeZone: TIME_ZONE,
    ...(style === "month" ? {} : { day: "numeric" as const }),
    month: style === "numeric" ? "2-digit" : style === "long" ? "long" : "short",
    ...(style === "dayMonth" ? {} : { year: "numeric" as const }),
  }).formatToParts(date);

  return parts
    .map((part) => {
      if (part.type !== "year") return part.value;
      const year = Number(part.value);
      return String(era === "be" ? year + BE_OFFSET : year);
    })
    .join("");
}

/**
 * A billing period key of the API (`YYYY-MM`, the cut-off month) as people read it — `ต.ค. 2569`,
 * `Oct 2026`. A malformed key is shown as it came.
 */
export function formatPeriodKey(
  key: string,
  locale: Locale = "th",
  options: Pick<DateFormatOptions, "era"> = {},
): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  return formatDate(`${key}-15T12:00:00+07:00`, locale, { ...options, style: "month" });
}

/** A date with the time, for audit trails and timelines. */
export function formatDateTime(input: DateInput, locale: Locale = "th", options: DateFormatOptions = {}): string {
  const date = toDate(input);
  if (!date) return "—";

  const time = new Intl.DateTimeFormat(dateTag(locale), {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatDate(date, locale, options)} ${time}`;
}

/** The time of day in Bangkok (`18:00`) — the end of a slot whose date is already on screen. */
export function formatTime(input: DateInput, locale: Locale = "th"): string {
  const date = toDate(input);
  if (!date) return "—";
  return new Intl.DateTimeFormat(dateTag(locale), {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** ISO 8601 (YYYY-MM-DD) in Bangkok time, for CSV and XLSX exports. Never shown in the UI. */
export function formatIsoDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * "5 นาทีที่แล้ว" / "in 2 hours" — for feeds and timelines, always shown next to (or with a tooltip of)
 * the absolute time, never instead of it (design-system.md §4). `now` is a parameter so a render and
 * its test agree on what "now" was.
 */
export function formatRelativeTime(input: DateInput, locale: Locale = "th", now: number = Date.now()): string {
  const date = toDate(input);
  if (!date) return "—";

  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  const format = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });

  if (abs < 45) return format.format(0, "second");
  if (abs < 45 * 60) return format.format(Math.round(seconds / 60), "minute");
  if (abs < 22 * 3600) return format.format(Math.round(seconds / 3600), "hour");
  if (abs < 26 * 86400) return format.format(Math.round(seconds / 86400), "day");
  if (abs < 320 * 86400) return format.format(Math.round(seconds / (30 * 86400)), "month");
  return format.format(Math.round(seconds / (365 * 86400)), "year");
}

/** Thai phone numbers as people read them: `081-234-5678`; a `+66` number is shown nationally. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("66") && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  if (national.length === 10) return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
  if (national.length === 9) return `${national.slice(0, 2)}-${national.slice(2, 5)}-${national.slice(5)}`;
  return value;
}
