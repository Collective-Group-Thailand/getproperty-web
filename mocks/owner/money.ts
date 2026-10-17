/**
 * Money for the mock API: decimal strings in, decimal strings out, satang integers in between. The
 * mock *is* a fake engine (mocks are outside `no-money-arithmetic`), but it still never uses floats
 * for baht.
 */
export function satang(value: string | null | undefined): number {
  if (!value) return 0;
  const negative = value.trim().startsWith("-");
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".");
  const amount = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -amount : amount;
}

export function baht(satangValue: number): string {
  const negative = satangValue < 0;
  const abs = Math.abs(Math.round(satangValue));
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export const add = (...values: (string | null | undefined)[]): string =>
  baht(values.reduce((sum, value) => sum + satang(value), 0));

export const sub = (a: string, b: string): string => baht(satang(a) - satang(b));

export const mul = (value: string, factor: number): string => baht(Math.round(satang(value) * factor));

/** Meter quantities: thousandths. */
export function milli(value: string | null | undefined): number {
  if (!value) return 0;
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 1000 + Number((fraction + "000").slice(0, 3));
}

export const qty = (milliValue: number): string =>
  `${Math.floor(milliValue / 1000)}.${String(Math.abs(milliValue % 1000)).padStart(3, "0")}`;
