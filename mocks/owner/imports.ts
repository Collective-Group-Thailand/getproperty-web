import { http, HttpResponse, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
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
type Job = Schemas["JuristicImportJobDto"];
type Sheet = Schemas["ImportSheet"];
type Issue = { column: string; code: string; params?: Record<string, string | number> };

/*
 * The import wizard from a legacy system (pack J, JW3a; api J3.1 at 0b426453, D-332). One job per building: อาคาร A was
 * imported months ago (live), อาคาร B — onboarded, its 48 units still in the legacy program — has a draft with the
 * register (three rows to fix: a full ID number, shares over 100 %, a phone) and the opening balances uploaded; a
 * cancelled and a rolled-back job of the estate's sois are history. CSV uploads are parsed and validated for real
 * (headers by key or "label (key)"); XLSX uploads stand for the clean sample of their sheet. The money is computed
 * here (the API's side); the console never computes it.
 * Controls: `POST /__mock/owner/imports/advance?to=validated|reconciled|explained|committed|compared|explained-all|live`
 * (moves อาคาร B's job), `POST /__mock/owner/imports/flag?stale=1|blockRollback=1`, `GET /__mock/owner/imports`.
 */

const DAY = 86_400_000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);
const iid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

export const IMP = {
  liveA: iid("1a9b0a01", 1),
  draftB: iid("1a9b0a01", 2),
  cancelledSoi: iid("1a9b0a01", 3),
  rolledBackSoi: iid("1a9b0a01", 4),
} as const;

interface Row {
  sheet: Sheet;
  rowNo: number;
  data: Record<string, string | null>;
  errors: Issue[];
  warnings: Issue[];
}

interface MockJob {
  dto: Job;
  rows: Row[];
  differences: Schemas["JuristicCycleDifferenceDto"][];
  /** What the commit added to the juristic world, removed again by a rollback. */
  createdIds: { floors: string[]; units: string[]; parties: string[]; ownerships: string[] };
}

export interface MockImportsWorld {
  jobs: MockJob[];
  /** A plan changed under the job since its validation (`import.preview_stale` on reconcile / commit). */
  stale: boolean;
  /** Something now refers to what the commit created (`import.rollback_blocked`). */
  blockRollback: boolean;
}

// ------------------------------------------------------------------------------------------------- sample data

const FIRST = [
  "สมชาย",
  "วิไล",
  "ประเสริฐ",
  "อรุณี",
  "ธนพล",
  "กาญจนา",
  "สุรเชษฐ์",
  "พิมพ์ชนก",
  "ณัฐวุฒิ",
  "รัตนา",
  "อนุชา",
  "ศิริพร",
];
const LAST = ["ใจดี", "ศรีสุข", "วงศ์ทอง", "แก้วมณี", "บุญมา", "ทองคำ", "สายสุวรรณ", "เพชรรัตน์"];

/** อาคาร B: 8 floors × 6 units; units ending in 3 have two owners (50 / 50). */
function sampleRegister(): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  let n = 0;
  for (let floor = 1; floor <= 8; floor += 1)
    for (let unit = 1; unit <= 6; unit += 1) {
      const unitNo = `B-${floor}0${unit}`;
      const owners = unit === 3 ? 2 : 1;
      for (let o = 0; o < owners; o += 1) {
        n += 1;
        rows.push({
          floor: String(floor),
          unit_no: unitNo,
          area_sqm: ["34.50", "45.00", "52.25", "68.00", "34.50", "45.00"][unit - 1]!,
          ownership_ratio: ["0.017100", "0.022300", "0.025900", "0.033700", "0.017100", "0.022300"][unit - 1]!,
          owner_code: `L${String(n).padStart(4, "0")}`,
          owner_name: `${FIRST[n % FIRST.length]} ${LAST[n % LAST.length]}`,
          owner_type: "person",
          id_type: "thai_national_id",
          id_last4: String(1000 + ((n * 37) % 9000)),
          phone: `08${String(10000000 + n * 7919).slice(0, 8)}`,
          share_pct: owners === 2 ? "50" : "100",
          bill_to_name: unitNo === "B-805" ? "บริษัท ดูแลห้อง จำกัด" : "",
          bill_to_kind: unitNo === "B-805" ? "agency" : "",
        });
      }
    }
  return rows;
}

/** 12 units in arrears; some carry two periods and a surcharge — Σ receivables 612,450.00 (the Stitch figure). */
function sampleOpening(register: Record<string, string>[]): Record<string, string>[] {
  const owners = (unitNo: string) => register.filter((row) => row.unit_no === unitNo);
  const units = [
    "B-102",
    "B-105",
    "B-201",
    "B-204",
    "B-302",
    "B-306",
    "B-401",
    "B-503",
    "B-602",
    "B-604",
    "B-701",
    "B-806",
  ];
  const rows: Record<string, string>[] = [];
  const principals = [42000, 31500, 55800, 28000, 61200, 47300, 38900, 52600, 44100, 39750, 58200, 49400];
  units.forEach((unitNo, index) => {
    const owner = owners(unitNo)[0]!;
    const principal = principals[index]!;
    const surcharge = index % 3 === 0 ? 1650 : 0;
    rows.push({
      unit_no: unitNo,
      owner_code: owner.owner_code!,
      owner_name: owner.owner_name!,
      charge: "common_fee",
      period: "2026-Q3",
      principal: `${principal}.00`,
      surcharge: `${surcharge}.00`,
    });
  });
  // Σ above = 548,750.00 + 6,600.00 = 555,350.00; three earlier periods bring it to 612,450.00.
  rows.push({
    unit_no: "B-201",
    owner_code: owners("B-201")[0]!.owner_code!,
    owner_name: owners("B-201")[0]!.owner_name!,
    charge: "common_fee",
    period: "2026-Q2",
    principal: "21800.00",
    surcharge: "1200.00",
  });
  rows.push({
    unit_no: "B-302",
    owner_code: owners("B-302")[0]!.owner_code!,
    owner_name: owners("B-302")[0]!.owner_name!,
    charge: "common_fee",
    period: "2026-Q2",
    principal: "18400.00",
    surcharge: "950.00",
  });
  rows.push({
    unit_no: "B-701",
    owner_code: owners("B-701")[0]!.owner_code!,
    owner_name: owners("B-701")[0]!.owner_name!,
    charge: "fund",
    period: "2026",
    principal: "14400.00",
    surcharge: "350.00",
  });
  return rows;
}

