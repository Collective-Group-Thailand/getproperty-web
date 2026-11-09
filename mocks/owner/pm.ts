import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS, tenantPermissions } from "../fixtures";
import { state } from "../state";
import { ACC } from "./accounting";
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
type Contract = Schemas["ManagementContractDto"];
type Assignment = Schemas["PmStaffAssignmentDto"];
type Role = Schemas["PmAssignmentRole"];

/*
 * A PM company managing buildings of juristic offices (pack J, JW3b; api J3.3 at 1e364785, D-334). The company
 * (`TENANTS.pm`) runs three buildings today — the juristic mock's อาคาร A (its contract ends in 65 days), a condominium
 * and a housing estate of two other juristic offices — holds an offer for อาคาร B (from the juristic mock), an offer
 * that passed its start date, a terminated contract; the juristic mock also has a draft for its estate. Both sides read
 * the same contracts (the juristic side sees its own, drafts included; the PM side never sees drafts). KPIs are the
 * API's aggregates, fixed here. Staff: eight members, five assigned today, one assignment ended.
 * Control: `GET /__mock/owner/pm`.
 */

const DAY = 86_400_000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);
const pid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);

export const PM_TENANT = TENANTS.pm.profile.id;
const RIVERSIDE = { id: JURISTIC_TENANT, name: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์" };
const CHOMWIEW = { id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6cb1", name: "นิติบุคคลอาคารชุด ชมวิว เรสซิเดนซ์" };
const SUANKAEW = { id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6cb2", name: "นิติบุคคลหมู่บ้านจัดสรร สวนแก้ว 3" };
const RIMNAM = { id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6cb3", name: "นิติบุคคลอาคารชุด บ้านริมน้ำ" };

export const PMB = {
  chomwiew1: pid("5c8e0b01", 1),
  chomwiew2: pid("5c8e0b01", 2),
  suankaew: pid("5c8e0b01", 3),
  rimnam: pid("5c8e0b01", 4),
} as const;

export const MC = {
  riversideA: pid("3c0a0c01", 1),
  chomwiew: pid("3c0a0c01", 2),
  suankaew: pid("3c0a0c01", 3),
  offerB: pid("3c0a0c01", 4),
  terminated: pid("3c0a0c01", 5),
  draftSoi: pid("3c0a0c01", 6),
  expiredOffer: pid("3c0a0c01", 7),
} as const;

interface Member {
  userId: string;
  displayName: string;
  tenantRole: string;
}

export const PM_MEMBERS: Member[] = [
  { userId: "3b241101-e2bb-4255-8caf-4136c566a912", displayName: "ธนพล ผู้จัดการพอร์ต", tenantRole: "owner" },
  { userId: "3b241101-e2bb-4255-8caf-4136c566a913", displayName: "อรุณี ผู้จัดการอาคาร", tenantRole: "staff" },
  { userId: pid("3b2411c1", 1), displayName: "สมพงษ์ ช่างเทคนิค", tenantRole: "staff" },
  { userId: pid("3b2411c1", 2), displayName: "กัญญา ผู้ช่วยผู้จัดการ", tenantRole: "staff" },
  { userId: pid("3b2411c1", 3), displayName: "วิไล บัญชีอาคาร", tenantRole: "accountant" },
  { userId: pid("3b2411c1", 4), displayName: "ประเสริฐ หัวหน้ารักษาความปลอดภัย", tenantRole: "staff" },
  { userId: pid("3b2411c1", 5), displayName: "มานพ ช่างไฟฟ้า", tenantRole: "staff" },
  { userId: pid("3b2411c1", 6), displayName: "ศิริพร ธุรการ", tenantRole: "staff" },
];

interface MockContract {
  dto: Omit<Contract, "nextActions" | "feesRequested">;
  legalForm: string;
  kpis: Schemas["PmPortfolioKpisDto"] | null;
}

export interface MockPmWorld {
  contracts: MockContract[];
  assignments: Assignment[];
  charges: Map<string, Schemas["ManagementFeeChargeDto"][]>;
}

function contract(
  id: string,
  juristic: { id: string; name: string },
  buildingId: string,
  buildingName: string,
  patch: Partial<Contract>,
): Omit<Contract, "nextActions" | "feesRequested"> {
  return {
    id,
    juristicTenantId: juristic.id,
    juristicName: juristic.name,
    pmTenantId: PM_TENANT,
    pmName: TENANTS.pm.profile.displayName,
    buildingId,
    buildingName,
    vendorId: pid("7e0d0c01", 1),
    title: `สัญญาจ้างบริหารจัดการ ${buildingName}`,
    scope:
      "บริหารงานนิติบุคคลประจำวัน จัดเก็บค่าส่วนกลางและติดตามหนี้ ดูแลงานซ่อมบำรุงและผู้รับเหมา จัดทำรายงานการเงินรายเดือนเสนอคณะกรรมการ",
    fee: "85600.00",
    vatAmount: "5600.00",
    feePeriod: "monthly",
    dueDay: 5,
    startsOn: date(-300),
    endsOn: date(65),
    expenseAccountId: ACC.services,
    whtKey: "services",
    resolutionId: pid("9e0a0c01", 1),
    documentId: null,
    state: "active",
    access: { active: true, validFrom: iso(-300), validTo: iso(66), revokedAt: null },
    offeredAt: iso(-320),
    acceptedAt: iso(-318),
    declinedAt: null,
    declineReason: null,
    cancelledAt: null,
    cancelReason: null,
    terminatedOn: null,
    terminatedAt: null,
    terminatedBy: null,
    terminationReason: null,
    endedAt: null,
    note: null,
    createdAt: iso(-325),
    version: 3,
    ...patch,
  };
}

function kpis(input: {
  units: number;
  billed: string;
  collected: string;
  rate: string | null;
  within: string | null;
  last: Schemas["PmPortfolioLastCycleDto"] | null;
  overdue: string;
  invoices: number;
  accounts: number;
  over90: string;
  budget: Schemas["PmPortfolioBudgetDto"] | null;
  work: Schemas["PmPortfolioWorkDto"];
  expiring: Schemas["PmPortfolioExpiringContractDto"][];
}): Schemas["PmPortfolioKpisDto"] {
  return {
    units: input.units,
    collection: {
      from: date(-365),
      to: date(),
      billed: input.billed,
      collected: input.collected,
      collectionRatePct: input.rate,
      withinDaysRatePct: input.within,
      kpiDays: 30,
      lastCycle: input.last,
    },
    arrears: {
      overdueAmount: input.overdue,
      overdueInvoices: input.invoices,
      overdueAccounts: input.accounts,
      over90Amount: input.over90,
    },
    budget: input.budget,
    work: input.work,
    expiring: { withinDays: 90, vendorContracts: input.expiring.length, items: input.expiring },
  };
}

const lastPeriod = () => date(-30).slice(0, 7);

/** Fees requested per ended month (in arrears): the first period prorated by days of service, half-up. */
function monthlyCharges(c: Omit<Contract, "nextActions" | "feesRequested">, max: number) {
  const out: Schemas["ManagementFeeChargeDto"][] = [];
  const start = new Date(`${c.startsOn}T00:00:00Z`);
  const today = date();
  for (let m = 0; out.length < 40; m += 1) {
    const periodStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1));
    const periodEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m + 1, 0));
    const endKey = periodEnd.toISOString().slice(0, 10);
    if (endKey >= today) break;
    const periodDays = periodEnd.getUTCDate();
    const from = m === 0 ? start : periodStart;
    const serviceDays = periodDays - from.getUTCDate() + 1;
    const amount = Math.round((satang(c.fee) * serviceDays) / periodDays);
    const vat = Math.round((satang(c.vatAmount) * serviceDays) / periodDays);
    const due = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, c.dueDay));
    out.push({
      id: pid(`c4a0${c.id.slice(-2)}01`, m + 1),
      periodKey: periodStart.toISOString().slice(0, 7),
      periodStart: periodStart.toISOString().slice(0, 10),
      periodEnd: endKey,
      serviceDays,
      periodDays,
      amount: baht(amount),
      vatAmount: baht(vat),
      dueOn: due.toISOString().slice(0, 10),
      requestedAt: new Date(periodEnd.getTime() + DAY + 3600_000).toISOString(),
      expenseRequest: {
        id: pid(`e4a0${c.id.slice(-2)}01`, m + 1),
        number: `EXP-${periodEnd.getUTCFullYear() + 543}-${String(300 + m).padStart(6, "0")}`,
        state: due.toISOString().slice(0, 10) < today ? "paid" : "submitted",
      },
    });
  }
  return out.reverse().slice(0, max);
}

