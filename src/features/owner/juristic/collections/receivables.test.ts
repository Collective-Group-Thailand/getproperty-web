import { describe, expect, it } from "vitest";

import { IconLock } from "@/ui/icons/glyphs/lock";

import { ariaSort, channelList, contextParts, nextStepBadge, receivablesQuery, sortLink } from "./receivables";

describe("receivables list state (JW1b)", () => {
  it("reads the URL with the API's defaults for anything unknown", () => {
    expect(receivablesQuery({})).toEqual({ tab: "all", sort: "amount", order: "desc", q: undefined, page: 1 });
    expect(receivablesQuery({ tab: "dispute", sort: "age", order: "asc", q: "  A-12 ", page: "3" })).toEqual({
      tab: "dispute",
      sort: "age",
      order: "asc",
      q: "A-12",
      page: 3,
    });
    expect(receivablesQuery({ tab: "drop", sort: "name", order: "sideways", page: "-2" })).toMatchObject({
      tab: "all",
      sort: "amount",
      order: "desc",
      page: 1,
    });
  });

  it("flips the order on the same column and starts a new column largest / oldest first", () => {
    expect(sortLink({ sort: "amount", order: "desc" }, "amount")).toEqual({ sort: "amount", order: "asc" });
    expect(sortLink({ sort: "amount", order: "asc" }, "amount")).toEqual({ sort: "amount", order: "desc" });
    expect(sortLink({ sort: "amount", order: "asc" }, "age")).toEqual({ sort: "age", order: "desc" });
    expect(ariaSort({ sort: "age", order: "asc" }, "age")).toBe("ascending");
    expect(ariaSort({ sort: "age", order: "asc" }, "amount")).toBe("none");
  });

  it("says who the owner is in the second line, only what is true", () => {
    expect(contextParts({ ownsUnits: 2, nonResident: true, agent: false })).toEqual([
      { key: "ownsUnits", count: 2 },
      { key: "nonResident" },
    ]);
    expect(contextParts({ ownsUnits: 1, nonResident: false, agent: true })).toEqual([{ key: "agent" }]);
    expect(contextParts({ ownsUnits: 1, nonResident: false, agent: false })).toEqual([]);
  });

  it("orders the next-step badge: dispute, plan, approval, counsel lock, step", () => {
    const step = {
      kind: "notice_letter" as const,
      date: "2026-11-20",
      legalReviewRequired: false,
      awaitingApproval: false,
    };
    expect(nextStepBadge({ disputeOpen: true, planId: "p", nextStep: step }).kind).toBe("dispute");
    expect(nextStepBadge({ disputeOpen: false, planId: "p", nextStep: step }).kind).toBe("plan");
    expect(
      nextStepBadge({ disputeOpen: false, planId: null, nextStep: { ...step, awaitingApproval: true } }).kind,
    ).toBe("approval");
    const locked = nextStepBadge({
      disputeOpen: false,
      planId: null,
      nextStep: { ...step, legalReviewRequired: true },
    });
    expect(locked).toMatchObject({ kind: "locked", tone: "neutral", icon: IconLock, action: "notice_letter" });
    expect(nextStepBadge({ disputeOpen: false, planId: null, nextStep: step })).toMatchObject({
      kind: "step",
      tone: "warning",
      date: "2026-11-20",
    });
    expect(nextStepBadge({ disputeOpen: false, planId: null, nextStep: null }).kind).toBe("none");
  });

  it("never paints a reminder red: only legal measures carry the danger tone", () => {
    const badge = (kind: "remind" | "lawyer_letter") =>
      nextStepBadge({
        disputeOpen: false,
        planId: null,
        nextStep: { kind, date: "2026-11-20", legalReviewRequired: false, awaitingApproval: false },
      });
    expect(badge("remind")).toMatchObject({ tone: "info" });
    expect(badge("lawyer_letter")).toMatchObject({ tone: "danger" });
  });

  it("lists known channels LINE first, paper last", () => {
    expect(channelList(["letter", "email", "fax", "line"])).toEqual(["line", "email", "letter"]);
    expect(channelList([])).toEqual([]);
  });
});
