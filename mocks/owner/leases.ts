import { http, type HttpHandler } from "msw";
import QRCode from "qrcode";

import type { components } from "../../src/lib/api/schema";
import { placeholderPdf } from "../handlers/staff";
import { state } from "../state";
import { add, mul, satang } from "./money";
import {
  body,
  documentDownload,
  etagged,
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
  stale,
  validation,
} from "./support";
import { day, iso, TEMPLATE_STANDARD, TEMPLATE_VERSION } from "./world";

type Schemas = components["schemas"];

/**
 * Leases of the owner surface (F2 2.2, B2.3): the wizard's draft and its compliance answers — the
 * deposit cap refuses (`compliance.deposit_cap`, block), a water-minimum line above the utility's own
 * minimum warns (`compliance.water_minimum`, acknowledgement then repeat, D-021a semantics), a
 * forbidden addendum clause refuses — then send-for-signature, the resident's signature (simulated by
 * `/__mock/owner/leases/{id}/resident-sign`), countersign → active (unit occupied, deposit pending),
 * notices (≥ 30 days or a warning, lessor grounds), renewal, termination, move-out (→ deposit settling).
 */

const w = () => state.owner;
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const LIVE: Schemas["LeaseStatus"][] = ["active", "notice_given", "ending", "pending_signature"];

function leaseEvent(leaseId: string, type: string, data: Record<string, unknown> = {}, actorType = "user") {
  const list = w().leaseEvents.get(leaseId) ?? [];
  list.push({ id: crypto.randomUUID(), type, occurredAt: iso(), actorType, data });
  w().leaseEvents.set(leaseId, list);
}

function nextActionsOf(lease: Schemas["LeaseDto"]): string[] {
  switch (lease.status) {
    case "draft":
      return ["send-for-signature", "cancel"];
    case "pending_signature":
      return lease.signatures.some((signature) => signature.signerRole === "lessee")
        ? ["countersign", "cancel"]
        : ["cancel"];
    case "active":
      return ["record-notice", "renew", "terminate"];
    case "notice_given":
    case "ending":
      return ["begin-move-out", "terminate"];
    default:
      return [];
  }
}

function sync(lease: Schemas["LeaseDto"]) {
  lease.nextActions = nextActionsOf(lease);
}

const ALLOWED_CLAUSES = new Set<Schemas["AddendumClauseType"]>([
  "house_rules",
  "pets",
  "smoking",
  "guests",
  "quiet_hours",
  "parking_rules",
  "furniture_care",
  "waste",
  "other",
]);

/** The compliance checks of a lease's money terms (B2.3 / B4.1 registry, as the mock knows them). */
function checkTerms(
  op: string,
  terms: {
    rent: string;
    depositAmount: string;
    advanceRentAmount: string;
    lines: Schemas["LeaseLineInputDto"][];
    addendum: Schemas["AddendumClauseDto"][];
  },
  ackIds: string[] | undefined,
): Response | null {
  const cap = mul(terms.rent, 3);
  if (satang(add(terms.depositAmount, terms.advanceRentAmount)) > satang(cap)) {
    return problem(op, "compliance.deposit_cap", {
      legalRef: LEGAL_REF.depositCap,
      ruleId: "compliance.deposit_cap",
      detail: `เงินประกันรวมค่าเช่าล่วงหน้าต้องไม่เกิน 3 เดือนของค่าเช่า (${cap} บาท)`,
    });
  }
  for (const clause of terms.addendum) {
    if (!ALLOWED_CLAUSES.has(clause.type)) {
      return problem(op, "compliance.forbidden_clause", {
        ruleId: "compliance.forbidden_clause",
        legalRef: LEGAL_REF.depositCap,
      });
    }
  }
  const water = terms.lines.find((line) => line.kind === "water_minimum");
  if (water && satang(water.amount) > satang("100.00")) {
    return needsAcknowledgement(
      op,
      "compliance.water_minimum",
      { kind: "water_minimum", amount: water.amount, utilityMinimum: "100.00", provider: "mwa" },
      ackIds,
      LEGAL_REF.tariffCap,
    );
  }
  return null;
}

