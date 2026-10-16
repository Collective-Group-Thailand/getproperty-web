import { describe, expect, it } from "vitest";

import { RADIUS, SHADOW } from "../tokens/scale";
import { cn, SEMANTIC_SCALE_NAMES } from "./cn";

describe("cn", () => {
  it("lets the last conflicting utility win", () => {
    expect(cn("px-4 py-2", "px-6")).toBe("py-2 px-6");
    expect(cn("rounded-control", "rounded-card")).toBe("rounded-card");
    expect(cn("shadow-card", "shadow-overlay")).toBe("shadow-overlay");
  });
  it("knows every semantic radius and shadow the tokens define", () => {
    const tShirt = new Set(["sm", "md", "lg", "xl", "2xl", "full", "none"]);
    const radii = Object.keys(RADIUS).filter((k) => !tShirt.has(k));
    const shadows = Object.keys(SHADOW).filter((k) => !tShirt.has(k));
    expect(SEMANTIC_SCALE_NAMES.radius.sort()).toEqual(radii.sort());
    expect(SEMANTIC_SCALE_NAMES.shadow.sort()).toEqual(shadows.sort());
  });
});
