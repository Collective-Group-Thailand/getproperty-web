import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { MOCK_OTP_CODE, OPERATORS, TENANTS } from "../fixtures";
import { issueTokens } from "../handlers/support";
import { state } from "../state";
import { initialJuristicWorld, JP, JURISTIC_TENANT, juristicUnitId, type MockJuristicWorld } from "./juristic";
import {
  allowed,
  body,
  documentDownload,
  idempotent,
  json,
  mutating,
  notFound,
  owner,
  paged,
  problem,
  query,
  record,
  validation,
  type Ok,
} from "./support";

type Schemas = components["schemas"];

/*
 * Money collection of the juristic tenant (pack J, JW1b; api J1.2a + J1.2b at ed938f2), beside the JW1a world:
 * receivables with collection cases and their timelines, the two ladders (condo_act with its surcharge gate open,
 * land_allocation_act all closed — O-038), statements and printed letter batches, payment plans, debt clearance
 * certificates with their public verification codes, auto-pay mandates, the juristic payment settings, the tenant's
 * invoices and hand-recorded payments (allocation with the surcharge part), the D-270 workspace (units a landlord
 * linked, bills to the landlord), the landlord persona's invitations, and the public verify / accept endpoints.
 * Money is summed here (this is the API's side); the console never sums.
 * Controls: `POST /__mock/owner/collections/reset`, `GET /__mock/owner/collections`.
 */

const DAY = 86_400_000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);
const cid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);
const sum = (amounts: string[]) => baht(amounts.reduce((total, amount) => total + satang(amount), 0));
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const LANDLORD_TENANT = TENANTS.landlord.profile.id;
/** The landlord persona's unit in the stub condo "ไอดีโอ โมบิ อารีย์" (portfolio world). */
const STUB_ARI = "6a1f0c3e-2b4d-4e5f-8a9b-0c1d2e3f4a01";
const STUB_ARI_UNIT = "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c01";

/** One account of the receivables list (billed party × unit) with what the mock needs to build its case. */
interface Account {
  row: Schemas["ReceivableRowDto"];
  /** A step was sent (the `at_step` tab). */
  atStep: boolean;
  /** Months of overdue invoices, oldest first: each an invoice of the unit to the party. */
  months: number;
}

export interface MockCollectionsWorld {
  accounts: Account[];
  cases: Schemas["CollectionCaseDto"][];
  ladders: Schemas["CollectionLadderDto"][];
  statements: Schemas["StatementDto"][];
  letterBatches: Schemas["LetterBatchDto"][];
  plans: Schemas["PaymentPlanDto"][];
  clearances: Schemas["DebtClearanceDto"][];
  /** Public verification codes of issued certificates (the API keeps a hash; the mock keeps the code). */
  verifyCodes: Record<string, string>;
  mandates: Schemas["PaymentMandateDto"][];
  settings: Schemas["SettingDto"][];
  invoices: Schemas["InvoiceSummaryDto"][];
  payments: Schemas["PaymentDto"][];
  workspaceUnits: Schemas["WorkspaceUnitDto"][];
  workspaceInvoices: Schemas["InvoiceDto"][];
  invitations: Schemas["WorkspaceInvitationDto"][];
  /** Open invitation codes (the API keeps a hash). */
  invitationCodes: Record<string, string>;
  /** Pending OTP challenges of offices accepting an invitation. */
  challenges: Record<string, string>;
  exportJobs: Schemas["ExportJobDto"][];
}

/**
 * The JW1a world's fixed facts (names, units, buildings) for building this world — read from a fresh copy, so the
 * world can be built while `state` itself is being created. Runtime checks (owners today) read `state.juristic`.
 */
let facts: MockJuristicWorld | null = null;
const fixed = () => (facts ??= initialJuristicWorld());
const party = (partyId: string) => fixed().parties.find((candidate) => candidate.id === partyId);
const partyName = (partyId: string) => party(partyId)?.displayName ?? "—";
const unitOf = (unitId: string) => state.juristic.units.find((candidate) => candidate.dto.id === unitId)?.dto;
const unitAt = (unitIndex: number) => fixed().units[unitIndex - 1]!.dto;

function account(
  n: number,
  unitIndex: number,
  partyId: string,
  outstanding: string,
  surcharge: string,
  months: number,
  patch: Partial<Schemas["ReceivableRowDto"]> & { atStep?: boolean } = {},
): Account {
  const { atStep = false, ...rowPatch } = patch;
  const unitId = juristicUnitId(unitIndex);
  const unitNo = unitAt(unitIndex).unitNo;
  const nextDays = 2 + (n % 9);
  return {
    atStep,
    months,
    row: {
      buildingId: unitAt(unitIndex).buildingId,
      caseId: cid("ca5e0a01", n),
      caseState: "open",
      channels: ["line", "email"],
      context: { ownsUnits: 1, nonResident: false, agent: false },
      daysOverdue: Math.max(1, months * 30 - 10),
      disputeOpen: false,
      nextStep: {
        kind: "remind",
        date: date(nextDays),
        legalReviewRequired: false,
        awaitingApproval: false,
      },
      oldestOverdueMonths: months,
      oldestOverdueOn: date(-Math.max(1, months * 30 - 10)),
      outstanding,
      ownerName: "",
      partyId,
      planId: null,
      surcharge,
      unitId,
      unitNo,
      ...rowPatch,
    },
  };
}

function initialAccounts(): Account[] {
  const locked = (kind: Schemas["CollectionAction"], days: number) => ({
    kind,
    date: date(days),
    legalReviewRequired: true,
    awaitingApproval: false,
  });
  return [
    account(1, 1, JP.sirirat, "54600.00", "2730.00", 5, {
      atStep: true,
      context: { ownsUnits: 2, nonResident: true, agent: false },
      nextStep: { kind: "remind", date: date(3), legalReviewRequired: false, awaitingApproval: false },
    }),
    account(2, 2, JP.thanadol, "46200.00", "3696.00", 14, {
      atStep: true,
      channels: ["line", "letter"],
      context: { ownsUnits: 2, nonResident: false, agent: false },
      nextStep: locked("notice_letter", 6),
    }),
    account(3, 3, JP.wannee, "48000.00", "1920.00", 4, {
      atStep: true,
      planId: cid("91a40a01", 1),
      caseState: "paused",
      nextStep: null,
      context: { ownsUnits: 3, nonResident: false, agent: false },
    }),
    account(4, 4, JP.thanasiri, "108000.00", "12960.00", 18, {
      atStep: true,
      disputeOpen: true,
      caseState: "paused",
      channels: ["email"],
      context: { ownsUnits: 2, nonResident: true, agent: false },
    }),
    account(5, 5, JP.piya, "38400.00", "1536.00", 9, {
      atStep: true,
      channels: ["letter"],
      context: { ownsUnits: 2, nonResident: true, agent: false },
      nextStep: { kind: "lawyer_letter", date: date(-1), legalReviewRequired: false, awaitingApproval: true },
    }),
    account(6, 6, JP.agency, "51200.00", "4096.00", 11, {
      atStep: true,
      channels: ["email", "letter"],
      context: { ownsUnits: 1, nonResident: true, agent: true },
      nextStep: locked("notice_letter", 4),
    }),
    account(7, 7, JP.somporn, "32400.00", "648.00", 2, {
      atStep: true,
      context: { ownsUnits: 2, nonResident: false, agent: false },
    }),
    account(8, 9, JP.kittisak, "18750.00", "0.00", 1, {
      context: { ownsUnits: 2, nonResident: false, agent: false },
      nextStep: { kind: "remind", date: date(1), legalReviewRequired: false, awaitingApproval: false },
    }),
    account(9, 12, JP.pimpan, "12600.00", "0.00", 1, {
      channels: ["line"],
      context: { ownsUnits: 2, nonResident: false, agent: false },
    }),
    account(10, 15, JP.somporn, "9375.00", "0.00", 1, {
      context: { ownsUnits: 2, nonResident: false, agent: false },
      nextStep: { kind: "remind", date: date(8), legalReviewRequired: false, awaitingApproval: false },
    }),
    account(11, 17, JP.wannee, "28800.00", "0.00", 3, {
      atStep: true,
      planId: cid("91a40a01", 2),
      caseState: "paused",
      nextStep: null,
      context: { ownsUnits: 3, nonResident: false, agent: false },
    }),
    account(12, 18, JP.piya, "12500.00", "0.00", 2, {
      atStep: true,
      channels: ["letter"],
      context: { ownsUnits: 2, nonResident: true, agent: false },
      nextStep: locked("notice_letter", 12),
    }),
    account(13, 19, JP.somporn, "7200.00", "0.00", 1, {
      context: { ownsUnits: 2, nonResident: false, agent: false },
    }),
    account(14, 21, JP.pimpan, "6250.00", "0.00", 1, {
      atStep: true,
      planId: cid("91a40a01", 6),
      caseState: "paused",
      nextStep: null,
      channels: ["line"],
      context: { ownsUnits: 2, nonResident: false, agent: false },
    }),
  ].map((entry) => ({ ...entry, row: { ...entry.row, ownerName: partyName(entry.row.partyId) } }));
}