function sampleHistory(register: Record<string, string>[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const units = [...new Set(register.map((row) => row.unit_no!))];
  units.slice(0, 36).forEach((unitNo, index) => {
    const owner = register.find((row) => row.unit_no === unitNo)!;
    rows.push({
      unit_no: unitNo,
      owner_code: owner.owner_code!,
      owner_name: owner.owner_name!,
      paid_on: date(-30 - (index % 60)),
      amount: `${(14000 + index * 125).toFixed(2)}`,
      method: index % 4 === 0 ? "cash" : "transfer",
      reference: `TRX${7000 + index}`,
    });
  });
  return rows;
}

function sampleBank(): Record<string, string>[] {
  return [
    { account_type: "operating", bank_account_last4: "4012", fund_name: "", balance: "2186330.15" },
    { account_type: "fund", bank_account_last4: "", fund_name: "กองทุนสำรอง", balance: "880000.00" },
  ];
}

/** The last statement balance on or before the as-of date per bank account (J2.1), by the account's last 4. */
const STATEMENT: Record<string, string> = { "4012": "2184330.15" };

const SAMPLE: Record<Exclude<Sheet, "legacy_bills">, () => Record<string, string>[]> = {
  register: sampleRegister,
  opening_balance: () => sampleOpening(sampleRegister()),
  payment_history: () => sampleHistory(sampleRegister()),
  bank_balance: sampleBank,
};

/** The draft's register as uploaded: the sample with three mistakes. */
function registerWithMistakes(): Record<string, string>[] {
  const rows = sampleRegister();
  rows[5] = { ...rows[5]!, id_last4: "3101700123456" };
  rows[17] = { ...rows[17]!, share_pct: "100" }; // B-303's second owner → 150 %
  rows[31] = { ...rows[31]!, phone: "02-123" };
  return rows;
}

// ------------------------------------------------------------------------------------------------- parsing + validation

const LABELS: Record<string, { th: string; en: string }> = {
  floor: { th: "ชั้น / ซอย", en: "Floor / soi" },
  unit_no: { th: "เลขที่ห้อง / แปลง", en: "Unit / plot no." },
  area_sqm: { th: "พื้นที่ ตร.ม.", en: "Area (sq m)" },
  ownership_ratio: { th: "อัตราส่วนกรรมสิทธิ์", en: "Ownership ratio" },
  owner_code: { th: "รหัสเจ้าของ", en: "Owner code" },
  owner_name: { th: "ชื่อเจ้าของ", en: "Owner name" },
  owner_type: { th: "ประเภทเจ้าของ", en: "Owner type" },
  id_type: { th: "ประเภทเอกสาร", en: "ID type" },
  id_last4: { th: "เลขบัตร 4 ตัวท้าย", en: "ID last 4" },
  phone: { th: "โทรศัพท์", en: "Phone" },
  share_pct: { th: "สัดส่วน %", en: "Share %" },
  bill_to_name: { th: "ผู้รับใบแจ้งหนี้แทน", en: "Bill-to name" },
  bill_to_kind: { th: "ประเภทผู้รับแทน", en: "Bill-to kind" },
  charge: { th: "ประเภทค่าใช้จ่าย", en: "Charge" },
  period: { th: "งวด", en: "Period" },
  principal: { th: "เงินต้น", en: "Principal" },
  surcharge: { th: "เงินเพิ่ม", en: "Surcharge" },
  paid_on: { th: "วันที่ชำระ", en: "Paid on" },
  amount: { th: "จำนวนเงิน", en: "Amount" },
  method: { th: "ช่องทาง", en: "Method" },
  reference: { th: "อ้างอิง", en: "Reference" },
  account_type: { th: "ประเภทบัญชี", en: "Account type" },
  bank_account_last4: { th: "เลขบัญชี 4 ตัวท้าย", en: "Account last 4" },
  fund_name: { th: "ชื่อกองทุน", en: "Fund name" },
  balance: { th: "ยอดคงเหลือ", en: "Balance" },
};

const COLUMNS: Record<Sheet, string[]> = {
  register: [
    "floor",
    "unit_no",
    "area_sqm",
    "ownership_ratio",
    "owner_code",
    "owner_name",
    "owner_type",
    "id_type",
    "id_last4",
    "phone",
    "share_pct",
    "bill_to_name",
    "bill_to_kind",
  ],
  opening_balance: ["unit_no", "owner_code", "owner_name", "charge", "period", "principal", "surcharge"],
  payment_history: ["unit_no", "owner_code", "owner_name", "paid_on", "amount", "method", "reference"],
  bank_balance: ["account_type", "bank_account_last4", "fund_name", "balance"],
  legacy_bills: ["unit_no", "amount"],
};
const REQUIRED: Record<Sheet, string[]> = {
  register: ["unit_no", "owner_name"],
  opening_balance: ["unit_no", "period"],
  payment_history: ["unit_no", "paid_on", "amount"],
  bank_balance: ["account_type", "balance"],
  legacy_bills: ["unit_no", "amount"],
};

const MESSAGES: Record<string, { th: string; en: string }> = {
  required: { th: "ต้องกรอก {column}", en: "{column} is required" },
  id_full_refused: {
    th: "ไม่รับเลขบัตรเต็ม (PDPA) — ใส่เฉพาะ 4 ตัวท้าย",
    en: "Full ID numbers are refused (PDPA) — enter the last 4 only",
  },
  phone: { th: "เบอร์โทรไม่ถูกต้อง เช่น 0812345678", en: "Invalid phone, e.g. 0812345678" },
  shares_exceeded: {
    th: "สัดส่วนของห้อง {unit} รวมกันเกิน 100% ({total}%)",
    en: "Shares of {unit} add up to more than 100% ({total}%)",
  },
  shares_incomplete: { th: "สัดส่วนของห้อง {unit} รวมกันไม่ถึง 100%", en: "Shares of {unit} add up to less than 100%" },
  money: {
    th: "{column} ต้องเป็นจำนวนเงิน เช่น 4500 หรือ 4500.00",
    en: "{column} must be an amount, e.g. 4500 or 4500.00",
  },
  period: {
    th: "งวดต้องเป็น YYYY-MM, YYYY-Qn, YYYY-Hn หรือ YYYY",
    en: "Period must be YYYY-MM, YYYY-Qn, YYYY-Hn or YYYY",
  },
  unit_unknown: { th: "ไม่มีห้อง {unit} ในทะเบียน", en: "Unit {unit} is not in the register" },
  owner_unknown: {
    th: "{owner} ไม่ใช่เจ้าของห้อง {unit} ในทะเบียน",
    en: "{owner} does not own {unit} in the register",
  },
  amount_zero: {
    th: "เงินต้นหรือเงินเพิ่มต้องมากกว่า 0 อย่างน้อยหนึ่งช่อง",
    en: "Principal or surcharge must be above 0",
  },
  date: { th: "วันที่ไม่ถูกต้อง (YYYY-MM-DD)", en: "Invalid date (YYYY-MM-DD)" },
  account_type: { th: "ประเภทบัญชีต้องเป็น operating หรือ fund", en: "Account type must be operating or fund" },
  duplicate: { th: "แถวซ้ำกับแถว {row}", en: "Duplicates row {row}" },
};

function message(issue: Issue, language: "th" | "en"): string {
  const template = MESSAGES[issue.code]?.[language] ?? issue.code;
  const column = LABELS[issue.column]?.[language] ?? issue.column;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key === "column" ? column : String(issue.params?.[key] ?? ""),
  );
}

/** Header cell → column key: the key, the Thai or English label, or "label (key)". */
function headerKey(cell: string, sheet: Sheet): string | null {
  const trimmed = cell
    .replace(/^﻿/, "")
    .replace(/\s*\*$/, "")
    .trim();
  const inParens = /\(([a-z_0-9]+)\)\s*$/.exec(trimmed)?.[1];
  const candidates = COLUMNS[sheet];
  if (inParens && candidates.includes(inParens)) return inParens;
  if (candidates.includes(trimmed)) return trimmed;
  return candidates.find((key) => LABELS[key]?.th === trimmed || LABELS[key]?.en === trimmed) ?? null;
}

function splitCsvLine(line: string, separator: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      out.push(current);
      current = "";
    } else current += char;
  }
  out.push(current);
  return out;
}

/** CSV text → rows by column key; null when the header names none of the sheet's columns. */
export function parseCsv(text: string, sheet: Sheet): { rowNo: number; data: Record<string, string> }[] | null {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const headerLine = lines[0] ?? "";
  const separator =
    headerLine.includes(";") && !headerLine.includes(",") ? ";" : headerLine.includes("\t") ? "\t" : ",";
  const keys = splitCsvLine(headerLine, separator).map((cell) => headerKey(cell, sheet));
  if (!keys.some(Boolean)) return null;
  const rows: { rowNo: number; data: Record<string, string> }[] = [];
  lines.slice(1).forEach((line, index) => {
    if (!line.trim() || line.startsWith("#")) return;
    const cells = splitCsvLine(line, separator);
    const data: Record<string, string> = {};
    keys.forEach((key, column) => {
      if (key) data[key] = (cells[column] ?? "").trim();
    });
    rows.push({ rowNo: index + 2, data });
  });
  return rows;
}

const nullable = (value: string | undefined) => (value === undefined || value === "" ? null : value);

