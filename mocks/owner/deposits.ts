import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { add, baht, satang, sub } from "./money";
import {
  body,
  documentDownload,
  idempotent,
  json,
  LEGAL_REF,
  mutating,
  notFound,
  owner,
  paged,
  problem,
  query,
  validation,
} from "./support";
import { iso } from "./world";

type Schemas = components["schemas"];

/**
 * Deposits and settlements (F2 2.2, D-023, D-177, D-178): receipt → held; at move-out a settlement
 * with a 7-day clock; damage/missing deductions need the move-out line recorded damaged/missing with a
 * photo (`compliance.deposit_evidence`), normal wear is refused (`compliance.deposit_wear`); the API
 * proposes the refund (held + unused advance − deductions − utilities); the refund must pay at least
 * the agreed (or proposed) amount (`compliance.no_forfeiture`) and a transfer needs its slip.
 */
const w = () => state.owner;
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

function recompute(deposit: Schemas["DepositDto"]) {
  const settlement = deposit.settlement;
  if (!settlement) return;
  settlement.deductionsTotal = add(...settlement.items.map((item) => item.amount));
  deposit.nextActions =
    deposit.status === "pending"
      ? ["record-receipt"]
      : settlement.status === "refunded" || settlement.status === "closed"
        ? []
        : settlement.status === "proposed"
          ? ["revise"]
          : settlement.status === "agreed" || settlement.status === "disputed"
            ? ["record-refund"]
            : ["propose"];
}

function find(ok: { own: boolean }, id: unknown) {
  return ok.own ? w().deposits.find((candidate) => candidate.id === id) : undefined;
}

