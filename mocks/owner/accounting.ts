import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { DEFAULT_BANDS, DEFAULT_WHT_RATES } from "./accounting-settings";
import { J, JURISTIC_TENANT, partyDto } from "./juristic";
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
  roleOf,
  validation,
  type Ok,
} from "./support";

type Schemas = components["schemas"];

/*
 * The juristic light GL (pack J, JW2a; api J2.1 at c0a216c2, D-329): the chart of accounts (condo_act template, two
 * sinking funds, a petty cash float, two accounts the office added), balanced journals from January two years ago to
 * this month (invoices, payments, expense payments, fund transfers, petty cash, opening balances, one reversed
 * correction), expense requests in every state with approvals by band and 50 ทวิ certificates, funds and transfers
 * (one out-transfer waiting for a second user), the petty cash float with spends and counts, an imported KBank
 * statement with a matching queue, the statements and checks computed from the journals, exports and back-post.
 * Money is summed here (this is the API's side); the console never sums.
 * Controls: `POST /__mock/owner/accounting/reset`, `GET /__mock/owner/accounting`.
 */

const DAY = 86_400_000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);
const aid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

export const OWNER_USER = "3b241101-e2bb-4255-8caf-4136c566a910";
export const COMMITTEE_USER = "3b241101-e2bb-4255-8caf-4136c566a911";
export const STAFF_USER = aid("3b24a0a1", 4);
export const ACCOUNTANT_USER = aid("3b24a0a1", 5);

/** Tenant bank accounts of the juristic office (operating, the sinking fund, the village's savings). */
export const BANK = {
  operating: aid("ba0ca001", 1),
  fund: aid("ba0ca001", 2),
  village: aid("ba0ca001", 3),
} as const;

/** Ledger accounts by role / purpose. */
export const ACC = {
  cash: aid("acc0a001", 1),
  pettyTemplate: aid("acc0a001", 2),
  bank: aid("acc0a001", 3),
  receivable: aid("acc0a001", 4),
  whtPrepaid: aid("acc0a001", 5),
  payable: aid("acc0a001", 6),
  whtPayable: aid("acc0a001", 7),
  unearned: aid("acc0a001", 8),
  deposits: aid("acc0a001", 9),
  outputVat: aid("acc0a001", 10),
  surplus: aid("acc0a001", 11),
  incomeCommonFee: aid("acc0a001", 12),
  incomeFund: aid("acc0a001", 13),
  incomeSurcharge: aid("acc0a001", 14),
  incomeOther: aid("acc0a001", 15),
  personnel: aid("acc0a001", 16),
  utilities: aid("acc0a001", 17),
  repairs: aid("acc0a001", 18),
  services: aid("acc0a001", 19),
  admin: aid("acc0a001", 20),
  insurance: aid("acc0a001", 21),
  taxes: aid("acc0a001", 22),
  otherExpense: aid("acc0a001", 23),
  fundBankA: aid("acc0a001", 24),
  fundEquityA: aid("acc0a001", 25),
  fundBankSoi: aid("acc0a001", 26),
  fundEquitySoi: aid("acc0a001", 27),
  pettyA: aid("acc0a001", 28),
  meetings: aid("acc0a001", 29),
  villageBank: aid("acc0a001", 30),
} as const;

export const FUND = { a: aid("f0d0a001", 1), soi: aid("f0d0a001", 2) } as const;
export const PETTY = { a: aid("9e770a01", 1) } as const;
export const RESOLUTION_A = aid("e5010a01", 1);
export const RESOLUTION_SOI = aid("e5010a01", 2);

/** Vendors of the office (companies with a tax id; one contractor without one). */
export const VENDOR = {
  pump: aid("9a7e0b01", 1),
  security: aid("9a7e0b01", 2),
  lift: aid("9a7e0b01", 3),
  cleaning: aid("9a7e0b01", 4),
  painter: aid("9a7e0b01", 5),
} as const;

interface Vendor {
  id: string | null;
  name: string;
  type: "company" | "person";
  taxId: string | null;
}

const VENDORS: Vendor[] = [
  { id: VENDOR.pump, name: "บริษัท ไทยปั๊ม เซอร์วิส จำกัด", type: "company", taxId: "0105558123456" },
  { id: VENDOR.security, name: "บริษัท การ์ดเดียน ซีเคียวริตี้ จำกัด", type: "company", taxId: "0105561098765" },
  { id: VENDOR.lift, name: "บริษัท ลิฟท์แอนด์เอสคาเลเตอร์ (ประเทศไทย) จำกัด", type: "company", taxId: "0105549011122" },
  { id: VENDOR.cleaning, name: "บริษัท คลีนพลัส แมเนจเมนท์ จำกัด", type: "company", taxId: "0105563055501" },
  { id: VENDOR.painter, name: "นายประเสริฐ ช่างสี", type: "person", taxId: null },
];

/** A payee that is not a party of the register (a utility, a shop): a name only, no tax id. */
const payee = (name: string, type: "company" | "person" = "company"): Vendor => ({ id: null, name, type, taxId: null });

/** The mock state, or `undefined` while it is being created (the world is then built from fixed facts). */
function live(): typeof state | undefined {
  try {
    return state;
  } catch {
    return undefined;
  }
}

export interface MockAccountingWorld {
  accounts: Schemas["AccountDto"][];
  journals: Schemas["JournalDto"][];
  expenses: Schemas["ExpenseRequestDto"][];
  certificates: Schemas["WhtCertificateDto"][];
  funds: Schemas["FundDto"][];
  transfers: Schemas["FundTransferDto"][];
  pettyCash: Schemas["PettyCashDetailDto"][];
  statements: Schemas["BankStatementDto"][];
  lines: Schemas["BankStatementLineDetailDto"][];
  /** Candidates per unmatched line (the API ranks them from payments / expenses / transfers). */
  candidates: Record<string, Schemas["BankMatchSuggestionDto"][]>;
  bankAccounts: Schemas["BankAccountDto"][];
  /** Documents the ledger has not posted yet (back-post posts them). */
  unposted: number;
  counter: { expense: number; certificate: number; journal: number };
}

// ── Chart of accounts ──────────────────────────────────────────────────────────────────────────────────────────────

function account(
  id: string,
  code: string,
  type: Schemas["JuristicAccountType"],
  nameTh: string,
  nameEn: string,
  patch: Partial<Schemas["AccountDto"]> = {},
): Schemas["AccountDto"] {
  return {
    id,
    code,
    nameTh,
    nameEn,
    type,
    role: null,
    fundId: null,
    bankAccountId: null,
    isSystem: true,
    isActive: true,
    used: true,
    version: 1,
    ...patch,
  };
}

function initialAccounts(): Schemas["AccountDto"][] {
  return [
    account(ACC.cash, "1110", "asset", "เงินสด", "Cash on hand", { role: "cash" }),
    account(ACC.pettyTemplate, "1120", "asset", "เงินสดย่อย", "Petty cash", { role: "petty_cash", used: false }),
    account(ACC.bank, "1130", "asset", "เงินฝากธนาคาร – บัญชีดำเนินงาน", "Bank – operating account", {
      role: "bank",
      bankAccountId: BANK.operating,
    }),
    account(
      ACC.receivable,
      "1140",
      "asset",
      "ลูกหนี้ค่าส่วนกลางและเงินกองทุน – เจ้าของร่วม",
      "Receivable – co-owners",
      {
        role: "receivable",
      },
    ),
    account(ACC.whtPrepaid, "1150", "asset", "ภาษีเงินได้ถูกหัก ณ ที่จ่าย", "Withholding tax prepaid", {
      role: "wht_prepaid",
      used: false,
    }),
    account(ACC.payable, "2110", "liability", "เจ้าหนี้", "Accounts payable", { role: "payable", used: false }),
    account(ACC.whtPayable, "2120", "liability", "ภาษีหัก ณ ที่จ่ายค้างนำส่ง", "Withholding tax payable", {
      role: "wht_payable",
    }),
    account(ACC.unearned, "2130", "liability", "รายได้รับล่วงหน้า", "Unearned revenue", {
      role: "unearned",
      used: false,
    }),
    account(ACC.deposits, "2140", "liability", "เงินประกันและเงินมัดจำรับ", "Deposits held", {
      role: "deposits",
      used: false,
    }),
    account(ACC.outputVat, "2150", "liability", "ภาษีขาย", "Output VAT", { role: "output_vat", used: false }),
    account(ACC.surplus, "3200", "equity", "รายรับสูง (ต่ำ) กว่ารายจ่ายสะสม", "Accumulated surplus", {
      role: "accumulated_surplus",
    }),
    account(ACC.incomeCommonFee, "4110", "income", "รายได้ค่าส่วนกลาง", "Common fee income", {
      role: "income_common_fee",
    }),
    account(ACC.incomeFund, "4120", "income", "รายได้เงินสมทบกองทุน", "Fund contribution income", {
      role: "income_fund",
      used: false,
    }),
    account(ACC.incomeSurcharge, "4130", "income", "รายได้เงินเพิ่ม (ชำระล่าช้า)", "Late payment surcharge", {
      role: "income_surcharge",
    }),
    account(ACC.incomeOther, "4190", "income", "รายได้อื่น", "Other income", { role: "income_other" }),
    account(ACC.personnel, "5110", "expense", "เงินเดือนและค่าตอบแทนบุคลากร", "Salaries and staff costs", {
      role: "exp_personnel",
    }),
    account(ACC.utilities, "5120", "expense", "ค่าไฟฟ้าและค่าน้ำประปาส่วนกลาง", "Common-area electricity and water", {
      role: "exp_utilities",
    }),
    account(ACC.repairs, "5130", "expense", "ค่าซ่อมแซมและบำรุงรักษา", "Repairs and maintenance", {
      role: "exp_repairs",
    }),
    account(
      ACC.services,
      "5140",
      "expense",
      "ค่าจ้างบริการ (รักษาความปลอดภัย ทำความสะอาด ฯลฯ)",
      "Services (security, cleaning …)",
      { role: "exp_services" },
    ),
    account(ACC.admin, "5150", "expense", "ค่าใช้จ่ายสำนักงานและการบริหาร", "Office and administration", {
      role: "exp_admin",
    }),
    account(ACC.insurance, "5160", "expense", "ค่าเบี้ยประกันภัย", "Insurance", { role: "exp_insurance" }),
    account(ACC.taxes, "5170", "expense", "ภาษีและค่าธรรมเนียม", "Taxes and fees", { role: "exp_taxes" }),
    account(ACC.otherExpense, "5190", "expense", "ค่าใช้จ่ายอื่น (รวมเงินสดย่อยขาด / เกิน)", "Other expenses", {
      role: "exp_other",
    }),
    account(ACC.fundBankA, "1160-01", "asset", "เงินฝากกองทุนสำรอง – อาคาร A", "Sinking fund bank – Building A", {
      role: "fund_bank",
      fundId: FUND.a,
      bankAccountId: BANK.fund,
    }),
    account(ACC.fundEquityA, "3110-01", "equity", "กองทุนสำรอง – อาคาร A", "Sinking fund – Building A", {
      role: "fund_equity",
      fundId: FUND.a,
    }),
    account(ACC.fundBankSoi, "1160-02", "asset", "เงินฝากกองทุนสำรอง – ซอย 1", "Sinking fund bank – Soi 1", {
      role: "fund_bank",
      fundId: FUND.soi,
    }),
    account(ACC.fundEquitySoi, "3110-02", "equity", "กองทุนสำรอง – ซอย 1", "Sinking fund – Soi 1", {
      role: "fund_equity",
      fundId: FUND.soi,
    }),
    account(ACC.pettyA, "1120-01", "asset", "เงินสดย่อยสำนักงาน – อาคาร A", "Office petty cash – Building A", {
      role: "petty_cash",
    }),
    account(ACC.meetings, "5180", "expense", "ค่าจัดประชุมใหญ่และประชุมกรรมการ", "General and committee meetings", {
      isSystem: false,
    }),
    account(ACC.villageBank, "1135", "asset", "เงินฝากออมทรัพย์ – หมู่บ้านสวนสน", "Savings – Suan Son village", {
      isSystem: false,
      bankAccountId: BANK.village,
    }),
  ];
}

const accountOf = (id: string) => state.accounting.accounts.find((candidate) => candidate.id === id);
const accountName = (id: string) => accountOf(id)?.nameTh ?? "—";
const buildingName = (buildingId: string) =>
  live()?.juristic?.buildings.find((building) => building.id === buildingId)?.name ?? fallbackBuildingName(buildingId);

// ── Journals ───────────────────────────────────────────────────────────────────────────────────────────────────────

type LineInput = [accountId: string, debit: number, credit: number, extra?: Partial<Schemas["JournalLineDto"]>];

function journal(
  id: string,
  buildingId: string,
  postedOn: string,
  sourceType: Schemas["JuristicJournalSource"],
  sourceId: string | null,
  memo: string,
  lines: LineInput[],
  patch: Partial<Schemas["JournalDto"]> = {},
  accounts: Schemas["AccountDto"][] = live()?.accounting?.accounts ?? initialAccounts(),
): Schemas["JournalDto"] {
  const named = (accountId: string) => accounts.find((candidate) => candidate.id === accountId);
  const debit = lines.reduce((total, [, d]) => total + d, 0);
  const credit = lines.reduce((total, [, , c]) => total + c, 0);
  if (debit !== credit) throw new Error(`mock journal ${memo} is not balanced: ${debit} ≠ ${credit}`);
  return {
    id,
    buildingId,
    buildingName: buildingName(buildingId),
    postedOn,
    sourceType,
    sourceId,
    memo,
    reversesJournalId: null,
    reversedByJournalId: null,
    resolutionId: null,
    fundId: null,
    total: baht(debit),
    lines: lines.map(([accountId, d, c, extra], index) => ({
      lineNo: index + 1,
      accountId,
      accountCode: named(accountId)?.code ?? "",
      accountName: named(accountId)?.nameTh ?? "",
      debit: baht(d),
      credit: baht(c),
      unitId: null,
      unitNo: null,
      partyId: null,
      partyName: null,
      memo: null,
      ...extra,
    })),
    createdAt: `${postedOn}T10:00:00+07:00`,
    ...patch,
  };
}

/** While the world is being built `state.juristic` may not exist yet. */
function fallbackBuildingName(buildingId: string) {
  return buildingId === J.buildingA ? "อาคาร A" : buildingId === J.soi1 ? "ซอย 1" : "ซอย 2";
}

/** A stable pseudo-random factor in [0, 1) for month `n` (so the figures move like real ones, the same every run). */
const vary = (n: number, salt = 1) => ((((n * 9301 + salt * 49297) % 233280) + 233280) % 233280) / 233280;
/** A satang amount rounded to the nearest 10 baht (still in satang). */
const roundBaht = (value: number) => Math.round(value / 1000) * 1000;

interface Built {
  journals: Schemas["JournalDto"][];
  expenses: Schemas["ExpenseRequestDto"][];
  certificates: Schemas["WhtCertificateDto"][];
  transfers: Schemas["FundTransferDto"][];
  pettyEntries: Schemas["PettyCashEntryDto"][];
  payments: { id: string; buildingId: string; on: string; amount: number; label: string }[];
}

/** Months `YYYY-MM` from January two years ago to this month. */
function ledgerMonths(): string[] {
  const today = date();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let y = year - 2; y <= year; y += 1)
    for (let m = 1; m <= 12; m += 1) if (y < year || m <= month) out.push(`${y}-${String(m).padStart(2, "0")}`);
  return out;
}

