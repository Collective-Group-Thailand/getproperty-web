import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import {
  ACC,
  ACCOUNTANT_USER,
  COMMITTEE_USER,
  OWNER_USER,
  STAFF_USER,
  VENDOR,
  addVendorExpense,
  expenseBandFor,
  quotationThreshold,
  type MockAccountingWorld,
} from "./accounting";
import { J, JURISTIC_TENANT } from "./juristic";
import {
  allowed,
  body,
  idempotent,
  json,
  mutating,
  notFound,
  owner,
  paged,
  problem,
  query,
  record,
  roleOf,
  validation,
  type Ok,
} from "./support";

type Schemas = components["schemas"];

/*
 * Vendors, service contracts, quotation rounds, monthly evaluations and PM plans under a contract (pack J, JW2b; api
 * J2.2 at fb2a22ff, D-331, D-310). The juristic office's vendors wrap parties of the register (the five companies the
 * expense requests already pay, plus lift, CCTV, fire-system, garden and pest-control companies); contracts in every
 * state — two in the renewal queue (one with its notice date passed and a renewal draft), one draft from an awarded
 * round, one expired, one terminated; rounds open (two quotations, short of three), awaiting approval (asked by the
 * owner: the committee approves, the owner cannot), awarded, cancelled; six months of evaluations with SLA breaches
 * pulled from the vendor's work orders; preventive plans under the lift and fire-system contracts.
 * The money and the schedule are computed here (the API's side); the console never computes them.
 * Controls: `POST /__mock/owner/vendors/job` (the hourly `vendor-contracts` job), `GET /__mock/owner/vendors`.
 */

