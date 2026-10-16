import { describe, expect, it } from "vitest";

import { checkContrast, uncheckedKeys } from "../../../scripts/check-contrast";

/** ADR-0003: the contrast gate runs inside `pnpm test`, so a token change cannot ship a failing pair. */
describe("semantic token contrast (WCAG 2.2 AA, all themes)", () => {
  const results = checkContrast();

  it.each(results.map((r) => [`${r.theme}: ${r.fg} on ${r.bg} (${r.why})`, r] as const))("%s", (_name, r) => {
    expect(r.ratio, `${r.ratio.toFixed(2)}:1 is under ${r.min}:1`).toBeGreaterThanOrEqual(r.min - 0.005);
  });

  it("checks every semantic key in at least one pair", () => {
    expect(uncheckedKeys()).toEqual([]);
  });
});
