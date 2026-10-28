import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { FEE_INVOICE, growthWorld } from "../owner/growth";
import { state } from "../state";
import { body, idempotent, json, matches, notFound, paged, platform, problem, query, validation } from "./support";

type Schemas = components["schemas"];
type Fee = ReturnType<typeof growthWorld>["fees"][number];
type Order = ReturnType<typeof growthWorld>["orders"][number];

/*
 * Pack G5 on the admin surface (D-297, D-091, O-032):
 * - fee accruals of every agency; the state follows what they link to — no invoice line yet → `uninvoiced`; on an
 *   invoice → `invoiced`; its credit note requested → `disputed`, issued → `credited`, rejected → `invoiced` again.
 *   A dispute is a credit note (maker) on the fee's invoice for what it was charged incl. VAT; another platform user
 *   approves it with the existing credit-note endpoints (mocks/platform/business.ts).
 * - verified photo / 360° orders: schedule the partner's visit, presign each deliverable as a document of the ordering
 *   tenant (PUT to `/__upload/<id>`), deliver with the document ids, or cancel with a reason.
 */

const money = (n: number) => n.toFixed(2);

/** The agency's September fees as one `purchase` invoice (the api's `growth-fees` job), added once. */
function ensureFeeInvoice(fees: Fee[]) {
  if (state.platform.invoices.some((invoice) => invoice.id === FEE_INVOICE)) return;
  const invoiced = fees.filter((fee) => fee.invoiceId === FEE_INVOICE);
  if (!invoiced.length) return;
  const net = invoiced.reduce((sum, fee) => sum + Number(fee.amount), 0);
  const vat = Math.round(net * 7) / 100;
  state.platform.invoices.push({
    id: FEE_INVOICE,
    number: "PIV-2026-00812",
    tenantId: invoiced[0]!.tenantId,
    tenantName: invoiced[0]!.tenantName,
    subscriptionId: null,
    kind: "purchase",
    state: "issued",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    issuedAt: "2026-10-01T01:05:00+07:00",
    dueAt: "2026-10-31T23:59:00+07:00",
    overdueSince: null,
    subtotal: money(net),
    discount: "0.00",
    vatAmount: money(vat),
    total: money(net + vat),
    paidTotal: "0.00",
    creditedTotal: "0.00",
    openAmount: money(net + vat),
    lines: invoiced.map((fee, index) => ({
      lineNo: index + 1,
      kind: fee.kind,
      description: `${fee.kind === "success_fee" ? "ค่าธรรมเนียมความสำเร็จ" : "ค่าธรรมเนียมโคโบรก"} · ห้อง ${fee.unitNo}`,
      quantity: "1.000",
      unitPrice: Number(fee.amount).toFixed(4),
      amount: fee.amount,
    })),
    payments: [],
    creditNotes: [],
    qr: null,
    documentId: "0199f2a0-0000-7000-8000-00000000f1d0",
    nextActions: ["record-payment", "request-credit-note"],
  });
}

function feeDto(fee: Fee): Schemas["AdminFeeAccrualDto"] {
  const { invoiceId, creditNoteId, ...rest } = fee;
  const invoice = invoiceId ? state.platform.invoices.find((inv) => inv.id === invoiceId) : undefined;
  const note = creditNoteId ? invoice?.creditNotes.find((n) => n.id === creditNoteId) : undefined;
  const stateOf: Schemas["FeeAccrualState"] = !invoice
    ? "uninvoiced"
    : note?.state === "requested"
      ? "disputed"
      : note?.state === "issued"
        ? "credited"
        : "invoiced";
  return {
    ...rest,
    state: stateOf,
    invoice: invoice ? { id: invoice.id, number: invoice.number, state: invoice.state } : null,
    creditNote: note ? { id: note.id, state: note.state, number: note.number, amount: note.amount } : null,
  };
}

const adminOrder = (order: Order): Schemas["AdminMediaServiceOrderDto"] => ({ ...order });

