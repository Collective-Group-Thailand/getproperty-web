import { describe, expect, it } from "vitest";

import { ICON_NAMES } from "@/ui/icons/registry";

import { defineStatuses, READING_SOURCE } from "./index";

describe("status scaffolding", () => {
  it("derives the label key from the domain and value", () => {
    const map = defineStatuses<"a" | "b">("thing", {
      a: { tone: "success", icon: "check" },
      b: { tone: "danger", icon: "alert" },
    });
    expect(map.a.labelKey).toBe("status.thing.a");
    expect(map.b.tone).toBe("danger");
  });
  it("names only icons that exist in the registry", () => {
    for (const meta of Object.values(READING_SOURCE)) expect(ICON_NAMES).toContain(meta.icon);
  });
  it("marks an estimated reading as needing attention, not danger (D-012, D-100)", () => {
    expect(READING_SOURCE.estimated.tone).toBe("warning");
  });
});
