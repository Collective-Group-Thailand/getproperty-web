import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { BANK } from "./accounting";
import { JURISTIC_TENANT } from "./juristic";
import {
  allowed,
  idempotent,
  json,
  notFound,
  owner,
  paged,
  problem,
  query,
  roleOf,
  validation,
  mutating,
  type Ok,
} from "./support";
import { tenantPermissions } from "../fixtures";

type Schemas = components["schemas"];
type Review = Schemas["JuristicHandoverReviewDto"];

/*
 * Developer handovers from getbuild (pack J, JW3b; api J3.2 at 1e364785, D-333). Five handovers in the juristic office's
 * inbox: อาคาร C (due, clean, the developer did not send the legal form), อาคาร D (due, three problems, a receiving
 * account the office does not hold), บ้านในสวน ซอย 3 (register only, handover date in 12 days), อาคาร E (accepted, the
 * developer still operates — waiting for the juristic person's formation) and อาคาร F (rejected, delivered back).
 * The money is summed here (the API's side); the console never sums it.
 * Controls: `POST /__mock/owner/handovers/flag?unitOwned=1|mismatch=1`, `GET /__mock/owner/handovers`.
 */

const DAY = 86_400_000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);
const hid = (n: number) => `4a0d0a01-0000-4000-8000-${String(n).padStart(12, "0")}`;
const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);

export const HO = {
  dueC: hid(1),
  problemsD: hid(2),
  notDueSoi: hid(3),
  acceptedE: hid(4),
  rejectedF: hid(5),
} as const;

interface MockHandover {
  dto: Omit<Review, "nextActions">;
  /** Whether getbuild sent the building's legal form (else the acceptance must name it, D-302). */
  legalFormSent: boolean;
  legalForm: Schemas["BuildingLegalForm"] | null;
  propertyKind: Schemas["PropertyKind"] | null;
  notifyOpeningBalances: boolean | null;
}

export interface MockHandoversWorld {
  handovers: MockHandover[];
  /** A unit of the next acceptance already has current owners (`handover.unit_owned`). */
  unitOwned: boolean;
  /** The recorded totals differ from the payload (`handover.totals_mismatch`, nothing written). */
  mismatch: boolean;
}

const FIRST = [
  "กมล",
  "จิราพร",
  "ธีรวัฒน์",
  "นภัสสร",
  "ปกรณ์",
  "พิมพ์ชนก",
  "วรเชษฐ์",
  "ศศิธร",
  "สุรเชษฐ์",
  "อรอุมา",
  "ชยพล",
  "ณัฐธิดา",
];
const LAST = [
  "ศรีสุข",
  "วงศ์ทอง",
  "แก้วมณี",
  "บุญมา",
  "ทองดี",
  "รุ่งเรือง",
  "ใจงาม",
  "สายสุวรรณ",
  "พรหมมา",
  "เพชรรัตน์",
];
const nameOf = (n: number) => `${FIRST[n % FIRST.length]} ${LAST[(n * 7) % LAST.length]}`;

function unitsFor(
  prefix: string,
  count: number,
  opts: { perFloor: number; money: boolean; seed: number; firstFloor?: number },
): Schemas["HandoverUnitDto"][] {
  const units: Schemas["HandoverUnitDto"][] = [];
  for (let i = 0; i < count; i += 1) {
    const floor = (opts.firstFloor ?? 2) + Math.floor(i / opts.perFloor);
    const no = `${prefix}${floor}${String((i % opts.perFloor) + 1).padStart(2, "0")}`;
    const n = opts.seed + i;
    const joint = i % 5 === 3;
    const owners: Schemas["HandoverOwnerDto"][] = joint
      ? [
          { partyRef: `p-${n}-a`, displayName: nameOf(n), sharePct: "50.0000" },
          { partyRef: `p-${n}-b`, displayName: nameOf(n + 5), sharePct: "50.0000" },
        ]
      : [{ partyRef: `p-${n}`, displayName: nameOf(n), sharePct: "100.0000" }];
    const monthly = [1200, 1450, 1800, 2350][i % 4]!;
    const owes = opts.money && i % 6 === 1;
    units.push({
      unitRef: `u-${no}`,
      unitNo: no,
      owners,
      advanceCommonFees: opts.money ? baht(monthly * 12 * 100) : "0.00",
      advancePeriodFrom: opts.money ? date(1) : null,
      advancePeriodTo: opts.money ? date(365) : null,
      firstFundContribution: opts.money ? baht(monthly * 13.5 * 100) : "0.00",
      receivablesBroughtForward: owes ? baht(monthly * 100) : "0.00",
      receivableItems: owes ? 1 : 0,
    });
  }
  return units;
}