export function initialPmWorld(): MockPmWorld {
  const contracts: MockContract[] = [
    {
      dto: contract(MC.riversideA, RIVERSIDE, J.buildingA, "อาคาร A", {}),
      legalForm: "condo_act",
      kpis: kpis({
        units: 312,
        billed: "3744000.00",
        collected: "3519360.00",
        rate: "94.00",
        within: "88.50",
        last: { periodKey: lastPeriod(), billed: "312000.00", collectionRatePct: "91.20" },
        overdue: "224640.00",
        invoices: 41,
        accounts: 18,
        over90: "96000.00",
        budget: {
          budgetId: pid("b0d0c001", 1),
          fiscalYear: Number(date().slice(0, 4)),
          budgetedExpense: "3200000.00",
          actualExpense: "2668800.00",
          usedPct: "83.40",
        },
        work: { openRequests: 7, slaBreachedRequests: 2, openWorkOrders: 5 },
        expiring: [
          {
            vendorContractId: pid("7c0a0c01", 1),
            title: "สัญญาบำรุงรักษาลิฟต์",
            vendorName: "บริษัท ลิฟต์ไทย เซอร์วิส จำกัด",
            endsOn: date(45),
            daysLeft: 45,
          },
          {
            vendorContractId: pid("7c0a0c01", 2),
            title: "สัญญาทำความสะอาดพื้นที่ส่วนกลาง",
            vendorName: "บริษัท คลีนพลัส จำกัด",
            endsOn: date(78),
            daysLeft: 78,
          },
        ],
      }),
    },
    {
      dto: contract(MC.chomwiew, CHOMWIEW, PMB.chomwiew1, "ชมวิว เรสซิเดนซ์ อาคาร 1", {
        fee: "64200.00",
        vatAmount: "4200.00",
        startsOn: date(-500),
        endsOn: date(230),
        access: { active: true, validFrom: iso(-500), validTo: iso(231), revokedAt: null },
        offeredAt: iso(-520),
        acceptedAt: iso(-515),
        createdAt: iso(-525),
      }),
      legalForm: "condo_act",
      kpis: kpis({
        units: 186,
        billed: "2008800.00",
        collected: "1928448.00",
        rate: "96.00",
        within: "92.10",
        last: { periodKey: lastPeriod(), billed: "167400.00", collectionRatePct: "95.40" },
        overdue: "80352.00",
        invoices: 14,
        accounts: 9,
        over90: "0.00",
        budget: {
          budgetId: pid("b0d0c001", 2),
          fiscalYear: Number(date().slice(0, 4)),
          budgetedExpense: "1850000.00",
          actualExpense: "1110000.00",
          usedPct: "60.00",
        },
        work: { openRequests: 3, slaBreachedRequests: 0, openWorkOrders: 2 },
        expiring: [],
      }),
    },
    {
      dto: contract(MC.suankaew, SUANKAEW, PMB.suankaew, "หมู่บ้านสวนแก้ว 3", {
        fee: "128400.00",
        vatAmount: "8400.00",
        feePeriod: "quarterly",
        dueDay: 10,
        startsOn: date(-120),
        endsOn: date(610),
        access: { active: true, validFrom: iso(-120), validTo: iso(611), revokedAt: null },
        offeredAt: iso(-140),
        acceptedAt: iso(-133),
        createdAt: iso(-145),
      }),
      legalForm: "land_allocation_act",
      kpis: kpis({
        units: 248,
        billed: "1190400.00",
        collected: "1012032.00",
        rate: "85.02",
        within: "71.30",
        last: { periodKey: lastPeriod(), billed: "297600.00", collectionRatePct: "79.80" },
        overdue: "178368.00",
        invoices: 63,
        accounts: 37,
        over90: "52800.00",
        budget: null,
        work: { openRequests: 9, slaBreachedRequests: 3, openWorkOrders: 4 },
        expiring: [
          {
            vendorContractId: pid("7c0a0c01", 3),
            title: "สัญญารักษาความปลอดภัย",
            vendorName: "บริษัท การ์ดดี ซีเคียวริตี้ จำกัด",
            endsOn: date(21),
            daysLeft: 21,
          },
        ],
      }),
    },
    {
      dto: contract(MC.offerB, RIVERSIDE, J.buildingB, "อาคาร B", {
        fee: "72760.00",
        vatAmount: "4760.00",
        startsOn: date(14),
        endsOn: date(378),
        state: "offered",
        access: { active: false, validFrom: null, validTo: null, revokedAt: null },
        offeredAt: iso(-2),
        acceptedAt: null,
        createdAt: iso(-6),
        version: 2,
      }),
      legalForm: "condo_act",
      kpis: null,
    },
    {
      dto: contract(MC.expiredOffer, CHOMWIEW, PMB.chomwiew2, "ชมวิว เรสซิเดนซ์ อาคาร 2", {
        fee: "53500.00",
        vatAmount: "3500.00",
        startsOn: date(-3),
        endsOn: date(362),
        state: "offered",
        access: { active: false, validFrom: null, validTo: null, revokedAt: null },
        offeredAt: iso(-20),
        acceptedAt: null,
        createdAt: iso(-22),
        version: 2,
      }),
      legalForm: "condo_act",
      kpis: null,
    },
    {
      dto: contract(MC.terminated, RIMNAM, PMB.rimnam, "บ้านริมน้ำ", {
        fee: "58850.00",
        vatAmount: "3850.00",
        startsOn: date(-400),
        endsOn: date(-35 + 365),
        state: "terminated",
        access: { active: false, validFrom: iso(-400), validTo: iso(-40), revokedAt: iso(-40) },
        offeredAt: iso(-410),
        acceptedAt: iso(-405),
        terminatedOn: date(-40),
        terminatedAt: iso(-41),
        terminatedBy: "juristic",
        terminationReason: "ที่ประชุมใหญ่มีมติเปลี่ยนผู้บริหารอาคาร",
        createdAt: iso(-415),
        version: 5,
      }),
      legalForm: "condo_act",
      kpis: null,
    },
    {
      dto: contract(MC.draftSoi, RIVERSIDE, J.soi1, "ซอย 1", {
        fee: "42800.00",
        vatAmount: "2800.00",
        startsOn: date(30),
        endsOn: date(395),
        state: "draft",
        access: { active: false, validFrom: null, validTo: null, revokedAt: null },
        offeredAt: null,
        acceptedAt: null,
        createdAt: iso(-1),
        version: 1,
      }),
      legalForm: "land_allocation_act",
      kpis: null,
    },
  ];
  const [a, chom, suan] = [MC.riversideA, MC.chomwiew, MC.suankaew];
  const m = PM_MEMBERS;
  const assign = (
    n: number,
    contractId: string,
    member: Member,
    role: Role,
    shift: string | null,
    startsOn: string,
    endsOn: string | null = null,
  ): Assignment => {
    const c = contracts.find((entry) => entry.dto.id === contractId)!.dto;
    return {
      id: pid("a55a0c01", n),
      contractId,
      buildingId: c.buildingId,
      buildingName: c.buildingName,
      userId: member.userId,
      displayName: member.displayName,
      role,
      shift,
      startsOn,
      endsOn,
      note: null,
      createdAt: iso(-200 + n),
      version: 1,
    };
  };
  const assignments: Assignment[] = [
    assign(1, a, m[1]!, "building_manager", "จ.–ศ. 08:00–17:00", date(-300)),
    assign(2, a, m[2]!, "technician", "จ.–ส. 08:00–17:00", date(-200)),
    assign(3, chom, m[3]!, "assistant_manager", "จ.–ศ. 09:00–18:00", date(-480)),
    assign(4, suan, m[5]!, "security_supervisor", "ทุกวัน 07:00–19:00", date(-118)),
    assign(5, suan, m[4]!, "accountant", "อ. และ พฤ.", date(-100)),
    assign(6, MC.terminated, m[6]!, "technician", null, date(-380), date(-40)),
  ];
  const charges = new Map<string, Schemas["ManagementFeeChargeDto"][]>();
  for (const entry of contracts)
    if (entry.dto.state === "active" && entry.dto.feePeriod === "monthly")
      charges.set(entry.dto.id, monthlyCharges(entry.dto, 12));
  return { contracts, assignments, charges };
}

