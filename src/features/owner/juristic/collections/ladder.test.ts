import { describe, expect, it } from "vitest";

import { problemError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";

import {
  draftOf,
  gateReasonKey,
  isDirty,
  ladderRefusal,
  refusedGateReason,
  offsetError,
  stepErrors,
  stepLocks,
  stepPatch,
  toggleChannel,
} from "./ladder";

const step = (patch: Partial<Schemas["CollectionStepDto"]>): Schemas["CollectionStepDto"] => ({
  id: "s",
  seq: 1,
  action: "remind",
  offsetDays: 15,
  channels: ["line", "email"],
  templateKey: "juristic.collection.reminder",
  requiresApproval: false,
  enabled: true,
  legalReviewRequired: false,
  gateClosedReason: null,
  version: 1,
  ...patch,
});

describe("ladder editor (J-DESIGN §4)", () => {
  it("keeps the offset whole, in range and strictly between the neighbours", () => {
    const previous = step({ offsetDays: 3 });
    const next = step({ offsetDays: 30 });
    expect(offsetError("15", previous, next)).toBeNull();
    expect(offsetError("3", previous, next)).toBe("order");
    expect(offsetError("30", previous, next)).toBe("order");
    expect(offsetError("1.5", previous, next)).toBe("whole");
    expect(offsetError("", previous, next)).toBe("whole");
    expect(offsetError("4000", undefined, undefined)).toBe("range");
    expect(offsetError("0", undefined, next)).toBeNull();
  });

  it("toggles channels in a fixed order and wants at least one", () => {
    expect(toggleChannel(["email"], "line")).toEqual(["line", "email"]);
    expect(toggleChannel(["line", "email"], "line")).toEqual(["email"]);
    expect(stepErrors({ ...draftOf(step({})), channels: [] }, undefined, undefined)).toEqual({ channels: "channels" });
  });

  it("locks a legal measure counsel has not confirmed while its gate is closed", () => {
    const letter = step({
      action: "notice_letter",
      enabled: false,
      legalReviewRequired: true,
      gateClosedReason: "letter_wording_unverified",
    });
    expect(stepLocks(letter)).toEqual({
      legalLock: true,
      gateReason: "letter_wording_unverified",
      enableLocked: true,
      approvalLocked: false,
    });
    // Counsel confirmed (gate open): still shown as a legal measure while off, but it may be switched on.
    expect(stepLocks({ ...letter, gateClosedReason: null })).toMatchObject({ legalLock: true, enableLocked: false });
    expect(stepLocks(step({}))).toMatchObject({ legalLock: false, enableLocked: false });
  });

  it("never lets approval be dropped for suspension, lawyer letters and legal action", () => {
    expect(stepLocks(step({ action: "lawyer_letter" })).approvalLocked).toBe(true);
    expect(stepLocks(step({ action: "suspend_services" })).approvalLocked).toBe(true);
    expect(stepLocks(step({ action: "remind" })).approvalLocked).toBe(false);
  });

  it("sends only what changed", () => {
    const original = step({});
    const draft = draftOf(original);
    expect(isDirty(original, draft)).toBe(false);
    expect(stepPatch(original, { ...draft, offsetDays: " 20 " })).toEqual({ offsetDays: 20 });
    expect(stepPatch(original, { ...draft, channels: ["email", "line"] })).toEqual({});
    expect(stepPatch(original, { ...draft, channels: ["line"], enabled: false })).toEqual({
      channels: ["line"],
      enabled: false,
    });
  });

  it("explains the two refusals of the API in its own words", () => {
    expect(ladderRefusal(problemError(422, { code: "collections.legal_review_required" }))).toBe("legal");
    expect(ladderRefusal(problemError(422, { code: "collections.approval_required" }))).toBe("approval");
    expect(ladderRefusal(problemError(422, { code: "validation.failed" }))).toBeNull();
    expect(ladderRefusal(new Error("x"))).toBeNull();
  });

  it("names the gate reasons it knows and falls back for others", () => {
    expect(gateReasonKey("surcharge_cap_unset")).toBe("surcharge_cap_unset");
    expect(gateReasonKey("something_new")).toBe("unknown");
    expect(gateReasonKey(null)).toBeNull();
  });
});

describe("refusedGateReason (J-CR)", () => {
  it("reads the problem's gateClosedReason of a legal refusal only", () => {
    expect(
      refusedGateReason(
        problemError(422, { code: "collections.legal_review_required", gateClosedReason: "surcharge_disabled" }),
      ),
    ).toBe("surcharge_disabled");
    expect(refusedGateReason(problemError(422, { code: "collections.legal_review_required" }))).toBeNull();
    expect(refusedGateReason(problemError(409, { code: "collections.approval_required" }))).toBeNull();
    expect(refusedGateReason(new Error("x"))).toBeNull();
  });
});
