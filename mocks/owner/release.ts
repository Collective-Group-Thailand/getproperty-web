import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { emit } from "../handlers/realtime";
import { state } from "../state";
import { confirmPayment } from "./payments";
import { allowed, idempotent, json, mutating, notFound, owner, paged, problem, query, validation } from "./support";
import { refreshTm30 } from "./release-seeds";
import { day, id, iso } from "./world";

type Schemas = components["schemas"];

/**
 * The api release fixes (triage F7, D-219–D-227) and the B6.2 / B6.3 owner endpoints in the mock API:
 * held payments (confirm books them, dismiss fails them — D-220), party link requests (the Owner confirms a
 * phone sign-in — D-226), TM30 notifications with the 24-hour deadline and the Immigration upload file
 * (D-052, D-216), e-Tax submissions with the monthly summary (D-050, D-215) and the insights page with its
 * opt-in benchmarks (D-217). Shapes follow getproperty-api 048a8bd.
 */
const w = () => state.owner;
const HOUR = 3_600_000;

// ---------------------------------------------------------------------------------------------------
// Handlers

const today = () => day(0);
const month = () => today().slice(0, 7);

function insights(buildingId: string | null, months: number): Schemas["InsightsDto"] {
  const optedIn = w().consents.some((consent) => consent.key === "analytics.anonymised" && consent.granted === true);
  const start = new Date(`${month()}-01T00:00:00Z`);
  const keys = Array.from({ length: months }, (_, index) => {
    const at = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (months - 1 - index), 1));
    return at.toISOString().slice(0, 10);
  });
  const metric = (name: Schemas["InsightMetric"], values: (number | null)[]): Schemas["InsightSeriesDto"] => ({
    metric: name,
    points: keys.map((key, index) => {
      // The oldest months have nothing measured (the tenant joined later): gaps, never zeros.
      const value = index < keys.length - values.length ? null : values[index - (keys.length - values.length)]!;
      return { month: key, value: value === null ? null : value.toFixed(2), count: value === null ? 0 : 24 };
    }),
  });
  return {
    tenantId: id("7e000000", 1),
    buildingId,
    asOf: iso(),
    current: {
      timeToBillHours: "6.50",
      invoiceCorrectionRatePct: "2.10",
      onTimePaymentPct: "88.40",
      autoReconciledPct: "71.30",
      lossIdentified: true,
      latestLossPct: "7.80",
      meterUptimePct: "99.20",
      csat: "4.40",
    },
    series: [
      metric("time_to_bill_hours", [12, 9.5, 8, 6.5]),
      metric("invoice_correction_rate_pct", [5.2, 3.1, 2.4, 2.1]),
      metric("on_time_payment_pct", [76, 81.5, 85, 88.4]),
      metric("auto_reconciled_pct", [40, 55, 66, 71.3]),
      metric("paid_by_qr_pct", [35, 48, 57, 63]),
      metric("reminder_effectiveness_pct", [52, 58, 61, 64]),
      metric("loss_pct", [12.4, 10.1, 8.6, 7.8]),
      metric("meter_uptime_pct", [97.5, 98.8, 99.1, 99.2]),
      metric("csat", [null, 4.1, 4.3, 4.4]),
      metric("compliance_score", [92, 94.5, 96, 96.3]),
      metric("above_cap_acknowledged_pct", [100, 100, 100, 100]),
      metric("service_requests_via_line_pct", [null, 60, 72, 80]),
    ],
    benchmarks: {
      optedIn,
      items: optedIn
        ? [
            {
              metric: "loss_pct",
              bucketKey: "apartment:20-49",
              k: 12,
              p25: "5.10",
              p50: "8.30",
              p75: "12.70",
              mine: "7.80",
              asOf: day(-1),
            },
            {
              metric: "on_time_payment_pct",
              bucketKey: "apartment:20-49",
              k: 12,
              p25: "71.00",
              p50: "82.50",
              p75: "90.10",
              mine: "88.40",
              asOf: day(-1),
            },
            {
              metric: "rent_per_m2",
              bucketKey: "TH-10:Chatuchak",
              k: 7,
              p25: "180.00",
              p50: "215.00",
              p75: "260.00",
              mine: "203.13",
              asOf: day(-1),
            },
          ]
        : [],
    },
  };
}

