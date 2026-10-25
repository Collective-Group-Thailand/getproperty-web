import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { canSee } from "./service";
import { idempotent, json, notFound, problem, r2, reader, validation, writer, type R2Ok } from "./support";
import type { MockRequest } from "./world";

type Schemas = components["schemas"];

/**
 * Who fixes, who pays (D-263) for the landlord's requests: decisions kept as history, quotations / receipts,
 * settlement of what is due onto the tenant's next invoice. Only landlord tenants (`decision_unavailable` otherwise).
 */

const base = "*/v1/owner/service-requests/:serviceRequestId";
const cents = (value: string) => Math.round(Number(value) * 100);
const money = (c: number) => (c / 100).toFixed(2);

function landlordRequest(ok: R2Ok, id: unknown, op: string): MockRequest | Response {
  const sr = r2().requests.find((candidate) => candidate.id === id && canSee(ok, candidate));
  if (!sr) return notFound(op);
  if (ok.tenantId !== TENANTS.landlord.profile.id && ok.tenantId !== TENANTS.fresh.profile.id)
    return problem(op, "service_request.decision_unavailable");
  sr.repair ??= { decisions: [], costs: [], settlements: [] };
  return sr;
}

function settlementOf(sr: MockRequest): Schemas["ServiceSettlementSummaryDto"] {
  const receipts = sr.repair!.costs.filter((c) => c.kind === "receipt" && !c.voidedAt);
  const total = receipts.reduce((sum, c) => sum + cents(c.amount), 0);
  const byOwner = receipts.filter((c) => c.paidBy === "owner").reduce((sum, c) => sum + cents(c.amount), 0);
  const fraction =
    sr.decision?.costBearer === "tenant"
      ? 1
      : sr.decision?.costBearer === "shared"
        ? Number(sr.decision.tenantSharePercent) / 100
        : 0;
  const tenantShare = Math.round(total * fraction);
  const owes = tenantShare - (total - byOwner);
  const settled = sr.repair!.settlements.reduce((sum, s) => sum + cents(s.amount), 0);
  return {
    receiptsTotal: money(total),
    ownerShare: money(total - tenantShare),
    tenantShare: money(tenantShare),
    paidByOwner: money(byOwner),
    paidByTenant: money(total - byOwner),
    tenantOwes: money(owes),
    settled: money(settled),
    due: money(owes - settled),
  };
}

function costsDto(sr: MockRequest): Schemas["ServiceCostsDto"] {
  const settlement = settlementOf(sr);
  const open = sr.status !== "cancelled";
  return {
    serviceRequestId: sr.id,
    decision: sr.decision,
    decisions: sr.repair!.decisions,
    costs: sr.repair!.costs,
    settlements: sr.repair!.settlements,
    settlement,
    nextActions: [
      ...(open ? ["decide", "add-cost"] : []),
      ...(sr.decision && settlement.due !== "0.00" && sr.unitId ? ["settle"] : []),
    ],
  };
}

export const repairCostHandlers: HttpHandler[] = [
  http.get(`${base}/costs`, ({ request, params }) => {
    const op = "owner.serviceCosts.get";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const sr = landlordRequest(ok, params.serviceRequestId, op);
    return sr instanceof Response ? sr : json(costsDto(sr));
  }),

  http.post(`${base}/actions/decide`, async ({ request, params }) => {
    const op = "owner.serviceCosts.decide";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const sr = landlordRequest(ok, params.serviceRequestId, op);
    if (sr instanceof Response) return sr;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["ServiceDecisionCreateDto"]>;
    if (!body.handledBy || !body.costBearer) return validation(op, "costBearer", "who fixes and who pays");
    let share: string | null = null;
    if (body.costBearer === "shared") {
      const value = Number(body.tenantSharePercent);
      if (!(value > 0 && value < 100)) return validation(op, "tenantSharePercent", "above 0 and below 100", "range");
      share = value.toFixed(2);
    }
    const decidedAt = new Date().toISOString();
    sr.decision = { handledBy: body.handledBy, costBearer: body.costBearer, tenantSharePercent: share, decidedAt };
    sr.repair!.decisions.push({
      id: crypto.randomUUID(),
      handledBy: body.handledBy,
      costBearer: body.costBearer,
      tenantSharePercent: share,
      note: body.note?.trim() || null,
      decidedAt,
    });
    sr.version += 1;
    return json(costsDto(sr));
  }),

  http.post(`${base}/costs`, async ({ request, params }) => {
    const op = "owner.serviceCosts.add";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const sr = landlordRequest(ok, params.serviceRequestId, op);
    if (sr instanceof Response) return sr;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["ServiceCostCreateDto"]>;
    if (!body.description?.trim()) return validation(op, "description", "what it is for");
    if (!body.amount || !/^\d{1,12}(\.\d{1,2})?$/.test(body.amount)) return validation(op, "amount", "baht and satang");
    if ((body.kind === "receipt") !== Boolean(body.paidBy)) return validation(op, "paidBy", "who paid the receipt");
    sr.repair!.costs.push({
      id: crypto.randomUUID(),
      kind: body.kind ?? "receipt",
      description: body.description.trim(),
      amount: Number(body.amount).toFixed(2),
      paidBy: body.paidBy ?? null,
      vendorName: body.vendorName?.trim() || null,
      issuedOn: body.issuedOn ?? new Date().toISOString().slice(0, 10),
      documentId: body.documentId ?? null,
      url: null,
      voidedAt: null,
      voidReason: null,
    });
    return json(costsDto(sr), 201);
  }),

  http.post(`${base}/costs/:costId/actions/void`, async ({ request, params }) => {
    const op = "owner.serviceCosts.void";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const sr = landlordRequest(ok, params.serviceRequestId, op);
    if (sr instanceof Response) return sr;
    const cost = sr.repair!.costs.find((c) => c.id === params.costId);
    if (!cost) return notFound(op);
    if (cost.voidedAt) return problem(op, "service_cost.voided");
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!body.reason?.trim()) return validation(op, "reason", "a reason");
    cost.voidedAt = new Date().toISOString();
    cost.voidReason = body.reason.trim();
    return json(costsDto(sr));
  }),

  http.post(`${base}/actions/settle`, async ({ request, params }) => {
    const op = "owner.serviceCosts.settle";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const sr = landlordRequest(ok, params.serviceRequestId, op);
    if (sr instanceof Response) return sr;
    return idempotent(request, op, () => {
      if (!sr.decision) return problem(op, "service_request.not_decided");
      const due = settlementOf(sr).due;
      if (due === "0.00") return problem(op, "service_request.nothing_to_settle");
      sr.repair!.settlements.push({
        id: crypto.randomUUID(),
        amount: due,
        invoiceChargeId: crypto.randomUUID(),
        settledAt: new Date().toISOString(),
      });
      state.r2.received.push({ op, idempotencyKey: request.headers.get("idempotency-key"), body: { due } });
      return { status: 200, body: costsDto(sr) };
    });
  }),
];
