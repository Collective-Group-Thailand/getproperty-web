import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { platform } from "../platform/support";
import { state } from "../state";
import { body, json, mutating, owner, problem } from "./support";

type Schemas = components["schemas"];

/** A listing as the mock holds it: the owner DTO plus whose it is, its documents and open reports. */
export interface MockListing {
  tenantId: string;
  dto: Schemas["ListingDto"];
  reports: Schemas["AdminListingReportDto"][];
}
export interface MockVerification {
  tenantId: string;
  dto: Schemas["AdminVerificationDto"];
}

const LANDLORD = TENANTS.landlord.profile.id;
const UNIT_ARI = "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c01";
const UNIT_THONGLOR = "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c02";
const PHOTO_MIN = 5;
const FLAGGED = ["โอนก่อนดูห้อง", "จองก่อนดูห้อง", "pay before viewing"];
const now = () => new Date().toISOString();

const base = (
  input: Partial<Schemas["ListingDto"]> & { id: string; unitId: string; slug: string; titleTh: string },
): Schemas["ListingDto"] => ({
  buildingId: "6a1f0c3e-2b4d-4e5f-8a9b-0c1d2e3f4a01",
  state: "draft",
  titleEn: null,
  descriptionTh: "",
  descriptionEn: null,
  rent: "15000.00",
  depositMonths: 2,
  advanceMonths: 1,
  minTermMonths: 12,
  availableFrom: null,
  furnishing: "fully_furnished",
  petsAllowed: false,
  smokingAllowed: false,
  facilities: [],
  showUnitNo: false,
  transit: null,
  unitKind: "condo_unit",
  sizeSqm: "28.50",
  bedrooms: 1,
  bathrooms: 1,
  floorLabel: "12",
  province: "กรุงเทพมหานคร",
  district: "พญาไท",
  address: "ถนนพหลโยธิน, พญาไท, กรุงเทพมหานคร 10400",
  photos: [],
  availability: { weekly: [], exceptions: [], slotMinutes: 30 },
  reviewReasons: [],
  rejectedReason: null,
  hidden: false,
  reportCount: 0,
  verifiedOwner: false,
  publishedAt: null,
  closedReason: null,
  version: 1,
  ...input,
});

