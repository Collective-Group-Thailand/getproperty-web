import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { allowed, idempotent, json, mutating, notFound, owner, paged, problem, query, validation } from "./support";

type Schemas = components["schemas"];

/*
 * Pack G6 on the owner surface (D-300; O-023, O-027): sponsored LINE broadcasts.
 * - The product starts **switched off** (`broadcast.sponsored.enabled=false` until LINE Thailand confirms, O-023) and
 *   **without a price** (O-027): drafting and estimating work, scheduling answers `broadcast.sponsored_disabled`, then
 *   `broadcast.not_on_sale`. Controls: `POST /__mock/owner/broadcast/enable[?on=0]`,
 *   `POST /__mock/owner/broadcast/price[?price=0.5000|none][&minimum=500]`.
 * - The audience is a deterministic crowd of people who consented to `platform.recommendations` with their own
 *   preferences; the mock only ever answers counts (aggregate only, never a person) — withheld below the minimum.
 * - `POST /__mock/owner/broadcast/send?campaign=<id>` runs the `sponsored-broadcasts` job to the end: scheduled →
 *   sent, delivered = the estimate, clicks and leads, and one `purchase` platform invoice per delivered recipient.
 */

const VAT = "0.0700";

export interface MockBroadcastWorld {
  enabled: boolean;
  /** Net price per delivered recipient (4 decimals); null = not on sale (O-027). */
  price: string | null;
  priceVersionId: string | null;
  minimum: number;
  maxListings: number;
  maxPerWeek: number;
  quietHours: Schemas["QuietHoursWindowDto"];
  sendWindowHours: number;
  attributionDays: number;
  deliveryKeepMonths: number;
  preferencesKeepDays: number;
  consentText: Schemas["BroadcastConsentTextDto"];
  /** People consenting at the current consent version; a new version asks everyone again (0). */
  consenting: number;
  campaigns: (Schemas["SponsoredCampaignDto"] & { tenantId: string; leads: number })[];
}

/** Version 1 of the `platform.recommendations` text (a function: state.ts may call `initialBroadcastWorld` first). */
function consentV1(): Schemas["BroadcastConsentTextDto"] {
  return {
    version: 1,
    effectiveFrom: "2026-10-28T00:00:00+07:00",
    th: {
      title: "รับห้องแนะนำจาก getproperty (รวมโฆษณา)",
      bodyMarkdown:
        'เลือกรับหรือไม่ก็ได้ ไม่มีผลต่อการใช้บริการอื่น\n\nเราใช้เฉพาะสิ่งที่คุณกรอกเอง (ย่าน งบ ประเภทห้อง ช่วงย้ายเข้า ภาษา) เพื่อเลือกห้องที่ตรงใจ ไม่ใช้ข้อมูลอ่อนไหว ประวัติการจ่ายค่าเช่า หรือข้อมูลที่ผู้ให้เช่าเก็บไว้\n\nได้ไม่เกิน 2 ข้อความต่อสัปดาห์ ทุกข้อความมีป้าย "โฆษณา" และกดเลิกรับได้ในแตะเดียว',
    },
    en: {
      title: "Recommended places from getproperty (incl. ads)",
      bodyMarkdown:
        'Optional; saying no changes nothing else.\n\nWe only use what you type yourself (areas, budget, room type, move-in window, language) to pick places that fit. No sensitive data, rent history or anything a landlord keeps.\n\nAt most 2 messages a week, each labelled "Ad", with a one-tap stop.',
    },
  };
}

export function initialBroadcastWorld(): MockBroadcastWorld {
  return {
    enabled: false,
    price: null,
    priceVersionId: null,
    minimum: 500,
    maxListings: 5,
    maxPerWeek: 2,
    quietHours: { start: "21:00", end: "08:00", timezone: "Asia/Bangkok" },
    sendWindowHours: 24,
    attributionDays: 7,
    deliveryKeepMonths: 12,
    preferencesKeepDays: 30,
    consentText: consentV1(),
    // People consenting at the current version at start (the size of the crowd below).
    consenting: 1240,
    campaigns: [],
  };
}

export const broadcastWorld = (): MockBroadcastWorld => state.broadcast;

// ---- The consenting crowd (deterministic; counts only) ----

interface Person {
  areas: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  kinds: string[];
  moveIn: string | null;
  language: string;
}

/** The public area slugs of the mock (mocks/handlers/listings.ts) plus a few the search does not list yet. */
const AREAS = ["ari", "on-nut", "lat-phrao", "phaya-thai", "chatuchak", "nonthaburi", "bang-sue", "sathon"];
const KINDS = ["condo_unit", "room", "house", "townhouse"];
const LANGS = ["th", "th", "th", "th", "th", "en", "en", "my", "km", "zh"];