const DAY = 86_400_000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);
const vid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` of Bangkok today, moved by whole months. */
function monthOf(offsetMonths = 0, from = date()): string {
  const [y, m] = from.slice(0, 7).split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + offsetMonths;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** A date moved by whole months, the day kept within 1–28. */
function addMonths(day: string, months: number, dueDay?: number): string {
  const month = monthOf(months, day);
  const d = dueDay ?? Math.min(Number(day.slice(8, 10)), 28);
  return `${month}-${String(d).padStart(2, "0")}`;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

export const V = {
  pump: vid("7e9d0a01", 1),
  security: vid("7e9d0a01", 2),
  lift: vid("7e9d0a01", 3),
  cleaning: vid("7e9d0a01", 4),
  painter: vid("7e9d0a01", 5),
  thaiLift: vid("7e9d0a01", 6),
  asiaLift: vid("7e9d0a01", 7),
  garden: vid("7e9d0a01", 8),
  vision: vid("7e9d0a01", 9),
  secureCam: vid("7e9d0a01", 10),
  pest: vid("7e9d0a01", 11),
  fire: vid("7e9d0a01", 12),
} as const;

export const VC = {
  lift: vid("c0c7a001", 1),
  security: vid("c0c7a001", 2),
  cleaning: vid("c0c7a001", 3),
  pump: vid("c0c7a001", 4),
  garden: vid("c0c7a001", 5),
  cleaningRenewal: vid("c0c7a001", 6),
  pest: vid("c0c7a001", 7),
  fire: vid("c0c7a001", 8),
} as const;

export const QR = {
  lift: vid("9b0d0a01", 1),
  pump: vid("9b0d0a01", 2),
  cctv: vid("9b0d0a01", 3),
  gutter: vid("9b0d0a01", 4),
  tank: vid("9b0d0a01", 5),
} as const;

const ASSET = {
  liftL1: vid("a55e0a01", 1),
  liftL2: vid("a55e0a01", 2),
  firePanel: vid("a55e0a01", 3),
  pumpSet: vid("a55e0a01", 4),
  generator: vid("a55e0a01", 5),
} as const;

/** A vendor of the mock: the DTO plus what the API keeps on the party (the full tax id, for the 50 ทวิ). */
export interface MockVendor {
  dto: Schemas["VendorDto"];
  taxId: string | null;
}

interface MockContract extends Omit<
  Schemas["VendorContractDetailDto"],
  | "evaluations"
  | "evaluationSummary"
  | "maintenancePlans"
  | "expenseRequests"
  | "nextActions"
  | "daysLeft"
  | "noticeBy"
  | "instalmentsTotal"
  | "expenseAccountCode"
> {
  activatedBy: string | null;
}

export interface MockVendorsWorld {
  vendors: MockVendor[];
  contracts: MockContract[];
  rounds: Schemas["QuotationRoundDto"][];
  evaluations: Schemas["VendorEvaluationDto"][];
  /** SLA months pulled by evaluations: `${contractId}:${YYYY-MM}` → breaches and work orders. */
  sla: Record<string, { workOrders: number; breaches: Schemas["SlaBreachDto"][] }>;
  plans: Schemas["MaintenancePlanDto"][];
  assets: Schemas["BuildingAssetItemDto"][];
}

// ── The world ────────────────────────────────────────────────────────────────────────────────────────────────────────

function vendor(
  id: string,
  partyId: string,
  name: string,
  input: Partial<Schemas["VendorDto"]> & { taxId?: string | null } = {},
): MockVendor {
  const { taxId = null, ...patch } = input;
  return {
    taxId,
    dto: {
      id,
      partyId,
      partyType: "company",
      name,
      taxIdHint: taxId ? taxId.slice(-4) : null,
      categories: [],
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      bankName: null,
      bankAccountName: null,
      bankAccountLast4: null,
      state: "active",
      blockedReason: null,
      note: null,
      activeContracts: 0,
      createdAt: iso(-400),
      version: 1,
      ...patch,
    },
  };
}

function initialVendors(): MockVendor[] {
  const party = (n: number) => vid("9a7e0b01", n);
  return [
    vendor(V.pump, VENDOR.pump, "บริษัท ไทยปั๊ม เซอร์วิส จำกัด", {
      taxId: "0105558123456",
      categories: ["pump", "plumbing"],
      contactName: "คุณวิชัย ปั๊มดี",
      contactPhone: "+66812340001",
      contactEmail: "service@thaipump.example",
      bankName: "กสิกรไทย",
      bankAccountName: "บจก. ไทยปั๊ม เซอร์วิส",
      bankAccountLast4: "4410",
    }),
    vendor(V.security, VENDOR.security, "บริษัท การ์ดเดียน ซีเคียวริตี้ จำกัด", {
      taxId: "0105561098765",
      categories: ["security"],
      contactName: "คุณสมศักดิ์ ใจกล้า",
      contactPhone: "+66812340002",
      bankName: "ไทยพาณิชย์",
      bankAccountName: "บจก. การ์ดเดียน ซีเคียวริตี้",
      bankAccountLast4: "7720",
    }),
    vendor(V.lift, VENDOR.lift, "บริษัท ลิฟท์แอนด์เอสคาเลเตอร์ (ประเทศไทย) จำกัด", {
      taxId: "0105549011122",
      categories: ["lift"],
      contactName: "คุณธีระ ยกสูง",
      contactPhone: "+66812340003",
      contactEmail: "contract@liftesc.example",
      bankName: "กรุงเทพ",
      bankAccountName: "บจก. ลิฟท์แอนด์เอสคาเลเตอร์ (ประเทศไทย)",
      bankAccountLast4: "8812",
    }),
    vendor(V.cleaning, VENDOR.cleaning, "บริษัท คลีนพลัส แมเนจเมนท์ จำกัด", {
      taxId: "0105563055501",
      categories: ["cleaning", "waste"],
      contactName: "คุณมาลี สะอาดดี",
      contactPhone: "+66812340004",
      bankName: "กรุงไทย",
      bankAccountName: "บจก. คลีนพลัส แมเนจเมนท์",
      bankAccountLast4: "3091",
    }),
    vendor(V.painter, VENDOR.painter, "นายประเสริฐ ช่างสี", {
      partyType: "person",
      categories: ["building_works"],
      contactPhone: "+66812340005",
      note: "ช่างรายวัน ยังไม่มีเลขประจำตัวผู้เสียภาษีในระบบ",
    }),
    vendor(V.thaiLift, party(6), "บริษัท ไทยลิฟต์ เซอร์วิส จำกัด", {
      taxId: "0105560078812",
      categories: ["lift"],
      contactName: "คุณอนุชา ไทยลิฟต์",
      contactPhone: "+66812340006",
      createdAt: iso(-30),
    }),
    vendor(V.asiaLift, party(7), "บริษัท เอเชีย ลิฟต์ เอ็นจิเนียริ่ง จำกัด", {
      taxId: "0105555066670",
      categories: ["lift", "electrical"],
      contactPhone: "+66812340007",
      createdAt: iso(-10),
    }),
    vendor(V.garden, party(8), "บริษัท กรีนสเคป แลนด์ จำกัด", {
      taxId: "0105562044403",
      categories: ["gardening"],
      contactName: "คุณใบเตย เขียวขจี",
      contactPhone: "+66812340008",
      state: "blocked",
      blockedReason: "ส่งงานล่าช้าซ้ำหลายครั้งและไม่เข้าตัดหญ้าตามรอบ 3 เดือนติด",
    }),
    vendor(V.vision, party(9), "บริษัท วิชั่น ซีซีทีวี จำกัด", {
      taxId: "0105564011209",
      categories: ["cctv", "electrical"],
      contactPhone: "+66812340009",
    }),
    vendor(V.secureCam, party(10), "บริษัท ซีเคียว แคม ซิสเต็มส์ จำกัด", {
      taxId: "0105559087713",
      categories: ["cctv"],
      contactPhone: "+66812340010",
    }),
    vendor(V.pest, party(11), "บริษัท โนเพสต์ คอนโทรล จำกัด", {
      taxId: "0105557022210",
      categories: ["pest_control"],
      contactPhone: "+66812340011",
    }),
    vendor(V.fire, party(12), "บริษัท ไฟร์เซฟ ซิสเต็มส์ จำกัด", {
      taxId: "0105558099915",
      categories: ["fire_system", "electrical"],
      contactName: "คุณปกรณ์ กันภัย",
      contactPhone: "+66812340012",
      bankName: "กสิกรไทย",
      bankAccountName: "บจก. ไฟร์เซฟ ซิสเต็มส์",
      bankAccountLast4: "6650",
    }),
  ];
}

const SLA_STANDARD: Schemas["SlaTermDto"][] = [
  { priority: "urgent", responseHours: 2, resolveHours: 24 },
  { priority: "high", responseHours: 4, resolveHours: 48 },
  { priority: "normal", responseHours: 24, resolveHours: 72 },
  { priority: "low", responseHours: 48, resolveHours: 168 },
];

function contract(
  id: string,
  vendorId: string,
  vendorName: string,
  input: Partial<MockContract> & Pick<MockContract, "title" | "startsOn" | "endsOn" | "value" | "state">,
): MockContract {
  return {
    id,
    buildingId: J.buildingA,
    buildingName: "อาคาร A",
    vendorId,
    vendorName,
    category: null,
    renewalNoticeDays: 60,
    renewsContractId: null,
    renewalId: null,
    createdAt: iso(-420),
    version: 2,
    scope: null,
    slaTerms: [],
    expenseAccountId: ACC.services,
    whtKey: "service",
    instalmentPlan: null,
    penaltyClauses: null,
    quotationRoundId: null,
    resolutionId: null,
    activatedAt: null,
    activatedBy: null,
    terminatedOn: null,
    terminationReason: null,
    expiredAt: null,
    note: null,
    instalments: [],
    documents: [],
    alerts: [],
    ...input,
  };
}

/** The instalment schedule of a plan inside the term (the API's `vendor-rules.ts`): first due on / after the start. */
function schedule(
  plan: Schemas["InstalmentPlanViewDto"],
  startsOn: string,
  endsOn: string,
  title: string,
): Schemas["ContractInstalmentDto"][] {
  const step = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12, once: 0 }[plan.frequency];
  let due = plan.firstDueOn ?? `${startsOn.slice(0, 7)}-${String(plan.dueDay).padStart(2, "0")}`;
  if (due < startsOn) due = addMonths(due, 1, plan.dueDay);
  const out: Schemas["ContractInstalmentDto"][] = [];
  while (due <= endsOn && out.length < 120) {
    out.push({
      seq: out.length + 1,
      dueOn: due,
      amount: plan.amount,
      vatAmount: plan.vatAmount,
      description: "",
      state: "scheduled",
      expenseRequestId: null,
      expenseRequestNumber: null,
      expenseRequestState: null,
      requestedAt: null,
      cancelledAt: null,
    });
    if (step === 0) break;
    due = addMonths(due, step, plan.dueDay);
  }
  return out.map((instalment) => ({ ...instalment, description: `${title} งวดที่ ${instalment.seq}/${out.length}` }));
}

/** Instalments already due became expense requests (the job ran each month): requested, linked to a request. */
function pastRequested(
  contractItem: MockContract,
  accounting: MockAccountingWorld,
  vendorName: string,
  partyId: string,
): void {
  for (const instalment of contractItem.instalments) {
    if (instalment.dueOn > date(7)) continue;
    const existing = accounting.expenses.find(
      (expense) => expense.vendorContractId === contractItem.id && expense.title.includes(`งวดที่ ${instalment.seq}/`),
    );
    const n = 900 + accounting.expenses.length;
    const id = existing?.id ?? vid("e0e0a001", n);
    if (!existing) {
      accounting.expenses.push({
        ...(accounting.expenses.find((expense) => expense.state === "paid") ?? accounting.expenses[0]!),
        id,
        number: `EXP-${instalment.dueOn.slice(0, 4)}-${String(n).padStart(5, "0")}`,
        title: instalment.description,
        buildingId: contractItem.buildingId,
        buildingName: contractItem.buildingName,
        payeePartyId: partyId,
        payeeName: vendorName,
        vendorId: contractItem.vendorId,
        vendorName,
        vendorContractId: contractItem.id,
        quotationRoundId: null,
        fundId: null,
        resolutionId: null,
        kind: "expense",
        amount: instalment.amount,
        whtAmount: baht(Math.round((satang(instalment.amount) - satang(instalment.vatAmount)) * 0.03)),
        netAmount: baht(
          satang(instalment.amount) - Math.round((satang(instalment.amount) - satang(instalment.vatAmount)) * 0.03),
        ),
        lines: [
          {
            lineNo: 1,
            accountId: contractItem.expenseAccountId ?? ACC.services,
            accountCode: "5140",
            accountName: "ค่าจ้างบริการภายนอก",
            description: instalment.description,
            amount: instalment.amount,
            vatAmount: instalment.vatAmount,
            whtKey: "service",
            whtRatePct: "3.00",
            whtIncomeType: "3 เตรส",
            whtAmount: baht(Math.round((satang(instalment.amount) - satang(instalment.vatAmount)) * 0.03)),
          },
        ],
        attachments: [],
        certificate: null,
        createdAt: `${addMonths(instalment.dueOn, 0, 1).slice(0, 8)}01T00:15:00+07:00`,
        submittedAt: `${instalment.dueOn}T00:15:00+07:00`,
        paidOn: instalment.dueOn,
        paidAt: `${instalment.dueOn}T14:00:00+07:00`,
        journalId: null,
        note: null,
        version: 3,
      });
    }
    const linked = accounting.expenses.find((expense) => expense.id === id)!;
    instalment.state = "requested";
    instalment.expenseRequestId = linked.id;
    instalment.expenseRequestNumber = linked.number;
    instalment.expenseRequestState = linked.state;
    instalment.requestedAt = linked.submittedAt ?? iso(-1);
  }
}

function quotation(
  n: number,
  vendorItem: MockVendor,
  amount: string,
  input: Partial<Schemas["QuotationDto"]> = {},
): Schemas["QuotationDto"] {
  return {
    id: vid("90a7a001", n),
    vendorId: vendorItem.dto.id,
    vendorName: vendorItem.dto.name,
    amount,
    vatAmount: baht(Math.round((satang(amount) * 7) / 107)),
    validUntil: date(45),
    documentId: vid("d0e2b001", n),
    receivedOn: date(-6 + n),
    note: null,
    ...input,
  };
}

function round(
  id: string,
  title: string,
  input: Partial<Schemas["QuotationRoundDto"]> & Pick<Schemas["QuotationRoundDto"], "state">,
): Schemas["QuotationRoundDto"] {
  return {
    id,
    buildingId: J.buildingA,
    buildingName: "อาคาร A",
    title,
    description: null,
    category: null,
    estimatedAmount: null,
    quotations: [],
    threshold: "50000.00",
    minimumQuotations: 3,
    awardedQuotationId: null,
    outcome: null,
    basis: null,
    resolutionId: null,
    aboveThreshold: null,
    fewerQuotationsReason: null,
    approvalsRequired: null,
    approverRoles: [],
    approvalsGiven: 0,
    approvals: [],
    awardRequestedBy: null,
    awardRequestedAt: null,
    awardedAt: null,
    outcomeContractId: null,
    outcomeExpenseRequestId: null,
    cancelledAt: null,
    cancelReason: null,
    nextActions: [],
    createdAt: iso(-14),
    version: 1,
    ...input,
  };
}

const CRITERIA = [
  { key: "quality", labelTh: "คุณภาพงาน", labelEn: "Quality of work" },
  { key: "timeliness", labelTh: "ตรงต่อเวลา", labelEn: "Timeliness" },
  { key: "communication", labelTh: "การติดต่อสื่อสาร", labelEn: "Communication" },
  { key: "safety", labelTh: "ความปลอดภัย", labelEn: "Safety" },
];

function criteria(): { key: string; labelTh: string; labelEn: string }[] {
  const setting = state.collections?.settings.find((s) => s.key === "juristic.vendor_evaluation_criteria");
  return Array.isArray(setting?.value) ? (setting.value as typeof CRITERIA) : CRITERIA;
}

function breach(
  kind: Schemas["SlaBreachKind"],
  title: string,
  priority: Schemas["ServicePriority"],
  allowedHours: number | null,
  actualHours: number | null,
  n: number,
): Schemas["SlaBreachDto"] {
  return {
    kind,
    workOrderId: vid("3b24w0a1", n),
    serviceRequestId: kind === "request_sla" ? vid("3b24s0a1", n) : null,
    title,
    priority,
    allowedHours,
    actualHours,
  };
}

function evaluation(
  contractId: string,
  vendorId: string,
  month: string,
  scores: [number, number, number, number],
  sla: { workOrders: number; breaches: Schemas["SlaBreachDto"][] },
  input: Partial<Schemas["VendorEvaluationDto"]> = {},
): Schemas["VendorEvaluationDto"] {
  const list = CRITERIA.map((criterion, index) => ({
    criterion: criterion.key,
    labelTh: criterion.labelTh,
    labelEn: criterion.labelEn,
    score: scores[index]!,
  }));
  return {
    id: crypto.randomUUID(),
    contractId,
    vendorId,
    month,
    scores: list,
    score: (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(2),
    incidents: 0,
    incidentNote: null,
    slaBreaches: sla.breaches.length,
    slaItems: sla.breaches,
    workOrders: sla.workOrders,
    note: null,
    evaluatedBy: OWNER_USER,
    createdAt: `${addMonths(`${month}-01`, 1, 3)}T10:00:00+07:00`,
    ...input,
  };
}

export function initialVendorsWorld(accounting: MockAccountingWorld): MockVendorsWorld {
  const vendors = initialVendors();
  const by = (id: string) => vendors.find((candidate) => candidate.dto.id === id)!;
  const name = (id: string) => by(id).dto.name;

  // Contracts --------------------------------------------------------------------------------------------------------
  const liftPlan: Schemas["InstalmentPlanViewDto"] = {
    frequency: "monthly",
    dueDay: 5,
    amount: "16050.00",
    vatAmount: "1050.00",
    firstDueOn: null,
  };
  const lift = contract(VC.lift, V.lift, name(V.lift), {
    title: "สัญญาบำรุงรักษาลิฟต์โดยสาร 2 ตัว",
    category: "lift",
    startsOn: date(-290),
    endsOn: date(75),
    renewalNoticeDays: 60,
    value: "192600.00",
    state: "active",
    scope:
      "ตรวจเช็กลิฟต์โดยสาร L1 และ L2 เดือนละครั้ง หล่อลื่นและปรับตั้งระบบประตู เปลี่ยนอะไหล่สิ้นเปลือง (ไม่รวมอะไหล่หลัก) รับแจ้งเหตุลิฟต์ค้างตลอด 24 ชั่วโมง ทดสอบระบบเบรกและอุปกรณ์นิรภัยทุกไตรมาส",
    slaTerms: SLA_STANDARD,
    expenseAccountId: ACC.repairs,
    instalmentPlan: liftPlan,
    penaltyClauses:
      "หากไม่เข้าแก้ไขเหตุลิฟต์ค้างภายในเวลาที่กำหนด ปรับครั้งละ 1,000 บาท\nหากไม่เข้าตรวจตามรอบเดือน ปรับ 2,000 บาทต่อครั้ง และนิติบุคคลมีสิทธิ์จ้างผู้อื่นแทนโดยหักจากค่าจ้าง",
    activatedAt: iso(-292),
    activatedBy: ACCOUNTANT_USER,
    documents: [
      { documentId: vid("d0c7a001", 1), kind: "contract", createdAt: iso(-295) },
      { documentId: vid("d0c7a001", 2), kind: "insurance", createdAt: iso(-295) },
    ],
    alerts: [{ daysBefore: 90, endsOn: date(75), sentAt: iso(-15) }],
  });
  lift.instalments = schedule(liftPlan, lift.startsOn, lift.endsOn, lift.title);

  const securityPlan: Schemas["InstalmentPlanViewDto"] = {
    frequency: "monthly",
    dueDay: 25,
    amount: "39600.00",
    vatAmount: "0.00",
    firstDueOn: null,
  };
  const security = contract(VC.security, V.security, name(V.security), {
    title: "สัญญาจ้างรักษาความปลอดภัย 24 ชั่วโมง",
    category: "security",
    startsOn: date(-200),
    endsOn: date(165),
    renewalNoticeDays: 90,
    value: "475200.00",
    state: "active",
    scope: "พนักงานรักษาความปลอดภัย 4 ผลัด ผลัดละ 2 นาย ตรวจตราตามจุดทุก 2 ชั่วโมง บันทึกผู้มาติดต่อที่ป้อม",
    slaTerms: [
      { priority: "urgent", responseHours: 1, resolveHours: 4 },
      { priority: "high", responseHours: 2, resolveHours: 12 },
    ],
    instalmentPlan: securityPlan,
    quotationRoundId: null,
    resolutionId: vid("e5010a01", 1),
    activatedAt: iso(-205),
    activatedBy: ACCOUNTANT_USER,
    documents: [{ documentId: vid("d0c7a001", 3), kind: "contract", createdAt: iso(-206) }],
  });
  security.instalments = schedule(securityPlan, security.startsOn, security.endsOn, security.title);

  const cleaningPlan: Schemas["InstalmentPlanViewDto"] = {
    frequency: "monthly",
    dueDay: 10,
    amount: "28890.00",
    vatAmount: "1890.00",
    firstDueOn: null,
  };
  const cleaning = contract(VC.cleaning, V.cleaning, name(V.cleaning), {
    title: "สัญญาทำความสะอาดพื้นที่ส่วนกลาง",
    category: "cleaning",
    startsOn: date(-340),
    endsOn: date(25),
    renewalNoticeDays: 30,
    value: "346680.00",
    state: "active",
    scope: "แม่บ้าน 3 คน วันจันทร์–เสาร์ ทำความสะอาดล็อบบี้ ทางเดิน ลิฟต์ ห้องขยะ และสระว่ายน้ำ",
    slaTerms: [{ priority: "normal", responseHours: 8, resolveHours: 24 }],
    instalmentPlan: cleaningPlan,
    renewalId: VC.cleaningRenewal,
    activatedAt: iso(-342),
    activatedBy: ACCOUNTANT_USER,
    alerts: [
      { daysBefore: 90, endsOn: date(25), sentAt: iso(-65) },
      { daysBefore: 60, endsOn: date(25), sentAt: iso(-35) },
      { daysBefore: 30, endsOn: date(25), sentAt: iso(-5) },
    ],
  });
  cleaning.instalments = schedule(cleaningPlan, cleaning.startsOn, cleaning.endsOn, cleaning.title);

  const cleaningRenewal = contract(VC.cleaningRenewal, V.cleaning, name(V.cleaning), {
    title: "สัญญาทำความสะอาดพื้นที่ส่วนกลาง",
    category: "cleaning",
    startsOn: date(26),
    endsOn: date(26 + 364),
    renewalNoticeDays: 30,
    value: "357000.00",
    state: "draft",
    scope: cleaning.scope,
    slaTerms: cleaning.slaTerms,
    instalmentPlan: { ...cleaningPlan, amount: "29750.00", vatAmount: "1946.26" },
    renewsContractId: VC.cleaning,
    createdAt: iso(-4),
    version: 1,
  });

  const pumpPlan: Schemas["InstalmentPlanViewDto"] = {
    frequency: "quarterly",
    dueDay: 15,
    amount: "24075.00",
    vatAmount: "1575.00",
    firstDueOn: null,
  };
  const pump = contract(VC.pump, V.pump, name(V.pump), {
    title: "บำรุงรักษาปั๊มน้ำรายไตรมาส",
    category: "pump",
    startsOn: date(10),
    endsOn: date(374),
    renewalNoticeDays: 45,
    value: "96300.00",
    state: "draft",
    scope: "ตรวจเช็กปั๊มน้ำดี 3 ชุด และปั๊มดับเพลิง ทุก 3 เดือน ล้างกรอง ตรวจแรงดัน รายงานผลพร้อมรูปถ่าย",
    slaTerms: [
      { priority: "urgent", responseHours: 4, resolveHours: 24 },
      { priority: "normal", responseHours: 24, resolveHours: 96 },
    ],
    instalmentPlan: pumpPlan,
    quotationRoundId: QR.pump,
    createdAt: iso(-3),
    version: 1,
  });

  const garden = contract(VC.garden, V.garden, name(V.garden), {
    title: "สัญญาดูแลสวนและตัดหญ้าหมู่บ้าน",
    buildingId: J.soi1,
    buildingName: "ซอย 1",
    category: "gardening",
    startsOn: date(-385),
    endsOn: date(-20),
    renewalNoticeDays: 30,
    value: "84000.00",
    state: "expired",
    instalmentPlan: { frequency: "monthly", dueDay: 1, amount: "7000.00", vatAmount: "0.00", firstDueOn: null },
    activatedAt: iso(-390),
    activatedBy: OWNER_USER,
    expiredAt: iso(-19),
    alerts: [
      { daysBefore: 90, endsOn: date(-20), sentAt: iso(-110) },
      { daysBefore: 60, endsOn: date(-20), sentAt: iso(-80) },
      { daysBefore: 30, endsOn: date(-20), sentAt: iso(-50) },
    ],
  });
  garden.instalments = schedule(garden.instalmentPlan!, garden.startsOn, garden.endsOn, garden.title);

  const pest = contract(VC.pest, V.pest, name(V.pest), {
    title: "กำจัดปลวกและแมลงรายไตรมาส",
    buildingId: J.soi1,
    buildingName: "ซอย 1",
    category: "pest_control",
    startsOn: date(-150),
    endsOn: date(215),
    renewalNoticeDays: 30,
    value: "36000.00",
    state: "terminated",
    instalmentPlan: { frequency: "quarterly", dueDay: 1, amount: "9000.00", vatAmount: "0.00", firstDueOn: null },
    activatedAt: iso(-152),
    activatedBy: OWNER_USER,
    terminatedOn: date(-12),
    terminationReason: "ผู้รับจ้างไม่เข้าฉีดพ่นตามรอบ 2 ครั้งติด และไม่ตอบรับการติดต่อ",
  });
  pest.instalments = schedule(pest.instalmentPlan!, pest.startsOn, pest.endsOn, pest.title).map((instalment) =>
    instalment.dueOn >= date(-12) ? { ...instalment, state: "cancelled" as const, cancelledAt: iso(-12) } : instalment,
  );

  const firePlan: Schemas["InstalmentPlanViewDto"] = {
    frequency: "semiannual",
    dueDay: 20,
    amount: "32100.00",
    vatAmount: "2100.00",
    firstDueOn: null,
  };
  const fire = contract(VC.fire, V.fire, name(V.fire), {
    title: "ตรวจสอบระบบแจ้งเหตุเพลิงไหม้และดับเพลิง",
    category: "fire_system",
    startsOn: date(-313),
    endsOn: date(52),
    renewalNoticeDays: 60,
    value: "64200.00",
    state: "active",
    scope:
      "ตรวจระบบแจ้งเหตุเพลิงไหม้ ตู้ควบคุม หัวจ่ายน้ำดับเพลิง และถังดับเพลิง ทุก 6 เดือน พร้อมรายงานตามแบบที่หน่วยงานกำหนด",
    slaTerms: [{ priority: "urgent", responseHours: 2, resolveHours: 12 }],
    instalmentPlan: firePlan,
    resolutionId: vid("e5010a01", 1),
    activatedAt: iso(-315),
    activatedBy: ACCOUNTANT_USER,
    alerts: [{ daysBefore: 60, endsOn: date(52), sentAt: iso(-8) }],
  });
  fire.instalments = schedule(firePlan, fire.startsOn, fire.endsOn, fire.title);

  const contracts = [lift, security, cleaning, pump, garden, cleaningRenewal, pest, fire];

  // Instalments already due became expense requests; this month's security instalment is the open one JW2a seeded.
  const securityExpense = accounting.expenses.find((expense) => expense.title === "ค่าจ้างรักษาความปลอดภัยเดือนนี้");
  for (const item of [lift, security, cleaning, fire]) {
    const v = by(item.vendorId);
    pastRequested(item, accounting, v.dto.name, v.dto.partyId);
  }
  if (securityExpense) {
    const open = [...security.instalments].reverse().find((instalment) => instalment.state === "requested");
    if (open) {
      const replaced = accounting.expenses.findIndex((expense) => expense.id === open.expenseRequestId);
      if (replaced >= 0) accounting.expenses.splice(replaced, 1);
      Object.assign(securityExpense, {
        vendorId: V.security,
        vendorName: name(V.security),
        vendorContractId: VC.security,
        title: open.description,
      });
      Object.assign(open, {
        expenseRequestId: securityExpense.id,
        expenseRequestNumber: securityExpense.number,
        expenseRequestState: securityExpense.state,
      });
    }
  }
  const liftExpense = accounting.expenses.find((expense) => expense.title === "เปลี่ยนชุดควบคุมประตูลิฟต์ตัวที่ 1");
  if (liftExpense) Object.assign(liftExpense, { vendorId: V.lift, vendorName: name(V.lift) });
  const pumpExpense = accounting.expenses.find((expense) => expense.title === "ซ่อมปั๊มน้ำดีชั้นใต้ดิน");
  if (pumpExpense) Object.assign(pumpExpense, { vendorId: V.pump, vendorName: name(V.pump) });

  // Quotation rounds -------------------------------------------------------------------------------------------------
  const rounds = [
    round(QR.lift, "จ้างบำรุงรักษาลิฟต์ ปี 2570", {
      state: "open",
      category: "lift",
      estimatedAmount: "200000.00",
      description:
        "สัญญาเดิมครบกำหนดในอีก 75 วัน ขอใบเสนอราคาบำรุงรักษาลิฟต์ L1 และ L2 แบบรายเดือน 12 เดือน ขอบเขตเท่าเดิม พร้อมราคาอะไหล่หลักแยกรายการ",
      quotations: [
        quotation(1, by(V.lift), "192600.00", { note: "ราคาเท่าเดิม รับประกันอะไหล่ 6 เดือน" }),
        quotation(2, by(V.thaiLift), "205440.00", { validUntil: date(30) }),
      ],
      createdAt: iso(-12),
    }),
    round(QR.pump, "บำรุงรักษาปั๊มน้ำรายไตรมาส", {
      state: "awarded",
      category: "pump",
      estimatedAmount: "90000.00",
      quotations: [
        quotation(3, by(V.pump), "96300.00", { receivedOn: date(-20), validUntil: date(20) }),
        quotation(4, by(V.asiaLift), "101650.00", { receivedOn: date(-19), validUntil: date(25) }),
        quotation(5, by(V.fire), "112350.00", { receivedOn: date(-18), validUntil: date(-2) }),
      ],
      awardedQuotationId: vid("90a7a001", 3),
      outcome: "contract",
      basis: "approval",
      aboveThreshold: true,
      approvalsRequired: 2,
      approverRoles: ["owner", "manager", "committee"],
      approvalsGiven: 2,
      approvals: [
        {
          approverUserId: COMMITTEE_USER,
          role: "committee",
          decision: "approved",
          reason: null,
          createdAt: iso(-4),
        },
        {
          approverUserId: OWNER_USER,
          role: "owner",
          decision: "approved",
          reason: "ราคาต่ำสุดและเคยดูแลปั๊มชุดนี้",
          createdAt: iso(-3),
        },
      ],
      awardRequestedBy: ACCOUNTANT_USER,
      awardRequestedAt: iso(-5),
      awardedAt: iso(-3),
      outcomeContractId: VC.pump,
      createdAt: iso(-25),
      version: 6,
    }),
    round(QR.cctv, "ติดตั้งกล้องวงจรปิดลานจอดรถ 6 จุด", {
      state: "awaiting_approval",
      category: "cctv",
      estimatedAmount: "60000.00",
      description: "ติดตั้งกล้อง 6 ตัวพร้อมเครื่องบันทึก เก็บภาพ 30 วัน ครอบคลุมลานจอดชั้น B1 และทางลาด",
      quotations: [
        quotation(6, by(V.vision), "58850.00"),
        quotation(7, by(V.secureCam), "61204.00"),
        quotation(8, by(V.fire), "66340.00"),
      ],
      awardedQuotationId: vid("90a7a001", 6),
      outcome: "expense",
      basis: "approval",
      aboveThreshold: true,
      approvalsRequired: 2,
      approverRoles: ["owner", "manager", "committee"],
      approvalsGiven: 0,
      awardRequestedBy: OWNER_USER,
      awardRequestedAt: iso(-1),
      createdAt: iso(-9),
      version: 4,
    }),
    round(QR.gutter, "ซ่อมรางน้ำฝนซอย 1", {
      state: "cancelled",
      buildingId: J.soi1,
      buildingName: "ซอย 1",
      category: "building_works",
      estimatedAmount: "35000.00",
      quotations: [quotation(9, by(V.painter), "32000.00", { vatAmount: "0.00" })],
      cancelledAt: iso(-6),
      cancelReason: "ผู้รับเหมาเดิมรับประกันงาน แก้ไขให้โดยไม่มีค่าใช้จ่าย",
      createdAt: iso(-20),
    }),
    round(QR.tank, "ล้างถังเก็บน้ำใต้ดินและบนดาดฟ้า", {
      state: "open",
      category: "plumbing",
      estimatedAmount: "18000.00",
      createdAt: iso(-1),
    }),
  ];

  // Evaluations: lift six months up to two months ago (last month not yet), security five up to last month ---------
  const sla: MockVendorsWorld["sla"] = {};
  const liftScores: [number, number, number, number][] = [
    [5, 4, 4, 5],
    [4, 4, 5, 5],
    [4, 4, 4, 5],
    [4, 3, 4, 4],
    [3, 3, 4, 4],
    [3, 2, 3, 4],
  ];
  const evaluations: Schemas["VendorEvaluationDto"][] = [];
  liftScores.forEach((scores, index) => {
    const month = monthOf(index - 7);
    const breaches =
      index >= 4
        ? [
            breach("response", "ลิฟต์ L2 ค้างระหว่างชั้น 7–8", "urgent", 2, 5.5, index * 10 + 1),
            ...(index === 5
              ? [
                  breach("resolve", "ประตูลิฟต์ L1 ปิดไม่สนิท", "high", 48, 76, index * 10 + 2),
                  breach("request_sla", "ผู้อยู่อาศัยแจ้งลิฟต์มีเสียงดัง", "normal", null, null, index * 10 + 3),
                ]
              : []),
          ]
        : [];
    sla[`${VC.lift}:${month}`] = { workOrders: 3 + (index % 3), breaches };
    evaluations.push(
      evaluation(VC.lift, V.lift, month, scores, sla[`${VC.lift}:${month}`]!, {
        incidents: index === 5 ? 1 : 0,
        incidentNote: index === 5 ? "ลิฟต์ค้างมีผู้โดยสารติดอยู่ 40 นาที" : null,
        note: index === 5 ? "ตอบรับช้ากว่าเดิม ขอให้ผู้ให้บริการส่งแผนแก้ไข" : null,
        evaluatedBy: index % 2 ? COMMITTEE_USER : OWNER_USER,
      }),
    );
  });
  // The month the lift contract still waits for: its breaches are already known.
  sla[`${VC.lift}:${monthOf(-1)}`] = {
    workOrders: 4,
    breaches: [
      breach("response", "ลิฟต์ L1 หยุดที่ชั้น 3 ประตูไม่เปิด", "urgent", 2, 3.25, 71),
      breach("resolve", "ปุ่มเรียกลิฟต์ชั้น 12 ไม่ทำงาน", "normal", 72, 96, 72),
    ],
  };
  sla[`${VC.lift}:${monthOf(0)}`] = { workOrders: 1, breaches: [] };
  const securityScores: [number, number, number, number][] = [
    [3, 3, 3, 4],
    [3, 4, 3, 4],
    [4, 4, 4, 4],
    [4, 4, 4, 5],
    [5, 4, 5, 5],
  ];
  securityScores.forEach((scores, index) => {
    const month = monthOf(index - 5);
    const breaches = index === 0 ? [breach("response", "ไม่มีผู้รับวิทยุจุดตรวจลานจอด", "high", 2, 3, 90)] : [];
    sla[`${VC.security}:${month}`] = { workOrders: 2, breaches };
    evaluations.push(evaluation(VC.security, V.security, month, scores, sla[`${VC.security}:${month}`]!));
  });

  // Preventive plans under contracts and the building's equipment --------------------------------------------------
  const assets: Schemas["BuildingAssetItemDto"][] = [
    assetItem(ASSET.liftL1, "ลิฟต์โดยสาร L1", "lift"),
    assetItem(ASSET.liftL2, "ลิฟต์โดยสาร L2", "lift"),
    assetItem(ASSET.firePanel, "ตู้ควบคุมระบบแจ้งเหตุเพลิงไหม้", "fire_safety"),
    assetItem(ASSET.pumpSet, "ปั๊มน้ำดีชุดที่ 1–3", "pump"),
    assetItem(ASSET.generator, "เครื่องกำเนิดไฟฟ้าสำรอง", "generator"),
  ];
  const plan = (
    id: string,
    asset: string,
    title: string,
    intervalDays: number,
    nextDueOn: string,
    contractId: string | null,
    vendorName: string | null,
  ): Schemas["MaintenancePlanDto"] => ({
    id,
    buildingId: J.buildingA,
    assetItemId: asset,
    assetItemName: assets.find((item) => item.id === asset)!.name,
    categoryId: null,
    title,
    description: null,
    intervalDays,
    leadDays: 7,
    nextDueOn,
    assigneeUserId: null,
    assigneePartyId: null,
    isActive: true,
    lastWorkOrderId: null,
    vendorContractId: contractId,
    vendorName,
    version: 1,
  });
  const plans = [
    plan(vid("91a0b001", 1), ASSET.liftL1, "ตรวจเช็กลิฟต์ L1 ประจำเดือน", 30, date(9), VC.lift, name(V.lift)),
    plan(vid("91a0b001", 2), ASSET.liftL2, "ตรวจเช็กลิฟต์ L2 ประจำเดือน", 30, date(9), VC.lift, name(V.lift)),
    plan(vid("91a0b001", 3), ASSET.firePanel, "ทดสอบระบบแจ้งเหตุเพลิงไหม้", 180, date(40), VC.fire, name(V.fire)),
    plan(vid("91a0b001", 4), ASSET.generator, "เดินเครื่องกำเนิดไฟฟ้าสำรอง", 30, date(4), null, null),
  ];

  const world: MockVendorsWorld = { vendors, contracts, rounds, evaluations, sla, plans, assets };
  refreshActiveContracts(world);
  return world;
}

function assetItem(id: string, name: string, category: Schemas["AssetCategory"]): Schemas["BuildingAssetItemDto"] {
  return {
    id,
    name,
    category,
    status: "active",
    unitId: null,
    floorId: null,
    location: category === "lift" ? "โถงลิฟต์ชั้น 1" : "ห้องเครื่องชั้นใต้ดิน",
    manufacturer: null,
    model: null,
    serial: null,
    installDate: null,
    warrantyUntil: null,
  };
}

function refreshActiveContracts(world: MockVendorsWorld) {
  for (const item of world.vendors)
    item.dto.activeContracts = world.contracts.filter(
      (candidate) => candidate.vendorId === item.dto.id && candidate.state === "active",
    ).length;
}

// ── Views ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const w = () => state.vendors;
const juristicOnly = (ok: Ok) => ok.tenantId === JURISTIC_TENANT;
const userOf = (ok: Ok) => ok.persona.user.id;
const has = (ok: Ok, permission: string) => allowed(ok, "owner.juristicVendors.list", permission) === null;
const vendorOf = (id: string | null | undefined) => w().vendors.find((candidate) => candidate.dto.id === id);
const buildingNameOf = (id: string) =>
  state.juristic.buildings.find((building) => building.id === id)?.name ?? (id === J.soi1 ? "ซอย 1" : "อาคาร A");

function contractActions(item: MockContract, ok: Ok): string[] {
  const manage = has(ok, "juristic.vendor.manage");
  const evaluate = has(ok, "juristic.vendor.evaluate");
  const out: string[] = [];
  if (item.state === "draft" && manage) out.push("edit", "activate", "attach");
  if (item.state === "active") {
    if (manage && !item.renewalId) out.push("renew");
    if (manage) out.push("terminate", "attach");
  }
  if (item.state === "expired" && manage && !item.renewalId) out.push("renew", "attach");
  if ((item.state === "active" || item.state === "expired") && evaluate) out.push("evaluate");
  return out;
}

function summaryOf(list: Schemas["VendorEvaluationDto"][]): Schemas["EvaluationSummaryDto"] {
  const last6 = list.slice(-6);
  if (last6.length === 0) return { count: 0, averageScore: null, lastScore: null, trend: null, slaBreaches: 0 };
  const scores = last6.map((entry) => Number(entry.score));
  const average = scores.reduce((total, value) => total + value, 0) / scores.length;
  const last = scores.at(-1)!;
  let trend: Schemas["EvaluationTrend"] | null = null;
  if (scores.length >= 2) {
    const before = scores.slice(0, -1);
    const mean = before.reduce((total, value) => total + value, 0) / before.length;
    trend = last - mean > 0.25 ? "improving" : mean - last > 0.25 ? "declining" : "steady";
  }
  return {
    count: last6.length,
    averageScore: average.toFixed(2),
    lastScore: last.toFixed(2),
    trend,
    slaBreaches: last6.reduce((total, entry) => total + entry.slaBreaches, 0),
  };
}

function refreshInstalments(item: MockContract) {
  for (const instalment of item.instalments) {
    if (!instalment.expenseRequestId) continue;
    const expense = state.accounting.expenses.find((candidate) => candidate.id === instalment.expenseRequestId);
    if (expense) {
      instalment.expenseRequestState = expense.state;
      instalment.expenseRequestNumber = expense.number;
    }
  }
}

function listView(item: MockContract): Schemas["VendorContractDto"] {
  const daysLeft = daysBetween(date(), item.endsOn);
  return {
    id: item.id,
    buildingId: item.buildingId,
    buildingName: item.buildingName,
    vendorId: item.vendorId,
    vendorName: item.vendorName,
    title: item.title,
    category: item.category,
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    renewalNoticeDays: item.renewalNoticeDays,
    noticeBy: addDays(item.endsOn, -item.renewalNoticeDays),
    daysLeft,
    value: item.value,
    state: item.state,
    renewsContractId: item.renewsContractId,
    renewalId: item.renewalId,
    createdAt: item.createdAt,
    version: item.version,
  };
}

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function detailView(item: MockContract, ok: Ok): Schemas["VendorContractDetailDto"] {
  refreshInstalments(item);
  const evaluations = w()
    .evaluations.filter((entry) => entry.contractId === item.id)
    .sort((a, b) => a.month.localeCompare(b.month));
  const rest: Partial<MockContract> = { ...item };
  delete rest.activatedBy;
  const account = state.accounting.accounts.find((candidate) => candidate.id === item.expenseAccountId);
  return {
    ...(rest as Omit<MockContract, "activatedBy">),
    ...listView(item),
    expenseAccountCode: account?.code ?? null,
    instalmentsTotal: baht(
      item.instalments
        .filter((instalment) => instalment.state !== "cancelled")
        .reduce((total, instalment) => total + satang(instalment.amount), 0),
    ),
    evaluations,
    evaluationSummary: summaryOf(evaluations),
    maintenancePlans: w()
      .plans.filter((plan) => plan.vendorContractId === item.id)
      .map((plan) => ({
        id: plan.id,
        title: plan.title,
        assetItemId: plan.assetItemId,
        assetItemName: plan.assetItemName,
        intervalDays: plan.intervalDays,
        nextDueOn: plan.nextDueOn,
        isActive: plan.isActive,
        lastWorkOrderId: plan.lastWorkOrderId,
        lastWorkOrderStatus: plan.lastWorkOrderId ? "done" : null,
      })),
    expenseRequests: state.accounting.expenses
      .filter((expense) => expense.vendorContractId === item.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map((expense) => ({ id: expense.id, number: expense.number, state: expense.state, amount: expense.amount })),
    nextActions: contractActions(item, ok),
  };
}

function roundActions(item: Schemas["QuotationRoundDto"], ok: Ok): string[] {
  const manage = has(ok, "juristic.vendor.manage");
  const out: string[] = [];
  if (item.state === "open" && manage) {
    out.push("add_quotation");
    if (item.quotations.length > 0) out.push("award");
    out.push("cancel");
  }
  if (item.state === "awaiting_approval") {
    const user = userOf(ok);
    const role = roleOf(ok) as Schemas["ExpenseApproverRole"] | null;
    const decided = item.approvals.some(
      (entry) => entry.approverUserId === user && entry.createdAt >= (item.awardRequestedAt ?? ""),
    );
    if (
      has(ok, "juristic.expense.approve") &&
      role &&
      item.approverRoles.includes(role) &&
      item.awardRequestedBy !== user &&
      !decided
    )
      out.push("approve", "reject");
    if (manage) out.push("cancel");
  }
  return out;
}

const roundView = (item: Schemas["QuotationRoundDto"], ok: Ok) => ({
  ...item,
  threshold: quotationThreshold(),
  quotations: [...item.quotations].sort(
    (a, b) => satang(a.amount) - satang(b.amount) || a.receivedOn.localeCompare(b.receivedOn),
  ),
  nextActions: roundActions(item, ok),
});

// ── Rules (the API's `vendor-rules.ts`) ────────────────────────────────────────────────────────────────────────────

/** Thai tax id: 13 digits, the last a mod-11 check digit. */
function taxIdValid(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === digits[12];
}

function planInput(op: string, input: Schemas["InstalmentPlanDto"] | null | undefined) {
  if (!input) return null;
  if (!["monthly", "quarterly", "semiannual", "annual", "once"].includes(input.frequency))
    return validation(op, "instalmentPlan.frequency", "เลือกความถี่");
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 28)
    return validation(op, "instalmentPlan.dueDay", "วันครบกำหนด 1–28");
  if (!MONEY.test(input.amount ?? "") || satang(input.amount) <= 0)
    return validation(op, "instalmentPlan.amount", "จำนวนเงินต่องวดไม่ถูกต้อง");
  if (input.vatAmount && (!MONEY.test(input.vatAmount) || satang(input.vatAmount) > satang(input.amount)))
    return validation(op, "instalmentPlan.vatAmount", "ภาษีมูลค่าเพิ่มต้องไม่เกินจำนวนเงิน");
  return {
    frequency: input.frequency,
    dueDay: input.dueDay,
    amount: baht(satang(input.amount)),
    vatAmount: baht(input.vatAmount ? satang(input.vatAmount) : 0),
    firstDueOn: input.firstDueOn ?? null,
  } satisfies Schemas["InstalmentPlanViewDto"];
}

function slaInput(op: string, terms: Schemas["SlaTermDto"][] | undefined) {
  if (!terms) return [];
  const seen = new Set<string>();
  for (const [index, term] of terms.entries()) {
    if (seen.has(term.priority)) return validation(op, `slaTerms[${index}].priority`, "ระบุแต่ละระดับครั้งเดียว");
    seen.add(term.priority);
    for (const key of ["responseHours", "resolveHours"] as const)
      if (!Number.isInteger(term[key]) || term[key] < 1 || term[key] > 8760)
        return validation(op, `slaTerms[${index}].${key}`, "ชั่วโมง 1–8760");
  }
  return terms;
}

function resolutionAdopted(id: string | null | undefined, buildingId: string) {
  const resolution = state.juristic.resolutions.find((candidate) => candidate.id === id);
  return Boolean(resolution && resolution.state === "adopted" && resolution.buildingId === buildingId);
}

function awardedTo(roundId: string | null | undefined, vendorId: string, buildingId: string) {
  const item = w().rounds.find((candidate) => candidate.id === roundId);
  const awarded = item?.quotations.find((entry) => entry.id === item.awardedQuotationId);
  return Boolean(item && item.state === "awarded" && awarded?.vendorId === vendorId && item.buildingId === buildingId);
}

/** The outcome of an awarded round: a contract draft or an expense request draft with the quotation attached. */
function createOutcome(item: Schemas["QuotationRoundDto"], award: Schemas["QuotationAwardDto"], requester: string) {
  const quote = item.quotations.find((entry) => entry.id === item.awardedQuotationId)!;
  const v = vendorOf(quote.vendorId)!;
  if (item.outcome === "contract") {
    const id = crypto.randomUUID();
    w().contracts.push(
      contract(id, v.dto.id, v.dto.name, {
        title: item.title,
        buildingId: item.buildingId,
        buildingName: item.buildingName,
        category: item.category,
        startsOn: award.startsOn ?? date(1),
        endsOn: award.endsOn ?? date(366),
        value: quote.amount,
        state: "draft",
        scope: item.description,
        quotationRoundId: item.id,
        resolutionId: item.resolutionId,
        expenseAccountId: null,
        whtKey: null,
        createdAt: iso(),
        version: 1,
        documents: [{ documentId: quote.documentId, kind: "other", createdAt: iso() }],
      }),
    );
    item.outcomeContractId = id;
  } else {
    const expense = addVendorExpense({
      buildingId: item.buildingId,
      title: item.title,
      payee: { partyId: v.dto.partyId, name: v.dto.name, taxId: v.taxId },
      accountId: award.accountId ?? ACC.repairs,
      description: item.title,
      amount: quote.amount,
      vatAmount: quote.vatAmount,
      whtKey: award.whtKey ?? null,
      requestedBy: requester,
      state: "draft",
      vendorId: v.dto.id,
      quotationRoundId: item.id,
      attachments: [{ documentId: quote.documentId, kind: "quotation", createdAt: iso() }],
    });
    item.outcomeExpenseRequestId = expense.id;
  }
}

// ── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────────

const vendorHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/vendors", ({ request }) => {
    const op = "owner.juristicVendors.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const forbidden = allowed(ok, op, "juristic.vendor.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    // J-CR: `categories` (repeated or comma-separated; any of) and `partyId`.
    const categories = params
      .getAll("categories")
      .flatMap((value) => value.split(","))
      .filter(Boolean);
    const searched = w()
      .vendors.map((item) => item.dto)
      .filter(
        (dto) =>
          (!params.get("category") || dto.categories.includes(params.get("category") as Schemas["VendorCategory"])) &&
          (!categories.length ||
            categories.some((value) => dto.categories.includes(value as Schemas["VendorCategory"]))) &&
          (!params.get("partyId") || dto.partyId === params.get("partyId")) &&
          (!q || dto.name.toLowerCase().includes(q)),
      );
    const rows = searched
      .filter((dto) => !params.get("state") || dto.state === params.get("state"))
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
    const counts: Schemas["VendorCountsDto"] = {
      all: searched.length,
      active: searched.filter((dto) => dto.state === "active").length,
      blocked: searched.filter((dto) => dto.state === "blocked").length,
    };
    return json({ ...paged(rows, request), counts });
  }),
  http.get("*/v1/owner/juristic/vendors/:id", ({ request, params }) => {
    const op = "owner.juristicVendors.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? vendorOf(String(params.id)) : undefined;
    return found ? json(found.dto) : notFound(op);
  }),
  http.post("*/v1/owner/juristic/vendors", async ({ request }) => {
    const op = "owner.juristicVendors.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["VendorCreateDto"]>(request);
    record(op, request, input);
    const party = input.partyId ? state.juristic.parties.find((candidate) => candidate.id === input.partyId) : null;
    if (input.partyId && !party) return validation(op, "partyId", "ไม่พบบุคคลนี้ในทะเบียน");
    if (input.partyId && w().vendors.some((item) => item.dto.partyId === input.partyId))
      return problem(op, "vendor.exists");
    const name = input.name?.trim() || party?.displayName || "";
    if (!name) return validation(op, "name", "กรอกชื่อผู้ให้บริการ");
    if (input.taxId && !taxIdValid(input.taxId))
      return validation(op, "taxId", "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (13 หลัก หลักสุดท้ายไม่ตรง)");
    if (input.bankAccountLast4 && !/^\d{4}$/.test(input.bankAccountLast4))
      return validation(op, "bankAccountLast4", "เลขบัญชี 4 หลักท้ายเท่านั้น");
    const id = crypto.randomUUID();
    const created = vendor(id, input.partyId ?? crypto.randomUUID(), name, {
      partyType: input.type ?? party?.type ?? "company",
      taxId: input.taxId ?? null,
      categories: input.categories ?? [],
      contactName: input.contactName?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      bankName: input.bankName?.trim() || null,
      bankAccountName: input.bankAccountName?.trim() || null,
      bankAccountLast4: input.bankAccountLast4 || null,
      note: input.note?.trim() || null,
      createdAt: iso(),
    });
    w().vendors.push(created);
    return json(created.dto, 201);
  }),
  http.patch("*/v1/owner/juristic/vendors/:id", async ({ request, params }) => {
    const op = "owner.juristicVendors.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? vendorOf(String(params.id)) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["VendorUpdateDto"]>(request);
    record(op, request, input);
    if (input.version !== undefined && input.version !== found.dto.version) return problem(op, "concurrency.stale");
    if (input.taxId && !taxIdValid(input.taxId))
      return validation(op, "taxId", "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (13 หลัก หลักสุดท้ายไม่ตรง)");
    if (input.bankAccountLast4 && !/^\d{4}$/.test(input.bankAccountLast4))
      return validation(op, "bankAccountLast4", "เลขบัญชี 4 หลักท้ายเท่านั้น");
    if (input.state === "blocked" && (input.blockedReason?.trim().length ?? 0) < 3)
      return validation(op, "blockedReason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
    const dto = found.dto;
    if (input.name !== undefined) dto.name = input.name.trim() || dto.name;
    if (input.taxId !== undefined) {
      found.taxId = input.taxId;
      dto.taxIdHint = input.taxId ? input.taxId.slice(-4) : null;
    }
    for (const key of [
      "categories",
      "contactName",
      "contactPhone",
      "contactEmail",
      "bankName",
      "bankAccountName",
      "bankAccountLast4",
      "note",
    ] as const)
      if (input[key] !== undefined) (dto as Record<string, unknown>)[key] = input[key];
    if (input.state) {
      dto.state = input.state;
      dto.blockedReason = input.state === "blocked" ? input.blockedReason!.trim() : null;
    }
    dto.version += 1;
    return json(dto);
  }),
];

const contractHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/vendor-contracts", ({ request }) => {
    const op = "owner.juristicVendorContracts.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const forbidden = allowed(ok, op, "juristic.vendor.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const within = params.get("endingWithinDays");
    const scoped = w()
      .contracts.map(listView)
      .filter(
        (row) =>
          (!params.get("vendorId") || row.vendorId === params.get("vendorId")) &&
          (!params.get("buildingId") || row.buildingId === params.get("buildingId")),
      );
    const rows = scoped
      .filter(
        (row) =>
          (!params.get("state") || row.state === params.get("state")) &&
          (within === null || (row.state === "active" && row.daysLeft >= 0 && row.daysLeft <= Number(within))) &&
          (!q || row.title.toLowerCase().includes(q) || row.vendorName.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.endsOn.localeCompare(b.endsOn));
    // J-CR tab badges: per state for the vendor / building (not the search) and the renewal queue.
    const window = within === null ? 90 : Number(within);
    const of = (state: Schemas["VendorContractState"]) => scoped.filter((row) => row.state === state).length;
    const counts: Schemas["VendorContractCountsDto"] = {
      all: scoped.length,
      draft: of("draft"),
      active: of("active"),
      expired: of("expired"),
      terminated: of("terminated"),
      endingSoon: scoped.filter((row) => row.state === "active" && row.daysLeft <= window).length,
      endingWithinDays: window,
    };
    return json({ ...paged(rows, request), counts });
  }),
  http.get("*/v1/owner/juristic/vendor-contracts/:id", ({ request, params }) => {
    const op = "owner.juristicVendorContracts.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().contracts.find((item) => item.id === params.id) : undefined;
    return found ? json(detailView(found, ok)) : notFound(op);
  }),
  http.post("*/v1/owner/juristic/vendor-contracts", async ({ request }) => {
    const op = "owner.juristicVendorContracts.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["VendorContractCreateDto"]>(request);
    record(op, request, input);
    const v = vendorOf(input.vendorId);
    if (!v) return validation(op, "vendorId", "เลือกผู้ให้บริการ");
    if (v.dto.state === "blocked") return problem(op, "vendor.blocked");
    if (!input.title?.trim()) return validation(op, "title", "กรอกชื่อสัญญา");
    if (!input.startsOn || !input.endsOn || input.endsOn <= input.startsOn)
      return validation(op, "endsOn", "วันสิ้นสุดต้องหลังวันเริ่ม");
    if (!MONEY.test(input.value ?? "")) return validation(op, "value", "มูลค่าสัญญาไม่ถูกต้อง");
    const sla = slaInput(op, input.slaTerms);
    if (sla instanceof Response) return sla;
    const plan = planInput(op, input.instalmentPlan);
    if (plan instanceof Response) return plan;
    if (input.resolutionId && !resolutionAdopted(input.resolutionId, input.buildingId))
      return problem(op, "fund.resolution_invalid");
    if (input.quotationRoundId && !awardedTo(input.quotationRoundId, v.dto.id, input.buildingId))
      return validation(op, "quotationRoundId", "ต้องเป็นรอบใบเสนอราคาที่ให้งานผู้ให้บริการนี้แล้ว");
    const created = contract(crypto.randomUUID(), v.dto.id, v.dto.name, {
      title: input.title.trim(),
      buildingId: input.buildingId,
      buildingName: buildingNameOf(input.buildingId),
      category: input.category ?? null,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      renewalNoticeDays: input.renewalNoticeDays ?? 60,
      value: baht(satang(input.value)),
      state: "draft",
      scope: input.scope?.trim() || null,
      slaTerms: sla,
      expenseAccountId: input.expenseAccountId ?? null,
      whtKey: input.whtKey ?? null,
      instalmentPlan: plan,
      penaltyClauses: input.penaltyClauses?.trim() || null,
      quotationRoundId: input.quotationRoundId ?? null,
      resolutionId: input.resolutionId ?? null,
      note: input.note?.trim() || null,
      createdAt: iso(),
      version: 1,
    });
    w().contracts.push(created);
    return json(detailView(created, ok), 201);
  }),
  http.patch("*/v1/owner/juristic/vendor-contracts/:id", async ({ request, params }) => {
    const op = "owner.juristicVendorContracts.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().contracts.find((item) => item.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["VendorContractUpdateDto"]>(request);
    record(op, request, input);
    if (found.state !== "draft") return problem(op, "vendor_contract.invalid_state");
    if (input.version !== undefined && input.version !== found.version) return problem(op, "concurrency.stale");
    if (input.slaTerms) {
      const sla = slaInput(op, input.slaTerms);
      if (sla instanceof Response) return sla;
      found.slaTerms = sla;
    }
    if (input.instalmentPlan !== undefined) {
      const plan = planInput(op, input.instalmentPlan);
      if (plan instanceof Response) return plan;
      found.instalmentPlan = plan;
    }
    if (input.value !== undefined) {
      if (!MONEY.test(input.value)) return validation(op, "value", "มูลค่าสัญญาไม่ถูกต้อง");
      found.value = baht(satang(input.value));
    }
    if (input.resolutionId && !resolutionAdopted(input.resolutionId, found.buildingId))
      return validation(op, "resolutionId", "ต้องเป็นมติที่รับรองแล้วของอาคารนี้");
    if (input.quotationRoundId && !awardedTo(input.quotationRoundId, found.vendorId, found.buildingId))
      return validation(op, "quotationRoundId", "ต้องเป็นรอบใบเสนอราคาที่ให้งานผู้ให้บริการนี้แล้ว");
    for (const key of [
      "title",
      "category",
      "startsOn",
      "endsOn",
      "renewalNoticeDays",
      "scope",
      "expenseAccountId",
      "whtKey",
      "penaltyClauses",
      "quotationRoundId",
      "resolutionId",
      "note",
    ] as const)
      if (input[key] !== undefined) (found as unknown as Record<string, unknown>)[key] = input[key];
    if (found.endsOn <= found.startsOn) return validation(op, "endsOn", "วันสิ้นสุดต้องหลังวันเริ่ม");
    found.version += 1;
    return json(detailView(found, ok));
  }),
  http.post("*/v1/owner/juristic/vendor-contracts/:id/documents", async ({ request, params }) => {
    const op = "owner.juristicVendorContracts.attach";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().contracts.find((item) => item.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["ContractDocumentAttachDto"]>(request);
    record(op, request, input);
    if (!input.documentId) return validation(op, "documentId", "แนบไฟล์");
    if (!found.documents.some((entry) => entry.documentId === input.documentId))
      found.documents.push({ documentId: input.documentId, kind: input.kind ?? "other", createdAt: iso() });
    return json(detailView(found, ok));
  }),
  http.post("*/v1/owner/juristic/vendor-contracts/:id/actions/:action", async ({ request, params }) => {
    const action = params.action as "activate" | "renew" | "terminate";
    const op = {
      activate: "owner.juristicVendorContracts.activate",
      renew: "owner.juristicVendorContracts.renew",
      terminate: "owner.juristicVendorContracts.terminate",
    }[action];
    if (!op) return undefined;
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().contracts.find((item) => item.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const v = vendorOf(found.vendorId)!;
      switch (action) {
        case "activate": {
          if (found.state !== "draft") return problem(op, "vendor_contract.invalid_state");
          if (v.dto.state === "blocked") return problem(op, "vendor.blocked");
          if (satang(found.value) > satang(quotationThreshold())) {
            const fromRound = awardedTo(found.quotationRoundId, found.vendorId, found.buildingId);
            const renewalByResolution =
              Boolean(found.renewsContractId) && resolutionAdopted(found.resolutionId, found.buildingId);
            if (!fromRound && !renewalByResolution) return problem(op, "vendor_contract.quotations_required");
          }
          if (found.instalmentPlan && !found.expenseAccountId)
            return validation(op, "expenseAccountId", "เลือกบัญชีค่าใช้จ่ายของงวดชำระก่อนเปิดใช้สัญญา");
          const instalments = found.instalmentPlan
            ? schedule(found.instalmentPlan, found.startsOn, found.endsOn, found.title)
            : [];
          const total = instalments.reduce((sum, instalment) => sum + satang(instalment.amount), 0);
          if (total > satang(found.value)) return problem(op, "vendor_contract.schedule_invalid");
          found.instalments = instalments;
          found.state = "active";
          found.activatedAt = iso();
          found.activatedBy = userOf(ok);
          found.version += 1;
          refreshActiveContracts(w());
          return { status: 200, body: detailView(found, ok) };
        }
        case "renew": {
          if (found.state !== "active" && found.state !== "expired")
            return problem(op, "vendor_contract.invalid_state");
          if (found.renewalId) return problem(op, "vendor_contract.already_renewed");
          if (v.dto.state === "blocked") return problem(op, "vendor.blocked");
          const input = payload as unknown as Schemas["VendorContractRenewDto"];
          const startsOn = input.startsOn ?? addDays(found.endsOn, 1);
          if (!input.endsOn || input.endsOn <= startsOn) return validation(op, "endsOn", "วันสิ้นสุดต้องหลังวันเริ่ม");
          if (input.value !== undefined && !MONEY.test(input.value))
            return validation(op, "value", "มูลค่าสัญญาไม่ถูกต้อง");
          if (input.resolutionId && !resolutionAdopted(input.resolutionId, found.buildingId))
            return problem(op, "fund.resolution_invalid");
          const plan = input.instalmentPlan === undefined ? found.instalmentPlan : planInput(op, input.instalmentPlan);
          if (plan instanceof Response) return plan;
          const renewal = contract(crypto.randomUUID(), found.vendorId, found.vendorName, {
            ...found,
            id: undefined as never,
            state: "draft",
            startsOn,
            endsOn: input.endsOn,
            value: input.value ? baht(satang(input.value)) : found.value,
            instalmentPlan: plan,
            renewsContractId: found.id,
            renewalId: null,
            quotationRoundId: null,
            resolutionId: input.resolutionId ?? null,
            activatedAt: null,
            activatedBy: null,
            terminatedOn: null,
            terminationReason: null,
            expiredAt: null,
            instalments: [],
            alerts: [],
            documents: [],
            createdAt: iso(),
            version: 1,
          });
          renewal.id = crypto.randomUUID();
          w().contracts.push(renewal);
          found.renewalId = renewal.id;
          found.version += 1;
          return { status: 200, body: detailView(renewal, ok) };
        }
        case "terminate": {
          if (found.state !== "active") return problem(op, "vendor_contract.invalid_state");
          const input = payload as unknown as Schemas["VendorContractTerminateDto"];
          const reason = input.reason?.trim() ?? "";
          if (reason.length < 3) return validation(op, "reason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
          const effectiveOn = input.effectiveOn ?? date();
          if (effectiveOn < date() || effectiveOn > found.endsOn)
            return validation(op, "effectiveOn", "ตั้งแต่วันนี้ถึงวันสิ้นสุดสัญญา");
          for (const instalment of found.instalments)
            if (instalment.state === "scheduled" && instalment.dueOn >= effectiveOn) {
              instalment.state = "cancelled";
              instalment.cancelledAt = iso();
            }
          for (const plan of w().plans) if (plan.vendorContractId === found.id) plan.isActive = false;
          found.state = "terminated";
          found.terminatedOn = effectiveOn;
          found.terminationReason = reason;
          found.version += 1;
          refreshActiveContracts(w());
          return { status: 200, body: detailView(found, ok) };
        }
      }
    });
  }),
  http.get("*/v1/owner/juristic/vendor-contracts/:id/sla-breaches", ({ request, params }) => {
    const op = "owner.juristicVendorContracts.slaBreaches";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().contracts.find((item) => item.id === params.id) : undefined;
    if (!found) return notFound(op);
    const month = query(request).get("month") ?? monthOf(0);
    if (!MONTH.test(month)) return validation(op, "month", "YYYY-MM");
    const known = w().sla[`${found.id}:${month}`];
    return json({
      month,
      workOrders: known?.workOrders ?? 0,
      breaches: known?.breaches ?? [],
    } satisfies Schemas["SlaMonthDto"]);
  }),
  http.get("*/v1/owner/juristic/vendor-contracts/:id/evaluations", ({ request, params }) => {
    const op = "owner.juristicVendorContracts.evaluations";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().contracts.find((item) => item.id === params.id) : undefined;
    if (!found) return notFound(op);
    return json({
      data: w()
        .evaluations.filter((entry) => entry.contractId === found.id)
        .sort((a, b) => a.month.localeCompare(b.month)),
    } satisfies Schemas["VendorEvaluationListDto"]);
  }),
  http.post("*/v1/owner/juristic/vendor-contracts/:id/evaluations", async ({ request, params }) => {
    const op = "owner.juristicVendorContracts.evaluate";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().contracts.find((item) => item.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.evaluate");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["VendorEvaluationCreateDto"];
      if (found.state === "draft") return problem(op, "vendor_contract.invalid_state");
      if (!MONTH.test(input.month ?? "")) return validation(op, "month", "เลือกเดือน");
      if (input.month < found.startsOn.slice(0, 7) || input.month > found.endsOn.slice(0, 7))
        return validation(op, "month", "ต้องเป็นเดือนในระยะสัญญา");
      if (input.month > monthOf(0)) return validation(op, "month", "ประเมินล่วงหน้าไม่ได้");
      if (w().evaluations.some((entry) => entry.contractId === found.id && entry.month === input.month))
        return problem(op, "vendor_evaluation.exists");
      const list = criteria();
      const scores: Schemas["EvaluationScoreDto"][] = [];
      for (const [index, criterion] of list.entries()) {
        const given = input.scores?.find((entry) => entry.criterion === criterion.key);
        if (!given || !Number.isInteger(given.score) || given.score < 1 || given.score > 5)
          return validation(op, `scores[${index}].score`, `ให้คะแนน ${criterion.labelTh} 1–5`);
        scores.push({
          criterion: criterion.key,
          labelTh: criterion.labelTh,
          labelEn: criterion.labelEn,
          score: given.score,
        });
      }
      const sla = w().sla[`${found.id}:${input.month}`] ?? { workOrders: 0, breaches: [] };
      const created: Schemas["VendorEvaluationDto"] = {
        id: crypto.randomUUID(),
        contractId: found.id,
        vendorId: found.vendorId,
        month: input.month,
        scores,
        score: (scores.reduce((total, entry) => total + entry.score, 0) / scores.length).toFixed(2),
        incidents: input.incidents ?? 0,
        incidentNote: input.incidentNote?.trim() || null,
        slaBreaches: sla.breaches.length,
        slaItems: sla.breaches,
        workOrders: sla.workOrders,
        note: input.note?.trim() || null,
        evaluatedBy: userOf(ok),
        createdAt: iso(),
      };
      w().evaluations.push(created);
      return { status: 201, body: created };
    });
  }),
];

const roundHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/quotation-rounds", ({ request }) => {
    const op = "owner.juristicQuotations.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const forbidden = allowed(ok, op, "juristic.vendor.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const scoped = w()
      .rounds.map((item) => roundView(item, ok))
      .filter((row) => !params.get("buildingId") || row.buildingId === params.get("buildingId"));
    const rows = scoped
      .filter(
        (row) =>
          (!params.get("state") || row.state === params.get("state")) &&
          (params.get("awaitingMe") !== "true" || row.nextActions.includes("approve")) &&
          (!q || row.title.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // J-CR tab badges: per state for the building (not the search) and the awards awaiting the caller.
    const of = (state: Schemas["QuotationRoundState"]) => scoped.filter((row) => row.state === state).length;
    const counts: Schemas["QuotationRoundCountsDto"] = {
      all: scoped.length,
      awaitingMe: scoped.filter((row) => row.nextActions.includes("approve")).length,
      open: of("open"),
      awaitingApproval: of("awaiting_approval"),
      awarded: of("awarded"),
      cancelled: of("cancelled"),
    };
    return json({ ...paged(rows, request), counts });
  }),
  http.get("*/v1/owner/juristic/quotation-rounds/:id", ({ request, params }) => {
    const op = "owner.juristicQuotations.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().rounds.find((item) => item.id === params.id) : undefined;
    return found ? json(roundView(found, ok)) : notFound(op);
  }),
  http.post("*/v1/owner/juristic/quotation-rounds", async ({ request }) => {
    const op = "owner.juristicQuotations.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["QuotationRoundCreateDto"]>(request);
    record(op, request, input);
    if (!input.title?.trim()) return validation(op, "title", "กรอกเรื่องที่ขอใบเสนอราคา");
    if (!input.buildingId) return validation(op, "buildingId", "เลือกอาคาร");
    if (input.estimatedAmount && !MONEY.test(input.estimatedAmount))
      return validation(op, "estimatedAmount", "จำนวนเงินไม่ถูกต้อง");
    const created = round(crypto.randomUUID(), input.title.trim(), {
      state: "open",
      buildingId: input.buildingId,
      buildingName: buildingNameOf(input.buildingId),
      category: input.category ?? null,
      description: input.description?.trim() || null,
      estimatedAmount: input.estimatedAmount ? baht(satang(input.estimatedAmount)) : null,
      createdAt: iso(),
    });
    w().rounds.unshift(created);
    return json(roundView(created, ok), 201);
  }),
  http.post("*/v1/owner/juristic/quotation-rounds/:id/quotations", async ({ request, params }) => {
    const op = "owner.juristicQuotations.addQuotation";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().rounds.find((item) => item.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.vendor.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["QuotationCreateDto"]>(request);
    record(op, request, input);
    if (found.state !== "open") return problem(op, "quotation_round.invalid_state");
    const v = vendorOf(input.vendorId);
    if (!v) return validation(op, "vendorId", "เลือกผู้ให้บริการ");
    if (v.dto.state === "blocked") return problem(op, "vendor.blocked");
    if (found.quotations.some((entry) => entry.vendorId === v.dto.id)) return problem(op, "quotation.exists");
    if (!MONEY.test(input.amount ?? "") || satang(input.amount) <= 0)
      return validation(op, "amount", "จำนวนเงินไม่ถูกต้อง");
    if (input.vatAmount && (!MONEY.test(input.vatAmount) || satang(input.vatAmount) > satang(input.amount)))
      return validation(op, "vatAmount", "ภาษีมูลค่าเพิ่มต้องไม่เกินจำนวนเงิน");
    if (!input.validUntil) return validation(op, "validUntil", "ระบุวันที่ราคายืนถึง");
    if (input.receivedOn && input.receivedOn > date())
      return validation(op, "receivedOn", "วันที่รับต้องไม่เกินวันนี้");
    if (!input.documentId) return validation(op, "documentId", "แนบใบเสนอราคา");
    found.quotations.push({
      id: crypto.randomUUID(),
      vendorId: v.dto.id,
      vendorName: v.dto.name,
      amount: baht(satang(input.amount)),
      vatAmount: baht(input.vatAmount ? satang(input.vatAmount) : 0),
      validUntil: input.validUntil,
      documentId: input.documentId,
      receivedOn: input.receivedOn ?? date(),
      note: input.note?.trim() || null,
    });
    found.version += 1;
    return json(roundView(found, ok));
  }),
  http.post("*/v1/owner/juristic/quotation-rounds/:id/actions/:action", async ({ request, params }) => {
    const action = params.action as "award" | "approve" | "reject" | "cancel";
    const op = {
      award: "owner.juristicQuotations.award",
      approve: "owner.juristicQuotations.approve",
      reject: "owner.juristicQuotations.reject",
      cancel: "owner.juristicQuotations.cancel",
    }[action];
    if (!op) return undefined;
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().rounds.find((item) => item.id === params.id) : undefined;
    if (!found) return notFound(op);
    const permission =
      action === "approve" || action === "reject" ? "juristic.expense.approve" : "juristic.vendor.manage";
    const forbidden = allowed(ok, op, permission);
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const user = userOf(ok);
      switch (action) {
        case "award": {
          if (found.state !== "open") return problem(op, "quotation_round.invalid_state");
          const input = payload as unknown as Schemas["QuotationAwardDto"];
          const quote = found.quotations.find((entry) => entry.id === input.quotationId);
          if (!quote) return validation(op, "quotationId", "เลือกใบเสนอราคา");
          if (quote.validUntil < date()) return problem(op, "quotation.expired");
          if (vendorOf(quote.vendorId)?.dto.state === "blocked") return problem(op, "vendor.blocked");
          if (input.outcome === "contract" && (!input.startsOn || !input.endsOn || input.endsOn <= input.startsOn))
            return validation(op, "endsOn", "ระบุระยะสัญญา วันสิ้นสุดต้องหลังวันเริ่ม");
          if (input.outcome === "expense" && !input.accountId)
            return validation(op, "accountId", "เลือกบัญชีค่าใช้จ่าย");
          const above = satang(quote.amount) > satang(quotationThreshold());
          const reason = input.fewerQuotationsReason?.trim() ?? "";
          if (above && found.quotations.length < found.minimumQuotations) {
            if (!reason) return problem(op, "quotation.minimum_not_met");
            if (reason.length < 10) return validation(op, "fewerQuotationsReason", "เหตุผลอย่างน้อย 10 ตัวอักษร");
          }
          if (input.basis === "resolution") {
            if (!input.resolutionId) return problem(op, "fund.resolution_required");
            if (!resolutionAdopted(input.resolutionId, found.buildingId)) return problem(op, "fund.resolution_invalid");
          }
          Object.assign(found, {
            awardedQuotationId: quote.id,
            outcome: input.outcome,
            basis: input.basis,
            resolutionId: input.resolutionId ?? null,
            aboveThreshold: above,
            fewerQuotationsReason: reason || null,
            awardRequestedBy: user,
            awardRequestedAt: iso(),
            approvalsGiven: 0,
          });
          if (input.basis === "resolution") {
            found.state = "awarded";
            found.awardedAt = iso();
            found.approvalsRequired = null;
            found.approverRoles = [];
            createOutcome(found, input, user);
          } else {
            const band = expenseBandFor(quote.amount);
            found.state = "awaiting_approval";
            found.approvalsRequired = band.approvals;
            found.approverRoles = band.roles;
            (found as unknown as { award: Schemas["QuotationAwardDto"] }).award = input;
          }
          found.version += 1;
          return { status: 200, body: roundView(found, ok) };
        }
        case "approve":
        case "reject": {
          if (found.state !== "awaiting_approval") return problem(op, "quotation_round.invalid_state");
          const role = roleOf(ok) as Schemas["ExpenseApproverRole"];
          if (found.awardRequestedBy === user) return problem(op, "quotation.maker_checker");
          if (
            found.approvals.some(
              (entry) => entry.approverUserId === user && entry.createdAt >= (found.awardRequestedAt ?? ""),
            )
          )
            return problem(op, "quotation.already_decided");
          if (!found.approverRoles.includes(role)) return problem(op, "quotation.not_in_band");
          const reason = (payload.reason as string | undefined)?.trim() || null;
          if (action === "reject" && (!reason || reason.length < 3))
            return validation(op, "reason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
          found.approvals.push({
            approverUserId: user,
            role,
            decision: action === "approve" ? "approved" : "rejected",
            reason,
            createdAt: iso(),
          });
          if (action === "reject") {
            Object.assign(found, {
              state: "open",
              awardedQuotationId: null,
              outcome: null,
              basis: null,
              aboveThreshold: null,
              approvalsRequired: null,
              approverRoles: [],
              approvalsGiven: 0,
              awardRequestedBy: null,
              awardRequestedAt: null,
            });
          } else {
            found.approvalsGiven += 1;
            if (found.approvalsGiven >= (found.approvalsRequired ?? 1)) {
              found.state = "awarded";
              found.awardedAt = iso();
              const award = (found as unknown as { award?: Schemas["QuotationAwardDto"] }).award ?? {
                quotationId: found.awardedQuotationId!,
                outcome: found.outcome!,
                basis: "approval",
              };
              createOutcome(found, award, found.awardRequestedBy ?? user);
            }
          }
          found.version += 1;
          return { status: 200, body: roundView(found, ok) };
        }
        case "cancel": {
          if (found.state !== "open" && found.state !== "awaiting_approval")
            return problem(op, "quotation_round.invalid_state");
          const reason = (payload.reason as string | undefined)?.trim() ?? "";
          if (reason.length < 3) return validation(op, "reason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
          Object.assign(found, { state: "cancelled", cancelledAt: iso(), cancelReason: reason });
          found.version += 1;
          return { status: 200, body: roundView(found, ok) };
        }
      }
    });
  }),
];

/**
 * Preventive plans and the building's equipment for the juristic tenant (the r2 world answers the apartment tenant):
 * registered before the r2 handlers, falling through for every other tenant.
 */
export const vendorPlanHandlers: HttpHandler[] = [
  http.get("*/v1/owner/maintenance-plans", ({ request }) => {
    const op = "owner.maintenancePlans.list";
    const ok = owner(request, op);
    if (ok instanceof Response || !juristicOnly(ok)) return undefined;
    const buildingId = query(request).get("buildingId");
    const data = w()
      .plans.filter((plan) => !buildingId || plan.buildingId === buildingId)
      .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn));
    return json({ data } satisfies Schemas["MaintenancePlansDto"]);
  }),
  http.get("*/v1/owner/maintenance-plans/:planId", ({ request, params }) => {
    const op = "owner.maintenancePlans.get";
    const ok = owner(request, op);
    if (ok instanceof Response || !juristicOnly(ok)) return undefined;
    const plan = w().plans.find((candidate) => candidate.id === params.planId);
    return plan ? json(plan, 200, { etag: `"v${plan.version}-${plan.id.slice(-6)}"` }) : notFound(op);
  }),
  http.post("*/v1/owner/maintenance-plans", async ({ request }) => {
    const op = "owner.maintenancePlans.create";
    const ok = mutating(request, op);
    if (ok instanceof Response || !juristicOnly(ok)) return undefined;
    const input = await body<Schemas["MaintenancePlanCreateDto"]>(request);
    record(op, request, input);
    const asset = w().assets.find((item) => item.id === input.assetItemId);
    if (!asset) return validation(op, "assetItemId", "เลือกอุปกรณ์");
    if (!input.title?.trim()) return validation(op, "title", "กรอกชื่องาน");
    if (!input.intervalDays || input.intervalDays < 1) return validation(op, "intervalDays", "อย่างน้อย 1 วัน");
    if (!input.nextDueOn) return validation(op, "nextDueOn", "ระบุวันครบรอบแรก");
    const linked = planContract(op, input.vendorContractId, J.buildingA);
    if (linked instanceof Response) return linked;
    const plan: Schemas["MaintenancePlanDto"] = {
      id: crypto.randomUUID(),
      buildingId: J.buildingA,
      assetItemId: asset.id,
      assetItemName: asset.name,
      categoryId: input.categoryId ?? null,
      title: input.title.trim(),
      description: input.description ?? null,
      intervalDays: input.intervalDays,
      leadDays: input.leadDays ?? 7,
      nextDueOn: input.nextDueOn,
      assigneeUserId: input.assigneeUserId ?? null,
      assigneePartyId: input.assigneePartyId ?? null,
      isActive: input.isActive ?? true,
      lastWorkOrderId: null,
      vendorContractId: linked?.id ?? null,
      vendorName: linked?.vendorName ?? null,
      version: 1,
    };
    w().plans.push(plan);
    return json(plan, 201, { etag: `"v1-${plan.id.slice(-6)}"` });
  }),
  http.patch("*/v1/owner/maintenance-plans/:planId", async ({ request, params }) => {
    const op = "owner.maintenancePlans.update";
    const ok = mutating(request, op);
    if (ok instanceof Response || !juristicOnly(ok)) return undefined;
    const plan = w().plans.find((candidate) => candidate.id === params.planId);
    if (!plan) return notFound(op);
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) return problem(op, "concurrency.precondition_required");
    if (ifMatch !== "*" && ifMatch !== `"v${plan.version}-${plan.id.slice(-6)}"`)
      return problem(op, "concurrency.stale");
    const input = await body<Schemas["MaintenancePlanUpdateDto"]>(request);
    record(op, request, input);
    if (input.vendorContractId !== undefined) {
      const linked = planContract(op, input.vendorContractId, plan.buildingId);
      if (linked instanceof Response) return linked;
      plan.vendorContractId = linked?.id ?? null;
      plan.vendorName = linked?.vendorName ?? null;
    }
    Object.assign(
      plan,
      Object.fromEntries(
        Object.entries(input).filter(([key, value]) => key !== "vendorContractId" && value !== undefined),
      ),
    );
    plan.version += 1;
    return json(plan, 200, { etag: `"v${plan.version}-${plan.id.slice(-6)}"` });
  }),
  http.get("*/v1/owner/buildings/:buildingId/asset-items", ({ request, params }) => {
    const op = "owner.assetItems.listForBuilding";
    const ok = owner(request, op);
    if (ok instanceof Response || !juristicOnly(ok)) return undefined;
    return json({
      data: params.buildingId === J.buildingA ? w().assets : [],
    } satisfies Schemas["BuildingAssetItemsDto"]);
  }),
];

function planContract(op: string, contractId: string | null | undefined, buildingId: string) {
  if (!contractId) return null;
  const found = w().contracts.find((item) => item.id === contractId);
  if (!found || found.buildingId !== buildingId) return validation(op, "vendorContractId", "ต้องเป็นสัญญาของอาคารนี้");
  if (found.state !== "draft" && found.state !== "active") return problem(op, "vendor_contract.invalid_state");
  return found;
}

/**
 * The hourly `vendor-contracts` job (J2.2 §2): instalments due within the lead days become submitted expense requests
 * (requested by the user who activated the contract), expiry alerts at each threshold once, past contracts expire.
 */
export function runVendorJob(): { requested: number; alerts: number; expired: number } {
  const settings = state.collections?.settings ?? [];
  const lead = Number(settings.find((s) => s.key === "juristic.contract_instalment_lead_days")?.value ?? 7);
  const thresholds = (settings.find((s) => s.key === "juristic.contract_expiry_alert_days")?.value as
    number[] | undefined) ?? [90, 60, 30];
  const out = { requested: 0, alerts: 0, expired: 0 };
  for (const item of w().contracts) {
    if (item.state !== "active") continue;
    if (item.endsOn < date()) {
      item.state = "expired";
      item.expiredAt = iso();
      for (const instalment of item.instalments)
        if (instalment.state === "scheduled") Object.assign(instalment, { state: "cancelled", cancelledAt: iso() });
      out.expired += 1;
      continue;
    }
    const v = vendorOf(item.vendorId)!;
    for (const instalment of item.instalments) {
      if (instalment.state !== "scheduled" || addDays(instalment.dueOn, -lead) > date()) continue;
      const expense = addVendorExpense({
        buildingId: item.buildingId,
        title: instalment.description,
        payee: { partyId: v.dto.partyId, name: v.dto.name, taxId: v.taxId },
        accountId: item.expenseAccountId ?? ACC.services,
        description: instalment.description,
        amount: instalment.amount,
        vatAmount: instalment.vatAmount,
        whtKey: item.whtKey,
        requestedBy: item.activatedBy ?? OWNER_USER,
        state: "submitted",
        vendorId: v.dto.id,
        vendorContractId: item.id,
      });
      Object.assign(instalment, {
        state: "requested",
        expenseRequestId: expense.id,
        expenseRequestNumber: expense.number,
        expenseRequestState: expense.state,
        requestedAt: iso(),
      });
      out.requested += 1;
    }
    const daysLeft = daysBetween(date(), item.endsOn);
    const due = [...thresholds].sort((a, b) => a - b).find((days) => daysLeft <= days);
    if (due !== undefined && !item.alerts.some((alert) => alert.daysBefore === due && alert.endsOn === item.endsOn)) {
      item.alerts.push({ daysBefore: due, endsOn: item.endsOn, sentAt: iso() });
      out.alerts += 1;
    }
  }
  refreshActiveContracts(w());
  return out;
}

export const vendorsHandlers: HttpHandler[] = [...vendorHandlers, ...contractHandlers, ...roundHandlers];

export function resetVendorsWorld(): void {
  state.vendors = initialVendorsWorld(state.accounting);
}

// Staff and committee appear in the contracts' history; keep their ids reachable for specs.
export const VENDOR_PEOPLE = { OWNER_USER, COMMITTEE_USER, STAFF_USER, ACCOUNTANT_USER } as const;