export function resetPmWorld(): void {
  state.pm = initialPmWorld();
}

const w = () => state.pm;
const can = (ok: Ok, permission: string) => {
  const role = roleOf(ok);
  return !!role && tenantPermissions(role).includes(permission) && !ok.readOnly;
};
const pmOnly = (ok: Ok) => ok.tenantId === PM_TENANT;
const juristicOnly = (ok: Ok) => ok.tenantId === JURISTIC_TENANT;
const isStaff = (ok: Ok) => roleOf(ok) === "staff";

function nextActions(ok: Ok, side: "juristic" | "pm", dto: MockContract["dto"]): string[] {
  const s = dto.state;
  if (side === "juristic") {
    if (!can(ok, "juristic.management_contract.manage")) return [];
    if (s === "draft") return ["edit", "offer", "cancel"];
    if (s === "offered") return ["cancel"];
    if (s === "active") return ["terminate"];
    return [];
  }
  if (!can(ok, "pm.contract.manage")) return [];
  if (s === "offered") return ["accept", "decline"];
  if (s === "active") return ["terminate"];
  return [];
}

function contractDto(ok: Ok, side: "juristic" | "pm", entry: MockContract): Contract {
  const fees = w().charges.get(entry.dto.id)?.length ?? 0;
  const dto: Contract = { ...entry.dto, feesRequested: fees, nextActions: nextActions(ok, side, entry.dto) };
  return side === "pm"
    ? { ...dto, vendorId: null, expenseAccountId: null, whtKey: null, resolutionId: null, documentId: null }
    : dto;
}

