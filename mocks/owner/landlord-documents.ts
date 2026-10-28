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
    // G3: renewal offer letters live with the contracts world (reset with the part `contracts`).
    return lease
      ? json([...(state.contracts.letters[lease.id] ?? []), ...(state.leaseNotices[lease.id] ?? [])])
      : notFound(op);
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
    const notice = [...Object.values(state.leaseNotices), ...Object.values(state.contracts.letters)]
      .flat()
      .find((candidate) => candidate.id === params.noticeId);
    return notice && ok.own ? json(documentDownload(request, notice.documentId!, notice.number)) : notFound(op);
  }),

  // ── rent certificates and the annual income summary (B7.5 part 3) ─────────────────────────────────────
  http.get("*/v1/owner/rent-certificates", ({ request }) => {
    const ok = owner(request, "owner.rentCertificates.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = certificatesOf(ok.tenantId).filter(
      (c) =>
        (!params.get("state") || c.state === params.get("state")) &&
        (!params.get("leaseId") || c.leaseId === params.get("leaseId")),
    );
    return json(rows);
  }),

  http.post("*/v1/owner/rent-certificates/:certificateId/actions/issue", async ({ request, params }) => {
    const op = "owner.rentCertificates.issue";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const row = certificatesOf(ok.tenantId).find((c) => c.id === params.certificateId);
    if (!row) return notFound(op);
    return idempotent(request, op, () => {
      if (row.state !== "requested") return problem(op, "rent_certificate.invalid_state");
      Object.assign(row, {
        state: "issued",
        number: `RPC-2569-${String(++certificateSeq).padStart(5, "0")}`,
        totalPaid: "180000.00",
        documentId: `${row.id.slice(0, -4)}0a4d`,
        decidedAt: new Date().toISOString(),
      });
      return { status: 200, body: row };
    });
  }),

  http.post("*/v1/owner/rent-certificates/:certificateId/actions/decline", async ({ request, params }) => {
    const op = "owner.rentCertificates.decline";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const row = certificatesOf(ok.tenantId).find((c) => c.id === params.certificateId);
    if (!row) return notFound(op);
    if (row.state !== "requested") return problem(op, "rent_certificate.invalid_state");
    const input = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!input.reason?.trim()) return validation(op, "reason", "between 1 and 300 characters", "length");
    Object.assign(row, { state: "declined", declineReason: input.reason.trim(), decidedAt: new Date().toISOString() });
    return json(row);
  }),

  http.get("*/v1/owner/income-summaries", ({ request }) => {
    const ok = owner(request, "owner.incomeSummaries.year");
    if (ok instanceof Response) return ok;
    const year = Number(query(request).get("year"));
    return json(incomeOf(ok.tenantId, year));
  }),

  http.post("*/v1/owner/income-summaries", async ({ request }) => {
    const op = "owner.incomeSummaries.generate";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["IncomeSummaryCreateDto"];
      const summary = incomeOf(ok.tenantId, input.year);
      if (!summary.units.some((u) => u.unitId === input.unitId)) return notFound(op);
      return {
        status: 201,
        body: {
          documentId: `${input.unitId.slice(0, -4)}0a4d`,
          number: `ISM-2569-${String(++summarySeq).padStart(5, "0")}`,
          summary,
        },
      };
    });
  }),
];

let certificateSeq = 0;
let summarySeq = 0;

/** Per tenant: the landlord persona starts with one visa request on the leased condo. */
function certificatesOf(tenantId: string): Schemas["RentCertificateDto"][] {
  if (!state.certificates[tenantId]) {
    const leased = (state.portfolio[tenantId] ?? []).find((unit) => unit.leaseId);
    state.certificates[tenantId] = leased
      ? [
          {
            id: "5c1e0000-0000-4000-8000-00000000c001",
            leaseId: leased.leaseId!,
            unitNo: leased.unitNo,
            leaseNumber: "CTR-2569-00003",
            purpose: "visa",
            periodFrom: "2025-11-01",
            periodTo: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10),
            language: "en",
            note: "For my visa extension next month",
            state: "requested",
            requestedByResident: true,
            number: null,
            totalPaid: null,
            declineReason: null,
            documentId: null,
            requestedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
            decidedAt: null,
          },
        ]
      : [];
  }
  return state.certificates[tenantId]!;
}

/** The portfolio's leased units, each paid its rent every month of the year so far (amounts as strings). */
function incomeOf(tenantId: string, year: number): Schemas["IncomeYearDto"] {
  const now = new Date(Date.now() + 7 * 3_600_000);
  const months = year < now.getUTCFullYear() ? 12 : now.getUTCMonth() + 1;
  const units = (state.portfolio[tenantId] ?? [])
    .filter((unit) => unit.leaseId && unit.defaultRent)
    .map((unit) => {
      const rent = Number(unit.defaultRent);
      const received = (rent * months).toFixed(2);
      const charge = 1200;
      const items = repairExpenses(tenantId, unit.unitId, year);
      return {
        unitId: unit.unitId,
        unitNo: unit.unitNo,
        months: Array.from({ length: 12 }, (_, i) => (i < months ? rent.toFixed(2) : "0.00")),
        chargeMonths: Array.from({ length: 12 }, (_, i) => (i < months ? charge.toFixed(2) : "0.00")),
        rent: received,
        charges: (charge * months).toFixed(2),
        retained: "0.00",
        gross: received,
        expenses: items.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2),
        expenseItems: items,
      };
    });
  const gross = units.reduce((sum, unit) => sum + Number(unit.gross), 0);
  const expenses = units.reduce((sum, unit) => sum + Number(unit.expenses), 0);
  return {
    year,
    deductionPercent: "30",
    units,
    totals: {
      rent: gross.toFixed(2),
      charges: units.reduce((sum, unit) => sum + Number(unit.charges), 0).toFixed(2),
      retained: "0.00",
      gross: gross.toFixed(2),
      deduction: (gross * 0.3).toFixed(2),
      net: (gross * 0.7).toFixed(2),
      expenses: expenses.toFixed(2),
      netActual: (gross - expenses).toFixed(2),
    },
  };
}

/** The owner's share of the year's repair receipts on a unit (D-263), per category — the R2 mock's landlord requests. */
function repairExpenses(tenantId: string, unitId: string, year: number): Schemas["IncomeExpenseItemDto"][] {
  const byCategory = new Map<string, Schemas["IncomeExpenseItemDto"]>();
  for (const sr of state.r2.requests) {
    if (sr.tenantId !== tenantId || sr.unitId !== unitId || !sr.repair || !sr.decision) continue;
    const tenantShare =
      sr.decision.costBearer === "tenant"
        ? 1
        : sr.decision.costBearer === "shared"
          ? Number(sr.decision.tenantSharePercent) / 100
          : 0;
    for (const cost of sr.repair.costs) {
      if (cost.kind !== "receipt" || cost.voidedAt || !cost.issuedOn.startsWith(String(year))) continue;
      const amount = Math.round(Number(cost.amount) * (1 - tenantShare) * 100) / 100;
      const item = byCategory.get(sr.category.key) ?? {
        categoryKey: sr.category.key,
        nameTh: sr.category.nameTh,
        nameEn: sr.category.nameEn,
        amount: "0.00",
      };
      item.amount = (Number(item.amount) + amount).toFixed(2);
      byCategory.set(sr.category.key, item);
    }
  }
  return [...byCategory.values()].filter((item) => item.amount !== "0.00");
}