/** Every sheet validated together (cross-file rules), as the API does on each upload. */
function validateAll(sheets: Partial<Record<Sheet, { rowNo: number; data: Record<string, string> }[]>>): Row[] {
  const out: Row[] = [];
  const register = sheets.register ?? [];
  const units = new Map<string, { owners: string[]; shares: number }>();
  for (const row of register) {
    const unitNo = row.data.unit_no ?? "";
    const entry = units.get(unitNo) ?? { owners: [], shares: 0 };
    entry.owners.push(row.data.owner_name ?? "");
    entry.shares += Number(row.data.share_pct || 100);
    units.set(unitNo, entry);
  }
  const seen = new Map<string, number>();
  for (const sheet of ["register", "opening_balance", "payment_history", "bank_balance"] as const) {
    for (const raw of sheets[sheet] ?? []) {
      const errors: Issue[] = [];
      const warnings: Issue[] = [];
      const data: Record<string, string | null> = {};
      for (const key of COLUMNS[sheet]) data[key] = nullable(raw.data[key]);
      for (const key of REQUIRED[sheet]) if (!data[key]) errors.push({ column: key, code: "required" });
      if (sheet === "register") {
        if (data.id_last4 && data.id_last4.replace(/\D/g, "").length > 4 && !/^X+\d{4}$/i.test(data.id_last4)) {
          errors.push({ column: "id_last4", code: "id_full_refused" });
          data.id_last4 = null; // never kept (PDPA)
        }
        if (data.phone && !/^(0\d{8,9}|\+66\d{8,9})$/.test(data.phone.replace(/[\s-]/g, "")))
          errors.push({ column: "phone", code: "phone" });
        const unit = units.get(data.unit_no ?? "");
        if (unit && unit.shares > 100)
          errors.push({
            column: "share_pct",
            code: "shares_exceeded",
            params: { unit: data.unit_no ?? "", total: unit.shares },
          });
        else if (unit && unit.shares < 100)
          warnings.push({ column: "share_pct", code: "shares_incomplete", params: { unit: data.unit_no ?? "" } });
        const key = `${data.unit_no}|${data.owner_name}`;
        if (seen.has(key)) errors.push({ column: "row", code: "duplicate", params: { row: seen.get(key)! } });
        else seen.set(key, raw.rowNo);
      }
      if (sheet === "opening_balance" || sheet === "payment_history") {
        const unit = units.get(data.unit_no ?? "");
        if (data.unit_no && !unit)
          errors.push({ column: "unit_no", code: "unit_unknown", params: { unit: data.unit_no } });
        else if (unit && data.owner_name && !unit.owners.includes(data.owner_name))
          errors.push({
            column: "owner_name",
            code: "owner_unknown",
            params: { owner: data.owner_name, unit: data.unit_no ?? "" },
          });
      }
      if (sheet === "opening_balance") {
        if (data.period && !/^\d{4}(-(0[1-9]|1[0-2])|-Q[1-4]|-H[12])?$/.test(data.period))
          errors.push({ column: "period", code: "period" });
        for (const key of ["principal", "surcharge"])
          if (data[key] && !MONEY.test(data[key]!)) errors.push({ column: key, code: "money" });
        if (
          MONEY.test(data.principal ?? "0") &&
          MONEY.test(data.surcharge ?? "0") &&
          satang(data.principal ?? "0") + satang(data.surcharge ?? "0") <= 0
        )
          errors.push({ column: "principal", code: "amount_zero" });
      }
      if (sheet === "payment_history") {
        if (data.paid_on && !/^\d{4}-\d{2}-\d{2}$/.test(data.paid_on)) errors.push({ column: "paid_on", code: "date" });
        if (data.amount && !MONEY.test(data.amount)) errors.push({ column: "amount", code: "money" });
      }
      if (sheet === "bank_balance") {
        if (data.account_type && !["operating", "fund"].includes(data.account_type))
          errors.push({ column: "account_type", code: "account_type" });
        if (data.balance && !MONEY.test(data.balance)) errors.push({ column: "balance", code: "money" });
      }
      out.push({ sheet, rowNo: raw.rowNo, data, errors, warnings });
    }
  }
  return out;
}

function totalsOf(rows: Row[]): Schemas["JuristicImportTotalsDto"] {
  const of = (sheet: Sheet) => rows.filter((row) => row.sheet === sheet);
  const register = of("register");
  const units = new Set(register.map((row) => row.data.unit_no));
  const floors = new Set(register.map((row) => row.data.floor).filter(Boolean));
  const parties = new Set(register.map((row) => row.data.owner_code ?? row.data.owner_name));
  const opening = of("opening_balance").filter((row) => !row.errors.length);
  const principal = opening.reduce((sum, row) => sum + satang(row.data.principal ?? "0"), 0);
  const surcharge = opening.reduce((sum, row) => sum + satang(row.data.surcharge ?? "0"), 0);
  const history = of("payment_history").filter((row) => !row.errors.length);
  const bank = of("bank_balance").filter((row) => !row.errors.length);
  const bankSum = (type: string) =>
    bank.filter((row) => row.data.account_type === type).reduce((sum, row) => sum + satang(row.data.balance ?? "0"), 0);
  const arrears = new Set(opening.map((row) => row.data.unit_no));
  const billTos = register.filter((row) => row.data.bill_to_name).length;
  return {
    units: units.size,
    unitsNew: units.size,
    unitsAttached: 0,
    floorsNew: floors.size,
    parties: parties.size + billTos,
    partiesNew: parties.size + billTos - 2,
    partiesAttached: 2,
    ownerships: register.length,
    unitsIncomplete: register.filter((row) => row.warnings.some((w) => w.code === "shares_incomplete")).length,
    billTos,
    openingInvoices: arrears.size,
    unitsInArrears: arrears.size,
    principal: baht(principal),
    surcharge: baht(surcharge),
    receivables: baht(principal + surcharge),
    historyCount: history.length,
    historyAmount: baht(history.reduce((sum, row) => sum + satang(row.data.amount ?? "0"), 0)),
    bankOperating: baht(bankSum("operating")),
    bankFund: baht(bankSum("fund")),
    errors: rows.filter((row) => row.errors.length).length,
    warnings: rows.filter((row) => row.warnings.length).length,
  };
}

// ------------------------------------------------------------------------------------------------- world

function jobDto(n: number, id: string, buildingId: string, buildingName: string, patch: Partial<Job>): Job {
  return {
    id,
    number: n,
    buildingId,
    buildingName,
    state: "draft",
    asOfDate: date(-6),
    note: null,
    files: [],
    totals: null,
    reconciliation: null,
    created: {},
    committedAt: null,
    liveAt: null,
    rolledBackAt: null,
    rollbackReason: null,
    cancelledAt: null,
    parallelCycleId: null,
    parallelRunAt: null,
    nextActions: [],
    createdAt: iso(-3),
    version: 1,
    ...patch,
  };
}

/** Raw rows per sheet kept for re-validation (the API re-reads the files). */
const RAW = new Map<string, Partial<Record<Sheet, { rowNo: number; data: Record<string, string> }[]>>>();

function fileDto(sheet: Sheet, fileName: string, rows: Row[], offsetDays = -1): Schemas["JuristicImportFileDto"] {
  const own = rows.filter((row) => row.sheet === sheet);
  return {
    sheet,
    documentId: crypto.randomUUID(),
    fileName,
    format: fileName.endsWith(".csv") ? "csv" : "xlsx",
    rowCount: own.length,
    errorCount: own.filter((row) => row.errors.length).length,
    warningCount: own.filter((row) => row.warnings.length).length,
    uploadedAt: iso(offsetDays),
  };
}

const numbered = (rows: Record<string, string>[]) => rows.map((data, index) => ({ rowNo: index + 2, data }));