const today = () => date();
/** Assignments in force today: started, not ended (exclusive end). */
const current = (entry: Assignment, day = today()) => entry.startsOn <= day && (!entry.endsOn || entry.endsOn > day);

/** Buildings managed today: an active contract inside its term with a live grant. */
function managed(ok: Ok): MockContract[] {
  const day = today();
  const mine = w().contracts.filter(
    (entry) =>
      entry.dto.pmTenantId === ok.tenantId &&
      entry.dto.state === "active" &&
      entry.dto.access.active &&
      entry.dto.startsOn <= day &&
      entry.dto.endsOn >= day,
  );
  if (!isStaff(ok)) return mine;
  const assigned = new Set(
    w()
      .assignments.filter((entry) => entry.userId === ok.persona.user.id && current(entry))
      .map((entry) => entry.buildingId),
  );
  return mine.filter((entry) => assigned.has(entry.dto.buildingId));
}

function staffToday(buildingId: string): Schemas["PmPortfolioStaffDto"][] {
  return w()
    .assignments.filter((entry) => entry.buildingId === buildingId && current(entry))
    .map((entry) => ({ userId: entry.userId, displayName: entry.displayName, role: entry.role, shift: entry.shift }));
}

function buildingRow(entry: MockContract): Schemas["PmPortfolioBuildingDto"] {
  const c = entry.dto;
  return {
    buildingId: c.buildingId,
    buildingName: c.buildingName,
    juristicTenantId: c.juristicTenantId,
    juristicName: c.juristicName,
    legalForm: entry.legalForm,
    contract: {
      id: c.id,
      fee: c.fee,
      feePeriod: c.feePeriod,
      startsOn: c.startsOn,
      endsOn: c.endsOn,
      terminatedOn: c.terminatedOn,
      daysLeft: daysBetween(today(), c.terminatedOn ?? c.endsOn),
    },
    staffToday: staffToday(c.buildingId),
    kpis: entry.kpis!,
  };
}

