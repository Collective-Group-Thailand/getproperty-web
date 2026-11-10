import { describe, expect, it } from "vitest";

import { NetworkError, problemError } from "@/lib/api/errors";

import { BULK_SKIP, keyedSend, runBulk } from "./bulk";

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

/** Review W5: a bulk run again after a dropped answer replays each row's request instead of sending it twice. */
describe("bulk Idempotency-Keys per action × row (review W5)", () => {
  it("keeps a row's key across runs until the API answers, then the next run gets a new one", async () => {
    const keys = new Map<string, string>();
    const seen: string[] = [];
    const attempt = (fail?: unknown) =>
      keyedSend(keys, "remind:p1:u1", async (key) => {
        seen.push(key);
        if (fail) throw fail;
        return "ok";
      }).catch(() => "failed");
    await attempt(new NetworkError(new TypeError("fetch failed")));
    await attempt(problemError(503, { code: "http.503" }));
    await attempt(problemError(429, { code: "http.rate_limited" }));
    await attempt();
    expect(new Set(seen.slice(0, 4)).size).toBe(1);
    await attempt(problemError(422, { code: "plan.invalid" }));
    expect(seen[4]).not.toBe(seen[3]);
    await attempt();
    expect(seen[5]).not.toBe(seen[4]);
  });

  it("gives each action and each row its own key", async () => {
    const keys = new Map<string, string>();
    const seen: string[] = [];
    const fail = new NetworkError(new TypeError("offline"));
    for (const id of ["remind:p1:u1", "remind:p2:u2", "pause:p1:u1"]) {
      await keyedSend(keys, id, async (key) => {
        seen.push(key);
        throw fail;
      }).catch(() => undefined);
    }
    expect(new Set(seen).size).toBe(3);
    expect(keys.size).toBe(3);
  });
});