export const growthAdminHandlers: HttpHandler[] = [
  http.get("*/v1/admin/fee-accruals", ({ request }) => {
    const ok = platform(request, "admin.feeAccruals.list", "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const world = growthWorld();
    ensureFeeInvoice(world.fees);
    const q = query(request);
    const rows = world.fees
      .map(feeDto)
      .filter(
        (fee) =>
          (!q.get("state") || fee.state === q.get("state")) &&
          (!q.get("tenantId") || fee.tenantId === q.get("tenantId")) &&
          matches(q.get("q"), fee.tenantName, fee.unitNo),
      )
      .sort((a, b) => b.accruedOn.localeCompare(a.accruedOn));
    return json(paged(rows, request));
  }),
  http.post("*/v1/admin/fee-accruals/:accrualId/actions/dispute", ({ request, params }) => {
    const op = "admin.feeAccruals.dispute";
    const ok = platform(request, op, "admin.platform_invoice.issue");
    if (ok instanceof Response) return ok;
    const world = growthWorld();
    ensureFeeInvoice(world.fees);
    const fee = world.fees.find((f) => f.id === params.accrualId);
    if (!fee) return notFound(op);
    return idempotent(request, op, (payload) => {
      const reason = String((payload as { reason?: string }).reason ?? "").trim();
      if (!reason) return validation(op, "reason", "required");
      const current = feeDto(fee);
      if (current.state === "uninvoiced") return problem(op, "fee.not_invoiced");
      if (current.state === "disputed" || current.state === "credited") return problem(op, "fee.already_disputed");
      const invoice = state.platform.invoices.find((inv) => inv.id === fee.invoiceId)!;
      const note: Schemas["PlatformCreditNoteDto"] = {
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        number: null,
        // What the fee was charged incl. VAT (no monthly cap on the sample invoice).
        amount: money(Math.round(Number(fee.amount) * 107) / 100),
        reason,
        state: "requested",
        requestedBy: ok.userId,
        approvedBy: null,
        issuedAt: null,
        nextActions: ["approve", "reject"],
      };
      invoice.creditNotes.push(note);
      fee.creditNoteId = note.id;
      return { status: 200, body: feeDto(fee) };
    });
  }),

  http.get("*/v1/admin/media-service-orders", ({ request }) => {
    const ok = platform(request, "admin.mediaServices.list", "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const q = query(request);
    const rows = growthWorld()
      .orders.filter(
        (o) =>
          (!q.get("state") || o.state === q.get("state")) &&
          (!q.get("tenantId") || o.tenantId === q.get("tenantId")) &&
          matches(q.get("q"), o.tenantName, o.unitNo, o.listingTitle),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(adminOrder);
    return json(paged(rows, request));
  }),
  http.get("*/v1/admin/media-service-orders/:orderId", ({ request, params }) => {
    const ok = platform(request, "admin.mediaServices.get", "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const order = growthWorld().orders.find((o) => o.id === params.orderId);
    return order ? json(adminOrder(order)) : notFound("admin.mediaServices.get");
  }),
  http.post("*/v1/admin/media-service-orders/:orderId/actions/schedule", async ({ request, params }) => {
    const op = "admin.mediaServices.schedule";
    const ok = platform(request, op, "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const order = growthWorld().orders.find((o) => o.id === params.orderId);
    if (!order) return notFound(op);
    const input = await body<Partial<Schemas["MediaScheduleDto"]>>(request);
    if (!input.scheduledFor || Number.isNaN(Date.parse(input.scheduledFor)))
      return validation(op, "scheduledFor", "a date-time");
    if (order.state !== "requested" && order.state !== "scheduled") return problem(op, "media_service.invalid_state");
    const at = new Date().toISOString();
    Object.assign(order, {
      state: "scheduled",
      scheduledFor: new Date(input.scheduledFor).toISOString(),
      partnerRef: input.partnerRef?.trim() || order.partnerRef,
      scheduledAt: at,
    });
    return json(adminOrder(order));
  }),
  http.post("*/v1/admin/media-service-orders/:orderId/deliverables", async ({ request, params }) => {
    const op = "admin.mediaServices.presignDeliverable";
    const ok = platform(request, op, "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const order = growthWorld().orders.find((o) => o.id === params.orderId);
    if (!order) return notFound(op);
    const input = await body<Partial<Schemas["MediaDeliverableDto"]>>(request);
    if (!input.fileName || !input.mimeType || !input.sizeBytes || !input.sha256 || !input.kind)
      return validation(op, "body", "kind, fileName, mimeType, sizeBytes and sha256 are required");
    if (order.state !== "requested" && order.state !== "scheduled") return problem(op, "media_service.invalid_state");
    if (input.kind === "listing_photo" && !/^image\/(jpeg|png|webp)$/.test(input.mimeType))
      return problem(op, "document.type_not_allowed");
    const file: Schemas["FileDto"] = {
      id: crypto.randomUUID(),
      kind: input.kind === "listing_photo" ? "listing_photo" : "other",
      scopeType: "unit",
      scopeId: order.unitId,
      buildingId: null,
      title: input.title ?? input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: null,
      height: null,
      retentionClass: "listing_photo",
      scanStatus: "pending",
      uploadState: "presigned",
      createdAt: new Date().toISOString(),
    };
    state.staff.files.set(file.id, { file, bytes: null });
    return json(
      {
        file,
        uploadUrl: `${new URL(request.url).origin}/__upload/${file.id}`,
        headers: { "Content-Type": input.mimeType },
        multipart: null,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      } satisfies Schemas["FilePresignedDto"],
      201,
    );
  }),
  http.post("*/v1/admin/media-service-orders/:orderId/actions/deliver", async ({ request, params }) => {
    const op = "admin.mediaServices.deliver";
    const ok = platform(request, op, "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const order = growthWorld().orders.find((o) => o.id === params.orderId);
    if (!order) return notFound(op);
    const { documentIds } = await body<Partial<Schemas["MediaDeliverDto"]>>(request);
    if (!Array.isArray(documentIds) || documentIds.length === 0 || documentIds.length > 60)
      return validation(op, "documentIds", "1–60 uploaded documents");
    if (order.state !== "requested" && order.state !== "scheduled") return problem(op, "media_service.invalid_state");
    for (const id of documentIds) {
      const stored = state.staff.files.get(id);
      if (!stored || stored.file.scopeId !== order.unitId) return notFound(op);
      if (!stored.bytes) return problem(op, "document.not_uploaded");
      if (stored.bytes.byteLength !== stored.file.sizeBytes) return problem(op, "document.size_mismatch");
      stored.file = { ...stored.file, uploadState: "verified", scanStatus: "clean" };
    }
    Object.assign(order, {
      state: "delivered",
      deliverableDocumentIds: [...documentIds],
      deliveredAt: new Date().toISOString(),
    });
    return json(adminOrder(order));
  }),
  http.post("*/v1/admin/media-service-orders/:orderId/actions/cancel", ({ request, params }) => {
    const op = "admin.mediaServices.cancel";
    const ok = platform(request, op, "admin.listing.verify");
    if (ok instanceof Response) return ok;
    const order = growthWorld().orders.find((o) => o.id === params.orderId);
    if (!order) return notFound(op);
    return idempotent(request, op, (payload) => {
      const reason = String((payload as { reason?: string }).reason ?? "").trim();
      if (!reason) return validation(op, "reason", "required");
      if (order.state === "delivered" || order.state === "cancelled") return problem(op, "media_service.invalid_state");
      Object.assign(order, { state: "cancelled", cancelledAt: new Date().toISOString(), cancelReason: reason });
      return { status: 200, body: adminOrder(order) };
    });
  }),
];
