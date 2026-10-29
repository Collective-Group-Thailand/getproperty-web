import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContractActions } from "@/features/owner/contracts/ContractActions";
import { LeaseActions } from "@/features/owner/leases/LeaseActions";
import { renderWithIntl } from "@/features/shared/test/intl";

/**
 * Review L1: a drawn signature must not outlive the dialog. jsdom has no canvas, so the pad is stood in for by a
 * button that "draws" (emits a PNG blob) — the state handling around it is the real code.
 */
vi.mock("@/ui/components/SignaturePad", () => ({
  SignaturePad: ({ onChange }: { onChange: (png: Blob | null) => void }) => (
    <button type="button" data-testid="draw" onClick={() => onChange(new Blob(["png"], { type: "image/png" }))}>
      draw
    </button>
  ),
  blobToBase64: async () => "cG5n",
}));
const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ GET: get, POST: post }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

beforeEach(() => {
  post.mockReset();
  get.mockReset().mockResolvedValue({
    data: { url: "https://files.example/c.pdf", sha256: "a".repeat(64), expiresAt: "2026-11-01T00:00:00+07:00" },
    response: new Response(null, { status: 200 }),
  });
});

async function drawCloseReopen(open: string, confirm: string) {
  fireEvent.click(screen.getByTestId(open));
  fireEvent.click(await screen.findByTestId("draw"));
  await waitFor(() => expect(screen.getByRole("button", { name: confirm })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  fireEvent.click(screen.getByTestId(open));
  await screen.findByTestId("draw");
}

describe("signing dialogs start without a signature each time (review L1)", () => {
  it("contract sign: reopening leaves Sign disabled until a new stroke", async () => {
    await renderWithIntl(
      <ContractActions
        contract={
          {
            id: "c0a70000-0000-4000-8000-000000000001",
            title: "Lease",
            number: "C-1",
            nextActions: ["sign"],
            state: "sent",
          } as never
        }
      />,
    );
    await drawCloseReopen("contract-sign", "ลงนามสัญญา");
    await screen.findByTestId("contract-sign-sha");
    expect(screen.getByRole("button", { name: "ลงนามสัญญา" })).toBeDisabled();
    fireEvent.click(screen.getByTestId("draw"));
    await waitFor(() => expect(screen.getByRole("button", { name: "ลงนามสัญญา" })).toBeEnabled());
  });

  it("lease countersign: reopening leaves Sign disabled until a new stroke", async () => {
    await renderWithIntl(
      <LeaseActions
        lease={
          {
            id: "1ea50000-0000-4000-8000-000000000001",
            unitNo: "A-302",
            nextActions: ["countersign"],
            months: 12,
            endDate: "2027-10-31",
            number: "L-1",
          } as never
        }
      />,
    );
    await drawCloseReopen("lease-countersign", "เซ็น");
    expect(screen.getByRole("button", { name: "เซ็น" })).toBeDisabled();
  });
});
