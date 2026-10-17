import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { tenantContext } from "./context";
import { authenticate, json, problem } from "./support";

type Schemas = components["schemas"];

/** `GET /v1/owner/search?q=` (D-180) over a small searchable set, ≥ 2 characters, tenant-scoped. */
const SEARCHABLE: Schemas["SearchHitDto"][] = [
  { type: "building", id: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c", label: "อาคาร A", sublabel: "5 ชั้น · 120 ห้อง" },
  { type: "unit", id: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7d", label: "A-201", sublabel: "อาคาร A · มีผู้เช่า" },
  { type: "unit", id: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7e", label: "A-202", sublabel: "อาคาร A · ว่าง" },
  { type: "party", id: "7e0a4c3b-8d5f-4a9c-9b2e-3f4a5b6c7d8e", label: "ผู้เช่า ทดสอบ", sublabel: "A-201" },
  { type: "device", id: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e5f", label: "GP-GW-000123", sublabel: "อาคาร A" },
];

export const searchHandlers: HttpHandler[] = [
  http.get("*/v1/owner/search", ({ request }) => {
    const auth = authenticate(request, "operator");
    if (!auth.ok) return problem("owner.search.query", auth.code);
    if (auth.audience !== "operator") return problem("owner.search.query", "auth.wrong_audience");
    const context = tenantContext(request, auth.persona);
    if (!context.ok || !context.tenant) return json({ data: [] } satisfies Schemas["SearchResultDto"]);
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
    if (q.length < 2) return json({ data: [] } satisfies Schemas["SearchResultDto"]);
    return json({
      data: SEARCHABLE.filter((hit) => hit.label.toLowerCase().includes(q) || hit.sublabel?.toLowerCase().includes(q)),
    } satisfies Schemas["SearchResultDto"]);
  }),
];