function totals(rows: Schemas["PmPortfolioBuildingDto"][]): Schemas["PmPortfolioTotalsDto"] {
  const sum = (pick: (row: Schemas["PmPortfolioBuildingDto"]) => string) =>
    rows.reduce((total, row) => total + satang(pick(row)), 0);
  const billed = sum((row) => row.kpis.collection.billed);
  const collected = sum((row) => row.kpis.collection.collected);
  return {
    buildings: rows.length,
    units: rows.reduce((total, row) => total + row.kpis.units, 0),
    billed: baht(billed),
    collected: baht(collected),
    collectionRatePct: billed > 0 ? ((collected / billed) * 100).toFixed(2) : null,
    overdueAmount: baht(sum((row) => row.kpis.arrears.overdueAmount)),
    openRequests: rows.reduce((total, row) => total + row.kpis.work.openRequests, 0),
    slaBreachedRequests: rows.reduce((total, row) => total + row.kpis.work.slaBreachedRequests, 0),
    expiringContracts: rows.reduce((total, row) => total + row.kpis.expiring.vendorContracts, 0),
  };
}

function terminate(entry: MockContract, by: "juristic" | "pm", input: Schemas["VendorContractTerminateDto"]) {
  const effective = input.effectiveOn ?? today();
  entry.dto = {
    ...entry.dto,
    state: "terminated",
    terminatedOn: effective,
    terminatedAt: iso(),
    terminatedBy: by,
    terminationReason: input.reason.trim(),
    access:
      effective <= today()
        ? { ...entry.dto.access, active: false, revokedAt: iso() }
        : { ...entry.dto.access, validTo: new Date(`${effective}T00:00:00+07:00`).toISOString() },
    version: entry.dto.version + 1,
  };
  for (const assignment of w().assignments)
    if (assignment.contractId === entry.dto.id && (!assignment.endsOn || assignment.endsOn > effective))
      assignment.endsOn = effective;
}

function terminateCheck(op: string, entry: MockContract, input: Schemas["VendorContractTerminateDto"]) {
  const reason = (input.reason ?? "").trim();
  if (reason.length < 3 || reason.length > 1000) return validation(op, "reason", "เหตุผลยาว 3–1000 ตัวอักษร", "length");
  const effective = input.effectiveOn ?? today();
  if (effective < today() || effective > entry.dto.endsOn)
    return validation(op, "effectiveOn", "วันที่มีผลต้องอยู่ระหว่างวันนี้ถึงวันสิ้นสุดสัญญา");
  if (entry.dto.state !== "active") return problem(op, "management_contract.invalid_state");
  return null;
}

function overlaps(entry: MockContract): boolean {
  return w().contracts.some(
    (other) =>
      other !== entry &&
      other.dto.buildingId === entry.dto.buildingId &&
      ["offered", "active"].includes(other.dto.state) &&
      other.dto.startsOn <= entry.dto.endsOn &&
      entry.dto.startsOn <= (other.dto.terminatedOn ?? other.dto.endsOn),
  );
}