function totalsOf(units: Schemas["HandoverUnitDto"][], floors: number): Schemas["HandoverTotalsDto"] {
  const sum = (pick: (unit: Schemas["HandoverUnitDto"]) => string) =>
    baht(units.reduce((total, unit) => total + satang(pick(unit)), 0));
  const parties = new Set(units.flatMap((unit) => unit.owners.map((o) => o.partyRef)));
  return {
    units: units.length,
    floors,
    parties: parties.size,
    ownerships: units.reduce((total, unit) => total + unit.owners.length, 0),
    unitsWithMoney: units.filter((unit) => satang(unit.advanceCommonFees) > 0 || satang(unit.firstFundContribution) > 0)
      .length,
    advanceCommonFees: sum((unit) => unit.advanceCommonFees),
    firstFundContributions: sum((unit) => unit.firstFundContribution),
    receivablesBroughtForward: sum((unit) => unit.receivablesBroughtForward),
    receivableItems: units.reduce((total, unit) => total + unit.receivableItems, 0),
  };
}

function base(
  id: string,
  buildingName: string,
  buildingRef: string,
  units: Schemas["HandoverUnitDto"][],
  floors: number,
  patch: Partial<Review>,
): Omit<Review, "nextActions"> {
  return {
    id,
    state: "pending_review",
    contractVersion: 2,
    developerRef: "dev-riverside-estate",
    buildingRef,
    buildingName,
    requestedHandoverAt: iso(-2),
    asOfDate: date(-3),
    totals: totalsOf(units, floors),
    receivingBank: null,
    developerTenantId: null,
    buildingId: null,
    acceptedAt: null,
    rejectedAt: null,
    rejectReason: null,
    rejectionDeliveredAt: null,
    formedOn: null,
    registrationNo: null,
    createdAt: iso(-4),
    version: 1,
    problems: [],
    units,
    partiesToAttach: 0,
    partiesToCreate: new Set(units.flatMap((unit) => unit.owners.map((o) => o.partyRef))).size,
    applied: null,
    ...patch,
  };
}

function appliedOf(dto: Omit<Review, "nextActions">): Schemas["HandoverAppliedDto"] {
  return {
    credits: dto.totals.advanceCommonFees,
    openingInvoices: dto.units.reduce(
      (total, unit) => total + (satang(unit.receivablesBroughtForward) > 0 ? unit.owners.length : 0),
      0,
    ),
    openingInvoicesTotal: dto.totals.receivablesBroughtForward,
    fundContributions: dto.totals.firstFundContributions,
  };
}

