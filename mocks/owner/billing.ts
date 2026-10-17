import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { emit } from "../handlers/realtime";
import { state } from "../state";
import { add, baht, satang } from "./money";
import {
  body,
  documentDownload,
  idempotent,
  json,
  LEGAL_REF,
  mutating,
  needsAcknowledgement,
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
 * Billing cycles and invoices (F2 2.3, B4.2–B4.3): the cycle state machine (open → readings pending →
 * computed → issued → closed), drafts with review flags, issue-all that asks for the D-021a
 * acknowledgement of above-cap lines (409 → acknowledge → repeat) and skips drafts that still have
 * review flags, one-off charges recomputed into a draft, void (before payment, optional replacement),
 * credit/debit notes, resend, reminders and documents.
 */
const w = () => state.owner;
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
let invoiceSeq = 200;
let noteSeq = 10;

const DETAIL_ONLY = [
  "lines",
  "creditNotes",
  "debitNotes",
  "nextActions",
  "promptpayRef",
  "snapshotSha256",
  "replacedByInvoiceId",
  "replacesInvoiceId",
  "voidReason",
  "voidedAt",
] as const;
const MOCK_ONLY = ["remindersLog", "penalty"] as const;

function omit<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

export function summary(invoice: MockInvoice): Schemas["InvoiceSummaryDto"] {
  return omit(invoice, [...DETAIL_ONLY, ...MOCK_ONLY]);
}

function detail(invoice: MockInvoice): Schemas["InvoiceDto"] {
  return omit(invoice, MOCK_ONLY);
}

function totals(invoice: MockInvoice) {
  invoice.subtotal = add(...invoice.lines.map((line) => line.amount));
  invoice.total = invoice.subtotal;
  invoice.balance = baht(
    satang(invoice.total) - satang(invoice.paidTotal) - satang(invoice.creditedTotal) + satang(invoice.debitedTotal),
  );
  invoice.amountDue = add(invoice.balance, invoice.priorBalance);
  invoice.hasAboveCapLine = invoice.lines.some((line) => line.aboveCap);
  invoice.hasEstimate = invoice.lines.some((line) => line.isEstimated);
}

function actionsOf(invoice: MockInvoice): string[] {
  switch (invoice.status) {
    case "draft":
      return ["recompute", "issue"];
    case "issued":
      return satang(invoice.paidTotal) === 0 && invoice.creditNotes.length === 0
        ? ["void", "resend", "send-reminder", "credit-note", "debit-note"]
        : ["resend", "send-reminder", "credit-note", "debit-note"];
    case "partially_paid":
    case "overdue":
      return ["resend", "send-reminder", "credit-note", "debit-note"];
    case "paid":
      return ["resend", "credit-note", "debit-note"];
    default:
      return [];
  }
}

function syncInvoice(invoice: MockInvoice) {
  totals(invoice);
  invoice.nextActions = actionsOf(invoice);
}

function cycleDetail(cycle: Schemas["BillingCycleDto"]): Schemas["BillingCycleDetailDto"] {
  return {
    ...cycle,
    invoices: w()
      .invoices.filter((invoice) => invoice.billingCycleId === cycle.id)
      .map(summary),
  };
}

function cycleStats(cycle: Schemas["BillingCycleDto"]) {
  const invoices = w().invoices.filter((invoice) => invoice.billingCycleId === cycle.id);
  const flags: Record<string, number> = {};
  for (const invoice of invoices)
    for (const flag of [...invoice.reviewFlags, ...invoice.complianceFlags]) {
      const key = flag.split(":")[0]!;
      flags[key] = (flags[key] ?? 0) + 1;
    }
  return {
    billables: invoices.length,
    drafts: invoices.filter((invoice) => invoice.status === "draft").length,
    needsReview: invoices.filter((invoice) => invoice.status === "draft" && invoice.reviewFlags.length > 0).length,
    issued: invoices.filter((invoice) => invoice.issuedAt).length,
    total: add(...invoices.filter((invoice) => invoice.status !== "void").map((invoice) => invoice.total)),
    flags,
    computedAt: cycle.computedAt,
  };
}

const issuable = (invoice: MockInvoice) =>
  invoice.status === "draft" && invoice.reviewFlags.every((flag) => flag.startsWith("acknowledgement_required"));

/** Issue one draft (number, due date, QR reference); the acknowledgement covers its above-cap lines. */
function issueOne(invoice: MockInvoice, ackId: string | null) {
  invoiceSeq += 1;
  invoice.status = "issued";
  invoice.number = `INV-2569-000${invoiceSeq}`;
  invoice.issuedAt = iso();
  invoice.dueDate = day(10);
  invoice.promptpayRef = invoice.number.replace(/-/g, "");
  invoice.snapshotSha256 = "5e".repeat(32);
  invoice.reviewFlags = [];
  for (const line of invoice.lines)
    if (line.aboveCap && !line.complianceAcknowledgementId) line.complianceAcknowledgementId = ackId;
  syncInvoice(invoice);
  emit("invoice.issued", { aggregateType: "invoice", aggregateId: invoice.id }, "owner");
}

function capWarning(op: string, invoices: MockInvoice[], ackIds: string[] | undefined): Response | null {
  const lines = invoices.flatMap((invoice) =>
    invoice.lines
      .filter((line) => line.aboveCap && !line.complianceAcknowledgementId)
      .map((line) => ({ invoice, line })),
  );
  if (lines.length === 0) return null;
  const first = lines[0]!;
  return needsAcknowledgement(
    op,
    "compliance.tariff_cap",
    {
      utility: first.line.lineKind === "water" ? "water" : "electric",
      units: first.line.units,
      tenantRate: first.line.unitPrice,
      capPerUnit: first.line.capPerUnit,
      unitNo: first.invoice.unitNo,
      lines: lines.length,
    },
    ackIds,
    LEGAL_REF.tariffCap,
  );
}

const lastAck = (ackIds: string[] | undefined) =>
  w()
    .acknowledgements.filter((ack) => ackIds?.includes(ack.id) && ack.ruleId === "compliance.tariff_cap")
    .at(-1)?.id ?? null;

export const billingHandlers: HttpHandler[] = [
  // Billing cycles
  http.get("*/v1/owner/billing-cycles", ({ request }) => {
    const ok = owner(request, "owner.billingCycles.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const cycles = (ok.own ? w().cycles : []).filter(
      (cycle) =>
        (!params.get("propertyId") || cycle.propertyId === params.get("propertyId")) &&
        (!params.get("status") || cycle.status === params.get("status")),
    );
    return json(
      paged(
        cycles.map((cycle) => ({ ...cycle, stats: cycleStats(cycle) })),
        request,
      ),
    );
  }),
  http.post("*/v1/owner/billing-cycles", async ({ request }) => {
    const op = "owner.billingCycles.open";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["BillingCycleOpenDto"]>(request);
    if (!ok.own || !w().properties.some((property) => property.id === input.propertyId)) return notFound(op);
    const existing = w().cycles.find(
      (cycle) => cycle.propertyId === input.propertyId && (!input.periodKey || cycle.periodKey === input.periodKey),
    );
    if (existing) return json(cycleDetail(existing));
    const property = w().properties.find((candidate) => candidate.id === input.propertyId)!;
    const cycle: Schemas["BillingCycleDto"] = {
      ...structuredClone(w().cycles[0]!),
      id: crypto.randomUUID(),
      propertyId: property.id,
      propertyName: property.name,
      status: "open",
      computedAt: null,
      issuedAt: null,
      readingsRequestedAt: null,
      nextActions: ["compute"],
      version: 1,
    };
    w().cycles.unshift(cycle);
    return json(cycleDetail(cycle));
  }),
  http.get("*/v1/owner/billing-cycles/:billingCycleId", ({ request, params }) => {
    const op = "owner.billingCycles.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const cycle = ok.own ? w().cycles.find((candidate) => candidate.id === params.billingCycleId) : undefined;
    return cycle ? json({ ...cycleDetail(cycle), stats: cycleStats(cycle) }) : notFound(op);
  }),
  http.post("*/v1/owner/billing-cycles/:billingCycleId/actions/compute", ({ request, params }) => {
    const op = "owner.billingCycles.compute";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const cycle = ok.own ? w().cycles.find((candidate) => candidate.id === params.billingCycleId) : undefined;
    if (!cycle) return notFound(op);
    if (!["open", "readings_pending", "computed"].includes(cycle.status))
      return problem(op, "billing_cycle.invalid_state");
    // A reading taken by staff since the last compute closes B-101's water segment.
    const drafts = w().invoices.filter((invoice) => invoice.billingCycleId === cycle.id && invoice.status === "draft");
    const waterRead = state.staff.readings.some((reading) => reading.assetItemId.endsWith("000000000007"));
    for (const draft of drafts) {
      if (waterRead && draft.reviewFlags.some((flag) => flag.startsWith("missing_reading"))) {
        draft.reviewFlags = draft.reviewFlags.filter((flag) => !flag.startsWith("missing_reading"));
        draft.lines.push({
          ...draft.lines[1]!,
          id: crypto.randomUUID(),
          lineNo: draft.lines.length + 1,
          lineKind: "water",
          description: "ค่าน้ำประปา",
          unit: "m3",
          units: "6.000",
          quantity: "6.000",
          unitPrice: "18.0000",
          amount: "108.00",
          registerFrom: "52.000",
          registerTo: "58.000",
          readingSource: "ocr",
        });
        syncInvoice(draft);
      }
    }
    const missing = drafts.some((draft) => draft.reviewFlags.some((flag) => flag.startsWith("missing_reading")));
    cycle.status = missing ? "readings_pending" : "computed";
    cycle.computedAt = iso();
    if (missing && !cycle.readingsRequestedAt) cycle.readingsRequestedAt = iso();
    cycle.version += 1;
    cycle.nextActions = ["compute", "issue"];
    w().received.push({ op, idempotencyKey: null, body: {} });
    return json({ ...cycleDetail(cycle), stats: cycleStats(cycle) });
  }),
  http.post("*/v1/owner/billing-cycles/:billingCycleId/actions/issue", async ({ request, params }) => {
    const op = "owner.billingCycles.issue";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const cycle = ok.own ? w().cycles.find((candidate) => candidate.id === params.billingCycleId) : undefined;
    if (!cycle) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["IssueDto"];
      if (!["open", "readings_pending", "computed", "issued"].includes(cycle.status))
        return problem(op, "billing_cycle.invalid_state");
      const drafts = w().invoices.filter(
        (invoice) => invoice.billingCycleId === cycle.id && invoice.status === "draft",
      );
      const ready = drafts.filter(issuable);
      const warning = capWarning(op, ready, input.acknowledgementIds);
      if (warning) return warning;
      const ackId = lastAck(input.acknowledgementIds);
      const skipped: Record<string, unknown>[] = [];
      for (const draft of drafts) {
        if (issuable(draft)) issueOne(draft, ackId);
        else
          skipped.push({
            invoiceId: draft.id,
            unitNo: draft.unitNo,
            reason: draft.reviewFlags[0]?.split(":")[0] ?? "not_ready",
          });
      }
      const remaining = drafts.filter((draft) => draft.status === "draft").length;
      if (remaining === 0 && drafts.length > 0) {
        cycle.status = "issued";
        cycle.issuedAt = iso();
        cycle.nextActions = ["close"];
      }
      cycle.autoIssueAt = null;
      cycle.version += 1;
      return {
        status: 200,
        body: {
          ...cycleDetail(cycle),
          stats: cycleStats(cycle),
          skipped,
        } satisfies Schemas["BillingCycleIssueResultDto"],
      };
    });
  }),
  http.post("*/v1/owner/billing-cycles/:billingCycleId/actions/close", ({ request, params }) => {
    const op = "owner.billingCycles.close";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const cycle = ok.own ? w().cycles.find((candidate) => candidate.id === params.billingCycleId) : undefined;
    if (!cycle) return notFound(op);
    if (cycle.status !== "issued") return problem(op, "billing_cycle.invalid_state");
    cycle.status = "closed";
    cycle.closedAt = iso();
    cycle.nextActions = [];
    cycle.version += 1;
    return json(cycleDetail(cycle));
  }),

  // Invoices
  http.get("*/v1/owner/invoices", ({ request }) => {
    const ok = owner(request, "owner.invoices.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const period = params.get("period");
    let invoices = (ok.own ? w().invoices : []).filter(
      (invoice) =>
        (!params.get("status") || invoice.status === params.get("status")) &&
        (!params.get("buildingId") || invoice.buildingId === params.get("buildingId")) &&
        (!params.get("unitId") || invoice.unitId === params.get("unitId")) &&
        (!params.get("leaseId") || invoice.leaseId === params.get("leaseId")) &&
        (!params.get("partyId") || invoice.billedPartyId === params.get("partyId")) &&
        (!params.get("billingCycleId") || invoice.billingCycleId === params.get("billingCycleId")) &&
        (!period || invoice.periodStart.startsWith(period)) &&
        (!q ||
          (invoice.number ?? "").toLowerCase().includes(q) ||
          (invoice.unitNo ?? "").toLowerCase().includes(q) ||
          invoice.billedPartyName.toLowerCase().includes(q)),
    );
    invoices = [...invoices].sort((a, b) => (b.issuedAt ?? b.periodStart).localeCompare(a.issuedAt ?? a.periodStart));
    return json(paged(invoices.map(summary), request));
  }),
  http.get("*/v1/owner/invoices/:invoiceId", ({ request, params }) => {
    const op = "owner.invoices.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    return invoice ? json(detail(invoice)) : notFound(op);
  }),
  http.post("*/v1/owner/invoices/:invoiceId/actions/issue", async ({ request, params }) => {
    const op = "owner.invoices.issue";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    if (!invoice) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["IssueDto"];
      if (invoice.status !== "draft") return problem(op, "invoice.invalid_state");
      if (!issuable(invoice)) return problem(op, "invoice.not_ready");
      const warning = capWarning(op, [invoice], input.acknowledgementIds);
      if (warning) return warning;
      issueOne(invoice, lastAck(input.acknowledgementIds));
      return { status: 200, body: detail(invoice) };
    });
  }),
  http.post("*/v1/owner/invoices/:invoiceId/actions/recompute", ({ request, params }) => {
    const op = "owner.invoices.recompute";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    if (!invoice) return notFound(op);
    if (invoice.status !== "draft") return problem(op, "invoice.invalid_state");
    for (const charge of w().charges.filter(
      (candidate) => candidate.unitId === invoice.unitId && candidate.status === "pending",
    )) {
      const amount = charge.amount;
      invoice.lines.push({
        ...invoice.lines[0]!,
        id: crypto.randomUUID(),
        lineNo: invoice.lines.length + 1,
        sourceType: "adjustment",
        lineKind: charge.lineKind,
        description: charge.description,
        amount,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
        unit: null,
        units: null,
        registerFrom: null,
        registerTo: null,
        readingSource: null,
        aboveCap: false,
        isEstimated: false,
        meterSegments: [],
      });
      charge.status = "applied";
      charge.appliedInvoiceLineId = invoice.lines.at(-1)!.id;
    }
    syncInvoice(invoice);
    invoice.version += 1;
    return json(detail(invoice));
  }),
  http.post("*/v1/owner/invoices/:invoiceId/actions/void", async ({ request, params }) => {
    const op = "owner.invoices.void";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    if (!invoice) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["InvoiceVoidDto"];
      if (!input.reason?.trim()) return validation(op, "reason", "a reason is required");
      if (invoice.status === "void" || invoice.status === "draft") return problem(op, "invoice.invalid_state");
      if (satang(invoice.paidTotal) > 0 || invoice.creditNotes.length > 0) return problem(op, "invoice.has_payments");
      invoice.status = "void";
      invoice.voidReason = input.reason;
      invoice.voidedAt = iso();
      invoice.balance = "0.00";
      invoice.nextActions = [];
      let replacement: MockInvoice | null = null;
      if (input.reissue) {
        replacement = {
          ...structuredClone(invoice),
          id: crypto.randomUUID(),
          status: "draft",
          number: null,
          issuedAt: null,
          dueDate: null,
          promptpayRef: null,
          voidReason: null,
          voidedAt: null,
          replacesInvoiceId: invoice.id,
          paidTotal: "0.00",
          version: 1,
        };
        syncInvoice(replacement);
        invoice.replacedByInvoiceId = replacement.id;
        w().invoices.push(replacement);
      }
      return { status: 200, body: { voided: detail(invoice), replacement: replacement ? detail(replacement) : null } };
    });
  }),
  http.post("*/v1/owner/invoices/:invoiceId/actions/resend", async ({ request, params }) => {
    const op = "owner.invoices.resend";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    if (!invoice) return notFound(op);
    return idempotent(request, op, () => {
      if (invoice.status === "draft" || invoice.status === "void") return problem(op, "invoice.invalid_state");
      return {
        status: 200,
        body: { invoiceId: invoice.id, channel: "line", requestedAt: iso() } satisfies Schemas["ResendResultDto"],
      };
    });
  }),
  http.post("*/v1/owner/invoices/:invoiceId/actions/send-reminder", async ({ request, params }) => {
    const op = "owner.invoices.sendReminder";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    if (!invoice) return notFound(op);
    return idempotent(request, op, () => {
      if (satang(invoice.balance) <= 0 || invoice.status === "draft" || invoice.status === "void")
        return problem(op, "invoice.nothing_due");
      const reminder: Schemas["DunningReminderDto"] = {
        id: crypto.randomUUID(),
        step: 0,
        status: "sent",
        triggeredBy: "owner",
        scheduledFor: iso(),
        sentAt: iso(),
      };
      invoice.remindersLog.push(reminder);
      return { status: 200, body: reminder };
    });
  }),
  http.get("*/v1/owner/invoices/:invoiceId/reminders", ({ request, params }) => {
    const op = "owner.invoices.reminders";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    if (!invoice) return notFound(op);
    return json({ reminders: invoice.remindersLog, penalty: invoice.penalty } satisfies Schemas["InvoiceRemindersDto"]);
  }),
  http.get("*/v1/owner/invoices/:invoiceId/document", ({ request, params }) => {
    const op = "owner.invoices.document";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    if (!invoice) return notFound(op);
    if (!invoice.number) return problem(op, "invoice.invalid_state");
    return json(
      documentDownload(
        request,
        `${invoice.id.slice(0, -4)}${query(request).get("paper") === "thermal_80mm" ? "080m" : "0a4d"}`,
        invoice.number,
      ),
    );
  }),
  ...(["credit", "debit"] as const).map((kind) =>
    http.post(`*/v1/owner/invoices/:invoiceId/${kind}-notes`, async ({ request, params }) => {
      const op = kind === "credit" ? "owner.invoices.creditNote" : "owner.invoices.debitNote";
      const ok = mutating(request, op);
      if (ok instanceof Response) return ok;
      const invoice = ok.own ? w().invoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
      if (!invoice) return notFound(op);
      return idempotent(request, op, (payload) => {
        const input = payload as unknown as Schemas["NoteCreateDto"];
        if (["draft", "void"].includes(invoice.status)) return problem(op, "invoice.invalid_state");
        if (!input.reasonText?.trim()) return validation(op, "reasonText", "a reason is required");
        if (!input.lines?.length) return validation(op, "lines", "at least one line");
        for (const [index, line] of input.lines.entries()) {
          if (!MONEY.test(line.amount) || satang(line.amount) <= 0)
            return validation(op, `lines[${index}].amount`, "an amount above 0.00");
          if (!line.description?.trim())
            return validation(op, `lines[${index}].description`, "a description is required");
          if (kind === "credit" && line.refInvoiceLineId) {
            const ref = invoice.lines.find((candidate) => candidate.id === line.refInvoiceLineId);
            if (ref && satang(line.amount) > satang(ref.amount)) return problem(op, "invoice.credit_exceeds");
          }
        }
        const total = add(...input.lines.map((line) => line.amount));
        if (kind === "credit" && satang(total) > satang(invoice.balance) + satang(invoice.paidTotal))
          return problem(op, "invoice.credit_exceeds");
        noteSeq += 1;
        const note: Schemas["NoteDto"] = {
          id: crypto.randomUUID(),
          number: `${kind === "credit" ? "CN" : "DN"}-2569-${String(noteSeq).padStart(5, "0")}`,
          reason: input.reason,
          reasonText: input.reasonText,
          issuedAt: iso(),
          lines: input.lines.map((line, index) => ({
            lineNo: index + 1,
            description: line.description,
            amount: Number(line.amount).toFixed(2),
            lineKind: line.lineKind ?? "other_fixed",
            refInvoiceLineId: line.refInvoiceLineId ?? null,
          })),
          subtotal: total,
          vatAmount: "0.00",
          total,
        };
        if (kind === "credit") {
          invoice.creditNotes.push(note);
          invoice.creditedTotal = add(invoice.creditedTotal, total);
        } else {
          invoice.debitNotes.push(note);
          invoice.debitedTotal = add(invoice.debitedTotal, total);
        }
        syncInvoice(invoice);
        if (satang(invoice.balance) <= 0 && invoice.status !== "void") invoice.status = "paid";
        invoice.version += 1;
        return { status: 201, body: detail(invoice) };
      });
    }),
  ),
  ...(["credit", "debit"] as const).map((kind) =>
    http.get(`*/v1/owner/${kind}-notes/:noteId/document`, ({ request, params }) => {
      const op = kind === "credit" ? "owner.creditNotes.document" : "owner.debitNotes.document";
      const ok = owner(request, op);
      if (ok instanceof Response) return ok;
      const note = ok.own
        ? w()
            .invoices.flatMap((invoice) => (kind === "credit" ? invoice.creditNotes : invoice.debitNotes))
            .find((candidate) => candidate.id === params.noteId)
        : undefined;
      return note ? json(documentDownload(request, note.id, note.number)) : notFound(op);
    }),
  ),

  // One-off charges (D-193)
  http.get("*/v1/owner/invoice-charges", ({ request }) => {
    const ok = owner(request, "owner.invoiceCharges.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    return json(
      (ok.own ? w().charges : []).filter(
        (charge) =>
          (!params.get("unitId") || charge.unitId === params.get("unitId")) &&
          (!params.get("status") || charge.status === params.get("status")),
      ),
    );
  }),
  http.post("*/v1/owner/invoice-charges", async ({ request }) => {
    const op = "owner.invoiceCharges.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["InvoiceChargeCreateDto"];
      const unit = w().units.find((candidate) => candidate.id === input.unitId);
      if (!unit) return notFound(op);
      if (!input.description?.trim()) return validation(op, "description", "a description is required");
      if (!MONEY.test(input.unitPrice ?? "") || satang(input.unitPrice) <= 0)
        return validation(op, "unitPrice", "an amount above 0.00");
      if (/ต่อสัญญา|renewal/i.test(input.description))
        return problem(op, "compliance.no_renewal_fee", {
          ruleId: "compliance.no_renewal_fee",
          legalRef: LEGAL_REF.depositCap,
        });
      const quantity = input.quantity ?? "1";
      const amount = baht(
        Math.round(satang(input.unitPrice) * Number(quantity)) * (input.lineKind === "discount" ? -1 : 1),
      );
      const charge: Schemas["InvoiceChargeDto"] = {
        id: crypto.randomUUID(),
        unitId: unit.id,
        leaseId: input.leaseId ?? unit.currentLeaseId,
        partyId: input.partyId ?? unit.lesseePartyId ?? "",
        lineKind: input.lineKind === "discount" ? "discount" : "one_off",
        description: input.description,
        quantity: Number(quantity).toFixed(3),
        unitPrice: Number(input.unitPrice).toFixed(2),
        amount,
        status: "pending",
        appliedInvoiceLineId: null,
        createdAt: iso(),
      };
      w().charges.push(charge);
      return { status: 201, body: charge };
    });
  }),
  http.post("*/v1/owner/invoice-charges/:chargeId/actions/cancel", async ({ request, params }) => {
    const op = "owner.invoiceCharges.cancel";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const charge = ok.own ? w().charges.find((candidate) => candidate.id === params.chargeId) : undefined;
    if (!charge) return notFound(op);
    const input = await body<Schemas["InvoiceChargeCancelDto"]>(request);
    if (!input.reason?.trim()) return validation(op, "reason", "a reason is required");
    if (charge.status !== "pending") return problem(op, "invoice.invalid_state");
    charge.status = "cancelled";
    return json(charge);
  }),
];