function leaseFromInput(input: Schemas["LeaseCreateDto"]): Schemas["LeaseDto"] | Response {
  const op = "owner.leases.create";
  const unit = w().units.find((candidate) => candidate.id === input.unitId);
  if (!unit) return notFound(op);
  const party = w().parties.find((candidate) => candidate.id === input.lesseePartyId);
  if (!party) return validation(op, "lesseePartyId", "unknown party");
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate))
    return validation(op, "startDate", "a date YYYY-MM-DD");
  const rent = input.rent ?? unit.baseRent ?? "0.00";
  for (const [field, value] of [
    ["rent", rent],
    ["depositAmount", input.depositAmount],
    ["advanceRentAmount", input.advanceRentAmount],
  ] as const) {
    if (value !== undefined && !MONEY.test(value)) return validation(op, field, "an amount like 4500.00");
  }
  for (const [index, line] of (input.lines ?? []).entries()) {
    if (!MONEY.test(line.amount)) return validation(op, `lines[${index}].amount`, "an amount like 300.00");
    if (!line.description?.trim()) return validation(op, `lines[${index}].description`, "a description is required");
  }
  const months = input.months ?? 12;
  const start = new Date(`${input.startDate}T00:00:00+07:00`);
  const end =
    input.endDate ??
    new Date(start.getTime() + (months * 30.4375 - 1) * 86_400_000 + 7 * 3600_000).toISOString().slice(0, 10);
  const parties: Schemas["LeasePartyViewDto"][] = [
    { partyId: party.id, displayName: party.displayName, role: "lessee", isSigner: true, signedAt: null },
    ...(input.coTenantPartyIds ?? []).map((id) => ({
      partyId: id,
      displayName: w().parties.find((candidate) => candidate.id === id)?.displayName ?? null,
      role: "co_tenant" as const,
      isSigner: true,
      signedAt: null,
    })),
    ...(input.occupantPartyIds ?? []).map((id) => ({
      partyId: id,
      displayName: w().parties.find((candidate) => candidate.id === id)?.displayName ?? null,
      role: "occupant" as const,
      isSigner: false,
      signedAt: null,
    })),
  ];
  const building = w().buildings.find((candidate) => candidate.id === unit.buildingId);
  const lease: Schemas["LeaseDto"] = {
    id: crypto.randomUUID(),
    unitId: unit.id,
    unitNo: unit.unitNo,
    buildingId: unit.buildingId,
    buildingName: building?.name ?? null,
    lesseePartyId: party.id,
    lesseeName: party.displayName,
    status: "draft",
    startDate: input.startDate,
    endDate: end,
    months,
    rent: Number(rent).toFixed(2),
    depositAmount: input.depositAmount ?? Number(rent).toFixed(2),
    advanceRentAmount: input.advanceRentAmount ?? Number(rent).toFixed(2),
    billingDay: input.billingDay ?? null,
    keysCount: input.keysCount ?? 2,
    parkingSlots: input.parkingSlots ?? 0,
    utilityBillingMode: input.utilityBillingMode ?? "metered",
    lines: (input.lines ?? []).map((line) => ({
      id: crypto.randomUUID(),
      kind: line.kind,
      description: line.description,
      amount: Number(line.amount).toFixed(2),
      recurrence: line.recurrence ?? "monthly",
      effectiveFrom: input.startDate,
    })),
    addendum: input.addendum ?? [],
    rentIncreases: input.rentIncreases ?? [],
    terms: input.terms ?? {},
    parties,
    signatures: [],
    compliance: {
      inScope: true,
      evaluatedAt: iso(),
      checks: [
        { ruleId: "compliance.deposit_cap", outcome: "pass", severity: "block", acknowledgementId: null },
        ...(input.acknowledgementIds?.length
          ? [
              {
                ruleId: "compliance.water_minimum",
                outcome: "warn" as const,
                severity: "warn" as const,
                acknowledgementId: input.acknowledgementIds[0]!,
              },
            ]
          : []),
      ],
    },
    contract: null,
    notice: null,
    termination: null,
    number: null,
    moveInAt: null,
    moveOutAt: null,
    renewedFromLeaseId: null,
    createdAt: iso(),
    currency: "THB",
    nextActions: ["send-for-signature", "cancel"],
    version: 1,
  };
  return lease;
}