export function initialHandoversWorld(): MockHandoversWorld {
  const c = unitsFor("C-", 24, { perFloor: 6, money: true, seed: 3 });
  const d = unitsFor("D-", 16, { perFloor: 4, money: true, seed: 41, firstFloor: 3 });
  // อาคาร D: an owner missing on a unit holding money, shares over 100 %, a receivable dated after the as-of date.
  d[2] = { ...d[2]!, owners: [] };
  d[5] = {
    ...d[5]!,
    owners: d[5]!.owners.map((owner, index) => ({ ...owner, sharePct: index === 0 ? "70.0000" : "50.0000" })),
  };
  const soi = unitsFor("3/", 10, { perFloor: 10, money: false, seed: 70, firstFloor: 1 }).map((unit, index) => ({
    ...unit,
    unitNo: `55/${index + 11}`,
  }));
  const e = unitsFor("E-", 18, { perFloor: 6, money: true, seed: 90 });
  const f = unitsFor("F-", 12, { perFloor: 6, money: true, seed: 120 });
  const accepted = base(HO.acceptedE, "อาคาร E", "bldg-e", e, 3, {
    state: "accepted",
    requestedHandoverAt: iso(-24),
    asOfDate: date(-25),
    createdAt: iso(-26),
    acceptedAt: iso(-20),
    developerTenantId: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6cd1",
    buildingId: "5c8e0a01-0000-4000-8000-0000000000e1",
    receivingBank: {
      bankCode: "004",
      bankName: "ธนาคารกสิกรไทย",
      accountName: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์",
      accountNoMasked: "XXX-X-XX1234",
      matchedBankAccountId: BANK.operating,
    },
    version: 2,
  });
  accepted.applied = appliedOf(accepted);
  return {
    unitOwned: false,
    mismatch: false,
    handovers: [
      {
        dto: base(HO.dueC, "อาคาร C", "bldg-c", c, 4, {
          receivingBank: {
            bankCode: "004",
            bankName: "ธนาคารกสิกรไทย",
            accountName: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์",
            accountNoMasked: "XXX-X-XX1234",
            matchedBankAccountId: BANK.operating,
          },
          partiesToAttach: 2,
          partiesToCreate: totalsOf(c, 4).parties - 2,
        }),
        legalFormSent: false,
        legalForm: null,
        propertyKind: null,
        notifyOpeningBalances: null,
      },
      {
        dto: base(HO.problemsD, "อาคาร D", "bldg-d", d, 4, {
          requestedHandoverAt: iso(-1),
          createdAt: iso(-2),
          receivingBank: {
            bankCode: "006",
            bankName: "ธนาคารกรุงไทย",
            accountName: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์ อาคาร D",
            accountNoMasked: "XXX-X-XX9087",
            matchedBankAccountId: null,
          },
          problems: [
            { code: "owner_missing", unitRef: d[2]!.unitRef, ref: null },
            { code: "shares_exceeded", unitRef: d[5]!.unitRef, ref: null },
            { code: "receivable_after_as_of", unitRef: d[1]!.unitRef, ref: "rcv-2" },
          ],
        }),
        legalFormSent: true,
        legalForm: "condo_act",
        propertyKind: "condo",
        notifyOpeningBalances: null,
      },
      {
        dto: base(HO.notDueSoi, "บ้านในสวน ซอย 3", "soi-3", soi, 1, {
          contractVersion: 1,
          requestedHandoverAt: iso(12),
          asOfDate: null,
          createdAt: iso(-1),
        }),
        legalFormSent: true,
        legalForm: "land_allocation_act",
        propertyKind: "village",
        notifyOpeningBalances: null,
      },
      {
        dto: accepted,
        legalFormSent: true,
        legalForm: "condo_act",
        propertyKind: "condo",
        notifyOpeningBalances: true,
      },
      {
        dto: base(HO.rejectedF, "อาคาร F", "bldg-f", f, 2, {
          state: "rejected",
          requestedHandoverAt: iso(-10),
          createdAt: iso(-12),
          rejectedAt: iso(-9),
          rejectReason: "ยอดเงินกองทุนงวดแรกของห้อง F-204 ถึง F-206 ไม่ตรงกับสัญญาซื้อขาย ขอให้ตรวจและส่งใหม่",
          rejectionDeliveredAt: iso(-9),
          receivingBank: {
            bankCode: "014",
            bankName: "ธนาคารไทยพาณิชย์",
            accountName: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์ (กองทุนสำรอง)",
            accountNoMasked: "XXX-X-XX4521",
            matchedBankAccountId: BANK.fund,
          },
        }),
        legalFormSent: true,
        legalForm: "condo_act",
        propertyKind: "condo",
        notifyOpeningBalances: null,
      },
    ],
  };
}

