import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { applyKey, isCompleteDecimal, NumericKeypad, sanitizeDecimal, type KeypadKey } from "./NumericKeypad";

const type = (keys: KeypadKey[], limits = {}) => keys.reduce((value, key) => applyKey(value, key, limits), "");

describe("applyKey", () => {
  it("builds a decimal string key by key", () => {
    expect(type(["1", "2", "3", ".", "4", "5"])).toBe("123.45");
  });

  it("drops leading zeros but keeps 0.x", () => {
    expect(type(["0", "0", "7"])).toBe("7");
    expect(type([".", "5"])).toBe("0.5");
    expect(type(["0", ".", "0", "1"])).toBe("0.01");
  });

  it("allows one decimal point and at most maxDecimals digits after it", () => {
    expect(type(["1", ".", ".", "2", "3", "4", "5"])).toBe("1.234");
    expect(type(["1", ".", "2"], { maxDecimals: 0 })).toBe("12");
  });

  it("refuses a 10th integer digit (contract: 9)", () => {
    expect(type(["1", "2", "3", "4", "5", "6", "7", "8", "9", "1"])).toBe("123456789");
  });

  it("backspace and clear", () => {
    expect(applyKey("12.5", "backspace")).toBe("12.");
    expect(applyKey("12.5", "clear")).toBe("");
  });
});

describe("sanitizeDecimal / isCompleteDecimal", () => {
  it("reduces pasted text to what the keypad would type", () => {
    expect(sanitizeDecimal("12,345.6789 kWh")).toBe("12345.678");
    expect(sanitizeDecimal("abc")).toBe("");
  });

  it("matches the API's register pattern", () => {
    expect(isCompleteDecimal("12345.678")).toBe(true);
    expect(isCompleteDecimal("12.")).toBe(false);
    expect(isCompleteDecimal("")).toBe(false);
    expect(isCompleteDecimal("1234567890")).toBe(false);
  });
});

function Harness() {
  const [value, setValue] = useState("");
  return (
    <NumericKeypad
      label="Reading"
      unit="kWh"
      labels={{ backspace: "Delete", decimal: "Point" }}
      value={value}
      onChange={setValue}
    />
  );
}

describe("<NumericKeypad>", () => {
  it("types with the keys and the hardware keyboard into one labelled field", () => {
    render(<Harness />);
    for (const key of ["4", "2", "Point", "5"]) fireEvent.click(screen.getByRole("button", { name: key }));
    const field = screen.getByLabelText("Reading");
    expect(field).toHaveValue("42.5");
    expect(field).toHaveAttribute("inputmode", "none");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(field).toHaveValue("42.");
    fireEvent.change(field, { target: { value: "0099.12345" } });
    expect(field).toHaveValue("99.123");
  });
});
