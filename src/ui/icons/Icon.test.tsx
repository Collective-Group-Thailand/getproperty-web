import { render } from "@testing-library/react";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CURATED_ICONS } from "./curated";
import { Icon } from "./Icon";
import { IconCheck } from "./glyphs/check";
import { ICON_NAMES, ICONS } from "./registry";

describe("Icon (D-179: per-icon glyph modules)", () => {
  it("draws the glyph's elements on Lucide's 24-px grid in currentColor", () => {
    const { container } = render(<Icon icon={IconCheck} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("data-icon")).toBe("check");
    expect(svg.querySelectorAll("path")).toHaveLength(IconCheck.node.length);
  });

  it("is decorative without a label and an image with one", () => {
    const { container, rerender } = render(<Icon icon={IconCheck} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    rerender(<Icon icon={IconCheck} label="Done" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Done");
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("has one generated module per curated icon and nothing else", () => {
    const files = readdirSync(join(__dirname, "glyphs")).map((file) => file.replace(/\.ts$/, ""));
    expect(files.sort()).toEqual(Object.keys(CURATED_ICONS).sort());
    expect(ICON_NAMES).toEqual(Object.keys(CURATED_ICONS));
    for (const name of ICON_NAMES) expect(ICONS[name].name).toBe(name);
  });
});
