import { describe, expect, it } from "vitest";

import { decimalShare, isZeroDecimal } from "./decimal";

describe("isZeroDecimal / decimalShare", () => {
  it("recognises zero in the API's decimal strings", () => {
    expect(isZeroDecimal("0.00")).toBe(true);
    expect(isZeroDecimal("-0.00")).toBe(true);
    expect(isZeroDecimal("0")).toBe(true);
    expect(isZeroDecimal("5512.00")).toBe(false);
    expect(isZeroDecimal("")).toBe(false);
  });
  it("draws a share between 0 and 100", () => {
    expect(decimalShare("7182.00", "12694.00")).toBe(57);
    expect(decimalShare("0.00", "12694.00")).toBe(0);
    expect(decimalShare("10.00", "0.00")).toBe(0);
    expect(decimalShare("20.00", "10.00")).toBe(100);
  });
});
