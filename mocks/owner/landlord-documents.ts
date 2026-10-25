import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { idempotent, json, mutating, notFound, owner, paged, problem, query } from "./support";

type Schemas = components["schemas"];

const LIVE = new Set<Schemas["LeaseStatus"]>(["active", "notice_given", "ending", "ended"]);

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The stamp duty of a mock lease (B7.5, O-019): 1 baht per 1,000 baht or fraction of the rent over the term, fixed
 * once the lease left draft, due 15 days after it took effect (the start date stands in for the signing here).
 * e-Stamp is off, as in production until an adapter is configured.
 */
function stampDutyOf(lease: Schemas["LeaseDto"]): Schemas["StampDutyDto"] {
  const total = Number(lease.rent) * lease.months;
  return {
    leaseId: lease.id,
    amount: Math.ceil(total / 1000).toFixed(2),
    fixed: lease.status !== "draft",
    payer: lease.stampDutyPayer,
    dueDate: LIVE.has(lease.status) ? addDays(lease.startDate, 15) : null,
    paid: state.stampDuty[lease.id] ?? null,
    eStampAvailable: false,
  };
}

const doc = (
  id: string,
  kind: Schemas["DocumentKind"],
  title: string,
  unitId: string,
  createdAt: string,
): Schemas["OwnerDocumentDto"] => ({
  // ids ending in 0a4d open as a placeholder PDF in the files mock
  id: `${id.slice(0, -4)}0a4d`,
  kind,
  title,
  sizeBytes: kind === "contract" ? 182_000 : 46_000,
  unitId,
  createdAt,
});

/** Documents of the owner world's units and of the landlord persona's portfolio (B7.5 `GET /v1/owner/documents`). */
function documentsOf(tenantId: string, own: boolean): Schemas["OwnerDocumentDto"][] {
  const world = state.owner;
  const fromWorld = own
    ? [
        ...world.leases
          .filter((lease) => lease.contract)
          .map((lease) =>
            doc(lease.id, "contract", `สัญญาเช่า ${lease.number ?? lease.unitNo}.pdf`, lease.unitId, lease.createdAt),
          ),
        ...world.invoices
          .filter((invoice) => invoice.number && invoice.unitId)
          .map((invoice) =>
            doc(invoice.id, "pdf_invoice", `ใบแจ้งหนี้ ${invoice.number}.pdf`, invoice.unitId!, invoice.issuedAt!),
          ),
      ]
    : [];
  const fromPortfolio = (state.portfolio[tenantId] ?? []).flatMap((unit) =>
    unit.leaseId
      ? [
          doc(unit.leaseId, "contract", `สัญญาเช่า ${unit.unitNo}.pdf`, unit.unitId, "2026-05-28T10:00:00+07:00"),
          ...(unit.invoice
            ? [
                doc(
                  unit.invoice.id,
                  unit.invoice.status === "paid" ? "pdf_receipt" : "pdf_invoice",
                  `${unit.invoice.status === "paid" ? "ใบเสร็จรับเงิน" : "ใบแจ้งหนี้"} ${unit.unitNo} ต.ค. 2569.pdf`,
                  unit.unitId,
                  "2026-10-01T09:00:00+07:00",
                ),
              ]
            : []),
        ]
      : [],
  );
  return [...fromWorld, ...fromPortfolio].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const landlordDocumentHandlers: HttpHandler[] = [
  http.get("*/v1/owner/documents", ({ request }) => {
    const ok = owner(request, "owner.documents.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const unitId = params.get("unitId");
    const kind = params.get("kind");
    const docs = documentsOf(ok.tenantId, ok.own).filter(
      (candidate) => (!unitId || candidate.unitId === unitId) && (!kind || candidate.kind === kind),
    );
    return json(paged(docs, request));
  }),

  http.get("*/v1/owner/leases/:leaseId/stamp-duty", ({ request, params }) => {
    const op = "owner.leases.stampDuty";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? state.owner.leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    return lease ? json(stampDutyOf(lease)) : notFound(op);
  }),

  http.post("*/v1/owner/leases/:leaseId/stamp-duty", async ({ request, params }) => {
    const op = "owner.leases.recordStampDuty";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? state.owner.leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return idempotent(request, op, (payload) => {
      const current = stampDutyOf(lease);
      if (!current.fixed) return problem(op, "lease.stamp_duty_not_fixed");
      if (current.paid) return problem(op, "lease.stamp_duty_paid");
      const input = payload as Schemas["StampDutyRecordDto"];
      state.stampDuty[lease.id] = {
        channel: "manual",
        reference: input.reference?.trim() || null,
        paidAt: input.paidOn ? `${input.paidOn}T12:00:00+07:00` : new Date().toISOString(),
        documentId: input.documentId ?? null,
      };
      return { status: 200, body: stampDutyOf(lease) };
    });
  }),

  http.post("*/v1/owner/leases/:leaseId/stamp-duty/actions/pay-online", async ({ request, params }) => {
    const op = "owner.leases.payStampDuty";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? state.owner.leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return idempotent(request, op, () => problem(op, "lease.e_stamp_unavailable"));
  }),
];