/** The two ladders as the API copies them from its code templates (J1.2b §1) with this tenant's gates. */
function initialLadders(): Schemas["CollectionLadderDto"][] {
  const step = (
    ladder: number,
    seq: number,
    action: Schemas["CollectionAction"],
    offsetDays: number,
    channels: Schemas["CollectionChannel"][],
    gate: string | null,
    enabled: boolean,
  ): Schemas["CollectionStepDto"] => ({
    id: cid(`1add${ladder}a01`, seq),
    seq,
    action,
    offsetDays,
    channels,
    templateKey: `juristic.collection.${action}`,
    requiresApproval: ["suspend_services", "lawyer_letter", "legal_action"].includes(action),
    enabled,
    legalReviewRequired: action !== "remind",
    gateClosedReason: gate,
    version: 1,
  });
  const statutory = (ladder: number, surchargeGate: string | null, surchargeOn: boolean) => [
    step(ladder, 1, "remind", 3, ["line", "email"], null, true),
    step(ladder, 2, "remind", 15, ["line", "email", "sms"], null, true),
    step(ladder, 3, "surcharge", 30, ["line", "email"], surchargeGate, surchargeOn),
    step(ladder, 4, "notice_letter", 45, ["letter", "line", "email"], "letter_wording_unverified", false),
    step(ladder, 5, "remind", 60, ["line", "email"], null, true),
    step(ladder, 6, "lawyer_letter", 90, ["letter", "email"], "letter_wording_unverified", false),
    step(ladder, 7, "suspend_services", 180, ["letter", "line"], "suspend_services_disabled", false),
    step(ladder, 8, "legal_action", 365, ["letter"], "legal_action_disabled", false),
  ];
  return [
    {
      id: cid("1add0a01", 1),
      legalForm: "condo_act",
      name: "ขั้นตอนติดตามยอดค้าง — อาคารชุด",
      sourceTemplateKey: "condo_act",
      // The compliance admin set the condo surcharge cap: the surcharge step is open and on (the rest wait for O-038).
      steps: statutory(1, null, true),
    },
    {
      id: cid("1add0a01", 2),
      legalForm: "land_allocation_act",
      name: "ขั้นตอนติดตามยอดค้าง — หมู่บ้านจัดสรร",
      sourceTemplateKey: "land_allocation_act",
      steps: statutory(2, "surcharge_disabled", false),
    },
  ];
}

function ladderFor(buildingId: string) {
  const legalForm = fixed().buildings.find((b) => b.id === buildingId)?.legalForm ?? "condo_act";
  return w().ladders.find((ladder) => ladder.legalForm === legalForm) ?? w().ladders[0]!;
}

/** A case and its append-only timeline, as the job would have written it for the account. */
function caseOf(entry: Account): Schemas["CollectionCaseDto"] {
  const row = entry.row;
  const ladder = ladderFor(row.buildingId);
  const anchor = row.oldestOverdueOn ?? date(-30);
  const timeline: Schemas["CollectionEventDto"][] = [];
  let n = 0;
  const add = (offsetDays: number, patch: Partial<Schemas["CollectionEventDto"]>) => {
    n += 1;
    timeline.push({
      id: cid(`e7e${String(row.caseId).slice(-3)}a`, n),
      kind: "step",
      action: null,
      outcome: null,
      amount: null,
      documentId: null,
      invoiceChargeId: null,
      reason: null,
      seq: null,
      occurredAt: new Date(Date.parse(`${anchor}T02:00:00Z`) + offsetDays * DAY).toISOString(),
      ...patch,
    });
  };
  add(1, { kind: "opened" });
  const elapsed = entry.months * 30;
  for (const step of ladder.steps) {
    if (step.offsetDays > elapsed) break;
    if (!step.enabled) {
      add(step.offsetDays, {
        action: step.action,
        seq: step.seq,
        outcome: "skipped",
        reason: step.gateClosedReason ?? "disabled",
      });
      continue;
    }
    add(step.offsetDays, {
      action: step.action,
      seq: step.seq,
      outcome: "sent",
      amount: step.action === "surcharge" ? row.surcharge : null,
    });
  }
  if (row.planId) add(Math.min(elapsed, 40), { kind: "paused", reason: "payment_plan" });
  if (row.disputeOpen)
    add(Math.min(elapsed, 60), { kind: "dispute_opened", reason: "เจ้าของโต้แย้งค่าปรับย้อนหลังของปี 2568" });
  if (row.nextStep?.awaitingApproval) add(elapsed, { action: row.nextStep.kind, seq: 6, outcome: "awaiting_approval" });
  const kind = row.nextStep?.kind;
  const next = kind
    ? (ladder.steps.find((step) => step.action === kind && step.offsetDays > elapsed) ??
      [...ladder.steps].reverse().find((step) => step.action === kind))
    : undefined;
  return {
    id: row.caseId!,
    ladderId: ladder.id,
    legalForm: ladder.legalForm,
    partyId: row.partyId,
    partyName: row.ownerName,
    unitId: row.unitId,
    unitNo: row.unitNo,
    anchorOn: anchor,
    openedAt: timeline[0]!.occurredAt,
    state: row.caseState ?? "open",
    planId: row.planId,
    disputeOpenedAt: row.disputeOpen ? timeline.find((e) => e.kind === "dispute_opened")!.occurredAt : null,
    disputeReason: row.disputeOpen ? "เจ้าของโต้แย้งค่าปรับย้อนหลังของปี 2568" : null,
    pausedDays: row.planId || row.disputeOpen ? 12 : 0,
    resolvedAt: null,
    nextStep:
      row.nextStep && next
        ? {
            stepId: next.id,
            seq: next.seq,
            action: row.nextStep.kind,
            dueOn: row.nextStep.date,
            legalReviewRequired: row.nextStep.legalReviewRequired,
            awaitingApproval: row.nextStep.awaitingApproval,
          }
        : null,
    nextActions: caseActions(row),
    timeline,
    version: 1,
  };
}

function caseActions(row: Pick<Schemas["ReceivableRowDto"], "disputeOpen" | "nextStep" | "caseState">) {
  if (row.caseState === "resolved") return [];
  const actions = [row.disputeOpen ? "close_dispute" : "open_dispute"];
  if (row.nextStep?.awaitingApproval) actions.push("approve_step", "refuse_step");
  return actions;
}

/** The open invoices of an account: one per overdue month of common fee (quarterly in advance → a third each). */
function accountInvoices(entry: Account): Schemas["InvoiceSummaryDto"][] {
  const months = Math.max(1, Math.min(entry.months, 4));
  const share = Math.floor(satang(entry.row.outstanding) / months);
  return Array.from({ length: months }, (_, index) => {
    const last = index === months - 1;
    const amount = baht(last ? satang(entry.row.outstanding) - share * (months - 1) : share);
    const start = -((entry.months - index) * 30 + 34);
    const n = Number(entry.row.caseId!.slice(-4)) * 10 + index;
    return {
      id: cid("1a7c0a01", n),
      number: `INV-2569-${String(4100 + n).padStart(6, "0")}`,
      status: "overdue",
      billedPartyId: entry.row.partyId,
      billedPartyName: entry.row.ownerName,
      billingCycleId: null,
      buildingId: entry.row.buildingId,
      unitId: entry.row.unitId,
      unitNo: entry.row.unitNo,
      leaseId: null,
      leaseNumber: null,
      periodStart: date(start),
      periodEnd: date(start + 29),
      issuedAt: iso(start),
      dueDate: date(start + 30),
      subtotal: amount,
      vatAmount: "0.00",
      total: amount,
      amountDue: amount,
      balance: amount,
      paidTotal: "0.00",
      creditedTotal: "0.00",
      debitedTotal: "0.00",
      priorBalance: "0.00",
      complianceFlags: [],
      reviewFlags: [],
      hasAboveCapLine: false,
      hasEstimate: false,
      isFinal: false,
      version: 1,
    };
  });
}

function statementOf(
  n: number,
  partyId: string,
  period: string,
  entries: Account[],
  deliveredVia: string[],
): Schemas["StatementDto"] {
  const invoices = entries.flatMap((entry) => accountInvoices(entry));
  const due = sum(invoices.map((invoice) => invoice.balance));
  const [year, month] = period.split("-").map(Number) as [number, number];
  const periodStart = `${period}-01`;
  const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const charges = sum(
    entries.map((entry) => baht(Math.round(satang(entry.row.outstanding) / Math.max(1, entry.months)))),
  );
  return {
    id: cid("57a70a01", n),
    number: `STM-2026-${String(n).padStart(5, "0")}`,
    period,
    periodStart,
    periodEnd,
    partyId,
    partyName: partyName(partyId),
    units: entries.map((entry) => ({
      id: entry.row.unitId,
      unitNo: entry.row.unitNo,
      building: buildingName(entry.row.buildingId),
    })),
    opening: baht(satang(due) - satang(charges)),
    charges,
    credits: "0.00",
    payments: "0.00",
    closing: due,
    amountDue: due,
    openInvoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      unitNo: invoice.unitNo,
      balance: invoice.balance,
      dueDate: invoice.dueDate,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
    })),
    paymentIds: [],
    deliveredVia,
    documentId: cid("d57a0a01", n),
    letterBatchId: deliveredVia.includes("letter") ? cid("1e77a001", 1) : null,
    language: "th",
    issuedAt: iso(-4),
  };
}

const buildingName = (buildingId: string) =>
  fixed().buildings.find((building) => building.id === buildingId)?.name ?? "—";

