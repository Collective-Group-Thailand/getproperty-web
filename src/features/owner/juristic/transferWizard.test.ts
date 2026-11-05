import { describe, expect, it } from "vitest";

import {
  checkTransfer,
  initialTransfer,
  stepComplete,
  transferBody,
  transferReducer,
  type TransferState,
} from "./transferWizard";

const run = (state: TransferState, ...actions: Parameters<typeof transferReducer>[1][]) =>
  actions.reduce(transferReducer, state);

describe("transfer wizard", () => {
  it("starts on the date with one buyer holding 100 %", () => {
    const state = initialTransfer();
    expect(state.step).toBe("date");
    expect(state.buyers).toHaveLength(1);
    expect(state.buyers[0]!.share).toBe("100");
  });

  it("does not leave a step that is not complete and shows its errors", () => {
    const state = run(initialTransfer(), { type: "next" });
    expect(state.step).toBe("date");
    expect(state.showErrors).toBe(true);
    expect(checkTransfer(state).date).toBe("required");
    expect(checkTransfer(run(state, { type: "date", value: "2027-02-30" })).date).toBe("invalid");
  });

  it("walks date → buyers → review and back", () => {
    let state = run(initialTransfer(), { type: "date", value: "2027-03-15" }, { type: "next" });
    expect(state.step).toBe("buyers");
    state = run(state, { type: "next" });
    expect(state.step).toBe("buyers");
    expect(checkTransfer(state).buyers["buyer-1"]).toEqual(["name"]);
    state = run(state, { type: "buyer", key: "buyer-1", patch: { displayName: "สมพร ใหม่" } }, { type: "next" });
    expect(state.step).toBe("review");
    expect(stepComplete(state)).toBe(true);
    expect(run(state, { type: "back" }).step).toBe("buyers");
  });

  it("splits evenly and refuses more than 100 %", () => {
    let state = run(
      initialTransfer(),
      { type: "date", value: "2027-03-15" },
      { type: "next" },
      { type: "addBuyer", key: "buyer-2" },
      { type: "buyer", key: "buyer-1", patch: { displayName: "ก" } },
      { type: "buyer", key: "buyer-2", patch: { displayName: "ข", share: "50" } },
    );
    expect(checkTransfer(state).shares.state).toBe("over");
    expect(run(state, { type: "next" }).step).toBe("buyers");
    state = run(state, { type: "splitEvenly" });
    expect(state.buyers.map((buyer) => buyer.share)).toEqual(["50", "50"]);
    expect(run(state, { type: "next" }).step).toBe("review");
  });

  it("refuses the same existing party twice and keeps at least one buyer", () => {
    const state = run(
      initialTransfer(),
      { type: "addBuyer", key: "buyer-2" },
      { type: "buyer", key: "buyer-1", patch: { source: "existing", partyId: "p1", share: "50" } },
      { type: "buyer", key: "buyer-2", patch: { source: "existing", partyId: "p1", share: "50" } },
    );
    expect(checkTransfer(state).duplicate).toBe(true);
    expect(stepComplete(state, "buyers")).toBe(false);
    const one = run(initialTransfer(), { type: "removeBuyer", key: "buyer-1" });
    expect(one.buyers).toHaveLength(1);
  });

  it("goto only opens a step after complete ones", () => {
    const state = initialTransfer();
    expect(run(state, { type: "goto", step: "review" }).step).toBe("date");
  });

  it("builds the API body: existing party by id, new party with its contact", () => {
    const state = run(
      initialTransfer(),
      { type: "date", value: "2027-03-15" },
      { type: "policy", value: "refund_seller" },
      { type: "note", value: "  โอนตามสัญญาซื้อขาย " },
      { type: "addBuyer", key: "buyer-2" },
      { type: "buyer", key: "buyer-1", patch: { source: "existing", partyId: "p1", share: "60 %" } },
      { type: "buyer", key: "buyer-2", patch: { displayName: " บจก. ใหม่ ", type: "company", share: "40", phone: "" } },
    );
    expect(transferBody(state)).toEqual({
      transferDate: "2027-03-15",
      policy: "refund_seller",
      note: "โอนตามสัญญาซื้อขาย",
      buyers: [
        { partyId: "p1", sharePct: "60" },
        { sharePct: "40", party: { type: "company", displayName: "บจก. ใหม่" } },
      ],
    });
  });
});
