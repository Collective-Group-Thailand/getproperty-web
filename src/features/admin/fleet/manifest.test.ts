import { describe, expect, it } from "vitest";

import { parseManifest } from "./OtaActions";

const manifest = {
  schema: 1,
  version: "0.5.0",
  arch: "arm64",
  channel: "stable",
  releasedAt: "2026-10-20T00:00:00Z",
  minAgentVersion: null,
  artifact: { url: "https://releases.getproperty.co/edge/0.5.0/arm64.tar.zst", sha256: "ab".repeat(32), size: 1024 },
  signature: { alg: "ed25519", keyId: "gp-ota-2026", value: "c2lnbmF0dXJl" },
};

describe("parseManifest", () => {
  it("passes a signed manifest through unchanged", () => {
    expect(parseManifest(JSON.stringify(manifest))).toEqual({ manifest });
  });

  it("names what is wrong", () => {
    expect(parseManifest("{not json")).toEqual({ error: "json" });
    expect(parseManifest(JSON.stringify({ ...manifest, signature: undefined }))).toEqual({ error: "shape" });
    expect(parseManifest("null")).toEqual({ error: "shape" });
  });
});
