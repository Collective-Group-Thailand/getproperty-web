import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import {
  DEFAULT_FREE_GB,
  GIB,
  PURGE_AFTER_DAYS,
  storageToday,
  vatTotal,
  type MockStorageWorld,
} from "../storage-world";
import { allowed, body, idempotent, json, mutating, notFound, owner, paged, problem, query } from "./support";
import { day, iso } from "./world";

type Schemas = components["schemas"];

/**
 * Pack G1 on the owner surface (D-276, D-285, D-286, D-292): usage against the quota (free allowance + active
 * packages) with the category split and the legal-hold share, the tenant's files with bulk delete / restore
 * (legal holds and evidence refused, all or nothing), and storage packages: offers without a price are not on
 * sale (O-022); a purchase issues a `purchase` platform invoice and activates when Finance records the payment
 * (`POST /__mock/owner/storage/pay`).
 */

const s = (): MockStorageWorld => state.storage;
const CATEGORIES: Schemas["StorageCategory"][] = ["listing_media", "attachment", "system_legal", "system_other"];

const tenantOf = (tenantId: string) => Object.values(TENANTS).find((tenant) => tenant.profile.id === tenantId) ?? null;
const sum = (values: string[]) => values.reduce((total, value) => total + Number(value), 0);

export function freeGbOf(tenantId: string): string {
  return s().quota[tenantId]?.freeGb ?? DEFAULT_FREE_GB;
}

/** `OwnerStorageDto` of a tenant: only the sample tenant stores anything; records at their counted size. */
export function storageOf(tenantId: string, own: boolean): Schemas["OwnerStorageDto"] {
  const files = s().files.filter((f) => f.tenantId === tenantId);
  const records = own
    ? { invoice: 1203, receipt: 1150, payment: 1150, lease: 40, meter_reading: 8800, service_request: 35 }
    : { invoice: 0, receipt: 0, payment: 0, lease: 0, meter_reading: 0, service_request: 0 };
  const recordBytes =
    (records.invoice + records.receipt + records.service_request) * 2048 +
    records.payment * 1024 +
    records.lease * 4096 +
    records.meter_reading * 256;
  const fileBytes = sum(files.map((f) => f.bytes));
  const used = fileBytes + recordBytes;
  const freeGb = freeGbOf(tenantId);
  const freeBytes = Math.round(Number(freeGb) * GIB);
  const packageBytes = sum(
    s()
      .packages.filter((p) => p.tenantId === tenantId && p.state === "active")
      .map((p) => p.sizeBytes),
  );
  const allowance = freeBytes + packageBytes;
  const usedPercent = Math.floor((used / allowance) * 100);
  return {
    asOf: iso(0),
    metered: true,
    usedBytes: String(used),
    fileBytes: String(fileBytes),
    records,
    allowanceBytes: String(allowance),
    usedPercent,
    level: used > allowance ? "over" : used === allowance ? "full" : usedPercent >= 80 ? "warning" : "ok",
    freeGb,
    pricePerGbMonth: null,
    history: Array.from({ length: 30 }, (_, i) => ({
      day: day(i - 30),
      countedBytes: String(Math.round(used * (0.9 + i / 300))),
    })),
    freeBytes: String(freeBytes),
    packageBytes: String(packageBytes),
    categories: CATEGORIES.map((category) => {
      const of = files.filter((f) => f.category === category);
      return { category, bytes: String(sum(of.map((f) => f.bytes))), objects: of.reduce((n, f) => n + f.objects, 0) };
    }),
    legalHoldBytes: String(sum(files.filter((f) => f.held).map((f) => f.bytes))),
    pendingPurgeBytes: String(sum(files.filter((f) => f.deletedAt).map((f) => f.bytes))),
  };
}

function offersFor(tenantId: string): Schemas["StoragePackageOfferDto"][] {
  const type = tenantOf(tenantId)?.profile.type ?? "apartment";
  return s()
    .definitions.filter(
      (d) => d.isActive && d.visibility === "public" && (d.tenantType === null || d.tenantType === type),
    )
    .map((d) => ({
      id: d.id,
      key: d.key,
      nameTh: d.nameTh,
      nameEn: d.nameEn,
      sizeBytes: d.sizeBytes,
      period: d.period,
      price: d.onSale ? d.unitPrice : null,
      total: d.onSale && d.unitPrice ? vatTotal(d.unitPrice, d.vatRate) : null,
      vatRate: d.vatRate,
      currency: "THB",
      onSale: d.onSale,
    }));
}

