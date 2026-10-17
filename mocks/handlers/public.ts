import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { json, problem } from "./support";

type Schemas = components["schemas"];

/**
 * `/v1/public/*` (D-180) — anonymous marketing reads. The generated base handlers cover the operator
 * and platform surfaces only, so these answer here, typed against the contract. Prices are the mock's
 * own sample (shaped like the D-156 projection: a single price, a quoted range, an add-on).
 */
const PLANS: Schemas["PublicPlanDto"][] = [
  {
    key: "apartment_starter",
    kind: "plan",
    tenantType: "apartment",
    name: "Apartment Starter",
    summary: "ออกบิล เก็บเงิน และแจ้งผู้เช่าผ่าน LINE สำหรับหอพักที่จดมิเตอร์เอง",
    pricePerUnit: "25.00",
    priceFrom: null,
    priceTo: null,
    priceUnit: "unit_month",
    minimumUnits: 20,
    currency: "THB",
    vatIncluded: false,
    status: "proposed",
    features: ["A1", "A2", "A4", "resident_liff", "promptpay"],
  },
  {
    key: "apartment_smart",
    kind: "plan",
    tenantType: "apartment",
    name: "Apartment Smart",
    summary: "มิเตอร์อัจฉริยะส่งค่าอัตโนมัติ ออกบิลเอง และรายงานไฟน้ำสูญหาย",
    pricePerUnit: "40.00",
    priceFrom: null,
    priceTo: null,
    priceUnit: "unit_month",
    minimumUnits: null,
    currency: "THB",
    vatIncluded: false,
    status: "proposed",
    features: ["A1", "A2", "A3", "A4", "C2"],
  },
  {
    key: "access_addon",
    kind: "addon",
    tenantType: null,
    name: "Access Add-on",
    summary: "ระบบประตูและกุญแจอัจฉริยะต่ออาคาร",
    pricePerUnit: null,
    priceFrom: "3000.00",
    priceTo: "8000.00",
    priceUnit: "building_month",
    minimumUnits: null,
    currency: "THB",
    vatIncluded: false,
    status: "proposed",
    features: [],
  },
];

const TARIFFS: Record<string, Schemas["PublicTariffDto"]> = {
  mea: {
    utility: "electric",
    provider: "mea",
    nameTh: "ประเภท 1.1 บ้านอยู่อาศัย",
    tariffCode: "1.1",
    ceilingPerUnit: "4.6189",
    effectiveFrom: "2026-09-01",
    sourceUrl: "https://www.mea.or.th/",
  },
  pea: {
    utility: "electric",
    provider: "pea",
    nameTh: "ประเภท 1.1 บ้านอยู่อาศัย",
    tariffCode: "1.1",
    ceilingPerUnit: "4.6189",
    effectiveFrom: "2026-09-01",
    sourceUrl: "https://www.pea.co.th/",
  },
};

export const publicHandlers: HttpHandler[] = [
  http.get("*/v1/public/plans", () => json({ data: PLANS } satisfies Schemas["PublicPlansDto"])),
  http.get("*/v1/public/utility-tariffs/current", ({ request }) => {
    const url = new URL(request.url);
    const tariff =
      url.searchParams.get("utility") === "electric" ? TARIFFS[url.searchParams.get("provider") ?? ""] : undefined;
    return tariff ? json(tariff) : problem("public.utilityTariffs.current", "tariff.not_found");
  }),
];
