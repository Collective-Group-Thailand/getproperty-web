import { describe, expect, it } from "vitest";

import { withChannel } from "./ChannelLink";

describe("withChannel (D-268)", () => {
  const liff = "https://liff.line.me/1650000000-abcd/rent/condo-ari";
  it("adds a known share-kit channel to the LIFF link", () => {
    expect(withChannel(liff, "?utm_source=facebook_group&ch=facebook_group")).toBe(`${liff}?ch=facebook_group`);
  });
  it("ignores an unknown channel and links that are not the LIFF", () => {
    expect(withChannel(liff, "?ch=tiktok")).toBe(liff);
    expect(withChannel("https://line.me/R/oaMessage/@x/?hi", "?ch=line")).toBe("https://line.me/R/oaMessage/@x/?hi");
  });
});
