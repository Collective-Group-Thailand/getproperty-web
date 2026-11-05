import { describe, expect, it } from "vitest";

import { problemError } from "@/lib/api/errors";

import { BULK_SKIP, runBulk } from "./bulk";

const row = (
  unitNo: string,
  patch: Partial<{ channels: string[]; disputeOpen: boolean; planId: string | null; caseId: string | null }> = {},
) => ({
  unitNo,
  channels: ["line"],
  disputeOpen: false,
  planId: null,
  caseId: "c",
  ...patch,
});

describe("bulk actions on receivables (J-DESIGN §3)", () => {
  it("skips rows the action does not fit, keeps going after a refusal, and reports each row", async () => {
    const sent: string[] = [];
    const outcome = await runBulk(
      [row("A-101"), row("A-102", { channels: ["letter"] }), row("A-103"), row("A-104", { disputeOpen: true })],
      BULK_SKIP.remind,
      async (r) => {
        if (r.unitNo === "A-103") throw problemError(409, { code: "invoice.nothing_due", detail: "ไม่มียอดค้าง" });
        sent.push(r.unitNo);
      },
    );
    expect(sent).toEqual(["A-101"]);
    expect(outcome.done.map((r) => r.unitNo)).toEqual(["A-101"]);
    expect(outcome.skipped.map(({ row: r, reason }) => [r.unitNo, reason])).toEqual([
      ["A-102", "noLine"],
      ["A-104", "inDispute"],
    ]);
    expect(outcome.failed).toEqual([
      { row: expect.objectContaining({ unitNo: "A-103" }), code: "invoice.nothing_due", message: "ไม่มียอดค้าง" },
    ]);
  });

  it("never proposes a second plan or a second dispute", () => {
    expect(BULK_SKIP.plan(row("A", { planId: "p" }))).toBe("inPlan");
    expect(BULK_SKIP.plan(row("A"))).toBeNull();
    expect(BULK_SKIP.dispute(row("A", { caseId: null }))).toBe("noCase");
    expect(BULK_SKIP.dispute(row("A", { disputeOpen: true }))).toBe("inDispute");
    expect(BULK_SKIP.dispute(row("A"))).toBeNull();
  });

  it("names a request that never got an answer as a network failure", async () => {
    const outcome = await runBulk(
      [row("A")],
      () => null,
      () => Promise.reject(new TypeError("offline")),
    );
    expect(outcome.failed[0]?.code).toBe("network");
  });
});
