import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en/owner/broadcast.json";
import th from "@/i18n/messages/th/owner/broadcast.json";

import {
  amountOrNull,
  availability,
  EMPTY_SEGMENT,
  invalidAmount,
  perRecipient,
  perRecipientDigits,
  problemKey,
  ratePercent,
  recipientsOrNull,
  scheduleProblem,
  segmentBody,
} from "./broadcast";

const product = {
  enabled: false,
  onSale: false,
  pricePerRecipient: null,
  vatRate: "0.0700",
  currency: "THB",
  minimumRecipients: 500,
  maxListings: 5,
  maxPerWeek: 2,
};

describe("sponsored broadcast helpers (G6, D-300)", () => {
  it("sends only the closed segment whitelist, amounts without separators, empty budgets as null", () => {
    const body = segmentBody({
      ...EMPTY_SEGMENT,
      areas: ["ari"],
      budgetMin: "8,000",
      budgetMax: " ",
      unitKinds: ["condo_unit"],
      moveInFrom: "2026-12-01",
      languages: ["th", "my"],
    });
    expect(body).toEqual({
      areas: ["ari"],
      budgetMin: "8000",
      budgetMax: null,
      unitKinds: ["condo_unit"],
      moveInFrom: "2026-12-01",
      moveInTo: null,
      languages: ["th", "my"],
    });
    expect(Object.keys(body).sort()).toEqual(
      ["areas", "budgetMax", "budgetMin", "languages", "moveInFrom", "moveInTo", "unitKinds"].sort(),
    );
  });

  it("reads typed amounts and recipient counts as text", () => {
    expect(amountOrNull("฿12,500.50")).toBe("12500.50");
    expect(amountOrNull("12k")).toBeNull();
    expect(invalidAmount("")).toBe(false);
    expect(invalidAmount("abc")).toBe(true);
    expect(recipientsOrNull("1,000")).toBe(1000);
    expect(recipientsOrNull("0")).toBeNull();
    expect(recipientsOrNull("2000000")).toBeNull();
    expect(recipientsOrNull("12.5")).toBeNull();
  });

  it("shows the price per recipient with the decimals it needs and the VAT rate as a percentage", () => {
    expect(perRecipientDigits("0.5000")).toBe("0.50");
    expect(perRecipientDigits("0.1250")).toBe("0.125");
    expect(perRecipientDigits("1.2345")).toBe("1.2345");
    expect(perRecipient("0.5000", "th")).toBe("฿0.50");
    expect(perRecipient("0.1250", "en")).toBe("฿0.125");
    expect(ratePercent("0.0700")).toBe("7");
    expect(ratePercent("0.0750")).toBe("7.5");
    expect(ratePercent("0.1000")).toBe("10");
  });

  it("names why a campaign cannot be scheduled yet: switched off (O-023), unpriced (O-027), both, or open", () => {
    expect(availability(product)).toBe("off_unpriced");
    expect(availability({ ...product, enabled: true })).toBe("unpriced");
    expect(availability({ ...product, onSale: true, pricePerRecipient: "0.5000" })).toBe("off");
    expect(availability({ ...product, enabled: true, onSale: true, pricePerRecipient: "0.5000" })).toBe("open");
  });

  it("explains the schedule refusals of the contract and nothing else", () => {
    for (const code of [
      "broadcast.sponsored_disabled",
      "broadcast.not_on_sale",
      "broadcast.below_minimum",
      "broadcast.listing_not_public",
      "broadcast.invalid_state",
    ]) {
      const known = scheduleProblem(code);
      expect(known).toBe(code);
      const key = problemKey(known!);
      expect(key).toBe(code.replace("broadcast.", ""));
      // A designed state in both languages (the problems are keyed without the dot next-intl reserves).
      expect(th.problems).toHaveProperty(key);
      expect(en.problems).toHaveProperty(key);
    }
    expect(scheduleProblem("validation.failed")).toBeNull();
    expect(scheduleProblem(undefined)).toBeNull();
  });
});
