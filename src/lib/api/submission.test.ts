import { describe, expect, it, vi } from "vitest";

import { fingerprint, FrozenSubmission, objectIdentity, PhotoUploads } from "./submission";

describe("FrozenSubmission (review M1)", () => {
  it("reuses the key and the exact body for an unchanged draft, builds once", async () => {
    const submission = new FrozenSubmission<{ at: string; photo: string }>();
    let n = 0;
    const build = vi.fn(async () => ({ at: `t${++n}`, photo: `doc-${n}` }));
    const first = await submission.prepare({ register: "12.5", photo: "p1" }, build);
    const retry = await submission.prepare({ photo: "p1", register: "12.5" }, build);
    expect(retry).toEqual({ ...first, reused: true });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("a changed draft is a new submission with a new key and a fresh body", async () => {
    const submission = new FrozenSubmission<{ at: string }>();
    let n = 0;
    const build = async () => ({ at: `t${++n}` });
    const first = await submission.prepare({ register: "12.5" }, build);
    const changed = await submission.prepare({ register: "12.6" }, build);
    expect(changed.key).not.toBe(first.key);
    expect(changed.body).toEqual({ at: "t2" });
    expect(changed.reused).toBe(false);
  });

  it("a failed build leaves nothing behind, and forget() starts over", async () => {
    const submission = new FrozenSubmission<{ ok: true }>();
    await expect(submission.prepare({ a: 1 }, async () => Promise.reject(new Error("offline")))).rejects.toThrow();
    expect(submission.key).toBeUndefined();
    const ok = await submission.prepare({ a: 1 }, async () => ({ ok: true as const }));
    submission.forget();
    const again = await submission.prepare({ a: 1 }, async () => ({ ok: true as const }));
    expect(again.key).not.toBe(ok.key);
  });
});

describe("PhotoUploads", () => {
  it("uploads a photo once, retries one whose upload failed", async () => {
    const uploads = new PhotoUploads();
    const photo = new Blob(["x"]);
    const run = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("doc-1");
    await expect(uploads.upload(photo, run)).rejects.toThrow();
    expect(await uploads.upload(photo, run)).toBe("doc-1");
    expect(await uploads.upload(photo, run)).toBe("doc-1");
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("fingerprint / objectIdentity", () => {
  it("ignores key order and tells objects apart by identity", () => {
    expect(fingerprint({ b: 1, a: { d: 2, c: 3 } })).toBe(fingerprint({ a: { c: 3, d: 2 }, b: 1 }));
    const file = new Blob(["x"]);
    expect(objectIdentity(file)).toBe(objectIdentity(file));
    expect(objectIdentity(new Blob(["x"]))).not.toBe(objectIdentity(file));
    expect(objectIdentity(null)).toBeNull();
  });
});
