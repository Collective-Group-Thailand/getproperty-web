import { http, HttpResponse, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { allowed, idempotent, json, mutating, notFound, owner, problem, query, validation } from "./support";

type Schemas = components["schemas"];

/*
 * Packs G4 and G5 on the owner surface (D-296, D-297, D-298, D-288; O-027, O-029, O-032):
 * - Facebook Page like the api's fake adapter: `fake-page-token-<name>` is a working Page named `<name>`,
 *   `fake-page-token-revoked…` is refused (OAuth error 190) and stores nothing; `FACEBOOK_MODE` can be switched off
 *   (`POST /__mock/owner/growth/facebook?mode=off`). Posts per listing × Page: the landlord's published listing is
 *   posted on connect; `POST /__mock/owner/growth/post-fail?listing=` makes its post fail (retry queues it again,
 *   the worker posts it on the next read).
 * - Boosts and media services are price plans seeded **without a price** (O-027): not on sale until
 *   `POST /__mock/owner/growth/price?product=<key>|all` publishes one; a purchase is a `purchase` platform invoice and
 *   starts when Finance records the payment (`POST /__mock/owner/growth/pay?boost=<id>|order=<id>`); a boost bought
 *   while one is in force is queued after it. `POST /__mock/owner/growth/free-building` turns `boost.building.free` on
 *   for the sample tenant. No wallet, no credits (D-298).
 * - The agency's LINE OA integration add-on (`line_oa_integration`, agency only): free until
 *   `POST /__mock/owner/growth/price?product=addon`; then connecting needs `acceptAddonVersionId` and the setup fee is
 *   invoiced once.
 */

const LANDLORD = TENANTS.landlord.profile.id;
const AGENCY = TENANTS.agency.profile.id;
const SAMPLE = TENANTS.sample.profile.id;
const VAT = "0.0700";
/** The agency's September fee invoice (added to the platform invoices on first read, see platform/growth.ts). */
export const FEE_INVOICE = "0199f2a0-0000-7000-8000-00000000f1a0";

export interface MockGrowthWorld {
  /** Samples are added on first read (the module graph is circular with state.ts: nothing runs at import). */
  seeded: boolean;
  /** Product key → net price published (O-027: none at start). */
  prices: Record<string, string>;
  addon: { versionId: string; monthlyFee: string; setupFee: string; effectiveFrom: string } | null;
  freeBuilding: Record<string, boolean>;
  facebookMode: "fake" | "off";
  boosts: (Schemas["BoostDto"] & { tenantId: string })[];
  orders: (Schemas["AdminMediaServiceOrderDto"] & { tenantId: string })[];
  pages: (Schemas["SocialChannelDto"] & { tenantId: string })[];
  posts: (Schemas["SocialPostDto"] & { tenantId: string; listingId: string })[];
  addonSetupCharged: Record<string, boolean>;
  addonInvoices: Record<string, Schemas["MessagingAddonInvoiceDto"][]>;
  /** The agency's own LINE OA channels (the owner world holds the sample tenant's). */
  agencyChannels: Schemas["MessagingChannelDto"][];
  /**
   * Success / co-broke fee accruals (G2 / G5) as the admin sees them: the invoice line and credit note they link to;
   * the state is derived from those (see mocks/platform/growth.ts).
   */
  fees: (Omit<Schemas["AdminFeeAccrualDto"], "state" | "invoice" | "creditNote"> & {
    invoiceId: string | null;
    creditNoteId: string | null;
  })[];
}

export function initialGrowthWorld(): MockGrowthWorld {
  return {
    seeded: false,
    prices: {},
    addon: null,
    freeBuilding: {},
    facebookMode: "fake",
    boosts: [],
    orders: [],
    pages: [],
    posts: [],
    addonSetupCharged: {},
    addonInvoices: {},
    agencyChannels: [],
    fees: [],
  };
}

const g = (): MockGrowthWorld => {
  if (!state.growth.seeded) seedGrowth(state.growth);
  return state.growth;
};

/** The seeded products (G5 seeds) and the net price used when the mock publishes one. */
const BOOSTS = [
  {
    id: "0199f2a0-0000-7000-8000-00000000b007",
    key: "boost_listing_7d",
    nameTh: "โปรโมตประกาศ 7 วัน",
    nameEn: "Listing boost, 7 days",
    target: "listing",
    days: 7,
    months: null,
    sample: "500.00",
  },
  {
    id: "0199f2a0-0000-7000-8000-00000000b030",
    key: "boost_listing_30d",
    nameTh: "โปรโมตประกาศ 30 วัน",
    nameEn: "Listing boost, 30 days",
    target: "listing",
    days: 30,
    months: null,
    sample: "1500.00",
  },
  {
    id: "0199f2a0-0000-7000-8000-00000000b0b1",
    key: "boost_building_month",
    nameTh: "โปรโมตทั้งอาคาร 1 เดือน",
    nameEn: "Building boost, 1 month",
    target: "building",
    days: null,
    months: 1,
    sample: "3000.00",
  },
] as const;

const MEDIA = [
  {
    id: "0199f2a0-0000-7000-8000-00000000d001",
    key: "media_verified_photo",
    nameTh: "บริการถ่ายภาพยืนยันห้องจริง",
    nameEn: "Verified photo service",
    service: "verified_photo",
    sample: "1500.00",
  },
  {
    id: "0199f2a0-0000-7000-8000-00000000d360",
    key: "media_tour_360",
    nameTh: "บริการถ่ายภาพ 360°",
    nameEn: "360° tour service",
    service: "tour_360",
    sample: "3500.00",
  },
] as const;

const withVat = (net: string) => (Number(net) * 1.07).toFixed(2);
const tenantName = (tenantId: string) =>
  Object.values(TENANTS).find((tenant) => tenant.profile.id === tenantId)?.profile.displayName ?? "";

function boostProduct(product: (typeof BOOSTS)[number], tenantId: string): Schemas["BoostProductDto"] {
  const price = g().prices[product.key] ?? null;
  return {
    id: product.id,
    key: product.key,
    nameTh: product.nameTh,
    nameEn: product.nameEn,
    target: product.target,
    days: product.days,
    months: product.months,
    price,
    total: price ? withVat(price) : null,
    vatRate: VAT,
    currency: "THB",
    onSale: price !== null,
    free: product.target === "building" && Boolean(g().freeBuilding[tenantId]),
  };
}

function mediaProduct(product: (typeof MEDIA)[number]): Schemas["MediaServiceProductDto"] {
  const price = g().prices[product.key] ?? null;
  return {
    id: product.id,
    key: product.key,
    nameTh: product.nameTh,
    nameEn: product.nameEn,
    service: product.service,
    price,
    total: price ? withVat(price) : null,
    vatRate: VAT,
    currency: "THB",
    onSale: price !== null,
  };
}

/** A `purchase` platform invoice (Collective issues it, O-008; nothing through the gateway, O-020). */
function purchaseInvoice(
  tenantId: string,
  kind: Schemas["PlatformLineKind"],
  description: string,
  net: string,
): Schemas["StoragePackageInvoiceDto"] {
  const id = crypto.randomUUID();
  const number = `PIV-2026-${String(900 + state.platform.invoices.length).padStart(5, "0")}`;
  const total = withVat(net);
  const dueAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  state.platform.invoices.push({
    id,
    number,
    tenantId,
    tenantName: tenantName(tenantId),
    subscriptionId: null,
    kind: "purchase",
    state: "issued",
    periodStart: today,
    periodEnd: today,
    issuedAt: new Date().toISOString(),
    dueAt,
    overdueSince: null,
    subtotal: Number(net).toFixed(2),
    discount: "0.00",
    vatAmount: (Number(total) - Number(net)).toFixed(2),
    total,
    paidTotal: "0.00",
    creditedTotal: "0.00",
    openAmount: total,
    lines: [
      {
        lineNo: 1,
        kind,
        description,
        quantity: "1.000",
        unitPrice: Number(net).toFixed(4),
        amount: Number(net).toFixed(2),
      },
    ],
    payments: [],
    creditNotes: [],
    qr: null,
    documentId: crypto.randomUUID(),
    nextActions: ["record-payment"],
  });
  return { id, number, total, state: "issued", dueAt, qrAvailable: false };
}

function invoicePaid(ref: Schemas["StoragePackageInvoiceDto"] | null) {
  if (!ref) return;
  ref.state = "paid";
  const invoice = state.platform.invoices.find((i) => i.id === ref.id);
  if (invoice)
    Object.assign(invoice, { state: "paid", paidTotal: invoice.total, openAmount: "0.00", qr: null, nextActions: [] });
}

const publicBoost = ({ tenantId: _tenantId, ...boost }: MockGrowthWorld["boosts"][number]): Schemas["BoostDto"] =>
  boost;
const publicOrder = ({
  tenantId: _tenantId,
  tenantName: _tenantName,
  partnerRef: _partnerRef,
  scheduledAt: _scheduledAt,
  ...order
}: MockGrowthWorld["orders"][number]): Schemas["MediaServiceOrderDto"] => order;
const publicPage = ({ tenantId: _tenantId, ...page }: MockGrowthWorld["pages"][number]): Schemas["SocialChannelDto"] =>
  page;
const publicPost = ({
  tenantId: _tenantId,
  listingId: _listingId,
  ...post
}: MockGrowthWorld["posts"][number]): Schemas["SocialPostDto"] => post;

/** Boosts expire when their window ends (the api's `boosts` job). */
function expireBoosts() {
  const now = Date.now();
  for (const boost of g().boosts)
    if (boost.state === "active" && boost.endsAt && Date.parse(boost.endsAt) <= now) boost.state = "expired";
}

/** Active from now, or queued after the target's last boost still in force, for its days / calendar months. */
function activate(boost: MockGrowthWorld["boosts"][number]) {
  const sameTarget = g().boosts.filter(
    (b) =>
      b !== boost &&
      b.state === "active" &&
      b.endsAt &&
      (boost.listingId ? b.listingId === boost.listingId : b.buildingId === boost.buildingId),
  );
  const after = Math.max(Date.now(), ...sameTarget.map((b) => Date.parse(b.endsAt!)));
  const start = new Date(after);
  const end = new Date(start);
  if (boost.days) end.setTime(start.getTime() + boost.days * 86_400_000);
  else end.setUTCMonth(end.getUTCMonth() + (boost.months ?? 1));
  Object.assign(boost, { state: "active", startsAt: start.toISOString(), endsAt: end.toISOString() });
}

/** The landlord's listings (B7.2 world) the tenant holds. */
const listingOf = (tenantId: string, listingId: string) =>
  state.listingWorld.listings.find((l) => l.tenantId === tenantId && l.dto.id === listingId) ?? null;
/** Buildings the tenant runs: the sample tenant's owner world; the landlord's listing buildings. */
const buildingOf = (tenantId: string, buildingId: string): { id: string; name: string } | null => {
  if (tenantId === SAMPLE) {
    const building = state.owner.buildings.find((b) => b.id === buildingId);
    return building ? { id: building.id, name: building.name } : null;
  }
  return null;
};

// ---- Facebook Page (fake adapter) ----

function pageFromToken(token: string): { ok: true; name: string } | { ok: false } {
  if (!token.startsWith("fake-page-token-") || token.includes("revoked")) return { ok: false };
  return { ok: true, name: token.slice("fake-page-token-".length).replace(/-/g, " ") || "Page" };
}

/** Queues (and, like the worker a minute later, posts) the tenant's published listings on a verified Page. */
function postPublished(tenantId: string, page: MockGrowthWorld["pages"][number]) {
  if (!page.autoPost || page.state !== "verified") return;
  for (const l of state.listingWorld.listings) {
    if (l.tenantId !== tenantId || l.dto.state !== "published" || l.dto.hidden) continue;
    const existing = g().posts.find((p) => p.listingId === l.dto.id && p.channelId === page.id);
    if (existing) continue;
    const at = new Date().toISOString();
    g().posts.push({
      id: crypto.randomUUID(),
      tenantId,
      listingId: l.dto.id,
      channelId: page.id,
      pageId: page.pageId,
      pageName: page.pageName,
      state: "posted",
      pendingAction: null,
      postUrl: `https://www.facebook.com/${page.pageId}/posts/${1000 + g().posts.length}`,
      attempts: 1,
      lastError: null,
      postedAt: at,
      updatedOnPageAt: null,
      deletedAt: null,
    });
  }
}

/** The worker's next run: queued posts on a verified Page go up. */
function runWorker(tenantId: string) {
  for (const post of g().posts) {
    if (post.tenantId !== tenantId || post.state !== "queued") continue;
    const page = g().pages.find((p) => p.id === post.channelId);
    if (!page || page.state !== "verified") continue;
    post.attempts += 1;
    post.state = post.pendingAction === "delete" ? "deleted" : "posted";
    if (post.state === "posted") {
      post.postUrl ??= `https://www.facebook.com/${page.pageId}/posts/${1000 + g().posts.length}`;
      post.postedAt ??= new Date().toISOString();
      if (post.pendingAction === "update") post.updatedOnPageAt = new Date().toISOString();
    } else post.deletedAt = new Date().toISOString();
    post.pendingAction = null;
    post.lastError = null;
  }
}

export function failPost(listingId: string): boolean {
  const post = g().posts.find((p) => p.listingId === listingId && p.state !== "deleted");
  if (!post) return false;
  Object.assign(post, {
    state: "failed",
    pendingAction: "update",
    attempts: 5,
    lastError: "Facebook answered 500 (An unknown error occurred) five times",
  });
  return true;
}

export function publishGrowthPrice(product: string): boolean {
  const all = [...BOOSTS, ...MEDIA];
  if (product === "addon") {
    g().addon = {
      versionId: "0199f2a0-0000-7000-8000-0000000000cc",
      monthlyFee: "990.00",
      setupFee: "1500.00",
      effectiveFrom: new Date().toISOString().slice(0, 10),
    };
    return true;
  }
  const chosen = product === "all" ? all : all.filter((p) => p.key === product);
  for (const p of chosen) g().prices[p.key] = p.sample;
  return chosen.length > 0;
}

export function growthPaid(kind: "boost" | "order", id: string): boolean {
  if (kind === "boost") {
    const boost = g().boosts.find((b) => b.id === id && b.state === "pending_payment");
    if (!boost) return false;
    invoicePaid(boost.invoice);
    activate(boost);
    return true;
  }
  const order = g().orders.find((o) => o.id === id && o.state === "pending_payment");
  if (!order) return false;
  invoicePaid(order.invoice);
  Object.assign(order, { state: "requested", requestedAt: new Date().toISOString() });
  return true;
}

export function setFacebookMode(mode: string): void {
  g().facebookMode = mode === "off" ? "off" : "fake";
}

export function setFreeBuildingBoost(on: boolean): void {
  g().freeBuilding[SAMPLE] = on;
}

// ---- The agency's LINE OA integration add-on (G4) ----

export function addonOffer(tenantId: string): Schemas["MessagingAddonsDto"] {
  const agency = tenantId === AGENCY;
  const addon = g().addon;
  return {
    offer: agency
      ? {
          planKey: "line_oa_integration",
          nameTh: "เชื่อม LINE OA ของบริษัทนายหน้า",
          nameEn: "Agency LINE OA integration",
          versionId: addon?.versionId ?? null,
          onSale: addon !== null,
          monthlyFee: addon?.monthlyFee ?? null,
          setupFee: addon?.setupFee ?? null,
          vatRate: VAT,
          currency: "THB",
          effectiveFrom: addon?.effectiveFrom ?? null,
        }
      : null,
    setupCharged: Boolean(g().addonSetupCharged[tenantId]),
    invoices: g().addonInvoices[tenantId] ?? [],
  };
}

/**
 * The add-on check of `POST /v1/owner/messaging/channels` for the agency (D-296 (6)): while a priced version is in
 * force, the request must accept it; the setup fee is invoiced once on the first accepted connection.
 */
export function addonGate(tenantId: string, op: string, accepted: string | undefined): Response | null {
  const addon = g().addon;
  if (tenantId !== AGENCY || !addon) return null;
  if (accepted !== addon.versionId)
    return problem(op, "messaging.addon_terms_required", {
      addon: {
        versionId: addon.versionId,
        monthlyFee: addon.monthlyFee,
        setupFee: addon.setupFee,
        vatRate: VAT,
        currency: "THB",
      },
    });
  if (!g().addonSetupCharged[tenantId]) {
    const invoice = purchaseInvoice(tenantId, "setup", "ค่าติดตั้งการเชื่อม LINE OA", addon.setupFee);
    g().addonSetupCharged[tenantId] = true;
    const today = new Date().toISOString().slice(0, 10);
    (g().addonInvoices[tenantId] ??= []).unshift({
      id: invoice.id,
      number: invoice.number,
      charge: "setup",
      periodStart: today,
      periodEnd: today,
      total: invoice.total,
      state: "issued",
    });
  }
  return null;
}

export const growthHandlers: HttpHandler[] = [
  // ---- G4: Facebook Page ----
  http.get("*/v1/owner/social-channels", ({ request }) => {
    const ok = owner(request, "owner.socialChannels.list");
    if (ok instanceof Response) return ok;
    return json(
      g()
        .pages.filter((p) => p.tenantId === ok.tenantId && p.state !== "revoked")
        .map(publicPage),
    );
  }),
  http.post("*/v1/owner/social-channels", async ({ request }) => {
    const op = "owner.socialChannels.connect";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.settings.update");
    if (denied) return denied;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Partial<Schemas["SocialChannelConnectDto"]>;
      if (!/^\d{5,30}$/.test(input.pageId ?? "")) return validation(op, "pageId", "the Page id (digits)");
      if ((input.pageAccessToken ?? "").length < 10) return validation(op, "pageAccessToken", "a Page access token");
      if (g().facebookMode === "off") return problem(op, "facebook.unavailable");
      const checked = pageFromToken(input.pageAccessToken!);
      // A refused token stores nothing (D-296 (4)).
      if (!checked.ok) return problem(op, "facebook.page_refused");
      const at = new Date().toISOString();
      for (const page of g().pages)
        if (page.tenantId === ok.tenantId && page.state !== "revoked") Object.assign(page, { state: "revoked" });
      const page: MockGrowthWorld["pages"][number] = {
        id: crypto.randomUUID(),
        tenantId: ok.tenantId,
        provider: "facebook_page",
        pageId: input.pageId!,
        pageName: checked.name,
        state: "verified",
        autoPost: input.autoPost ?? true,
        verifiedAt: at,
        lastCheckedAt: at,
        lastError: null,
        createdAt: at,
      };
      g().pages.push(page);
      postPublished(ok.tenantId, page);
      return { status: 201, body: publicPage(page) };
    });
  }),
  http.post("*/v1/owner/social-channels/:channelId/actions/:action", ({ request, params }) => {
    const action = String(params.action);
    const op = action === "verify" ? "owner.socialChannels.verify" : "owner.socialChannels.revoke";
    if (action !== "verify" && action !== "revoke") return notFound("owner.socialChannels.verify");
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.settings.update");
    if (denied) return denied;
    const page = g().pages.find(
      (p) => p.id === params.channelId && p.tenantId === ok.tenantId && p.state !== "revoked",
    );
    if (!page) return notFound(op);
    if (action === "revoke") {
      page.state = "revoked";
      // Waiting posts are dropped; posts already on the Page stay.
      g().posts = g().posts.filter((p) => !(p.channelId === page.id && p.state === "queued"));
      return new HttpResponse(null, { status: 204 });
    }
    if (g().facebookMode === "off") return problem(op, "facebook.unavailable");
    page.lastCheckedAt = new Date().toISOString();
    if (page.state === "failing" && page.lastError?.includes("expired")) return json(publicPage(page));
    Object.assign(page, { state: "verified", lastError: null, verifiedAt: page.lastCheckedAt });
    return json(publicPage(page));
  }),
  http.get("*/v1/owner/listings/:listingId/social-posts", ({ request, params }) => {
    const ok = owner(request, "owner.listingSocialPosts.list");
    if (ok instanceof Response) return ok;
    if (!listingOf(ok.tenantId, String(params.listingId))) return notFound("owner.listingSocialPosts.list");
    const posts = g().posts.filter((p) => p.tenantId === ok.tenantId && p.listingId === params.listingId);
    const answer = posts.map(publicPost);
    runWorker(ok.tenantId);
    return json(answer);
  }),
  http.post("*/v1/owner/listings/:listingId/social-posts/:postId/actions/retry", async ({ request, params }) => {
    const op = "owner.listingSocialPosts.retry";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "listing.manage");
    if (denied) return denied;
    const post = g().posts.find(
      (p) => p.id === params.postId && p.listingId === params.listingId && p.tenantId === ok.tenantId,
    );
    if (!post) return notFound(op);
    return idempotent(request, op, () => {
      const page = g().pages.find((p) => p.id === post.channelId);
      if (post.state !== "failed" || page?.state !== "verified") return problem(op, "social.post_invalid_state");
      Object.assign(post, { state: "queued", attempts: 0, lastError: null });
      return { status: 200, body: publicPost(post) };
    });
  }),

  // ---- G4: the agency's LINE OA add-on ----
  http.get("*/v1/owner/messaging/addons", ({ request }) => {
    const ok = owner(request, "owner.messagingAddons.get");
    if (ok instanceof Response) return ok;
    return json(addonOffer(ok.tenantId));
  }),

  // ---- G5: boosts ----
  http.get("*/v1/owner/boost-products", ({ request }) => {
    const ok = owner(request, "owner.boosts.products");
    if (ok instanceof Response) return ok;
    return json({ products: BOOSTS.map((p) => boostProduct(p, ok.tenantId)) } satisfies Schemas["BoostProductsDto"]);
  }),
  http.get("*/v1/owner/boosts", ({ request }) => {
    const ok = owner(request, "owner.boosts.list");
    if (ok instanceof Response) return ok;
    expireBoosts();
    const q = query(request);
    const data = g()
      .boosts.filter(
        (b) =>
          b.tenantId === ok.tenantId &&
          (!q.get("state") || b.state === q.get("state")) &&
          (!q.get("listingId") || b.listingId === q.get("listingId")),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicBoost);
    return json({ data } satisfies Schemas["BoostsDto"]);
  }),
  http.get("*/v1/owner/boosts/:boostId", ({ request, params }) => {
    const ok = owner(request, "owner.boosts.get");
    if (ok instanceof Response) return ok;
    const boost = g().boosts.find((b) => b.id === params.boostId && b.tenantId === ok.tenantId);
    return boost ? json(publicBoost(boost)) : notFound("owner.boosts.get");
  }),
  ...(["listings", "buildings"] as const).map((kind) =>
    http.post(`*/v1/owner/${kind}/:targetId/boosts`, async ({ request, params }) => {
      const op = kind === "listings" ? "owner.boosts.boostListing" : "owner.boosts.boostBuilding";
      const ok = mutating(request, op);
      if (ok instanceof Response) return ok;
      const denied = allowed(ok, op, "tenant.subscription.manage");
      if (denied) return denied;
      const targetId = String(params.targetId);
      const listing = kind === "listings" ? listingOf(ok.tenantId, targetId) : null;
      const building = kind === "buildings" ? buildingOf(ok.tenantId, targetId) : null;
      if (!listing && !building) return notFound(op);
      return idempotent(request, op, (payload) => {
        const { productId } = payload as unknown as Schemas["BoostPurchaseDto"];
        const product = BOOSTS.find((p) => p.id === productId && p.target === (listing ? "listing" : "building"));
        if (!product) return validation(op, "productId", "a boost product for this target");
        const offer = boostProduct(product, ok.tenantId);
        if (listing && (listing.dto.state !== "published" || listing.dto.hidden))
          return problem(op, "boost.listing_not_public");
        expireBoosts();
        const sameTarget = (b: MockGrowthWorld["boosts"][number]) =>
          b.tenantId === ok.tenantId && (listing ? b.listingId === targetId : b.buildingId === targetId);
        if (offer.free) {
          if (g().boosts.some((b) => sameTarget(b) && b.free && b.state === "active"))
            return problem(op, "boost.already_active");
        } else {
          if (!offer.onSale || !offer.price) return problem(op, "boost.not_on_sale");
          if (g().boosts.some((b) => sameTarget(b) && b.productId === product.id && b.state === "pending_payment"))
            return problem(op, "boost.pending");
        }
        const boost: MockGrowthWorld["boosts"][number] = {
          id: crypto.randomUUID(),
          tenantId: ok.tenantId,
          productId: product.id,
          productKey: product.key,
          name: product.nameTh,
          target: product.target,
          listingId: listing?.dto.id ?? null,
          listingSlug: listing?.dto.slug ?? null,
          buildingId: building?.id ?? null,
          targetName: listing?.dto.titleTh ?? building?.name ?? "",
          days: product.days,
          months: product.months,
          price: offer.free ? "0.00" : offer.total!,
          free: offer.free,
          state: "pending_payment",
          startsAt: null,
          endsAt: null,
          invoice: offer.free ? null : purchaseInvoice(ok.tenantId, "boost", product.nameTh, offer.price!),
          createdAt: new Date().toISOString(),
        };
        g().boosts.push(boost);
        if (offer.free) activate(boost);
        return { status: 201, body: publicBoost(boost) };
      });
    }),
  ),

  // ---- G5: verified photo / 360° ----
  http.get("*/v1/owner/media-service-products", ({ request }) => {
    const ok = owner(request, "owner.mediaServices.products");
    if (ok instanceof Response) return ok;
    return json({ products: MEDIA.map(mediaProduct) } satisfies Schemas["MediaServiceProductsDto"]);
  }),
  http.get("*/v1/owner/media-service-orders", ({ request }) => {
    const ok = owner(request, "owner.mediaServices.list");
    if (ok instanceof Response) return ok;
    const data = g()
      .orders.filter((o) => o.tenantId === ok.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicOrder);
    return json({ data } satisfies Schemas["MediaServiceOrdersDto"]);
  }),
  http.get("*/v1/owner/media-service-orders/:orderId", ({ request, params }) => {
    const ok = owner(request, "owner.mediaServices.get");
    if (ok instanceof Response) return ok;
    const order = g().orders.find((o) => o.id === params.orderId && o.tenantId === ok.tenantId);
    return order ? json(publicOrder(order)) : notFound("owner.mediaServices.get");
  }),
  http.post("*/v1/owner/media-service-orders", async ({ request }) => {
    const op = "owner.mediaServices.order";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.subscription.manage");
    if (denied) return denied;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["MediaServiceOrderCreateDto"];
      const listing = listingOf(ok.tenantId, input.listingId ?? "");
      if (!listing) return notFound(op);
      const product = MEDIA.find((p) => p.service === input.service);
      if (!product) return validation(op, "service", "verified_photo or tour_360");
      const offer = mediaProduct(product);
      if (!offer.onSale || !offer.price || !offer.total) return problem(op, "media_service.not_on_sale");
      if (
        g().orders.some(
          (o) =>
            o.unitId === listing.dto.unitId &&
            o.service === product.service &&
            !["delivered", "cancelled"].includes(o.state),
        )
      )
        return problem(op, "media_service.order_open");
      const order: MockGrowthWorld["orders"][number] = {
        id: crypto.randomUUID(),
        tenantId: ok.tenantId,
        tenantName: tenantName(ok.tenantId),
        service: product.service,
        name: product.nameTh,
        state: "pending_payment",
        listingId: listing.dto.id,
        listingTitle: listing.dto.titleTh,
        unitId: listing.dto.unitId,
        unitNo:
          state.portfolio[ok.tenantId]?.find((u) => u.unitId === listing.dto.unitId)?.unitNo ??
          listing.dto.unitId.slice(0, 8),
        price: offer.total,
        note: input.note?.trim() || null,
        scheduledFor: null,
        deliverableDocumentIds: [],
        requestedAt: null,
        deliveredAt: null,
        cancelledAt: null,
        cancelReason: null,
        invoice: purchaseInvoice(ok.tenantId, "media_service", product.nameTh, offer.price),
        createdAt: new Date().toISOString(),
        partnerRef: null,
        scheduledAt: null,
      };
      g().orders.push(order);
      return { status: 201, body: publicOrder(order) };
    });
  }),
];

