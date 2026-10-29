import { describe, expect, it } from "vitest";

import { fingerprint, SubmissionKey } from "./useApiAction";

/** Review L10: one Idempotency-Key per logical submission — same body keeps it, a changed body renews it. */
describe("SubmissionKey (review L10)", () => {
  it("keeps the key for the same body (a retry after no answer) and renews it when the body changes", () => {
    const submission = new SubmissionKey();
    const first = submission.for({ name: "Campaign", max: 500 });
    expect(submission.for({ max: 500, name: "Campaign" })).toBe(first); // same body, other key order
    const edited = submission.for({ name: "Campaign 2", max: 500 });
    expect(edited).not.toBe(first);
    expect(submission.for({ name: "Campaign 2", max: 500 })).toBe(edited);
  });

  it("starts afresh after an answer, even for the same body", () => {
    const submission = new SubmissionKey();
    const first = submission.for({ a: 1 });
    submission.answered();
    expect(submission.for({ a: 1 })).not.toBe(first);
  });

  it("fingerprints nested objects independent of key order", () => {
    expect(fingerprint({ b: { y: 1, x: [2, 1] }, a: null })).toBe(fingerprint({ a: null, b: { x: [2, 1], y: 1 } }));
    expect(fingerprint({ a: [1, 2] })).not.toBe(fingerprint({ a: [2, 1] }));
  });
});