export function resetHandoversWorld(): void {
  state.handovers = initialHandoversWorld();
}

export function handoverFlags(params: URLSearchParams): MockHandoversWorld {
  if (params.has("unitOwned")) state.handovers.unitOwned = params.get("unitOwned") === "1";
  if (params.has("mismatch")) state.handovers.mismatch = params.get("mismatch") === "1";
  return state.handovers;
}

const w = () => state.handovers;
const juristicOnly = (ok: Ok) => ok.tenantId === JURISTIC_TENANT;
const BASE = "*/v1/owner/juristic/handovers";

function nextActions(ok: Ok, dto: Omit<Review, "nextActions">): string[] {
  const role = roleOf(ok);
  if (!role || !tenantPermissions(role).includes("juristic.handover.manage") || ok.readOnly) return [];
  if (dto.state === "pending_review") return ["accept", "reject"];
  if (dto.state === "accepted" && !dto.formedOn) return ["juristic_formed"];
  return [];
}

const review = (ok: Ok, handover: MockHandover): Review => ({
  ...handover.dto,
  problems: handover.dto.state === "pending_review" ? handover.dto.problems : [],
  nextActions: nextActions(ok, handover.dto),
});

function listDto(ok: Ok, handover: MockHandover): Schemas["JuristicHandoverDto"] {
  const d = handover.dto;
  return {
    id: d.id,
    state: d.state,
    contractVersion: d.contractVersion,
    developerRef: d.developerRef,
    buildingRef: d.buildingRef,
    buildingName: d.buildingName,
    requestedHandoverAt: d.requestedHandoverAt,
    asOfDate: d.asOfDate,
    totals: d.totals,
    receivingBank: d.receivingBank,
    developerTenantId: d.developerTenantId,
    buildingId: d.buildingId,
    acceptedAt: d.acceptedAt,
    rejectedAt: d.rejectedAt,
    rejectReason: d.rejectReason,
    rejectionDeliveredAt: d.rejectionDeliveredAt,
    formedOn: d.formedOn,
    registrationNo: d.registrationNo,
    createdAt: d.createdAt,
    version: d.version,
    nextActions: nextActions(ok, d),
  };
}

function loaded(
  request: Request,
  op: string,
  id: string,
  write: boolean,
): { ok: Ok; handover: MockHandover } | Response {
  const ok = write ? mutating(request, op) : owner(request, op);
  if (ok instanceof Response) return ok;
  if (!juristicOnly(ok)) return notFound(op);
  const forbidden = allowed(ok, op, write ? "juristic.handover.manage" : "juristic.handover.read");
  if (forbidden) return forbidden;
  const handover = w().handovers.find((entry) => entry.dto.id === id);
  if (!handover) return notFound(op);
  return { ok, handover };
}

const LEGAL_FORMS: readonly Schemas["BuildingLegalForm"][] = [
  "condo_act",
  "land_allocation_act",
  "voluntary",
  "lease_contract",
];