export const depositHandlers: HttpHandler[] = [
  http.get("*/v1/owner/deposits", ({ request }) => {
    const ok = owner(request, "owner.deposits.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const late = params.get("late");
    const list = (ok.own ? w().deposits : []).filter((deposit) => {
      const lease = w().leases.find((candidate) => candidate.id === deposit.leaseId);
      return (
        (!params.get("status") || deposit.status === params.get("status")) &&
        (!params.get("leaseId") || deposit.leaseId === params.get("leaseId")) &&
        (!params.get("buildingId") || lease?.buildingId === params.get("buildingId")) &&
        (late !== "true" ||
          (deposit.settlement !== null &&
            Date.parse(deposit.settlement.deadlineAt) < Date.now() &&
            !deposit.settlement.refundedAt)) &&
        (!params.get("q") ||
          deposit.unitNo.toLowerCase().includes(params.get("q")!.toLowerCase()) ||
          (deposit.lesseeName ?? "").includes(params.get("q")!))
      );
    });
    // Open settlements first, by deadline (the 7-day clock).
    const sorted = [...list].sort((a, b) => {
      const da =
        a.settlement && !a.settlement.refundedAt ? Date.parse(a.settlement.deadlineAt) : Number.MAX_SAFE_INTEGER;
      const db =
        b.settlement && !b.settlement.refundedAt ? Date.parse(b.settlement.deadlineAt) : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
    return json(paged(sorted, request));
  }),
  http.get("*/v1/owner/deposits/:depositId", ({ request, params }) => {
    const op = "owner.deposits.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (params.depositId === "summary") return undefined;
    const deposit = find(ok, params.depositId);
    return deposit ? json(deposit) : notFound(op);
  }),
  http.get("*/v1/owner/deposits/:depositId/inspection-comparison", ({ request, params }) => {
    const op = "owner.deposits.inspectionComparison";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    if (!deposit) return notFound(op);
    return json(w().comparisons.get(deposit.id) ?? { moveInInspectionId: null, moveOutInspectionId: null, lines: [] });
  }),
  http.post("*/v1/owner/deposits/:depositId/actions/record-receipt", async ({ request, params }) => {
    const op = "owner.deposits.recordReceipt";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    if (!deposit) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["RecordReceiptDto"];
      if (deposit.status !== "pending") return problem(op, "deposit.invalid_state");
      deposit.status = "held";
      deposit.receivedAt = input.receivedAt ?? iso();
      deposit.receiptNumber = `DRC-2569-${String(w().deposits.length + 40).padStart(5, "0")}`;
      deposit.nextActions = [];
      deposit.version += 1;
      return { status: 200, body: deposit };
    });
  }),
  http.post("*/v1/owner/deposits/:depositId/settlement/items", async ({ request, params }) => {
    const op = "owner.deposits.addDeduction";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    if (!deposit) return notFound(op);
    const settlement = deposit.settlement;
    if (!settlement || !["opened", "inspected"].includes(settlement.status))
      return problem(op, "deposit.invalid_state");
    const input = await body<Schemas["DeductionCreateDto"]>(request);
    if (!MONEY.test(input.amount ?? "") || satang(input.amount) <= 0)
      return validation(op, "amount", "an amount above 0.00");
    if (!input.description?.trim()) return validation(op, "description", "a description is required");
    if (input.wearCategory === "normal_wear") {
      return problem(op, "compliance.deposit_wear", {
        ruleId: "compliance.deposit_wear",
        legalRef: LEGAL_REF.depositEvidence,
      });
    }
    if (input.kind === "damage" || input.kind === "missing_item") {
      const line = (w().comparisons.get(deposit.id)?.lines ?? []).find(
        (candidate) => candidate.moveOut?.inspectionItemId === input.inspectionItemId,
      );
      const recorded = line?.moveOut && (line.moveOut.condition === "damaged" || line.moveOut.condition === "missing");
      const photos = (line?.moveOut?.photoDocumentIds.length ?? 0) + (input.evidenceDocumentIds?.length ?? 0);
      if (!recorded || photos === 0) {
        return problem(op, "compliance.deposit_evidence", {
          ruleId: "compliance.deposit_evidence",
          legalRef: LEGAL_REF.depositEvidence,
        });
      }
    } else if (!input.evidenceDocumentIds?.length) {
      return problem(op, "compliance.deposit_evidence", {
        ruleId: "compliance.deposit_evidence",
        legalRef: LEGAL_REF.depositEvidence,
      });
    }
    settlement.items.push({
      id: crypto.randomUUID(),
      kind: input.kind,
      description: input.description,
      amount: Number(input.amount).toFixed(2),
      evidenceDocumentIds: input.evidenceDocumentIds ?? [],
      inspectionItemId: input.inspectionItemId ?? null,
      residentAccepted: null,
    });
    recompute(deposit);
    deposit.version += 1;
    w().received.push({ op, idempotencyKey: null, body: input });
    return json(deposit, 201);
  }),
  http.delete("*/v1/owner/deposits/:depositId/settlement/items/:itemId", ({ request, params }) => {
    const op = "owner.deposits.removeDeduction";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    if (!deposit?.settlement) return notFound(op);
    if (!["opened", "inspected"].includes(deposit.settlement.status)) return problem(op, "deposit.invalid_state");
    deposit.settlement.items = deposit.settlement.items.filter((item) => item.id !== params.itemId);
    recompute(deposit);
    deposit.version += 1;
    return json(deposit);
  }),
  http.post("*/v1/owner/deposits/:depositId/settlement/actions/propose", async ({ request, params }) => {
    const op = "owner.deposits.propose";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    const settlement = deposit?.settlement;
    if (!deposit || !settlement) return notFound(op);
    if (!["opened", "inspected"].includes(settlement.status)) return problem(op, "deposit.invalid_state");
    const input = await body<Schemas["ProposeSettlementDto"]>(request);
    if (input.utilitiesFinal !== undefined && !MONEY.test(input.utilitiesFinal))
      return validation(op, "utilitiesFinal", "an amount like 312.50");
    settlement.utilitiesFinal = input.utilitiesFinal
      ? Number(input.utilitiesFinal).toFixed(2)
      : settlement.utilitiesFinal;
    const refund =
      satang(add(settlement.depositHeld, settlement.advanceRentUnused)) -
      satang(add(settlement.deductionsTotal, settlement.utilitiesFinal));
    settlement.proposedRefund = baht(Math.max(0, refund));
    settlement.status = "proposed";
    recompute(deposit);
    deposit.version += 1;
    return json(deposit);
  }),
  http.post("*/v1/owner/deposits/:depositId/settlement/actions/revise", ({ request, params }) => {
    const op = "owner.deposits.revise";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    const settlement = deposit?.settlement;
    if (!deposit || !settlement) return notFound(op);
    if (settlement.status !== "proposed" || settlement.residentResponse) return problem(op, "deposit.invalid_state");
    settlement.status = "inspected";
    settlement.proposedRefund = null;
    recompute(deposit);
    deposit.version += 1;
    return json(deposit);
  }),
  http.post("*/v1/owner/deposits/:depositId/settlement/actions/record-refund", async ({ request, params }) => {
    const op = "owner.deposits.recordRefund";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    const settlement = deposit?.settlement;
    if (!deposit || !settlement) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["RecordRefundDto"];
      if (!["agreed", "disputed", "proposed"].includes(settlement.status)) return problem(op, "deposit.invalid_state");
      if (!MONEY.test(input.amount ?? "")) return validation(op, "amount", "an amount like 3687.50");
      const minimum = settlement.agreedRefund ?? settlement.proposedRefund ?? "0.00";
      if (satang(input.amount) < satang(minimum)) {
        return problem(op, "compliance.no_forfeiture", {
          ruleId: "compliance.no_forfeiture",
          legalRef: LEGAL_REF.forfeiture,
          detail: `ต้องคืนอย่างน้อย ${minimum} บาท`,
        });
      }
      if (input.method === "bank_transfer" && !input.evidenceDocumentId)
        return validation(op, "evidenceDocumentId", "the transfer slip is required");
      settlement.refundAmount = Number(input.amount).toFixed(2);
      settlement.refundMethod = input.method;
      settlement.refundedAt = input.refundedAt ?? iso();
      settlement.isLate = settlement.isLate || Date.parse(settlement.refundedAt) > Date.parse(settlement.deadlineAt);
      settlement.status = "refunded";
      settlement.statementNumber = `DST-2569-${String(w().deposits.length).padStart(5, "0")}`;
      deposit.status =
        satang(sub(settlement.depositHeld, settlement.refundAmount)) > 0 ? "forfeited_partially" : "refunded";
      recompute(deposit);
      deposit.version += 1;
      return { status: 200, body: deposit };
    });
  }),
  http.get("*/v1/owner/deposits/:depositId/receipt", ({ request, params }) => {
    const op = "owner.deposits.receipt";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    if (!deposit) return notFound(op);
    if (!deposit.receiptNumber) return problem(op, "deposit.invalid_state");
    return json(documentDownload(request, `${deposit.id.slice(0, -4)}0rc1`, deposit.receiptNumber));
  }),
  http.get("*/v1/owner/deposits/:depositId/statement", ({ request, params }) => {
    const op = "owner.deposits.statement";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const deposit = find(ok, params.depositId);
    if (!deposit) return notFound(op);
    if (!deposit.settlement?.statementNumber) return problem(op, "deposit.invalid_state");
    return json(documentDownload(request, `${deposit.id.slice(0, -4)}0st1`, deposit.settlement.statementNumber));
  }),
];

/** `POST /__mock/owner/deposits/{id}/resident-response?answer=accepted|disputed` — the resident's answer in getproperty-liff. */
export function residentAnswers(depositId: string, answer: "accepted" | "disputed"): boolean {
  const deposit = w().deposits.find((candidate) => candidate.id === depositId);
  const settlement = deposit?.settlement;
  if (!deposit || !settlement || settlement.status !== "proposed") return false;
  settlement.residentResponse = answer;
  settlement.status = answer === "accepted" ? "agreed" : "disputed";
  if (answer === "accepted") settlement.agreedRefund = settlement.proposedRefund;
  else settlement.disputeReason = "ไม่เห็นด้วยกับค่าซ่อมผนัง";
  for (const item of settlement.items) item.residentAccepted = answer === "accepted";
  if (answer === "disputed") deposit.status = "disputed";
  recompute(deposit);
  deposit.version += 1;
  return true;
}
