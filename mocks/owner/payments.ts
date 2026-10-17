import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { emit } from "../handlers/realtime";
import { state } from "../state";
import { aging } from "./dashboard";
import { add, baht, satang } from "./money";
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
import { day, iso, type MockInvoice } from "./world";

type Schemas = components["schemas"];

/**
 * Payments, slips, credits, receipts, receivables, documents and exports (F2 2.4, B4.4–B4.5): manual
 * payments (cash, or transfer with evidence), the slip review queue (approve with the amount received,
 * reject with a reason; a duplicate reference only after the earlier slip was rejected), allocation
 * oldest-first with the excess kept as credit, refunds of credit, reversals, the aging list and the
 * per-party ledger, the documents archive and export jobs.
 */
const w = () => state.owner;
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const OPEN = new Set<Schemas["InvoiceStatus"]>(["issued", "partially_paid", "overdue"]);
let receiptSeq = 60;

function settleInvoice(invoice: MockInvoice) {
  invoice.balance = baht(
    satang(invoice.total) - satang(invoice.paidTotal) - satang(invoice.creditedTotal) + satang(invoice.debitedTotal),
  );
  if (satang(invoice.balance) <= 0) invoice.status = "paid";
  else if (satang(invoice.paidTotal) > 0 && invoice.status !== "overdue") invoice.status = "partially_paid";
  invoice.amountDue = add(invoice.balance, invoice.priorBalance);
  invoice.nextActions =
    invoice.status === "paid"
      ? ["resend", "credit-note", "debit-note"]
      : ["resend", "send-reminder", "credit-note", "debit-note"];
}

/** Records a confirmed payment for an invoice: allocation oldest-first, credit for the excess, receipt (D-196, D-198). */
export function confirmPayment(
  invoice: MockInvoice,
  input: {
    amount: string;
    method: Schemas["PaymentMethod"];
    confirmedVia: Schemas["PaymentConfirmation"];
    paidAt?: string;
    reference?: string | null;
    evidenceDocumentId?: string | null;
    notes?: string | null;
    provider?: string | null;
    slipReviewId?: string | null;
    whtAmount?: string;
  },
): Schemas["PaymentDto"] {
  const open = w()
    .invoices.filter(
      (candidate) =>
        candidate.billedPartyId === invoice.billedPartyId &&
        candidate.unitId === invoice.unitId &&
        OPEN.has(candidate.status),
    )
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  let left = satang(input.amount) + satang(input.whtAmount ?? "0.00");
  const allocations: Schemas["PaymentAllocationDto"][] = [];
  for (const target of open) {
    if (left <= 0) break;
    const take = Math.min(left, satang(target.balance));
    if (take <= 0) continue;
    target.paidTotal = baht(satang(target.paidTotal) + take);
    settleInvoice(target);
    allocations.push({ invoiceId: target.id, invoiceNumber: target.number, amount: baht(take), reversedAt: null });
    left -= take;
  }
  if (left > 0) {
    const credit = w().credits.find(
      (candidate) => candidate.partyId === invoice.billedPartyId && candidate.unitId === invoice.unitId,
    );
    if (credit) credit.balance = baht(satang(credit.balance) + left);
    else
      w().credits.push({
        partyId: invoice.billedPartyId,
        partyName: invoice.billedPartyName,
        unitId: invoice.unitId,
        unitNo: invoice.unitNo,
        balance: baht(left),
      });
  }
  receiptSeq += 1;
  const receipt: Schemas["ReceiptDto"] = {
    id: crypto.randomUUID(),
    number: `RCP-2569-0000${receiptSeq}`,
    kind: allocations.length ? "payment" : "advance",
    amount: Number(input.amount).toFixed(2),
    payerName: invoice.billedPartyName,
    paymentId: null,
    unitNo: invoice.unitNo,
    issuedAt: iso(),
    hasDocument: true,
    voidReason: null,
    voidedAt: null,
  };
  const payment: Schemas["PaymentDto"] = {
    id: crypto.randomUUID(),
    amount: Number(input.amount).toFixed(2),
    whtAmount: input.whtAmount ? Number(input.whtAmount).toFixed(2) : "0.00",
    allocatedTotal: add(...allocations.map((allocation) => allocation.amount)),
    creditedAmount: baht(Math.max(0, left)),
    allocations,
    method: input.method,
    provider: input.provider ?? null,
    providerRef: input.reference ?? null,
    status: "confirmed",
    confirmedVia: input.confirmedVia,
    confirmedAt: iso(),
    paidAt: input.paidAt ?? iso(),
    invoiceId: invoice.id,
    payerName: invoice.billedPartyName,
    payerPartyId: invoice.billedPartyId,
    unitId: invoice.unitId,
    unitNo: invoice.unitNo,
    evidenceDocumentId: input.evidenceDocumentId ?? null,
    slipReviewId: input.slipReviewId ?? null,
    notes: input.notes ?? null,
    receipts: [{ id: receipt.id, kind: receipt.kind, number: receipt.number, voided: false }],
    reconciledAt: null,
    reverseReason: null,
    reversedAt: null,
    nextActions: ["reverse"],
    version: 1,
  };
  receipt.paymentId = payment.id;
  w().receipts.unshift(receipt);
  w().payments.unshift(payment);
  emit("payment.confirmed", { aggregateType: "payment", aggregateId: payment.id }, "owner");
  return payment;
}

