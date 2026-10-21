import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/features/shared/test/intl";

vi.mock("./files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./files")>()),
  platformFileLink: vi.fn(async () => ({ url: "https://storage.example/signed?sig=1" })),
}));

import { PlatformFileButton } from "./PlatformFileButton";

/** Review L5: the file opens in the new tab, this tab stays, and the new tab cannot reach back. */
describe("PlatformFileButton", () => {
  afterEach(() => vi.restoreAllMocks());

  const renderButton = () => renderWithIntl(<PlatformFileButton fileId="f1" label="เปิดไฟล์" />, "admin");

  it("opens the signed URL in the new tab with its opener cut, and leaves this tab where it is", async () => {
    const tab = { opener: {} as unknown, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockImplementation(() => tab as unknown as Window);
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign } as Location);
    await renderButton();
    fireEvent.click(screen.getByRole("button", { name: "เปิดไฟล์" }));
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith("https://storage.example/signed?sig=1"));
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(String(open.mock.calls[0]![2] ?? "")).not.toContain("noopener");
    expect(tab.opener).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("opens the file here only when popups are blocked", async () => {
    vi.spyOn(window, "open").mockImplementation(() => null);
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign } as Location);
    await renderButton();
    fireEvent.click(screen.getByRole("button", { name: "เปิดไฟล์" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.example/signed?sig=1"));
  });
});
