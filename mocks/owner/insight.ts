import { http, HttpResponse, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { idempotent as platformIdempotent, platform } from "../platform/support";
import { state } from "../state";
import { BUILDING_A, BUILDING_B } from "./world";
import { body, idempotent, json, mutating, owner, paged, problem, validation } from "./support";

type Schemas = components["schemas"];

/*
 * Pack G9 (D-301; O-035, O-036, O-009, O-028) on the owner, admin and public surfaces.
 * - Reviews: the sample apartment (building A) and the landlord's Ari condo have verified reviews in every state.
 *   Owners list / reply / report (never hide or delete); moderators approve / reject / hide / restore / dismiss; the
 *   public page of `condo-ari-1br-sunlit` shows the Ari building's published reviews. Replies with a phone number,
 *   e-mail or link are refused like the API (`review.personal_data`).
 * - Energy insight: building A has 30 days of data and a score; building B has too little (`insufficient_data`);
 *   other buildings answer like A. Only the owner tenant may opt in (the sample tenant owns A and B).
 * - Listing assistant: on, 30 a month, 27 used; `POST /__mock/owner/insight/assistant?fail=limit|unavailable|rejected`
 *   makes the next call fail that way.
 */

const SAMPLE = TENANTS.sample.profile.id;
const LANDLORD = TENANTS.landlord.profile.id;
const ARI_BUILDING = "6a1f0c3e-2b4d-4e5f-8a9b-0c1d2e3f4a01";
const ARI_SLUG = "condo-ari-1br-sunlit";
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

interface MockReview {
  tenantId: string;
  slugs: string[];
  dto: Schemas["AdminReviewDto"];
}

export interface MockInsightWorld {
  reviews: MockReview[];
  energy: Record<string, Schemas["EnergyOptinDto"]>;
  assistant: { enabled: boolean; monthlyLimit: number; used: number; fail: string | null };
}

function review(
  id: string,
  tenantId: string,
  buildingId: string,
  buildingName: string,
  input: Partial<Schemas["AdminReviewDto"]> & Pick<Schemas["AdminReviewDto"], "rating" | "body" | "state">,
  slugs: string[] = [],
): MockReview {
  return {
    tenantId,
    slugs,
    dto: {
      id,
      tenantId,
      buildingId,
      buildingName,
      language: "th",
      tenure: { from: "2025-02", to: "2026-08" },
      submittedAt: iso(-20),
      publishedAt: input.state === "published" || input.state === "hidden" ? iso(-18) : null,
      moderatedAt: input.state === "pending_moderation" ? null : iso(-18),
      moderationReason: null,
      ownerReply: null,
      ownerRepliedAt: null,
      reportedAt: null,
      reportReason: null,
      ...input,
    },
  };
}

export function initialInsightWorld(): MockInsightWorld {
  const rid = (n: number) => `9e0f0000-0000-4000-8000-0000000f${String(n).padStart(4, "0")}`;
  return {
    reviews: [
      review(
        rid(1),
        LANDLORD,
        ARI_BUILDING,
        "Ari Residence",
        {
          rating: 5,
          body: "ห้องสว่าง เดินไป BTS อารีย์ไม่ถึง 5 นาที เจ้าของตอบไวมาก ซ่อมแอร์ให้ภายในวันเดียว",
          state: "published",
          ownerReply: "ขอบคุณมากค่ะ ยินดีที่ได้ดูแลนะคะ",
          ownerRepliedAt: iso(-15),
        },
        [ARI_SLUG],
      ),
      review(
        rid(2),
        LANDLORD,
        ARI_BUILDING,
        "Ari Residence",
        {
          rating: 4,
          body: "Quiet building, good security. Lift can be slow in the morning.",
          language: "en",
          state: "published",
          tenure: { from: "2025-06", to: null },
        },
        [ARI_SLUG],
      ),
      review(
        rid(3),
        LANDLORD,
        ARI_BUILDING,
        "Ari Residence",
        {
          rating: 3,
          body: "ห้องโอเค แต่ที่จอดรถไม่พอช่วงเย็น",
          state: "published",
          tenure: { from: "2024-11", to: "2025-11" },
        },
        [ARI_SLUG],
      ),
      review(
        rid(4),
        LANDLORD,
        ARI_BUILDING,
        "Ari Residence",
        {
          rating: 1,
          body: "ข้อความถูกซ่อนเพราะมีคำหยาบ",
          state: "hidden",
          moderationReason: "มีถ้อยคำหยาบคายต่อบุคคล",
        },
        [ARI_SLUG],
      ),
      review(
        rid(5),
        LANDLORD,
        ARI_BUILDING,
        "Ari Residence",
        {
          rating: 4,
          body: "เพื่อนบ้านดี เงียบ เหมาะกับคนทำงาน",
          state: "pending_moderation",
          submittedAt: iso(-1),
        },
        [ARI_SLUG],
      ),
      review(rid(11), SAMPLE, BUILDING_A, "อาคาร A", {
        rating: 4,
        body: "หอสะอาด ค่าน้ำค่าไฟตามจริง จ่ายผ่าน LINE สะดวก",
        state: "published",
      }),
      review(rid(12), SAMPLE, BUILDING_A, "อาคาร A", {
        rating: 2,
        body: "แจ้งซ่อมก๊อกน้ำแล้วรอนานเกือบสัปดาห์",
        state: "published",
        tenure: { from: "2025-09", to: null },
        reportedAt: iso(-2),
        reportReason: "ข้อมูลไม่ตรง ช่างเข้าไปภายใน 2 วัน มีใบสั่งงานยืนยัน",
      }),
      review(rid(13), SAMPLE, BUILDING_A, "อาคาร A", {
        rating: 5,
        body: "ผู้ดูแลอาคารใจดี ช่วยรับพัสดุให้ทุกวัน",
        state: "pending_moderation",
        submittedAt: iso(-1),
      }),
    ],
    energy: {},
    assistant: { enabled: true, monthlyLimit: 30, used: 27, fail: null },
  };
}

const world = (): MockInsightWorld => state.insight;
export const insightWorld = world;

/** Message safety like the API's `review-rules.ts`: phone, e-mail, LINE id, links, account / ID numbers. */
const PERSONAL = [/\+?\d[\d\s-]{8,}\d/, /[\w.+-]+@[\w-]+\.[\w.]+/, /https?:\/\/|www\./i, /\bline\s*(id)?\s*[:@]/i];
const personal = (text: string) => PERSONAL.some((pattern) => pattern.test(text));

const ownerDto = (r: MockReview): Schemas["OwnerReviewDto"] => ({
  id: r.dto.id,
  buildingId: r.dto.buildingId,
  buildingName: r.dto.buildingName,
  rating: r.dto.rating,
  body: r.dto.body,
  language: r.dto.language,
  tenure: r.dto.tenure,
  state: r.dto.state,
  publishedAt: r.dto.publishedAt,
  moderationReason: r.dto.state === "hidden" ? r.dto.moderationReason : null,
  ownerReply: r.dto.ownerReply,
  ownerRepliedAt: r.dto.ownerRepliedAt,
  reportedAt: r.dto.reportedAt,
  reportReason: r.dto.reportReason,
});

/** Owners see published and hidden reviews of their buildings only (never pending, rejected or withdrawn ones). */
const ownerVisible = (r: MockReview, tenantId: string) =>
  r.tenantId === tenantId && (r.dto.state === "published" || r.dto.state === "hidden");

function summary(rows: MockReview[]): Schemas["ReviewSummaryDto"] {
  const distribution = [0, 0, 0, 0, 0];
  for (const r of rows) distribution[r.dto.rating - 1]! += 1;
  const count = rows.length;
  const average = count
    ? (Math.round((rows.reduce((a, r) => a + r.dto.rating, 0) / count) * 10) / 10).toFixed(1)
    : null;
  return { count, average, distribution };
}

// ---- Energy insight ----

function energyDto(tenantId: string, buildingId: string): Schemas["EnergyInsightDto"] | null {
  const building = state.owner.buildings.find((b) => b.id === buildingId);
  if (!building || tenantId !== SAMPLE) return null;
  const optin = world().energy[buildingId] ?? null;
  const thin = buildingId === BUILDING_B;
  const to = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  return {
    buildingId,
    buildingName: building.name,
    // The sample tenant owns its buildings; a building seen through a grant is read-only (`energy.owner_required`).
    canOptIn: building.access !== "grant",
    consent: {
      purposeKey: "energy.insight",
      version: 1,
      title: "แบ่งปันตัวเลขพลังงานของอาคารกับ getenergy",
      bodyMarkdown:
        "ร่าง ⚖ — เลือกได้ ไม่มีผลต่อบริการอื่น\n\nเราส่งเฉพาะยอดรวมของอาคาร (คะแนน การใช้ไฟรวม สัดส่วนส่วนกลาง ความต้องการสูงสุด ชั่วโมงปั๊มน้ำ จังหวัดและเขต ช่วงขนาดอาคาร) ให้ getenergy เพื่อเสนอวิธีประหยัดพลังงาน ไม่มีชื่อ ช่องทางติดต่อ เลขห้อง หรือการใช้ไฟของผู้เช่า\n\nหยุดได้ทุกเมื่อ และ getenergy จะลบข้อมูลที่ได้รับ",
    },
    optin,
    reason: thin ? "insufficient_data" : "ok",
    score: thin ? null : 74,
    scoreModel: "v1",
    windowFrom: from,
    windowTo: to,
    metrics: thin
      ? {
          basis: "sum",
          totalKwh: "812.400",
          commonAreaKwh: "190.000",
          commonAreaShare: "0.2339",
          peakKw: "9.800",
          averageKw: "4.835",
          loadFactor: "0.4934",
          pumpHoursPerDay: null,
          dataDays: 7,
        }
      : {
          basis: "main",
          totalKwh: "18250.500",
          commonAreaKwh: "5840.160",
          commonAreaShare: "0.3200",
          peakKw: "48.200",
          averageKw: "25.347",
          loadFactor: "0.5259",
          pumpHoursPerDay: "11.50",
          dataDays: 30,
        },
    penalties: thin
      ? { commonShare: "0.0", lowLoadFactor: "0.0", pumpHours: "0.0" }
      : { commonShare: "16.0", lowLoadFactor: "0.0", pumpHours: "10.0" },
  };
}

export const insightHandlers: HttpHandler[] = [
  // ---- Owner: reviews ----
  http.get("*/v1/owner/reviews", ({ request }) => {
    const ok = owner(request, "owner.reviews.list");
    if (ok instanceof Response) return ok;
    const p = new URL(request.url).searchParams;
    const rows = world()
      .reviews.filter(
        (r) =>
          ownerVisible(r, ok.tenantId) &&
          (!p.get("buildingId") || r.dto.buildingId === p.get("buildingId")) &&
          (!p.get("state") || r.dto.state === p.get("state")),
      )
      .sort((a, b) => (b.dto.publishedAt ?? "").localeCompare(a.dto.publishedAt ?? ""))
      .map(ownerDto);
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/reviews/:reviewId", ({ request, params }) => {
    const ok = owner(request, "owner.reviews.get");
    if (ok instanceof Response) return ok;
    const r = world().reviews.find((x) => x.dto.id === params.reviewId && ownerVisible(x, ok.tenantId));
    return r ? json(ownerDto(r)) : problem("owner.reviews.get", "http.not_found");
  }),
  http.put("*/v1/owner/reviews/:reviewId/reply", async ({ request, params }) => {
    const op = "owner.reviews.reply";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const r = world().reviews.find((x) => x.dto.id === params.reviewId && ownerVisible(x, ok.tenantId));
    if (!r) return problem(op, "http.not_found");
    if (r.dto.state !== "published") return problem(op, "review.invalid_state");
    const { reply } = await body<Schemas["ReviewReplyDto"]>(request);
    const text = (reply ?? "").trim();
    if (!text || text.length > 1000) return validation(op, "reply", "1–1000 characters", "required");
    if (personal(text))
      return problem(op, "review.personal_data", {
        errors: [{ path: "reply", code: "personal_data", message: "no phone numbers, e-mail, LINE ids or links" }],
      });
    r.dto = { ...r.dto, ownerReply: text, ownerRepliedAt: new Date().toISOString() };
    return json(ownerDto(r));
  }),
  http.post("*/v1/owner/reviews/:reviewId/actions/report", async ({ request, params }) => {
    const op = "owner.reviews.report";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const r = world().reviews.find((x) => x.dto.id === params.reviewId && ownerVisible(x, ok.tenantId));
    if (!r) return problem(op, "http.not_found");
    if (r.dto.state !== "published") return problem(op, "review.invalid_state");
    const { reason } = await body<Schemas["ModerationReasonDto"]>(request);
    if (!reason?.trim()) return validation(op, "reason", "required", "required");
    r.dto = { ...r.dto, reportedAt: new Date().toISOString(), reportReason: reason.trim() };
    return json(ownerDto(r));
  }),

  // ---- Public: the listing page's reviews ----
  http.get("*/v1/public/listings/:slug/reviews", ({ request, params }) => {
    const rows = world()
      .reviews.filter((r) => r.slugs.includes(String(params.slug)) && r.dto.state === "published")
      .sort((a, b) => (b.dto.publishedAt ?? "").localeCompare(a.dto.publishedAt ?? ""));
    const page = paged(
      rows.map((r): Schemas["PublicReviewDto"] => ({
        id: r.dto.id,
        rating: r.dto.rating,
        body: r.dto.body ?? "",
        language: r.dto.language,
        tenure: r.dto.tenure,
        publishedAt: r.dto.publishedAt ?? r.dto.submittedAt,
        verifiedTenant: true,
        ownerReply: r.dto.ownerReply,
        ownerRepliedAt: r.dto.ownerRepliedAt,
      })),
      request,
    );
    return HttpResponse.json({ ...page, summary: summary(rows) });
  }),

  // ---- Owner: energy insight ----
  http.get("*/v1/owner/buildings/:buildingId/energy-insight", ({ request, params }) => {
    const ok = owner(request, "owner.buildings.energyInsight");
    if (ok instanceof Response) return ok;
    const dto = energyDto(ok.tenantId, String(params.buildingId));
    return dto ? json(dto) : problem("owner.buildings.energyInsight", "http.not_found");
  }),
  http.post("*/v1/owner/buildings/:buildingId/energy-insight/actions/opt-in", ({ request, params }) => {
    const op = "owner.buildings.energyInsightOptIn";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const buildingId = String(params.buildingId);
      const dto = energyDto(ok.tenantId, buildingId);
      if (!dto) return problem(op, "http.not_found");
      if (!dto.canOptIn) return problem(op, "energy.owner_required");
      if (input.consentVersion !== dto.consent?.version) return problem(op, "energy.consent_required");
      const current = world().energy[buildingId];
      if (current?.state !== "opted_in") {
        world().energy[buildingId] = {
          state: "opted_in",
          optedInAt: new Date().toISOString(),
          optedOutAt: null,
          // The subscriber shares a snapshot at once when there is a score.
          lastSharedAt: dto.score === null ? null : new Date().toISOString(),
          lastScore: dto.score,
        };
      }
      return { status: 200, body: energyDto(ok.tenantId, buildingId) };
    });
  }),
  http.post("*/v1/owner/buildings/:buildingId/energy-insight/actions/opt-out", ({ request, params }) => {
    const op = "owner.buildings.energyInsightOptOut";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const buildingId = String(params.buildingId);
    const dto = energyDto(ok.tenantId, buildingId);
    if (!dto) return problem(op, "http.not_found");
    const current = world().energy[buildingId];
    if (current?.state !== "opted_in") return problem(op, "energy.invalid_state");
    world().energy[buildingId] = { ...current, state: "opted_out", optedOutAt: new Date().toISOString() };
    return json(energyDto(ok.tenantId, buildingId));
  }),

  // ---- Owner: listing assistant ----
  http.get("*/v1/owner/listing-assistant", ({ request }) => {
    const ok = owner(request, "owner.listingAssistant.quota");
    if (ok instanceof Response) return ok;
    const a = world().assistant;
    return json({ enabled: a.enabled, monthlyLimit: a.monthlyLimit, usedThisMonth: a.used });
  }),
  http.post("*/v1/owner/listings/:listingId/assistant", ({ request, params }) => {
    const op = "owner.listings.assistant";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const a = world().assistant;
      const listing = state.listingWorld.listings.find(
        (l) => l.tenantId === ok.tenantId && l.dto.id === params.listingId,
      );
      if (!listing) return problem(op, "http.not_found");
      if (!a.enabled) return problem(op, "assistant.disabled");
      const fail = a.fail;
      a.fail = null;
      if (fail === "limit" || a.used >= a.monthlyLimit) return problem(op, "assistant.limit_reached");
      if (fail === "unavailable") return problem(op, "assistant.unavailable");
      if (fail === "rejected") return problem(op, "assistant.output_rejected");
      const languages = (Array.isArray(input.languages) ? input.languages : []) as Schemas["AssistantLanguage"][];
      if (languages.length === 0) return validation(op, "languages", "choose at least one language", "required");
      const l = listing.dto;
      const size = l.sizeSqm ? `${Number(l.sizeSqm)} ตร.ม.` : "";
      const drafts: Schemas["ListingAssistantDraftsDto"] = {
        th: languages.includes("th")
          ? {
              title: `${l.titleTh.split(" ").slice(0, 3).join(" ")} ${size} พร้อมเข้าอยู่`.trim().slice(0, 120),
              description: `ห้อง ${l.bedrooms ?? 1} ห้องนอน ${size} ${l.furnishing === "fully_furnished" ? "เฟอร์นิเจอร์ครบ" : ""} ค่าเช่า ${Number(l.rent).toLocaleString("th-TH")} บาทต่อเดือน มัดจำ ${l.depositMonths} เดือน สัญญาขั้นต่ำ ${l.minTermMonths} เดือน`,
            }
          : null,
        en: languages.includes("en")
          ? {
              title:
                `${l.bedrooms ?? 1}-bedroom ${l.unitKind === "condo_unit" ? "condo" : "home"} ${l.sizeSqm ? `${Number(l.sizeSqm)} sq m` : ""}, ready to move in`
                  .replace(/\s+/g, " ")
                  .trim(),
              description: `A ${l.bedrooms ?? 1}-bedroom place for THB ${Number(l.rent).toLocaleString("en-US")} a month. Deposit ${l.depositMonths} months, minimum lease ${l.minTermMonths} months.`,
            }
          : null,
        zh: languages.includes("zh")
          ? {
              title: `${l.bedrooms ?? 1}室 公寓出租`,
              description: `月租 ${Number(l.rent).toLocaleString("en-US")} 泰铢，押金 ${l.depositMonths} 个月。`,
            }
          : null,
      };
      a.used += 1;
      const result: Schemas["ListingAssistantResultDto"] = {
        drafts,
        model: "fake-listing-writer",
        disclaimer:
          "ร่างจาก AI ตรวจข้อเท็จจริงทุกข้อก่อนเผยแพร่ ระบบไม่บันทึกข้อความนี้จนกว่าคุณกดบันทึก / AI draft — check every fact before publishing.",
        photosUsed: input.includePhotos ? Math.min(3, l.photos.length) : 0,
        usedThisMonth: a.used,
        monthlyLimit: a.monthlyLimit,
      };
      return { status: 200, body: result };
    });
  }),
];