function expenseDto(input: {
  n: number;
  number: string | null;
  buildingId: string;
  title: string;
  payee: Vendor;
  state: Schemas["ExpenseState"];
  lines: { accountId: string; description: string; amount: number; vat?: number; wht?: [string, string, string] }[];
  requestedBy: string;
  createdAt: string;
  submittedAt?: string | null;
  approvals?: Schemas["ExpenseApprovalDto"][];
  paidOn?: string | null;
  method?: Schemas["ExpensePaymentMethod"] | null;
  reference?: string | null;
  journalId?: string | null;
  fundId?: string | null;
  resolutionId?: string | null;
  kind?: Schemas["ExpenseKind"];
  pettyCashId?: string | null;
  note?: string | null;
  attachments?: Schemas["ExpenseAttachmentDto"][];
  certificate?: Schemas["WhtCertificateRefDto"] | null;
  decisionReason?: string | null;
  cancelReason?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  vendorContractId?: string | null;
  quotationRoundId?: string | null;
}): Schemas["ExpenseRequestDto"] {
  const lines = input.lines.map((line, index): Schemas["ExpenseLineDto"] => {
    const vat = line.vat ?? 0;
    const whtAmount = line.wht ? Math.round(((line.amount - vat) * Number(line.wht[1])) / 100) : 0;
    const acc = (live()?.accounting?.accounts ?? initialAccounts()).find(
      (candidate) => candidate.id === line.accountId,
    );
    return {
      lineNo: index + 1,
      accountId: line.accountId,
      accountCode: acc?.code ?? "",
      accountName: acc?.nameTh ?? "",
      description: line.description,
      amount: baht(line.amount),
      vatAmount: baht(vat),
      whtKey: line.wht?.[0] ?? null,
      whtRatePct: line.wht ? line.wht[1] : null,
      whtIncomeType: line.wht?.[2] ?? null,
      whtAmount: baht(whtAmount),
    };
  });
  const amount = input.lines.reduce((total, line) => total + line.amount, 0);
  const wht = lines.reduce((total, line) => total + satang(line.whtAmount), 0);
  const approvals = input.approvals ?? [];
  const band = input.submittedAt || input.state !== "draft" ? bandFor(baht(amount)) : null;
  return {
    id: aid("e0e0a001", input.n),
    number: input.number,
    buildingId: input.buildingId,
    buildingName: buildingName(input.buildingId),
    kind: input.kind ?? "expense",
    title: input.title,
    payeePartyId: input.payee.id,
    payeeName: input.payee.name,
    pettyCashId: input.pettyCashId ?? null,
    fundId: input.fundId ?? null,
    resolutionId: input.resolutionId ?? null,
    vendorId: input.vendorId ?? null,
    vendorName: input.vendorName ?? null,
    vendorContractId: input.vendorContractId ?? null,
    quotationRoundId: input.quotationRoundId ?? null,
    state: input.state,
    amount: baht(amount),
    whtAmount: baht(wht),
    netAmount: baht(amount - wht),
    band,
    approvalsRequired: band?.approvals ?? null,
    approvalsGiven: approvals.filter((approval) => approval.decision === "approved").length,
    requestedBy: input.requestedBy,
    submittedAt: input.submittedAt ?? null,
    approvedAt: ["approved", "paid"].includes(input.state) ? (approvals.at(-1)?.createdAt ?? null) : null,
    rejectedAt: input.state === "rejected" ? (approvals.at(-1)?.createdAt ?? null) : null,
    decisionReason: input.decisionReason ?? null,
    cancelledAt: input.state === "cancelled" ? input.createdAt : null,
    cancelReason: input.cancelReason ?? null,
    paidAt: input.paidOn ? `${input.paidOn}T14:00:00+07:00` : null,
    paidOn: input.paidOn ?? null,
    paymentMethod: input.method ?? null,
    paymentReference: input.reference ?? null,
    paidFromAccountId: input.paidOn ? (input.method === "cash" ? ACC.cash : ACC.bank) : null,
    journalId: input.journalId ?? null,
    note: input.note ?? null,
    lines,
    attachments: input.attachments ?? [],
    approvals,
    certificate: input.certificate ?? null,
    nextActions: [],
    createdAt: input.createdAt,
    version: 1,
  };
}

/** Approval bands in force (the setting's value, the API's defaults until the office sets its own). */
function bands(): { upTo: string | null; roles: Schemas["ExpenseApproverRole"][]; approvals: number }[] {
  const setting = live()?.collections?.settings.find((s) => s.key === "juristic.approval_bands");
  const value = (setting?.value ?? DEFAULT_BANDS) as ReturnType<typeof bands>;
  return Array.isArray(value) ? value : DEFAULT_BANDS;
}

function whtRates(): typeof DEFAULT_WHT_RATES {
  const setting = live()?.collections?.settings.find((s) => s.key === "juristic.wht_rates");
  return Array.isArray(setting?.value) ? (setting.value as typeof DEFAULT_WHT_RATES) : DEFAULT_WHT_RATES;
}

function bandFor(amount: string): Schemas["ExpenseBandDto"] {
  const list = bands();
  const value = satang(amount);
  let previous: string | null = null;
  for (const band of list) {
    if (band.upTo === null || value <= satang(band.upTo))
      return {
        key: band.upTo === null ? `gt:${previous ?? "0.00"}` : `le:${band.upTo}`,
        upTo: band.upTo,
        roles: band.roles,
        approvals: band.approvals,
      };
    previous = band.upTo;
  }
  const last = list.at(-1)!;
  return { key: `gt:${previous ?? "0.00"}`, upTo: null, roles: last.roles, approvals: last.approvals };
}

/** The band an amount falls in (J2.2 award approvals use the same bands). */
export function expenseBandFor(amount: string): Schemas["ExpenseBandDto"] {
  return bandFor(amount);
}

/** J2.2: the WHT rate of a key as the expense line takes it. */
function whtTuple(key: string | null | undefined): [string, string, string] | undefined {
  const rate = key ? whtRates().find((candidate) => candidate.key === key) : undefined;
  return rate ? [rate.key, rate.ratePct, rate.incomeType] : undefined;
}

/**
 * J2.2 (D-331): an expense request made on the API's side — an instalment of an active vendor contract submitted by the
 * `vendor-contracts` job, or the draft an awarded quotation round creates. One line on the given account.
 */
export function addVendorExpense(input: {
  buildingId: string;
  title: string;
  payee: { partyId: string; name: string; taxId: string | null };
  accountId: string;
  description: string;
  amount: string;
  vatAmount?: string;
  whtKey?: string | null;
  requestedBy: string;
  state: "draft" | "submitted";
  vendorId: string;
  vendorContractId?: string | null;
  quotationRoundId?: string | null;
  attachments?: Schemas["ExpenseAttachmentDto"][];
}): Schemas["ExpenseRequestDto"] {
  const world = state.accounting;
  world.counter.expense += 1;
  const n = 700 + world.counter.expense;
  const year = date().slice(0, 4);
  const created = expenseDto({
    n,
    number: input.state === "submitted" ? `EXP-${year}-${String(world.counter.expense).padStart(5, "0")}` : null,
    buildingId: input.buildingId,
    title: input.title,
    payee: { id: input.payee.partyId, name: input.payee.name, type: "company", taxId: input.payee.taxId },
    state: input.state,
    lines: [
      {
        accountId: input.accountId,
        description: input.description,
        amount: satang(input.amount),
        vat: input.vatAmount ? satang(input.vatAmount) : 0,
        wht: whtTuple(input.whtKey),
      },
    ],
    requestedBy: input.requestedBy,
    createdAt: iso(),
    submittedAt: input.state === "submitted" ? iso() : null,
    attachments: input.attachments ?? [],
    vendorId: input.vendorId,
    vendorName: input.payee.name,
    vendorContractId: input.vendorContractId ?? null,
    quotationRoundId: input.quotationRoundId ?? null,
  });
  world.expenses.unshift(created);
  return created;
}

const approval = (
  userId: string,
  role: Schemas["ExpenseApproverRole"],
  at: string,
  decision: Schemas["ExpenseDecision"] = "approved",
  reason: string | null = null,
): Schemas["ExpenseApprovalDto"] => ({ approverUserId: userId, role, decision, reason, createdAt: at });

function certificateFor(
  expense: Schemas["ExpenseRequestDto"],
  number: string,
  n: number,
  vendor: Vendor,
): Schemas["WhtCertificateDto"] {
  const groups = new Map<string, { incomeType: string; ratePct: string; base: number; tax: number }>();
  for (const line of expense.lines) {
    if (!line.whtRatePct) continue;
    const key = `${line.whtIncomeType}|${line.whtRatePct}`;
    const group = groups.get(key) ?? {
      incomeType: line.whtIncomeType ?? "",
      ratePct: line.whtRatePct,
      base: 0,
      tax: 0,
    };
    group.base += satang(line.amount) - satang(line.vatAmount);
    group.tax += satang(line.whtAmount);
    groups.set(key, group);
  }
  const items = [...groups.values()].map((group) => ({
    incomeType: group.incomeType,
    ratePct: group.ratePct,
    base: baht(group.base),
    tax: baht(group.tax),
  }));
  return {
    id: aid("c50a0a01", n),
    number,
    buildingId: expense.buildingId,
    expenseRequestId: expense.id,
    payeePartyId: vendor.id ?? expense.id,
    payeeName: vendor.name,
    payeeTaxIdHint: (vendor.taxId ?? "0000").slice(-4),
    form: vendor.type === "company" ? "pnd53" : "pnd3",
    items,
    base: baht(items.reduce((total, item) => total + satang(item.base), 0)),
    tax: baht(items.reduce((total, item) => total + satang(item.tax), 0)),
    paidOn: expense.paidOn ?? date(),
    documentId: aid("d0c5a001", n),
    issuedAt: expense.paidAt ?? iso(),
  };
}