/** People consenting at the current version at start (the module graph is circular with state.ts: built lazily). */
const CROWD_SIZE = 1240;
let crowdCache: Person[] | null = null;
const crowd = (): Person[] => (crowdCache ??= Array.from({ length: CROWD_SIZE }, (_, i) => person(i)));

function person(i: number): Person {
  const seed = (i * 7919) % 1000;
  const budget = 6000 + ((i * 37) % 23) * 1000;
  return {
    areas: seed % 9 === 0 ? [] : [AREAS[i % AREAS.length]!, AREAS[(i * 3 + 1) % AREAS.length]!],
    budgetMin: seed % 5 === 0 ? null : budget - 6000,
    budgetMax: seed % 7 === 0 ? null : budget + 6000,
    kinds: seed % 4 === 0 ? [] : [KINDS[i % 4 === 3 ? 1 : 0]!],
    moveIn:
      seed % 6 === 0 ? null : `2026-${String(11 + (i % 2)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`,
    language: LANGS[i % LANGS.length]!,
  };
}

type Segment = Schemas["SponsoredSegmentDto"];
type Offered = { rent: number; unitKind: string | null };

const overlap = (a: string[], b: string[]) => !a.length || !b.length || a.some((x) => b.includes(x));

function fits(p: Person, s: Segment, offered: Offered[]): boolean {
  if (!overlap(p.areas, s.areas ?? [])) return false;
  if (!overlap(p.kinds, s.unitKinds ?? [])) return false;
  if (s.languages?.length && !(s.languages as string[]).includes(p.language)) return false;
  const sMin = s.budgetMin ? Number(s.budgetMin) : null;
  const sMax = s.budgetMax ? Number(s.budgetMax) : null;
  if (p.budgetMin !== null && sMax !== null && p.budgetMin > sMax) return false;
  if (sMin !== null && p.budgetMax !== null && sMin > p.budgetMax) return false;
  if (p.moveIn && s.moveInFrom && p.moveIn < s.moveInFrom) return false;
  if (p.moveIn && s.moveInTo && p.moveIn > s.moveInTo) return false;
  return offered.some(
    (l) =>
      (p.budgetMin === null || l.rent >= p.budgetMin) &&
      (p.budgetMax === null || l.rent <= p.budgetMax) &&
      (!p.kinds.length || (l.unitKind !== null && p.kinds.includes(l.unitKind))),
  );
}

function count(segment: Segment, offered: Offered[]): number {
  const w = broadcastWorld();
  if (w.consenting === 0) return 0;
  return crowd().filter((p) => fits(p, segment, offered)).length;
}

const shown = (n: number, minimum: number, max: number) => {
  const capped = Math.min(n, max);
  return capped >= minimum ? { estimated: capped, belowMinimum: false } : { estimated: null, belowMinimum: true };
};

const half = (n: number) => (Math.round(n * 100 + Number.EPSILON) / 100).toFixed(2);

function cost(recipients: number, price: string): Schemas["SponsoredCostDto"] {
  const subtotal = half(recipients * Number(price));
  const vatAmount = half(Number(subtotal) * Number(VAT));
  return { recipients, subtotal, vatAmount, total: half(Number(subtotal) + Number(vatAmount)) };
}

export function productDto(): Schemas["SponsoredProductDto"] {
  const w = broadcastWorld();
  return {
    enabled: w.enabled,
    onSale: w.price !== null,
    pricePerRecipient: w.price,
    vatRate: VAT,
    currency: "THB",
    minimumRecipients: w.minimum,
    maxListings: w.maxListings,
    maxPerWeek: w.maxPerWeek,
  };
}

// ---- Listings (the landlord's B7.2 world) ----

type Listing = (typeof state.listingWorld.listings)[number];
const isPublic = (l: Listing) => l.dto.state === "published" && !l.dto.hidden;
const offeredOf = (listings: Listing[]): Offered[] =>
  listings.map((l) => ({ rent: Number(l.dto.rent), unitKind: l.dto.unitKind }));
const listingRef = (l: Listing): Schemas["SponsoredCampaignListingDto"] => ({
  id: l.dto.id,
  slug: l.dto.slug,
  title: l.dto.titleTh,
  public: isPublic(l),
});