const publicPackage = ({ tenantId: _tenantId, ...rest }: MockStorageWorld["packages"][number]) => rest;

function plusPeriod(from: string, period: Schemas["StoragePackagePeriod"]): string {
  const date = new Date(`${from}T00:00:00Z`);
  if (period === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCFullYear(date.getUTCFullYear() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Finance records the payment of a package's purchase invoice → the package is active from today (D-292 (5)). */
export function storagePackagePaid(packageId: string): Schemas["OwnerStoragePackageDto"] | null {
  const pack = s().packages.find((p) => p.id === packageId && p.state === "pending_payment");
  if (!pack) return null;
  const startsOn = storageToday();
  Object.assign(pack, { state: "active", startsOn, endsOn: plusPeriod(startsOn, pack.period) });
  if (pack.invoice) pack.invoice.state = "paid";
  const invoice = state.platform.invoices.find((i) => i.id === pack.invoice?.id);
  if (invoice)
    Object.assign(invoice, { state: "paid", paidTotal: invoice.total, openAmount: "0.00", qr: null, nextActions: [] });
  return publicPackage(pack);
}

/** The founder publishes a price for a package definition (a published price-plan version, O-022). */
export function storagePricePublished(key: string, price: string): Schemas["StoragePackageDefinitionDto"] | null {
  const definition = s().definitions.find((d) => d.key === key);
  if (!definition) return null;
  Object.assign(definition, { unitPrice: price, versionState: "published", onSale: true });
  return definition;
}

export const storageHandlers: HttpHandler[] = [
  http.get("*/v1/owner/storage", ({ request }) => {
    const ok = owner(request, "owner.storage.get");
    if (ok instanceof Response) return ok;
    return json(storageOf(ok.tenantId, ok.own) satisfies Schemas["OwnerStorageDto"]);
  }),

  http.get("*/v1/owner/storage/files", ({ request }) => {
    const ok = owner(request, "owner.storage.files");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const deleted = params.get("state") === "deleted";
    const category = params.get("category");
    const q = params.get("q")?.toLowerCase();
    const byDate = params.get("sort") === "createdAt";
    const asc = params.get("order") === "asc";
    const rows = s()
      .files.filter(
        (f) =>
          f.tenantId === ok.tenantId &&
          Boolean(f.deletedAt) === deleted &&
          (!category || f.category === category) &&
          (!q || (f.title ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const diff = byDate ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : Number(a.bytes) - Number(b.bytes);
        return asc ? diff : -diff;
      })
      .map(({ tenantId: _tenantId, ...rest }) => rest);
    return json(paged(rows, request) satisfies Schemas["StoredFilePageDto"]);
  }),

  http.post("*/v1/owner/storage/files/actions/:action", async ({ request, params }) => {
    const action = params.action === "restore" ? "restore" : params.action === "delete" ? "delete" : null;
    if (!action) return undefined;
    const op = action === "delete" ? "owner.storage.deleteFiles" : "owner.storage.restoreFiles";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.subscription.manage");
    if (denied) return denied;
    const { documentIds } = await body<Schemas["StorageFilesActionDto"]>(request);
    if (!Array.isArray(documentIds) || documentIds.length === 0 || documentIds.length > 100)
      return problem(op, "validation.failed", {
        errors: [{ path: "documentIds", code: "invalid", message: "1–100 ids" }],
      });
    const files = documentIds.map((id) => s().files.find((f) => f.id === id && f.tenantId === ok.tenantId));
    if (files.some((f) => !f)) return notFound(op);
    const found = files as MockStorageWorld["files"];
    if (action === "delete") {
      const held = found.filter((f) => f.held).map((f) => f.id);
      if (held.length) return problem(op, "storage.legal_hold", { heldDocumentIds: held });
      if (found.some((f) => !f.deletedAt && !f.deletable)) return problem(op, "storage.not_deletable");
      const purgeAfter = new Date(Date.now() + PURGE_AFTER_DAYS * 86_400_000).toISOString();
      for (const f of found)
        if (!f.deletedAt)
          Object.assign(f, {
            deletedAt: new Date().toISOString(),
            purgeAfter,
            deletable: false,
            notDeletableReason: null,
          });
    } else {
      for (const f of found)
        if (f.deletedAt)
          Object.assign(f, { deletedAt: null, purgeAfter: null, deletable: true, notDeletableReason: null });
    }
    state.owner.received.push({ op, idempotencyKey: null, body: { documentIds } });
    return json({
      data: found.map(({ tenantId: _tenantId, ...rest }) => rest),
    } satisfies Schemas["StoredFilesResultDto"]);
  }),

  http.get("*/v1/owner/storage/packages", ({ request }) => {
    const ok = owner(request, "owner.storage.packages");
    if (ok instanceof Response) return ok;
    return json({
      offers: offersFor(ok.tenantId),
      packages: s()
        .packages.filter((p) => p.tenantId === ok.tenantId)
        .map(publicPackage),
    } satisfies Schemas["OwnerStoragePackagesDto"]);
  }),

  http.post("*/v1/owner/storage/packages", async ({ request }) => {
    const op = "owner.storage.purchasePackage";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.subscription.manage");
    if (denied) return denied;
    return idempotent(request, op, (payload) => {
      const { packageId, autoRenew = false } = payload as unknown as Schemas["StoragePurchaseDto"];
      const offer = offersFor(ok.tenantId).find((o) => o.id === packageId);
      if (!offer) return notFound(op);
      if (!offer.onSale || !offer.total || !offer.price) return problem(op, "storage.package_not_on_sale");
      if (
        s().packages.some(
          (p) => p.tenantId === ok.tenantId && p.packageId === packageId && p.state === "pending_payment",
        )
      )
        return problem(op, "storage.package_pending");
      const invoiceId = crypto.randomUUID();
      const number = `PIV-2026-${String(900 + state.platform.invoices.length).padStart(5, "0")}`;
      const vat = (Number(offer.total) - Number(offer.price)).toFixed(2);
      const dueAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const tenant = tenantOf(ok.tenantId);
      state.platform.invoices.push({
        id: invoiceId,
        number,
        tenantId: ok.tenantId,
        tenantName: tenant?.profile.displayName ?? "",
        subscriptionId: null,
        kind: "purchase",
        state: "issued",
        periodStart: storageToday(),
        periodEnd: plusPeriod(storageToday(), offer.period),
        issuedAt: new Date().toISOString(),
        dueAt,
        overdueSince: null,
        subtotal: Number(offer.price).toFixed(2),
        discount: "0.00",
        vatAmount: vat,
        total: offer.total,
        paidTotal: "0.00",
        creditedTotal: "0.00",
        openAmount: offer.total,
        lines: [
          {
            lineNo: 1,
            kind: "storage",
            description: offer.nameTh,
            quantity: "1.000",
            unitPrice: Number(offer.price).toFixed(4),
            amount: Number(offer.price).toFixed(2),
          },
        ],
        payments: [],
        creditNotes: [],
        qr: null,
        documentId: crypto.randomUUID(),
        nextActions: ["record-payment"],
      });
      const pack: MockStorageWorld["packages"][number] = {
        tenantId: ok.tenantId,
        id: crypto.randomUUID(),
        packageId: offer.id,
        name: offer.nameTh,
        sizeBytes: offer.sizeBytes,
        price: offer.total,
        currency: "THB",
        period: offer.period,
        state: "pending_payment",
        startsOn: null,
        endsOn: null,
        autoRenew: Boolean(autoRenew),
        renewalOfId: null,
        invoice: { id: invoiceId, number, total: offer.total, state: "issued", dueAt, qrAvailable: false },
        createdAt: new Date().toISOString(),
      };
      s().packages.push(pack);
      return { status: 201, body: publicPackage(pack) satisfies Schemas["OwnerStoragePackageDto"] };
    });
  }),

  http.get("*/v1/owner/storage/packages/:storagePackageId", ({ request, params }) => {
    const ok = owner(request, "owner.storage.package");
    if (ok instanceof Response) return ok;
    const pack = s().packages.find((p) => p.id === params.storagePackageId && p.tenantId === ok.tenantId);
    return pack ? json(publicPackage(pack)) : notFound("owner.storage.package");
  }),

  http.post("*/v1/owner/storage/packages/:storagePackageId/actions/auto-renew", async ({ request, params }) => {
    const op = "owner.storage.setAutoRenew";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.subscription.manage");
    if (denied) return denied;
    const pack = s().packages.find((p) => p.id === params.storagePackageId && p.tenantId === ok.tenantId);
    if (!pack) return notFound(op);
    const { autoRenew } = await body<Schemas["StorageAutoRenewDto"]>(request);
    pack.autoRenew = Boolean(autoRenew);
    state.owner.received.push({ op, idempotencyKey: null, body: { autoRenew: pack.autoRenew } });
    return json(publicPackage(pack));
  }),
];