function listContracts(request: Request, rows: MockContract[], ok: Ok, side: "juristic" | "pm") {
  const params = query(request);
  const q = params.get("q")?.toLowerCase();
  const filtered = rows
    .filter(
      (entry) =>
        (!params.get("state") || entry.dto.state === params.get("state")) &&
        (!params.get("buildingId") || entry.dto.buildingId === params.get("buildingId")) &&
        (!params.get("counterpartTenantId") ||
          entry.dto[side === "pm" ? "juristicTenantId" : "pmTenantId"] === params.get("counterpartTenantId")) &&
        (!q || `${entry.dto.title} ${entry.dto.buildingName} ${entry.dto.juristicName}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.dto.startsOn.localeCompare(a.dto.startsOn))
    .map((entry) => contractDto(ok, side, entry));
  return json(paged(filtered, request));
}

function sideLoaded(
  request: Request,
  op: string,
  side: "juristic" | "pm",
  id: string,
  permission: string,
  write: boolean,
): { ok: Ok; entry: MockContract } | Response {
  const ok = write ? mutating(request, op) : owner(request, op);
  if (ok instanceof Response) return ok;
  if (side === "pm" ? !pmOnly(ok) : !juristicOnly(ok)) return notFound(op);
  const forbidden = allowed(ok, op, permission);
  if (forbidden) return forbidden;
  const entry = w().contracts.find(
    (candidate) =>
      candidate.dto.id === id &&
      (side === "pm"
        ? candidate.dto.pmTenantId === ok.tenantId && candidate.dto.state !== "draft"
        : candidate.dto.juristicTenantId === ok.tenantId),
  );
  if (!entry) return notFound(op);
  return { ok, entry };
}

const PM = "*/v1/owner/pm";
const JMC = "*/v1/owner/juristic/management-contracts";
const ROLES: readonly Role[] = [
  "building_manager",
  "assistant_manager",
  "accountant",
  "technician",
  "admin_officer",
  "security_supervisor",
  "other",
];

export const pmHandlers: HttpHandler[] = [
  // ── portfolio ──────────────────────────────────────────────────────────────────────────────────────────────────
  http.get(`${PM}/portfolio`, ({ request }) => {
    const op = "owner.pmPortfolio.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (TENANTS.pm.profile.id !== ok.tenantId && TENANTS.branch.profile.id !== ok.tenantId) return notFound(op);
    const forbidden = allowed(ok, op, "pm.portfolio.read");
    if (forbidden) return forbidden;
    const rows = managed(ok).map(buildingRow);
    return json({ asOf: today(), buildings: rows, totals: totals(rows) });
  }),
  http.get(`${PM}/portfolio/buildings/:buildingId`, ({ request, params }) => {
    const op = "owner.pmPortfolio.building";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "pm.portfolio.read");
    if (forbidden) return forbidden;
    const entry = managed(ok).find((candidate) => candidate.dto.buildingId === params.buildingId);
    return entry ? json(buildingRow(entry)) : notFound(op);
  }),
  // ── staff ──────────────────────────────────────────────────────────────────────────────────────────────────────
  http.get(`${PM}/staff-board`, ({ request }) => {
    const op = "owner.pmStaff.board";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "pm.staff.read");
    if (forbidden) return forbidden;
    if (!pmOnly(ok)) return json({ asOf: today(), members: [], buildings: [], unassigned: [] });
    const buildings = managed(ok);
    const ids = new Set(buildings.map((entry) => entry.dto.buildingId));
    const live = w().assignments.filter((entry) => current(entry) && ids.has(entry.buildingId));
    const members = PM_MEMBERS.filter((member) => !isStaff(ok) || member.userId === ok.persona.user.id);
    return json({
      asOf: today(),
      buildings: buildings.map((entry) => ({
        buildingId: entry.dto.buildingId,
        buildingName: entry.dto.buildingName,
        juristicName: entry.dto.juristicName,
        contractId: entry.dto.id,
        staff: staffToday(entry.dto.buildingId),
      })),
      members: members
        .filter((member) => live.some((entry) => entry.userId === member.userId))
        .map((member) => ({
          ...member,
          assignments: live
            .filter((entry) => entry.userId === member.userId)
            .map((entry) => ({
              assignmentId: entry.id,
              buildingId: entry.buildingId,
              buildingName: entry.buildingName,
              role: entry.role,
              shift: entry.shift,
              startsOn: entry.startsOn,
              endsOn: entry.endsOn,
            })),
        })),
      unassigned: members.filter((member) => !live.some((entry) => entry.userId === member.userId)),
    });
  }),
  http.get(`${PM}/staff-assignments`, ({ request }) => {
    const op = "owner.pmStaff.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "pm.staff.read");
    if (forbidden) return forbidden;
    if (!pmOnly(ok)) return json(paged([], request));
    const params = query(request);
    const rows = w()
      .assignments.filter(
        (entry) =>
          (!isStaff(ok) || entry.userId === ok.persona.user.id) &&
          (!params.get("buildingId") || entry.buildingId === params.get("buildingId")) &&
          (!params.get("userId") || entry.userId === params.get("userId")) &&
          (params.get("current") !== "true" || current(entry)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(paged(rows, request));
  }),
  http.post(`${PM}/staff-assignments`, async ({ request }) => {
    const op = "owner.pmStaff.assign";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!pmOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "pm.staff.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["PmStaffAssignmentCreateDto"]>(request);
    record(op, request, input);
    if (!ROLES.includes(input.role)) return validation(op, "role", "เลือกหน้าที่");
    if ((input.shift ?? "").length > 100) return validation(op, "shift", "ไม่เกิน 100 ตัวอักษร");
    const entry = w().contracts.find(
      (candidate) =>
        candidate.dto.id === input.contractId &&
        candidate.dto.pmTenantId === ok.tenantId &&
        candidate.dto.state === "active",
    );
    if (!entry) return notFound(op);
    const member = PM_MEMBERS.find((candidate) => candidate.userId === input.userId);
    if (!member) return problem(op, "pm_staff.not_member");
    const startsOn = input.startsOn ?? (entry.dto.startsOn > today() ? entry.dto.startsOn : today());
    const endsOn = input.endsOn ?? null;
    if (endsOn && endsOn <= startsOn) return validation(op, "endsOn", "วันสิ้นสุดต้องหลังวันเริ่ม");
    const lastExclusive = new Date(Date.parse(`${entry.dto.endsOn}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
    if (startsOn < entry.dto.startsOn || startsOn > entry.dto.endsOn || (endsOn && endsOn > lastExclusive))
      return problem(op, "pm_staff.outside_term");
    const clash = w().assignments.some(
      (other) =>
        other.userId === input.userId &&
        other.buildingId === entry.dto.buildingId &&
        (!other.endsOn || other.endsOn > startsOn) &&
        (!endsOn || endsOn > other.startsOn),
    );
    if (clash) return problem(op, "pm_staff.overlap");
    const created: Assignment = {
      id: crypto.randomUUID(),
      contractId: entry.dto.id,
      buildingId: entry.dto.buildingId,
      buildingName: entry.dto.buildingName,
      userId: member.userId,
      displayName: member.displayName,
      role: input.role,
      shift: input.shift?.trim() || null,
      startsOn,
      endsOn,
      note: input.note?.trim() || null,
      createdAt: iso(),
      version: 1,
    };
    w().assignments.push(created);
    return json(created, 201);
  }),
  http.post(`${PM}/staff-assignments/:id/actions/end`, async ({ request, params }) => {
    const op = "owner.pmStaff.end";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!pmOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "pm.staff.manage");
    if (forbidden) return forbidden;
    const entry = w().assignments.find((candidate) => candidate.id === params.id);
    if (!entry) return notFound(op);
    const input = await body<Schemas["PmStaffAssignmentEndDto"]>(request);
    record(op, request, input);
    if (entry.endsOn && entry.endsOn <= today()) return problem(op, "pm_staff.ended");
    const endsOn = input.endsOn ?? today();
    if (endsOn < today()) return validation(op, "endsOn", "วันที่ต้องไม่ก่อนวันนี้");
    if (endsOn <= entry.startsOn) return validation(op, "endsOn", "วันที่ต้องหลังวันเริ่มประจำ");
    if (entry.endsOn && endsOn > entry.endsOn) return validation(op, "endsOn", "วันที่ต้องไม่เกินวันสิ้นสุดเดิม");
    entry.endsOn = endsOn;
    entry.version += 1;
    return json(entry);
  }),
  // ── management contracts, PM side ──────────────────────────────────────────────────────────────────────────────
  http.get(`${PM}/management-contracts`, ({ request }) => {
    const op = "owner.pmContracts.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "pm.contract.read");
    if (forbidden) return forbidden;
    const rows = w().contracts.filter((entry) => entry.dto.pmTenantId === ok.tenantId && entry.dto.state !== "draft");
    return listContracts(request, rows, ok, "pm");
  }),
  http.get(`${PM}/management-contracts/:id`, ({ request, params }) => {
    const found = sideLoaded(request, "owner.pmContracts.get", "pm", String(params.id), "pm.contract.read", false);
    if (found instanceof Response) return found;
    return json(contractDto(found.ok, "pm", found.entry));
  }),
  http.get(`${PM}/management-contracts/:id/charges`, ({ request, params }) => {
    const found = sideLoaded(request, "owner.pmContracts.charges", "pm", String(params.id), "pm.contract.read", false);
    if (found instanceof Response) return found;
    return json((w().charges.get(found.entry.dto.id) ?? []).map((charge) => ({ ...charge, expenseRequest: null })));
  }),
  http.post(`${PM}/management-contracts/:id/actions/accept`, ({ request, params }) => {
    const op = "owner.pmContracts.accept";
    const found = sideLoaded(request, op, "pm", String(params.id), "pm.contract.manage", true);
    if (found instanceof Response) return found;
    const { ok, entry } = found;
    return idempotent(request, op, () => {
      if (entry.dto.state !== "offered") return problem(op, "management_contract.invalid_state");
      if (entry.dto.startsOn < today()) return problem(op, "management_contract.offer_expired");
      if (overlaps(entry)) return problem(op, "management_contract.overlap");
      entry.dto = {
        ...entry.dto,
        state: "active",
        acceptedAt: iso(),
        access: {
          active: entry.dto.startsOn <= today(),
          validFrom: new Date(`${entry.dto.startsOn}T00:00:00+07:00`).toISOString(),
          validTo: new Date(Date.parse(`${entry.dto.endsOn}T00:00:00+07:00`) + DAY).toISOString(),
          revokedAt: null,
        },
        version: entry.dto.version + 1,
      };
      return { status: 200, body: contractDto(ok, "pm", entry) };
    });
  }),
  http.post(`${PM}/management-contracts/:id/actions/decline`, ({ request, params }) => {
    const op = "owner.pmContracts.decline";
    const found = sideLoaded(request, op, "pm", String(params.id), "pm.contract.manage", true);
    if (found instanceof Response) return found;
    const { ok, entry } = found;
    return idempotent(request, op, (payload) => {
      const reason = String((payload as { reason?: string }).reason ?? "").trim();
      if (reason.length < 5 || reason.length > 1000)
        return validation(op, "reason", "เหตุผลยาว 5–1000 ตัวอักษร", "length");
      if (entry.dto.state !== "offered") return problem(op, "management_contract.invalid_state");
      entry.dto = {
        ...entry.dto,
        state: "declined",
        declinedAt: iso(),
        declineReason: reason,
        version: entry.dto.version + 1,
      };
      return { status: 200, body: contractDto(ok, "pm", entry) };
    });
  }),
  http.post(`${PM}/management-contracts/:id/actions/terminate`, ({ request, params }) => {
    const op = "owner.pmContracts.terminate";
    const found = sideLoaded(request, op, "pm", String(params.id), "pm.contract.manage", true);
    if (found instanceof Response) return found;
    const { ok, entry } = found;
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["VendorContractTerminateDto"];
      const refused = terminateCheck(op, entry, input);
      if (refused) return refused;
      terminate(entry, "pm", input);
      return { status: 200, body: contractDto(ok, "pm", entry) };
    });
  }),
  // ── management contracts, juristic side ────────────────────────────────────────────────────────────────────────
  http.get(JMC, ({ request }) => {
    const op = "owner.juristicManagementContracts.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.management_contract.read");
    if (forbidden) return forbidden;
    return listContracts(
      request,
      w().contracts.filter((entry) => entry.dto.juristicTenantId === ok.tenantId),
      ok,
      "juristic",
    );
  }),
  http.get(`${JMC}/:id`, ({ request, params }) => {
    const op = "owner.juristicManagementContracts.get";
    const found = sideLoaded(request, op, "juristic", String(params.id), "juristic.management_contract.read", false);
    if (found instanceof Response) return found;
    return json(contractDto(found.ok, "juristic", found.entry));
  }),
  http.get(`${JMC}/:id/charges`, ({ request, params }) => {
    const op = "owner.juristicManagementContracts.charges";
    const found = sideLoaded(request, op, "juristic", String(params.id), "juristic.management_contract.read", false);
    if (found instanceof Response) return found;
    return json(w().charges.get(found.entry.dto.id) ?? []);
  }),
  http.get(`${JMC}/:id/staff`, ({ request, params }) => {
    const op = "owner.juristicManagementContracts.staff";
    const found = sideLoaded(request, op, "juristic", String(params.id), "juristic.management_contract.read", false);
    if (found instanceof Response) return found;
    return json(
      w()
        .assignments.filter((entry) => entry.contractId === found.entry.dto.id)
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn)),
    );
  }),
  http.post(`${JMC}/:id/actions/offer`, ({ request, params }) => {
    const op = "owner.juristicManagementContracts.offer";
    const found = sideLoaded(request, op, "juristic", String(params.id), "juristic.management_contract.manage", true);
    if (found instanceof Response) return found;
    const { ok, entry } = found;
    return idempotent(request, op, () => {
      if (entry.dto.state !== "draft") return problem(op, "management_contract.invalid_state");
      if (!entry.dto.resolutionId) return problem(op, "management_contract.resolution_required");
      if (entry.dto.startsOn < today()) return validation(op, "startsOn", "วันเริ่มสัญญาต้องไม่ก่อนวันนี้");
      if (overlaps(entry)) return problem(op, "management_contract.overlap");
      entry.dto = { ...entry.dto, state: "offered", offeredAt: iso(), version: entry.dto.version + 1 };
      return { status: 200, body: contractDto(ok, "juristic", entry) };
    });
  }),
  http.post(`${JMC}/:id/actions/cancel`, ({ request, params }) => {
    const op = "owner.juristicManagementContracts.cancel";
    const found = sideLoaded(request, op, "juristic", String(params.id), "juristic.management_contract.manage", true);
    if (found instanceof Response) return found;
    const { ok, entry } = found;
    return idempotent(request, op, (payload) => {
      const reason = String((payload as { reason?: string }).reason ?? "").trim();
      if (reason.length < 5 || reason.length > 1000)
        return validation(op, "reason", "เหตุผลยาว 5–1000 ตัวอักษร", "length");
      if (!["draft", "offered"].includes(entry.dto.state)) return problem(op, "management_contract.invalid_state");
      entry.dto = {
        ...entry.dto,
        state: "cancelled",
        cancelledAt: iso(),
        cancelReason: reason,
        version: entry.dto.version + 1,
      };
      return { status: 200, body: contractDto(ok, "juristic", entry) };
    });
  }),
  http.post(`${JMC}/:id/actions/terminate`, ({ request, params }) => {
    const op = "owner.juristicManagementContracts.terminate";
    const found = sideLoaded(request, op, "juristic", String(params.id), "juristic.management_contract.manage", true);
    if (found instanceof Response) return found;
    const { ok, entry } = found;
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["VendorContractTerminateDto"];
      const refused = terminateCheck(op, entry, input);
      if (refused) return refused;
      terminate(entry, "juristic", input);
      return { status: 200, body: contractDto(ok, "juristic", entry) };
    });
  }),
];
