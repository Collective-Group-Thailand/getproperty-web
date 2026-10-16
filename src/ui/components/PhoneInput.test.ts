import { describe, expect, it } from "vitest";

import { toE164 } from "./PhoneInput";

describe("toE164", () => {
  it("converts Thai national numbers", () => {
    expect(toE164("0812345678")).toBe("+66812345678");
    expect(toE164("081-234-5678")).toBe("+66812345678");
    expect(toE164("021234567")).toBe("+6621234567");
    expect(toE164("66812345678")).toBe("+66812345678");
  });
  it("refuses anything else", () => {
    expect(toE164("12345")).toBeNull();
    expect(toE164("")).toBeNull();
  });
});