const seedPhotos = (prefix: string, n: number): Schemas["ListingPhotoDto"][] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${String(i).padStart(2, "0")}`,
    documentId: `${prefix}d${String(i).padStart(1, "0")}`,
    sortOrder: i,
    caption: i === 0 ? "ห้องนั่งเล่น" : null,
    url: "",
  }));

/** The landlord persona's listings (published + in review) and one reported, hidden listing of another owner. */
export function initialListings(): { listings: MockListing[]; verifications: MockVerification[] } {
  return {
    listings: [
      {
        tenantId: LANDLORD,
        reports: [],
        dto: base({
          id: "8d4b2c1a-0000-4000-8000-00000000a001",
          unitId: UNIT_ARI,
          slug: "condo-1br-a1b2c3d4e5",
          titleTh: "คอนโด 1 ห้องนอน ใกล้ BTS อารีย์ วิวเมือง",
          descriptionTh: "ห้องมุม แสงดี เฟอร์นิเจอร์ครบ เดินไป BTS อารีย์ 5 นาที",
          state: "published",
          publishedAt: "2026-10-20T03:00:00.000Z",
          photos: seedPhotos("9e5c3d2b-0000-4000-8000-0000000b10", 6),
          facilities: ["สระว่ายน้ำ", "ฟิตเนส", "คีย์การ์ด"],
          transit: { name: "BTS อารีย์", line: "BTS สายสุขุมวิท", distanceM: 350 },
          availability: { weekly: [{ weekday: 6, from: "10:00", to: "16:00" }], exceptions: [], slotMinutes: 30 },
          version: 4,
        }),
      },
      {
        tenantId: LANDLORD,
        reports: [],
        dto: base({
          id: "8d4b2c1a-0000-4000-8000-00000000a002",
          unitId: UNIT_THONGLOR,
          slug: "condo-1br-f6a7b8c9d0",
          titleTh: "เดอะ ลอฟท์ ทองหล่อ 35 ตร.ม. พร้อมอยู่",
          descriptionTh: "ห้องตกแต่งใหม่ ใกล้ร้านอาหารและ BTS ทองหล่อ",
          rent: "9000.00",
          state: "pending_review",
          reviewReasons: ["price_outlier"],
          district: "วัฒนา",
          address: "ซอยสุขุมวิท 55, วัฒนา, กรุงเทพมหานคร 10110",
          sizeSqm: "35.00",
          photos: seedPhotos("9e5c3d2b-0000-4000-8000-0000000b20", 5),
          version: 2,
        }),
      },
      {
        tenantId: TENANTS.fresh.profile.id,
        reports: [
          {
            id: "5f1a0000-0000-4000-8000-0000000c0001",
            reason: "scam",
            details: "ขอให้โอนมัดจำก่อนดูห้อง",
            createdAt: "2026-10-24T08:00:00.000Z",
          },
          {
            id: "5f1a0000-0000-4000-8000-0000000c0002",
            reason: "scam",
            details: null,
            createdAt: "2026-10-24T09:30:00.000Z",
          },
          {
            id: "5f1a0000-0000-4000-8000-0000000c0003",
            reason: "wrong_info",
            details: "รูปไม่ตรงกับห้อง",
            createdAt: "2026-10-24T11:00:00.000Z",
          },
        ],
        dto: base({
          id: "8d4b2c1a-0000-4000-8000-00000000a003",
          unitId: "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c99",
          slug: "room-1br-0f0e0d0c0b",
          titleTh: "ห้องเช่าราคาถูก ใจกลางเมือง",
          descriptionTh: "ห้องว่างพร้อมเข้าอยู่",
          rent: "4500.00",
          unitKind: "room",
          state: "published",
          publishedAt: "2026-10-23T03:00:00.000Z",
          hidden: true,
          reportCount: 3,
          photos: seedPhotos("9e5c3d2b-0000-4000-8000-0000000b30", 5),
        }),
      },
    ],
    verifications: [
      {
        tenantId: LANDLORD,
        dto: {
          id: "6a2b0000-0000-4000-8000-0000000d0001",
          tenantId: LANDLORD,
          tenantName: TENANTS.landlord.profile.displayName,
          unitId: UNIT_THONGLOR,
          unitNo: "8/101",
          buildingName: "เดอะ ลอฟท์ ทองหล่อ",
          state: "pending",
          evidenceKind: "condo_title",
          note: null,
          reviewedBy: null,
          submittedAt: "2026-10-24T05:00:00.000Z",
          decidedAt: null,
          decisionNote: null,
        },
      },
    ],
  };
}

const origin = (request: Request) => new URL(request.url).origin;
const withUrls = (request: Request, dto: Schemas["ListingDto"]): Schemas["ListingDto"] => ({
  ...dto,
  photos: dto.photos.map((p) => ({ ...p, url: `${origin(request)}/__files/${p.documentId}` })),
  verifiedOwner: verified(dto.unitId),
});
const verified = (unitId: string) =>
  state.listingWorld.verifications.some((v) => v.dto.unitId === unitId && v.dto.state === "approved");
const mine = (tenantId: string) => state.listingWorld.listings.filter((l) => l.tenantId === tenantId);
const find = (tenantId: string, id: string) => mine(tenantId).find((l) => l.dto.id === id);
const tenantName = (tenantId: string) =>
  Object.values(TENANTS).find((t) => t.profile.id === tenantId)?.profile.displayName ?? "";

function adminDto(l: MockListing): Schemas["AdminListingDto"] {
  return {
    id: l.dto.id,
    tenantId: l.tenantId,
    tenantName: tenantName(l.tenantId),
    slug: l.dto.slug,
    state: l.dto.state,
    titleTh: l.dto.titleTh,
    descriptionTh: l.dto.descriptionTh,
    rent: l.dto.rent,
    district: l.dto.district,
    province: l.dto.province,
    reviewReasons: l.dto.reviewReasons,
    hiddenAt: l.dto.hidden ? "2026-10-24T11:00:00.000Z" : null,
    hiddenReason: l.dto.hidden ? "reports" : null,
    reports: l.reports,
    updatedAt: now(),
  };
}

const update = (l: MockListing, patch: Partial<Schemas["ListingDto"]>) => {
  l.dto = { ...l.dto, ...patch, version: l.dto.version + 1 };
};

const LISTING_PATH = "*/v1/owner/listings/:listingId";

/** `/v1/owner/listings*`, `/v1/owner/units/:id/verification`, `/v1/admin/listings*`, `/v1/admin/listing-verifications*`. */
export const listingHandlers: HttpHandler[] = [
  http.get("*/v1/owner/listings", ({ request }) => {
    const ok = owner(request, "owner.listings.list");
    if (ok instanceof Response) return ok;
    return json(
      mine(ok.tenantId)
        .map((l) => withUrls(request, l.dto))
        .reverse(),
    );
  }),
  http.post("*/v1/owner/listings", async ({ request }) => {
    const op = "owner.listings.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Partial<Schemas["ListingCreateDto"]>>(request);
    if (!input.unitId || !input.titleTh?.trim() || !/^\d{1,12}(\.\d{1,2})?$/.test(input.rent ?? ""))
      return problem(op, "validation.failed", {
        errors: [{ path: !input.titleTh?.trim() ? "titleTh" : "rent", code: "required", message: "required" }],
      });
    const unit = (state.portfolio[ok.tenantId] ?? []).find((u) => u.unitId === input.unitId);
    if (!unit) return problem(op, "http.not_found");
    const id = crypto.randomUUID();
    const listing: MockListing = {
      tenantId: ok.tenantId,
      reports: [],
      dto: base({
        id,
        unitId: unit.unitId,
        buildingId: unit.building.id,
        slug: `${unit.kind === "condo_unit" ? "condo" : (unit.kind ?? "room")}-${unit.bedrooms ?? 0}br-${id.replace(/-/g, "").slice(-10)}`,
        titleTh: input.titleTh.trim(),
        rent: Number(input.rent).toFixed(2),
        unitKind: unit.kind,
        sizeSqm: unit.areaSqm,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        floorLabel: unit.floorLabel,
        furnishing: unit.furnishing,
        province: (unit.address?.province as string | undefined) ?? null,
        district: (unit.address?.district as string | undefined) ?? null,
        address:
          [unit.address?.line1, unit.address?.district, unit.address?.province].filter(Boolean).join(", ") || null,
      }),
    };
    state.listingWorld.listings.push(listing);
    return json(withUrls(request, listing.dto), 201);
  }),
  http.get(LISTING_PATH, ({ request, params }) => {
    const ok = owner(request, "owner.listings.get");
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.listingId));
    return l ? json(withUrls(request, l.dto)) : problem("owner.listings.get", "http.not_found");
  }),
  http.patch(LISTING_PATH, async ({ request, params }) => {
    const op = "owner.listings.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.listingId));
    if (!l) return problem(op, "http.not_found");
    if (l.dto.state === "closed") return problem(op, "listing.invalid_state");
    const input = await body<Partial<Schemas["ListingUpdateDto"]>>(request);
    const { rent, ...rest } = input;
    update(l, { ...rest, ...(rent ? { rent: Number(rent).toFixed(2) } : {}) } as Partial<Schemas["ListingDto"]>);
    if (l.dto.state === "published" && FLAGGED.some((w) => `${l.dto.titleTh} ${l.dto.descriptionTh}`.includes(w)))
      update(l, { state: "pending_review", reviewReasons: ["flagged_words"] });
    return json(withUrls(request, l.dto));
  }),
  http.post(`${LISTING_PATH}/photos`, async ({ request, params }) => {
    const op = "owner.listings.addPhoto";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.listingId));
    if (!l) return problem(op, "http.not_found");
    const input = await body<{ documentId?: string; caption?: string | null }>(request);
    const file = input.documentId ? state.staff.files.get(input.documentId) : undefined;
    if (!file || file.file.kind !== "listing_photo" || file.file.scanStatus !== "clean")
      return problem(op, "listing.photo_invalid");
    update(l, {
      photos: [
        ...l.dto.photos,
        {
          id: crypto.randomUUID(),
          documentId: file.file.id,
          sortOrder: l.dto.photos.length,
          caption: input.caption ?? null,
          url: "",
        },
      ],
    });
    return json(withUrls(request, l.dto), 201);
  }),
  http.put(`${LISTING_PATH}/photos`, async ({ request, params }) => {
    const op = "owner.listings.arrangePhotos";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.listingId));
    if (!l) return problem(op, "http.not_found");
    const input = await body<{ photos?: { id: string; caption?: string | null }[] }>(request);
    const order = input.photos ?? [];
    if (order.length !== l.dto.photos.length || order.some((p) => !l.dto.photos.some((q) => q.id === p.id)))
      return problem(op, "validation.failed", {
        errors: [{ path: "photos", code: "invalid", message: "every photo once" }],
      });
    update(l, {
      photos: order.map((p, i) => ({
        ...l.dto.photos.find((q) => q.id === p.id)!,
        sortOrder: i,
        caption: p.caption ?? null,
      })),
    });
    return json(withUrls(request, l.dto));
  }),
  http.delete(`${LISTING_PATH}/photos/:photoId`, ({ request, params }) => {
    const op = "owner.listings.removePhoto";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.listingId));
    if (!l || !l.dto.photos.some((p) => p.id === params.photoId)) return problem(op, "http.not_found");
    update(l, { photos: l.dto.photos.filter((p) => p.id !== params.photoId).map((p, i) => ({ ...p, sortOrder: i })) });
    return json(withUrls(request, l.dto));
  }),
  http.put(`${LISTING_PATH}/availability`, async ({ request, params }) => {
    const op = "owner.listings.setAvailability";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.listingId));
    if (!l) return problem(op, "http.not_found");
    const input = await body<Schemas["ListingAvailabilityDto"]>(request);
    if (input.weekly.some((s) => s.from >= s.to))
      return problem(op, "validation.failed", {
        errors: [{ path: "weekly", code: "invalid", message: "from before to" }],
      });
    update(l, {
      availability: { weekly: input.weekly, exceptions: input.exceptions ?? [], slotMinutes: input.slotMinutes ?? 30 },
    });
    return json(withUrls(request, l.dto));
  }),
  http.post(`${LISTING_PATH}/actions/:action`, ({ request, params }) => {
    const action = String(params.action);
    const op = `owner.listings.${action}`;
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.listingId));
    if (!l) return problem(op, "http.not_found");
    const { state: current } = l.dto;
    if (action === "submit") {
      if (current !== "draft" && current !== "rejected") return problem(op, "listing.invalid_state");
      const errors = [
        ...(l.dto.photos.length < PHOTO_MIN
          ? [{ path: "photos", code: "min", message: `at least ${PHOTO_MIN} photos` }]
          : []),
        ...(l.dto.sizeSqm === null ? [{ path: "unit.areaSqm", code: "required", message: "the unit size" }] : []),
      ];
      if (errors.length) return problem(op, "listing.incomplete", { errors });
      if (
        mine(ok.tenantId).some(
          (o) =>
            o !== l && o.dto.unitId === l.dto.unitId && ["pending_review", "published", "paused"].includes(o.dto.state),
        )
      )
        return problem(op, "listing.duplicate_unit");
      const first = !mine(ok.tenantId).some((o) => o.dto.publishedAt) && !verified(l.dto.unitId);
      const flagged = FLAGGED.some((w) => `${l.dto.titleTh} ${l.dto.descriptionTh}`.includes(w));
      const reasons: Schemas["ListingReviewReason"][] = [
        ...(first ? ["first_listing" as const] : []),
        ...(flagged ? ["flagged_words" as const] : []),
      ];
      update(
        l,
        reasons.length
          ? { state: "pending_review", reviewReasons: reasons, rejectedReason: null }
          : { state: "published", publishedAt: now(), reviewReasons: [], rejectedReason: null },
      );
    } else if (action === "pause") {
      if (current !== "published") return problem(op, "listing.invalid_state");
      update(l, { state: "paused" });
    } else if (action === "resume") {
      if (current !== "paused" || l.dto.hidden) return problem(op, "listing.invalid_state");
      update(l, { state: "published", publishedAt: now() });
    } else if (action === "close") {
      if (current === "closed") return problem(op, "listing.invalid_state");
      update(l, { state: "closed", closedReason: "withdrawn" });
    } else return problem("owner.listings.get", "http.not_found");
    return json(withUrls(request, l.dto));
  }),
  http.get("*/v1/owner/units/:unitId/verification", ({ request, params }) => {
    const ok = owner(request, "owner.listings.verification");
    if (ok instanceof Response) return ok;
    const rows = state.listingWorld.verifications.filter(
      (v) => v.tenantId === ok.tenantId && v.dto.unitId === params.unitId,
    );
    const latest = rows.at(-1)?.dto ?? null;
    return json({
      verified: verified(String(params.unitId)),
      latest: latest
        ? {
            id: latest.id,
            unitId: latest.unitId,
            state: latest.state,
            evidenceKind: latest.evidenceKind,
            evidenceCount: 1,
            submittedAt: latest.submittedAt,
            decidedAt: latest.decidedAt,
            decisionNote: latest.decisionNote,
          }
        : null,
    } satisfies Schemas["UnitVerificationDto"]);
  }),
  http.post("*/v1/owner/units/:unitId/verification", async ({ request, params }) => {
    const op = "owner.listings.requestVerification";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Partial<Schemas["VerificationRequestDto"]>>(request);
    if (!input.evidenceKind || !input.documentIds?.length)
      return problem(op, "validation.failed", {
        errors: [{ path: "documentIds", code: "required", message: "required" }],
      });
    if (state.listingWorld.verifications.some((v) => v.dto.unitId === params.unitId && v.dto.state === "pending"))
      return problem(op, "listing.verification_pending");
    const unit = (state.portfolio[ok.tenantId] ?? []).find((u) => u.unitId === params.unitId);
    const row: MockVerification = {
      tenantId: ok.tenantId,
      dto: {
        id: crypto.randomUUID(),
        tenantId: ok.tenantId,
        tenantName: tenantName(ok.tenantId),
        unitId: String(params.unitId),
        unitNo: unit?.unitNo ?? "",
        buildingName: unit?.building.name ?? "",
        state: "pending",
        evidenceKind: input.evidenceKind,
        note: input.note ?? null,
        reviewedBy: null,
        submittedAt: now(),
        decidedAt: null,
        decisionNote: null,
      },
    };
    state.listingWorld.verifications.push(row);
    return json(
      {
        id: row.dto.id,
        unitId: row.dto.unitId,
        state: "pending",
        evidenceKind: row.dto.evidenceKind,
        evidenceCount: input.documentIds.length,
        submittedAt: row.dto.submittedAt,
        decidedAt: null,
        decisionNote: null,
      } satisfies Schemas["VerificationDto"],
      201,
    );
  }),

  // ------------------------------------------------------------------------------------------------- admin
  http.get("*/v1/admin/listings/queue", ({ request }) => {
    const ok = platform(request, "admin.listings.queue", "admin.listing.moderate");
    if (ok instanceof Response) return ok;
    const kind = new URL(request.url).searchParams.get("kind");
    const rows = state.listingWorld.listings.filter((l) =>
      kind === "pending_review"
        ? l.dto.state === "pending_review"
        : kind === "hidden"
          ? l.dto.hidden && l.dto.state !== "closed"
          : kind === "reported"
            ? l.reports.length > 0 && l.dto.state !== "closed"
            : l.dto.state === "pending_review" || l.dto.hidden || l.reports.length > 0,
    );
    return json(rows.map(adminDto));
  }),
  http.post("*/v1/admin/listings/:listingId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    const op = `admin.listings.${action}`;
    const ok = platform(request, op, "admin.listing.moderate");
    if (ok instanceof Response) return ok;
    const l = state.listingWorld.listings.find((x) => x.dto.id === params.listingId);
    if (!l) return problem(op, "http.not_found");
    const input = action === "reject" || action === "hide" ? await body<{ reason?: string }>(request) : {};
    if ((action === "reject" || action === "hide") && (input.reason ?? "").trim().length < 3)
      return problem(op, "validation.failed", { errors: [{ path: "reason", code: "minLength", message: "a reason" }] });
    if (action === "approve") {
      if (l.dto.state !== "pending_review") return problem(op, "listing.invalid_state");
      update(l, { state: "published", publishedAt: now(), reviewReasons: [] });
    } else if (action === "reject") {
      update(l, { state: "rejected", rejectedReason: input.reason!.trim(), hidden: false });
      l.reports = [];
    } else if (action === "hide") {
      if (l.dto.hidden) return problem(op, "listing.invalid_state");
      update(l, { hidden: true });
    } else if (action === "restore") {
      if (!l.dto.hidden) return problem(op, "listing.invalid_state");
      update(l, { hidden: false, reportCount: 0 });
      l.reports = [];
    }
    return json(adminDto(l));
  }),
  http.get("*/v1/admin/listing-verifications", ({ request }) => {
    const ok = platform(request, "admin.listingVerifications.list", "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const wanted = new URL(request.url).searchParams.get("state");
    return json(state.listingWorld.verifications.filter((v) => !wanted || v.dto.state === wanted).map((v) => v.dto));
  }),
  http.get("*/v1/admin/listing-verifications/:verificationId", ({ request, params }) => {
    const ok = platform(request, "admin.listingVerifications.get", "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const v = state.listingWorld.verifications.find((x) => x.dto.id === params.verificationId);
    if (!v) return problem("admin.listingVerifications.get", "http.not_found");
    return json({
      ...v.dto,
      evidence: [
        {
          documentId: `${v.dto.id.slice(0, -4)}ev01`,
          mimeType: "application/pdf",
          url: `${origin(request)}/__files/pdf-${v.dto.id}`,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
      ],
    } satisfies Schemas["AdminVerificationDetailDto"]);
  }),
  http.post("*/v1/admin/listing-verifications/:verificationId/actions/decide", async ({ request, params }) => {
    const op = "admin.listingVerifications.decide";
    const ok = platform(request, op, "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const v = state.listingWorld.verifications.find((x) => x.dto.id === params.verificationId);
    if (!v) return problem(op, "http.not_found");
    if (v.dto.state !== "pending") return problem(op, "listing.verification_invalid_state");
    const input = await body<{ approve?: boolean; note?: string | null }>(request);
    if (!input.approve && !input.note?.trim())
      return problem(op, "validation.failed", { errors: [{ path: "note", code: "required", message: "a reason" }] });
    v.dto = {
      ...v.dto,
      state: input.approve ? "approved" : "rejected",
      decidedAt: now(),
      decisionNote: input.note ?? null,
      reviewedBy: ok.userId,
    };
    return json(v.dto);
  }),
];
