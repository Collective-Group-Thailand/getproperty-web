import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { toast, Toaster } from "./Toast";

describe("Toast (D-179: sonner loads with the first toast)", () => {
  it("renders nothing until the first toast, then shows it", async () => {
    const { container } = render(<Toaster />);
    expect(container).toBeEmptyDOMElement();

    let shown: Promise<string | number> | undefined;
    act(() => {
      shown = toast.success("บันทึกแล้ว");
    });
    expect(await screen.findByText("บันทึกแล้ว")).toBeInTheDocument();
    expect(await shown).toBeDefined();
  });
});