function plan(
  n: number,
  entry: Account,
  stateValue: Schemas["PaymentPlanState"],
  count: number,
  paid: number,
  proposedBy: Schemas["PlanProposer"] = "staff",
): Schemas["PaymentPlanDto"] {
  const principal = entry.row.outstanding;
  const each = Math.floor(satang(principal) / count);
  const firstDue = date(-paid * 30 + 10);
  const instalments: Schemas["PaymentPlanInstalmentDto"][] = Array.from({ length: count }, (_, index) => ({
    seq: index + 1,
    dueOn: date(-paid * 30 + 10 + index * 30),
    amount: baht(index === count - 1 ? satang(principal) - each * (count - 1) : each),
    state:
      stateValue === "proposed"
        ? "scheduled"
        : index < paid
          ? "paid"
          : index === paid
            ? "billed"
            : stateValue === "defaulted" || stateValue === "cancelled"
              ? "cancelled"
              : "scheduled",
    paidAt: index < paid ? iso(-paid * 30 + 12 + index * 30) : null,
    invoiceChargeId: index <= paid ? cid("c4a90a01", n * 100 + index) : null,
  }));
  const active = stateValue !== "proposed" && stateValue !== "rejected";
  return {
    id: cid("91a40a01", n),
    partyId: entry.row.partyId,
    partyName: entry.row.ownerName,
    unitId: entry.row.unitId,
    unitNo: entry.row.unitNo,
    state: stateValue,
    proposedBy,
    proposedPrincipal: principal,
    principal: active ? principal : null,
    instalmentCount: count,
    firstDueOn: firstDue,
    instalments: stateValue === "proposed" ? instalments.map((i) => ({ ...i, invoiceChargeId: null })) : instalments,
    invoiceIds: accountInvoices(entry).map((invoice) => invoice.id),
    creditNoteIds: active ? accountInvoices(entry).map((_, index) => cid("c7ed0a01", n * 10 + index)) : [],
    defaultAfterDays: active ? 30 : null,
    approvedAt: active ? iso(-paid * 30 - 5) : null,
    endedAt: stateValue === "completed" || stateValue === "defaulted" ? iso(-3) : null,
    acceleratedChargeId: stateValue === "defaulted" ? cid("c4a90a01", n * 100 + 99) : null,
    decidedReason: null,
    note: proposedBy === "resident" ? "ขอผ่อนเป็นรายเดือนเพราะรายได้ลดลงช่วงนี้" : null,
    nextActions: planActions(stateValue),
    createdAt: iso(-paid * 30 - 8),
    version: 1,
  };
}

function planActions(value: Schemas["PaymentPlanState"]) {
  if (value === "proposed") return ["approve", "reject", "cancel"];
  if (value === "active") return ["cancel"];
  return [];
}

function clearance(
  n: number,
  unitIndex: number,
  partyId: string,
  stateValue: Schemas["DebtClearanceState"],
  patch: Partial<Schemas["DebtClearanceDto"]> = {},
): Schemas["DebtClearanceDto"] {
  const unit = unitAt(unitIndex);
  return {
    id: cid("dc1a0a01", n),
    unitId: unit.id,
    unitNo: unit.unitNo,
    partyId,
    partyName: partyName(partyId),
    state: stateValue,
    asOf: date(stateValue === "requested" ? 0 : -10),
    fee: "200.00",
    number: stateValue === "issued" ? `DCL-2026-${String(n).padStart(5, "0")}` : null,
    issuedAt: stateValue === "issued" ? iso(-10) : null,
    validUntil: stateValue === "issued" ? date(20) : null,
    documentId: stateValue === "issued" ? cid("d0c1a001", n) : null,
    refuseReason: stateValue === "refused" ? "ค่าธรรมเนียมยังไม่ได้ชำระภายใน 30 วัน" : null,
    requestedVia: n % 2 ? "liff" : "web",
    language: "th",
    verifyCode: null,
    verifyCodeHint: stateValue === "issued" ? `••••${String(n).padStart(4, "0").slice(-4)}` : null,
    nextActions: stateValue === "requested" ? ["issue", "refuse"] : [],
    createdAt: iso(stateValue === "requested" ? -2 : -12),
    ...patch,
  };
}

function settingsList(): Schemas["SettingDto"][] {
  const s = (
    key: string,
    value: Schemas["SettingDto"]["value"],
    valueType: Schemas["SettingValueType"],
    description: string,
    scope: Schemas["SettingScope"] = "platform",
  ): Schemas["SettingDto"] => ({
    key,
    value,
    valueType,
    description,
    scope,
    scopeAllowed: ["platform", "tenant"],
    editable: true,
    effectiveFrom: iso(-60),
  });
  return [
    s("payments.allocation_policy", "oldest_first", "string", "How a payment is spread over open invoices (D-308)"),
    s("payments.allow_partial", true, "bool", "Partial payments (D-044)", "tenant"),
    s("payments.slip_max_age_days", 30, "int", "Slip date window in days (D-325)"),
    s("juristic.plan_default_days", 30, "int", "Days after an instalment's due date before a plan defaults (D-308)"),
    s("juristic.plan_max_instalments", 12, "int", "The most monthly instalments of a plan (D-325)"),
    s("juristic.debt_clearance.fee", "200.00", "money", "Fee of a debt clearance certificate (D-306)", "tenant"),
    s("juristic.debt_clearance.validity_days", 30, "int", "Days a certificate stays valid (D-306)"),
  ];
}

function mandate(
  n: number,
  entry: { unitIndex: number; partyId: string },
  value: Schemas["PaymentMandateState"],
  patch: Partial<Schemas["PaymentMandateDto"]> = {},
): Schemas["PaymentMandateDto"] {
  const unit = unitAt(entry.unitIndex);
  return {
    id: cid("3a4d0a01", n),
    unitId: unit.id,
    unitNo: unit.unitNo,
    partyId: entry.partyId,
    method: n % 2 ? "direct_debit" : "card_token",
    provider: "fake",
    masked: n % 2 ? `KBANK •••• ${String(4410 + n)}` : `VISA •••• ${String(8800 + n)}`,
    scope: n === 2 ? "all_invoices" : "advance_invoices",
    state: value,
    activatedAt: value === "pending" ? null : iso(-80 + n),
    endedAt: value === "revoked" || value === "failed" ? iso(-5) : null,
    endReason:
      value === "revoked" ? "เจ้าของขอยกเลิกทางโทรศัพท์" : value === "failed" ? "ธนาคารปฏิเสธการตัดบัญชี" : null,
    createdAt: iso(-90 + n),
    ...patch,
  };
}

export function initialCollectionsWorld(): MockCollectionsWorld {
  const accounts = initialAccounts();
  const byNo = (unitIndex: number) => accounts.find((entry) => entry.row.unitId === juristicUnitId(unitIndex))!;
  const lastMonth = date(-31).slice(0, 7);
  const world: MockCollectionsWorld = {
    accounts,
    cases: [],
    ladders: initialLadders(),
    statements: [],
    letterBatches: [],
    plans: [],
    clearances: [],
    verifyCodes: {},
    mandates: [],
    settings: settingsList(),
    invoices: accounts.flatMap((entry) => accountInvoices(entry)),
    payments: [],
    workspaceUnits: [
      {
        unitId: STUB_ARI_UNIT,
        unitNo: "12/345",
        buildingId: STUB_ARI,
        buildingName: "ไอดีโอ โมบิ อารีย์",
        landlordName: "มาลี มีสุข",
        landlordPartyId: cid("1a4d0a01", 1),
        linkedAt: iso(-20),
      },
      {
        unitId: cid("7b2e1d4f", 9),
        unitNo: "15/1502",
        buildingId: STUB_ARI,
        buildingName: "ไอดีโอ โมบิ อารีย์",
        landlordName: "บจก. ชัยพฤกษ์ แอสเซท",
        landlordPartyId: cid("1a4d0a01", 2),
        linkedAt: iso(-8),
      },
    ],
    workspaceInvoices: [],
    invitations: [],
    invitationCodes: {},
    challenges: {},
    exportJobs: [],
  };
  // Statements of last month: two owners of two units, one paper-only owner, one company.
  world.statements = [
    statementOf(41, JP.sirirat, lastMonth, [byNo(1)], ["line", "email"]),
    statementOf(42, JP.thanadol, lastMonth, [byNo(2)], ["line"]),
    statementOf(43, JP.piya, lastMonth, [byNo(5), byNo(18)], ["letter"]),
    statementOf(44, JP.somporn, lastMonth, [byNo(7), byNo(15), byNo(19)], ["line", "email"]),
    statementOf(45, JP.thanasiri, lastMonth, [byNo(4)], ["email"]),
  ];
  world.letterBatches = [
    {
      id: cid("1e77a001", 1),
      period: lastMonth,
      state: "ready",
      statementIds: [cid("57a70a01", 43)],
      documentId: cid("d1e7a001", 1),
      error: null,
      requestedAt: iso(-4),
      finishedAt: iso(-4),
    },
  ];
  world.plans = [
    plan(1, byNo(3), "active", 6, 3),
    plan(2, byNo(17), "active", 4, 1),
    plan(3, byNo(7), "proposed", 6, 0, "resident"),
    plan(4, byNo(9), "completed", 3, 3),
    plan(5, byNo(12), "defaulted", 6, 2),
    plan(6, byNo(21), "active", 3, 1),
  ];
  world.plans[3]!.instalments.forEach((instalment) => {
    instalment.state = "paid";
    instalment.paidAt ??= iso(-10);
  });
  world.clearances = [
    clearance(1, 1, JP.sirirat, "requested"),
    clearance(2, 13, JP.wannee, "requested", { requestedVia: "liff" }),
    clearance(3, 14, JP.thanasiri, "issued"),
    clearance(4, 10, JP.piya, "issued"),
    clearance(5, 11, JP.thanadol, "refused"),
  ];
  world.verifyCodes = { K7Q2M9XA: cid("dc1a0a01", 3), P4R8T2WE: cid("dc1a0a01", 4) };
  world.mandates = [
    mandate(1, { unitIndex: 8, partyId: JP.sirirat }, "active"),
    mandate(2, { unitIndex: 13, partyId: JP.wannee }, "active"),
    mandate(3, { unitIndex: 10, partyId: JP.piya }, "pending"),
    mandate(4, { unitIndex: 14, partyId: JP.thanasiri }, "revoked"),
    mandate(5, { unitIndex: 22, partyId: JP.piya }, "failed"),
  ];
  world.workspaceInvoices = [workspaceInvoice(1, world.workspaceUnits[0]!, "4500.00", "ค่าส่วนกลาง ต.ค. 2569", -35)];
  world.invitations = [
    {
      id: cid("1ac70a01", 1),
      buildingId: STUB_ARI,
      unitIds: [STUB_ARI_UNIT],
      officeName: "นิติบุคคลอาคารชุด ไอดีโอ โมบิ อารีย์",
      state: "active",
      code: null,
      codeHint: "••••7Q",
      url: null,
      expiresAt: iso(-6),
      acceptedAt: iso(-20),
      revokedAt: null,
      createdAt: iso(-22),
    },
  ];
  world.invitationCodes = { JW7KQ2M9XA: "preview" };
  return world;
}

