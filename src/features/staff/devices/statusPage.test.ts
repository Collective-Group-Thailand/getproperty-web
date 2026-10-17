import { describe, expect, it } from "vitest";

import { statusPageUrl } from "./statusPage";

describe("statusPageUrl", () => {
  it("links private LAN addresses and .local names on port 8080", () => {
    expect(statusPageUrl("192.168.1.50")).toBe("http://192.168.1.50:8080/");
    expect(statusPageUrl(" 10.0.0.7 ")).toBe("http://10.0.0.7:8080/");
    expect(statusPageUrl("172.20.1.2")).toBe("http://172.20.1.2:8080/");
    expect(statusPageUrl("gp-gw-000123.local")).toBe("http://gp-gw-000123.local:8080/");
  });

  it("refuses public hosts, malformed addresses and anything else", () => {
    expect(statusPageUrl("8.8.8.8")).toBeNull();
    expect(statusPageUrl("172.32.0.1")).toBeNull();
    expect(statusPageUrl("192.168.1.300")).toBeNull();
    expect(statusPageUrl("example.com")).toBeNull();
    expect(statusPageUrl("javascript:alert(1)")).toBeNull();
    expect(statusPageUrl("")).toBeNull();
  });
});