export const releaseHandlers: HttpHandler[] = [
  // Held payments (D-220)
  http.post("*/v1/owner/payments/:paymentId/actions/confirm", async ({ request, params }) => {
    const op = "owner.payments.confirmHeld";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "payment.record");
    if (forbidden) return forbidden;
    const held = ok.own ? w().payments.find((candidate) => candidate.id === params.paymentId) : undefined;
    if (!held) return notFound(op);
    return idempotent(request, op, () => {
      if (held.status !== "pending" || !held.heldReason) return problem(op, "payment.invalid_state");
      const invoice = w().invoices.find((candidate) => candidate.id === held.invoiceId);
      if (!invoice) return problem(op, "payment.invalid_state");
      // Booked as the API does: allocated oldest first, the rest as the payer's credit, a receipt (D-220).
      const booked = confirmPayment(invoice, {
        amount: held.amount,
        method: held.method,
        confirmedVia: "manual",
        paidAt: held.paidAt,
        reference: held.providerRef,
        provider: held.provider,
      });
      w().payments.splice(w().payments.indexOf(booked), 1);
      const receipt = w().receipts.find((candidate) => candidate.paymentId === booked.id);
      if (receipt) receipt.paymentId = held.id;
      Object.assign(held, {
        ...booked,
        id: held.id,
        heldReason: held.heldReason,
        duplicateOfPaymentId: held.duplicateOfPaymentId,
        version: held.version + 1,
      });
      return { status: 200, body: held };
    });
  }),
  http.post("*/v1/owner/payments/:paymentId/actions/dismiss", async ({ request, params }) => {
    const op = "owner.payments.dismissHeld";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "payment.record");
    if (forbidden) return forbidden;
    const held = ok.own ? w().payments.find((candidate) => candidate.id === params.paymentId) : undefined;
    if (!held) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["ReasonDto"];
      if (!input.reason?.trim()) return validation(op, "reason", "a reason is required");
      if (held.status !== "pending" || !held.heldReason) return problem(op, "payment.invalid_state");
      held.status = "failed";
      held.dismissedAt = iso();
      held.dismissReason = input.reason.trim();
      held.nextActions = [];
      held.version += 1;
      emit("payment.dismissed", { aggregateType: "payment", aggregateId: held.id }, "owner");
      return { status: 200, body: held };
    });
  }),

  // Party link requests (D-226)
  http.get("*/v1/owner/party-link-requests", ({ request }) => {
    const ok = owner(request, "owner.parties.listLinkRequests");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const list = (ok.own ? w().linkRequests : [])
      .filter(
        (row) =>
          (!params.get("state") || row.state === params.get("state")) &&
          (!params.get("partyId") || row.partyId === params.get("partyId")),
      )
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return json(paged(list, request));
  }),
  ...(["confirm", "reject"] as const).map((action) =>
    http.post(`*/v1/owner/party-link-requests/:requestId/actions/${action}`, async ({ request, params }) => {
      const op = action === "confirm" ? "owner.parties.confirmLinkRequest" : "owner.parties.rejectLinkRequest";
      const ok = mutating(request, op);
      if (ok instanceof Response) return ok;
      const forbidden = allowed(ok, op, "party.link.manage");
      if (forbidden) return forbidden;
      const row = ok.own ? w().linkRequests.find((candidate) => candidate.id === params.requestId) : undefined;
      if (!row) return notFound(op);
      return idempotent(request, op, (payload) => {
        if (row.state !== "pending") return problem(op, "party.link_request_not_pending");
        if (action === "reject") {
          const reason = (payload as unknown as Schemas["RejectLinkRequestDto"]).reason?.trim();
          if (!reason) return validation(op, "reason", "a reason is required");
          row.state = "rejected";
          row.rejectReason = reason;
        } else {
          row.state = "confirmed";
          row.linkId = crypto.randomUUID();
          const party = w().parties.find((candidate) => candidate.id === row.partyId);
          if (party) {
            party.linkedLogins = (party.linkedLogins ?? 0) + 1;
            party.lineLinked = party.lineLinked || row.lineLinked;
          }
        }
        row.decidedAt = iso();
        emit("party.link_changed", { aggregateType: "party", aggregateId: row.partyId }, "owner");
        return { status: 200, body: row };
      });
    }),
  ),

  // TM30 (D-052, D-216)
  http.get("*/v1/owner/tm30-exports", ({ request }) => {
    const op = "owner.tm30.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tm30.manage");
    if (forbidden) return forbidden;
    const params = query(request);
    const list = (ok.own ? w().tm30 : [])
      .map(refreshTm30)
      .filter(
        (row) =>
          (!params.get("building") || row.buildingId === params.get("building")) &&
          (!params.get("status") || row.status === params.get("status")) &&
          (!params.get("q") || row.name.includes(params.get("q")!) || row.unitNo.includes(params.get("q")!)),
      )
      .sort((a, b) => b.dueAt.localeCompare(a.dueAt));
    return json(paged(list, request));
  }),
  http.get("*/v1/owner/tm30-exports/:tm30ExportId", ({ request, params }) => {
    const op = "owner.tm30.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tm30.manage");
    if (forbidden) return forbidden;
    const row = ok.own ? w().tm30.find((candidate) => candidate.id === params.tm30ExportId) : undefined;
    return row ? json(refreshTm30(row)) : notFound(op);
  }),
  http.post("*/v1/owner/buildings/:buildingId/tm30-exports/actions/generate", async ({ request, params }) => {
    const op = "owner.tm30.generate";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tm30.manage");
    if (forbidden) return forbidden;
    if (!ok.own || !w().buildings.some((building) => building.id === params.buildingId)) return notFound(op);
    return idempotent(request, op, (payload) => {
      const chosen = (payload as unknown as Schemas["Tm30GenerateDto"]).exportIds;
      const rows = w().tm30.filter(
        (row) =>
          row.buildingId === params.buildingId &&
          ["due", "generated", "downloaded"].includes(row.status) &&
          (!chosen?.length || chosen.includes(row.id)),
      );
      if (!rows.length) return problem(op, "tm30.nothing_pending");
      const errors = rows.flatMap((row) =>
        row.missing.map((field) => ({
          path: `exports.${row.id}.${field}`,
          code: "required",
          message: `${row.name} (${row.unitNo}): ${field} is required`,
        })),
      );
      if (errors.length) return problem(op, "tm30.data_missing", { errors });
      const fileDocumentId = crypto.randomUUID();
      const building = w().buildings.find((candidate) => candidate.id === params.buildingId)!;
      const title = `tm30-${building.code}-${today()}.xlsx`;
      w().tm30Files.set(fileDocumentId, { title, exportIds: rows.map((row) => row.id) });
      for (const row of rows) {
        row.status = "generated";
        row.generatedAt = iso();
        row.fileDocumentId = fileDocumentId;
        refreshTm30(row);
      }
      const origin = new URL(request.url).origin;
      return {
        status: 200,
        body: {
          fileDocumentId,
          title,
          url: `${origin}/__files/xlsx-${fileDocumentId}`,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          exports: rows,
        } satisfies Schemas["Tm30FileDto"],
      };
    });
  }),
  http.get("*/v1/owner/tm30-exports/:tm30ExportId/file", ({ request, params }) => {
    const op = "owner.tm30.file";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tm30.manage");
    if (forbidden) return forbidden;
    const row = ok.own ? w().tm30.find((candidate) => candidate.id === params.tm30ExportId) : undefined;
    if (!row) return notFound(op);
    const file = row.fileDocumentId ? w().tm30Files.get(row.fileDocumentId) : undefined;
    if (!row.fileDocumentId || !file) return problem(op, "tm30.invalid_state");
    const rows = w().tm30.filter((candidate) => file.exportIds.includes(candidate.id));
    for (const other of rows) {
      if (other.status === "generated") other.status = "downloaded";
      other.downloadedAt = other.downloadedAt ?? iso();
      refreshTm30(other);
    }
    const origin = new URL(request.url).origin;
    return json({
      fileDocumentId: row.fileDocumentId,
      title: file.title,
      url: `${origin}/__files/xlsx-${row.fileDocumentId}`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      exports: rows,
    } satisfies Schemas["Tm30FileDto"]);
  }),
  http.post("*/v1/owner/tm30-exports/:tm30ExportId/actions/mark-submitted", async ({ request, params }) => {
    const op = "owner.tm30.markSubmitted";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tm30.manage");
    if (forbidden) return forbidden;
    const row = ok.own ? w().tm30.find((candidate) => candidate.id === params.tm30ExportId) : undefined;
    if (!row) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["Tm30SubmittedDto"];
      if (!["due", "generated", "downloaded"].includes(row.status)) return problem(op, "tm30.invalid_state");
      const at = input.submittedAt ?? iso();
      if (Number.isNaN(Date.parse(at))) return validation(op, "submittedAt", "a date-time");
      if (Date.parse(at) > Date.now() + 60_000) return validation(op, "submittedAt", "never in the future");
      row.status = "submitted_manually";
      row.submittedAt = new Date(at).toISOString();
      row.submissionRef = input.reference?.trim() || null;
      refreshTm30(row);
      return { status: 200, body: row };
    });
  }),
  http.post("*/v1/owner/tm30-exports/:tm30ExportId/actions/cancel", async ({ request, params }) => {
    const op = "owner.tm30.cancel";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tm30.manage");
    if (forbidden) return forbidden;
    const row = ok.own ? w().tm30.find((candidate) => candidate.id === params.tm30ExportId) : undefined;
    if (!row) return notFound(op);
    const input = (await request.json().catch(() => ({}))) as Schemas["Tm30CancelDto"];
    state.owner.received.push({ op, idempotencyKey: request.headers.get("idempotency-key"), body: input });
    if (!input.reason || input.reason.trim().length < 3) return validation(op, "reason", "at least 3 characters");
    if (!["due", "generated", "downloaded"].includes(row.status)) return problem(op, "tm30.invalid_state");
    row.status = "cancelled";
    row.cancelReason = input.reason.trim();
    refreshTm30(row);
    return json(row);
  }),

  // e-Tax (D-050, D-215)
  http.get("*/v1/owner/etax/submissions", ({ request }) => {
    const ok = owner(request, "owner.etax.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const list = (ok.own ? w().etax : [])
      .filter(
        (row) =>
          (!params.get("status") || row.status === params.get("status")) &&
          (!params.get("subjectType") || row.subjectType === params.get("subjectType")) &&
          (!params.get("month") || isoMonth(row.issuedAt) === params.get("month")) &&
          (!params.get("q") || row.number.includes(params.get("q")!)),
      )
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    return json(paged(list, request));
  }),
  http.get("*/v1/owner/etax/submissions/:submissionId", ({ request, params }) => {
    const op = "owner.etax.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const row = ok.own ? w().etax.find((candidate) => candidate.id === params.submissionId) : undefined;
    return row ? json(row) : notFound(op);
  }),
  http.post("*/v1/owner/etax/submissions/:submissionId/actions/retry", async ({ request, params }) => {
    const op = "owner.etax.retry";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "receipt.issue");
    if (forbidden) return forbidden;
    const row = ok.own ? w().etax.find((candidate) => candidate.id === params.submissionId) : undefined;
    if (!row) return notFound(op);
    return idempotent(request, op, () => {
      if (row.status !== "rejected" && row.status !== "failed") return problem(op, "etax.invalid_state");
      row.status = "queued";
      row.attempts = 0;
      row.error = null;
      row.nextAttemptAt = iso();
      row.nextActions = [];
      return { status: 200, body: row };
    });
  }),
  http.get("*/v1/owner/etax/summary", ({ request }) => {
    const op = "owner.etax.summary";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const wanted = query(request).get("month") ?? month();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(wanted)) return validation(op, "month", "YYYY-MM");
    const rows = (ok.own ? w().etax : []).filter((row) => isoMonth(row.issuedAt) === wanted);
    const count = (status: Schemas["EtaxStatus"]) => rows.filter((row) => row.status === status).length;
    const signed = rows.filter((row) => row.status === "signed");
    // Totals are the API's figures; this mock only has one signed receipt, so it states its strings.
    return json({
      month: wanted,
      enabled: true,
      provider: "inet",
      counts: {
        queued: count("queued"),
        submitted: count("submitted"),
        signed: count("signed"),
        rejected: count("rejected"),
        failed: count("failed"),
      },
      signed: {
        documents: signed.length,
        subtotal: signed.length ? "4205.61" : "0.00",
        vatAmount: signed.length ? "294.39" : "0.00",
        total: signed.length ? "4500.00" : "0.00",
      },
      byType: signed.length ? [{ typeCode: "T03", documents: signed.length, total: "4500.00" }] : [],
    } satisfies Schemas["EtaxSummaryDto"]);
  }),

  // Insights + benchmarks (D-083, D-217)
  http.get("*/v1/owner/insights", ({ request }) => {
    const op = "owner.insights.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "report.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const months = Number(params.get("months") ?? 12);
    if (!Number.isInteger(months) || months < 3 || months > 24) return validation(op, "months", "3 to 24");
    return json(insights(params.get("building"), months));
  }),
];