// ---- Admin: the moderation queue ----

export const insightAdminHandlers: HttpHandler[] = [
  http.get("*/v1/admin/reviews", ({ request }) => {
    const ok = platform(request, "admin.reviews.list", "admin.listing.moderate");
    if (ok instanceof Response) return ok;
    const p = new URL(request.url).searchParams;
    const rows = world()
      .reviews.filter(
        (r) =>
          (!p.get("state") || r.dto.state === p.get("state")) &&
          (p.get("reported") !== "true" || (r.dto.reportedAt !== null && r.dto.state === "published")),
      )
      .sort((a, b) => b.dto.submittedAt.localeCompare(a.dto.submittedAt))
      .map((r) => r.dto);
    return json(paged(rows, request));
  }),
  http.get("*/v1/admin/reviews/:reviewId", ({ request, params }) => {
    const ok = platform(request, "admin.reviews.get", "admin.listing.moderate");
    if (ok instanceof Response) return ok;
    const r = world().reviews.find((x) => x.dto.id === params.reviewId);
    return r ? json(r.dto) : problem("admin.reviews.get", "http.not_found");
  }),
  http.post("*/v1/admin/reviews/:reviewId/actions/:action", ({ request, params }) => {
    const action = String(params.action);
    const op = `admin.reviews.${action === "dismiss-report" ? "dismissReport" : action}`;
    const ok = platform(request, op, "admin.listing.moderate");
    if (ok instanceof Response) return ok;
    const r = world().reviews.find((x) => x.dto.id === params.reviewId);
    if (!r) return problem(op, "http.not_found");
    const at = new Date().toISOString();
    if (action === "dismiss-report") {
      if (!r.dto.reportedAt) return problem(op, "review.invalid_state");
      r.dto = { ...r.dto, reportedAt: null, reportReason: null };
      return json(r.dto);
    }
    const decide = (input: Record<string, unknown>) => {
      const reason = typeof input.reason === "string" ? input.reason.trim() : "";
      if (action === "approve") {
        if (r.dto.state !== "pending_moderation") return problem(op, "review.invalid_state");
        r.dto = { ...r.dto, state: "published", publishedAt: at, moderatedAt: at };
      } else if (action === "reject" || action === "hide") {
        if (!reason) return validation(op, "reason", "required", "required");
        const from = action === "reject" ? "pending_moderation" : "published";
        if (r.dto.state !== from) return problem(op, "review.invalid_state");
        r.dto = {
          ...r.dto,
          state: action === "reject" ? "rejected" : "hidden",
          moderationReason: reason,
          moderatedAt: at,
        };
      } else if (action === "restore") {
        if (r.dto.state !== "hidden") return problem(op, "review.invalid_state");
        r.dto = { ...r.dto, state: "published", moderationReason: null, moderatedAt: at };
      } else return problem(op, "http.not_found");
      return { status: 200, body: r.dto };
    };
    // Every decision except the dismissal carries an Idempotency-Key (contract).
    return platformIdempotent(request, op, decide);
  }),
];

/** Mock control: the next assistant call fails (`limit`, `unavailable`, `rejected`) or the assistant is switched. */
export function assistantControl(params: URLSearchParams) {
  const a = world().assistant;
  if (params.get("fail")) a.fail = params.get("fail");
  if (params.get("enabled")) a.enabled = params.get("enabled") !== "0";
  if (params.get("used")) a.used = Number(params.get("used"));
}
