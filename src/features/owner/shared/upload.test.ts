import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

import { whenScanned } from "./upload";

const pending = () => new ApiError(409, { code: "document.scan_pending", title: "", detail: "" });

describe("whenScanned", () => {
  it("repeats the read while the upload is still being scanned, then answers", async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(pending())
      .mockRejectedValueOnce(pending())
      .mockResolvedValue("ok");
    await expect(whenScanned(read, { delayMs: 1 })).resolves.toBe("ok");
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("does not repeat any other problem", async () => {
    const refused = new ApiError(422, { code: "validation.failed", title: "", detail: "" });
    const read = vi.fn<() => Promise<string>>().mockRejectedValue(refused);
    await expect(whenScanned(read, { delayMs: 1 })).rejects.toBe(refused);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last attempt with the scan problem", async () => {
    const read = vi.fn<() => Promise<string>>().mockRejectedValue(pending());
    await expect(whenScanned(read, { attempts: 3, delayMs: 1 })).rejects.toMatchObject({
      code: "document.scan_pending",
    });
    expect(read).toHaveBeenCalledTimes(3);
  });
});
