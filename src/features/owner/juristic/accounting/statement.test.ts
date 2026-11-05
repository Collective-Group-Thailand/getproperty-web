import { describe, expect, it } from "vitest";

import { formatTHB } from "@/i18n/format";

import {
  parseGranularity,
  parseYear,
  periodColumn,
  readerYear,
  statementFigure,
  statementRange,
  statementRows,
  yearOptions,
} from "./statement";

const plain = (value: string) => formatTHB(value, "th", { withSymbol: false });

describe("statement periods", () => {
  it("asks for the calendar year, or three years for the yearly view", () => {
    expect(statementRange(2026, "month")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(statementRange(2026, "quarter")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(statementRange(2026, "year")).toEqual({ from: "2024-01-01", to: "2026-12-31" });
  });
  it("names columns by granularity in the reader's calendar", () => {
    expect(periodColumn("2026-01", "th")).toBe("ม.ค.");
    expect(periodColumn("2026-10", "en")).toBe("Oct");
    expect(periodColumn("2026-Q3", "th")).toBe("ไตรมาส 3");
    expect(periodColumn("2026-Q3", "en")).toBe("Q3");
    expect(periodColumn("2026", "th")).toBe("2569");
    expect(periodColumn("2026", "en")).toBe("2026");
    expect(periodColumn("weird", "th")).toBe("weird");
  });
  it("reads the switches from the query", () => {
    expect(parseGranularity("quarter")).toBe("quarter");
    expect(parseGranularity("week")).toBe("month");
    expect(parseYear("2025", "2026-11-06")).toBe(2025);
    expect(parseYear("1999", "2026-11-06")).toBe(2026);
    expect(parseYear(undefined, "2026-11-06")).toBe(2026);
    expect(yearOptions("2026-11-06", 3)).toEqual([2026, 2025, 2024]);
    expect(readerYear(2026, "th")).toBe("2569");
  });
});

describe("statement figures", () => {
  it("writes negatives in parentheses and zero as a dash, totals keep 0.00", () => {
    expect(statementFigure("1234.50", plain)).toBe("1,234.50");
    expect(statementFigure("-1234.50", plain)).toBe("(1,234.50)");
    expect(statementFigure("0.00", plain)).toBe("–");
    expect(statementFigure("0.00", plain, { zero: "figure" })).toBe("0.00");
  });
  it("lays out income, expense and the surplus with a total column", () => {
    const section = (amounts: string[], total: string) => ({
      accounts: [{ accountId: "a", code: "4110", nameTh: "รายได้ค่าส่วนกลาง", nameEn: "Common fee", amounts, total }],
      byPeriod: amounts,
      total,
    });
    const rows = statementRows(
      {
        income: section(["100.00", "0.00"], "100.00"),
        expense: section(["40.00", "80.00"], "120.00"),
        surplusByPeriod: ["60.00", "-80.00"],
        surplus: "-20.00",
      },
      {
        income: "รายได้",
        incomeTotal: "รวมรายได้",
        expense: "ค่าใช้จ่าย",
        expenseTotal: "รวมค่าใช้จ่าย",
        surplus: "ส่วนเกิน",
      },
      "th",
      plain,
    );
    expect(rows.map((row) => row.kind)).toEqual([
      "heading",
      "line",
      "subtotal",
      "heading",
      "line",
      "subtotal",
      "result",
    ]);
    expect(rows[1]).toMatchObject({ code: "4110", values: ["100.00", "–", "100.00"] });
    expect(rows[2]!.values).toEqual(["100.00", "0.00", "100.00"]);
    expect(rows.at(-1)!.values).toEqual(["60.00", "(80.00)", "(20.00)"]);
  });
});