/** Everything the ledger posted, month by month, for Building A and Soi 1. */
function buildLedger(accounts: Schemas["AccountDto"][]): Built {
  const out: Built = { journals: [], expenses: [], certificates: [], transfers: [], pettyEntries: [], payments: [] };
  const months = ledgerMonths();
  const first = months[0]!;
  let j = 0;
  let e = 0;
  let c = 0;
  let t = 0;
  const jidNext = () => aid("10a0a001", ++j);
  const add = (
    buildingId: string,
    postedOn: string,
    source: Schemas["JuristicJournalSource"],
    sourceId: string | null,
    memo: string,
    lines: LineInput[],
    patch: Partial<Schemas["JournalDto"]> = {},
  ) => {
    const built = journal(jidNext(), buildingId, postedOn, source, sourceId, memo, lines, patch, accounts);
    out.journals.push(built);
    return built;
  };

  // Opening balances (the day the office started on getproperty).
  add(J.buildingA, `${first}-01`, "opening", null, "ยอดยกมา ณ วันเริ่มใช้ระบบ – อาคาร A", [
    [ACC.bank, 125_000_000, 0],
    [ACC.fundBankA, 240_000_000, 0],
    [ACC.fundEquityA, 0, 240_000_000],
    [ACC.surplus, 0, 125_000_000],
  ]);
  add(J.soi1, `${first}-01`, "opening", null, "ยอดยกมา ณ วันเริ่มใช้ระบบ – ซอย 1", [
    [ACC.villageBank, 38_000_000, 0],
    [ACC.fundBankSoi, 60_000_000, 0],
    [ACC.fundEquitySoi, 0, 60_000_000],
    [ACC.surplus, 0, 38_000_000],
  ]);

  const expenseJournal = (
    buildingId: string,
    on: string,
    title: string,
    vendor: Vendor,
    lines: { accountId: string; description: string; amount: number; wht?: [string, string, string] }[],
    month: number,
    options: { method?: Schemas["ExpensePaymentMethod"]; fromAccount?: string } = {},
  ) => {
    const n = ++e;
    const year = on.slice(0, 4);
    const number = `EXP-${year}-${String(n).padStart(5, "0")}`;
    const exp = expenseDto({
      n,
      number,
      buildingId,
      title,
      payee: vendor,
      state: "paid",
      lines,
      requestedBy: n % 3 === 0 ? STAFF_USER : OWNER_USER,
      createdAt: `${on.slice(0, 8)}01T09:00:00+07:00`,
      submittedAt: `${on.slice(0, 8)}01T09:30:00+07:00`,
      paidOn: on,
      method: options.method ?? "bank_transfer",
      reference: `KB${on.replace(/-/g, "")}${String(n).padStart(3, "0")}`,
      attachments: [
        { documentId: aid("d0e0a001", n * 2), kind: "invoice", createdAt: `${on.slice(0, 8)}01T09:00:00+07:00` },
        { documentId: aid("d0e0a001", n * 2 + 1), kind: "payment_evidence", createdAt: `${on}T14:00:00+07:00` },
      ],
    });
    const required = exp.approvalsRequired ?? 1;
    const approvers: [string, Schemas["ExpenseApproverRole"]][] = [
      [COMMITTEE_USER, "committee"],
      [OWNER_USER, "owner"],
      [aid("3b24a0a1", 6), "committee"],
    ].filter(([user]) => user !== exp.requestedBy) as [string, Schemas["ExpenseApproverRole"]][];
    exp.approvals = approvers
      .slice(0, required)
      .map(([user, role], index) => approval(user, role, `${on.slice(0, 8)}0${2 + index}T11:00:00+07:00`));
    exp.approvalsGiven = exp.approvals.length;
    exp.approvedAt = exp.approvals.at(-1)?.createdAt ?? null;
    const amount = satang(exp.amount);
    const wht = satang(exp.whtAmount);
    const from = options.fromAccount ?? (buildingId === J.soi1 ? ACC.villageBank : ACC.bank);
    const posted = add(buildingId, on, "expense_payment", exp.id, `${number} ${title}`, [
      ...lines.map(({ accountId, amount: value }): LineInput => [accountId, value, 0]),
      ...(wht > 0 ? [[ACC.whtPayable, 0, wht] as LineInput] : []),
      [from, 0, amount - wht],
    ]);
    exp.journalId = posted.id;
    exp.paidFromAccountId = from;
    if (wht > 0) {
      c += 1;
      const certificate = certificateFor(exp, `WHT-${year}-${String(c).padStart(5, "0")}`, c, vendor);
      exp.certificate = {
        id: certificate.id,
        number: certificate.number,
        documentId: certificate.documentId,
        tax: certificate.tax,
      };
      out.certificates.push(certificate);
    }
    out.expenses.push(exp);
    void month;
    return exp;
  };

  months.forEach((month, index) => {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const day = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
    const last = index === months.length - 1;
    // Invoices of the month (common fee + fund, surcharge on late payers).
    const feeA = 15_840_000;
    const fundA = 1_584_000;
    const surchargeA = roundBaht(vary(index, 3) * 180_000);
    add(
      J.buildingA,
      day(1),
      "invoice",
      aid("1b0a0a01", index * 2 + 1),
      `ใบแจ้งหนี้ค่าส่วนกลาง ${month} – อาคาร A (16 ห้อง)`,
      [
        [ACC.receivable, feeA + fundA + surchargeA, 0],
        [ACC.incomeCommonFee, 0, feeA],
        [ACC.fundEquityA, 0, fundA],
        ...(surchargeA > 0 ? [[ACC.incomeSurcharge, 0, surchargeA] as LineInput] : []),
      ],
    );
    const feeS = 3_100_000;
    const fundS = 310_000;
    add(
      J.soi1,
      day(1),
      "invoice",
      aid("1b0a0a01", index * 2 + 2),
      `ใบแจ้งหนี้ค่าบำรุงสาธารณูปโภค ${month} – ซอย 1 (10 แปลง)`,
      [
        [ACC.receivable, feeS + fundS, 0],
        [ACC.incomeCommonFee, 0, feeS],
        [ACC.fundEquitySoi, 0, fundS],
      ],
    );
    // Payments received (most of it) — not yet for the current month's last days.
    const paidA = roundBaht((feeA + fundA + surchargeA) * (0.9 + vary(index, 5) * 0.09));
    const payA = aid("9a1a0a01", index * 2 + 1);
    add(J.buildingA, day(12), "payment", payA, `รับชำระค่าส่วนกลาง ${month} – อาคาร A`, [
      [ACC.bank, paidA, 0],
      [ACC.receivable, 0, paidA],
    ]);
    out.payments.push({
      id: payA,
      buildingId: J.buildingA,
      on: day(12),
      amount: paidA,
      label: `รับชำระค่าส่วนกลาง ${month}`,
    });
    const paidS = roundBaht((feeS + fundS) * (0.92 + vary(index, 7) * 0.07));
    add(J.soi1, day(14), "payment", aid("9a1a0a01", index * 2 + 2), `รับชำระค่าบำรุงสาธารณูปโภค ${month} – ซอย 1`, [
      [ACC.villageBank, paidS, 0],
      [ACC.receivable, 0, paidS],
    ]);
    // Expenses paid (the current month's are still in requests).
    if (!last) {
      expenseJournal(
        J.buildingA,
        day(25),
        "เงินเดือนเจ้าหน้าที่นิติบุคคล",
        payee("เจ้าหน้าที่นิติบุคคล (3 คน)", "person"),
        [{ accountId: ACC.personnel, description: "เงินเดือนผู้จัดการและเจ้าหน้าที่ 3 คน", amount: 4_200_000 }],
        index,
      );
      expenseJournal(
        J.buildingA,
        day(20),
        "ค่าไฟฟ้าและค่าน้ำประปาส่วนกลาง",
        payee("การไฟฟ้านครหลวง / การประปานครหลวง", "company"),
        [
          {
            accountId: ACC.utilities,
            description: `ค่าไฟฟ้าส่วนกลาง ${month}`,
            amount: roundBaht(1_500_000 + vary(index, 11) * 600_000),
          },
          {
            accountId: ACC.utilities,
            description: `ค่าน้ำประปาส่วนกลาง ${month}`,
            amount: roundBaht(220_000 + vary(index, 13) * 90_000),
          },
        ],
        index,
      );
      expenseJournal(
        J.buildingA,
        day(5),
        "ค่าจ้างรักษาความปลอดภัย",
        VENDORS[1]!,
        [
          {
            accountId: ACC.services,
            description: `บริการรักษาความปลอดภัย 24 ชม. ${month}`,
            amount: 3_960_000,
            wht: ["service", "3.00", "3 เตรส"],
          },
        ],
        index,
      );
      expenseJournal(
        J.buildingA,
        day(6),
        "ค่าจ้างทำความสะอาด",
        VENDORS[3]!,
        [
          {
            accountId: ACC.services,
            description: `ทำความสะอาดพื้นที่ส่วนกลาง ${month}`,
            amount: 1_890_000,
            wht: ["service", "3.00", "3 เตรส"],
          },
        ],
        index,
      );
      if (m % 3 === 0)
        expenseJournal(
          J.buildingA,
          day(18),
          "ค่าบำรุงรักษาลิฟต์ประจำไตรมาส",
          VENDORS[2]!,
          [
            {
              accountId: ACC.repairs,
              description: `บำรุงรักษาลิฟต์ 2 ตัว ไตรมาส ${Math.ceil(m / 3)}`,
              amount: 2_568_000,
              wht: ["service", "3.00", "3 เตรส"],
            },
          ],
          index,
        );
      if (m === 3)
        expenseJournal(
          J.buildingA,
          day(10),
          "เบี้ยประกันภัยอาคารประจำปี",
          payee("บริษัท ทิพยประกันภัย จำกัด (มหาชน)", "company"),
          [
            {
              accountId: ACC.insurance,
              description: `ประกันอัคคีภัยและความรับผิดต่อบุคคลภายนอก ${y}`,
              amount: 4_800_000,
            },
          ],
          index,
        );
      if (m === 4)
        expenseJournal(
          J.buildingA,
          day(28),
          "ค่าจัดประชุมใหญ่สามัญประจำปี",
          payee("ร้านอาหาร ครัวริมน้ำ", "company"),
          [{ accountId: ACC.meetings, description: "ค่าสถานที่และอาหารว่างผู้เข้าประชุม", amount: 1_250_000 }],
          index,
        );
      expenseJournal(
        J.soi1,
        day(5),
        "ค่าจ้างรักษาความปลอดภัย หมู่บ้าน",
        VENDORS[1]!,
        [
          {
            accountId: ACC.services,
            description: `ป้อมยามหมู่บ้าน 24 ชม. ${month}`,
            amount: 1_200_000,
            wht: ["service", "3.00", "3 เตรส"],
          },
        ],
        index,
      );
      expenseJournal(
        J.soi1,
        day(20),
        "ค่าไฟฟ้าส่องสว่างถนน",
        payee("การไฟฟ้านครหลวง", "company"),
        [
          {
            accountId: ACC.utilities,
            description: `ไฟถนนและปั๊มน้ำ ${month}`,
            amount: roundBaht(560_000 + vary(index, 17) * 140_000),
          },
        ],
        index,
      );
    }
    // Fund contributions move to the fund's bank account each quarter.
    if (m % 3 === 0 && !last) {
      const id = aid("f7a0a001", ++t);
      const posted = add(
        J.buildingA,
        day(28),
        "fund_transfer",
        id,
        `โอนเงินสมทบกองทุนสำรอง ไตรมาส ${Math.ceil(m / 3)}/${y + 543} – อาคาร A`,
        [
          [ACC.fundBankA, fundA * 3, 0],
          [ACC.bank, 0, fundA * 3],
        ],
        { fundId: FUND.a },
      );
      out.transfers.push({
        id,
        fundId: FUND.a,
        fundName: "กองทุนสำรอง อาคาร A",
        buildingId: J.buildingA,
        direction: "in",
        amount: baht(fundA * 3),
        counterAccountId: ACC.bank,
        counterAccountCode: "1130",
        transferOn: day(28),
        resolutionId: null,
        reference: `SCB${month.replace("-", "")}28`,
        note: null,
        state: "posted",
        requestedBy: OWNER_USER,
        requestedAt: `${day(27)}T10:00:00+07:00`,
        decidedBy: COMMITTEE_USER,
        decidedAt: `${day(28)}T09:00:00+07:00`,
        decisionReason: null,
        journalId: posted.id,
        nextActions: [],
        version: 2,
      });
    }
  });

  // Petty cash: the float and its spends (this year).
  const year = Number(date().slice(0, 4));
  const pettyOn = `${year}-01-03`;
  const topUp = expenseJournal(
    J.buildingA,
    pettyOn,
    "ตั้งวงเงินสดย่อยสำนักงาน",
    payee("เงินสดย่อยสำนักงาน – อาคาร A", "person"),
    [{ accountId: ACC.pettyA, description: "ตั้งวงเงินสดย่อย", amount: 500_000 }],
    0,
    { method: "cheque" },
  );
  topUp.kind = "petty_cash_top_up";
  topUp.pettyCashId = PETTY.a;
  out.pettyEntries.push({
    id: aid("9e7e0a01", 1),
    kind: "top_up",
    amount: "5000.00",
    entryOn: pettyOn,
    description: "ตั้งวงเงินสดย่อย",
    accountId: null,
    receiptDocumentId: null,
    expenseRequestId: topUp.id,
    countId: null,
    journalId: topUp.journalId!,
    createdAt: `${pettyOn}T14:00:00+07:00`,
  });
  const spends: [number, string, string, number][] = [
    [8, "ค่าน้ำดื่มสำนักงาน", ACC.admin, 36_000],
    [15, "ค่าส่งเอกสารไปรษณีย์ลงทะเบียน", ACC.admin, 18_500],
    [22, "หลอดไฟ LED ทางเดินชั้น 3", ACC.repairs, 124_000],
    [29, "ค่าถ่ายเอกสารวาระประชุม", ACC.admin, 42_000],
    [40, "กุญแจล็อกห้องเครื่องปั๊ม", ACC.repairs, 65_000],
  ];
  spends.forEach(([offset, description, accountId, amount], index) => {
    const on = date(-offset);
    const entryId = aid("9e7e0a01", index + 2);
    const posted = add(J.buildingA, on, "petty_cash", entryId, `เงินสดย่อย: ${description}`, [
      [accountId, amount, 0],
      [ACC.pettyA, 0, amount],
    ]);
    out.pettyEntries.push({
      id: entryId,
      kind: "spend",
      amount: baht(-amount),
      entryOn: on,
      description,
      accountId,
      receiptDocumentId: aid("d0e1a001", index + 1),
      expenseRequestId: null,
      countId: null,
      journalId: posted.id,
      createdAt: `${on}T16:00:00+07:00`,
    });
  });
  const countOn = date(-35);
  const difference = add(J.buildingA, countOn, "petty_cash", aid("9e7e0a01", 20), "เงินสดย่อยขาดจากการตรวจนับ", [
    [ACC.otherExpense, 2_000, 0],
    [ACC.pettyA, 0, 2_000],
  ]);
  out.pettyEntries.push({
    id: aid("9e7e0a01", 20),
    kind: "count_difference",
    amount: "-20.00",
    entryOn: countOn,
    description: "ตรวจนับเงินสดย่อย – ขาด",
    accountId: ACC.otherExpense,
    receiptDocumentId: null,
    expenseRequestId: null,
    countId: aid("9e7c0a01", 1),
    journalId: difference.id,
    createdAt: `${countOn}T17:00:00+07:00`,
  });

  // A correction posted by hand and reversed (the WHT of one month was recorded twice).
  const wrongOn = date(-50);
  const wrong = add(J.buildingA, wrongOn, "manual", null, "ปรับปรุงภาษีหัก ณ ที่จ่ายค้างนำส่ง (บันทึกซ้ำ)", [
    [ACC.whtPayable, 175_500, 0],
    [ACC.bank, 0, 175_500],
  ]);
  const reversal = add(
    J.buildingA,
    date(-48),
    "reversal",
    wrong.id,
    "กลับรายการ: ปรับปรุงภาษีหัก ณ ที่จ่ายค้างนำส่ง (บันทึกซ้ำ)",
    [
      [ACC.bank, 175_500, 0],
      [ACC.whtPayable, 0, 175_500],
    ],
    { reversesJournalId: wrong.id },
  );
  wrong.reversedByJournalId = reversal.id;
  // WHT remitted to the Revenue Department (ภ.ง.ด.53), by hand.
  add(J.buildingA, date(-38), "manual", null, "นำส่งภาษีหัก ณ ที่จ่าย ภ.ง.ด.53 เดือนก่อน", [
    [ACC.whtPayable, 175_500, 0],
    [ACC.bank, 0, 175_500],
  ]);
  return out;
}

// ── Expense requests of this month (every state) ──────────────────────────────────────────────────────────────────

function openExpenses(start: number): Schemas["ExpenseRequestDto"][] {
  const year = date().slice(0, 4);
  let n = start;
  const next = () => ++n;
  const num = (k: number) => `EXP-${year}-${String(k).padStart(5, "0")}`;
  const list: Schemas["ExpenseRequestDto"][] = [];
  // Waiting for one approval — requested by staff (the owner may approve: "รออนุมัติจากฉัน").
  const pump = next();
  list.push(
    expenseDto({
      n: pump,
      number: num(pump),
      buildingId: J.buildingA,
      title: "ซ่อมปั๊มน้ำดีชั้นใต้ดิน",
      payee: VENDORS[0]!,
      state: "submitted",
      lines: [
        {
          accountId: ACC.repairs,
          description: "เปลี่ยนซีลและลูกปืนปั๊มน้ำดี ตัวที่ 2",
          amount: 642_000,
          vat: 42_000,
          wht: ["service", "3.00", "3 เตรส"],
        },
        {
          accountId: ACC.repairs,
          description: "ค่าแรงช่าง 2 คน ครึ่งวัน",
          amount: 214_000,
          vat: 14_000,
          wht: ["service", "3.00", "3 เตรส"],
        },
      ],
      requestedBy: STAFF_USER,
      createdAt: iso(-2),
      submittedAt: iso(-2),
      note: "ปั๊มตัวที่ 2 มีเสียงดังและน้ำรั่วซึม ช่างตรวจแล้วเสนอราคาตามใบเสนอราคาแนบ",
      attachments: [
        { documentId: aid("d0e2a001", 1), kind: "quotation", createdAt: iso(-2) },
        { documentId: aid("d0e2a001", 2), kind: "other", createdAt: iso(-2) },
      ],
    }),
  );
  // Waiting for a second approval — the committee approved, the owner is the second.
  const lift = next();
  list.push(
    expenseDto({
      n: lift,
      number: num(lift),
      buildingId: J.buildingA,
      title: "เปลี่ยนชุดควบคุมประตูลิฟต์ตัวที่ 1",
      payee: VENDORS[2]!,
      state: "submitted",
      lines: [
        {
          accountId: ACC.repairs,
          description: "ชุดควบคุมประตู (door operator) พร้อมติดตั้ง",
          amount: 4_815_000,
          vat: 315_000,
          wht: ["service", "3.00", "3 เตรส"],
        },
      ],
      requestedBy: ACCOUNTANT_USER,
      createdAt: iso(-4),
      submittedAt: iso(-4),
      approvals: [approval(COMMITTEE_USER, "committee", iso(-3))],
      attachments: [
        { documentId: aid("d0e2a001", 3), kind: "quotation", createdAt: iso(-4) },
        { documentId: aid("d0e2a001", 4), kind: "quotation", createdAt: iso(-4) },
        { documentId: aid("d0e2a001", 5), kind: "quotation", createdAt: iso(-4) },
      ],
      note: "เทียบราคา 3 ราย เลือกรายที่ต่ำสุดและรับประกัน 1 ปี",
    }),
  );
  // Approved, to pay.
  const security = next();
  list.push(
    expenseDto({
      n: security,
      number: num(security),
      buildingId: J.buildingA,
      title: "ค่าจ้างรักษาความปลอดภัยเดือนนี้",
      payee: VENDORS[1]!,
      state: "approved",
      lines: [
        {
          accountId: ACC.services,
          description: "บริการรักษาความปลอดภัย 24 ชม. 4 ผลัด",
          amount: 3_960_000,
          wht: ["service", "3.00", "3 เตรส"],
        },
      ],
      requestedBy: STAFF_USER,
      createdAt: iso(-6),
      submittedAt: iso(-6),
      approvals: [approval(COMMITTEE_USER, "committee", iso(-5)), approval(OWNER_USER, "owner", iso(-5))],
      attachments: [{ documentId: aid("d0e2a001", 6), kind: "invoice", createdAt: iso(-6) }],
    }),
  );
  // The owner's own request, waiting — the owner cannot approve it (maker ≠ checker).
  const paint = next();
  list.push(
    expenseDto({
      n: paint,
      number: num(paint),
      buildingId: J.soi1,
      title: "ทาสีรั้วและป้ายทางเข้าหมู่บ้าน",
      payee: VENDORS[4]!,
      state: "submitted",
      lines: [
        { accountId: ACC.repairs, description: "สีทาภายนอก 6 แกลลอน", amount: 540_000 },
        {
          accountId: ACC.repairs,
          description: "ค่าแรงทาสี 3 วัน",
          amount: 360_000,
          wht: ["service", "3.00", "3 เตรส"],
        },
      ],
      requestedBy: OWNER_USER,
      createdAt: iso(-1),
      submittedAt: iso(-1),
      attachments: [{ documentId: aid("d0e2a001", 7), kind: "quotation", createdAt: iso(-1) }],
    }),
  );
  // A draft the owner is still writing.
  const meeting = next();
  list.push(
    expenseDto({
      n: meeting,
      number: null,
      buildingId: J.buildingA,
      title: "ค่าเอกสารและอาหารว่างประชุมกรรมการ",
      payee: payee("ร้านถ่ายเอกสาร ริเวอร์ก๊อปปี้", "person"),
      state: "draft",
      lines: [
        { accountId: ACC.meetings, description: "ถ่ายเอกสารวาระและรายงานการเงิน 12 ชุด", amount: 96_000 },
        { accountId: ACC.meetings, description: "อาหารว่างกรรมการ 9 ท่าน", amount: 135_000 },
      ],
      requestedBy: OWNER_USER,
      createdAt: iso(0),
    }),
  );
  // Rejected and cancelled.
  const plants = next();
  list.push(
    expenseDto({
      n: plants,
      number: num(plants),
      buildingId: J.buildingA,
      title: "ปรับภูมิทัศน์สวนหน้าอาคาร",
      payee: payee("สวนสวยการ์เด้น", "person"),
      state: "rejected",
      lines: [{ accountId: ACC.repairs, description: "ต้นไม้และค่าแรงจัดสวน", amount: 2_800_000 }],
      requestedBy: STAFF_USER,
      createdAt: iso(-12),
      submittedAt: iso(-12),
      approvals: [
        approval(COMMITTEE_USER, "committee", iso(-10), "rejected", "ยังไม่อยู่ในงบประมาณปีนี้ ให้เสนอในงบปีหน้า"),
      ],
      decisionReason: "ยังไม่อยู่ในงบประมาณปีนี้ ให้เสนอในงบปีหน้า",
    }),
  );
  const cctv = next();
  list.push(
    expenseDto({
      n: cctv,
      number: num(cctv),
      buildingId: J.buildingA,
      title: "กล้องวงจรปิดเพิ่มที่ลานจอดรถ",
      payee: payee("ร้านซีซีทีวี โปร", "person"),
      state: "cancelled",
      lines: [{ accountId: ACC.repairs, description: "กล้อง 4 ตัวพร้อมเดินสาย", amount: 1_850_000 }],
      requestedBy: OWNER_USER,
      createdAt: iso(-15),
      submittedAt: iso(-15),
      cancelReason: "ผู้ให้บริการรายเดิมติดตั้งให้ตามสัญญาบำรุงรักษา",
    }),
  );
  return list;
}