function workspaceInvoice(
  n: number,
  unit: Schemas["WorkspaceUnitDto"],
  amount: string,
  description: string,
  offsetDays: number,
): Schemas["InvoiceDto"] {
  return {
    id: cid("1a7d0a01", n),
    number: `INV-2569-${String(9000 + n).padStart(6, "0")}`,
    status: offsetDays < -30 ? "paid" : "issued",
    billedPartyId: unit.landlordPartyId,
    billedPartyName: unit.landlordName,
    billingCycleId: null,
    buildingId: unit.buildingId,
    unitId: unit.unitId,
    unitNo: unit.unitNo,
    leaseId: null,
    leaseNumber: null,
    periodStart: date(offsetDays - 29),
    periodEnd: date(offsetDays),
    issuedAt: iso(offsetDays),
    dueDate: date(offsetDays + 15),
    subtotal: amount,
    vatAmount: "0.00",
    total: amount,
    amountDue: amount,
    balance: offsetDays < -30 ? "0.00" : amount,
    paidTotal: offsetDays < -30 ? amount : "0.00",
    creditedTotal: "0.00",
    debitedTotal: "0.00",
    priorBalance: "0.00",
    complianceFlags: [],
    reviewFlags: [],
    hasAboveCapLine: false,
    hasEstimate: false,
    isFinal: false,
    version: 1,
    lines: [
      {
        id: cid("11e0a001", n),
        lineNo: 1,
        lineKind: "common_fee",
        sourceType: "common_fee",
        description,
        quantity: "1",
        unitPrice: amount,
        amount,
        unit: null,
        units: null,
        aboveCap: false,
        capPerUnit: null,
        complianceAcknowledgementId: null,
        isEstimated: false,
        meterSegments: [],
        periodFrom: date(offsetDays - 29),
        periodTo: date(offsetDays),
        proRata: null,
        ratePlanVersionId: null,
        readingSource: null,
        registerFrom: null,
        registerTo: null,
        tierBreakdown: null,
        utilityTariffVersionId: null,
        vatApplicable: false,
      },
    ],
    creditNotes: [],
    debitNotes: [],
    nextActions: [],
    promptpayRef: null,
    qrPayload: null,
    replacedByInvoiceId: null,
    replacesInvoiceId: null,
    snapshotSha256: null,
    voidReason: null,
    voidedAt: null,
  };
}

const w = () => state.collections;
const juristicOnly = (ok: Ok) => ok.tenantId === JURISTIC_TENANT;
const randomCode = (length: number) =>
  Array.from({ length }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

function rows(request: Request) {
  const params = query(request);
  const tab = (params.get("tab") ?? "all") as Schemas["ReceivablesTab"];
  const q = params.get("q")?.trim().toLowerCase();
  const buildingId = params.get("buildingId");
  const sort = params.get("sort") === "age" ? "age" : "amount";
  const direction = params.get("order") === "asc" ? 1 : -1;
  return w()
    .accounts.filter((entry) => {
      if (buildingId && entry.row.buildingId !== buildingId) return false;
      if (tab === "at_step" && !entry.atStep) return false;
      if (tab === "plan" && !entry.row.planId) return false;
      if (tab === "dispute" && !entry.row.disputeOpen) return false;
      if (q && !`${entry.row.unitNo} ${entry.row.ownerName}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) =>
      sort === "age"
        ? direction * (a.row.daysOverdue - b.row.daysOverdue)
        : direction * (satang(a.row.outstanding) - satang(b.row.outstanding)),
    )
    .map((entry) => entry.row);
}

function caseById(caseId: string) {
  const entry = w().accounts.find((candidate) => candidate.row.caseId === caseId);
  if (!entry) return null;
  let found = w().cases.find((candidate) => candidate.id === caseId);
  if (!found) {
    found = caseOf(entry);
    w().cases.push(found);
  }
  return { entry, found };
}

function event(found: Schemas["CollectionCaseDto"], patch: Partial<Schemas["CollectionEventDto"]>) {
  found.timeline.push({
    id: crypto.randomUUID(),
    kind: "step",
    action: null,
    outcome: null,
    amount: null,
    documentId: null,
    invoiceChargeId: null,
    reason: null,
    seq: null,
    occurredAt: new Date().toISOString(),
    ...patch,
  });
  found.version += 1;
}

/** The aging of the accounts above (J1.2b §4 buckets 0–30 · 31–90 · 91–365 · > 365), so every page agrees. */
function agingOf(accounts: Account[]) {
  const bounds: [string, number, number | null][] = [
    ["0-30", 0, 30],
    ["31-90", 31, 90],
    ["91-365", 91, 365],
    ["365+", 366, null],
  ];
  const count = (list: Account[]) => ({
    accounts: list.length,
    invoices: list.reduce((total, entry) => total + Math.max(1, Math.min(entry.months, 4)), 0),
    amount: sum(list.map((entry) => entry.row.outstanding)),
  });
  const buckets = (list: Account[]) =>
    bounds.map(([key, fromDays, toDays]) => ({
      key,
      fromDays,
      toDays,
      ...count(list.filter((e) => e.row.daysOverdue >= fromDays && (toDays === null || e.row.daysOverdue <= toDays))),
    }));
  const notDue = (n: number) => ({ accounts: n, invoices: n, amount: baht(n * 312500) });
  return {
    asOf: date(),
    bounds: [30, 90, 365],
    overall: { buckets: buckets(accounts), notDue: notDue(118), overdue: count(accounts) },
    buildings: fixed().buildings.map((building) => {
      const list = accounts.filter((entry) => entry.row.buildingId === building.id);
      return {
        buildingId: building.id,
        name: building.name,
        buckets: buckets(list),
        notDue: notDue(building.id === fixed().buildings[0]!.id ? 96 : 11),
        overdue: count(list),
      };
    }),
  } satisfies Schemas["JuristicAgingDto"];
}

const receivableHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/reports/aging", ({ request }) => {
    const ok = owner(request, "owner.juristicReports.aging");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const buildingId = query(request).get("buildingId");
    return json(agingOf(w().accounts.filter((entry) => !buildingId || entry.row.buildingId === buildingId)));
  }),
  http.get("*/v1/owner/juristic/receivables", ({ request }) => {
    const ok = owner(request, "owner.juristicReceivables.list");
    if (ok instanceof Response) return ok;
    const list = juristicOnly(ok) ? rows(request) : [];
    return json({
      ...paged(list, request),
      totals: {
        outstanding: sum(list.map((row) => row.outstanding)),
        surcharge: sum(list.map((row) => row.surcharge)),
      },
    } satisfies Schemas["ReceivablesPageDto"]);
  }),
  http.post("*/v1/owner/juristic/receivables/exports", async ({ request }) => {
    const op = "owner.juristicReceivables.export";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (payload) => {
      const job: Schemas["ExportJobDto"] = {
        id: crypto.randomUUID(),
        kind: "juristic_receivables_csv",
        status: "done",
        buildingId: (payload.buildingId as string | undefined) ?? null,
        params: {},
        requestedAt: iso(),
        finishedAt: iso(),
        rowCount: rows(new Request(`http://x/?${new URLSearchParams(payload as Record<string, string>)}`)).length,
        error: null,
        download: null,
        version: 1,
      };
      w().exportJobs.unshift(job);
      job.status = "done";
      job.download = { url: `${new URL(request.url).origin}/__files/pdf-${job.id}`, expiresAt: iso(1 / 288) };
      return { status: 202, body: job };
    });
  }),
  http.get("*/v1/owner/juristic/collection-cases", ({ request }) => {
    const ok = owner(request, "owner.juristicCollectionCases.list");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const params = query(request);
    const list = w()
      .accounts.map((entry) => caseById(entry.row.caseId!)!.found)
      .filter((found) => !params.get("unitId") || found.unitId === params.get("unitId"))
      .filter((found) => !params.get("partyId") || found.partyId === params.get("partyId"))
      .filter((found) => !params.get("state") || found.state === params.get("state"));
    return json(paged(list, request));
  }),
  http.get("*/v1/owner/juristic/collection-cases/:caseId", ({ request, params }) => {
    const op = "owner.juristicCollectionCases.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const hit = juristicOnly(ok) ? caseById(String(params.caseId)) : null;
    return hit ? json(hit.found) : notFound(op);
  }),
  ...(["open-dispute", "close-dispute", "approve-step", "refuse-step"] as const).map((action) =>
    http.post(`*/v1/owner/juristic/collection-cases/:caseId/actions/${action}`, async ({ request, params }) => {
      const op = {
        "open-dispute": "owner.juristicCollectionCases.openDispute",
        "close-dispute": "owner.juristicCollectionCases.closeDispute",
        "approve-step": "owner.juristicCollectionCases.approveStep",
        "refuse-step": "owner.juristicCollectionCases.refuseStep",
      }[action];
      const ok = mutating(request, op);
      if (ok instanceof Response) return ok;
      const hit = juristicOnly(ok) ? caseById(String(params.caseId)) : null;
      if (!hit) return notFound(op);
      const permission = action.endsWith("step") ? "juristic.collections.approve" : "juristic.collections.manage";
      const forbidden = allowed(ok, op, permission);
      if (forbidden) return forbidden;
      return idempotent(request, op, (payload) => {
        const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
        const { entry, found } = hit;
        const row = entry.row;
        if (action !== "approve-step" && reason.length < 3) return validation(op, "reason", "a reason is required");
        if (action === "open-dispute") {
          if (row.disputeOpen || found.state === "resolved") return problem(op, "collections.invalid_state");
          row.disputeOpen = true;
          row.caseState = "paused";
          found.state = "paused";
          found.disputeOpenedAt = iso();
          found.disputeReason = reason;
          event(found, { kind: "dispute_opened", reason });
        } else if (action === "close-dispute") {
          if (!row.disputeOpen) return problem(op, "collections.invalid_state");
          row.disputeOpen = false;
          row.caseState = row.planId ? "paused" : "open";
          found.state = row.caseState;
          found.disputeOpenedAt = null;
          found.disputeReason = null;
          event(found, { kind: "dispute_closed", reason });
          if (!row.planId) event(found, { kind: "resumed" });
        } else {
          if (!found.nextStep?.awaitingApproval) return problem(op, "collections.no_pending_approval");
          const step = found.nextStep;
          event(found, {
            action: step.action,
            seq: step.seq,
            outcome: action === "approve-step" ? "approved" : "refused",
            reason: reason || null,
          });
          if (action === "approve-step")
            event(found, {
              action: step.action,
              seq: step.seq,
              outcome: step.legalReviewRequired ? "skipped" : "sent",
            });
          found.nextStep = null;
          row.nextStep = { kind: "remind", date: date(10), legalReviewRequired: false, awaitingApproval: false };
        }
        found.nextActions = caseActions(row);
        return { status: 200, body: found };
      });
    }),
  ),
];

const ladderHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/collection-ladders", ({ request }) => {
    const ok = owner(request, "owner.juristicCollectionLadders.list");
    if (ok instanceof Response) return ok;
    return json({ items: juristicOnly(ok) ? w().ladders : [] } satisfies Schemas["CollectionLadderListDto"]);
  }),
  http.patch("*/v1/owner/juristic/collection-ladders/:ladderId/steps/:stepId", async ({ request, params }) => {
    const op = "owner.juristicCollectionLadders.updateStep";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const ladder = juristicOnly(ok) ? w().ladders.find((candidate) => candidate.id === params.ladderId) : undefined;
    const index = ladder?.steps.findIndex((candidate) => candidate.id === params.stepId) ?? -1;
    if (!ladder || index < 0) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.collections.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["CollectionStepUpdateDto"]>(request);
    record(op, request, input);
    const step = ladder.steps[index]!;
    const previous = ladder.steps[index - 1];
    const next = ladder.steps[index + 1];
    if (input.offsetDays !== undefined) {
      if (!Number.isInteger(input.offsetDays) || input.offsetDays < 0 || input.offsetDays > 3650)
        return validation(op, "offsetDays", "whole days 0–3650", "range");
      if ((previous && input.offsetDays <= previous.offsetDays) || (next && input.offsetDays >= next.offsetDays))
        return validation(op, "offsetDays", "after the previous step and before the next one", "order");
    }
    if (input.requiresApproval === false && ["suspend_services", "lawyer_letter", "legal_action"].includes(step.action))
      return problem(op, "collections.approval_required");
    if (input.enabled === true && !step.enabled && step.gateClosedReason)
      return problem(op, "collections.legal_review_required");
    Object.assign(step, {
      ...(input.offsetDays !== undefined ? { offsetDays: input.offsetDays } : {}),
      ...(input.channels ? { channels: [...new Set(input.channels)] } : {}),
      ...(input.requiresApproval !== undefined ? { requiresApproval: input.requiresApproval } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      version: step.version + 1,
    });
    return json(ladder);
  }),
];

function payStatementInvoices(
  statement: Schemas["StatementDto"],
  amount: string,
  payment: Partial<Schemas["PaymentDto"]>,
) {
  let left = satang(amount);
  const slices: Schemas["StatementPaymentSliceDto"][] = [];
  const byUnit = new Map<
    string,
    { allocations: Schemas["PaymentAllocationDto"][]; total: number; unitId: string | null }
  >();
  for (const open of [...statement.openInvoices].sort((a, b) => a.periodStart.localeCompare(b.periodStart))) {
    if (left <= 0) break;
    const take = Math.min(left, satang(open.balance));
    left -= take;
    const invoice = w().invoices.find((candidate) => candidate.id === open.id);
    const key = open.unitNo ?? "—";
    const slot = byUnit.get(key) ?? { allocations: [], total: 0, unitId: invoice?.unitId ?? null };
    slot.total += take;
    slot.allocations.push({
      invoiceId: open.id,
      invoiceNumber: open.number,
      amount: baht(take),
      surchargeAmount: "0.00",
      reversedAt: null,
    });
    byUnit.set(key, slot);
    open.balance = baht(satang(open.balance) - take);
    if (invoice) {
      invoice.balance = open.balance;
      invoice.paidTotal = baht(satang(invoice.paidTotal) + take);
      invoice.status = satang(invoice.balance) === 0 ? "paid" : "partially_paid";
    }
  }
  for (const [unitNo, slot] of byUnit) {
    const created = paymentDto(
      statement.partyId,
      statement.partyName,
      slot.unitId,
      unitNo,
      slot.allocations,
      baht(slot.total),
      payment,
    );
    w().payments.unshift(created);
    slices.push({ paymentId: created.id, unitId: slot.unitId, amount: created.amount });
  }
  statement.openInvoices = statement.openInvoices.filter((open) => satang(open.balance) > 0);
  statement.payments = baht(satang(statement.payments) + satang(amount));
  statement.amountDue = baht(Math.max(0, satang(statement.amountDue) - satang(amount)));
  statement.paymentIds = [...statement.paymentIds, ...slices.map((slice) => slice.paymentId)];
  return slices;
}

function paymentDto(
  partyId: string,
  payerName: string,
  unitId: string | null,
  unitNo: string | null,
  allocations: Schemas["PaymentAllocationDto"][],
  amount: string,
  patch: Partial<Schemas["PaymentDto"]>,
): Schemas["PaymentDto"] {
  return {
    id: crypto.randomUUID(),
    amount,
    allocatedTotal: amount,
    allocations,
    creditedAmount: "0.00",
    method: "bank_transfer_manual",
    status: "confirmed",
    confirmedAt: iso(),
    confirmedVia: "manual",
    paidAt: iso(),
    payerName,
    payerPartyId: partyId,
    unitId,
    unitNo,
    invoiceId: allocations[0]?.invoiceId ?? null,
    evidenceDocumentId: null,
    notes: null,
    heldReason: null,
    dismissReason: null,
    dismissedAt: null,
    duplicateOfPaymentId: null,
    provider: null,
    providerRef: null,
    receipts: [{ id: crypto.randomUUID(), kind: "payment", number: `RC-2569-${randomCode(5)}`, voided: false }],
    reconciledAt: null,
    reverseReason: null,
    reversedAt: null,
    slipReviewId: null,
    whtAmount: "0.00",
    nextActions: [],
    version: 1,
    ...patch,
  };
}

function manualRule(
  op: string,
  input: { evidenceDocumentId?: string; notes?: string; amount?: string; paidAt?: string },
) {
  if (!MONEY.test(input.amount ?? "") || satang(input.amount!) <= 0)
    return validation(op, "amount", "an amount above 0.00");
  if (!input.paidAt) return validation(op, "paidAt", "when the money was received");
  // Juristic tenants (J1.2a §2): evidence and a note of at least five characters for every manual payment.
  if (!input.evidenceDocumentId) return validation(op, "evidenceDocumentId", "evidence is required");
  if ((input.notes ?? "").trim().length < 5) return validation(op, "notes", "at least 5 characters");
  return null;
}

const statementHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/statements", ({ request }) => {
    const ok = owner(request, "owner.juristicStatements.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.trim().toLowerCase();
    const list = (juristicOnly(ok) ? w().statements : [])
      .filter((statement) => !params.get("period") || statement.period === params.get("period"))
      .filter((statement) => !params.get("partyId") || statement.partyId === params.get("partyId"))
      .filter(
        (statement) =>
          !q ||
          `${statement.number} ${statement.partyName} ${statement.units.map((u) => u.unitNo).join(" ")}`
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => b.period.localeCompare(a.period) || b.number.localeCompare(a.number));
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/juristic/statements/actions/issue", async ({ request }) => {
    const op = "owner.juristicStatements.issue";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    return idempotent(request, op, (payload) => {
      const period = String(payload.period ?? "");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return validation(op, "period", "YYYY-MM");
      const parties = [...new Set(w().accounts.map((entry) => entry.row.partyId))];
      let skipped = 0;
      const issued: Schemas["StatementDto"][] = [];
      for (const partyId of parties) {
        if (w().statements.some((statement) => statement.partyId === partyId && statement.period === period)) {
          skipped += 1;
          continue;
        }
        const entries = w().accounts.filter((entry) => entry.row.partyId === partyId);
        const p = party(partyId);
        const via = p?.lineLinked ? ["line"] : p?.email ? ["email"] : p?.phoneMasked ? ["sms"] : ["letter"];
        const statement = statementOf(100 + w().statements.length, partyId, period, entries, via);
        statement.issuedAt = iso();
        w().statements.push(statement);
        issued.push(statement);
      }
      return { status: 200, body: { issued, skipped } satisfies Schemas["StatementIssueResultDto"] };
    });
  }),
  http.get("*/v1/owner/juristic/statements/:statementId", ({ request, params }) => {
    const op = "owner.juristicStatements.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const statement = juristicOnly(ok) ? w().statements.find((s) => s.id === params.statementId) : undefined;
    return statement ? json(statement) : notFound(op);
  }),
  http.get("*/v1/owner/juristic/statements/:statementId/document", ({ request, params }) => {
    const op = "owner.juristicStatements.document";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const statement = juristicOnly(ok) ? w().statements.find((s) => s.id === params.statementId) : undefined;
    if (!statement) return notFound(op);
    return json(documentDownload(request, statement.documentId ?? statement.id, statement.number));
  }),
  http.post("*/v1/owner/juristic/statements/:statementId/payments", async ({ request, params }) => {
    const op = "owner.juristicStatements.pay";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const statement = juristicOnly(ok) ? w().statements.find((s) => s.id === params.statementId) : undefined;
    if (!statement) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["StatementPaymentCreateDto"];
      const refused = manualRule(op, input);
      if (refused) return refused;
      if (statement.openInvoices.length === 0) return problem(op, "statement.nothing_due");
      const slices = payStatementInvoices(statement, input.amount, {
        method: input.method,
        paidAt: input.paidAt,
        notes: input.notes ?? null,
        evidenceDocumentId: input.evidenceDocumentId ?? null,
        providerRef: input.reference ?? null,
      });
      return { status: 201, body: { statement, payments: slices } satisfies Schemas["StatementPaymentResultDto"] };
    });
  }),
  http.get("*/v1/owner/juristic/letter-batches", ({ request }) => {
    const ok = owner(request, "owner.juristicLetterBatches.list");
    if (ok instanceof Response) return ok;
    const list = juristicOnly(ok)
      ? [...w().letterBatches].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      : [];
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/juristic/letter-batches", async ({ request }) => {
    const op = "owner.juristicLetterBatches.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    return idempotent(request, op, (payload) => {
      const period = String(payload.period ?? "");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return validation(op, "period", "YYYY-MM");
      const paper = w().statements.filter((s) => s.period === period && s.deliveredVia.includes("letter"));
      const batch: Schemas["LetterBatchDto"] = {
        id: crypto.randomUUID(),
        period,
        state: paper.length ? "ready" : "failed",
        statementIds: paper.map((s) => s.id),
        documentId: paper.length ? crypto.randomUUID() : null,
        error: paper.length ? null : "ไม่มีใบแจ้งยอดของเดือนนี้ที่ต้องส่งทางไปรษณีย์",
        requestedAt: iso(),
        finishedAt: iso(),
      };
      w().letterBatches.push(batch);
      return { status: 202, body: batch };
    });
  }),
  http.get("*/v1/owner/juristic/letter-batches/:batchId", ({ request, params }) => {
    const op = "owner.juristicLetterBatches.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const batch = juristicOnly(ok) ? w().letterBatches.find((b) => b.id === params.batchId) : undefined;
    return batch ? json(batch) : notFound(op);
  }),
  http.get("*/v1/owner/juristic/letter-batches/:batchId/document", ({ request, params }) => {
    const op = "owner.juristicLetterBatches.document";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const batch = juristicOnly(ok) ? w().letterBatches.find((b) => b.id === params.batchId) : undefined;
    if (!batch) return notFound(op);
    if (!batch.documentId) return problem(op, "statement.document_pending");
    return json(documentDownload(request, batch.documentId, `LTR-${batch.period}`));
  }),
];

const planHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/payment-plans", ({ request }) => {
    const ok = owner(request, "owner.juristicPaymentPlans.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.trim().toLowerCase();
    const list = (juristicOnly(ok) ? w().plans : [])
      .filter((p) => !params.get("state") || p.state === params.get("state"))
      .filter((p) => !params.get("unitId") || p.unitId === params.get("unitId"))
      .filter((p) => !params.get("partyId") || p.partyId === params.get("partyId"))
      .filter((p) => !q || `${p.unitNo} ${p.partyName}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/juristic/payment-plans", async ({ request }) => {
    const op = "owner.juristicPaymentPlans.propose";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.collections.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["PaymentPlanCreateDto"];
      const max = Number(w().settings.find((s) => s.key === "juristic.plan_max_instalments")?.value ?? 12);
      if (!Number.isInteger(input.instalments) || input.instalments < 2 || input.instalments > max)
        return validation(op, "instalments", `2–${max} instalments`);
      const entry = w().accounts.find((a) => a.row.unitId === input.unitId && a.row.partyId === input.partyId);
      if (!entry || satang(entry.row.outstanding) === 0) return problem(op, "payment_plan.nothing_due");
      if (
        w().plans.some(
          (p) => p.unitId === input.unitId && p.partyId === input.partyId && ["proposed", "active"].includes(p.state),
        )
      )
        return problem(op, "payment_plan.open_exists");
      const created = plan(200 + w().plans.length, entry, "proposed", input.instalments, 0);
      created.id = crypto.randomUUID();
      created.note = input.note ?? null;
      created.createdAt = iso();
      if (input.firstDueOn) {
        created.firstDueOn = input.firstDueOn;
        created.instalments.forEach((instalment, index) => {
          const [y, m, d] = input.firstDueOn!.split("-").map(Number) as [number, number, number];
          instalment.dueOn = new Date(Date.UTC(y, m - 1 + index, d)).toISOString().slice(0, 10);
        });
      }
      w().plans.push(created);
      return { status: 201, body: created };
    });
  }),
  http.get("*/v1/owner/juristic/payment-plans/:planId", ({ request, params }) => {
    const op = "owner.juristicPaymentPlans.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().plans.find((p) => p.id === params.planId) : undefined;
    return found ? json(found) : notFound(op);
  }),
  ...(["approve", "reject", "cancel"] as const).map((action) =>
    http.post(`*/v1/owner/juristic/payment-plans/:planId/actions/${action}`, async ({ request, params }) => {
      const op = `owner.juristicPaymentPlans.${action}`;
      const ok = mutating(request, op);
      if (ok instanceof Response) return ok;
      const found = juristicOnly(ok) ? w().plans.find((p) => p.id === params.planId) : undefined;
      if (!found) return notFound(op);
      const forbidden = allowed(
        ok,
        op,
        action === "approve" ? "juristic.payment_plan.approve" : "juristic.collections.manage",
      );
      if (forbidden) return forbidden;
      const decide = (payload: Record<string, unknown>): { status: number; body: unknown } | Response => {
        const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
        if (action !== "approve" && reason.length < 3) return validation(op, "reason", "a reason is required");
        if (action === "approve" || action === "reject") {
          if (found.state !== "proposed") return problem(op, "payment_plan.invalid_state");
        } else if (found.state !== "proposed" && found.state !== "active")
          return problem(op, "payment_plan.invalid_state");
        if (action === "approve") {
          found.state = "active";
          found.principal = found.proposedPrincipal;
          found.approvedAt = iso();
          found.defaultAfterDays = 30;
          found.creditNoteIds = found.invoiceIds.map(() => crypto.randomUUID());
          const entry = w().accounts.find((a) => a.row.unitId === found.unitId && a.row.partyId === found.partyId);
          if (entry) {
            entry.row.planId = found.id;
            entry.row.caseState = "paused";
            entry.row.nextStep = null;
            w().cases = w().cases.filter((c) => c.id !== entry.row.caseId);
          }
        } else if (action === "reject") {
          found.state = "rejected";
          found.decidedReason = reason;
        } else {
          found.state = "cancelled";
          found.decidedReason = reason;
          found.endedAt = iso();
          found.instalments.forEach((instalment) => {
            if (instalment.state === "scheduled") instalment.state = "cancelled";
          });
        }
        found.nextActions = planActions(found.state);
        found.version += 1;
        return { status: 200, body: found };
      };
      return action === "reject"
        ? (async () => {
            const payload = await body<Record<string, unknown>>(request);
            record(op, request, payload);
            const answer = decide(payload);
            return answer instanceof Response ? answer : json(answer.body, answer.status);
          })()
        : idempotent(request, op, decide);
    }),
  ),
];

function outstandingOf(unitId: string, partyId: string) {
  const entry = w().accounts.find((a) => a.row.unitId === unitId && a.row.partyId === partyId);
  return entry ? entry.row.outstanding : "0.00";
}

function issueCertificate(found: Schemas["DebtClearanceDto"]) {
  const code = randomCode(8);
  const n = w().clearances.filter((c) => c.number).length + 5;
  w().verifyCodes[code] = found.id;
  Object.assign(found, {
    state: "issued",
    number: `DCL-2026-${String(n).padStart(5, "0")}`,
    issuedAt: iso(),
    validUntil: date(30),
    documentId: crypto.randomUUID(),
    verifyCodeHint: `••••${code.slice(-4)}`,
    nextActions: [],
  });
  return { ...found, verifyCode: code };
}

const clearanceHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/debt-clearances", ({ request }) => {
    const ok = owner(request, "owner.juristicDebtClearances.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.trim().toLowerCase();
    const list = (juristicOnly(ok) ? w().clearances : [])
      .filter((c) => !params.get("state") || c.state === params.get("state"))
      .filter((c) => !params.get("unitId") || c.unitId === params.get("unitId"))
      .filter((c) => !q || `${c.unitNo} ${c.partyName} ${c.number ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/juristic/debt-clearances", async ({ request }) => {
    const op = "owner.juristicDebtClearances.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["DebtClearanceCreateDto"];
      const unit = unitOf(input.unitId ?? "");
      const owners = state.juristic.ownerships.filter((o) => o.unitId === input.unitId && o.validTo === null);
      if (!unit || !owners.some((o) => o.partyId === input.partyId))
        return validation(op, "partyId", "a co-owner of the unit today");
      const outstanding = outstandingOf(input.unitId, input.partyId);
      if (satang(outstanding) > 0) return problem(op, "debt_clearance.outstanding", { outstanding });
      const fee = String(w().settings.find((s) => s.key === "juristic.debt_clearance.fee")?.value ?? "0.00");
      const created = clearance(w().clearances.length + 10, 1, input.partyId, "requested", {
        id: crypto.randomUUID(),
        unitId: unit.id,
        unitNo: unit.unitNo,
        partyName: partyName(input.partyId),
        asOf: input.asOf ?? date(),
        fee,
        requestedVia: "web",
        createdAt: iso(),
      });
      w().clearances.push(created);
      return { status: 201, body: satang(fee) === 0 ? issueCertificate(created) : created };
    });
  }),
  http.get("*/v1/owner/juristic/debt-clearances/:id", ({ request, params }) => {
    const op = "owner.juristicDebtClearances.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().clearances.find((c) => c.id === params.id) : undefined;
    return found ? json(found) : notFound(op);
  }),
  http.get("*/v1/owner/juristic/debt-clearances/:id/document", ({ request, params }) => {
    const op = "owner.juristicDebtClearances.document";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().clearances.find((c) => c.id === params.id) : undefined;
    if (!found?.documentId || !found.number) return notFound(op);
    return json(documentDownload(request, found.documentId, found.number));
  }),
  http.post("*/v1/owner/juristic/debt-clearances/:id/actions/issue", async ({ request, params }) => {
    const op = "owner.juristicDebtClearances.issue";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().clearances.find((c) => c.id === params.id) : undefined;
    if (!found) return notFound(op);
    return idempotent(request, op, () => {
      if (found.state !== "requested") return problem(op, "debt_clearance.invalid_state");
      const outstanding = outstandingOf(found.unitId, found.partyId);
      if (satang(outstanding) > 0) return problem(op, "debt_clearance.outstanding", { outstanding });
      return { status: 200, body: issueCertificate(found) };
    });
  }),
  http.post("*/v1/owner/juristic/debt-clearances/:id/actions/refuse", async ({ request, params }) => {
    const op = "owner.juristicDebtClearances.refuse";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().clearances.find((c) => c.id === params.id) : undefined;
    if (!found) return notFound(op);
    const input = await body<Schemas["ReasonDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "a reason is required");
    if (found.state !== "requested") return problem(op, "debt_clearance.invalid_state");
    Object.assign(found, { state: "refused", refuseReason: input.reason.trim(), nextActions: [] });
    return json(found);
  }),
];

