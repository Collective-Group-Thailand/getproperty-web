import { describe, expect, it } from "vitest";

import { bahtTextEn, bahtTextTh } from "./words";

describe("amounts in words", () => {
  it.each([
    ["0.00", "ศูนย์บาทถ้วน"],
    ["1.00", "หนึ่งบาทถ้วน"],
    ["11.00", "สิบเอ็ดบาทถ้วน"],
    ["21.00", "ยี่สิบเอ็ดบาทถ้วน"],
    ["101.00", "หนึ่งร้อยเอ็ดบาทถ้วน"],
    ["15000.00", "หนึ่งหมื่นห้าพันบาทถ้วน"],
    ["16500.50", "หนึ่งหมื่นหกพันห้าร้อยบาทห้าสิบสตางค์"],
    ["2000000.00", "สองล้านบาทถ้วน"],
    ["0.25", "ยี่สิบห้าสตางค์"],
  ])("th %s", (amount, words) => expect(bahtTextTh(amount)).toBe(words));

  it.each([
    ["15000.00", "Fifteen thousand baht only"],
    ["16521.05", "Sixteen thousand five hundred twenty-one baht and five satang"],
    ["1000000.00", "One million baht only"],
  ])("en %s", (amount, words) => expect(bahtTextEn(amount)).toBe(words));
});