/** `YYYY-MM` of an instant in Bangkok. */
function isoMonth(at: string): string {
  return new Date(Date.parse(at) + 7 * HOUR).toISOString().slice(0, 7);
}

// ---------------------------------------------------------------------------------------------------
// Controls (mocks/server.ts)

/** A slip of the same amount as A-201's QR payment already booked: it waits with `possible_qr_duplicate` (D-220). */
export function qrDuplicateSlip(): Schemas["SlipReviewDto"] | null {
  const template = w().slips[0];
  const invoice = w().invoices.find((candidate) => candidate.unitNo === "A-201" && candidate.status === "paid");
  if (!template || !invoice) return null;
  const slip: Schemas["SlipReviewDto"] = {
    ...template,
    id: crypto.randomUUID(),
    status: "pending_review",
    reasons: ["possible_qr_duplicate"],
    duplicateOfId: null,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    invoiceBalance: invoice.balance,
    amountDetected: invoice.total,
    payerName: invoice.billedPartyName,
    unitNo: invoice.unitNo,
    transRef: `SLIP-${Date.now()}`,
    uploadedAt: iso(),
    nextActions: ["decide"],
    rejectReason: null,
    paymentId: null,
    version: 1,
  };
  w().slips.unshift(slip);
  return slip;
}

/** Someone signs in to the resident app with the SMS code of the party's phone (D-226): a pending request. */
export function phoneSignIn(partyId: string): Schemas["PartyLinkRequestDto"] | null {
  const party = w().parties.find((candidate) => candidate.id === partyId);
  if (!party) return null;
  const request: Schemas["PartyLinkRequestDto"] = {
    id: crypto.randomUUID(),
    partyId,
    partyDisplayName: party.displayName,
    userId: crypto.randomUUID(),
    userDisplayName: "LINE user",
    lineLinked: false,
    via: "phone_match",
    state: "pending",
    requestedAt: iso(),
    decidedAt: null,
    rejectReason: null,
    linkId: null,
  };
  w().linkRequests.unshift(request);
  emit("party.link_requested", { aggregateType: "party", aggregateId: partyId }, "owner");
  return request;
}