let contractSeq = 40;

export const leaseHandlers: HttpHandler[] = [
  http.get("*/v1/owner/lease-templates", ({ request }) => {
    const ok = owner(request, "owner.leaseTemplates.list");
    if (ok instanceof Response) return ok;
    return json([
      {
        id: TEMPLATE_STANDARD,
        key: "ocpb_2568_residential_th",
        name: "สัญญาเช่าอาคารเพื่ออยู่อาศัย (แบบมาตรฐาน สคบ. 2568)",
        platform: true,
        versions: [
          {
            id: TEMPLATE_VERSION,
            version: 1,
            language: "th",
            state: "published",
            effectiveFrom: "2025-09-04",
            legalRef: "ประกาศคณะกรรมการว่าด้วยสัญญา พ.ศ. 2568 ข้อ 4–6",
            allowedClauseTypes: [...ALLOWED_CLAUSES],
            forbiddenClauseTypes: ["renewal_fee", "lockout_or_removal"],
          },
        ],
      },
    ] satisfies Schemas["LeaseTemplateDto"][]);
  }),

  http.get("*/v1/owner/leases", ({ request }) => {
    const ok = owner(request, "owner.leases.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    let leases = ok.own ? w().leases : [];
    leases = leases.filter(
      (lease) =>
        (!params.get("status") || lease.status === params.get("status")) &&
        (!params.get("buildingId") || lease.buildingId === params.get("buildingId")) &&
        (!params.get("unitId") || lease.unitId === params.get("unitId")) &&
        (!params.get("partyId") || lease.parties.some((party) => party.partyId === params.get("partyId"))) &&
        (!q ||
          lease.unitNo.toLowerCase().includes(q) ||
          (lease.lesseeName ?? "").toLowerCase().includes(q) ||
          (lease.number ?? "").toLowerCase().includes(q)),
    );
    const order = params.get("order") === "asc" ? 1 : -1;
    const sort = params.get("sort") ?? "createdAt";
    leases = [...leases].sort(
      (a, b) => String(a[sort as keyof typeof a] ?? "").localeCompare(String(b[sort as keyof typeof b] ?? "")) * order,
    );
    return json(paged(leases, request));
  }),

  http.post("*/v1/owner/leases", async ({ request }) => {
    const op = "owner.leases.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    const input = await body<Schemas["LeaseCreateDto"]>(request);
    const unit = w().units.find((candidate) => candidate.id === input.unitId);
    if (
      unit &&
      w().leases.some(
        (lease) => lease.unitId === unit.id && LIVE.includes(lease.status) && lease.endDate >= (input.startDate ?? ""),
      )
    )
      return problem(op, "lease.unit_unavailable");
    const lease = leaseFromInput(input);
    if (lease instanceof Response) return lease;
    const refusal = checkTerms(
      op,
      {
        rent: lease.rent,
        depositAmount: lease.depositAmount,
        advanceRentAmount: lease.advanceRentAmount,
        lines: input.lines ?? [],
        addendum: lease.addendum,
      },
      input.acknowledgementIds,
    );
    if (refusal) return refusal;
    w().leases.push(lease);
    leaseEvent(lease.id, "drafted");
    state.owner.received.push({ op, idempotencyKey: null, body: input });
    return etagged(lease, 201);
  }),

  // The dry run of the create (D-208): the same checks, answered as data; nothing is written.
  http.post("*/v1/owner/leases/compliance-preview", async ({ request }) => {
    const op = "owner.leases.previewCompliance";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    const input = await body<Schemas["LeaseCreateDto"]>(request);
    const lease = leaseFromInput(input);
    if (lease instanceof Response && lease.status === 404) return notFound(op);
    const refusal =
      lease instanceof Response
        ? lease
        : checkTerms(
            "owner.leases.create",
            {
              rent: lease.rent,
              depositAmount: lease.depositAmount,
              advanceRentAmount: lease.advanceRentAmount,
              lines: input.lines ?? [],
              addendum: lease.addendum,
            },
            input.acknowledgementIds,
          );
    const found = refusal
      ? ((await refusal.json()) as { code: string; status: number; ruleId?: string; legalRef?: string; errors?: [] })
      : null;
    const depositBlocked = found?.code === "compliance.deposit_cap";
    const preview: Schemas["LeaseCompliancePreviewDto"] = {
      inScope: true,
      checks: [
        {
          ruleId: "compliance.deposit_cap",
          outcome: depositBlocked ? "block" : "pass",
          severity: "block",
          legalRef: LEGAL_REF.depositCap,
          context: {},
        },
        ...(found?.code === "compliance.acknowledgement_required"
          ? [
              {
                ruleId: found.ruleId ?? "compliance.water_minimum",
                outcome: "warn" as const,
                severity: "warn" as const,
                legalRef: found.legalRef ?? LEGAL_REF.tariffCap,
                context: {},
              },
            ]
          : []),
      ],
      problems: found
        ? [
            {
              code: found.code,
              status: found.status,
              ruleId: found.ruleId ?? null,
              legalRef: found.legalRef ?? null,
              errors: found.errors ?? [],
            },
          ]
        : [],
      defaults:
        lease instanceof Response
          ? null
          : {
              rent: lease.rent,
              depositAmount: lease.depositAmount,
              advanceRentAmount: lease.advanceRentAmount,
              billingDay: lease.billingDay,
              months: input.months ?? 12,
              endDate: lease.endDate,
              lines: input.lines ?? [],
            },
    };
    return json(preview);
  }),

  http.get("*/v1/owner/leases/:leaseId", ({ request, params }) => {
    const op = "owner.leases.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    return lease ? etagged(lease) : notFound(op);
  }),

  http.patch("*/v1/owner/leases/:leaseId", async ({ request, params }) => {
    const op = "owner.leases.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    if (!request.headers.get("if-match")) return problem(op, "concurrency.precondition_required");
    if (stale(request, lease)) return problem(op, "concurrency.stale");
    if (lease.status !== "draft") return problem(op, "lease.invalid_state");
    const input = await body<Schemas["LeaseUpdateDto"]>(request);
    const next = {
      rent: input.rent ?? lease.rent,
      depositAmount: input.depositAmount ?? lease.depositAmount,
      advanceRentAmount: input.advanceRentAmount ?? lease.advanceRentAmount,
      lines:
        input.lines ??
        lease.lines.map(({ kind, description, amount, recurrence }) => ({ kind, description, amount, recurrence })),
      addendum: input.addendum ?? lease.addendum,
    };
    for (const [field, value] of Object.entries({
      rent: next.rent,
      depositAmount: next.depositAmount,
      advanceRentAmount: next.advanceRentAmount,
    })) {
      if (!MONEY.test(value)) return validation(op, field, "an amount like 4500.00");
    }
    const refusal = checkTerms(op, next, input.acknowledgementIds);
    if (refusal) return refusal;
    Object.assign(lease, {
      ...input,
      rent: Number(next.rent).toFixed(2),
      depositAmount: Number(next.depositAmount).toFixed(2),
      advanceRentAmount: Number(next.advanceRentAmount).toFixed(2),
      lines: next.lines.map((line) => ({
        id: crypto.randomUUID(),
        kind: line.kind,
        description: line.description,
        amount: Number(line.amount).toFixed(2),
        recurrence: line.recurrence ?? "monthly",
        effectiveFrom: lease.startDate,
      })),
      addendum: next.addendum,
    });
    delete (lease as { acknowledgementIds?: unknown }).acknowledgementIds;
    lease.version += 1;
    leaseEvent(lease.id, "updated", { fields: Object.keys(input) });
    return etagged(lease);
  }),

  http.post("*/v1/owner/leases/:leaseId/actions/send-for-signature", async ({ request, params }) => {
    const op = "owner.leases.sendForSignature";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return idempotent(request, op, () => {
      if (lease.status !== "draft") return problem(op, "lease.invalid_state");
      const party = w().parties.find((candidate) => candidate.id === lease.lesseePartyId);
      if (party && party.type === "person" && !party.idNumberOnFile)
        return problem(op, "lease.lessee_identity_missing");
      contractSeq += 1;
      lease.status = "pending_signature";
      lease.number = `CT-2569-${String(contractSeq).padStart(5, "0")}`;
      lease.contract = { documentId: crypto.randomUUID(), sha256: "a1".repeat(32), signed: false };
      lease.version += 1;
      sync(lease);
      const unit = w().units.find((candidate) => candidate.id === lease.unitId);
      if (unit && unit.status === "vacant") {
        unit.status = "reserved";
        unit.lesseePartyId = lease.lesseePartyId;
      }
      leaseEvent(lease.id, "sent_for_signature", { number: lease.number });
      return { status: 200, body: lease };
    });
  }),

  http.post("*/v1/owner/leases/:leaseId/actions/countersign", async ({ request, params }) => {
    const op = "owner.leases.countersign";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["CountersignDto"];
      if (lease.status !== "pending_signature") return problem(op, "lease.invalid_state");
      if (!input.signaturePng || input.signaturePng.length < 20) return problem(op, "lease.signature_invalid");
      const signers = lease.parties.filter((party) => party.isSigner);
      if (signers.some((party) => !party.signedAt)) return problem(op, "lease.signatures_missing");
      lease.signatures.push({
        id: crypto.randomUUID(),
        partyId: null,
        signerRole: "lessor",
        method: "draw_web",
        signedAt: iso(),
        otpVerified: false,
        lineLinked: false,
        pdfSha256: lease.contract?.sha256 ?? "",
      });
      lease.status = "active";
      lease.contract = { ...(lease.contract ?? { documentId: crypto.randomUUID(), sha256: "" }), signed: true };
      lease.moveInAt = iso();
      lease.version += 1;
      sync(lease);
      const unit = w().units.find((candidate) => candidate.id === lease.unitId);
      if (unit) {
        unit.status = lease.startDate > day(0) ? "reserved" : "occupied";
        unit.currentLeaseId = lease.id;
        unit.lesseePartyId = lease.lesseePartyId;
        unit.nextActions = [];
      }
      if (!w().deposits.some((deposit) => deposit.leaseId === lease.id)) {
        w().deposits.push({
          id: crypto.randomUUID(),
          leaseId: lease.id,
          leaseNumber: lease.number,
          unitNo: lease.unitNo,
          lesseeName: lease.lesseeName,
          status: "pending",
          amountSecurity: lease.depositAmount,
          amountAdvanceRent: lease.advanceRentAmount,
          carriedFromDepositId: null,
          currency: "THB",
          receiptNumber: null,
          receivedAt: null,
          settlement: null,
          nextActions: ["record-receipt"],
          version: 1,
        });
      }
      leaseEvent(lease.id, "activated", { occupied: lease.startDate <= day(0) });
      return { status: 200, body: lease };
    });
  }),

  http.post("*/v1/owner/leases/:leaseId/actions/cancel", async ({ request, params }) => {
    const op = "owner.leases.cancel";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    const input = await body<Schemas["CancelLeaseDto"]>(request);
    if (!input.cancelReason?.trim()) return validation(op, "cancelReason", "a reason is required");
    if (!["draft", "pending_signature"].includes(lease.status)) return problem(op, "lease.invalid_state");
    lease.status = "cancelled";
    lease.version += 1;
    sync(lease);
    const unit = w().units.find((candidate) => candidate.id === lease.unitId);
    if (unit && unit.status === "reserved" && !unit.currentLeaseId) {
      unit.status = "vacant";
      unit.lesseePartyId = null;
    }
    leaseEvent(lease.id, "cancelled", { reason: input.cancelReason });
    return json(lease);
  }),

  http.post("*/v1/owner/leases/:leaseId/actions/record-notice", async ({ request, params }) => {
    const op = "owner.leases.recordNotice";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    const input = await body<Schemas["RecordNoticeDto"]>(request);
    if (lease.status !== "active") return problem(op, "lease.invalid_state");
    if (!input.effectiveDate) return validation(op, "effectiveDate", "the move-out date is required");
    if (input.by === "lessor" && !input.reasonCode)
      return validation(op, "reasonCode", "a ground is required for a lessor notice");
    const noticeDate = input.noticeDate ?? day(0);
    const days = (Date.parse(input.effectiveDate) - Date.parse(noticeDate)) / 86_400_000;
    if (days < 30) {
      const warning = needsAcknowledgement(
        op,
        input.by === "lessor" ? "compliance.termination_notice" : "compliance.notice_period",
        { by: input.by, noticeDate, effectiveDate: input.effectiveDate, minimumDays: 30, days: Math.round(days) },
        input.acknowledgementIds,
        input.by === "lessor" ? LEGAL_REF.termination : LEGAL_REF.noticePeriod,
      );
      if (warning) return warning;
    }
    lease.status = "notice_given";
    lease.notice = {
      by: input.by,
      givenAt: iso(),
      effectiveDate: input.effectiveDate,
      reasonCode: input.reasonCode ?? null,
      evidenceDocumentIds: input.evidenceDocumentIds ?? [],
    };
    lease.version += 1;
    sync(lease);
    leaseEvent(lease.id, "notice_given", {
      by: input.by,
      effectiveDate: input.effectiveDate,
      reasonCode: input.reasonCode ?? null,
    });
    return json(lease);
  }),

  http.post("*/v1/owner/leases/:leaseId/actions/renew", async ({ request, params }) => {
    const op = "owner.leases.renew";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    if (!["active", "notice_given"].includes(lease.status)) return problem(op, "lease.invalid_state");
    const input = await body<Schemas["RenewLeaseDto"]>(request);
    if (input.rent !== undefined && !MONEY.test(input.rent)) return validation(op, "rent", "an amount like 4500.00");
    const start = new Date(Date.parse(lease.endDate) + 86_400_000).toISOString().slice(0, 10);
    const months = input.months ?? 12;
    const renewal: Schemas["LeaseDto"] = {
      ...structuredClone(lease),
      id: crypto.randomUUID(),
      status: "draft",
      number: null,
      startDate: start,
      endDate: new Date(Date.parse(start) + (months * 30.4375 - 1) * 86_400_000).toISOString().slice(0, 10),
      months,
      rent: input.rent ? Number(input.rent).toFixed(2) : lease.rent,
      advanceRentAmount: "0.00",
      signatures: [],
      parties: lease.parties.map((party) => ({ ...party, signedAt: null })),
      contract: null,
      notice: null,
      termination: null,
      moveInAt: null,
      moveOutAt: null,
      renewedFromLeaseId: lease.id,
      createdAt: iso(),
      version: 1,
      nextActions: [],
    };
    sync(renewal);
    w().leases.push(renewal);
    leaseEvent(lease.id, "renewed", { renewalLeaseId: renewal.id });
    leaseEvent(renewal.id, "drafted", { renewedFromLeaseId: lease.id });
    return json(renewal, 201);
  }),

  http.post("*/v1/owner/leases/:leaseId/actions/terminate", async ({ request, params }) => {
    const op = "owner.leases.terminate";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["TerminateLeaseDto"];
      if (!["active", "notice_given", "ending"].includes(lease.status)) return problem(op, "lease.invalid_state");
      if (!input.reasonCode) return validation(op, "reasonCode", "a ground is required");
      if (!input.effectiveDate) return validation(op, "effectiveDate", "the termination date is required");
      if (input.reasonCode !== "lessee_notice" && input.reasonCode !== "mutual_agreement") {
        const warning = needsAcknowledgement(
          op,
          "compliance.termination_notice",
          {
            reasonCode: input.reasonCode,
            effectiveDate: input.effectiveDate,
            evidence: (input.evidenceDocumentIds ?? []).length,
          },
          input.acknowledgementIds,
          LEGAL_REF.termination,
        );
        if (warning) return warning;
      }
      lease.status = "terminated";
      lease.termination = {
        reasonCode: input.reasonCode,
        terminatedAt: iso(),
        notes: input.notes ?? null,
        evidenceDocumentIds: input.evidenceDocumentIds ?? [],
      };
      lease.moveOutAt = iso();
      lease.version += 1;
      sync(lease);
      endOccupancy(lease);
      leaseEvent(lease.id, "terminated", { reasonCode: input.reasonCode });
      return { status: 200, body: lease };
    });
  }),

  http.post("*/v1/owner/leases/:leaseId/actions/begin-move-out", ({ request, params }) => {
    const op = "owner.leases.beginMoveOut";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    if (!["notice_given", "ending", "active"].includes(lease.status)) return problem(op, "lease.invalid_state");
    lease.status = "ending";
    lease.version += 1;
    lease.nextActions = ["complete-move-out", "terminate"];
    leaseEvent(lease.id, "move_out_started", { trigger: "owner" });
    return json(lease);
  }),

  http.post("*/v1/owner/leases/:leaseId/actions/complete-move-out", async ({ request, params }) => {
    const op = "owner.leases.completeMoveOut";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return idempotent(request, op, () => {
      if (lease.status !== "ending") return problem(op, "lease.invalid_state");
      lease.status = "ended";
      lease.moveOutAt = iso();
      lease.version += 1;
      sync(lease);
      endOccupancy(lease);
      leaseEvent(lease.id, "ended", { moveOutAt: lease.moveOutAt });
      return { status: 200, body: lease };
    });
  }),

  http.get("*/v1/owner/leases/:leaseId/contract", ({ request, params }) => {
    const op = "owner.leases.contract";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    if (!lease.contract) return problem(op, "lease.invalid_state");
    const download = documentDownload(request, lease.contract.documentId, lease.number ?? "");
    return json({
      ...download,
      sha256: lease.contract.sha256,
      signed: lease.contract.signed,
    } satisfies Schemas["ContractDownloadDto"]);
  }),

  http.get("*/v1/owner/leases/:leaseId/contract-preview", ({ request, params }) => {
    const op = "owner.leases.previewContract";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return new Response(placeholderPdf(lease.id), { headers: { "content-type": "application/pdf" } });
  }),

  http.get("*/v1/owner/leases/:leaseId/events", ({ request, params }) => {
    const op = "owner.leases.events";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return json([...(w().leaseEvents.get(lease.id) ?? [])].reverse());
  }),

  http.get("*/v1/owner/leases/:leaseId/invitations", ({ request, params }) => {
    const op = "owner.leases.listInvitations";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    return json(w().leaseInvitations.get(lease.id) ?? []);
  }),

  http.post("*/v1/owner/leases/:leaseId/invitations", async ({ request, params }) => {
    const op = "owner.leases.invite";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = ok.own ? w().leases.find((candidate) => candidate.id === params.leaseId) : undefined;
    if (!lease) return notFound(op);
    if (["cancelled", "ended", "terminated"].includes(lease.status)) return problem(op, "lease.invalid_state");
    const input = await body<Schemas["LeaseInvitationCreateDto"]>(request);
    const partyId = input.partyId ?? lease.lesseePartyId;
    if (!lease.parties.some((party) => party.partyId === partyId))
      return validation(op, "partyId", "not a party of this lease");
    const code = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 6).toUpperCase()).join("-");
    const url = `http://localhost:3300/link?code=${encodeURIComponent(code)}`;
    const invitation: Schemas["LeaseInvitationDto"] = {
      id: crypto.randomUUID(),
      channel: input.channel,
      state: "pending",
      partyId,
      createdAt: iso(),
      expiresAt: iso(14),
      acceptedAt: null,
    };
    w().leaseInvitations.set(lease.id, [...(w().leaseInvitations.get(lease.id) ?? []), invitation]);
    leaseEvent(lease.id, "invitation_created", { channel: input.channel, partyId });
    return json(
      {
        ...invitation,
        code,
        url,
        qrPngDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 280 }),
      } satisfies Schemas["LeaseInvitationCreatedDto"],
      201,
    );
  }),

  http.post("*/v1/owner/compliance-acknowledgements", async ({ request }) => {
    const op = "owner.complianceAcknowledgements.create";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["AcknowledgementCreateDto"]>(request);
    const evaluation = w().evaluations.get(input.evaluationId);
    if (!evaluation) return notFound(op);
    if (!input.legalTextKey || !input.language)
      return validation(op, "legalTextKey", "the warning text key is required");
    w().evaluations.delete(input.evaluationId);
    const acknowledgement: Schemas["AcknowledgementDto"] = {
      id: crypto.randomUUID(),
      ruleId: evaluation.ruleId,
      shown: evaluation.shown,
      subjectId: input.evaluationId,
      subjectType: "compliance_evaluation",
      acknowledgedAt: iso(),
    };
    w().acknowledgements.push(acknowledgement);
    w().received.push({ op, idempotencyKey: null, body: input });
    return json(acknowledgement, 201);
  }),
];