function receivables(ok: { own: boolean }): Schemas["ReceivableDto"][] {
  const groups = new Map<string, MockInvoice[]>();
  for (const invoice of ok.own ? w().invoices : []) {
    if (!OPEN.has(invoice.status) && !w().credits.some((credit) => credit.partyId === invoice.billedPartyId)) continue;
    const key = `${invoice.billedPartyId}|${invoice.unitId}`;
    groups.set(key, [...(groups.get(key) ?? []), invoice]);
  }
  return [...groups.values()].map((invoices) => {
    const first = invoices[0]!;
    const open = invoices.filter((invoice) => OPEN.has(invoice.status));
    const credit =
      w().credits.find((candidate) => candidate.partyId === first.billedPartyId && candidate.unitId === first.unitId)
        ?.balance ?? "0.00";
    const oldest =
      open
        .map((invoice) => invoice.dueDate ?? "")
        .filter(Boolean)
        .sort()[0] ?? null;
    const days = oldest ? Math.max(0, Math.floor((Date.parse(day(0)) - Date.parse(oldest)) / 86_400_000)) : 0;
    const building = w().buildings.find((candidate) => candidate.id === first.buildingId);
    return {
      partyId: first.billedPartyId,
      partyName: first.billedPartyName,
      unitId: first.unitId,
      unitNo: first.unitNo,
      buildingId: first.buildingId,
      buildingName: building?.name ?? "",
      balance: baht(satang(add(...open.map((invoice) => invoice.balance))) - satang(credit)),
      creditBalance: credit,
      openInvoicesCount: open.length,
      oldestDueDate: oldest,
      daysOverdue: days,
      aging: aging(open),
      updatedAt: iso(),
    };
  });
}

