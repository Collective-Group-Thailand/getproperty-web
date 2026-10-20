import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { add, baht, satang } from "./money";
import { json, owner, query } from "./support";
import { slaBreachedOf } from "../r2/world";
import { BUILDING_A, day, iso, lossView, PERIODS } from "./world";

type Schemas = components["schemas"];

const w = () => state.owner;
const OPEN = new Set<Schemas["InvoiceStatus"]>(["issued", "partially_paid", "overdue"]);

function daysPast(dueDate: string | null): number {
  if (!dueDate) return 0;
  return Math.floor((Date.parse(day(0)) - Date.parse(dueDate)) / 86_400_000);
}

export function aging(invoices: { balance: string; dueDate: string | null }[]): Schemas["AgingDto"] {
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
  for (const invoice of invoices) {
    const days = daysPast(invoice.dueDate);
    const key = days <= 0 ? "current" : days <= 30 ? "d1_30" : days <= 60 ? "d31_60" : days <= 90 ? "d61_90" : "d90p";
    buckets[key] += satang(invoice.balance);
  }
  return {
    current: baht(buckets.current),
    d1_30: baht(buckets.d1_30),
    d31_60: baht(buckets.d31_60),
    d61_90: baht(buckets.d61_90),
    d90p: baht(buckets.d90p),
  };
}

export function complianceScore(month: string): Schemas["ComplianceScoreDto"] {
  const issued = w().invoices.filter((invoice) => invoice.status !== "draft" && invoice.status !== "void");
  const aboveCapLines = issued.flatMap((invoice) => invoice.lines.filter((line) => line.aboveCap));
  const acknowledged = aboveCapLines.filter((line) => line.complianceAcknowledgementId).length;
  const within = issued.filter((invoice) => !invoice.hasAboveCapLine).length;
  const due = w().deposits.filter((deposit) => deposit.settlement && deposit.settlement.status !== "closed");
  const onTime = due.filter((deposit) => !deposit.settlement!.isLate).length;
  const leases = w().leases.filter((lease) => ["active", "notice_given", "ending"].includes(lease.status));
  const ratio = (numerator: number, denominator: number) => (denominator ? (numerator / denominator).toFixed(4) : null);
  const components: Schemas["ComplianceScoreComponentDto"][] = [
    { key: "invoices_within_rate", numerator: within, denominator: issued.length, ratio: ratio(within, issued.length) },
    {
      key: "above_cap_acknowledged",
      numerator: acknowledged,
      denominator: aboveCapLines.length,
      ratio: ratio(acknowledged, aboveCapLines.length),
    },
    { key: "deposits_on_time", numerator: onTime, denominator: due.length, ratio: ratio(onTime, due.length) },
    {
      key: "standard_contracts",
      numerator: leases.length,
      denominator: leases.length,
      ratio: ratio(leases.length, leases.length),
    },
  ];
  const judged = components.filter((component) => component.ratio !== null);
  const score = judged.length
    ? ((judged.reduce((sum, component) => sum + Number(component.ratio), 0) / judged.length) * 100).toFixed(2)
    : "100.00";
  return {
    month,
    score,
    components,
    computedAt: iso(),
    invoicesTotal: issued.length,
    invoicesWithinRate: within,
    linesAboveCap: aboveCapLines.length,
    linesAboveCapAcknowledged: acknowledged,
    depositsDue: due.length,
    depositsRefundedOnTime: onTime,
    leasesTotal: leases.length,
    leasesOnStandardTemplate: leases.length,
  };
}

