import { describe, expect, it } from "vitest";

import { checkShares, evenShares, formatShare, parseShare, shareString, WHOLE } from "./shares";

describe("parseShare", () => {
  it("reads percent with up to four decimals as ten-thousandths", () => {
    expect(parseShare("60")).toBe(600_000);
    expect(parseShare("33.3333")).toBe(333_333);
    expect(parseShare("100.0000")).toBe(WHOLE);
    expect(parseShare(" 40 % ")).toBe(400_000);
    expect(parseShare("0.0001")).toBe(1);
  });
  it("refuses what is not a share", () => {
    for (const text of ["", "abc", "100.1", "101", "33.33333", "-5", "1e2", "50,5"])
      expect(parseShare(text)).toBeNull();
  });
});

describe("shareString / formatShare", () => {
  it("writes the API's string without trailing zeros", () => {
    expect(shareString(600_000)).toBe("60");
    expect(shareString(333_334)).toBe("33.3334");
    expect(shareString(5)).toBe("0.0005");
    expect(formatShare("60.0000")).toBe("60");
    expect(formatShare("33.3300")).toBe("33.33");
    expect(formatShare("n/a")).toBe("n/a");
  });
});

describe("checkShares", () => {
  it("accepts a complete split", () => {
    const check = checkShares(["60", "40"]);
    expect(check).toMatchObject({ ok: true, state: "complete", total: WHOLE, remaining: 0 });
  });
  it("allows an incomplete register but says what is left", () => {
    const check = checkShares(["50"]);
    expect(check).toMatchObject({ ok: true, state: "under", remaining: 500_000 });
  });
  it("refuses more than 100 % including the owners already on the unit", () => {
    expect(checkShares(["41"], 600_000)).toMatchObject({ ok: false, state: "over" });
    expect(checkShares(["40"], 600_000)).toMatchObject({ ok: true, state: "complete" });
  });
  it("marks rows that are not shares or are zero", () => {
    const check = checkShares(["abc", "0", "30"]);
    expect(check.errors).toEqual(["format", "zero", null]);
    expect(check.ok).toBe(false);
    expect(check.total).toBe(300_000);
  });
  it("three-way split sums exactly", () => {
    expect(checkShares(["33.3334", "33.3333", "33.3333"]).state).toBe("complete");
  });
});

describe("evenShares", () => {
  it("splits 100 % with the remainder on the first buyer", () => {
    expect(evenShares(1)).toEqual(["100"]);
    expect(evenShares(2)).toEqual(["50", "50"]);
    expect(evenShares(3)).toEqual(["33.3334", "33.3333", "33.3333"]);
    expect(checkShares(evenShares(7)).state).toBe("complete");
    expect(evenShares(0)).toEqual([]);
  });
});
