import { describe, expect, it } from "vitest";

import { availableActions, canPerform, primaryAction, type ActionCatalogue } from "./nextActions";

const catalogue: ActionCatalogue<"issue" | "void" | "send-reminder"> = {
  issue: { labelKey: "invoice.actions.issue", icon: "bill", irreversible: true, tone: "primary" },
  void: { labelKey: "invoice.actions.void", icon: "x-circle", irreversible: true, tone: "destructive" },
  "send-reminder": { labelKey: "invoice.actions.remind", icon: "chat", irreversible: false, tone: "secondary" },
};

describe("next actions", () => {
  it("only interprets what the API lists", () => {
    expect(canPerform({ nextActions: ["issue"] }, "issue")).toBe(true);
    expect(canPerform({ nextActions: ["issue"] }, "void")).toBe(false);
    expect(canPerform({}, "issue")).toBe(false);
    expect(canPerform(null, "issue")).toBe(false);
  });

  it("keeps the API's order and skips actions the UI does not know", () => {
    const resource = { nextActions: ["void", "unknown-action", "send-reminder"] };
    expect(availableActions(resource, catalogue).map((a) => a.action)).toEqual(["void", "send-reminder"]);
    expect(primaryAction(resource, catalogue)).toBe("send-reminder");
    expect(primaryAction({ nextActions: ["void"] }, catalogue)).toBeUndefined();
  });
});
