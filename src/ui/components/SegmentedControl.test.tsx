import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

function Demo() {
  const [value, setValue] = useState("electric");
  return (
    <SegmentedControl
      label="Utility"
      value={value}
      onValueChange={setValue}
      options={[
        { value: "electric", label: "Electric" },
        { value: "water", label: "Water" },
        { value: "gas", label: "Gas" },
      ]}
    />
  );
}

describe("SegmentedControl (D-179: no Radix)", () => {
  it("is a named radio group with exactly one checked radio in the tab order", () => {
    render(<Demo />);
    expect(screen.getByRole("radiogroup", { name: "Utility" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
  });

  it("checks on click", () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole("radio", { name: "Water" }));
    expect(screen.getByRole("radio", { name: "Water" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Water" }).tabIndex).toBe(0);
  });

  it("moves focus and the check with arrow keys, wrapping, and with Home/End", () => {
    render(<Demo />);
    const electric = screen.getByRole("radio", { name: "Electric" });
    electric.focus();
    fireEvent.keyDown(electric, { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: "Gas" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Gas" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Gas" }), { key: "ArrowRight" });
    expect(electric).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(electric, { key: "End" });
    expect(screen.getByRole("radio", { name: "Gas" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Gas" }), { key: "Home" });
    expect(electric).toHaveFocus();
  });
});