/** My listings by id: another tenant's → 404, more than the cap → 422, unpublished → `broadcast.listing_not_public`. */
function ownListings(op: string, tenantId: string, ids: unknown): Listing[] | Response {
  const w = broadcastWorld();
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > w.maxListings)
    return validation(op, "listingIds", `1–${w.maxListings} listings`);
  const found: Listing[] = [];
  for (const id of ids) {
    const l = state.listingWorld.listings.find((x) => x.dto.id === id && x.tenantId === tenantId);
    if (!l) return notFound(op);
    if (!isPublic(l)) return problem(op, "broadcast.listing_not_public");
    found.push(l);
  }
  return found;
}

const SLUG = /^[a-z0-9-]{1,60}$/;
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const KIND_SET = new Set(["condo_unit", "house", "townhouse", "room"]);
const LANG_SET = new Set(["th", "en", "my", "km", "lo", "zh"]);
const ALLOWED = new Set(["areas", "budgetMin", "budgetMax", "unitKinds", "moveInFrom", "moveInTo", "languages"]);

/** The closed segment whitelist (D-300): unknown keys and special-category fields are refused. */
function segmentOf(op: string, raw: unknown): Segment | Response {
  const s = (raw ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(s)) if (!ALLOWED.has(key)) return validation(op, `segment.${key}`, "not allowed");
  const areas = (s.areas as string[] | undefined) ?? [];
  if (!Array.isArray(areas) || areas.some((a) => !SLUG.test(a))) return validation(op, "segment.areas", "area slugs");
  for (const key of ["budgetMin", "budgetMax"] as const)
    if (s[key] != null && !MONEY.test(String(s[key]))) return validation(op, `segment.${key}`, "a THB amount");
  if (s.budgetMin != null && s.budgetMax != null && Number(s.budgetMin) > Number(s.budgetMax))
    return validation(op, "segment.budgetMax", "at least the budget from", "range");
  if (s.moveInFrom && s.moveInTo && String(s.moveInFrom) > String(s.moveInTo))
    return validation(op, "segment.moveInTo", "on or after the move-in from", "range");
  const kinds = (s.unitKinds as string[] | undefined) ?? [];
  if (kinds.some((k) => !KIND_SET.has(k))) return validation(op, "segment.unitKinds", "unit kinds");
  const languages = (s.languages as string[] | undefined) ?? [];
  if (languages.some((l) => !LANG_SET.has(l))) return validation(op, "segment.languages", "languages");
  return {
    areas,
    budgetMin: (s.budgetMin as string | null | undefined) ?? null,
    budgetMax: (s.budgetMax as string | null | undefined) ?? null,
    unitKinds: kinds as Segment["unitKinds"],
    moveInFrom: (s.moveInFrom as string | null | undefined) ?? null,
    moveInTo: (s.moveInTo as string | null | undefined) ?? null,
    languages: languages as Segment["languages"],
  };
}

const money2 = (v: string | null | undefined) => (v ? Number(v).toFixed(2) : null);
const segmentOut = (s: Segment): Schemas["SponsoredSegmentOutDto"] => ({
  areas: s.areas ?? [],
  budgetMin: money2(s.budgetMin),
  budgetMax: money2(s.budgetMax),
  unitKinds: s.unitKinds ?? [],
  moveInFrom: s.moveInFrom ?? null,
  moveInTo: s.moveInTo ?? null,
  languages: (s.languages as string[] | undefined) ?? [],
});

const refreshListings = (c: MockBroadcastWorld["campaigns"][number]) => {
  for (const ref of c.listings) {
    const l = state.listingWorld.listings.find((x) => x.dto.id === ref.id);
    if (l) Object.assign(ref, listingRef(l));
  }
};

export const publicCampaign = ({
  tenantId: _tenantId,
  leads: _leads,
  ...c
}: MockBroadcastWorld["campaigns"][number]): Schemas["SponsoredCampaignDto"] => {
  refreshListings(c as MockBroadcastWorld["campaigns"][number]);
  return c;
};

const tenantName = (tenantId: string) =>
  Object.values(TENANTS).find((tenant) => tenant.profile.id === tenantId)?.profile.displayName ?? "";

export const adminCampaign = (c: MockBroadcastWorld["campaigns"][number]): Schemas["AdminSponsoredCampaignDto"] => ({
  ...publicCampaign(c),
  tenantId: c.tenantId,
  tenantName: tenantName(c.tenantId),
});

