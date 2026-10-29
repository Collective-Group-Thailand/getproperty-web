import { describe, expect, it } from "vitest";

import { withChannel } from "./ChannelLink";

describe("withChannel (D-268)", () => {
  const liff = "https://liff.line.me/1650000000-abcd/rent/condo-ari";
  it("adds a known share-kit channel to the LIFF link", () => {
    expect(withChannel(liff, "?utm_source=facebook_group&ch=facebook_group")).toBe(`${liff}?ch=facebook_group`);
  });
  it("carries the sponsored LINE campaign and Facebook Page channels (G6 D-300, G4)", () => {
    expect(withChannel(liff, "?utm_source=line&utm_medium=sponsored&ch=line_sponsored")).toBe(
      `${liff}?ch=line_sponsored`,
    );
    expect(withChannel(liff, "?ch=facebook_page")).toBe(`${liff}?ch=facebook_page`);
  });
  it("ignores an unknown channel and links that are not the LIFF", () => {
    expect(withChannel(liff, "?ch=tiktok")).toBe(liff);
    expect(withChannel("https://line.me/R/oaMessage/@x/?hi", "?ch=line")).toBe("https://line.me/R/oaMessage/@x/?hi");
  });
});
