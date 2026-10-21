import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";

import { artifactBucketKey, explainArtifactMissing, parseManifest } from "./OtaActions";

const manifest: Schemas["OtaManifestDto"] = {
  schema: 1,
  version: "0.5.0",
  arch: "arm64",
  channel: "stable",
  releasedAt: "2026-10-20T00:00:00Z",
  minAgentVersion: null,
  artifact: {
    url: "https://device.getproperty.example/v1/device/ota/artifacts/0.5.0/getproperty-edge-0.5.0-linux-arm64",
    sha256: "ab".repeat(32),
    size: 1024,
  },
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

describe("ota.artifact_missing (D-231)", () => {
  it("names the bucket key of an artefact served on the device host", () => {
    expect(artifactBucketKey(manifest.artifact.url)).toBe("releases/edge/0.5.0/getproperty-edge-0.5.0-linux-arm64");
    expect(artifactBucketKey("/v1/device/ota/artifacts/0.5.0/agent")).toBe("releases/edge/0.5.0/agent");
    expect(artifactBucketKey("https://cdn.example/edge/0.5.0/agent")).toBeNull();
    expect(artifactBucketKey("https://device.example/v1/device/ota/artifacts/0.5.0/a/b")).toBeNull();
  });

  it("replaces the detail with what to upload where, keeping code, title and request id", () => {
    const problem = new ApiError(422, {
      code: "ota.artifact_missing",
      title: "Release artefact missing",
      detail: "upload it first",
      requestId: "r-1",
    });
    const explained = explainArtifactMissing(problem, manifest, (key) => `upload to ${key}`) as ApiError;
    expect(explained).toBeInstanceOf(ApiError);
    expect(explained.code).toBe("ota.artifact_missing");
    expect(explained.title).toBe("Release artefact missing");
    expect(explained.requestId).toBe("r-1");
    expect(explained.detail).toBe("upload to releases/edge/0.5.0/getproperty-edge-0.5.0-linux-arm64");
  });

  it("leaves every other error alone", () => {
    const other = new ApiError(422, { code: "ota.signature_invalid" });
    expect(explainArtifactMissing(other, manifest, () => "x")).toBe(other);
    const plain = new Error("offline");
    expect(explainArtifactMissing(plain, manifest, () => "x")).toBe(plain);
  });
});
