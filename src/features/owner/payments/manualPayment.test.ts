import { describe, expect, it } from "vitest";

import { manualPaymentErrors, type ManualPaymentInput } from "./manualPayment";

const input = (patch: Partial<ManualPaymentInput> = {}): ManualPaymentInput => ({
  method: "cash",
  amount: "1500.00",
  paidDate: "2026-11-05",
  notes: "",
  evidenceDocumentId: null,
  ...patch,
});

describe("manual payment rules", () => {
  it("apartments: cash needs no evidence, a transfer does", () => {
    expect(manualPaymentErrors(input(), { juristic: false })).toEqual({});
    expect(manualPaymentErrors(input({ method: "bank_transfer_manual" }), { juristic: false })).toEqual({
      evidence: "evidenceRequired",
    });
  });

  it("juristic tenants: evidence and a note of five characters for cash and transfers (J1.2a)", () => {
    expect(manualPaymentErrors(input(), { juristic: true })).toEqual({
      evidence: "evidenceRequired",
      notes: "noteShort",
    });
    expect(manualPaymentErrors(input({ evidenceDocumentId: "d", notes: " KBNK " }), { juristic: true })).toEqual({
      notes: "noteShort",
    });
    expect(
      manualPaymentErrors(input({ evidenceDocumentId: "d", notes: "SWIFT BKKBTHBK ref 0042" }), { juristic: true }),
    ).toEqual({});
  });

  it("wants a positive amount with at most two decimals and a date", () => {
    for (const amount of ["0", "0.00", "-5", "12.345", "abc", ""])
      expect(manualPaymentErrors(input({ amount }), { juristic: false }).amount).toBe("amount");
    expect(manualPaymentErrors(input({ paidDate: null }), { juristic: false }).paidDate).toBe("date");
  });
});
