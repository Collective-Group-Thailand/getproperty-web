import { http, HttpResponse, type HttpHandler } from "msw";

import { TENANTS } from "../fixtures";
import { state } from "../state";
import { tenantContext } from "./context";
import { authenticate, json } from "./support";

/*
 * CONTRACT-REQUEST — mocks of endpoints the pinned contract does not publish yet, in the requested
 * shapes of src/lib/api/pending.ts and docs/contract-requests.md. Each one is deleted the day the
 * contract adopts the endpoint (the generated base handler then answers).
 */

function unauthenticated(): Response {
  return new HttpResponse(
    JSON.stringify({
      type: "https://errors.getproperty.co/auth.unauthenticated",
      title: "กรุณาเข้าสู่ระบบ",
      status: 401,
      code: "auth.unauthenticated",
      detail: "กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ",
      requestId: crypto.randomUUID(),
    }),
    { status: 401, headers: { "content-type": "application/problem+json" } },
  );
}

const SEARCHABLE = [
  { type: "building", id: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c", label: "อาคาร A", sublabel: "5 ชั้น · 120 ห้อง" },
  { type: "unit", id: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7d", label: "A-201", sublabel: "อาคาร A · มีผู้เช่า" },
  { type: "unit", id: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7e", label: "A-202", sublabel: "อาคาร A · ว่าง" },
  { type: "party", id: "7e0a4c3b-8d5f-4a9c-9b2e-3f4a5b6c7d8e", label: "ผู้เช่า ทดสอบ", sublabel: "A-201" },
  {
    type: "invoice",
    id: "8f1b5d4c-9e6a-4b0d-8c3f-4a5b6c7d8e9f",
    label: "INV-2611-0001",
    sublabel: "A-201 · พฤศจิกายน 2569",
  },
] as const;

export const contractRequestHandlers: HttpHandler[] = [
  // GET /v1/owner/search?q= — global search (owner console top bar).
  http.get("*/v1/owner/search", ({ request }) => {
    const auth = authenticate(request, "operator");
    if (!auth.ok || auth.audience !== "operator") return unauthenticated();
    const context = tenantContext(request, auth.persona);
    if (!context.ok || !context.tenant) return json({ data: [] });
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
    if (q.length < 2) return json({ data: [] });
    return json({
      data: SEARCHABLE.filter((hit) => hit.label.toLowerCase().includes(q) || hit.sublabel.toLowerCase().includes(q)),
    });
  }),

  // GET /v1/public/plans — pricing page (D-156), no authentication. Values are the mock's, not D-156's.
  http.get("*/v1/public/plans", () =>
    json({
      data: [
        {
          key: "apartment_starter",
          tenantType: "apartment",
          name: "Apartment Starter",
          summary: "บิล ค่าน้ำไฟ และรับชำระผ่าน PromptPay สำหรับอพาร์ตเมนต์",
          pricePerUnit: "25.00",
          priceUnit: "unit_month",
          minimumUnits: 20,
          currency: "THB",
          features: ["ออกบิลอัตโนมัติ", "แจ้งบิลทาง LINE", "รับชำระ PromptPay"],
        },
        {
          key: "apartment_smart",
          tenantType: "apartment",
          name: "Apartment Smart",
          summary: "เพิ่มมิเตอร์อัจฉริยะ อ่านค่าเองทุกเดือน",
          pricePerUnit: "40.00",
          priceUnit: "unit_month",
          minimumUnits: 20,
          currency: "THB",
          features: ["ทุกอย่างใน Starter", "มิเตอร์อัจฉริยะ", "รายงานน้ำไฟรั่วไหล"],
        },
        {
          key: "landlord",
          tenantType: "landlord",
          name: "Landlord",
          summary: "สำหรับเจ้าของห้องให้เช่าไม่กี่ห้อง",
          pricePerUnit: null,
          priceUnit: "month",
          minimumUnits: null,
          currency: "THB",
          features: ["ฟรีสูงสุด 3 ห้อง"],
        },
      ],
    }),
  ),

  // GET /v1/public/utility-tariffs/current?utility=&provider= — loss-calculator teaser, no authentication.
  http.get("*/v1/public/utility-tariffs/current", ({ request }) => {
    const url = new URL(request.url);
    const utility = url.searchParams.get("utility") === "water" ? "water" : "electric";
    const provider = url.searchParams.get("provider") ?? (utility === "water" ? "mwa" : "mea");
    return json({
      utility,
      provider,
      nameTh: utility === "water" ? "ประเภท 1 ที่อยู่อาศัย" : "ประเภท 1.1 บ้านอยู่อาศัย",
      tariffCode: utility === "water" ? "residential" : "1.1",
      ceilingPerUnit: utility === "water" ? "10.9300" : "4.6189",
      effectiveFrom: "2026-09-01",
      sourceUrl: provider === "pea" ? "https://www.pea.co.th/" : "https://www.mea.or.th/",
    });
  }),

  // POST /v1/{owner,staff,admin}/telemetry/web-vitals — RUM through the BFF.
  ...(["owner", "staff", "admin"] as const).map((surface) =>
    http.post(`*/v1/${surface}/telemetry/web-vitals`, async ({ request }) => {
      state.webVitals.push({ surface, ...((await request.json().catch(() => ({}))) as object) });
      if (state.webVitals.length > 500) state.webVitals.splice(0, state.webVitals.length - 500);
      return new HttpResponse(null, { status: 202 });
    }),
  ),

  // POST /v1/staff/readings — one meter reading (F4; the offline queue's target). Idempotent on the key.
  http.post("*/v1/staff/readings", async ({ request }) => {
    const auth = authenticate(request, "operator");
    if (!auth.ok || auth.audience !== "operator") return unauthenticated();
    const key = request.headers.get("idempotency-key");
    if (!key) {
      return new HttpResponse(
        JSON.stringify({
          code: "idempotency.key_required",
          status: 400,
          title: "",
          detail: "",
          type: "",
          requestId: crypto.randomUUID(),
        }),
        { status: 400, headers: { "content-type": "application/problem+json" } },
      );
    }
    const body = (await request.json().catch(() => ({}))) as { register?: string; meterId?: string };
    const replay = state.readings.get(key);
    if (replay) return json({ id: key, ...(replay.body as object) }, 201, { "idempotent-replayed": "true" });
    if (body.register === "-1" || body.meterId === "00000000-0000-4000-8000-000000000000") {
      return new HttpResponse(
        JSON.stringify({
          type: "https://errors.getproperty.co/reading.lower_than_previous",
          title: "ค่ามิเตอร์ต่ำกว่าครั้งก่อน",
          status: 422,
          code: "reading.lower_than_previous",
          detail: "ค่าที่จดต่ำกว่าครั้งก่อน ตรวจสอบตัวเลขหรือแจ้งเปลี่ยนมิเตอร์",
          requestId: crypto.randomUUID(),
        }),
        { status: 422, headers: { "content-type": "application/problem+json" } },
      );
    }
    state.readings.set(key, { idempotencyKey: key, body, at: new Date().toISOString() });
    return json({ id: key, ...body }, 201);
  }),
];

/** For tests: the tenant ids the search mock answers for. */
export const SEARCH_TENANTS = Object.values(TENANTS).map((tenant) => tenant.profile.id);
