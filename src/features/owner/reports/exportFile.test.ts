import { describe, expect, it } from "vitest";

import { exportFileName } from "./exportFile";

describe("exportFileName", () => {
  it("names the file by kind, period and format", () => {
    expect(
      exportFileName({ kind: "income_expense", params: { period: "2026-10" }, requestedAt: "2026-11-01T02:00:00Z" }),
    ).toBe("income_expense-2026-10.xlsx");
    expect(
      exportFileName({ kind: "flowaccount_csv", params: { period: "2026-10" }, requestedAt: "2026-11-01T02:00:00Z" }),
    ).toBe("flowaccount_csv-2026-10.csv");
  });

  it("falls back to the as-of date, then the request day", () => {
    expect(
      exportFileName({ kind: "arrears_xlsx", params: { asOf: "2026-11-30" }, requestedAt: "2026-12-01T00:00:00Z" }),
    ).toBe("arrears_xlsx-2026-11-30.xlsx");
    expect(exportFileName({ kind: "document_archive_zip", params: {}, requestedAt: "2026-12-01T00:00:00Z" })).toBe(
      "document_archive_zip-2026-12-01.zip",
    );
  });
});
