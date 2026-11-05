import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";
import { IconLetter } from "@/ui/icons/glyphs/letter";

import { bangkokMonth, eventLook, pinnedStep, timelineGroups } from "./timeline";

const event = (id: string, occurredAt: string, patch: Partial<Schemas["CollectionEventDto"]> = {}) =>
  ({
    id,
    occurredAt,
    kind: "step",
    action: "remind",
    outcome: "sent",
    amount: null,
    documentId: null,
    invoiceChargeId: null,
    reason: null,
    seq: 1,
    ...patch,
  }) as Schemas["CollectionEventDto"];

describe("collection timeline (J-DESIGN §4)", () => {
  it("groups by Bangkok month, newest first, keeping every event", () => {
    const groups = timelineGroups([
      event("a", "2026-09-03T02:00:00Z"),
      event("b", "2026-10-31T18:30:00Z"), // 1 Nov in Bangkok
      event("c", "2026-10-05T02:00:00Z"),
      event("d", "2026-10-20T02:00:00Z"),
    ]);
    expect(groups.map((group) => [group.month, group.events.map((e) => e.id)])).toEqual([
      ["2026-11", ["b"]],
      ["2026-10", ["d", "c"]],
      ["2026-09", ["a"]],
    ]);
    expect(bangkokMonth("2026-10-31T17:00:00Z")).toBe("2026-11");
  });

  it("keeps the API's order for events at the same instant", () => {
    const at = "2026-10-05T02:00:00Z";
    expect(timelineGroups([event("first", at), event("second", at)])[0]?.events.map((e) => e.id)).toEqual([
      "second",
      "first",
    ]);
  });

  it("reads a step by its action and outcome", () => {
    expect(eventLook(event("x", "2026-10-05T02:00:00Z", { action: "notice_letter" }))).toMatchObject({
      icon: IconLetter,
      tone: "primary",
      title: "action.notice_letter",
    });
    expect(eventLook(event("x", "2026-10-05T02:00:00Z", { outcome: "awaiting_approval" })).tone).toBe("warning");
    expect(eventLook(event("x", "2026-10-05T02:00:00Z", { outcome: "failed" })).tone).toBe("danger");
    expect(eventLook(event("x", "2026-10-05T02:00:00Z", { kind: "dispute_opened", action: null })).title).toBe(
      "event.dispute_opened",
    );
  });

  it("pins the next step until the case is resolved", () => {
    const nextStep = {
      action: "remind" as const,
      awaitingApproval: false,
      dueOn: "2026-11-10",
      legalReviewRequired: false,
      seq: 2,
      stepId: "s",
    };
    expect(pinnedStep({ state: "open", nextStep })).toBe(nextStep);
    expect(pinnedStep({ state: "paused", nextStep })).toBe(nextStep);
    expect(pinnedStep({ state: "resolved", nextStep })).toBeNull();
  });
});