const mandateHandlers: HttpHandler[] = [
  http.get("*/v1/owner/payment-mandates", ({ request }) => {
    const ok = owner(request, "owner.paymentMandates.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const list = (juristicOnly(ok) ? w().mandates : []).filter(
      (m) => !params.get("state") || m.state === params.get("state"),
    );
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/payment-mandates/:id/actions/revoke", async ({ request, params }) => {
    const op = "owner.paymentMandates.revoke";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().mandates.find((m) => m.id === params.id) : undefined;
    if (!found) return notFound(op);
    const input = await body<Schemas["ReasonDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "a reason is required");
    if (found.state !== "pending" && found.state !== "active") return problem(op, "payment_mandate.invalid_state");
    Object.assign(found, { state: "revoked", endedAt: iso(), endReason: input.reason.trim() });
    return json(found);
  }),
];

/** The juristic tenant's own answers to generic money endpoints (settings, invoices, payments); others fall through. */
const juristicMoneyHandlers: HttpHandler[] = [
  http.get("*/v1/owner/settings", ({ request }) => {
    const ok = owner(request, "owner.settings.list");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    return json(w().settings);
  }),
  http.get("*/v1/owner/settings/:key/versions", ({ request, params }) => {
    const ok = owner(request, "owner.settings.versions");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const setting = w().settings.find((s) => s.key === params.key);
    if (!setting) return problem("owner.settings.versions", "settings.unknown_key");
    return json([
      {
        versionId: cid("5e77a001", 1),
        scope: setting.scope,
        propertyId: null,
        value: setting.value,
        effectiveFrom: setting.effectiveFrom,
        effectiveTo: null,
        scheduled: false,
        reason: setting.scope === "platform" ? "platform default" : "ตามมติคณะกรรมการ",
        createdBy: null,
        createdAt: setting.effectiveFrom,
      },
    ] satisfies Schemas["SettingHistoryEntryDto"][]);
  }),
  http.put("*/v1/owner/settings/:key", async ({ request, params }) => {
    const op = "owner.settings.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const setting = w().settings.find((s) => s.key === params.key);
    if (!setting) return problem(op, "settings.unknown_key");
    const input = await body<Schemas["SettingUpdateDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "required");
    const valid =
      setting.key === "payments.allocation_policy"
        ? input.value === "oldest_first" || input.value === "surcharge_first"
        : setting.valueType === "int"
          ? Number.isInteger(input.value)
          : setting.valueType === "bool"
            ? typeof input.value === "boolean"
            : typeof input.value === "string" && MONEY.test(input.value);
    if (!valid) return problem(op, "settings.invalid_value");
    Object.assign(setting, { value: input.value, scope: "tenant", effectiveFrom: iso() });
    return json({
      key: setting.key,
      scope: "tenant",
      effectiveFrom: setting.effectiveFrom,
      versionId: crypto.randomUUID(),
    });
  }),
  http.get("*/v1/owner/invoices", ({ request }) => {
    const ok = owner(request, "owner.invoices.list");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const params = query(request);
    const list = w()
      .invoices.filter((i) => !params.get("status") || i.status === params.get("status"))
      .filter((i) => !params.get("unitId") || i.unitId === params.get("unitId"))
      .filter((i) => !params.get("partyId") || i.billedPartyId === params.get("partyId"))
      .filter((i) => !params.get("buildingId") || i.buildingId === params.get("buildingId"))
      .sort((a, b) => (params.get("order") === "asc" ? 1 : -1) * (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/invoices/:invoiceId/actions/send-reminder", async ({ request, params }) => {
    const op = "owner.invoices.sendReminder";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const invoice = w().invoices.find((i) => i.id === params.invoiceId);
    if (!invoice) return notFound(op);
    return idempotent(request, op, () => {
      if (satang(invoice.balance) === 0) return problem(op, "invoice.nothing_due");
      const reminder: Schemas["DunningReminderDto"] = {
        id: crypto.randomUUID(),
        scheduledFor: iso(),
        sentAt: iso(),
        status: "sent",
        step: 0,
        triggeredBy: "owner",
      };
      return { status: 200, body: reminder };
    });
  }),
  http.post("*/v1/owner/payments", async ({ request }) => {
    const op = "owner.payments.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["ManualPaymentDto"];
      const invoice = w().invoices.find((i) => i.id === input.invoiceId);
      if (!invoice) return notFound(op);
      const refused = manualRule(op, input);
      if (refused) return refused;
      const take = Math.min(satang(input.amount), satang(invoice.balance));
      const entry = w().accounts.find(
        (a) => a.row.unitId === invoice.unitId && a.row.partyId === invoice.billedPartyId,
      );
      // The tenant's policy (oldest_first): the invoice's surcharge first — the mock's invoices carry a share of it.
      const surcharge = entry ? Math.min(take, Math.round(satang(entry.row.surcharge) / Math.max(1, entry.months))) : 0;
      invoice.balance = baht(satang(invoice.balance) - take);
      invoice.paidTotal = baht(satang(invoice.paidTotal) + take);
      invoice.status = satang(invoice.balance) === 0 ? "paid" : "partially_paid";
      const payment = paymentDto(
        invoice.billedPartyId,
        invoice.billedPartyName,
        invoice.unitId,
        invoice.unitNo,
        [
          {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            amount: baht(take),
            surchargeAmount: baht(surcharge),
            reversedAt: null,
          },
        ],
        input.amount,
        {
          method: input.method,
          paidAt: input.paidAt,
          notes: input.notes ?? null,
          evidenceDocumentId: input.evidenceDocumentId ?? null,
          providerRef: input.reference ?? null,
          allocatedTotal: baht(take),
          creditedAmount: baht(satang(input.amount) - take),
        },
      );
      w().payments.unshift(payment);
      return { status: 201, body: payment };
    });
  }),
  http.get("*/v1/owner/exports/:exportId", ({ request, params }) => {
    const ok = owner(request, "owner.exports.get");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const job = w().exportJobs.find((candidate) => candidate.id === params.exportId);
    return job ? json(job) : notFound("owner.exports.get");
  }),
  http.get("*/v1/owner/payments/:paymentId", ({ request, params }) => {
    const ok = owner(request, "owner.payments.get");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const payment = w().payments.find((p) => p.id === params.paymentId);
    return payment ? json(payment) : notFound("owner.payments.get");
  }),
];

const workspaceHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/workspace/units", ({ request }) => {
    const ok = owner(request, "owner.juristicWorkspace.units");
    if (ok instanceof Response) return ok;
    return json({ items: juristicOnly(ok) ? w().workspaceUnits : [] } satisfies Schemas["WorkspaceUnitListDto"]);
  }),
  http.get("*/v1/owner/juristic/workspace/invoices", ({ request }) => {
    const ok = owner(request, "owner.juristicWorkspace.invoices");
    if (ok instanceof Response) return ok;
    const list = juristicOnly(ok)
      ? [...w().workspaceInvoices].sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""))
      : [];
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/juristic/workspace/units/:unitId/invoices", async ({ request, params }) => {
    const op = "owner.juristicWorkspace.billLandlord";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const unit = juristicOnly(ok) ? w().workspaceUnits.find((u) => u.unitId === params.unitId) : undefined;
    if (!unit) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["WorkspaceInvoiceCreateDto"];
      if (!MONEY.test(input.amount ?? "") || satang(input.amount) <= 0)
        return validation(op, "amount", "an amount above 0.00");
      if (!input.periodStart || !input.periodEnd || input.periodEnd < input.periodStart)
        return validation(op, "periodEnd", "the period ends after it starts");
      const invoice = workspaceInvoice(
        w().workspaceInvoices.length + 2,
        unit,
        input.amount,
        input.description?.trim() || "ค่าส่วนกลาง",
        0,
      );
      invoice.id = crypto.randomUUID();
      invoice.periodStart = input.periodStart;
      invoice.periodEnd = input.periodEnd;
      w().workspaceInvoices.push(invoice);
      return { status: 201, body: invoice };
    });
  }),
  // D-270, the landlord's side.
  http.get("*/v1/owner/juristic-workspace-invitations", ({ request }) => {
    const ok = owner(request, "owner.juristicWorkspaceInvitations.list");
    if (ok instanceof Response) return ok;
    const list =
      ok.tenantId === LANDLORD_TENANT
        ? [...w().invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [];
    return json({ items: list } satisfies Schemas["WorkspaceInvitationListDto"]);
  }),
  http.post("*/v1/owner/juristic-workspace-invitations", async ({ request }) => {
    const op = "owner.juristicWorkspaceInvitations.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (ok.tenantId !== LANDLORD_TENANT) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["WorkspaceInvitationCreateDto"];
      const units = (state.portfolio[LANDLORD_TENANT] ?? []).filter((unit) => unit.building.id === input.buildingId);
      if (units.length === 0) return notFound(op);
      if (!units[0]!.building.external) return problem(op, "workspace.not_a_stub");
      if (!input.officeName?.trim()) return validation(op, "officeName", "the office's name");
      if (!input.unitIds?.length || input.unitIds.some((id) => !units.some((unit) => unit.unitId === id)))
        return validation(op, "unitIds", "your units in this building");
      const code = randomCode(10);
      w().invitationCodes[code] = "open";
      const created: Schemas["WorkspaceInvitationDto"] = {
        id: crypto.randomUUID(),
        buildingId: input.buildingId,
        unitIds: input.unitIds,
        officeName: input.officeName.trim(),
        state: "invited",
        code,
        codeHint: `••••${code.slice(-2)}`,
        url: `${new URL(request.url).origin.replace(":4010", ":3000")}/juristic/join/${code}`,
        expiresAt: iso(14),
        acceptedAt: null,
        revokedAt: null,
        createdAt: iso(),
      };
      w().invitations.push({ ...created, code: null, url: null });
      return { status: 201, body: created };
    });
  }),
  http.post("*/v1/owner/juristic-workspace-invitations/:linkId/actions/revoke", async ({ request, params }) => {
    const op = "owner.juristicWorkspaceInvitations.revoke";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = ok.tenantId === LANDLORD_TENANT ? w().invitations.find((i) => i.id === params.linkId) : undefined;
    if (!found) return notFound(op);
    return idempotent(request, op, (payload) => {
      if (typeof payload.reason !== "string" || payload.reason.trim().length < 3)
        return validation(op, "reason", "a reason is required");
      if (found.state === "revoked") return problem(op, "workspace.invalid_state");
      Object.assign(found, { state: "revoked", revokedAt: iso() });
      return { status: 200, body: found };
    });
  }),
];