export function initialImportsWorld(): MockImportsWorld {
  RAW.clear();
  // อาคาร B: the draft — register with three mistakes, opening balances, payment history.
  const rawB = {
    register: numbered(registerWithMistakes()),
    opening_balance: numbered(SAMPLE.opening_balance()),
    payment_history: numbered(SAMPLE.payment_history()),
  };
  RAW.set(IMP.draftB, rawB);
  const rowsB = validateAll(rawB);
  const draftB: MockJob = {
    dto: jobDto(2, IMP.draftB, J.buildingB, "อาคาร B", {
      asOfDate: date(-6),
      note: "ย้ายจากโปรแกรมนิติบุคคลเดิม (Excel ส่งออกจากระบบเดิม)",
      files: [
        fileDto("register", "ladawan_register_2569.xlsx", rowsB, -1),
        fileDto("opening_balance", "ยอดค้างยกมา_ต.ค.69.xlsx", rowsB, -1),
        fileDto("payment_history", "payment_history_12m.csv", rowsB, -1),
      ],
      totals: totalsOf(rowsB),
      createdAt: iso(-2),
    }),
    rows: rowsB,
    differences: [],
    createdIds: { floors: [], units: [], parties: [], ownerships: [] },
  };
  const liveA: MockJob = {
    dto: jobDto(1, IMP.liveA, J.buildingA, "อาคาร A", {
      state: "live",
      asOfDate: date(-220),
      files: [
        {
          sheet: "register",
          documentId: crypto.randomUUID(),
          fileName: "riverside_register.xlsx",
          format: "xlsx",
          rowCount: 17,
          errorCount: 0,
          warningCount: 2,
          uploadedAt: iso(-225),
        },
        {
          sheet: "opening_balance",
          documentId: crypto.randomUUID(),
          fileName: "riverside_opening.xlsx",
          format: "xlsx",
          rowCount: 6,
          errorCount: 0,
          warningCount: 0,
          uploadedAt: iso(-225),
        },
        {
          sheet: "legacy_bills",
          documentId: crypto.randomUUID(),
          fileName: "legacy_bills_Q2.csv",
          format: "csv",
          rowCount: 16,
          errorCount: 0,
          warningCount: 0,
          uploadedAt: iso(-200),
        },
      ],
      totals: {
        ...totalsOf([]),
        units: 16,
        unitsNew: 16,
        floorsNew: 4,
        parties: 15,
        partiesNew: 15,
        ownerships: 17,
        unitsIncomplete: 2,
        openingInvoices: 5,
        unitsInArrears: 5,
        principal: "48750.00",
        surcharge: "1462.50",
        receivables: "50212.50",
      },
      reconciliation: {
        items: [
          {
            key: "receivables",
            kind: "receivables",
            label: "receivables",
            imported: "50212.50",
            reference: "50212.50",
            difference: "0.00",
            status: "match",
          },
        ],
        explanationRequired: false,
        declaredReceivables: "50212.50",
        note: null,
        documentId: null,
        reconciledAt: iso(-224),
      },
      created: { floor: 4, unit: 16, party: 15, unit_ownership: 17, invoice: 5 },
      committedAt: iso(-223),
      liveAt: iso(-190),
      parallelCycleId: iid("c7c1a001", 3),
      parallelRunAt: iso(-195),
      createdAt: iso(-226),
    }),
    rows: [],
    differences: [],
    createdIds: { floors: [], units: [], parties: [], ownerships: [] },
  };
  const cancelled: MockJob = {
    dto: jobDto(3, IMP.cancelledSoi, J.soi1, "ซอย 1", {
      state: "cancelled",
      asOfDate: date(-120),
      files: [
        {
          sheet: "register",
          documentId: crypto.randomUUID(),
          fileName: "soi1.csv",
          format: "csv",
          rowCount: 6,
          errorCount: 6,
          warningCount: 0,
          uploadedAt: iso(-121),
        },
      ],
      totals: { ...totalsOf([]), errors: 6 },
      cancelledAt: iso(-118),
      createdAt: iso(-122),
    }),
    rows: [],
    differences: [],
    createdIds: { floors: [], units: [], parties: [], ownerships: [] },
  };
  const rolledBack: MockJob = {
    dto: jobDto(4, IMP.rolledBackSoi, J.soi2, "ซอย 2", {
      state: "rolled_back",
      asOfDate: date(-90),
      files: [
        {
          sheet: "register",
          documentId: crypto.randomUUID(),
          fileName: "soi2_register.csv",
          format: "csv",
          rowCount: 5,
          errorCount: 0,
          warningCount: 0,
          uploadedAt: iso(-92),
        },
        {
          sheet: "opening_balance",
          documentId: crypto.randomUUID(),
          fileName: "soi2_opening.csv",
          format: "csv",
          rowCount: 2,
          errorCount: 0,
          warningCount: 0,
          uploadedAt: iso(-92),
        },
      ],
      totals: { ...totalsOf([]), units: 5, unitsNew: 5, ownerships: 5, openingInvoices: 2, unitsInArrears: 2 },
      reconciliation: {
        items: [],
        explanationRequired: false,
        declaredReceivables: "0.00",
        note: null,
        documentId: null,
        reconciledAt: iso(-91),
      },
      created: { unit: 5, party: 5, unit_ownership: 5, invoice: 2 },
      committedAt: iso(-91),
      rolledBackAt: iso(-89),
      rollbackReason: "ไฟล์ทะเบียนเป็นของซอยผิด จะนำเข้าใหม่หลังตรวจกับสำนักงานที่ดิน",
      createdAt: iso(-93),
    }),
    rows: [],
    differences: [],
    createdIds: { floors: [], units: [], parties: [], ownerships: [] },
  };
  const world: MockImportsWorld = { jobs: [draftB, liveA, cancelled, rolledBack], stale: false, blockRollback: false };
  return world;
}

export function resetImportsWorld(): void {
  state.imports = initialImportsWorld();
}

const w = () => state.imports;
const juristic = () => state.juristic;
const jobOf = (id: string) => w().jobs.find((job) => job.dto.id === id);

function nextActions(ok: Ok, job: Job): string[] {
  const r = roleOf(ok);
  if (r !== "owner" && r !== "manager") return [];
  switch (job.state) {
    case "draft":
      return ["upload", "validate", "cancel"];
    case "validated":
      return ["upload", "validate", "reconcile", "cancel"];
    case "reconciled":
      return ["upload", "validate", "reconcile", "commit", "cancel"];
    case "committed":
      return ["parallel_cycle", "rollback", "go_live"];
    default:
      return [];
  }
}

const view = (ok: Ok, job: MockJob): Job => ({ ...job.dto, nextActions: nextActions(ok, job.dto) });

/** Re-validates a job from its raw rows (every upload / removal / validate does). */
function revalidate(job: MockJob): void {
  const raw = RAW.get(job.dto.id) ?? {};
  job.rows = validateAll(raw);
  const totals = totalsOf(job.rows);
  job.dto.files = job.dto.files.map((file) =>
    file.sheet === "legacy_bills"
      ? file
      : { ...fileDto(file.sheet, file.fileName, job.rows), documentId: file.documentId, uploadedAt: file.uploadedAt },
  );
  const ready =
    ["register", "opening_balance"].every((sheet) => job.dto.files.some((file) => file.sheet === sheet)) &&
    totals.errors === 0;
  const keep = job.dto.state === "reconciled" && ready && job.dto.totals?.receivables === totals.receivables;
  job.dto.totals = totals;
  job.dto.state = keep ? "reconciled" : ready ? "validated" : "draft";
  if (!keep) job.dto.reconciliation = null;
  job.dto.version += 1;
}

function open(op: string, job: MockJob): Response | null {
  return ["draft", "validated", "reconciled"].includes(job.dto.state) ? null : problem(op, "import.invalid_state");
}

/** The bytes of an uploaded file (presign → PUT) or inline base64 → text, or null for an XLSX (stands for the sample). */
function contentOf(input: {
  fileId?: string;
  content?: string;
  fileName?: string;
}): { name: string; text: string | null } | Response | "missing" {
  if (input.fileId) {
    const stored = state.staff.files.get(input.fileId);
    if (!stored || !stored.bytes) return "missing";
    const name = stored.file.title ?? "file";
    const isCsv = /\.csv$/i.test(name) || stored.file.mimeType === "text/csv";
    return { name, text: isCsv ? new TextDecoder().decode(stored.bytes as Uint8Array) : null };
  }
  if (input.content && input.fileName) {
    const isCsv = /\.csv$/i.test(input.fileName);
    return { name: input.fileName, text: isCsv ? Buffer.from(input.content, "base64").toString("utf8") : null };
  }
  return "missing";
}

