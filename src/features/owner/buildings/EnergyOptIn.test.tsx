import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/features/shared/test/intl";

import { EnergyOptIn } from "./EnergyOptIn";

const post = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ POST: post }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

const insight = {
  buildingId: "b0000000-0000-4000-8000-000000000001",
  canOptIn: true,
  optin: null,
  consent: { purpose: "energy_sharing", version: 3, title: "Share energy figures", bodyMarkdown: "Old text" },
} as never;

beforeEach(() => {
  post.mockReset();
  refresh.mockReset();
});

describe("energy opt-in when the consent text changed (review L2)", () => {
  it("unticks, re-reads the page and asks to read the new text before a fresh tick", async () => {
    post.mockResolvedValueOnce({
      error: { type: "about:blank", title: "x", status: 409, code: "energy.consent_required", detail: "x" },
      response: new Response(null, { status: 409 }),
    });
    await renderWithIntl(<EnergyOptIn insight={insight} />);
    const agree = screen.getByRole("checkbox");
    fireEvent.click(agree);
    expect(agree).toBeChecked();
    fireEvent.click(screen.getByTestId("energy-opt-in-submit"));

    await screen.findByTestId("energy-text-changed");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByTestId("energy-opt-in-submit")).toBeDisabled();
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  });
});
