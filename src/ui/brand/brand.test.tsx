import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "../test/axe";
import { CHIMNEY_GRADIENT, CHIMNEY_PATH, HOUSE_PATH, INK_PATH } from "./geometry";
import { BRAND_HEIGHT, Mark } from "./Mark";
import { Wordmark } from "./Wordmark";

/** The path drawing `d` (the logo's paths are too long for a CSS attribute selector). */
const pathWith = (svg: Element, d: string) =>
  [...svg.querySelectorAll("path")].find((path) => path.getAttribute("d") === d);
const chimneyFill = (svg: Element) => pathWith(svg, CHIMNEY_PATH)!.getAttribute("fill");

describe("Wordmark", () => {
  it("is the founder's drawing, named getproperty, with no lettering set in a font", () => {
    const { container } = render(<Wordmark />);
    const logo = screen.getByRole("img", { name: "getproperty" });
    expect(pathWith(logo, INK_PATH)).toBeDefined();
    expect(pathWith(logo, HOUSE_PATH)).toBeDefined();
    expect(container.querySelector("text")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("keeps the chimney gradient (sky → azure through the logo tokens)", () => {
    render(<Wordmark />);
    const logo = screen.getByRole("img", { name: "getproperty" });
    const gradient = logo.querySelector("linearGradient")!;
    expect(gradient.getAttribute("y1")).toBe(String(CHIMNEY_GRADIENT.y1));
    expect(gradient.getAttribute("y2")).toBe(String(CHIMNEY_GRADIENT.y2));
    expect([...gradient.querySelectorAll("stop")].map((stop) => stop.getAttribute("class"))).toEqual([
      "[stop-color:var(--color-logo-chimney-top)]",
      "[stop-color:var(--color-logo-chimney-bottom)]",
    ]);
    expect(chimneyFill(logo)).toBe(`url(#${gradient.id})`);
  });

  it("gives every instance its own gradient id", () => {
    const { container } = render(
      <>
        <Wordmark />
        <Wordmark compact />
        <Mark />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((gradient) => gradient.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^gp-chimney-[\w-]+$/);
    container.querySelectorAll("svg").forEach((svg, index) => expect(chimneyFill(svg)).toBe(`url(#${ids[index]})`));
  });

  it("is sized by height and keeps the artwork's proportions", () => {
    const { container } = render(
      <>
        <Wordmark size="sm" />
        <Wordmark size="lg" />
        <Wordmark size={20} />
      </>,
    );
    const sizes = [...container.querySelectorAll("svg")].map((svg) => [
      svg.getAttribute("width"),
      svg.getAttribute("height"),
    ]);
    expect(sizes).toEqual([
      [String(Math.round((BRAND_HEIGHT.sm * 440) / 94)), String(BRAND_HEIGHT.sm)],
      [String(Math.round((BRAND_HEIGHT.lg * 440) / 94)), String(BRAND_HEIGHT.lg)],
      ["94", "20"],
    ]);
  });

  it("compact is the mark alone", () => {
    const { container } = render(<Wordmark compact size="md" />);
    const svg = container.querySelector("svg")!;
    expect(svg.dataset.brand).toBe("mark");
    expect(pathWith(svg, INK_PATH)).toBeUndefined();
    expect(svg.getAttribute("height")).toBe(String(BRAND_HEIGHT.md));
  });

  it("onDark is the founder's one-colour white version (no gradient)", () => {
    const { container } = render(<Wordmark tone="onDark" />);
    expect(container.querySelector("linearGradient")).toBeNull();
    container.querySelectorAll("path").forEach((path) => expect(path.getAttribute("class")).toBe("fill-white"));
  });

  it("is hidden from assistive technology when decorative", () => {
    const { container } = render(
      <a href="#home">
        <Wordmark decorative />
        <span>Home</span>
      </a>,
    );
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
  });

  it("renders on the server (no client state)", () => {
    const html = renderToStaticMarkup(<Wordmark size="sm" />);
    expect(html).toMatch(/^<svg [^>]*role="img"[^>]*aria-label="getproperty"/);
    expect(html).toContain('fill="url(#gp-chimney-');
  });

  it("passes axe", async () => {
    await expectNoAxeViolations(
      <div>
        <Wordmark />
        <Mark size="sm" />
        <Wordmark decorative compact />
        <Wordmark tone="onDark" />
      </div>,
    );
  });
});