/** The lease ended or was terminated: the unit is vacant again and the deposit settlement opens (D-173, D-177). */
function endOccupancy(lease: Schemas["LeaseDto"]) {
  const unit = w().units.find((candidate) => candidate.id === lease.unitId);
  if (unit && unit.currentLeaseId === lease.id) {
    unit.status = "vacant";
    unit.currentLeaseId = null;
    unit.lesseePartyId = null;
    unit.nextActions = ["set-status"];
  }
  const deposit = w().deposits.find((candidate) => candidate.leaseId === lease.id && candidate.status === "held");
  if (deposit) {
    deposit.status = "settling";
    deposit.settlement = {
      id: crypto.randomUUID(),
      status: "opened",
      depositHeld: deposit.amountSecurity,
      advanceRentUnused: "0.00",
      utilitiesFinal: "0.00",
      deductionsTotal: "0.00",
      proposedRefund: null,
      agreedRefund: null,
      refundAmount: null,
      refundMethod: null,
      refundedAt: null,
      residentResponse: null,
      disputeReason: null,
      disputeDocumentIds: [],
      statementNumber: null,
      isLate: false,
      moveOutAt: lease.moveOutAt ?? iso(),
      deadlineAt: iso(7),
      moveInInspectionId: null,
      moveOutInspectionId: null,
      items: [],
    };
    deposit.version += 1;
  }
}

/** `POST /__mock/owner/leases/{id}/resident-sign` — what the resident's signature in getproperty-liff does. */
export function residentSigns(leaseId: string): boolean {
  const lease = w().leases.find((candidate) => candidate.id === leaseId);
  if (!lease || lease.status !== "pending_signature") return false;
  for (const party of lease.parties) {
    if (!party.isSigner || party.signedAt) continue;
    party.signedAt = iso();
    lease.signatures.push({
      id: crypto.randomUUID(),
      partyId: party.partyId,
      signerRole: party.role === "co_tenant" ? "co_tenant" : "lessee",
      method: "draw_liff",
      signedAt: iso(),
      otpVerified: true,
      lineLinked: true,
      pdfSha256: lease.contract?.sha256 ?? "",
    });
  }
  lease.version += 1;
  sync(lease);
  leaseEvent(lease.id, "signed", { signerRole: "lessee" }, "user");
  return true;
}