// ── The world ───────────────────────────────────────────────────────────────────────────────────────────────────────

function bankAccount(
  id: string,
  bankCode: string,
  bankNameTh: string,
  accountNoMasked: string,
  accountName: string,
  buildingIds: string[] | null,
  isDefault = false,
): Schemas["BankAccountDto"] {
  return {
    id,
    bankCode,
    bankNameTh,
    branch: null,
    accountNoMasked,
    accountName,
    paymentProvider: "none",
    buildingIds: buildingIds ?? [],
    isDefault,
    state: "active",
    confirmedAt: iso(-700),
    createdAt: iso(-700),
    nextActions: [],
  };
}

export function initialAccountingWorld(): MockAccountingWorld {
  const accounts = initialAccounts();
  const built = buildLedger(accounts);
  const expenses = [...built.expenses, ...openExpenses(built.expenses.length)];
  const transfers = [...built.transfers];
  // The out-transfer waiting for a second user (requested by the owner persona; the committee approves).
  transfers.push({
    id: aid("f7a0a001", 90),
    fundId: FUND.a,
    fundName: "กองทุนสำรอง อาคาร A",
    buildingId: J.buildingA,
    direction: "out",
    amount: "185000.00",
    counterAccountId: ACC.bank,
    counterAccountCode: "1130",
    transferOn: date(-1),
    resolutionId: RESOLUTION_A,
    reference: null,
    note: "เบิกกองทุนสำรองเพื่อเปลี่ยนชุดควบคุมประตูลิฟต์และซ่อมระบบปั๊มน้ำ ตามมติที่ประชุมใหญ่",
    state: "requested",
    requestedBy: OWNER_USER,
    requestedAt: iso(-1),
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    journalId: null,
    nextActions: [],
    version: 1,
  });
  const world: MockAccountingWorld = {
    accounts,
    journals: built.journals.sort((a, b) => b.postedOn.localeCompare(a.postedOn) || b.id.localeCompare(a.id)),
    expenses,
    certificates: built.certificates,
    funds: [],
    transfers,
    pettyCash: [
      {
        id: PETTY.a,
        buildingId: J.buildingA,
        name: "เงินสดย่อยสำนักงาน อาคาร A",
        custodianUserId: STAFF_USER,
        floatAmount: "5000.00",
        accountId: ACC.pettyA,
        balance: "0.00",
        isActive: true,
        lastCount: { countedOn: date(-35), countedAmount: "4540.00", difference: "-20.00" },
        version: 3,
        entries: built.pettyEntries.sort((a, b) => b.entryOn.localeCompare(a.entryOn)),
        counts: [
          {
            id: aid("9e7c0a01", 1),
            countedOn: date(-35),
            countedAmount: "4540.00",
            bookBalance: "4560.00",
            difference: "-20.00",
            note: "เหรียญขาดจากการทอนค่าส่งเอกสาร",
            countedBy: OWNER_USER,
            createdAt: `${date(-35)}T17:00:00+07:00`,
          },
        ],
      },
    ],
    statements: [],
    lines: [],
    candidates: {},
    bankAccounts: [
      bankAccount(
        BANK.operating,
        "004",
        "ธนาคารกสิกรไทย",
        "•••-•-•1234-•",
        "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์",
        [J.buildingA],
        true,
      ),
      bankAccount(
        BANK.fund,
        "014",
        "ธนาคารไทยพาณิชย์",
        "•••-•-•4521-•",
        "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์ (กองทุนสำรอง)",
        [J.buildingA],
      ),
      bankAccount(BANK.village, "002", "ธนาคารกรุงเทพ", "•••-•-•7788-•", "นิติบุคคลหมู่บ้านจัดสรร สวนสน", [
        J.soi1,
        J.soi2,
      ]),
    ],
    unposted: 2,
    counter: { expense: expenses.length, certificate: built.certificates.length, journal: built.journals.length },
  };
  seedStatement(world, built.payments);
  return world;
}

/** A KBank statement of last month: credits = owners' payments, debits = paid expenses, a fee, some unmatched. */
function seedStatement(world: MockAccountingWorld, payments: Built["payments"]) {
  const statementId = aid("b5a7a001", 1);
  const month = (() => {
    const d = new Date(Date.now() + 7 * 3600_000);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();
  const paymentOfMonth = payments.find((payment) => payment.buildingId === J.buildingA && payment.on.startsWith(month));
  const paidExpenses = world.expenses.filter(
    (expense) => expense.state === "paid" && expense.buildingId === J.buildingA && expense.paidOn?.startsWith(month),
  );
  type Seed = [
    day: number,
    amount: number,
    description: string,
    reference: string | null,
    match: Schemas["BankLineMatch"],
    target: string | null,
  ];
  const owners = [
    ["A-101", "ศิริพร วงศ์สุวรรณ", 1_120_000],
    ["A-102", "กิตติศักดิ์ พานิชกิจ", 1_465_500],
    ["A-203", "สมพร ใจดี", 1_620_000],
    ["A-204", "ธนดล เจริญทรัพย์", 2_133_000],
    ["A-301", "วรรณี ศรีสุข", 1_120_000],
    ["A-302", "ธนสิริ มั่นคง", 1_465_500],
  ] as const;
  const seeds: Seed[] = [
    ...owners.map(([unit, name, amount], index): Seed => [
      3 + index * 2,
      amount,
      `โอนเงินเข้า ${name.split(" ")[0]} ${unit}`,
      index < 4 ? `QR${month.replace("-", "")}${unit.replace("-", "")}` : null,
      index < 3 ? "payment" : "none",
      index < 3 ? aid("9a1b0a01", index + 1) : null,
    ]),
    ...paidExpenses
      .slice(0, 4)
      .map((expense): Seed => [
        Number(expense.paidOn!.slice(8, 10)),
        -satang(expense.netAmount),
        `โอนเงินออก ${expense.payeeName.slice(0, 28)}`,
        expense.paymentReference,
        "expense",
        expense.id,
      ]),
    [28, -1_500, "ค่าธรรมเนียมโอนต่างธนาคาร", null, "ignored", null],
    [29, -2_140_000, "โอนเงินออก บจก. ลิฟท์แอนด์เอสคาเลเตอร์", null, "none", null],
    [30, 520_000, "ดอกเบี้ยเงินฝาก", null, "none", null],
  ];
  void paymentOfMonth;
  let balance = 182_450_000;
  const lines = seeds
    .sort((a, b) => a[0] - b[0])
    .map(([day, amount, description, reference, match, target], index): Schemas["BankStatementLineDetailDto"] => {
      balance += amount;
      return {
        id: aid("b5a71a01", index + 1),
        statementId,
        lineNo: index + 1,
        bookedOn: `${month}-${String(Math.min(day, 28)).padStart(2, "0")}`,
        amount: baht(amount),
        description,
        reference,
        balance: baht(balance),
        matchKind: match,
        matchId: target,
        matchMethod: match === "none" || match === "ignored" ? null : "auto",
        matchedAt: match === "none" ? null : iso(-3),
        ignoreReason: match === "ignored" ? "ค่าธรรมเนียมธนาคาร บันทึกรวมสิ้นเดือน" : null,
        version: 1,
        suggestions: [],
      };
    });
  world.lines = lines;
  // Candidates for the unmatched lines.
  for (const line of lines.filter((l) => l.matchKind === "none")) {
    const owner = owners.find(([unit]) => line.description.includes(unit));
    if (owner) {
      const [unit, name] = owner;
      world.candidates[line.id] = [
        {
          kind: "payment",
          id: aid("9a1b0a01", 10 + line.lineNo),
          amount: line.amount,
          bookedOn: line.bookedOn,
          label: `รับชำระ ${unit} · ${name}`,
          referenceHit: line.reference !== null,
          days: 0,
        },
        {
          kind: "payment",
          id: aid("9a1b0a01", 30 + line.lineNo),
          amount: line.amount,
          bookedOn: line.bookedOn,
          label: `รับชำระ ${unit === "A-301" ? "A-302" : "A-301"} · ยอดเท่ากัน`,
          referenceHit: false,
          days: 2,
        },
      ];
    } else if (line.description.includes("ลิฟท์")) {
      const lift = world.expenses.find((expense) => expense.payeePartyId === VENDOR.lift && expense.state === "paid");
      world.candidates[line.id] = lift
        ? [
            {
              kind: "expense",
              id: lift.id,
              amount: line.amount,
              bookedOn: lift.paidOn ?? line.bookedOn,
              label: `${lift.number} · ${lift.title}`,
              referenceHit: false,
              days: 3,
            },
          ]
        : [];
    } else world.candidates[line.id] = [];
  }
  const matched = lines.filter((l) => l.matchKind !== "none" && l.matchKind !== "ignored").length;
  const unmatched = lines.filter((l) => l.matchKind === "none").length;
  world.statements = [
    {
      id: statementId,
      bankAccountId: BANK.operating,
      bankName: "ธนาคารกสิกรไทย",
      bankAccountMasked: "•••-•-•1234-•",
      accountId: ACC.bank,
      formatKey: "kbank",
      fileName: `kbank-statement-${month}.csv`,
      fileDocumentId: aid("d0c6a001", 1),
      periodStart: `${month}-01`,
      periodEnd: lines.at(-1)!.bookedOn,
      lineCount: lines.length,
      duplicateCount: 0,
      matchedCount: matched,
      unmatchedCount: unmatched,
      importedAt: iso(-3),
    },
  ];
}

const w = () => state.accounting;
const juristicOnly = (ok: Ok) => ok.tenantId === JURISTIC_TENANT;
const userOf = (ok: Ok) => ok.persona.user.id;
const can = (ok: Ok, permission: string) => allowed(ok, "owner.juristicExpenses.list", permission) === null;

// ── Derived figures (the API computes them from the journals) ────────────────────────────────────────────────────

function linesUpTo(asOf: string, buildingId: string | null) {
  return w()
    .journals.filter((entry) => entry.postedOn <= asOf && (!buildingId || entry.buildingId === buildingId))
    .flatMap((entry) => entry.lines.map((line) => ({ ...line, postedOn: entry.postedOn })));
}

function normalBalance(type: Schemas["JuristicAccountType"], debit: number, credit: number) {
  return type === "asset" || type === "expense" ? debit - credit : credit - debit;
}

function balances(asOf: string, buildingId: string | null) {
  const sums = new Map<string, { debit: number; credit: number }>();
  for (const line of linesUpTo(asOf, buildingId)) {
    const sum = sums.get(line.accountId) ?? { debit: 0, credit: 0 };
    sum.debit += satang(line.debit);
    sum.credit += satang(line.credit);
    sums.set(line.accountId, sum);
  }
  return sums;
}

function refreshFunds() {
  const sums = balances("9999-12-31", null);
  const balanceOf = (accountId: string, type: Schemas["JuristicAccountType"]) => {
    const sum = sums.get(accountId) ?? { debit: 0, credit: 0 };
    return baht(normalBalance(type, sum.debit, sum.credit));
  };
  const existing = new Map(w().funds.map((fund) => [fund.id, fund]));
  const base: Schemas["FundDto"][] = [
    {
      id: FUND.a,
      buildingId: J.buildingA,
      buildingName: buildingName(J.buildingA),
      kind: "sinking",
      name: "กองทุนสำรอง อาคาร A",
      bankAccountId: BANK.fund,
      bankAccountMasked: "ไทยพาณิชย์ •••-•-•4521-•",
      isActive: true,
      ledgerBankAccountId: ACC.fundBankA,
      ledgerEquityAccountId: ACC.fundEquityA,
      bankBalance: "0.00",
      equityBalance: "0.00",
      version: 1,
    },
    {
      id: FUND.soi,
      buildingId: J.soi1,
      buildingName: buildingName(J.soi1),
      kind: "sinking",
      name: "กองทุนสำรอง ซอย 1",
      bankAccountId: null,
      bankAccountMasked: null,
      isActive: true,
      ledgerBankAccountId: ACC.fundBankSoi,
      ledgerEquityAccountId: ACC.fundEquitySoi,
      bankBalance: "0.00",
      equityBalance: "0.00",
      version: 1,
    },
  ];
  const ids = new Set(base.map((fund) => fund.id));
  const list = [...base.map((fund) => existing.get(fund.id) ?? fund), ...w().funds.filter((fund) => !ids.has(fund.id))];
  for (const fund of list) {
    fund.bankBalance = balanceOf(fund.ledgerBankAccountId, "asset");
    fund.equityBalance = balanceOf(fund.ledgerEquityAccountId, "equity");
  }
  w().funds = list;
}

function refreshPetty(petty: Schemas["PettyCashDetailDto"]) {
  petty.balance = baht(petty.entries.reduce((total, entry) => total + satang(entry.amount), 0));
}

function periodKey(day: string, granularity: Schemas["ReportGranularity"]) {
  if (granularity === "year") return day.slice(0, 4);
  if (granularity === "quarter") return `${day.slice(0, 4)}-Q${Math.ceil(Number(day.slice(5, 7)) / 3)}`;
  return day.slice(0, 7);
}

function periodsOf(from: string, to: string, granularity: Schemas["ReportGranularity"]) {
  const out: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  while (`${year}-${String(month).padStart(2, "0")}` <= to.slice(0, 7)) {
    const key = periodKey(`${year}-${String(month).padStart(2, "0")}-01`, granularity);
    if (!out.includes(key)) out.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function incomeStatement(
  from: string,
  to: string,
  buildingId: string | null,
  granularity: Schemas["ReportGranularity"],
) {
  const periods = periodsOf(from, to, granularity);
  const lines = linesUpTo(to, buildingId).filter((line) => line.postedOn >= from);
  const section = (type: "income" | "expense"): Schemas["StatementSectionDto"] => {
    const accounts = w()
      .accounts.filter((acc) => acc.type === type)
      .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }))
      .map((acc) => {
        const amounts = periods.map(() => 0);
        for (const line of lines.filter((l) => l.accountId === acc.id)) {
          const index = periods.indexOf(periodKey(line.postedOn, granularity));
          if (index >= 0) amounts[index]! += normalBalance(type, satang(line.debit), satang(line.credit));
        }
        return { acc, amounts };
      })
      .filter(({ amounts }) => amounts.some((value) => value !== 0));
    const byPeriod = periods.map((_, index) => accounts.reduce((total, row) => total + row.amounts[index]!, 0));
    return {
      accounts: accounts.map(({ acc, amounts }) => ({
        accountId: acc.id,
        code: acc.code,
        nameTh: acc.nameTh,
        nameEn: acc.nameEn,
        amounts: amounts.map(baht),
        total: baht(amounts.reduce((total, value) => total + value, 0)),
      })),
      byPeriod: byPeriod.map(baht),
      total: baht(byPeriod.reduce((total, value) => total + value, 0)),
    };
  };
  const income = section("income");
  const expense = section("expense");
  return {
    from,
    to,
    buildingId,
    granularity,
    periods,
    income,
    expense,
    surplusByPeriod: periods.map((_, index) =>
      baht(satang(income.byPeriod[index]!) - satang(expense.byPeriod[index]!)),
    ),
    surplus: baht(satang(income.total) - satang(expense.total)),
  } satisfies Schemas["IncomeStatementDto"];
}

function balanceSheet(asOf: string, buildingId: string | null): Schemas["BalanceSheetDto"] {
  const sums = balances(asOf, buildingId);
  const rows = (type: Schemas["JuristicAccountType"]) =>
    w()
      .accounts.filter((acc) => acc.type === type)
      .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }))
      .map((acc) => {
        const sum = sums.get(acc.id) ?? { debit: 0, credit: 0 };
        return { acc, value: normalBalance(type, sum.debit, sum.credit) };
      })
      .filter(({ value }) => value !== 0);
  const section = (type: Schemas["JuristicAccountType"]) => {
    const list = rows(type);
    return {
      accounts: list.map(({ acc, value }) => ({
        accountId: acc.id,
        code: acc.code,
        nameTh: acc.nameTh,
        nameEn: acc.nameEn,
        balance: baht(value),
      })),
      total: list.reduce((total, row) => total + row.value, 0),
    };
  };
  const assets = section("asset");
  const liabilities = section("liability");
  const equity = section("equity");
  const income = rows("income").reduce((total, row) => total + row.value, 0);
  const expense = rows("expense").reduce((total, row) => total + row.value, 0);
  const surplus = income - expense;
  const equityTotal = equity.total + surplus;
  return {
    asOf,
    buildingId,
    assets: { accounts: assets.accounts, total: baht(assets.total) },
    liabilities: { accounts: liabilities.accounts, total: baht(liabilities.total) },
    equity: { accounts: equity.accounts, surplusToDate: baht(surplus), total: baht(equityTotal) },
    balanced: assets.total === liabilities.total + equityTotal,
  };
}

