import { describe, expect, it } from "vitest";

import { completionKey } from "./completion";

const body = { notes: "ok", staffSignaturePng: "iVBORw0KGgo=" };

describe("completionKey (review M1)", () => {
  it("a first attempt gets a new key and the body's fingerprint", async () => {
    const first = await completionKey({}, body);
    expect(first.changed).toBe(true);
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the same body reuses the key (a replay); edited notes get a new key", async () => {
    const first = await completionKey({}, body);
    const draft = { completeKey: first.key, completeFingerprint: first.fingerprint };
    expect(await completionKey(draft, { ...body })).toEqual({ ...first, changed: false });
    const edited = await completionKey(draft, { ...body, notes: "ok, tap leaks" });
    expect(edited.key).not.toBe(first.key);
    expect(edited.changed).toBe(true);
  });

  it("a draft from before the rule keeps its key and records the fingerprint", async () => {
    const legacy = await completionKey({ completeKey: "k-1" }, body);
    expect(legacy.key).toBe("k-1");
    expect(legacy.changed).toBe(true);
  });
});