/** Anonymous: certificate verification (D-306) and an office accepting a landlord's invitation (D-270). */
const publicHandlers: HttpHandler[] = [
  http.get("*/v1/public/documents/verify/:code", ({ params }) => {
    const id = w().verifyCodes[String(params.code).toUpperCase()];
    const found = id ? w().clearances.find((c) => c.id === id) : undefined;
    if (!found || found.state !== "issued" || !found.number)
      return problem("public.documents.verify", "http.not_found");
    const owner = partyName(found.partyId);
    const initials = owner
      .replace(/^(คุณ|นาย|นางสาว|นาง|น\.ส\.|บจก\.)\s*/, "")
      .split(/\s+/)
      .map((word) => `${word[0] ?? ""}.`)
      .join("");
    return json({
      documentType: "debt_clearance",
      number: found.number,
      status: (found.validUntil ?? "") >= date() ? "valid" : "expired",
      issuedAt: found.issuedAt!,
      asOf: found.asOf,
      validUntil: found.validUntil!,
      issuer: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์",
      unitNo: found.unitNo,
      holderInitials: initials,
    } satisfies Schemas["VerifiedDocumentDto"]);
  }),
  http.get("*/v1/public/juristic-workspaces/:code", ({ params }) => {
    if (!w().invitationCodes[String(params.code)])
      return problem("public.juristicWorkspaces.preview", "workspace.invitation_invalid");
    return json({
      officeName: "นิติบุคคลอาคารชุด ไอดีโอ โมบิ อารีย์",
      buildingName: "ไอดีโอ โมบิ อารีย์",
      units: 1,
      expiresAt: iso(12),
    } satisfies Schemas["WorkspacePreviewDto"]);
  }),
  http.post("*/v1/public/juristic-workspaces/otp", async ({ request }) => {
    const input = await body<Schemas["OtpRequestDto"]>(request);
    if (!input.phone || !/^\+?\d{9,12}$/.test(input.phone.replace(/\s/g, "")))
      return problem("public.juristicWorkspaces.otp", "validation.failed");
    const challengeId = crypto.randomUUID();
    w().challenges[challengeId] = input.phone;
    return json({
      challengeId,
      expiresAt: iso(5 / 1440),
      resendAvailableAt: iso(1 / 1440),
    } satisfies Schemas["OtpChallengeDto"]);
  }),
  http.post("*/v1/public/juristic-workspaces/accept", async ({ request }) => {
    const op = "public.juristicWorkspaces.accept";
    const input = await body<Schemas["WorkspaceAcceptDto"]>(request);
    if (!w().invitationCodes[input.code]) return problem(op, "validation.failed");
    if (!input.challengeId || !w().challenges[input.challengeId] || input.code6 !== MOCK_OTP_CODE)
      return problem(op, "validation.failed", {
        errors: [{ path: "code6", code: "invalid", message: "รหัสไม่ถูกต้อง" }],
      });
    if (!input.displayName?.trim()) return validation(op, "displayName", "required");
    delete w().challenges[input.challengeId];
    delete w().invitationCodes[input.code];
    // The office already runs this juristic tenant: linked, not created (the persona `juristic`).
    return json(
      {
        created: false,
        linkId: crypto.randomUUID(),
        tenantId: JURISTIC_TENANT,
        tenantName: TENANTS.juristic.profile.displayName,
        tokens: {
          ...issueTokens("operator", "juristic"),
          subject: {
            id: OPERATORS.find((persona) => persona.key === "juristic")!.user.id,
            type: "user",
            audience: "operator",
            roles: ["owner"],
            permissions: [],
            scopes: [`tenant:${JURISTIC_TENANT}`],
          },
        },
      } satisfies Schemas["WorkspaceAcceptResultDto"],
      201,
    );
  }),
];

export const collectionsHandlers: HttpHandler[] = [
  ...juristicMoneyHandlers,
  ...receivableHandlers,
  ...ladderHandlers,
  ...statementHandlers,
  ...planHandlers,
  ...clearanceHandlers,
  ...mandateHandlers,
  ...workspaceHandlers,
  ...publicHandlers,
];

export function resetCollectionsWorld(): void {
  state.collections = initialCollectionsWorld();
}

export function collectionsStateHandlers(): HttpHandler[] {
  return [
    http.post("*/__mock/owner/collections/reset", () => {
      resetCollectionsWorld();
      return json({ ok: true });
    }),
    http.get("*/__mock/owner/collections", () => json(state.collections)),
  ];
}
