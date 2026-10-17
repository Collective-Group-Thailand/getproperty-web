import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { lazyOverlay, lazyTriggered } from "./lazy";

function Panel({ open, label }: { open: boolean; label: string }) {
  return open ? <div role="dialog" aria-label={label} /> : null;
}

function Menu({
  trigger,
  open,
}: {
  trigger: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <>
      {trigger}
      {open ? <ul role="menu" aria-label="menu" /> : null}
    </>
  );
}

describe("lazyOverlay (D-179)", () => {
  it("loads nothing while closed, then loads and renders the overlay on first open", async () => {
    const load = vi.fn(() => Promise.resolve(Panel));
    const LazyPanel = lazyOverlay(load);
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen((value) => !value)}>toggle</button>
          <LazyPanel open={open} label="panel" />
        </>
      );
    }
    render(<Host />);
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    // A click is the first interaction: it warms the chunk and opens the overlay.
    await act(async () => fireEvent.click(screen.getByText("toggle")));
    expect(await screen.findByRole("dialog", { name: "panel" })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => fireEvent.click(screen.getByText("toggle")));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("lazyTriggered (D-179)", () => {
  it("renders the trigger with closed popup state, then opens the loaded overlay on click", async () => {
    const LazyMenu = lazyTriggered(() => Promise.resolve(Menu), "menu");
    const onClick = vi.fn();
    render(<LazyMenu trigger={<button onClick={onClick}>open</button>} />);

    const trigger = screen.getByRole("button", { name: "open" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();

    await act(async () => fireEvent.click(trigger));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("respects a caller-controlled open state", async () => {
    const LazyMenu = lazyTriggered(() => Promise.resolve(Menu), "menu");
    const onOpenChange = vi.fn();
    const { rerender } = render(<LazyMenu open={false} onOpenChange={onOpenChange} trigger={<button>open</button>} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "open" })));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    rerender(<LazyMenu open onOpenChange={onOpenChange} trigger={<button>open</button>} />);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });
});