function reconcileItems(job: MockJob, declared: string): Schemas["JuristicImportReconciliationDto"]["items"] {
  const totals = job.dto.totals!;
  const items: Schemas["JuristicImportReconciliationDto"]["items"] = [
    {
      key: "receivables",
      kind: "receivables",
      label: "receivables",
      imported: totals.receivables,
      reference: baht(satang(declared)),
      difference: baht(satang(totals.receivables) - satang(declared)),
      status: satang(totals.receivables) === satang(declared) ? "match" : "mismatch",
    },
  ];
  job.rows
    .filter((row) => row.sheet === "bank_balance" && !row.errors.length)
    .forEach((row) => {
      const last4 = row.data.bank_account_last4 ?? "";
      const statement = STATEMENT[last4] ?? null;
      items.push({
        key: `bank:${row.rowNo}`,
        kind: "bank",
        label:
          row.data.account_type === "operating" ? `operating ••${last4}` : `fund ${row.data.fund_name ?? ""}`.trim(),
        imported: baht(satang(row.data.balance ?? "0")),
        reference: statement,
        difference: statement === null ? null : baht(satang(row.data.balance ?? "0") - satang(statement)),
        status:
          statement === null
            ? "no_statement"
            : satang(statement) === satang(row.data.balance ?? "0")
              ? "match"
              : "mismatch",
      });
    });
  return items;
}

/** The juristic world gains what the commit creates (floors, units, owners, ownerships); the rollback removes it. */
function writeCommit(job: MockJob): Record<string, number> {
  const register = job.rows.filter((row) => row.sheet === "register");
  const ids = job.createdIds;
  const floorIds = new Map<string, string>();
  for (const row of register) {
    const level = row.data.floor ?? "1";
    if (!floorIds.has(level)) {
      const id = crypto.randomUUID();
      floorIds.set(level, id);
      juristic().floors.push({
        id,
        buildingId: job.dto.buildingId,
        level: Number(level),
        name: `ชั้น ${level}`,
        sortOrder: Number(level),
        unitCount: 0,
      });
      ids.floors.push(id);
    }
  }
  const unitIds = new Map<string, string>();
  for (const row of register) {
    const unitNo = row.data.unit_no!;
    if (!unitIds.has(unitNo)) {
      const id = crypto.randomUUID();
      unitIds.set(unitNo, id);
      juristic().units.push({
        titleDeedNo: null,
        dto: {
          id,
          unitNo,
          buildingId: job.dto.buildingId,
          propertyId: J.condo,
          type: "condo_unit",
          floorId: floorIds.get(row.data.floor ?? "1") ?? null,
          floorLevel: Number(row.data.floor ?? 1),
          areaSqm: row.data.area_sqm,
          baseRent: null,
          status: "occupied",
          statusReason: null,
          statusChangedAt: iso(),
          unitProfileId: null,
          unitProfileName: null,
          ownershipRatio: row.data.ownership_ratio,
          landAreaSqwa: null,
          plotNo: null,
          currentLeaseId: null,
          notes: null,
          currency: "THB",
          version: 1,
          nextActions: [],
        } as Schemas["UnitDto"],
      });
      ids.units.push(id);
    }
    const partyId = crypto.randomUUID();
    juristic().parties.push({
      id: partyId,
      type: "person",
      displayName: row.data.owner_name ?? "",
      phoneMasked: row.data.phone ? `+66•••••${row.data.phone.slice(-4)}` : null,
      email: null,
      lineLinked: false,
      residentLinked: false,
    } as Schemas["RegisterPartyDto"]);
    ids.parties.push(partyId);
    const ownershipId = crypto.randomUUID();
    juristic().ownerships.push({
      id: ownershipId,
      unitId: unitIds.get(unitNo)!,
      partyId,
      sharePct: `${Number(row.data.share_pct || 100).toFixed(4)}`,
      validFrom: job.dto.asOfDate,
      validTo: null,
      source: "import",
    });
    ids.ownerships.push(ownershipId);
  }
  const totals = job.dto.totals!;
  return {
    floor: ids.floors.length,
    unit: ids.units.length,
    party: ids.parties.length,
    unit_ownership: ids.ownerships.length,
    bill_to: totals.billTos,
    invoice: totals.openingInvoices,
    legacy_payment: totals.historyCount,
  };
}

function undoCommit(job: MockJob): void {
  const ids = job.createdIds;
  const world = juristic();
  world.ownerships = world.ownerships.filter((row) => !ids.ownerships.includes(row.id));
  world.parties = world.parties.filter((row) => !ids.parties.includes(row.id));
  world.units = world.units.filter((row) => !ids.units.includes(row.dto.id));
  world.floors = world.floors.filter((row) => !ids.floors.includes(row.id));
  job.createdIds = { floors: [], units: [], parties: [], ownerships: [] };
}

/** What the parallel cycle computed for each imported unit (Σ of the cycle's invoices — the API's side). */
function computedFor(unitNo: string): string {
  const unit = Number(unitNo.replace(/\D/g, "")) || 101;
  return baht(1043_10 + (unit % 6) * 211_45);
}

function compare(
  job: MockJob,
  legacy: { unitNo: string; amount: string }[] | null,
): Schemas["JuristicCycleDifferenceDto"][] {
  const units = [...new Set(job.rows.filter((row) => row.sheet === "register").map((row) => row.data.unit_no!))];
  const legacyOf = new Map((legacy ?? []).map((row) => [row.unitNo, row.amount]));
  return units.map((unitNo, index) => {
    const computed = computedFor(unitNo);
    const fallback =
      unitNo === "B-205"
        ? satang(computed) + 50_00
        : unitNo === "B-503"
          ? satang(computed) - 120_00
          : unitNo === "B-708"
            ? satang(computed) + 35_50
            : satang(computed);
    const legacyAmount = legacy ? satang(legacyOf.get(unitNo) ?? "0") : fallback;
    return {
      id: iid("d1ffa001", index + 1),
      unitId: juristic().units.find((unit) => unit.dto.unitNo === unitNo)?.dto.id ?? null,
      unitNo,
      computed,
      legacy: baht(legacyAmount),
      difference: baht(satang(computed) - legacyAmount),
      explanation: null,
      explainedAt: null,
    };
  });
}

function report(job: MockJob): Schemas["JuristicParallelCycleReportDto"] {
  const rows = job.differences;
  const different = rows.filter((row) => satang(row.difference) !== 0);
  const cycle = juristic().cycles.find((candidate) => candidate.id === job.dto.parallelCycleId);
  return {
    importJobId: job.dto.id,
    billingCycleId: job.dto.parallelCycleId,
    periodKey: cycle?.periodKey ?? null,
    runAt: job.dto.parallelRunAt,
    differences: rows,
    summary: {
      units: rows.length,
      matching: rows.length - different.length,
      different: different.length,
      unexplained: different.filter((row) => !row.explanation).length,
      computedTotal: baht(rows.reduce((sum, row) => sum + satang(row.computed), 0)),
      legacyTotal: baht(rows.reduce((sum, row) => sum + satang(row.legacy), 0)),
      differenceTotal: baht(rows.reduce((sum, row) => sum + satang(row.difference), 0)),
    },
  };
}

function settingValue(key: string): unknown {
  return state.collections?.settings.find((setting) => setting.key === key)?.value;
}

// ------------------------------------------------------------------------------------------------- controls

