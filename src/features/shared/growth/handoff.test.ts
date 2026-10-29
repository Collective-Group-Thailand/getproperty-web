import { describe, expect, it } from "vitest";

import { handoffNeedsAddress, handoffPlace, plausibleHandoffToken, suggestedHandoffTitle } from "./handoff";

const facts = {
  kind: "condo_unit" as const,
  projectName: "The Line Phahol",
  unitNo: "A-1203",
  floorLabel: "12",
  areaSqm: "32.50",
  bedrooms: 1,
  bathrooms: 1,
  district: "จตุจักร",
  province: "กรุงเทพมหานคร",
};

describe("getbuild handoff helpers", () => {
  it("accepts only token-shaped values", () => {
    expect(plausibleHandoffToken("q3K8xF0bW2yR9mT4vN6pL1sA7dE5gH0j")).toBe(true);
    expect(plausibleHandoffToken("short")).toBe(false);
    expect(plausibleHandoffToken("../../etc/passwd")).toBe(false);
    expect(plausibleHandoffToken(undefined)).toBe(false);
  });

  it("names the place from what getbuild told", () => {
    expect(handoffPlace(facts)).toBe("The Line Phahol · จตุจักร · กรุงเทพมหานคร");
    expect(handoffPlace({ ...facts, projectName: null, district: null })).toBe("กรุงเทพมหานคร");
  });

  it("asks for the address only when the district or province is missing", () => {
    expect(handoffNeedsAddress(facts)).toBe(false);
    expect(handoffNeedsAddress({ ...facts, district: null })).toBe(true);
  });

  it("suggests an editable headline from the facts", () => {
    const labels = {
      kind: "Condo",
      bedrooms: (n: number) => `${n}-bed`,
      area: (sqm: string) => `${sqm} sq m`,
    };
    expect(suggestedHandoffTitle(facts, labels)).toBe("Condo 1-bed 32.5 sq m The Line Phahol");
    expect(suggestedHandoffTitle({ ...facts, bedrooms: null, areaSqm: "30.00", projectName: null }, labels)).toBe(
      "Condo 30 sq m",
    );
  });
});
