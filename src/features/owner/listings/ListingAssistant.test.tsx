import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/features/shared/test/intl";

import { ListingAssistant } from "./ListingAssistant";

const post = vi.fn();
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ POST: post }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const LISTING = "1157a000-0000-4000-8000-000000000001";
const quota = { enabled: true, usedThisMonth: 3, monthlyLimit: 20 } as never;

const refusal = (status: number, code: string) => ({
  error: { type: "about:blank", title: "x", status, code, detail: "x" },
  response: new Response(null, { status }),
});
const drafts = {
  data: {
    drafts: { th: { title: "ห้องสวย", description: "ใกล้รถไฟฟ้า" } },
    usedThisMonth: 4,
    monthlyLimit: 20,
    disclaimer: "AI",
  },
  response: new Response(null, { status: 201 }),
};

const keys = () =>
  post.mock.calls.map(
    (call) => (call[1] as { params: { header: Record<string, string> } }).params.header["Idempotency-Key"],
  );

beforeEach(() => post.mockReset());

describe("ListingAssistant refusals (review M2)", () => {
  it("shows the designed title and body for a dotted API code, never the key path", async () => {
    post.mockResolvedValueOnce(refusal(429, "assistant.limit_reached"));
    await renderWithIntl(<ListingAssistant listingId={LISTING} quota={quota} hasPhotos={false} onUse={() => {}} />);
    fireEvent.click(screen.getByTestId("assistant-generate"));
    const problem = await screen.findByTestId("assistant-problem");
    expect(problem).toHaveAttribute("data-code", "assistant.limit_reached");
    expect(problem.textContent).not.toMatch(/problem\.|limit_reached/);
    expect(problem).toHaveTextContent("ใช้สิทธิ์ร่างของเดือนนี้ครบแล้ว");
  });
});

describe("ListingAssistant Idempotency-Key (review L10)", () => {
  it("keeps the key for the same request after no answer, renews it when the request changes", async () => {
    post
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(drafts)
      .mockResolvedValueOnce(drafts);
    await renderWithIntl(<ListingAssistant listingId={LISTING} quota={quota} hasPhotos={false} onUse={() => {}} />);
    const generate = () => fireEvent.click(screen.getByTestId("assistant-generate"));
    generate();
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await screen.findByTestId("problem-notice");
    generate(); // the same request again: the API may have it, same key
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    await screen.findByTestId("problem-notice");
    fireEvent.click(screen.getByRole("checkbox", { name: "จีน" })); // the request changes
    generate();
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    await screen.findByTestId("assistant-drafts");
    generate(); // after an answer: a new request
    await waitFor(() => expect(post).toHaveBeenCalledTimes(4));
    const [a, b, c, d] = keys();
    expect(b).toBe(a);
    expect(c).not.toBe(b);
    expect(d).not.toBe(c);
  });
});