function trialBalance(asOf: string, buildingId: string | null): Schemas["TrialBalanceDto"] {
  const sums = balances(asOf, buildingId);
  const accounts = w()
    .accounts.filter((acc) => sums.has(acc.id))
    .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }))
    .map((acc) => {
      const sum = sums.get(acc.id)!;
      return {
        accountId: acc.id,
        code: acc.code,
        nameTh: acc.nameTh,
        nameEn: acc.nameEn,
        type: acc.type,
        debit: baht(sum.debit),
        credit: baht(sum.credit),
        balance: baht(normalBalance(acc.type, sum.debit, sum.credit)),
      };
    });
  const totalDebit = accounts.reduce((total, row) => total + satang(row.debit), 0);
  const totalCredit = accounts.reduce((total, row) => total + satang(row.credit), 0);
  return {
    asOf,
    buildingId,
    accounts,
    totalDebit: baht(totalDebit),
    totalCredit: baht(totalCredit),
    balanced: totalDebit === totalCredit,
  };
}

function ledgerReceivables(buildingId: string | null): Schemas["LedgerReceivablesDto"] {
  const asOf = date();
  const buildings = [J.buildingA, J.soi1].filter((id) => !buildingId || id === buildingId);
  const perBuilding = buildings.map((id) => {
    const sum = balances(asOf, id).get(ACC.receivable) ?? { debit: 0, credit: 0 };
    const ledger = sum.debit - sum.credit;
    // Soi 1 has two payments the ledger has not posted yet until back-post runs.
    const gap = id === J.soi1 && w().unposted > 0 ? 360_000 : 0;
    const planNotInvoiced = id === J.buildingA ? 4_860_000 : 0;
    const payerCredit = id === J.buildingA ? 125_000 : 0;
    const expected = ledger - gap;
    const openInvoices = expected + payerCredit - planNotInvoiced;
    return {
      buildingId: id,
      name: buildingName(id),
      ledgerReceivable: baht(ledger),
      openInvoices: baht(openInvoices),
      payerCredit: baht(payerCredit),
      planNotInvoiced: baht(planNotInvoiced),
      expected: baht(expected),
      difference: baht(ledger - expected),
    };
  });
  const total = (key: keyof (typeof perBuilding)[number]) =>
    baht(perBuilding.reduce((sum, row) => sum + satang(row[key] as string), 0));
  return {
    asOf,
    perBuilding,
    total: {
      ledgerReceivable: total("ledgerReceivable"),
      openInvoices: total("openInvoices"),
      payerCredit: total("payerCredit"),
      planNotInvoiced: total("planNotInvoiced"),
      expected: total("expected"),
      difference: total("difference"),
    },
  };
}

// ── Expense rules (the API's) ───────────────────────────────────────────────────────────────────────────────────

function expenseActions(expense: Schemas["ExpenseRequestDto"], ok: Ok): string[] {
  const user = userOf(ok);
  const role = roleOf(ok);
  const out: string[] = [];
  const request = can(ok, "juristic.expense.request");
  switch (expense.state) {
    case "draft":
      if (request) out.push("edit", "submit", "cancel", "attach");
      break;
    case "submitted": {
      const decided = expense.approvals.some((entry) => entry.approverUserId === user);
      const inBand = role !== null && (expense.band?.roles as string[] | undefined)?.includes(role);
      if (can(ok, "juristic.expense.approve") && expense.requestedBy !== user && !decided && inBand)
        out.push("approve", "reject");
      if (request) out.push("cancel", "attach");
      break;
    }
    case "approved":
      if (can(ok, "juristic.expense.pay")) out.push("pay");
      if (request) out.push("cancel", "attach");
      break;
    default:
      break;
  }
  return out;
}

const view = (expense: Schemas["ExpenseRequestDto"], ok: Ok) => ({
  ...expense,
  nextActions: expenseActions(expense, ok),
});

function awaiting(expense: Schemas["ExpenseRequestDto"], ok: Ok) {
  return expense.state === "submitted" && expenseActions(expense, ok).includes("approve");
}

function linesFrom(input: Schemas["ExpenseLineInputDto"][], op: string): Schemas["ExpenseLineDto"][] | Response {
  const rates = whtRates();
  const out: Schemas["ExpenseLineDto"][] = [];
  for (const [index, line] of input.entries()) {
    const acc = accountOf(line.accountId);
    if (!acc || acc.type !== "expense" || !acc.isActive)
      return validation(op, `lines[${index}].accountId`, "ต้องเป็นบัญชีค่าใช้จ่ายที่เปิดใช้");
    if (!line.description?.trim()) return validation(op, `lines[${index}].description`, "กรอกรายละเอียด");
    if (!MONEY.test(line.amount ?? "") || satang(line.amount) <= 0)
      return validation(op, `lines[${index}].amount`, "จำนวนเงินไม่ถูกต้อง");
    const vat = line.vatAmount ? satang(line.vatAmount) : 0;
    if (line.vatAmount && (!MONEY.test(line.vatAmount) || vat > satang(line.amount)))
      return validation(op, `lines[${index}].vatAmount`, "ภาษีมูลค่าเพิ่มต้องไม่เกินจำนวนเงิน");
    const rate = line.whtKey ? rates.find((candidate) => candidate.key === line.whtKey) : undefined;
    if (line.whtKey && !rate) return validation(op, `lines[${index}].whtKey`, "ไม่พบอัตราภาษีนี้");
    const tax = rate ? Math.round(((satang(line.amount) - vat) * Number(rate.ratePct)) / 100) : 0;
    out.push({
      lineNo: index + 1,
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.nameTh,
      description: line.description.trim(),
      amount: baht(satang(line.amount)),
      vatAmount: baht(vat),
      whtKey: rate?.key ?? null,
      whtRatePct: rate?.ratePct ?? null,
      whtIncomeType: rate?.incomeType ?? null,
      whtAmount: baht(tax),
    });
  }
  return out;
}

function totals(expense: Schemas["ExpenseRequestDto"]) {
  const amount = expense.lines.reduce((total, line) => total + satang(line.amount), 0);
  const wht = expense.lines.reduce((total, line) => total + satang(line.whtAmount), 0);
  expense.amount = baht(amount);
  expense.whtAmount = baht(wht);
  expense.netAmount = baht(amount - wht);
}

/** `juristic.quotation_threshold` (J2.2) as the settings list holds it. */
export function quotationThreshold(): string {
  const setting = live()?.collections?.settings.find((s) => s.key === "juristic.quotation_threshold");
  return typeof setting?.value === "string" ? setting.value : "50000.00";
}

/** J2.2: the vendor, contract and round an expense request names — checked as the API checks them. */
function vendorLinks(
  op: string,
  vendorId: string | null | undefined,
  contractId: string | null | undefined,
  roundId: string | null | undefined,
  buildingId: string,
): { vendor: { id: string; partyId: string; name: string } | null } | Response {
  if (!vendorId) {
    if (contractId) return validation(op, "vendorContractId", "เลือกผู้ให้บริการของสัญญานี้ก่อน");
    return { vendor: null };
  }
  const vendor = state.vendors?.vendors.find((candidate) => candidate.dto.id === vendorId);
  if (!vendor) return validation(op, "vendorId", "ไม่พบผู้ให้บริการนี้");
  if (vendor.dto.state === "blocked") return problem(op, "vendor.blocked");
  if (contractId) {
    const contract = state.vendors.contracts.find((candidate) => candidate.id === contractId);
    if (
      !contract ||
      contract.vendorId !== vendorId ||
      contract.buildingId !== buildingId ||
      contract.state !== "active"
    )
      return validation(op, "vendorContractId", "ต้องเป็นสัญญาที่ใช้งานอยู่ของผู้ให้บริการนี้ในอาคารเดียวกัน");
  }
  if (roundId) {
    const round = state.vendors.rounds.find((candidate) => candidate.id === roundId);
    const awarded = round?.quotations.find((quotation) => quotation.id === round.awardedQuotationId);
    if (!round || round.state !== "awarded" || awarded?.vendorId !== vendorId || round.buildingId !== buildingId)
      return validation(op, "quotationRoundId", "ต้องเป็นรอบใบเสนอราคาที่ให้งานผู้ให้บริการนี้แล้ว");
  }
  return { vendor: { id: vendor.dto.id, partyId: vendor.dto.partyId, name: vendor.dto.name } };
}

function resolutionOk(resolutionId: string | undefined | null, buildingId: string) {
  const resolution = state.juristic.resolutions.find((r) => r.id === resolutionId);
  return Boolean(resolution && resolution.state === "adopted" && resolution.buildingId === buildingId);
}

function postJournal(
  buildingId: string,
  postedOn: string,
  source: Schemas["JuristicJournalSource"],
  sourceId: string | null,
  memo: string,
  lines: LineInput[],
  patch: Partial<Schemas["JournalDto"]> = {},
) {
  w().counter.journal += 1;
  const built = journal(
    aid("10a0a001", 5000 + w().counter.journal),
    buildingId,
    postedOn,
    source,
    sourceId,
    memo,
    lines,
    patch,
  );
  w().journals.unshift(built);
  return built;
}

// ── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────────

const chartHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/accounts", ({ request }) => {
    const op = "owner.juristicAccounts.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json({ data: [] });
    const forbidden = allowed(ok, op, "juristic.accounting.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const data = w().accounts.filter(
      (acc) =>
        (!params.get("type") || acc.type === params.get("type")) &&
        (params.get("active") === null || String(acc.isActive) === params.get("active")),
    );
    return json({ data });
  }),
  http.post("*/v1/owner/juristic/accounts", async ({ request }) => {
    const op = "owner.juristicAccounts.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["AccountCreateDto"]>(request);
    record(op, request, input);
    if (!/^[A-Za-z0-9.-]{1,20}$/.test(input.code ?? ""))
      return validation(op, "code", "ตัวอักษร ตัวเลข จุด หรือขีด 1–20 ตัว");
    if (!input.nameTh?.trim()) return validation(op, "nameTh", "กรอกชื่อภาษาไทย");
    if (!input.nameEn?.trim()) return validation(op, "nameEn", "กรอกชื่อภาษาอังกฤษ");
    if (w().accounts.some((acc) => acc.code === input.code)) return problem(op, "account.code_taken");
    const created = account(crypto.randomUUID(), input.code, input.type, input.nameTh.trim(), input.nameEn.trim(), {
      isSystem: false,
      used: false,
      bankAccountId: input.bankAccountId ?? null,
    });
    w().accounts.push(created);
    return json(created, 201);
  }),
  http.patch("*/v1/owner/juristic/accounts/:accountId", async ({ request, params }) => {
    const op = "owner.juristicAccounts.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? accountOf(params.accountId as string) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["AccountUpdateDto"]>(request);
    record(op, request, input);
    if (input.version !== undefined && input.version !== found.version) return problem(op, "concurrency.stale");
    if (input.isActive === false && found.isSystem) return problem(op, "account.system");
    if (input.nameTh !== undefined) found.nameTh = input.nameTh.trim() || found.nameTh;
    if (input.nameEn !== undefined) found.nameEn = input.nameEn.trim() || found.nameEn;
    if (input.isActive !== undefined) found.isActive = input.isActive;
    if (input.bankAccountId !== undefined) found.bankAccountId = input.bankAccountId;
    found.version += 1;
    return json(found);
  }),
  // The juristic office's bank accounts (the owner world answers only its own tenant).
  http.get("*/v1/owner/bank-accounts", ({ request }) => {
    const ok = owner(request, "owner.bankAccounts.list");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    return json(w().bankAccounts);
  }),
  // Vendors and the register's parties (payees of expense requests).
  http.get("*/v1/owner/parties", ({ request }) => {
    const ok = owner(request, "owner.parties.list");
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const vendors = VENDORS.map((vendor): Schemas["PartyDto"] => ({
      ...partyDto({
        id: vendor.id,
        type: vendor.type,
        displayName: vendor.name,
        phoneMasked: null,
        email: null,
        lineLinked: false,
        residentLinked: false,
      } as Schemas["RegisterPartyDto"]),
      taxId: vendor.taxId,
    }));
    const rows = [...vendors, ...state.juristic.parties.map(partyDto)].filter(
      (row) =>
        (!params.get("type") || row.type === params.get("type")) && (!q || row.displayName.toLowerCase().includes(q)),
    );
    return json(paged(rows, request));
  }),
];

const journalHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/journals", ({ request }) => {
    const op = "owner.juristicJournals.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const forbidden = allowed(ok, op, "juristic.accounting.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const rows = w().journals.filter(
      (entry) =>
        (!params.get("buildingId") || entry.buildingId === params.get("buildingId")) &&
        (!params.get("sourceType") || entry.sourceType === params.get("sourceType")) &&
        (!params.get("from") || entry.postedOn >= params.get("from")!) &&
        (!params.get("to") || entry.postedOn <= params.get("to")!) &&
        (!params.get("accountId") || entry.lines.some((line) => line.accountId === params.get("accountId"))) &&
        (!q || entry.memo.toLowerCase().includes(q)),
    );
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/juristic/journals/:journalId", ({ request, params }) => {
    const op = "owner.juristicJournals.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().journals.find((entry) => entry.id === params.journalId) : undefined;
    return found ? json(found) : notFound(op);
  }),
  http.post("*/v1/owner/juristic/journals", async ({ request }) => {
    const op = "owner.juristicJournals.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["ManualJournalCreateDto"];
      if (!input.memo?.trim()) return validation(op, "memo", "กรอกคำอธิบายรายการ");
      if (!input.postedOn || input.postedOn > date()) return validation(op, "postedOn", "วันที่ต้องไม่เกินวันนี้");
      const lines = (input.lines ?? []).map((line): LineInput => [
        line.accountId,
        line.debit ? satang(line.debit) : 0,
        line.credit ? satang(line.credit) : 0,
        line.memo ? { memo: line.memo } : {},
      ]);
      const debit = lines.reduce((total, [, d]) => total + d, 0);
      const credit = lines.reduce((total, [, , c]) => total + c, 0);
      if (lines.length < 2 || debit !== credit || debit === 0 || lines.some(([, d, c]) => d > 0 === c > 0))
        return problem(op, "journal.unbalanced");
      const fundCredit = lines.some(([id, , c]) => c > 0 && accountOf(id)?.role === "fund_bank");
      if (fundCredit && !input.resolutionId) return problem(op, "fund.resolution_required");
      if (input.resolutionId && !resolutionOk(input.resolutionId, input.buildingId))
        return problem(op, "fund.resolution_invalid");
      const built = postJournal(
        input.buildingId,
        input.postedOn,
        input.opening ? "opening" : "manual",
        null,
        input.memo.trim(),
        lines,
        {
          resolutionId: input.resolutionId ?? null,
        },
      );
      return { status: 201, body: built };
    });
  }),
  http.post("*/v1/owner/juristic/journals/:journalId/actions/reverse", async ({ request, params }) => {
    const op = "owner.juristicJournals.reverse";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().journals.find((entry) => entry.id === params.journalId) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["JournalReverseDto"];
      const reason = input.reason?.trim() ?? "";
      if (reason.length < 3) return validation(op, "reason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
      if (found.reversedByJournalId) return problem(op, "journal.already_reversed");
      if (found.sourceType !== "manual" && found.sourceType !== "opening") return problem(op, "journal.not_reversible");
      const postedOn = input.postedOn ?? date();
      if (postedOn < found.postedOn) return validation(op, "postedOn", "วันที่ต้องไม่ก่อนรายการเดิม");
      const reversal = postJournal(
        found.buildingId,
        postedOn,
        "reversal",
        found.id,
        `กลับรายการ: ${found.memo} — ${reason}`,
        found.lines.map((line): LineInput => [line.accountId, satang(line.credit), satang(line.debit)]),
        { reversesJournalId: found.id },
      );
      found.reversedByJournalId = reversal.id;
      return { status: 200, body: reversal };
    });
  }),
  http.post("*/v1/owner/juristic/ledger/actions/back-post", async ({ request }) => {
    const op = "owner.juristicLedger.backPost";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, () => {
      const posted = w().unposted;
      if (posted > 0) {
        postJournal(J.soi1, date(-2), "payment", aid("9a1a0a01", 900), "รับชำระค่าบำรุง แปลง 99/13 (ลงบัญชีย้อนหลัง)", [
          [ACC.villageBank, 180_000, 0],
          [ACC.receivable, 0, 180_000],
        ]);
        postJournal(J.soi1, date(-1), "payment", aid("9a1a0a01", 901), "รับชำระค่าบำรุง แปลง 99/21 (ลงบัญชีย้อนหลัง)", [
          [ACC.villageBank, 180_000, 0],
          [ACC.receivable, 0, 180_000],
        ]);
        w().unposted = 0;
      }
      return { status: 200, body: { posted, recognised: 0 } satisfies Schemas["BackPostResultDto"] };
    });
  }),
  http.post("*/v1/owner/juristic/ledger/exports", async ({ request }) => {
    const op = "owner.juristicLedger.export";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["LedgerExportCreateDto"];
      if (!input.from || !input.to || input.from > input.to) return validation(op, "to", "ช่วงวันที่ไม่ถูกต้อง");
      const kind = `juristic_journal_${input.format}` as Schemas["ExportKind"];
      const job: Schemas["ExportJobDto"] = {
        id: crypto.randomUUID(),
        kind,
        status: "done",
        buildingId: input.buildingId ?? null,
        params: {},
        requestedAt: iso(),
        finishedAt: iso(),
        rowCount: w().journals.filter((entry) => entry.postedOn >= input.from && entry.postedOn <= input.to).length,
        error: null,
        download: { url: `${new URL(request.url).origin}/__files/pdf-export`, expiresAt: iso(1 / 288) },
        version: 1,
      };
      state.collections.exportJobs.unshift(job);
      return { status: 202, body: job };
    });
  }),
];

const reportHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/reports/income-statement", ({ request }) => {
    const op = "owner.juristicReports.incomeStatement";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const from = params.get("from") ?? `${date().slice(0, 4)}-01-01`;
    const to = params.get("to") ?? date();
    const granularity = (params.get("granularity") ?? "month") as Schemas["ReportGranularity"];
    return json(incomeStatement(from, to, params.get("buildingId"), granularity));
  }),
  http.get("*/v1/owner/juristic/reports/balance-sheet", ({ request }) => {
    const op = "owner.juristicReports.balanceSheet";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const params = query(request);
    return json(balanceSheet(params.get("asOf") ?? date(), params.get("buildingId")));
  }),
  http.get("*/v1/owner/juristic/reports/trial-balance", ({ request }) => {
    const op = "owner.juristicReports.trialBalance";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const params = query(request);
    return json(trialBalance(params.get("asOf") ?? date(), params.get("buildingId")));
  }),
  http.get("*/v1/owner/juristic/reports/ledger-receivables", ({ request }) => {
    const op = "owner.juristicReports.ledgerReceivables";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    return json(ledgerReceivables(query(request).get("buildingId")));
  }),
  http.get("*/v1/owner/juristic/budgets/:budgetId/actual-income", ({ request, params }) => {
    const op = "owner.juristicBudgets.actualIncome";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return undefined;
    const budget = state.juristic.budgets.find((b) => b.id === params.budgetId);
    if (!budget) return notFound(op);
    const share = (amount: string, part: number) => (Math.round(Number(amount) * 100 * part) / 100).toFixed(2);
    const asOf = date() < budget.periodEnd ? date() : budget.periodEnd;
    const expenseLines = budget.lines
      .filter((row) => row.kind !== "income")
      .map((row): Schemas["BudgetExpenseLineDto"] => {
        if (!row.accountId)
          return {
            budgetLineId: row.id,
            kind: row.kind,
            label: row.label,
            accountId: null,
            budgeted: row.amount,
            actual: null,
            remaining: null,
          };
        const actual = w()
          .journals.filter(
            (entry) =>
              entry.buildingId === budget.buildingId &&
              entry.postedOn >= budget.periodStart &&
              entry.postedOn <= budget.periodEnd,
          )
          .flatMap((entry) => entry.lines)
          .filter((line) => line.accountId === row.accountId)
          .reduce((total, line) => total + satang(line.debit) - satang(line.credit), 0);
        const signed = row.kind === "fund" ? -actual : actual;
        return {
          budgetLineId: row.id,
          kind: row.kind,
          label: row.label,
          accountId: row.accountId,
          budgeted: row.amount,
          actual: baht(signed),
          remaining: baht(satang(row.amount) - signed),
        };
      });
    const budgetedExpense = baht(expenseLines.reduce((total, row) => total + satang(row.budgeted), 0));
    const actualExpense = baht(expenseLines.reduce((total, row) => total + (row.actual ? satang(row.actual) : 0), 0));
    return json({
      budgetId: budget.id,
      buildingId: budget.buildingId,
      fiscalYear: budget.fiscalYear,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
      asOf,
      budgetedIncome: budget.incomeTotal,
      incomeLines: budget.lines.filter((row) => row.kind === "income").map(({ label, amount }) => ({ label, amount })),
      billed: share(budget.incomeTotal, 0.5),
      billedByKind: [
        { kind: "common_fee", amount: share(budget.incomeTotal, 0.45) },
        { kind: "fund", amount: share(budget.incomeTotal, 0.04) },
        { kind: "surcharge", amount: share(budget.incomeTotal, 0.01) },
      ],
      collected: share(budget.incomeTotal, 0.43),
      billedVsBudgetPct: "50.00",
      collectedVsBilledPct: "86.00",
      expenseSideAvailable: true,
      budgetedExpense,
      actualExpense,
      expenseLines,
    } satisfies Schemas["BudgetActualIncomeDto"]);
  }),
];

const expenseHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/expense-requests", ({ request }) => {
    const op = "owner.juristicExpenses.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const forbidden = allowed(ok, op, "juristic.expense.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const rows = w()
      .expenses.filter(
        (expense) =>
          (!params.get("state") || expense.state === params.get("state")) &&
          (!params.get("kind") || expense.kind === params.get("kind")) &&
          (!params.get("buildingId") || expense.buildingId === params.get("buildingId")) &&
          (params.get("awaitingMe") !== "true" || awaiting(expense, ok)) &&
          (!q ||
            expense.title.toLowerCase().includes(q) ||
            expense.payeeName.toLowerCase().includes(q) ||
            (expense.number ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((expense) => view(expense, ok));
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/juristic/expense-requests/:id", ({ request, params }) => {
    const op = "owner.juristicExpenses.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().expenses.find((expense) => expense.id === params.id) : undefined;
    return found ? json(view(found, ok)) : notFound(op);
  }),
  http.post("*/v1/owner/juristic/expense-requests", async ({ request }) => {
    const op = "owner.juristicExpenses.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.expense.request");
    if (forbidden) return forbidden;
    const input = await body<Schemas["ExpenseCreateDto"]>(request);
    record(op, request, input);
    if (!input.title?.trim()) return validation(op, "title", "กรอกเรื่องที่ขอเบิก");
    const kind = input.kind ?? "expense";
    let lines: Schemas["ExpenseLineDto"][] = [];
    if (kind === "expense") {
      if (!input.lines?.length) return validation(op, "lines", "เพิ่มรายการอย่างน้อย 1 รายการ");
      const parsed = linesFrom(input.lines, op);
      if (parsed instanceof Response) return parsed;
      lines = parsed;
    } else {
      if (!input.amount || !MONEY.test(input.amount)) return validation(op, "amount", "จำนวนเงินไม่ถูกต้อง");
      lines = [
        {
          lineNo: 1,
          accountId: ACC.pettyA,
          accountCode: "1120-01",
          accountName: accountName(ACC.pettyA),
          description: "เติมวงเงินสดย่อย",
          amount: baht(satang(input.amount)),
          vatAmount: "0.00",
          whtKey: null,
          whtRatePct: null,
          whtIncomeType: null,
          whtAmount: "0.00",
        },
      ];
    }
    if (input.fundId && !input.resolutionId) return problem(op, "fund.resolution_required");
    if (input.resolutionId && !resolutionOk(input.resolutionId, input.buildingId))
      return problem(op, "fund.resolution_invalid");
    const linked = vendorLinks(op, input.vendorId, input.vendorContractId, input.quotationRoundId, input.buildingId);
    if (linked instanceof Response) return linked;
    const vendor = VENDORS.find((candidate) => candidate.id === input.payeePartyId);
    const party = state.juristic.parties.find((candidate) => candidate.id === input.payeePartyId);
    const payeeName = linked.vendor?.name || input.payeeName?.trim() || vendor?.name || party?.displayName || "";
    if (!payeeName) return validation(op, "payeeName", "ระบุผู้รับเงิน");
    w().counter.expense += 1;
    const created: Schemas["ExpenseRequestDto"] = {
      ...expenseDto({
        n: 700 + w().counter.expense,
        number: null,
        buildingId: input.buildingId,
        title: input.title.trim(),
        payee: payee(payeeName, "person"),
        state: "draft",
        lines: [],
        requestedBy: userOf(ok),
        createdAt: iso(),
        kind,
        pettyCashId: input.pettyCashId ?? null,
        fundId: input.fundId ?? null,
        resolutionId: input.resolutionId ?? null,
        note: input.note?.trim() || null,
      }),
      payeePartyId: linked.vendor?.partyId ?? input.payeePartyId ?? null,
      buildingName: buildingName(input.buildingId),
      vendorId: linked.vendor?.id ?? null,
      vendorName: linked.vendor?.name ?? null,
      vendorContractId: input.vendorContractId ?? null,
      quotationRoundId: input.quotationRoundId ?? null,
      lines,
    };
    totals(created);
    w().expenses.unshift(created);
    return json(view(created, ok), 201);
  }),
  http.patch("*/v1/owner/juristic/expense-requests/:id", async ({ request, params }) => {
    const op = "owner.juristicExpenses.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().expenses.find((expense) => expense.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.expense.request");
    if (forbidden) return forbidden;
    const input = await body<Schemas["ExpenseUpdateDto"]>(request);
    record(op, request, input);
    if (found.state !== "draft") return problem(op, "expense.invalid_state");
    if (input.version !== undefined && input.version !== found.version) return problem(op, "concurrency.stale");
    if (input.lines) {
      const parsed = linesFrom(input.lines, op);
      if (parsed instanceof Response) return parsed;
      found.lines = parsed;
    }
    if (input.title !== undefined) found.title = input.title.trim() || found.title;
    if (input.payeeName !== undefined) found.payeeName = input.payeeName.trim() || found.payeeName;
    if (input.payeePartyId !== undefined) found.payeePartyId = input.payeePartyId;
    if (input.note !== undefined) found.note = input.note;
    if (input.fundId !== undefined) found.fundId = input.fundId;
    if (input.resolutionId !== undefined) found.resolutionId = input.resolutionId;
    if (found.fundId && !found.resolutionId) return problem(op, "fund.resolution_required");
    if (input.vendorId !== undefined || input.vendorContractId !== undefined || input.quotationRoundId !== undefined) {
      const vendorId = input.vendorId !== undefined ? input.vendorId : found.vendorId;
      const contractId = input.vendorContractId !== undefined ? input.vendorContractId : found.vendorContractId;
      const roundId = input.quotationRoundId !== undefined ? input.quotationRoundId : found.quotationRoundId;
      const linked = vendorLinks(op, vendorId, contractId, roundId, found.buildingId);
      if (linked instanceof Response) return linked;
      found.vendorId = linked.vendor?.id ?? null;
      found.vendorName = linked.vendor?.name ?? null;
      found.vendorContractId = linked.vendor ? (contractId ?? null) : null;
      found.quotationRoundId = linked.vendor ? (roundId ?? null) : null;
      if (linked.vendor) {
        found.payeePartyId = linked.vendor.partyId;
        found.payeeName = linked.vendor.name;
      }
    }
    totals(found);
    found.version += 1;
    return json(view(found, ok));
  }),
  http.post("*/v1/owner/juristic/expense-requests/:id/attachments", async ({ request, params }) => {
    const op = "owner.juristicExpenses.attach";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().expenses.find((expense) => expense.id === params.id) : undefined;
    if (!found) return notFound(op);
    const input = await body<Schemas["ExpenseAttachDto"]>(request);
    record(op, request, input);
    if (["paid", "rejected", "cancelled"].includes(found.state)) return problem(op, "expense.invalid_state");
    found.attachments.push({ documentId: input.documentId, kind: input.kind, createdAt: iso() });
    found.version += 1;
    return json(view(found, ok));
  }),
  http.post("*/v1/owner/juristic/expense-requests/:id/actions/:action", async ({ request, params }) => {
    const action = params.action as "submit" | "approve" | "reject" | "cancel" | "pay";
    const op = {
      submit: "owner.juristicExpenses.submit",
      approve: "owner.juristicExpenses.approve",
      reject: "owner.juristicExpenses.reject",
      cancel: "owner.juristicExpenses.cancel",
      pay: "owner.juristicExpenses.pay",
    }[action];
    if (!op) return undefined;
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().expenses.find((expense) => expense.id === params.id) : undefined;
    if (!found) return notFound(op);
    const permission = {
      submit: "juristic.expense.request",
      cancel: "juristic.expense.request",
      approve: "juristic.expense.approve",
      reject: "juristic.expense.approve",
      pay: "juristic.expense.pay",
    }[action];
    const forbidden = allowed(ok, op, permission);
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const user = userOf(ok);
      const role = roleOf(ok) as Schemas["ExpenseApproverRole"];
      switch (action) {
        case "submit": {
          if (found.state !== "draft") return problem(op, "expense.invalid_state");
          if (
            found.vendorId &&
            !found.vendorContractId &&
            !found.quotationRoundId &&
            satang(found.amount) > satang(quotationThreshold())
          )
            return problem(op, "expense.quotations_required");
          const year = date().slice(0, 4);
          w().counter.expense += 1;
          found.number = `EXP-${year}-${String(w().counter.expense).padStart(5, "0")}`;
          found.band = bandFor(found.amount);
          found.approvalsRequired = found.band.approvals;
          found.state = "submitted";
          found.submittedAt = iso();
          break;
        }
        case "approve":
        case "reject": {
          if (found.state !== "submitted") return problem(op, "expense.invalid_state");
          if (found.requestedBy === user) return problem(op, "expense.maker_checker");
          if (found.approvals.some((entry) => entry.approverUserId === user))
            return problem(op, "expense.already_decided");
          if (!(found.band?.roles as string[] | undefined)?.includes(role)) return problem(op, "expense.not_in_band");
          const reason = (payload.reason as string | undefined)?.trim() || null;
          if (action === "reject" && (!reason || reason.length < 3))
            return validation(op, "reason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
          found.approvals.push(approval(user, role, iso(), action === "approve" ? "approved" : "rejected", reason));
          if (action === "reject") {
            found.state = "rejected";
            found.rejectedAt = iso();
            found.decisionReason = reason;
          } else {
            found.approvalsGiven += 1;
            if (found.approvalsGiven >= (found.approvalsRequired ?? 1)) {
              found.state = "approved";
              found.approvedAt = iso();
            }
          }
          break;
        }
        case "cancel": {
          if (["paid", "rejected", "cancelled"].includes(found.state)) return problem(op, "expense.invalid_state");
          const reason = (payload.reason as string | undefined)?.trim() ?? "";
          if (reason.length < 3) return validation(op, "reason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
          found.state = "cancelled";
          found.cancelledAt = iso();
          found.cancelReason = reason;
          break;
        }
        case "pay": {
          if (found.state !== "approved") return problem(op, "expense.invalid_state");
          const input = payload as unknown as Schemas["ExpensePayDto"];
          if (!input.paidOn || input.paidOn > date()) return validation(op, "paidOn", "วันที่จ่ายต้องไม่เกินวันนี้");
          if (input.method !== "cash" && !input.evidenceDocumentId)
            return validation(op, "evidenceDocumentId", "แนบหลักฐานการจ่าย");
          if (input.method === "fund" && !found.fundId) return validation(op, "method", "คำขอนี้ไม่ได้จ่ายจากกองทุน");
          const wht = satang(found.whtAmount);
          const vendor = VENDORS.find((candidate) => candidate.id === found.payeePartyId);
          const registered = state.vendors?.vendors.find((candidate) => candidate.dto.partyId === found.payeePartyId);
          if (wht > 0 && !vendor?.taxId && !registered?.taxId) return problem(op, "wht.payee_tax_id_missing");
          const fund = found.fundId ? w().funds.find((candidate) => candidate.id === found.fundId) : undefined;
          const from =
            input.method === "cash"
              ? ACC.cash
              : input.method === "fund" && fund
                ? fund.ledgerBankAccountId
                : (input.fromAccountId ?? (found.buildingId === J.soi1 ? ACC.villageBank : ACC.bank));
          const posted = postJournal(
            found.buildingId,
            input.paidOn,
            "expense_payment",
            found.id,
            `${found.number} ${found.title}`,
            [
              ...found.lines.map((line): LineInput => [line.accountId, satang(line.amount), 0]),
              ...(wht > 0 ? [[ACC.whtPayable, 0, wht] as LineInput] : []),
              [from, 0, satang(found.amount) - wht],
            ],
            fund ? { fundId: fund.id, resolutionId: found.resolutionId } : {},
          );
          Object.assign(found, {
            state: "paid",
            paidAt: iso(),
            paidOn: input.paidOn,
            paymentMethod: input.method,
            paymentReference: input.reference?.trim() || null,
            paidFromAccountId: from,
            journalId: posted.id,
          });
          if (input.evidenceDocumentId)
            found.attachments.push({
              documentId: input.evidenceDocumentId,
              kind: "payment_evidence",
              createdAt: iso(),
            });
          if (found.kind === "petty_cash_top_up" && found.pettyCashId) {
            const petty = w().pettyCash.find((candidate) => candidate.id === found.pettyCashId);
            petty?.entries.unshift({
              id: crypto.randomUUID(),
              kind: "top_up",
              amount: found.amount,
              entryOn: input.paidOn,
              description: found.title,
              accountId: null,
              receiptDocumentId: null,
              expenseRequestId: found.id,
              countId: null,
              journalId: posted.id,
              createdAt: iso(),
            });
            if (petty) refreshPetty(petty);
          }
          if (wht > 0 && vendor) {
            w().counter.certificate += 1;
            const certificate = certificateFor(
              found,
              `WHT-${input.paidOn.slice(0, 4)}-${String(w().counter.certificate).padStart(5, "0")}`,
              800 + w().counter.certificate,
              vendor,
            );
            w().certificates.unshift(certificate);
            found.certificate = {
              id: certificate.id,
              number: certificate.number,
              documentId: certificate.documentId,
              tax: certificate.tax,
            };
          }
          break;
        }
      }
      found.version += 1;
      return { status: 200, body: view(found, ok) };
    });
  }),
  http.get("*/v1/owner/juristic/withholding-certificates", ({ request }) => {
    const op = "owner.juristicWhtCertificates.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const rows = w()
      .certificates.filter(
        (row) =>
          (!params.get("buildingId") || row.buildingId === params.get("buildingId")) &&
          (!q || row.number.toLowerCase().includes(q) || row.payeeName.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number));
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/juristic/withholding-certificates/:id", ({ request, params }) => {
    const op = "owner.juristicWhtCertificates.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().certificates.find((row) => row.id === params.id) : undefined;
    return found ? json(found) : notFound(op);
  }),
  http.get("*/v1/owner/juristic/withholding-certificates/:id/document", ({ request, params }) => {
    const op = "owner.juristicWhtCertificates.document";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().certificates.find((row) => row.id === params.id) : undefined;
    if (!found) return notFound(op);
    return json(documentDownload(request, found.documentId ?? found.id, found.number));
  }),
];

const fundHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/funds", ({ request }) => {
    const op = "owner.juristicFunds.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json({ data: [] });
    const forbidden = allowed(ok, op, "juristic.accounting.read");
    if (forbidden) return forbidden;
    refreshFunds();
    const buildingId = query(request).get("buildingId");
    return json({ data: w().funds.filter((fund) => !buildingId || fund.buildingId === buildingId) });
  }),
  http.post("*/v1/owner/juristic/funds", async ({ request }) => {
    const op = "owner.juristicFunds.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.fund.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["FundCreateDto"]>(request);
    record(op, request, input);
    if (!input.name?.trim()) return validation(op, "name", "ตั้งชื่อกองทุน");
    refreshFunds();
    if (w().funds.some((fund) => fund.buildingId === input.buildingId && fund.name === input.name.trim()))
      return problem(op, "fund.name_taken");
    const n = w().funds.length + 1;
    const bankId = crypto.randomUUID();
    const equityId = crypto.randomUUID();
    const fundId = crypto.randomUUID();
    w().accounts.push(
      account(
        bankId,
        `1160-${String(n).padStart(2, "0")}`,
        "asset",
        `เงินฝาก${input.name.trim()}`,
        `${input.name.trim()} bank`,
        {
          role: "fund_bank",
          fundId,
          used: false,
          bankAccountId: input.bankAccountId ?? null,
        },
      ),
      account(equityId, `3110-${String(n).padStart(2, "0")}`, "equity", input.name.trim(), input.name.trim(), {
        role: "fund_equity",
        fundId,
        used: false,
      }),
    );
    const bank = w().bankAccounts.find((candidate) => candidate.id === input.bankAccountId);
    const created: Schemas["FundDto"] = {
      id: fundId,
      buildingId: input.buildingId,
      buildingName: buildingName(input.buildingId),
      kind: input.kind,
      name: input.name.trim(),
      bankAccountId: input.bankAccountId ?? null,
      bankAccountMasked: bank ? `${bank.bankNameTh.replace("ธนาคาร", "")} ${bank.accountNoMasked}` : null,
      isActive: true,
      ledgerBankAccountId: bankId,
      ledgerEquityAccountId: equityId,
      bankBalance: "0.00",
      equityBalance: "0.00",
      version: 1,
    };
    w().funds.push(created);
    return json(created, 201);
  }),
  http.get("*/v1/owner/juristic/funds/:fundId", ({ request, params }) => {
    const op = "owner.juristicFunds.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (juristicOnly(ok)) refreshFunds();
    const found = juristicOnly(ok) ? w().funds.find((fund) => fund.id === params.fundId) : undefined;
    return found ? json(found) : notFound(op);
  }),
  http.patch("*/v1/owner/juristic/funds/:fundId", async ({ request, params }) => {
    const op = "owner.juristicFunds.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (juristicOnly(ok)) refreshFunds();
    const found = juristicOnly(ok) ? w().funds.find((fund) => fund.id === params.fundId) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.fund.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["FundUpdateDto"]>(request);
    record(op, request, input);
    if (input.version !== undefined && input.version !== found.version) return problem(op, "concurrency.stale");
    if (input.name !== undefined) found.name = input.name.trim() || found.name;
    if (input.isActive !== undefined) found.isActive = input.isActive;
    if (input.bankAccountId !== undefined) {
      found.bankAccountId = input.bankAccountId;
      const bank = w().bankAccounts.find((candidate) => candidate.id === input.bankAccountId);
      found.bankAccountMasked = bank ? `${bank.bankNameTh.replace("ธนาคาร", "")} ${bank.accountNoMasked}` : null;
    }
    found.version += 1;
    return json(found);
  }),
  http.get("*/v1/owner/juristic/funds/:fundId/ledger", ({ request, params }) => {
    const op = "owner.juristicFunds.ledger";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (juristicOnly(ok)) refreshFunds();
    const found = juristicOnly(ok) ? w().funds.find((fund) => fund.id === params.fundId) : undefined;
    if (!found) return notFound(op);
    const roles: Record<string, Schemas["FundAccountRole"]> = {
      [found.ledgerBankAccountId]: "fund_bank",
      [found.ledgerEquityAccountId]: "fund_equity",
    };
    const rows = w().journals.flatMap((entry) =>
      entry.lines
        .filter((line) => roles[line.accountId])
        .map((line): Schemas["FundLedgerLineDto"] => ({
          journalId: entry.id,
          postedOn: entry.postedOn,
          sourceType: entry.sourceType,
          memo: entry.memo,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountRole: roles[line.accountId]!,
          debit: line.debit,
          credit: line.credit,
          resolutionId: entry.resolutionId,
        })),
    );
    return json(paged(rows, request));
  }),
  http.post("*/v1/owner/juristic/funds/:fundId/transfers", async ({ request, params }) => {
    const op = "owner.juristicFunds.requestTransfer";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (juristicOnly(ok)) refreshFunds();
    const found = juristicOnly(ok) ? w().funds.find((fund) => fund.id === params.fundId) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.fund.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["FundTransferCreateDto"];
      if (!found.isActive) return problem(op, "fund.inactive");
      if (!MONEY.test(input.amount ?? "") || satang(input.amount) <= 0)
        return validation(op, "amount", "จำนวนเงินไม่ถูกต้อง");
      if (!input.transferOn || input.transferOn > date())
        return validation(op, "transferOn", "วันที่ต้องไม่เกินวันนี้");
      if (input.direction === "out" && !input.resolutionId) return problem(op, "fund.resolution_required");
      if (input.resolutionId && !resolutionOk(input.resolutionId, found.buildingId))
        return problem(op, "fund.resolution_invalid");
      const counter = accountOf(input.counterAccountId ?? ACC.bank) ?? accountOf(ACC.bank)!;
      const transfer: Schemas["FundTransferDto"] = {
        id: crypto.randomUUID(),
        fundId: found.id,
        fundName: found.name,
        buildingId: found.buildingId,
        direction: input.direction,
        amount: baht(satang(input.amount)),
        counterAccountId: counter.id,
        counterAccountCode: counter.code,
        transferOn: input.transferOn,
        resolutionId: input.resolutionId ?? null,
        reference: input.reference?.trim() || null,
        note: input.note?.trim() || null,
        state: "requested",
        requestedBy: userOf(ok),
        requestedAt: iso(),
        decidedBy: null,
        decidedAt: null,
        decisionReason: null,
        journalId: null,
        nextActions: [],
        version: 1,
      };
      w().transfers.unshift(transfer);
      return { status: 201, body: transferView(transfer, ok) };
    });
  }),
  http.get("*/v1/owner/juristic/fund-transfers", ({ request }) => {
    const op = "owner.juristicFundTransfers.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const params = query(request);
    const rows = w()
      .transfers.filter(
        (row) =>
          (!params.get("fundId") || row.fundId === params.get("fundId")) &&
          (!params.get("state") || row.state === params.get("state")),
      )
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map((row) => transferView(row, ok));
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/juristic/fund-transfers/:id", ({ request, params }) => {
    const op = "owner.juristicFundTransfers.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().transfers.find((row) => row.id === params.id) : undefined;
    return found ? json(transferView(found, ok)) : notFound(op);
  }),
  http.post("*/v1/owner/juristic/fund-transfers/:id/actions/:action", async ({ request, params }) => {
    const action = params.action as "approve" | "reject";
    const op = action === "approve" ? "owner.juristicFundTransfers.approve" : "owner.juristicFundTransfers.reject";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().transfers.find((row) => row.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.fund.approve");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      if (found.state !== "requested") return problem(op, "fund.invalid_state");
      if (found.requestedBy === userOf(ok)) return problem(op, "fund.maker_checker");
      const reason = (payload.reason as string | undefined)?.trim() || null;
      if (action === "reject") {
        if (!reason || reason.length < 3) return validation(op, "reason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
        Object.assign(found, { state: "rejected", decidedBy: userOf(ok), decidedAt: iso(), decisionReason: reason });
      } else {
        refreshFunds();
        const fund = w().funds.find((candidate) => candidate.id === found.fundId)!;
        const amount = satang(found.amount);
        if (found.direction === "out" && amount > satang(fund.bankBalance)) return problem(op, "fund.insufficient");
        const posted = postJournal(
          found.buildingId,
          found.transferOn,
          "fund_transfer",
          found.id,
          `${found.direction === "out" ? "เบิกเงินจาก" : "โอนเข้า"}${found.fundName}${found.note ? ` — ${found.note}` : ""}`,
          found.direction === "in"
            ? [
                [fund.ledgerBankAccountId, amount, 0],
                [found.counterAccountId, 0, amount],
              ]
            : [
                [found.counterAccountId, amount, 0],
                [fund.ledgerBankAccountId, 0, amount],
                [fund.ledgerEquityAccountId, amount, 0],
                [ACC.surplus, 0, amount],
              ],
          { fundId: fund.id, resolutionId: found.resolutionId },
        );
        Object.assign(found, {
          state: "posted",
          decidedBy: userOf(ok),
          decidedAt: iso(),
          decisionReason: reason,
          journalId: posted.id,
        });
      }
      found.version += 1;
      return { status: 200, body: transferView(found, ok) };
    });
  }),
];

