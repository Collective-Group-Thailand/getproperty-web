import { describe, expect, it } from "vitest";

import { checkJournal, emptyJournalLine, journalLinesForApi, type JournalDraftLine } from "./journal";
import { decimalSatang, normaliseAmount, parseSatang, satangString } from "./money";

const line = (accountId: string, debit = "", credit = ""): JournalDraftLine => ({ accountId, debit, credit });

describe("money input", () => {
  it("reads typed baht as satang without floats", () => {
    expect(parseSatang("1,250.5")).toBe(125_050n);
    expect(parseSatang("0.1")).toBe(10n);
    expect(parseSatang("999999999999.99")).toBe(99_999_999_999_999n);
    for (const text of ["", "-5", "1.234", "abc", "1e3"]) expect(parseSatang(text)).toBeNull();
    expect(satangString(-5n)).toBe("-0.05");
    expect(normaliseAmount(" 12 ")).toBe("12.00");
    expect(decimalSatang("-12.3")).toBe(-1230n);
  });
});

describe("checkJournal", () => {
  it("is balanced when Σ debit = Σ credit over two lines or more", () => {
    const check = checkJournal([line("cash", "1000"), line("bank", "", "600.50"), line("fee", "", "399.50")]);
    expect(check).toMatchObject({ debit: "1000.00", credit: "1000.00", difference: "0.00", balanced: true, ok: true });
    expect(check.counted).toBe(3);
  });
  it("refuses an unbalanced journal and says by how much", () => {
    const check = checkJournal([line("cash", "1000"), line("bank", "", "999.99")]);
    expect(check.balanced).toBe(false);
    expect(check.difference).toBe("0.01");
    expect(check.problems).toEqual(["unbalanced"]);
    expect(check.ok).toBe(false);
  });
  it("refuses a one-sided or single-line journal", () => {
    expect(checkJournal([line("cash", "10"), line("bank", "10")]).problems).toContain("unbalanced");
    expect(checkJournal([line("cash", "10")]).problems).toEqual(["lines", "unbalanced"]);
    expect(checkJournal([emptyJournalLine(), emptyJournalLine()]).problems).toEqual(["lines", "unbalanced"]);
  });
  it("flags each wrong line and ignores blank ones", () => {
    const check = checkJournal([
      line("cash", "10", "10"),
      line("bank", "0"),
      line("", "5"),
      line("fee", "1.234"),
      emptyJournalLine(),
    ]);
    expect(check.lineErrors).toEqual(["both", "none", "account", "amount", null]);
    expect(check.problems).toContain("lineErrors");
  });
  it("sends normalised amounts and leaves the empty side out", () => {
    expect(journalLinesForApi([line("cash", "1,000"), line("bank", "", "1000"), emptyJournalLine()])).toEqual([
      { accountId: "cash", debit: "1000.00" },
      { accountId: "bank", credit: "1000.00" },
    ]);
  });
});
