import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import {
  documentDownload,
  idempotent,
  json,
  mutating,
  notFound,
  owner,
  paged,
  problem,
  query,
  validation,
} from "./support";

type Schemas = components["schemas"];

let noticeSeq = 0;
/** Lease statuses each letter is accepted in (as the API). */
const NOTICE_STATUS: Record<Schemas["LeaseNoticeKind"], Schemas["LeaseStatus"][]> = {
  rent_increase: ["active", "notice_given"],
  renewal_offer: ["active", "notice_given"],
  non_renewal: ["active"],
  termination: ["active"],
  late_payment: ["active", "notice_given", "ending"],
};
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

  http.get("*/v1/owner/leases/:leaseId/notices", ({ request, params }) => {
    const op = "owner.leases.notices";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? state.owner.leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    return lease ? json(state.leaseNotices[lease.id] ?? []) : notFound(op);
  }),

  http.post("*/v1/owner/leases/:leaseId/notices", async ({ request, params }) => {
    const op = "owner.leases.issueNotice";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? state.owner.leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["LeaseNoticeCreateDto"];
      const allowed = NOTICE_STATUS[input.kind] ?? [];
      if (!allowed.includes(lease.status)) return problem(op, "lease.invalid_state");
      const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
      const notice: Schemas["LeaseNoticeDto"] = {
        id: crypto.randomUUID(),
        leaseId: lease.id,
        kind: input.kind,
        number: `NTC-2569-${String(++noticeSeq).padStart(5, "0")}`,
        language: input.language ?? lease.template.language,
        issuedOn: today,
        effectiveDate: null,
        respondBy: null,
        noticeDays: null,
        newRent: null,
        renewalMonths: null,
        amountDue: null,
        reasonCode: null,
        message: input.message ?? null,
        items: [],
        documentId: crypto.randomUUID(),
        sentAt: new Date().toISOString(),
      };
      if (input.kind === "rent_increase") {
        if (!input.newRent) return validation(op, "newRent", "an amount like 15000.00", "money");
        if (!input.effectiveDate || input.effectiveDate <= lease.endDate)
          return validation(op, "effectiveDate", `after the current lease ends (${lease.endDate})`, "midterm");
        Object.assign(notice, { newRent: Number(input.newRent).toFixed(2), effectiveDate: input.effectiveDate });
      } else if (input.kind === "renewal_offer") {
        Object.assign(notice, {
          newRent: Number(input.newRent ?? lease.rent).toFixed(2),
          renewalMonths: input.renewalMonths ?? lease.months,
          effectiveDate: addDays(lease.endDate, 1),
          respondBy: [addDays(today, 15), lease.endDate].sort()[0],
        });
      } else if (input.kind === "late_payment") {
        const overdue = state.owner.invoices.filter(
          (invoice) => invoice.leaseId === lease.id && invoice.status === "overdue" && Number(invoice.balance) > 0,
        );
        if (!overdue.length) return problem(op, "lease.notice_nothing_overdue");
        Object.assign(notice, {
          amountDue: overdue.reduce((sum, invoice) => sum + Number(invoice.balance), 0).toFixed(2),
          respondBy: addDays(today, 7),
          items: overdue.map((invoice) => ({
            number: invoice.number ?? "—",
            dueDate: invoice.dueDate ?? today,
            balance: invoice.balance,
          })),
        });
      } else {
        const effectiveDate = input.kind === "non_renewal" ? lease.endDate : input.effectiveDate;
        if (!effectiveDate) return validation(op, "effectiveDate", "the date the lease ends", "required");
        Object.assign(notice, { effectiveDate, reasonCode: input.kind === "termination" ? input.reasonCode : null });
        lease.status = "notice_given";
        lease.notice = {
          by: "lessor",
          givenAt: new Date().toISOString(),
          reasonCode: input.kind === "non_renewal" ? "end_of_term" : (input.reasonCode ?? null),
          effectiveDate,
          evidenceDocumentIds: input.evidenceDocumentIds ?? [],
        };
        lease.version += 1;
      }
      state.leaseNotices[lease.id] = [notice, ...(state.leaseNotices[lease.id] ?? [])];
      return { status: 201, body: notice };
    });
  }),

  http.get("*/v1/owner/lease-notices/:noticeId/document", ({ request, params }) => {
    const op = "owner.leaseNotices.document";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const notice = Object.values(state.leaseNotices)
      .flat()
      .find((candidate) => candidate.id === params.noticeId);
    return notice && ok.own ? json(documentDownload(request, notice.documentId!, notice.number)) : notFound(op);
  }),
];