export const paymentHandlers: HttpHandler[] = [
  http.get("*/v1/owner/payments", ({ request }) => {
    const ok = owner(request, "owner.payments.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const from = params.get("from");
    const to = params.get("to");
    const list = (ok.own ? w().payments : []).filter(
      (payment) =>
        (!params.get("status") || payment.status === params.get("status")) &&
        (!params.get("method") || payment.method === params.get("method")) &&
        (!params.get("invoiceId") ||
          payment.allocations.some((allocation) => allocation.invoiceId === params.get("invoiceId")) ||
          payment.invoiceId === params.get("invoiceId")) &&
        (!params.get("partyId") || payment.payerPartyId === params.get("partyId")) &&
        (!params.get("unitId") || payment.unitId === params.get("unitId")) &&
        (!params.get("buildingId") ||
          w().units.find((unit) => unit.id === payment.unitId)?.buildingId === params.get("buildingId")) &&
        (!from || payment.paidAt.slice(0, 10) >= from) &&
        (!to || payment.paidAt.slice(0, 10) <= to) &&
        (!params.get("q") ||
          (payment.providerRef ?? "").includes(params.get("q")!) ||
          (payment.unitNo ?? "").includes(params.get("q")!) ||
          (payment.payerName ?? "").includes(params.get("q")!)),
    );
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/payments", async ({ request }) => {
    const op = "owner.payments.record";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["ManualPaymentDto"];
      const invoice = w().invoices.find((candidate) => candidate.id === input.invoiceId);
      if (!invoice) return notFound(op);
      if (!MONEY.test(input.amount ?? "") || satang(input.amount) <= 0)
        return validation(op, "amount", "an amount above 0.00");
      if (!input.paidAt) return validation(op, "paidAt", "when the money was received");
      if (input.method === "bank_transfer_manual" && !input.evidenceDocumentId)
        return validation(op, "evidenceDocumentId", "the transfer evidence is required");
      if (!OPEN.has(invoice.status))
        return problem(op, invoice.status === "paid" ? "invoice.nothing_due" : "invoice.invalid_state");
      const allowPartial = w().settings.find((setting) => setting.key === "payments.allow_partial")?.value === true;
      if (
        !allowPartial &&
        satang(input.amount) < satang(invoice.amountDue) &&
        satang(input.amount) < satang(invoice.balance)
      )
        return problem(op, "payment.partial_not_allowed");
      const payment = confirmPayment(invoice, {
        amount: input.amount,
        method: input.method,
        confirmedVia: "manual",
        paidAt: input.paidAt,
        reference: input.reference ?? null,
        evidenceDocumentId: input.evidenceDocumentId ?? null,
        notes: input.notes ?? null,
        whtAmount: input.whtAmount,
      });
      return { status: 201, body: payment };
    });
  }),
  http.get("*/v1/owner/payments/:paymentId", ({ request, params }) => {
    const op = "owner.payments.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const payment = ok.own ? w().payments.find((candidate) => candidate.id === params.paymentId) : undefined;
    return payment ? json(payment) : notFound(op);
  }),
  http.post("*/v1/owner/payments/:paymentId/actions/reverse", async ({ request, params }) => {
    const op = "owner.payments.reverse";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const payment = ok.own ? w().payments.find((candidate) => candidate.id === params.paymentId) : undefined;
    if (!payment) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["ReasonDto"];
      if (!input.reason?.trim()) return validation(op, "reason", "a reason is required");
      if (payment.status !== "confirmed") return problem(op, "payment.invalid_state");
      for (const allocation of payment.allocations) {
        const invoice = w().invoices.find((candidate) => candidate.id === allocation.invoiceId);
        if (!invoice) continue;
        invoice.paidTotal = baht(satang(invoice.paidTotal) - satang(allocation.amount));
        invoice.status =
          invoice.dueDate && invoice.dueDate < day(0)
            ? "overdue"
            : satang(invoice.paidTotal) > 0
              ? "partially_paid"
              : "issued";
        settleInvoice(invoice);
        allocation.reversedAt = iso();
      }
      payment.status = "reversed";
      payment.reverseReason = input.reason;
      payment.reversedAt = iso();
      payment.nextActions = [];
      for (const ref of payment.receipts) {
        ref.voided = true;
        const receipt = w().receipts.find((candidate) => candidate.id === ref.id);
        if (receipt) {
          receipt.voidedAt = iso();
          receipt.voidReason = input.reason;
        }
      }
      payment.version += 1;
      return { status: 200, body: payment };
    });
  }),

  // Slip review queue (D-043, D-198)
  http.get("*/v1/owner/slip-reviews", ({ request }) => {
    const ok = owner(request, "owner.slipReviews.list");
    if (ok instanceof Response) return ok;
    const status = query(request).get("status");
    const list = (ok.own ? w().slips : []).filter((slip) => !status || slip.status === status);
    return json(
      paged(
        list.map((slip) => ({ ...slip, imageUrl: `${new URL(request.url).origin}/__files/slip-${slip.id}` })),
        request,
      ),
    );
  }),
  http.get("*/v1/owner/slip-reviews/:slipReviewId", ({ request, params }) => {
    const op = "owner.slipReviews.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const slip = ok.own ? w().slips.find((candidate) => candidate.id === params.slipReviewId) : undefined;
    return slip ? json({ ...slip, imageUrl: `${new URL(request.url).origin}/__files/slip-${slip.id}` }) : notFound(op);
  }),
  http.post("*/v1/owner/slip-reviews/:slipReviewId/actions/decide", async ({ request, params }) => {
    const op = "owner.slipReviews.decide";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const slip = ok.own ? w().slips.find((candidate) => candidate.id === params.slipReviewId) : undefined;
    if (!slip) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["SlipDecisionDto"];
      if (slip.status !== "pending_review") return problem(op, "slip.invalid_state");
      if (input.action === "reject") {
        if (!input.reason?.trim()) return validation(op, "reason", "a reason is required");
        slip.status = "rejected";
        slip.rejectReason = input.reason;
        slip.nextActions = [];
        slip.version += 1;
        return { status: 200, body: slip };
      }
      if (slip.duplicateOfId) {
        const earlier = w().slips.find((candidate) => candidate.id === slip.duplicateOfId);
        if (earlier && earlier.status !== "rejected")
          return problem(op, "slip.invalid_state", {
            detail: "สลิปเลขอ้างอิงนี้ถูกใช้ชำระไปแล้ว ปฏิเสธใบเดิมก่อนจึงจะอนุมัติใบนี้ได้",
          });
      }
      const amount = input.amount ?? slip.amountDetected;
      if (!amount || !MONEY.test(amount)) return validation(op, "amount", "the amount received");
      const invoice = w().invoices.find((candidate) => candidate.id === slip.invoiceId);
      if (!invoice || !OPEN.has(invoice.status)) return problem(op, "invoice.nothing_due");
      const allowPartial = w().settings.find((setting) => setting.key === "payments.allow_partial")?.value === true;
      if (!allowPartial && satang(amount) < satang(invoice.balance)) return problem(op, "payment.partial_not_allowed");
      const payment = confirmPayment(invoice, {
        amount,
        method: "transfer_slip",
        confirmedVia: "slip_review",
        reference: slip.transRef,
        slipReviewId: slip.id,
      });
      slip.status = "approved";
      slip.paymentId = payment.id;
      slip.invoiceBalance = invoice.balance;
      slip.nextActions = [];
      slip.version += 1;
      return { status: 200, body: slip };
    });
  }),

  // Credits and refunds
  http.get("*/v1/owner/payer-credits", ({ request }) => {
    const ok = owner(request, "owner.payerCredits.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    return json(
      (ok.own ? w().credits : []).filter(
        (credit) =>
          satang(credit.balance) > 0 &&
          (!params.get("partyId") || credit.partyId === params.get("partyId")) &&
          (!params.get("unitId") || credit.unitId === params.get("unitId")),
      ),
    );
  }),
  http.post("*/v1/owner/refunds", async ({ request }) => {
    const op = "owner.refunds.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["RefundCreateDto"];
      const credit = w().credits.find(
        (candidate) => candidate.partyId === input.partyId && candidate.unitId === input.unitId,
      );
      if (!credit) return notFound(op);
      if (!MONEY.test(input.amount ?? "") || satang(input.amount) <= 0)
        return validation(op, "amount", "an amount above 0.00");
      if (satang(input.amount) > satang(credit.balance)) return problem(op, "refund.exceeds_credit");
      if (input.method === "bank_transfer" && !input.evidenceDocumentId)
        return validation(op, "evidenceDocumentId", "the transfer evidence is required");
      credit.balance = baht(satang(credit.balance) - satang(input.amount));
      return {
        status: 201,
        body: {
          refundId: crypto.randomUUID(),
          amount: Number(input.amount).toFixed(2),
          creditAfter: credit.balance,
        } satisfies Schemas["RefundResultDto"],
      };
    });
  }),

  // Receipts
  http.get("*/v1/owner/receipts", ({ request }) => {
    const ok = owner(request, "owner.receipts.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const list = (ok.own ? w().receipts : []).filter(
      (receipt) =>
        (!params.get("paymentId") || receipt.paymentId === params.get("paymentId")) &&
        (!params.get("q") ||
          receipt.number.includes(params.get("q")!) ||
          (receipt.unitNo ?? "").includes(params.get("q")!)),
    );
    return json(paged(list, request));
  }),
  http.get("*/v1/owner/receipts/:receiptId/document", ({ request, params }) => {
    const op = "owner.receipts.document";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const receipt = ok.own ? w().receipts.find((candidate) => candidate.id === params.receiptId) : undefined;
    return receipt ? json(documentDownload(request, receipt.id, receipt.number)) : notFound(op);
  }),

  // Receivables (D-199)
  http.get("*/v1/owner/receivables", ({ request }) => {
    const ok = owner(request, "owner.receivables.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const minDays = Number(params.get("minDaysOverdue") ?? 0);
    const bucket = params.get("bucket");
    const settled = params.get("includeSettled") === "true";
    let rows = receivables(ok).filter(
      (row) =>
        (settled || satang(row.balance) !== 0) &&
        (!params.get("buildingId") || row.buildingId === params.get("buildingId")) &&
        (!params.get("partyId") || row.partyId === params.get("partyId")) &&
        (!params.get("unitId") || row.unitId === params.get("unitId")) &&
        row.daysOverdue >= minDays &&
        (!bucket || satang(row.aging[bucket as keyof Schemas["AgingDto"]]) > 0) &&
        (!params.get("q") || row.partyName.includes(params.get("q")!) || (row.unitNo ?? "").includes(params.get("q")!)),
    );
    const sortBy = params.get("sortBy") ?? "balance";
    rows = [...rows].sort((a, b) =>
      sortBy === "days_overdue"
        ? b.daysOverdue - a.daysOverdue
        : sortBy === "unit"
          ? (a.unitNo ?? "").localeCompare(b.unitNo ?? "")
          : satang(b.balance) - satang(a.balance),
    );
    const page = paged(rows, request);
    return json({
      ...page,
      totals: {
        count: rows.length,
        balance: add(...rows.map((row) => row.balance)),
        creditBalance: add(...rows.map((row) => row.creditBalance)),
        aging: {
          current: add(...rows.map((row) => row.aging.current)),
          d1_30: add(...rows.map((row) => row.aging.d1_30)),
          d31_60: add(...rows.map((row) => row.aging.d31_60)),
          d61_90: add(...rows.map((row) => row.aging.d61_90)),
          d90p: add(...rows.map((row) => row.aging.d90p)),
        },
      },
    } satisfies Schemas["ReceivableListDto"]);
  }),
  http.get("*/v1/owner/receivables/entries", ({ request }) => {
    const ok = owner(request, "owner.receivables.entries");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const partyId = params.get("partyId");
    const unitId = params.get("unitId");
    const entries: Schemas["ReceivableEntryDto"][] = [];
    let running = 0;
    const invoices = (ok.own ? w().invoices : [])
      .filter(
        (invoice) =>
          invoice.issuedAt && (!partyId || invoice.billedPartyId === partyId) && (!unitId || invoice.unitId === unitId),
      )
      .sort((a, b) => (a.issuedAt ?? "").localeCompare(b.issuedAt ?? ""));
    for (const invoice of invoices) {
      running += satang(invoice.total);
      entries.push({
        id: crypto.randomUUID(),
        entryType: "invoice",
        refType: "invoice",
        refId: invoice.id,
        amount: invoice.total,
        runningBalance: baht(running),
        occurredAt: invoice.issuedAt!,
        unitNo: invoice.unitNo,
      });
      for (const payment of w().payments.filter((candidate) =>
        candidate.allocations.some((allocation) => allocation.invoiceId === invoice.id),
      )) {
        const allocation = payment.allocations.find((candidate) => candidate.invoiceId === invoice.id)!;
        running -= satang(allocation.amount);
        entries.push({
          id: crypto.randomUUID(),
          entryType: "payment",
          refType: "payment",
          refId: payment.id,
          amount: baht(-satang(allocation.amount)),
          runningBalance: baht(running),
          occurredAt: payment.paidAt,
          unitNo: invoice.unitNo,
        });
      }
    }
    return json(paged(entries.reverse(), request));
  }),

  // Documents archive and exports (B4.3, D-202)
  http.get("*/v1/owner/billing-documents", ({ request }) => {
    const ok = owner(request, "owner.billingDocuments.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const kind = params.get("kind");
    const docs: Schemas["FinancialDocumentDto"][] = ok.own
      ? [
          ...w()
            .invoices.filter((invoice) => invoice.number)
            .map((invoice) => ({
              id: `${invoice.id.slice(0, -4)}0a4d`,
              kind: "pdf_invoice" as const,
              title: `${invoice.number} · ${invoice.unitNo}`,
              mimeType: "application/pdf",
              sizeBytes: 48_000,
              buildingId: invoice.buildingId,
              createdAt: invoice.issuedAt!,
            })),
          ...w().receipts.map((receipt) => ({
            id: receipt.id,
            kind: "pdf_receipt" as const,
            title: `${receipt.number} · ${receipt.unitNo ?? ""}`,
            mimeType: "application/pdf",
            sizeBytes: 36_000,
            buildingId: null,
            createdAt: receipt.issuedAt,
          })),
        ]
      : [];
    const period = params.get("period");
    const list = docs.filter(
      (doc) =>
        (!kind || doc.kind === kind) &&
        (!period || doc.createdAt.startsWith(period)) &&
        (!params.get("buildingId") || doc.buildingId === params.get("buildingId") || doc.buildingId === null) &&
        (!params.get("q") || doc.title.toLowerCase().includes(params.get("q")!.toLowerCase())),
    );
    return json(
      paged(
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        request,
      ),
    );
  }),
  http.get("*/v1/owner/exports", ({ request }) => {
    const ok = owner(request, "owner.exports.list");
    if (ok instanceof Response) return ok;
    const kind = query(request).get("kind");
    return json(
      paged(
        (ok.own ? w().exports : []).filter((job) => !kind || job.kind === kind),
        request,
      ),
    );
  }),
  http.post("*/v1/owner/exports", async ({ request }) => {
    const op = "owner.exports.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["ExportCreateDto"];
      const job: Schemas["ExportJobDto"] = {
        id: crypto.randomUUID(),
        kind: input.kind,
        params: input.params ?? {},
        buildingId: input.params?.buildingId ?? null,
        status: "queued",
        requestedAt: iso(),
        finishedAt: null,
        rowCount: null,
        download: null,
        error: null,
        version: 1,
      };
      w().exports.unshift(job);
      // The worker finishes it a moment later.
      setTimeout(() => {
        job.status = "done";
        job.finishedAt = iso();
        job.rowCount = 12;
        job.download = { url: `${new URL(request.url).origin}/__files/pdf-${job.id}`, expiresAt: iso(0.003) };
        job.version += 1;
        emit("export.finished", { aggregateType: "export_job", aggregateId: job.id }, "owner");
      }, 600);
      return { status: 202, body: job };
    });
  }),
  http.get("*/v1/owner/exports/:exportId", ({ request, params }) => {
    const op = "owner.exports.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const job = ok.own ? w().exports.find((candidate) => candidate.id === params.exportId) : undefined;
    return job ? json(job) : notFound(op);
  }),
];

/** `POST /__mock/owner/payments/webhook?invoice=<number>` — the payment provider's callback for an invoice's QR (D-042). */
export function providerPays(invoiceNumber: string): Schemas["PaymentDto"] | null {
  const invoice = w().invoices.find((candidate) => candidate.number === invoiceNumber);
  if (!invoice || !OPEN.has(invoice.status)) return null;
  return confirmPayment(invoice, {
    amount: invoice.amountDue,
    method: "qr",
    confirmedVia: "webhook",
    provider: "kbank",
    reference: `KB-${Date.now()}`,
  });
}