/** A paid photo order of the landlord's Thonglor unit waiting for the photographer (the admin queue is never empty). */
function seedGrowth(world: MockGrowthWorld): MockGrowthWorld {
  world.seeded = true;
  world.orders.push({
    id: "0199f2a0-0000-7000-8000-00000000e001",
    tenantId: LANDLORD,
    tenantName: TENANTS.landlord.profile.displayName,
    service: "verified_photo",
    name: "บริการถ่ายภาพยืนยันห้องจริง",
    state: "requested",
    listingId: "8d4b2c1a-0000-4000-8000-00000000a002",
    listingTitle: "เดอะ ลอฟท์ ทองหล่อ 35 ตร.ม. พร้อมอยู่",
    unitId: "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c02",
    unitNo: "8/101",
    price: "1605.00",
    note: "สะดวกช่วงบ่ายวันธรรมดา ติดต่อคุณมาลีก่อนเข้า",
    scheduledFor: null,
    deliverableDocumentIds: [],
    requestedAt: "2026-10-27T10:20:00+07:00",
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    invoice: {
      id: "0199f2a0-0000-7000-8000-00000000e0a1",
      number: "PIV-2026-00871",
      total: "1605.00",
      state: "paid",
      dueAt: "2026-11-03T10:00:00+07:00",
      qrAvailable: false,
    },
    createdAt: "2026-10-27T09:55:00+07:00",
    partnerRef: null,
    scheduledAt: null,
  });
  const agency = { tenantId: AGENCY, tenantName: TENANTS.agency.profile.displayName };
  world.fees.push(
    {
      ...agency,
      id: "0199f2a0-0000-7000-8000-00000000f001",
      dealId: "0199f2a0-0000-7000-8000-00000000fd01",
      leaseId: "0199f2a0-0000-7000-8000-00000000fe01",
      unitNo: "12/345",
      kind: "success_fee",
      billingUnit: "percent_of_amount",
      rate: "10.0000",
      baseAmount: "15000.00",
      amount: "1500.00",
      capped: false,
      accruedOn: "2026-09-18",
      invoiceId: FEE_INVOICE,
      creditNoteId: null,
    },
    {
      ...agency,
      id: "0199f2a0-0000-7000-8000-00000000f002",
      dealId: "0199f2a0-0000-7000-8000-00000000fd02",
      leaseId: "0199f2a0-0000-7000-8000-00000000fe02",
      unitNo: "8/101",
      kind: "co_broke_fee",
      billingUnit: "per_deal",
      rate: "500.0000",
      baseAmount: null,
      amount: "500.00",
      capped: false,
      accruedOn: "2026-09-25",
      invoiceId: FEE_INVOICE,
      creditNoteId: null,
    },
    {
      ...agency,
      id: "0199f2a0-0000-7000-8000-00000000f003",
      dealId: "0199f2a0-0000-7000-8000-00000000fd03",
      leaseId: "0199f2a0-0000-7000-8000-00000000fe03",
      unitNo: "1",
      kind: "success_fee",
      billingUnit: "percent_of_amount",
      rate: "10.0000",
      baseAmount: "22000.00",
      amount: "2200.00",
      capped: false,
      accruedOn: "2026-10-21",
      invoiceId: null,
      creditNoteId: null,
    },
  );
  return world;
}

/** Re-exported for the admin handlers (one world for both surfaces). */
export { g as growthWorld };
