import { describe, expect, it } from "vitest";

import { rolloutProgress } from "./rollout";

const device = {
  deviceId: "d",
  status: "queued" as const,
  error: null,
  fromVersion: "0.3.0",
  updatedAt: "2026-10-20T00:00:00Z",
};

describe("rolloutProgress", () => {
  it("counts gateways in a terminal state as done", () => {
    expect(
      rolloutProgress({ counts: { applied: 2, failed: 1, commanded: 1 }, devices: [device, device, device, device] }),
    ).toEqual({
      total: 4,
      done: 3,
      applied: 2,
      failed: 1,
    });
  });

  it("reads missing counts as zero", () => {
    expect(rolloutProgress({ counts: {}, devices: [] })).toEqual({ total: 0, done: 0, applied: 0, failed: 0 });
  });
});