/** Moves อาคาร B's job forward for screenshots and specs (`/__mock/owner/imports/advance?to=`). */
export function advanceImport(to: string): unknown {
  const job = jobOf(IMP.draftB)!;
  const steps = ["validated", "reconciled", "explained", "committed", "compared", "explained-all", "live"];
  const target = steps.indexOf(to);
  if (target < 0) return { error: "unknown target" };
  if (job.dto.state === "draft") {
    const raw = RAW.get(job.dto.id) ?? {};
    raw.register = numbered(sampleRegister());
    raw.bank_balance = numbered(sampleBank());
    RAW.set(job.dto.id, raw);
    if (!job.dto.files.some((file) => file.sheet === "bank_balance"))
      job.dto.files.push(fileDto("bank_balance", "bank_balance_oct.csv", job.rows));
    job.dto.files = job.dto.files.map((file) =>
      file.sheet === "register" ? { ...file, fileName: "ladawan_register_2569_แก้ไข.xlsx", uploadedAt: iso() } : file,
    );
    revalidate(job);
  }
  if (target >= 1 && job.dto.state === "validated") {
    job.dto.state = "reconciled";
    job.dto.reconciliation = {
      items: reconcileItems(job, "612450.00"),
      explanationRequired: true,
      declaredReceivables: "612450.00",
      note: null,
      documentId: null,
      reconciledAt: iso(),
    };
  }
  if (target >= 2 && job.dto.reconciliation && !job.dto.reconciliation.note) {
    job.dto.reconciliation = {
      ...job.dto.reconciliation,
      note: "ค่าธรรมเนียมโอนเงินและเช็ครอเคลียริ่ง ณ วันที่ตัดยอด (เช็คเลขที่ 0092144 รอเข้าบัญชีวันทำการถัดไป)",
      documentId: crypto.randomUUID(),
    };
  }
  if (target >= 3 && job.dto.state === "reconciled") {
    job.dto.created = writeCommit(job);
    job.dto.state = "committed";
    job.dto.committedAt = iso();
  }
  if (target >= 4 && job.dto.state === "committed" && !job.dto.parallelRunAt) {
    job.dto.parallelCycleId = iid("c7c1a001", 1);
    job.dto.parallelRunAt = iso();
    job.differences = compare(job, null);
  }
  if (target >= 5)
    job.differences = job.differences.map((row) =>
      satang(row.difference) !== 0 && !row.explanation
        ? { ...row, explanation: "ระบบเดิมรวมค่าที่จอดรถคันที่สองไว้ในค่าส่วนกลาง", explainedAt: iso() }
        : row,
    );
  if (target >= 6 && job.dto.state === "committed") {
    job.dto.state = "live";
    job.dto.liveAt = iso();
  }
  job.dto.version += 1;
  return job.dto;
}

export function importFlags(params: URLSearchParams): MockImportsWorld {
  if (params.has("stale")) w().stale = params.get("stale") === "1";
  if (params.has("blockRollback")) w().blockRollback = params.get("blockRollback") === "1";
  return w();
}

// ------------------------------------------------------------------------------------------------- handlers

const juristicOnly = (ok: Ok) => ok.tenantId === JURISTIC_TENANT;
const BASE = "*/v1/owner/juristic/imports";

function loaded(request: Request, op: string, id: string, write = false): { ok: Ok; job: MockJob } | Response {
  const ok = write ? mutating(request, op) : owner(request, op);
  if (ok instanceof Response) return ok;
  const job = juristicOnly(ok) ? jobOf(id) : undefined;
  if (!job) return notFound(op);
  const forbidden = allowed(ok, op, write ? "juristic.import.manage" : "juristic.import.read");
  if (forbidden) return forbidden;
  return { ok, job };
}

function binary(text: string, format: string, fileName: string): Response {
  const xlsx = format === "xlsx";
  return new HttpResponse(xlsx ? `mock xlsx: ${text}` : `﻿${text}`, {
    status: 200,
    headers: {
      "content-type": xlsx
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}.${xlsx ? "xlsx" : "csv"}"`,
    },
  });
}

const csvCell = (value: string | null | undefined) =>
  value && /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : (value ?? "");