export const dashboardHandlers: HttpHandler[] = [
  http.get("*/v1/owner/dashboard", ({ request }) => {
    const ok = owner(request, "owner.dashboard.get");
    if (ok instanceof Response) return ok;
    const buildingId = query(request).get("buildingId");
    const month = query(request).get("month") ?? PERIODS.current();
    const invoices = (ok.own ? w().invoices : []).filter((invoice) => !buildingId || invoice.buildingId === buildingId);
    const overdue = invoices.filter((invoice) => invoice.status === "overdue");
    const issuedInMonth = invoices.filter(
      (invoice) => invoice.billingCycleId === w().cycles[1]?.id && invoice.status !== "void",
    );
    const billed = add(...issuedInMonth.map((invoice) => invoice.total));
    const collected = add(...issuedInMonth.map((invoice) => invoice.paidTotal));
    const payments = (ok.own ? w().payments : []).filter((payment) => payment.status === "confirmed");
    const methods = [...new Set(payments.map((payment) => payment.method))];
    const score = complianceScore(month);
    const dashboard: Schemas["DashboardDto"] = {
      month,
      today: day(0),
      buildingId,
      attention: {
        draftsToReview: invoices.filter((invoice) => invoice.status === "draft").length,
        slipsToReview: ok.own ? w().slips.filter((slip) => slip.status === "pending_review").length : 0,
        // R2 (F6): open requests past their SLA and parcels at the desk, for the focused building or all.
        serviceRequestsOverdue: ok.own
          ? state.r2.requests.filter((sr) => (!buildingId || sr.buildingId === buildingId) && slaBreachedOf(sr)).length
          : 0,
        parcelsWaiting: ok.own
          ? state.r2.parcels.filter(
              (parcel) =>
                (!buildingId || parcel.buildingId === buildingId) &&
                (parcel.status === "received" || parcel.status === "notified"),
            ).length
          : 0,
      },
      arrears: {
        balance: add(...overdue.map((invoice) => invoice.balance)),
        invoices: overdue.length,
        parties: new Set(overdue.map((invoice) => invoice.billedPartyId)).size,
        aging: aging(invoices.filter((invoice) => OPEN.has(invoice.status))),
        credit: add(...(ok.own ? w().credits : []).map((credit) => credit.balance)),
      },
      billing: {
        billed,
        collected,
        collectedPct: satang(billed) ? ((satang(collected) / satang(billed)) * 100).toFixed(2) : null,
        invoices: issuedInMonth.length,
        outstanding: add(...issuedInMonth.map((invoice) => invoice.balance)),
      },
      compliance: {
        score: score.score,
        invoicesTotal: score.invoicesTotal,
        invoicesWithinRate: score.invoicesWithinRate,
        linesAboveCap: score.linesAboveCap,
        linesAboveCapAcknowledged: score.linesAboveCapAcknowledged,
      },
      cycles: (ok.own ? w().cycles.slice(0, 1) : []).map((cycle) => ({
        propertyId: cycle.propertyId,
        propertyName: cycle.propertyName,
        periodKey: cycle.periodKey,
        status: cycle.status,
        autoIssueAt: cycle.autoIssueAt,
        issuedAt: cycle.issuedAt,
      })),
      dueToday: {
        invoices: invoices.filter((invoice) => OPEN.has(invoice.status) && invoice.dueDate === day(0)).length,
        balance: add(
          ...invoices
            .filter((invoice) => OPEN.has(invoice.status) && invoice.dueDate === day(0))
            .map((invoice) => invoice.balance),
        ),
      },
      income: {
        received: add(...payments.map((payment) => payment.amount)),
        payments: payments.length,
        byMethod: methods.map((method) => ({
          method,
          count: payments.filter((payment) => payment.method === method).length,
          amount: add(...payments.filter((payment) => payment.method === method).map((payment) => payment.amount)),
        })),
      },
      loss:
        ok.own && (!buildingId || buildingId === BUILDING_A)
          ? (["electric", "water"] as const).map((utility) => {
              const view = lossView(utility, PERIODS.previous());
              return {
                buildingId: BUILDING_A,
                buildingName: "อาคาร A",
                utility,
                lossPct: view.report.lossPct,
                lossThb: view.report.lossThb,
                periodStart: view.report.periodStart,
                periodEnd: view.report.periodEnd,
              };
            })
          : [],
    };
    return json(dashboard);
  }),
  http.get("*/v1/owner/compliance/score", ({ request }) => {
    const ok = owner(request, "owner.compliance.score");
    if (ok instanceof Response) return ok;
    return json(complianceScore(query(request).get("month") ?? PERIODS.current()));
  }),
  http.get("*/v1/owner/deposits/summary", ({ request }) => {
    const ok = owner(request, "owner.deposits.summary");
    if (ok instanceof Response) return ok;
    const deposits = ok.own ? w().deposits : [];
    const count = (status: Schemas["DepositStatus"]) => deposits.filter((deposit) => deposit.status === status).length;
    const open = deposits.filter(
      (deposit) => deposit.settlement && !["refunded", "closed"].includes(deposit.settlement.status),
    );
    const until = (deposit: Schemas["DepositDto"]) => Date.parse(deposit.settlement!.deadlineAt) - Date.now();
    return json({
      byStatus: {
        pending: count("pending"),
        held: count("held"),
        settling: count("settling"),
        refunded: count("refunded"),
        forfeitedPartially: count("forfeited_partially"),
        forfeited: count("forfeited"),
        disputed: count("disputed"),
      },
      settlementsDueSoon: open.filter((deposit) => until(deposit) >= 0 && until(deposit) <= 3 * 86_400_000 + 3_600_000)
        .length,
      settlementsOverdue: open.filter((deposit) => until(deposit) < 0).length,
      lateRefunds: deposits.filter((deposit) => deposit.settlement?.isLate && deposit.settlement.refundedAt).length,
    } satisfies Schemas["DepositSummaryDto"]);
  }),
];