/** The `sponsored-broadcasts` job run to the end (control): delivered = the estimate, one purchase invoice. */
export function sendCampaign(id: string): boolean {
  const c = broadcastWorld().campaigns.find((x) => x.id === id);
  if (!c || (c.state !== "scheduled" && c.state !== "sending")) return false;
  const at = new Date().toISOString();
  const delivered = c.estimated ?? 0;
  c.state = "sent";
  c.sendingStartedAt ??= at;
  c.completedAt = at;
  c.delivered = delivered;
  c.clicks = Math.round(delivered * 0.08);
  c.leads = Math.round(delivered * 0.006);
  if (delivered > 0 && c.pricePerRecipient) {
    const charge = cost(delivered, c.pricePerRecipient);
    const invoiceId = crypto.randomUUID();
    const number = `PIV-2026-${String(950 + state.platform.invoices.length).padStart(5, "0")}`;
    const dueAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const today = at.slice(0, 10);
    state.platform.invoices.push({
      id: invoiceId,
      number,
      tenantId: c.tenantId,
      tenantName: tenantName(c.tenantId),
      subscriptionId: null,
      kind: "purchase",
      state: "issued",
      periodStart: today,
      periodEnd: today,
      issuedAt: at,
      dueAt,
      overdueSince: null,
      subtotal: charge.subtotal,
      discount: "0.00",
      vatAmount: charge.vatAmount,
      total: charge.total,
      paidTotal: "0.00",
      creditedTotal: "0.00",
      openAmount: charge.total,
      lines: [
        {
          lineNo: 1,
          kind: "sponsored_broadcast",
          description: `ข้อความแนะนำห้องทาง LINE: ${c.name}`,
          quantity: `${delivered}.000`,
          unitPrice: c.pricePerRecipient,
          amount: charge.subtotal,
        },
      ],
      payments: [],
      creditNotes: [],
      qr: null,
      documentId: crypto.randomUUID(),
      nextActions: ["record-payment"],
    });
    c.invoice = { id: invoiceId, number, total: charge.total, state: "issued", dueAt, qrAvailable: false };
  }
  return true;
}

export function setBroadcastEnabled(on: boolean): void {
  broadcastWorld().enabled = on;
}

export function setBroadcastPrice(price: string | null, minimum?: number): void {
  const w = broadcastWorld();
  w.price = price;
  w.priceVersionId = price ? crypto.randomUUID() : null;
  if (minimum !== undefined && Number.isInteger(minimum) && minimum > 0) w.minimum = minimum;
}

/** The landlord's campaigns only (the sample apartment has no listings); another tenant sees nothing. */
const find = (tenantId: string, id: unknown) =>
  broadcastWorld().campaigns.find((c) => c.id === id && c.tenantId === tenantId) ?? null;