function transferView(transfer: Schemas["FundTransferDto"], ok: Ok): Schemas["FundTransferDto"] {
  const decide =
    transfer.state === "requested" && transfer.requestedBy !== userOf(ok) && can(ok, "juristic.fund.approve");
  return { ...transfer, nextActions: decide ? ["approve", "reject"] : [] };
}

const pettyHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/petty-cash", ({ request }) => {
    const op = "owner.juristicPettyCash.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json({ data: [] });
    const forbidden = allowed(ok, op, "juristic.expense.read");
    if (forbidden) return forbidden;
    const buildingId = query(request).get("buildingId");
    return json({
      data: w()
        .pettyCash.filter((petty) => !buildingId || petty.buildingId === buildingId)
        .map((petty) => {
          refreshPetty(petty);
          const summary: Record<string, unknown> = { ...petty };
          delete summary.entries;
          delete summary.counts;
          return summary;
        }),
    });
  }),
  http.get("*/v1/owner/juristic/petty-cash/:id", ({ request, params }) => {
    const op = "owner.juristicPettyCash.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().pettyCash.find((petty) => petty.id === params.id) : undefined;
    if (!found) return notFound(op);
    refreshPetty(found);
    return json(found);
  }),
  http.post("*/v1/owner/juristic/petty-cash", async ({ request }) => {
    const op = "owner.juristicPettyCash.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.fund.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["PettyCashCreateDto"]>(request);
    record(op, request, input);
    if (!input.name?.trim()) return validation(op, "name", "ตั้งชื่อวงเงิน");
    if (!MONEY.test(input.floatAmount ?? "")) return validation(op, "floatAmount", "จำนวนเงินไม่ถูกต้อง");
    if (w().pettyCash.some((petty) => petty.name === input.name.trim())) return problem(op, "petty_cash.name_taken");
    const accountId = crypto.randomUUID();
    w().accounts.push(
      account(
        accountId,
        `1120-${String(w().pettyCash.length + 1).padStart(2, "0")}`,
        "asset",
        input.name.trim(),
        input.name.trim(),
        {
          role: "petty_cash",
          used: false,
        },
      ),
    );
    const created: Schemas["PettyCashDetailDto"] = {
      id: crypto.randomUUID(),
      buildingId: input.buildingId,
      name: input.name.trim(),
      custodianUserId: input.custodianUserId,
      floatAmount: baht(satang(input.floatAmount)),
      accountId,
      balance: "0.00",
      isActive: true,
      lastCount: null,
      version: 1,
      entries: [],
      counts: [],
    };
    w().pettyCash.push(created);
    return json(created, 201);
  }),
  http.post("*/v1/owner/juristic/petty-cash/:id/spends", async ({ request, params }) => {
    const op = "owner.juristicPettyCash.spend";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().pettyCash.find((petty) => petty.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.petty_cash.spend");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["PettyCashSpendDto"];
      if (roleOf(ok) === "staff" && found.custodianUserId !== userOf(ok))
        return problem(op, "petty_cash.not_custodian");
      if (!found.isActive) return problem(op, "petty_cash.inactive");
      if (!MONEY.test(input.amount ?? "") || satang(input.amount) <= 0)
        return validation(op, "amount", "จำนวนเงินไม่ถูกต้อง");
      if (!input.description?.trim()) return validation(op, "description", "กรอกรายละเอียด");
      if (!input.receiptDocumentId) return validation(op, "receiptDocumentId", "แนบใบเสร็จ");
      const acc = accountOf(input.accountId);
      if (!acc || acc.type !== "expense") return validation(op, "accountId", "เลือกบัญชีค่าใช้จ่าย");
      refreshPetty(found);
      if (satang(input.amount) > satang(found.balance)) return problem(op, "petty_cash.insufficient");
      const id = crypto.randomUUID();
      const posted = postJournal(
        found.buildingId,
        input.spentOn ?? date(),
        "petty_cash",
        id,
        `เงินสดย่อย: ${input.description.trim()}`,
        [
          [acc.id, satang(input.amount), 0],
          [found.accountId, 0, satang(input.amount)],
        ],
      );
      found.entries.unshift({
        id,
        kind: "spend",
        amount: baht(-satang(input.amount)),
        entryOn: input.spentOn ?? date(),
        description: input.description.trim(),
        accountId: acc.id,
        receiptDocumentId: input.receiptDocumentId,
        expenseRequestId: null,
        countId: null,
        journalId: posted.id,
        createdAt: iso(),
      });
      refreshPetty(found);
      found.version += 1;
      return { status: 200, body: found };
    });
  }),
  http.post("*/v1/owner/juristic/petty-cash/:id/counts", async ({ request, params }) => {
    const op = "owner.juristicPettyCash.count";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().pettyCash.find((petty) => petty.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.fund.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["PettyCashCountCreateDto"];
      if (!MONEY.test(input.countedAmount ?? "")) return validation(op, "countedAmount", "จำนวนเงินไม่ถูกต้อง");
      refreshPetty(found);
      const book = satang(found.balance);
      const counted = satang(input.countedAmount);
      const difference = counted - book;
      const countId = crypto.randomUUID();
      found.counts.unshift({
        id: countId,
        countedOn: input.countedOn ?? date(),
        countedAmount: baht(counted),
        bookBalance: baht(book),
        difference: baht(difference),
        note: input.note?.trim() || null,
        countedBy: userOf(ok),
        createdAt: iso(),
      });
      if (difference !== 0) {
        const id = crypto.randomUUID();
        const posted = postJournal(
          found.buildingId,
          input.countedOn ?? date(),
          "petty_cash",
          id,
          difference < 0 ? "เงินสดย่อยขาดจากการตรวจนับ" : "เงินสดย่อยเกินจากการตรวจนับ",
          difference < 0
            ? [
                [ACC.otherExpense, -difference, 0],
                [found.accountId, 0, -difference],
              ]
            : [
                [found.accountId, difference, 0],
                [ACC.incomeOther, 0, difference],
              ],
        );
        found.entries.unshift({
          id,
          kind: "count_difference",
          amount: baht(difference),
          entryOn: input.countedOn ?? date(),
          description: difference < 0 ? "ตรวจนับเงินสดย่อย – ขาด" : "ตรวจนับเงินสดย่อย – เกิน",
          accountId: difference < 0 ? ACC.otherExpense : ACC.incomeOther,
          receiptDocumentId: null,
          expenseRequestId: null,
          countId,
          journalId: posted.id,
          createdAt: iso(),
        });
      }
      found.lastCount = {
        countedOn: input.countedOn ?? date(),
        countedAmount: baht(counted),
        difference: baht(difference),
      };
      refreshPetty(found);
      found.version += 1;
      return { status: 200, body: found };
    });
  }),
];

function statementCounts(statementId: string) {
  const statement = w().statements.find((row) => row.id === statementId);
  if (!statement) return;
  const lines = w().lines.filter((line) => line.statementId === statementId);
  statement.matchedCount = lines.filter((line) => !["none", "ignored"].includes(line.matchKind)).length;
  statement.unmatchedCount = lines.filter((line) => line.matchKind === "none").length;
}

const lineView = (line: Schemas["BankStatementLineDetailDto"]) => ({
  ...line,
  suggestions: line.matchKind === "none" ? (w().candidates[line.id] ?? []) : [],
});

const bankHandlers: HttpHandler[] = [
  http.get("*/v1/owner/juristic/bank-statements", ({ request }) => {
    const op = "owner.juristicBankStatements.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const forbidden = allowed(ok, op, "juristic.accounting.read");
    if (forbidden) return forbidden;
    const bankAccountId = query(request).get("bankAccountId");
    const rows = w()
      .statements.filter((row) => !bankAccountId || row.bankAccountId === bankAccountId)
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/juristic/bank-statements/:id", ({ request, params }) => {
    const op = "owner.juristicBankStatements.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().statements.find((row) => row.id === params.id) : undefined;
    return found ? json(found) : notFound(op);
  }),
  http.post("*/v1/owner/juristic/bank-statements", async ({ request }) => {
    const op = "owner.juristicBankStatements.import";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["BankStatementImportDto"];
      const bank = w().bankAccounts.find((candidate) => candidate.id === input.bankAccountId);
      if (!bank) return validation(op, "bankAccountId", "เลือกบัญชีธนาคาร");
      let text = "";
      try {
        text = new TextDecoder().decode(Uint8Array.from(atob(input.content ?? ""), (char) => char.charCodeAt(0)));
      } catch {
        return problem(op, "bank_statement.unreadable");
      }
      const rows = text
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean)
        .slice(1)
        .map((row) => row.split(","));
      const parsed = rows.flatMap((cells) => {
        const [day, description, amount, reference] = cells;
        if (!day || !description || !amount || !/^-?\d+(\.\d{1,2})?$/.test(amount.trim())) return [];
        const iso8601 = /^\d{4}-\d{2}-\d{2}$/.test(day.trim()) ? day.trim() : null;
        return iso8601
          ? [
              {
                day: iso8601,
                description: description.trim(),
                amount: satang(amount.trim()),
                reference: reference?.trim() || null,
              },
            ]
          : [];
      });
      if (parsed.length === 0) return problem(op, "bank_statement.unreadable");
      const checksum = `${input.bankAccountId}:${input.content.length}:${input.content.slice(0, 64)}`;
      const replay = w().statements.find((row) => (row as unknown as { checksum?: string }).checksum === checksum);
      if (replay)
        return { status: 201, body: { statement: replay, replayed: true, imported: 0, duplicates: 0, autoMatched: 0 } };
      const statementId = crypto.randomUUID();
      let autoMatched = 0;
      const lines = parsed.map((row, index): Schemas["BankStatementLineDetailDto"] => {
        const auto = index % 3 === 0;
        if (auto) autoMatched += 1;
        const id = crypto.randomUUID();
        if (!auto)
          w().candidates[id] = [
            {
              kind: row.amount > 0 ? "payment" : "expense",
              id: crypto.randomUUID(),
              amount: baht(row.amount),
              bookedOn: row.day,
              label: row.amount > 0 ? `รับชำระ · ${row.description}` : `ค่าใช้จ่าย · ${row.description}`,
              referenceHit: row.reference !== null,
              days: 1,
            },
          ];
        return {
          id,
          statementId,
          lineNo: index + 1,
          bookedOn: row.day,
          amount: baht(row.amount),
          description: row.description,
          reference: row.reference,
          balance: null,
          matchKind: auto ? (row.amount > 0 ? "payment" : "expense") : "none",
          matchId: auto ? crypto.randomUUID() : null,
          matchMethod: auto ? "auto" : null,
          matchedAt: auto ? iso() : null,
          ignoreReason: null,
          version: 1,
          suggestions: [],
        };
      });
      const days = parsed.map((row) => row.day).sort();
      const statement: Schemas["BankStatementDto"] & { checksum?: string } = {
        id: statementId,
        bankAccountId: bank.id,
        bankName: bank.bankNameTh,
        bankAccountMasked: bank.accountNoMasked,
        accountId: w().accounts.find((acc) => acc.bankAccountId === bank.id)?.id ?? ACC.bank,
        formatKey: input.formatKey,
        fileName: input.fileName,
        fileDocumentId: crypto.randomUUID(),
        periodStart: days[0] ?? null,
        periodEnd: days.at(-1) ?? null,
        lineCount: lines.length,
        duplicateCount: 0,
        matchedCount: autoMatched,
        unmatchedCount: lines.length - autoMatched,
        importedAt: iso(),
        checksum,
      };
      w().statements.unshift(statement);
      w().lines.push(...lines);
      return {
        status: 201,
        body: { statement, replayed: false, imported: lines.length, duplicates: 0, autoMatched },
      };
    });
  }),
  http.get("*/v1/owner/juristic/bank-statement-lines", ({ request }) => {
    const op = "owner.juristicBankStatementLines.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const params = query(request);
    const lineState = params.get("state") ?? "unmatched";
    const q = params.get("q")?.toLowerCase();
    const rows = w()
      .lines.filter(
        (line) =>
          (!params.get("statementId") || line.statementId === params.get("statementId")) &&
          (lineState === "all" ||
            (lineState === "unmatched" && line.matchKind === "none") ||
            (lineState === "ignored" && line.matchKind === "ignored") ||
            (lineState === "matched" && !["none", "ignored"].includes(line.matchKind))) &&
          (!q || line.description.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.bookedOn.localeCompare(b.bookedOn) || a.lineNo - b.lineNo)
      .map(({ suggestions: _suggestions, ...line }) => line);
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/juristic/bank-statement-lines/:id", ({ request, params }) => {
    const op = "owner.juristicBankStatementLines.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().lines.find((line) => line.id === params.id) : undefined;
    return found ? json(lineView(found)) : notFound(op);
  }),
  http.post("*/v1/owner/juristic/bank-statement-lines/:id/actions/:action", async ({ request, params }) => {
    const action = params.action as "match" | "ignore" | "unmatch";
    const op = {
      match: "owner.juristicBankStatementLines.match",
      ignore: "owner.juristicBankStatementLines.ignore",
      unmatch: "owner.juristicBankStatementLines.unmatch",
    }[action];
    if (!op) return undefined;
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const found = juristicOnly(ok) ? w().lines.find((line) => line.id === params.id) : undefined;
    if (!found) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.accounting.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      if (action === "unmatch") {
        if (found.matchKind === "none") return problem(op, "bank_statement.line_not_open");
        Object.assign(found, {
          matchKind: "none",
          matchId: null,
          matchMethod: null,
          matchedAt: null,
          ignoreReason: null,
        });
      } else if (found.matchKind !== "none") return problem(op, "bank_statement.line_not_open");
      else if (action === "ignore") {
        const reason = (payload.reason as string | undefined)?.trim() ?? "";
        if (reason.length < 3) return validation(op, "reason", "เหตุผลอย่างน้อย 3 ตัวอักษร");
        Object.assign(found, { matchKind: "ignored", ignoreReason: reason, matchedAt: iso() });
      } else {
        const input = payload as unknown as Schemas["BankLineMatchDto"];
        const candidate = (w().candidates[found.id] ?? []).find((s) => s.id === input.targetId);
        if (candidate && candidate.amount !== found.amount) return problem(op, "bank_statement.amount_mismatch");
        const taken = w().lines.some((line) => line.matchId === input.targetId && line.id !== found.id);
        if (taken) return problem(op, "bank_statement.already_matched");
        Object.assign(found, {
          matchKind: input.kind,
          matchId: input.targetId,
          matchMethod: "manual",
          matchedAt: iso(),
        });
      }
      found.version += 1;
      statementCounts(found.statementId);
      return { status: 200, body: lineView(found) };
    });
  }),
];

export const accountingHandlers: HttpHandler[] = [
  ...chartHandlers,
  ...journalHandlers,
  ...reportHandlers,
  ...expenseHandlers,
  ...fundHandlers,
  ...pettyHandlers,
  ...bankHandlers,
];

export function resetAccountingWorld(): void {
  state.accounting = initialAccountingWorld();
}

export function accountingStateHandlers(): HttpHandler[] {
  return [
    http.post("*/__mock/owner/accounting/reset", () => {
      resetAccountingWorld();
      return json({ ok: true });
    }),
    http.get("*/__mock/owner/accounting", () => json(state.accounting)),
  ];
}
