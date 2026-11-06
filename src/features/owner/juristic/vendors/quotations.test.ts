import { describe, expect, it } from "vitest";

import { awardNeedsReason, compareQuotations, quoteExpired, quoteRule, reasonProblem } from "./quotations";

const quote = (id: string, amount: string, receivedOn = "2026-11-01", validUntil = "2026-12-31") => ({
  id,
  amount,
  receivedOn,
  validUntil,
});

describe("quotation comparison", () => {
  it("orders cheapest first by the decimal value, not the text", () => {
    const ordered = compareQuotations([
      quote("a", "205440.00"),
      quote("b", "96300.00"),
      quote("c", "192600.00"),
      quote("d", "1000000.00"),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("breaks a tie by the earlier quotation, then keeps the API's order", () => {
    const ordered = compareQuotations([
      quote("late", "58850.00", "2026-11-04"),
      quote("early", "58850.00", "2026-11-02"),
      quote("same-1", "60000.00", "2026-11-03"),
      quote("same-2", "60000.00", "2026-11-03"),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(["early", "late", "same-1", "same-2"]);
  });

  it("marks a quotation past its validity on the award day", () => {
    expect(quoteExpired(quote("a", "1.00", "2026-11-01", "2026-11-05"), "2026-11-06")).toBe(true);
    expect(quoteExpired(quote("a", "1.00", "2026-11-01", "2026-11-06"), "2026-11-06")).toBe(false);
  });
});

describe("the three-quotation rule (D-310)", () => {
  const round = (amounts: string[], threshold = "50000.00") => ({
    quotations: amounts.map((amount) => ({ amount })),
    threshold,
    minimumQuotations: 3,
  });

  it("is met with three quotations whatever the amounts", () => {
    expect(quoteRule(round(["192600.00", "205440.00", "230000.00"]))).toMatchObject({ state: "met", count: 3 });
  });

  it("is short when fewer than three and any quotation is above the threshold", () => {
    expect(quoteRule(round(["192600.00", "205440.00"]))).toMatchObject({ state: "short", count: 2, minimum: 3 });
    expect(quoteRule(round(["40000.00", "50000.01"]))).toMatchObject({ state: "short" });
  });

  it("does not bind when every quotation is at or below the threshold", () => {
    expect(quoteRule(round(["18000.00", "50000.00"]))).toMatchObject({ state: "below" });
  });

  it("says nothing is quoted yet", () => {
    expect(quoteRule(round([]))).toMatchObject({ state: "empty", count: 0 });
  });
});

describe("award reason requirement", () => {
  const base = { threshold: "50000.00", minimum: 3 };

  it("is required above the threshold with fewer than the minimum", () => {
    expect(awardNeedsReason({ ...base, amount: "192600.00", count: 2 })).toBe(true);
    expect(awardNeedsReason({ ...base, amount: "50000.01", count: 1 })).toBe(true);
  });

  it("is not required at the threshold itself, below it, or with enough quotations", () => {
    expect(awardNeedsReason({ ...base, amount: "50000.00", count: 2 })).toBe(false);
    expect(awardNeedsReason({ ...base, amount: "18000.00", count: 1 })).toBe(false);
    expect(awardNeedsReason({ ...base, amount: "192600.00", count: 3 })).toBe(false);
  });

  it("accepts a typed amount and asks for a reason when the amount cannot be read", () => {
    expect(awardNeedsReason({ ...base, amount: "60,000", count: 2 })).toBe(true);
    expect(awardNeedsReason({ ...base, amount: "abc", count: 2 })).toBe(true);
  });

  it("checks the reason's length (10–1000)", () => {
    expect(reasonProblem("สั้นไป")).toBe("short");
    expect(reasonProblem("มีผู้ให้บริการลิฟต์ยี่ห้อนี้ในพื้นที่เพียง 2 ราย")).toBeNull();
    expect(reasonProblem("x".repeat(1001))).toBe("long");
  });
});