export const broadcastHandlers: HttpHandler[] = [
  http.get("*/v1/owner/sponsored-campaigns/product", ({ request }) => {
    const ok = owner(request, "owner.sponsoredCampaigns.product");
    if (ok instanceof Response) return ok;
    return json(productDto());
  }),
  http.post("*/v1/owner/sponsored-campaigns/estimate", async ({ request }) => {
    const op = "owner.sponsoredCampaigns.estimate";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const input = (await request.json().catch(() => ({}))) as Partial<Schemas["SponsoredEstimateRequestDto"]>;
    const listings = ownListings(op, ok.tenantId, input.listingIds);
    if (listings instanceof Response) return listings;
    const segment = segmentOf(op, input.segment);
    if (segment instanceof Response) return segment;
    const max = Number(input.maxRecipients);
    if (!Number.isInteger(max) || max < 1 || max > 1_000_000) return validation(op, "maxRecipients", "1–1,000,000");
    const w = broadcastWorld();
    const answer = shown(count(segment, offeredOf(listings)), w.minimum, max);
    return json({
      ...answer,
      minimumRecipients: w.minimum,
      cost: answer.estimated !== null && w.price ? cost(answer.estimated, w.price) : null,
      product: productDto(),
    } satisfies Schemas["SponsoredEstimateDto"]);
  }),
  http.get("*/v1/owner/sponsored-campaigns", ({ request }) => {
    const ok = owner(request, "owner.sponsoredCampaigns.list");
    if (ok instanceof Response) return ok;
    const wanted = query(request).get("state");
    const mine = broadcastWorld()
      .campaigns.filter((c) => c.tenantId === ok.tenantId && (!wanted || c.state === wanted))
      .map(publicCampaign);
    return json(paged(mine, request));
  }),
  http.post("*/v1/owner/sponsored-campaigns", async ({ request }) => {
    const op = "owner.sponsoredCampaigns.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.subscription.manage");
    if (denied) return denied;
    return idempotent(request, op, (payload) => {
      const input = payload as Partial<Schemas["SponsoredCampaignCreateDto"]>;
      const name = String(input.name ?? "").trim();
      if (!name || name.length > 120) return validation(op, "name", "1–120 characters");
      const listings = ownListings(op, ok.tenantId, input.listingIds);
      if (listings instanceof Response) return listings;
      const segment = segmentOf(op, input.segment);
      if (segment instanceof Response) return segment;
      const max = Number(input.maxRecipients);
      if (!Number.isInteger(max) || max < 1 || max > 1_000_000) return validation(op, "maxRecipients", "1–1,000,000");
      const w = broadcastWorld();
      const at = new Date().toISOString();
      const campaign: MockBroadcastWorld["campaigns"][number] = {
        id: crypto.randomUUID(),
        tenantId: ok.tenantId,
        leads: 0,
        name,
        state: "draft",
        listings: listings.map(listingRef),
        segment: segmentOut(segment),
        maxRecipients: max,
        estimated: shown(count(segment, offeredOf(listings)), w.minimum, max).estimated,
        scheduledAt: null,
        pricePerRecipient: null,
        vatRate: null,
        minimumRecipients: null,
        delivered: 0,
        clicks: 0,
        invoice: null,
        rejectReason: null,
        sendingStartedAt: null,
        completedAt: null,
        createdAt: at,
      };
      w.campaigns.unshift(campaign);
      return { status: 201, body: publicCampaign(campaign) };
    });
  }),
  http.get("*/v1/owner/sponsored-campaigns/:campaignId", ({ request, params }) => {
    const op = "owner.sponsoredCampaigns.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const c = find(ok.tenantId, params.campaignId);
    return c ? json(publicCampaign(c)) : notFound(op);
  }),
  http.get("*/v1/owner/sponsored-campaigns/:campaignId/report", ({ request, params }) => {
    const op = "owner.sponsoredCampaigns.report";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const c = find(ok.tenantId, params.campaignId);
    if (!c) return notFound(op);
    return json({
      campaignId: c.id,
      state: c.state,
      sent: c.delivered,
      opened: null,
      clicks: c.clicks,
      leads: c.leads,
      attributionDays: broadcastWorld().attributionDays,
      invoice: c.invoice,
    } satisfies Schemas["SponsoredReportDto"]);
  }),
  http.post("*/v1/owner/sponsored-campaigns/:campaignId/actions/schedule", async ({ request, params }) => {
    const op = "owner.sponsoredCampaigns.schedule";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.subscription.manage");
    if (denied) return denied;
    const c = find(ok.tenantId, params.campaignId);
    if (!c) return notFound(op);
    return idempotent(request, op, (payload) => {
      const w = broadcastWorld();
      if (c.state !== "draft") return problem(op, "broadcast.invalid_state");
      if (!w.enabled) return problem(op, "broadcast.sponsored_disabled");
      if (!w.price) return problem(op, "broadcast.not_on_sale");
      const raw = (payload as { scheduledAt?: string | null }).scheduledAt;
      const at = raw ? Date.parse(raw) : Date.now();
      if (Number.isNaN(at) || at < Date.now() - 60_000 || at > Date.now() + 90 * 86_400_000)
        return problem(op, "validation.failed", {
          errors: [{ path: "scheduledAt", code: "range", message: "from now up to 90 days ahead" }],
        });
      const listings = c.listings.map((ref) => state.listingWorld.listings.find((l) => l.dto.id === ref.id));
      if (listings.some((l) => !l || !isPublic(l))) return problem(op, "broadcast.listing_not_public");
      const segment = { ...c.segment, languages: c.segment.languages as Segment["languages"] };
      const answer = shown(count(segment, offeredOf(listings as Listing[])), w.minimum, c.maxRecipients);
      if (answer.belowMinimum) return problem(op, "broadcast.below_minimum");
      Object.assign(c, {
        state: "scheduled",
        scheduledAt: new Date(at).toISOString(),
        estimated: answer.estimated,
        pricePerRecipient: w.price,
        vatRate: VAT,
        minimumRecipients: w.minimum,
      });
      return { status: 200, body: publicCampaign(c) };
    });
  }),
  http.post("*/v1/owner/sponsored-campaigns/:campaignId/actions/cancel", ({ request, params }) => {
    const op = "owner.sponsoredCampaigns.cancel";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.subscription.manage");
    if (denied) return denied;
    const c = find(ok.tenantId, params.campaignId);
    if (!c) return notFound(op);
    if (c.state !== "draft" && c.state !== "scheduled") return problem(op, "broadcast.invalid_state");
    c.state = "cancelled";
    c.completedAt = new Date().toISOString();
    return json(publicCampaign(c));
  }),
];
