import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { plausibleVerifyCode, verifyView } from "./verify";

const answer: Schemas["VerifiedDocumentDto"] = {
  documentType: "debt_clearance",
  number: "DCL-2026-00004",
  status: "valid",
  issuedAt: "2026-11-05T03:00:00Z",
  asOf: "2026-11-05",
  validUntil: "2026-12-05",
  issuer: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์",
  unitNo: "A-101",
  holderInitials: "ศ.ว.",
};

describe("public verify page (D-306, PDPA)", () => {
  it("shows only the minimal fields, field by field", () => {
    const leaky = { ...answer, holderName: "คุณศิริพร วงศ์สุวรรณ", phone: "0812345678", partyId: "p-1" };
    const view = verifyView(leaky as Schemas["VerifiedDocumentDto"]);
    expect(Object.keys(view).sort()).toEqual(
      [
        "asOf",
        "documentType",
        "holderInitials",
        "issuedAt",
        "issuer",
        "number",
        "status",
        "unitNo",
        "validUntil",
      ].sort(),
    );
    expect(JSON.stringify(view)).not.toContain("ศิริพร");
    expect(JSON.stringify(view)).not.toContain("0812345678");
  });

  it("keeps initials as initials", () => {
    expect(verifyView(answer).holderInitials).toBe("ศ.ว.");
    expect(verifyView({ ...answer, holderInitials: "S.W. 0812345678" }).holderInitials).toBe("S.W. ");
  });

  it("checks a code's shape before asking the API", () => {
    expect(plausibleVerifyCode("K7Q2-M9XA")).toBe(true);
    expect(plausibleVerifyCode("../x")).toBe(false);
    expect(plausibleVerifyCode("abc")).toBe(false);
  });
});
