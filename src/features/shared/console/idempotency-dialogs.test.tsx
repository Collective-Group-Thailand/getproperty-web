import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/features/shared/test/intl";
import { ApiError, NetworkError } from "@/lib/api/errors";

import { ConfirmAction } from "./ConfirmAction";
import { FormDialog } from "./FormDialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

/**
 * Review L2: an irreversible request whose answer was lost (closed "no connection" dialog, reopened, sent again)
 * must reuse its Idempotency-Key, so the API replays instead of booking twice. After an answer (success or a
 * refusal) the next opening is a new action with a new key.
 */
const refused = () => new ApiError(422, { code: "validation.failed", status: 422, title: "x", detail: "x" });

async function openAndConfirm(trigger: string, confirm: string) {
  fireEvent.click(screen.getByRole("button", { name: trigger }));
  const button = await screen.findByRole("button", { name: confirm });
  fireEvent.click(button);
}

async function closeDialog() {
  fireEvent.click(await screen.findByRole("button", { name: "ยกเลิก" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
}

describe("ConfirmAction keeps the key of an unanswered action across reopening (review L2)", () => {
  it("same key after a network failure, a new one after a success or a refusal", async () => {
    const outcomes: unknown[] = [new NetworkError(new TypeError("fetch failed")), "ok", refused(), "ok"];
    const onConfirm = vi.fn(async () => {
      const next = outcomes.shift();
      if (next instanceof Error) throw next;
      return next;
    });
    await renderWithIntl(
      <ConfirmAction label="บันทึกรับเงิน" title="t" description="d" confirmLabel="ยืนยัน" onConfirm={onConfirm} />,
    );

    await openAndConfirm("บันทึกรับเงิน", "ยืนยัน");
    await screen.findByTestId("problem-notice");
    await closeDialog();
    await openAndConfirm("บันทึกรับเงิน", "ยืนยัน"); // the answer was lost: the same action again
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await openAndConfirm("บันทึกรับเงิน", "ยืนยัน"); // a new action after the success
    await screen.findByTestId("problem-notice");
    await closeDialog();
    await openAndConfirm("บันทึกรับเงิน", "ยืนยัน"); // a new action after the refusal
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(4));

    const keys = onConfirm.mock.calls.map((call) => (call as unknown[])[0]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
    expect(keys[3]).not.toBe(keys[2]);
  });
});

describe("FormDialog keeps the key of an unanswered action across reopening (review L2)", () => {
  it("same key after a network failure, a new one after a success", async () => {
    const outcomes: unknown[] = [new NetworkError(new TypeError("fetch failed")), "ok", "ok"];
    const onSubmit = vi.fn(async () => {
      const next = outcomes.shift();
      if (next instanceof Error) throw next;
      return next;
    });
    await renderWithIntl(
      <FormDialog label="คืนเงิน" title="t" submitLabel="ส่ง" onSubmit={onSubmit}>
        {() => <input name="amount" defaultValue="100.00" aria-label="amount" />}
      </FormDialog>,
    );
    const send = async () => {
      fireEvent.click(screen.getByRole("button", { name: "คืนเงิน" }));
      fireEvent.click(await screen.findByTestId("form-submit"));
    };
    await send();
    await screen.findByTestId("problem-notice");
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await send();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await send();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3));

    const keys = onSubmit.mock.calls.map((call) => (call as unknown[])[2]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });
});
