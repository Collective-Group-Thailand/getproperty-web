import { describe, expect, it } from "vitest";

import { bangkokInstant, bangkokLocal } from "./time";

describe("Bangkok wall time", () => {
  it("reads a datetime-local value as Bangkok time and back", () => {
    expect(bangkokInstant("2026-11-01T09:00")).toBe("2026-11-01T02:00:00.000Z");
    expect(bangkokLocal("2026-11-01T02:00:00.000Z")).toBe("2026-11-01T09:00");
    expect(bangkokLocal(null)).toBe("");
    expect(bangkokInstant("not a time")).toBeUndefined();
  });
});