export const importsHandlers: HttpHandler[] = [
  http.get(BASE, ({ request }) => {
    const op = "owner.juristicImports.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return json(paged([], request));
    const forbidden = allowed(ok, op, "juristic.import.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const rows = w()
      .jobs.filter(
        (job) =>
          (!params.get("buildingId") || job.dto.buildingId === params.get("buildingId")) &&
          (!params.get("state") || job.dto.state === params.get("state")),
      )
      .sort((a, b) => b.dto.createdAt.localeCompare(a.dto.createdAt))
      .map((job) => view(ok, job));
    return json(paged(rows, request));
  }),
  http.post(BASE, async ({ request }) => {
    const op = "owner.juristicImports.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.import.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["JuristicImportCreateDto"]>(request);
    record(op, request, input);
    const building = juristic().buildings.find((candidate) => candidate.id === input.buildingId);
    if (!building) return validation(op, "buildingId", "เลือกอาคารของนิติบุคคล");
    if (!input.asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.asOfDate))
      return validation(op, "asOfDate", "ระบุวันที่ตัดยอด");
    if (input.asOfDate > date()) return validation(op, "asOfDate", "วันที่ตัดยอดต้องไม่เกินวันนี้");
    if (
      w().jobs.some(
        (job) =>
          job.dto.buildingId === building.id &&
          ["draft", "validated", "reconciled", "committed"].includes(job.dto.state),
      )
    )
      return problem(op, "import.job_open");
    const id = crypto.randomUUID();
    const job: MockJob = {
      dto: jobDto(Math.max(...w().jobs.map((entry) => entry.dto.number)) + 1, id, building.id, building.name, {
        asOfDate: input.asOfDate,
        note: input.note?.trim() || null,
        createdAt: iso(),
      }),
      rows: [],
      differences: [],
      createdIds: { floors: [], units: [], parties: [], ownerships: [] },
    };
    RAW.set(id, {});
    w().jobs.push(job);
    return json(view(ok, job), 201);
  }),
  http.get(`${BASE}/templates/:sheet`, ({ request, params }) => {
    const op = "owner.juristicImports.template";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const sheet = String(params.sheet) as Sheet;
    if (!COLUMNS[sheet]) return notFound(op);
    const language = query(request).get("language") === "en" ? "en" : "th";
    const header = COLUMNS[sheet]
      .map((key) => `${LABELS[key]?.[language] ?? key} (${key})${REQUIRED[sheet].includes(key) ? " *" : ""}`)
      .join(",");
    const examples = sheet === "legacy_bills" ? [] : (SAMPLE[sheet as keyof typeof SAMPLE]().slice(0, 2) ?? []);
    const lines = [
      header,
      ...examples.map(
        (row, index) => `${index === 0 ? "#" : "#"}${COLUMNS[sheet].map((key) => csvCell(row[key])).join(",")}`,
      ),
    ];
    return binary(lines.join("\r\n"), query(request).get("format") ?? "xlsx", `template_${sheet}_${language}`);
  }),
  http.get(`${BASE}/:id`, ({ request, params }) => {
    const found = loaded(request, "owner.juristicImports.get", String(params.id));
    if (found instanceof Response) return found;
    return json(view(found.ok, found.job));
  }),
  http.post(`${BASE}/:id/files`, async ({ request, params }) => {
    const op = "owner.juristicImports.upload";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, job } = found;
    const closed = open(op, job);
    if (closed) return closed;
    const input = await body<Schemas["JuristicImportFileUploadDto"]>(request);
    record(op, request, input);
    if (!["register", "opening_balance", "payment_history", "bank_balance"].includes(input.sheet))
      return validation(op, "sheet", "register, opening_balance, payment_history or bank_balance");
    const content = contentOf(input);
    if (content === "missing") return problem(op, "document.not_uploaded");
    if (content instanceof Response) return content;
    if (!/\.(csv|xlsx)$/i.test(content.name)) return problem(op, "document.type_not_allowed");
    const parsed =
      content.text === null
        ? numbered(SAMPLE[input.sheet as keyof typeof SAMPLE]())
        : parseCsv(content.text, input.sheet);
    if (!parsed) return problem(op, "import.file_invalid");
    const raw = RAW.get(job.dto.id) ?? {};
    raw[input.sheet] = parsed;
    RAW.set(job.dto.id, raw);
    job.dto.files = job.dto.files.filter((file) => file.sheet !== input.sheet);
    job.dto.files.push({
      sheet: input.sheet,
      documentId: input.fileId ?? crypto.randomUUID(),
      fileName: content.name,
      format: /\.csv$/i.test(content.name) ? "csv" : "xlsx",
      rowCount: 0,
      errorCount: 0,
      warningCount: 0,
      uploadedAt: iso(),
    });
    revalidate(job);
    return json(view(ok, job));
  }),
  http.delete(`${BASE}/:id/files/:sheet`, ({ request, params }) => {
    const op = "owner.juristicImports.removeFile";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, job } = found;
    const closed = open(op, job);
    if (closed) return closed;
    const sheet = String(params.sheet) as Sheet;
    if (!job.dto.files.some((file) => file.sheet === sheet)) return notFound(op);
    job.dto.files = job.dto.files.filter((file) => file.sheet !== sheet);
    const raw = RAW.get(job.dto.id) ?? {};
    delete raw[sheet];
    revalidate(job);
    return json(view(ok, job));
  }),
  http.post(`${BASE}/:id/actions/validate`, ({ request, params }) => {
    const op = "owner.juristicImports.validate";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const closed = open(op, found.job);
    if (closed) return closed;
    w().stale = false;
    revalidate(found.job);
    return json(view(found.ok, found.job));
  }),
  http.get(`${BASE}/:id/preview`, ({ request, params }) => {
    const op = "owner.juristicImports.preview";
    const found = loaded(request, op, String(params.id));
    if (found instanceof Response) return found;
    const { job } = found;
    const closed = open(op, job);
    if (closed) return closed;
    const opening = job.rows.filter((row) => row.sheet === "opening_balance" && !row.errors.length);
    const byUnit = new Map<string, Schemas["JuristicImportPreviewInvoiceDto"]>();
    for (const row of opening) {
      const unitNo = row.data.unit_no!;
      const owner = job.rows.find((candidate) => candidate.sheet === "register" && candidate.data.unit_no === unitNo);
      const current = byUnit.get(unitNo);
      const total =
        satang(current?.total ?? "0") + satang(row.data.principal ?? "0") + satang(row.data.surcharge ?? "0");
      byUnit.set(unitNo, {
        unitNo,
        ownerName: row.data.owner_name ?? owner?.data.owner_name ?? "",
        billedName: owner?.data.bill_to_name || (row.data.owner_name ?? ""),
        periodStart: "2026-04-01",
        periodEnd: job.dto.asOfDate,
        lines: (current?.lines ?? 0) + (satang(row.data.surcharge ?? "0") > 0 ? 2 : 1),
        total: baht(total),
      });
    }
    const floors = [
      ...new Set(
        job.rows
          .filter((row) => row.sheet === "register")
          .map((row) => row.data.floor)
          .filter(Boolean),
      ),
    ] as string[];
    return json({
      totals: job.dto.totals ?? totalsOf(job.rows),
      floorsToCreate: floors.map((level) => ({ level: Number(level), name: `ชั้น ${level}` })),
      openingBalances: [...byUnit.values()].sort((a, b) => satang(b.total) - satang(a.total)),
      truncated: false,
    } satisfies Schemas["JuristicImportPreviewDto"]);
  }),
  http.get(`${BASE}/:id/rows`, ({ request, params }) => {
    const op = "owner.juristicImports.rows";
    const found = loaded(request, op, String(params.id));
    if (found instanceof Response) return found;
    const q = query(request);
    const language = q.get("language") === "en" ? "en" : "th";
    const rows = found.job.rows
      .filter(
        (row) =>
          (!q.get("sheet") || row.sheet === q.get("sheet")) && (q.get("errorsOnly") !== "true" || row.errors.length),
      )
      .map((row): Schemas["JuristicImportRowDto"] => ({
        sheet: row.sheet,
        rowNo: row.rowNo,
        data: row.data,
        errors: row.errors.map((issue) => ({
          column: issue.column,
          code: issue.code,
          message: message(issue, language),
        })),
        warnings: row.warnings.map((issue) => ({
          column: issue.column,
          code: issue.code,
          message: message(issue, language),
        })),
      }));
    return json(paged(rows, request));
  }),
  http.get(`${BASE}/:id/bad-rows`, ({ request, params }) => {
    const op = "owner.juristicImports.badRows";
    const found = loaded(request, op, String(params.id));
    if (found instanceof Response) return found;
    const q = query(request);
    const sheet = (q.get("sheet") ?? "register") as Sheet;
    const language = q.get("language") === "en" ? "en" : "th";
    const rows = found.job.rows.filter((row) => row.sheet === sheet && row.errors.length);
    const header = [
      ...COLUMNS[sheet].map((key) => `${LABELS[key]?.[language] ?? key} (${key})`),
      language === "th" ? "ข้อผิดพลาด (errors)" : "Errors (errors)",
    ].join(",");
    const lines = rows.map((row) =>
      [
        ...COLUMNS[sheet].map((key) => csvCell(row.data[key])),
        csvCell(row.errors.map((issue) => message(issue, language)).join("; ")),
      ].join(","),
    );
    return binary([header, ...lines].join("\r\n"), q.get("format") ?? "xlsx", `bad_rows_${sheet}`);
  }),
  http.post(`${BASE}/:id/actions/reconcile`, async ({ request, params }) => {
    const op = "owner.juristicImports.reconcile";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, job } = found;
    if (!["validated", "reconciled"].includes(job.dto.state)) return problem(op, "import.invalid_state");
    const input = await body<Schemas["JuristicImportReconcileDto"]>(request);
    record(op, request, input);
    if (!input.declaredReceivables || !/^\d{1,12}(\.\d{1,2})?$/.test(input.declaredReceivables))
      return validation(op, "declaredReceivables", "ยอดต้องเป็นจำนวนเงิน ไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง");
    const note = input.note?.trim() || null;
    if ((note === null) !== !input.documentId)
      return validation(op, note ? "documentId" : "note", "คำอธิบายต้องมีทั้งข้อความและเอกสารแนบ", "required");
    if (note && (note.length < 10 || note.length > 2000))
      return validation(op, "note", "คำอธิบาย 10–2000 ตัวอักษร", "length");
    if (w().stale) return problem(op, "import.preview_stale");
    const items = reconcileItems(job, input.declaredReceivables);
    job.dto.state = "reconciled";
    job.dto.reconciliation = {
      items,
      explanationRequired: items.some((item) => item.status !== "match"),
      declaredReceivables: baht(satang(input.declaredReceivables)),
      note,
      documentId: input.documentId ?? null,
      reconciledAt: iso(),
    };
    job.dto.version += 1;
    return json(view(ok, job));
  }),
  http.post(`${BASE}/:id/actions/commit`, async ({ request, params }) => {
    const op = "owner.juristicImports.commit";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, job } = found;
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["JuristicImportCommitDto"];
      if (job.dto.state !== "reconciled") return problem(op, "import.invalid_state");
      if (w().stale) return problem(op, "import.preview_stale");
      const rec = job.dto.reconciliation;
      if (rec?.explanationRequired && !(rec.note && rec.documentId))
        return problem(op, "import.reconciliation_unexplained");
      if ((job.dto.totals?.billTos ?? 0) > 0 && !input.billToConsentDocumentId)
        return problem(op, "import.bill_to_consent_required");
      job.dto.created = writeCommit(job);
      job.dto.state = "committed";
      job.dto.committedAt = iso();
      job.dto.version += 1;
      return { status: 200, body: view(ok, job) };
    });
  }),
  http.post(`${BASE}/:id/actions/cancel`, ({ request, params }) => {
    const op = "owner.juristicImports.cancel";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, job } = found;
    if (!["draft", "validated", "reconciled"].includes(job.dto.state)) return problem(op, "import.invalid_state");
    job.dto.state = "cancelled";
    job.dto.cancelledAt = iso();
    job.dto.version += 1;
    return json(view(ok, job));
  }),
  http.post(`${BASE}/:id/actions/rollback`, async ({ request, params }) => {
    const op = "owner.juristicImports.rollback";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, job } = found;
    return idempotent(request, op, (payload) => {
      const reason = String((payload as { reason?: string }).reason ?? "").trim();
      if (reason.length < 5 || reason.length > 1000)
        return validation(op, "reason", "เหตุผล 5–1000 ตัวอักษร", "length");
      if (job.dto.state !== "committed") return problem(op, "import.invalid_state");
      if (w().blockRollback) return problem(op, "import.rollback_blocked");
      undoCommit(job);
      job.differences = [];
      job.dto.state = "rolled_back";
      job.dto.rolledBackAt = iso();
      job.dto.rollbackReason = reason;
      job.dto.version += 1;
      return { status: 200, body: view(ok, job) };
    });
  }),
  http.post(`${BASE}/:id/actions/go-live`, async ({ request, params }) => {
    const op = "owner.juristicImports.goLive";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, job } = found;
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["JuristicImportGoLiveDto"];
      if (job.dto.state !== "committed") return problem(op, "import.invalid_state");
      if (settingValue("juristic.import.parallel_cycle_required") !== false && !job.dto.parallelRunAt)
        return problem(op, "import.parallel_cycle_missing");
      const unexplained = job.differences.filter((row) => satang(row.difference) !== 0 && !row.explanation).length;
      if (
        unexplained &&
        !(
          settingValue("juristic.import.allow_unexplained_differences") === true &&
          input.acknowledgeDifferences === true
        )
      )
        return problem(op, "import.differences_unexplained");
      job.dto.state = "live";
      job.dto.liveAt = iso();
      job.dto.version += 1;
      return { status: 200, body: view(ok, job) };
    });
  }),
  http.get(`${BASE}/:id/parallel-cycle`, ({ request, params }) => {
    const found = loaded(request, "owner.juristicImports.parallelCycle", String(params.id));
    if (found instanceof Response) return found;
    return json(report(found.job));
  }),
  http.post(`${BASE}/:id/parallel-cycle`, async ({ request, params }) => {
    const op = "owner.juristicImports.compareParallelCycle";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { job } = found;
    if (job.dto.state !== "committed") return problem(op, "import.invalid_state");
    const input = await body<Schemas["JuristicImportParallelCycleDto"]>(request);
    record(op, request, input);
    const cycle = juristic().cycles.find(
      (candidate) => candidate.id === input.billingCycleId && candidate.propertyId === J.condo,
    );
    if (!cycle) return notFound(op);
    const content = contentOf(input);
    if (content === "missing") return problem(op, "document.not_uploaded");
    if (content instanceof Response) return content;
    const parsed = content.text === null ? null : parseCsv(content.text, "legacy_bills");
    if (content.text !== null && !parsed) return problem(op, "import.file_invalid");
    job.differences = compare(
      job,
      parsed ? parsed.map((row) => ({ unitNo: row.data.unit_no ?? "", amount: row.data.amount ?? "0" })) : null,
    );
    job.dto.parallelCycleId = cycle.id;
    job.dto.parallelRunAt = iso();
    job.dto.files = job.dto.files.filter((file) => file.sheet !== "legacy_bills");
    job.dto.files.push({
      sheet: "legacy_bills",
      documentId: input.fileId ?? crypto.randomUUID(),
      fileName: content.name,
      format: /\.csv$/i.test(content.name) ? "csv" : "xlsx",
      rowCount: job.differences.length,
      errorCount: 0,
      warningCount: 0,
      uploadedAt: iso(),
    });
    job.dto.version += 1;
    return json(report(job));
  }),
  http.post(`${BASE}/:id/parallel-cycle/differences/:differenceId/actions/explain`, async ({ request, params }) => {
    const op = "owner.juristicImports.explainDifference";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { job } = found;
    if (job.dto.state !== "committed") return problem(op, "import.invalid_state");
    const input = await body<Schemas["JuristicImportDifferenceExplainDto"]>(request);
    const text = input.explanation?.trim() ?? "";
    if (text.length < 5 || text.length > 1000)
      return validation(op, "explanation", "คำอธิบาย 5–1000 ตัวอักษร", "length");
    const row = job.differences.find((candidate) => candidate.id === params.differenceId);
    if (!row) return notFound(op);
    if (satang(row.difference) === 0) return problem(op, "import.invalid_state");
    row.explanation = text;
    row.explainedAt = iso();
    return json(report(job));
  }),
  http.post("*/v1/owner/juristic/export", ({ request }) => {
    const op = "owner.juristicImports.fullExport";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.export.run");
    if (forbidden) return forbidden;
    return idempotent(request, op, () => {
      const job: Schemas["ExportJobDto"] = {
        id: crypto.randomUUID(),
        kind: "juristic_full_export",
        status: "done",
        buildingId: null,
        params: {},
        requestedAt: iso(),
        finishedAt: iso(),
        rowCount: 64,
        error: null,
        download: { url: `${new URL(request.url).origin}/__files/pdf-export`, expiresAt: iso(1 / 288) },
        version: 1,
      };
      state.collections.exportJobs.unshift(job);
      return { status: 202, body: job };
    });
  }),
  // The juristic office opens and computes a cycle for the parallel comparison (the generic cycle endpoints, answered
  // for the juristic tenant).
  http.post("*/v1/owner/billing-cycles", async ({ request }) => {
    const op = "owner.billingCycles.open";
    const ok = mutating(request, op);
    if (ok instanceof Response || !juristicOnly(ok)) return;
    const input = (await request
      .clone()
      .json()
      .catch(() => ({}))) as Schemas["BillingCycleOpenDto"];
    const property = juristic().properties.find((candidate) => candidate.id === input.propertyId);
    if (!property) return notFound(op);
    const periodKey = input.periodKey ?? date().slice(0, 7);
    if (juristic().cycles.some((cycle) => cycle.propertyId === property.id && cycle.periodKey === periodKey))
      return validation(op, "periodKey", "มีรอบบิลของงวดนี้แล้ว");
    const monthly = /^\d{4}-\d{2}$/.test(periodKey);
    const start = monthly ? `${periodKey}-01` : `${periodKey.slice(0, 4)}-01-01`;
    const end = monthly ? `${periodKey}-28` : `${periodKey.slice(0, 4)}-12-31`;
    const template = juristic().cycles[0]!;
    const cycle: Schemas["BillingCycleDto"] = {
      ...template,
      id: crypto.randomUUID(),
      propertyId: property.id,
      propertyName: property.name,
      periodKey,
      frequency: monthly ? "monthly" : "annual",
      periodStart: start,
      periodEnd: end,
      status: "open",
      computedAt: null,
      issuedAt: null,
      closedAt: null,
      stats: { billables: 0, drafts: 0, needsReview: 0, issued: 0, total: "0.00", flags: {} },
      nextActions: ["compute"],
      version: 1,
    };
    juristic().cycles.push(cycle);
    return json(cycle, 201);
  }),
  http.post("*/v1/owner/billing-cycles/:billingCycleId/actions/compute", ({ request, params }) => {
    const ok = mutating(request, "owner.billingCycles.compute");
    if (ok instanceof Response || !juristicOnly(ok)) return;
    const cycle = juristic().cycles.find((candidate) => candidate.id === params.billingCycleId);
    if (!cycle) return;
    cycle.status = "computed";
    cycle.computedAt = iso();
    cycle.nextActions = ["compute", "issue"];
    const units = juristic().units.filter((unit) => unit.dto.propertyId === cycle.propertyId).length;
    cycle.stats = { ...(cycle.stats as Record<string, unknown>), billables: units, drafts: units };
    return json({ ...cycle, invoices: [] });
  }),
];

export const IMPORT_SAMPLE = { register: sampleRegister, opening: sampleOpening, bank: sampleBank, computedFor };
