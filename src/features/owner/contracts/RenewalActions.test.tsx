import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/features/shared/test/intl";

import { OfferRenewal, renewalOfferBody } from "./RenewalActions";

const post = vi.fn();
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ POST: post }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const LEASE = "1ea50000-0000-4000-8000-000000000001";
const MESSAGES = { rent: "rent?", months: "months?" };
const created = { data: { id: "x" }, response: new Response(null, { status: 201 }) };

beforeEach(() => post.mockReset().mockResolvedValue(created));

async function open(suggestion: Parameters<typeof OfferRenewal>[0]["suggestion"]) {
  await renderWithIntl(
    <OfferRenewal leaseId={LEASE} unitNo="A-302" months={12} language="th" suggestion={suggestion} />,
  );
  fireEvent.click(screen.getByTestId("renewal-offer"));
  return screen.findByTestId("renewal-rent");
}

describe("renewal offer rent (review M3)", () => {
  // The field is natively `required` (Field), so a truly empty box is stopped by the browser; a blank one (spaces)
  // passed that check and was sent without a rent — the API then used a suggestion the owner never saw.
  it("without a suggestion, a blank rent sends nothing and is refused on the field", async () => {
    const rent = await open(null);
    expect(rent).toHaveValue("");
    fireEvent.change(rent, { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("form-submit"));
    await waitFor(() => expect(rent).toHaveAttribute("aria-invalid", "true"));
    expect(rent).toHaveAccessibleDescription(expect.stringContaining("กรอกค่าเช่าต่อเดือนที่ต้องการเสนอ"));
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(rent, { target: { value: "15,500" } });
    fireEvent.click(screen.getByTestId("form-submit"));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect((post.mock.calls[0]![1] as { body: { rent: string; months: number } }).body).toMatchObject({
      rent: "15500",
      months: 12,
    });
  });

  it("the suggestion is prefilled visibly; blanking it is refused, not replaced by a server default", async () => {
    const suggestion = {
      currentRent: "15000.00",
      suggested: { rent: "15500.00", source: "current_rent", basis: "b" },
      candidates: [],
    } as never;
    const rent = await open(suggestion);
    expect(rent).toHaveValue("15500.00");
    fireEvent.change(rent, { target: { value: " " } });
    fireEvent.click(screen.getByTestId("form-submit"));
    await waitFor(() => expect(rent).toHaveAttribute("aria-invalid", "true"));
    expect(rent).toHaveAccessibleDescription(expect.stringContaining("กรอกค่าเช่าต่อเดือนที่ต้องการเสนอ"));
    expect(post).not.toHaveBeenCalled();
  });

  it("builds the body: always a rent, whole months only", () => {
    const base = { months: "12", language: "th", message: undefined };
    expect(renewalOfferBody({ ...base, rent: " 12,000.50 " }, MESSAGES)).toEqual({
      rent: "12000.50",
      months: 12,
      language: "th",
      message: null,
    });
    expect(() => renewalOfferBody({ ...base, rent: "" }, MESSAGES)).toThrow("rent?");
    expect(() => renewalOfferBody({ ...base, rent: "12k" }, MESSAGES)).toThrow("rent?");
    expect(() => renewalOfferBody({ ...base, rent: "12000", months: "12.5" }, MESSAGES)).toThrow("months?");
    expect(() => renewalOfferBody({ ...base, rent: "12000", months: "0" }, MESSAGES)).toThrow("months?");
    expect(() => renewalOfferBody({ ...base, rent: "12000", months: undefined }, MESSAGES)).toThrow("months?");
  });
});
