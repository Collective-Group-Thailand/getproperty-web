import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchPicker } from "./SearchPicker";

const OPTIONS = [
  { value: "p1:u1", label: "A-101 · สมชาย", description: "อาคาร A" },
  { value: "p2:u2", label: "A-102 · สมหญิง", description: "อาคาร A" },
];

afterEach(() => vi.useRealTimers());

/** J-CR pickers (register owners, stub buildings): the API searches, the form posts the chosen value. */
describe("SearchPicker", () => {
  it("loads the first page, searches after a pause and posts the chosen value", async () => {
    vi.useFakeTimers();
    const search = vi.fn((q: string) => Promise.resolve(q ? OPTIONS.slice(1) : OPTIONS));
    const { container } = render(
      <form>
        <SearchPicker name="owner" search={search} emptyLabel="none" listLabel="owners" />
      </form>,
    );
    await act(async () => undefined);
    expect(search).toHaveBeenCalledWith("");
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(screen.getAllByRole("option")).toHaveLength(2);

    fireEvent.change(input, { target: { value: " สมหญิง " } });
    expect(search).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(search).toHaveBeenLastCalledWith("สมหญิง");
    // The API's answer is shown as is — no second filter in the browser.
    expect(screen.getAllByRole("option")).toHaveLength(1);

    fireEvent.click(screen.getByRole("option"));
    const hidden = container.querySelector<HTMLInputElement>('input[name="owner"]');
    expect(hidden?.value).toBe("p2:u2");
  });
});