export const handoversHandlers: HttpHandler[] = [
  http.get(BASE, ({ request }) => {
    const op = "owner.juristicHandovers.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!juristicOnly(ok)) return notFound(op);
    const forbidden = allowed(ok, op, "juristic.handover.read");
    if (forbidden) return forbidden;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const rows = w()
      .handovers.filter(
        (entry) =>
          entry.dto.state !== "received" &&
          (!params.get("state") || entry.dto.state === params.get("state")) &&
          (!q || entry.dto.buildingName.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.dto.createdAt.localeCompare(a.dto.createdAt))
      .map((entry) => listDto(ok, entry));
    return json(paged(rows, request));
  }),
  http.get(`${BASE}/:id`, ({ request, params }) => {
    const found = loaded(request, "owner.juristicHandovers.get", String(params.id), false);
    if (found instanceof Response) return found;
    return json(review(found.ok, found.handover));
  }),
  http.post(`${BASE}/:id/actions/accept`, ({ request, params }) => {
    const op = "owner.juristicHandovers.accept";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, handover } = found;
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["JuristicHandoverAcceptDto"];
      if (handover.dto.state !== "pending_review") return problem(op, "handover.invalid_state");
      if (handover.dto.requestedHandoverAt > iso()) return problem(op, "handover.not_due");
      if (handover.dto.problems.length > 0) return problem(op, "handover.invalid");
      if (input.legalForm !== undefined && !LEGAL_FORMS.includes(input.legalForm))
        return validation(op, "legalForm", "รูปแบบนิติบุคคลไม่ถูกต้อง");
      if (!handover.legalFormSent && !input.legalForm)
        return validation(op, "legalForm", "ผู้พัฒนาไม่ได้ส่งรูปแบบนิติบุคคลของอาคารมา ระบุก่อนรับมอบ", "required");
      if (w().unitOwned) return problem(op, "handover.unit_owned");
      if (w().mismatch) return problem(op, "handover.totals_mismatch");
      handover.legalForm = input.legalForm ?? handover.legalForm;
      handover.propertyKind = input.propertyKind ?? handover.propertyKind ?? "condo";
      handover.notifyOpeningBalances = input.notifyOpeningBalances ?? true;
      handover.dto = {
        ...handover.dto,
        state: "accepted",
        acceptedAt: iso(),
        buildingId: crypto.randomUUID(),
        version: handover.dto.version + 1,
      };
      handover.dto.applied = appliedOf(handover.dto);
      return { status: 200, body: review(ok, handover) };
    });
  }),
  http.post(`${BASE}/:id/actions/reject`, ({ request, params }) => {
    const op = "owner.juristicHandovers.reject";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, handover } = found;
    return idempotent(request, op, (payload) => {
      const reason = String((payload as { reason?: string }).reason ?? "").trim();
      if (reason.length < 5 || reason.length > 1000)
        return validation(op, "reason", "เหตุผลต้องยาว 5–1000 ตัวอักษร", "length");
      if (handover.dto.state !== "pending_review") return problem(op, "handover.invalid_state");
      handover.dto = {
        ...handover.dto,
        state: "rejected",
        rejectedAt: iso(),
        rejectReason: reason,
        rejectionDeliveredAt: null,
        version: handover.dto.version + 1,
      };
      return { status: 200, body: review(ok, handover) };
    });
  }),
  http.post(`${BASE}/:id/actions/juristic-formed`, ({ request, params }) => {
    const op = "owner.juristicHandovers.juristicFormed";
    const found = loaded(request, op, String(params.id), true);
    if (found instanceof Response) return found;
    const { ok, handover } = found;
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["JuristicHandoverFormedDto"];
      if (!input.formedOn || !/^\d{4}-\d{2}-\d{2}$/.test(input.formedOn))
        return validation(op, "formedOn", "ระบุวันที่จดทะเบียน", "required");
      if (input.formedOn > date()) return validation(op, "formedOn", "วันที่จดทะเบียนต้องไม่เกินวันนี้");
      if ((input.registrationNo ?? "").length > 100) return validation(op, "registrationNo", "ไม่เกิน 100 ตัวอักษร");
      if (handover.dto.state !== "accepted" || handover.dto.formedOn) return problem(op, "handover.invalid_state");
      handover.dto = {
        ...handover.dto,
        formedOn: input.formedOn,
        registrationNo: input.registrationNo?.trim() || null,
        developerTenantId: handover.dto.developerTenantId,
        version: handover.dto.version + 1,
      };
      return { status: 200, body: review(ok, handover) };
    });
  }),
];
