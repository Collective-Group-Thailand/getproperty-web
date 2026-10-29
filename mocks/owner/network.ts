import { http, HttpResponse, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { createListingDraft } from "./listings";
import { BUILDING_A, PARTY } from "./world";
import { idempotent as platformIdempotent, platform } from "../platform/support";
import { body, etagged, idempotent, json, mutating, owner, paged, problem, stale, validation } from "./support";

type Schemas = components["schemas"];

/*
 * Pack G8 on the owner surface (D-299; O-033, O-034): getbuild rental handoffs and employer housing.
 * - Handoffs: two invitations are waiting (delivered by the fake getbuild port) — tokens `HANDOFF_TOKEN.open` and
 *   `HANDOFF_TOKEN.noAddress` (getbuild did not tell the district / province) — plus an expired one. Only a landlord
 *   tenant may claim (`handoff.landlord_required`); a claim adds a listing draft with the campaign tag; a second
 *   claim / a decline after it is `handoff.invalid_state`. The public page shows the first name only.
 * - Employer housing: the sample apartment has one active agreement (company party, building A, per occupant,
 *   50 % recovered) with lease A-201 attached. The statement splits the month's invoice of each attached lease equally
 *   between the people staying (satang remainder to the first) like the API; the payroll file is an export job.
 * Controls: `POST /__mock/owner/network/reset`, `GET /__mock/owner/network`.
 */

const LANDLORD = TENANTS.landlord.profile.id;
const SAMPLE = TENANTS.sample.profile.id;
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10);

export const HANDOFF_TOKEN = {
  open: "q3K8xF0bW2yR9mT4vN6pL1sA7dE5gH0j",
  noAddress: "Zx9Lm2Qp7Rt4Vw1Ys6Bn3Kd8Hf5Jg0Ca",
  expired: "Ex9Pi7Re1Dt0Ok3En5Wa2It4In6Gm8Qs",
} as const;

interface MockHandoff {
  id: string;
  token: string;
  tenantId: string | null;
  buyerFirstName: string;
  developerRef: string;
  buildingRef: string;
  unitRef: string;
  campaignTag: string;
  transferDate: string;
  expiresAt: string;
  deliveredAt: string | null;
  deliveryAttempts: number;
  lastDeliveryError: string | null;
  createdAt: string;
  state: Schemas["RentalHandoffState"];
  facts: Schemas["HandoffFactsDto"];
  acceptedAt: string | null;
  listedAt: string | null;
  listingId: string | null;
  unitId: string | null;
}

interface MockAgreement {
  tenantId: string;
  dto: Schemas["EmployerAgreementDto"];
}

export interface MockNetworkWorld {
  handoffs: MockHandoff[];
  agreements: MockAgreement[];
}

function handoff(input: Partial<MockHandoff> & Pick<MockHandoff, "id" | "token" | "facts">): MockHandoff {
  return {
    tenantId: null,
    buyerFirstName: "Somchai",
    developerRef: "dev-7f3a",
    buildingRef: "the-line-phahol-a",
    unitRef: input.facts.unitNo ?? "A-1203",
    campaignTag: "getbuild:the-line-phahol",
    transferDate: date(-6),
    expiresAt: iso(24),
    deliveredAt: iso(-6),
    deliveryAttempts: 1,
    lastDeliveryError: null,
    createdAt: iso(-6),
    state: "invited",
    acceptedAt: null,
    listedAt: null,
    listingId: null,
    unitId: null,
    ...input,
  };
}

export function initialNetworkWorld(): MockNetworkWorld {
  return {
    handoffs: [
      handoff({
        id: "4b1d0000-0000-4000-8000-0000000b0001",
        token: HANDOFF_TOKEN.open,
        facts: {
          kind: "condo_unit",
          projectName: "The Line Phahol",
          unitNo: "A-1203",
          floorLabel: "12",
          areaSqm: "32.50",
          bedrooms: 1,
          bathrooms: 1,
          district: "จตุจักร",
          province: "กรุงเทพมหานคร",
        },
      }),
      handoff({
        id: "4b1d0000-0000-4000-8000-0000000b0002",
        token: HANDOFF_TOKEN.noAddress,
        buyerFirstName: "Napat",
        unitRef: "B-0507",
        buildingRef: "garden-ville-b",
        campaignTag: "getbuild:dev-91c2",
        developerRef: "dev-91c2",
        deliveredAt: null,
        deliveryAttempts: 3,
        lastDeliveryError: "getbuild answered 503",
        facts: {
          kind: "townhouse",
          projectName: "Garden Ville",
          unitNo: "B-0507",
          floorLabel: null,
          areaSqm: "120.00",
          bedrooms: 3,
          bathrooms: 2,
          district: null,
          province: null,
        },
      }),
      handoff({
        id: "4b1d0000-0000-4000-8000-0000000b0003",
        token: HANDOFF_TOKEN.expired,
        buyerFirstName: "Pim",
        unitRef: "C-0201",
        transferDate: date(-50),
        expiresAt: iso(-20),
        createdAt: iso(-50),
        deliveredAt: iso(-50),
        state: "expired",
        facts: {
          kind: "condo_unit",
          projectName: "The Line Phahol",
          unitNo: "C-0201",
          floorLabel: "2",
          areaSqm: "28.00",
          bedrooms: 1,
          bathrooms: 1,
          district: "จตุจักร",
          province: "กรุงเทพมหานคร",
        },
      }),
    ],
    agreements: [
      {
        tenantId: SAMPLE,
        dto: {
          id: "3e6a0000-0000-4000-8000-0000000e0001",
          employer: { id: PARTY.company, displayName: "บริษัท ตัวอย่างการค้า จำกัด", type: "company" },
          buildingId: BUILDING_A,
          buildingName: "อาคาร A",
          splitRule: "per_occupant",
          deductPercent: "50.00",
          payrollExportFormat: "generic_csv",
          reference: "HR-2026-014",
          validFrom: date(-60),
          validTo: null,
          state: "active",
          endedAt: null,
          createdAt: iso(-60),
          leaseIds: [],
          workers: [],
          version: 1,
        },
      },
    ],
  };
}

const world = (): MockNetworkWorld => state.network;
const handoffDto = (one: MockHandoff): Schemas["RentalHandoffDto"] => {
  const h = refresh(one);
  return {
    id: h.id,
    state: h.state,
    facts: h.facts,
    campaignTag: h.campaignTag,
    transferDate: h.transferDate,
    acceptedAt: h.acceptedAt,
    listedAt: h.listedAt,
    listingId: h.listingId,
    unitId: h.unitId,
  };
};
export const adminHandoffDto = (one: MockHandoff): Schemas["AdminRentalHandoffDto"] => {
  const h = refresh(one);
  return {
    id: h.id,
    developerRef: h.developerRef,
    buildingRef: h.buildingRef,
    unitRef: h.unitRef,
    campaignTag: h.campaignTag,
    transferDate: h.transferDate,
    expiresAt: h.expiresAt,
    deliveredAt: h.deliveredAt,
    deliveryAttempts: h.deliveryAttempts,
    lastDeliveryError: h.lastDeliveryError,
    createdAt: h.createdAt,
    state: h.state,
    tenantId: h.tenantId,
    listingId: h.listingId,
  };
};
export const networkWorld = world;

const byToken = (token: string) => world().handoffs.find((h) => h.token === token);
const notFoundProblem = (op: string) => problem(op, "http.not_found");

/** `listing.published` → `listed` (the API's subscriber): checked whenever a handoff is read. */
function refresh(h: MockHandoff): MockHandoff {
  if (h.state !== "accepted" || !h.listingId) return h;
  const listing = state.listingWorld.listings.find((l) => l.dto.id === h.listingId);
  if (listing?.dto.state === "published") {
    h.state = "listed";
    h.listedAt = listing.dto.publishedAt ?? new Date().toISOString();
  }
  return h;
}

// ---- Employer statement (what the API computes; the console never does) ----

const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);

function statement(agreement: Schemas["EmployerAgreementDto"], month: string): Schemas["EmployerStatementDto"] {
  const numbers = new Map(agreement.workers.map((w) => [w.partyId, w.employeeNo]));
  const leases = state.owner.leases.filter((lease) => agreement.leaseIds.includes(lease.id));
  const [year, m] = month.split("-").map(Number) as [number, number];
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  const nowMonth = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);
  const lines: Schemas["StatementLineDto"][] =
    month > nowMonth
      ? []
      : leases.map((lease, i) => {
          const total = satang(lease.rent) + 30000;
          const paid = month < nowMonth ? total : 0;
          const staying =
            agreement.splitRule === "per_unit"
              ? lease.parties.filter((p) => p.role === "lessee")
              : lease.parties.filter((p) => p.role === "lessee" || p.role === "co_tenant" || p.role === "occupant");
          const people = staying.length ? staying : lease.parties.slice(0, 1);
          const each = Math.floor(total / people.length);
          const shares = people.map((p, index) => {
            const share = index === 0 ? total - each * (people.length - 1) : each;
            const deduction = Math.round((share * Number(agreement.deductPercent)) / 100);
            return {
              partyId: p.partyId,
              name: p.displayName ?? "—",
              employeeNo: numbers.get(p.partyId) ?? null,
              share: baht(share),
              deduction: baht(deduction),
              employerPays: baht(share - deduction),
            };
          });
          return {
            invoiceId: `${lease.id.slice(0, -4)}${String(9000 + i)}`,
            leaseId: lease.id,
            number: `INV-${month.replace("-", "")}-${String(i + 1).padStart(4, "0")}`,
            unitNo: lease.unitNo,
            issuedAt: `${start}T09:00:00+07:00`,
            periodStart: start,
            periodEnd: end,
            total: baht(total),
            paidTotal: baht(paid),
            balance: baht(total - paid),
            shares,
          };
        });
  const sum = (pick: (line: Schemas["StatementLineDto"]) => number) => baht(lines.reduce((acc, l) => acc + pick(l), 0));
  return {
    agreementId: agreement.id,
    employerName: agreement.employer.displayName,
    month,
    splitRule: agreement.splitRule,
    deductPercent: agreement.deductPercent,
    total: sum((l) => satang(l.total)),
    paid: sum((l) => satang(l.paidTotal)),
    balance: sum((l) => satang(l.balance)),
    deductions: sum((l) => l.shares.reduce((a, s) => a + satang(s.deduction), 0)),
    employerPays: sum((l) => l.shares.reduce((a, s) => a + satang(s.employerPays), 0)),
    lines,
  };
}

const findAgreement = (tenantId: string, id: string) =>
  world().agreements.find((a) => a.tenantId === tenantId && a.dto.id === id);
const DEDUCT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;

export const networkHandlers: HttpHandler[] = [
  // ---- Public: the getbuild invitation page ----
  http.get("*/v1/public/handoffs/:token", ({ params }) => {
    const h = byToken(String(params.token));
    if (!h) return notFoundProblem("public.handoffs.get");
    const dto: Schemas["PublicHandoffDto"] = {
      buyerFirstName: h.buyerFirstName,
      facts: h.facts,
      state: h.state,
      transferDate: h.transferDate,
      expiresAt: h.expiresAt,
    };
    return HttpResponse.json(dto, { headers: { "cache-control": "no-store" } });
  }),
  http.post("*/v1/public/handoffs/:token/actions/decline", ({ params }) => {
    const op = "public.handoffs.decline";
    const h = byToken(String(params.token));
    if (!h) return notFoundProblem(op);
    if (h.state !== "invited") return problem(op, "handoff.invalid_state");
    h.state = "declined";
    return json({
      buyerFirstName: h.buyerFirstName,
      facts: h.facts,
      state: h.state,
      transferDate: h.transferDate,
      expiresAt: h.expiresAt,
    });
  }),

  // ---- Owner: claimed handoffs ----
  http.get("*/v1/owner/rental-handoffs", ({ request }) => {
    const ok = owner(request, "owner.rentalHandoffs.list");
    if (ok instanceof Response) return ok;
    return json({
      data: world()
        .handoffs.filter((h) => h.tenantId === ok.tenantId)
        .map(handoffDto),
    });
  }),
  http.post("*/v1/owner/rental-handoffs/actions/claim", ({ request }) => {
    const op = "owner.rentalHandoffs.claim";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const h = byToken(String(input.token ?? ""));
      if (!h) return notFoundProblem(op);
      if (ok.tenantId !== LANDLORD) return problem(op, "handoff.landlord_required");
      if (h.tenantId === ok.tenantId && h.listingId) return { status: 200, body: handoffDto(h) };
      if (h.state !== "invited") return problem(op, "handoff.invalid_state");
      const rent = String(input.rent ?? "");
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(rent)) return validation(op, "rent", "rent must be a decimal amount");
      const address = input.address as Schemas["PortfolioAddressDto"] | undefined;
      if (!h.facts.province || !h.facts.district) {
        for (const field of ["line1", "subdistrict", "district", "province", "postcode"] as const)
          if (!address?.[field]?.trim()) return validation(op, `address.${field}`, "required", "required");
      }
      const title =
        (typeof input.titleTh === "string" && input.titleTh.trim()) ||
        `${h.facts.projectName ?? "ห้อง"} ${h.facts.bedrooms ?? ""} ห้องนอน`.trim();
      const listing = createListingDraft(ok.tenantId, {
        titleTh: title,
        titleEn: typeof input.titleEn === "string" && input.titleEn.trim() ? input.titleEn.trim() : null,
        rent: Number(rent).toFixed(2),
        unitKind: h.facts.kind,
        sizeSqm: h.facts.areaSqm,
        bedrooms: h.facts.bedrooms,
        bathrooms: h.facts.bathrooms,
        floorLabel: h.facts.floorLabel,
        province: h.facts.province ?? address?.province ?? null,
        district: h.facts.district ?? address?.district ?? null,
        campaignTag: h.campaignTag,
      });
      h.tenantId = ok.tenantId;
      h.state = "accepted";
      h.acceptedAt = new Date().toISOString();
      h.listingId = listing.id;
      h.unitId = listing.unitId;
      return { status: 200, body: handoffDto(h) };
    });
  }),

  // ---- Owner: employer housing ----
  http.get("*/v1/owner/employer-agreements", ({ request }) => {
    const ok = owner(request, "owner.employerAgreements.list");
    if (ok instanceof Response) return ok;
    const wanted = new URL(request.url).searchParams.get("state");
    return json({
      data: world()
        .agreements.filter((a) => a.tenantId === ok.tenantId && (!wanted || a.dto.state === wanted))
        .map((a) => a.dto),
    });
  }),
  http.post("*/v1/owner/employer-agreements", async ({ request }) => {
    const op = "owner.employerAgreements.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["EmployerAgreementCreateDto"]>(request);
    const party = state.owner.parties.find((p) => p.id === input.employerPartyId);
    if (!party) return validation(op, "employerPartyId", "choose the employer", "required");
    if (!input.validFrom) return validation(op, "validFrom", "required", "required");
    const deduct = input.deductPercent ?? "100";
    if (!DEDUCT.test(deduct)) return validation(op, "deductPercent", "0–100 with up to two decimals");
    const building = input.buildingId ? state.owner.buildings.find((b) => b.id === input.buildingId) : null;
    const dto: Schemas["EmployerAgreementDto"] = {
      id: crypto.randomUUID(),
      employer: { id: party.id, displayName: party.companyName ?? party.displayName, type: party.type },
      buildingId: building?.id ?? null,
      buildingName: building?.name ?? null,
      splitRule: input.splitRule ?? "per_occupant",
      deductPercent: Number(deduct).toFixed(2),
      payrollExportFormat: "generic_csv",
      reference: input.reference ?? null,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      state: "active",
      endedAt: null,
      createdAt: new Date().toISOString(),
      leaseIds: [],
      workers: [],
      version: 1,
    };
    world().agreements.push({ tenantId: ok.tenantId, dto });
    return etagged(dto, 201);
  }),
  http.get("*/v1/owner/employer-agreements/:agreementId", ({ request, params }) => {
    const ok = owner(request, "owner.employerAgreements.get");
    if (ok instanceof Response) return ok;
    const a = findAgreement(ok.tenantId, String(params.agreementId));
    return a ? etagged(a.dto) : notFoundProblem("owner.employerAgreements.get");
  }),
  http.patch("*/v1/owner/employer-agreements/:agreementId", async ({ request, params }) => {
    const op = "owner.employerAgreements.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const a = findAgreement(ok.tenantId, String(params.agreementId));
    if (!a) return notFoundProblem(op);
    if (!request.headers.get("if-match")) return problem(op, "concurrency.precondition_required");
    if (stale(request, a.dto)) return problem(op, "concurrency.stale");
    if (a.dto.state === "ended") return problem(op, "employer.invalid_state");
    const input = await body<Schemas["EmployerAgreementUpdateDto"]>(request);
    if (input.deductPercent !== undefined && !DEDUCT.test(input.deductPercent))
      return validation(op, "deductPercent", "0–100 with up to two decimals");
    const ending = input.end === true;
    a.dto = {
      ...a.dto,
      deductPercent: input.deductPercent ? Number(input.deductPercent).toFixed(2) : a.dto.deductPercent,
      splitRule: input.splitRule ?? a.dto.splitRule,
      reference: input.reference !== undefined ? input.reference : a.dto.reference,
      validTo: input.validTo !== undefined ? input.validTo : a.dto.validTo,
      state: ending ? "ended" : a.dto.state,
      endedAt: ending ? new Date().toISOString() : a.dto.endedAt,
      leaseIds: ending ? [] : a.dto.leaseIds,
      version: a.dto.version + 1,
    };
    return etagged(a.dto);
  }),
  http.put("*/v1/owner/employer-agreements/:agreementId/workers", async ({ request, params }) => {
    const op = "owner.employerAgreements.workers";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const a = findAgreement(ok.tenantId, String(params.agreementId));
    if (!a) return notFoundProblem(op);
    if (a.dto.state === "ended") return problem(op, "employer.invalid_state");
    const input = await body<Schemas["EmployerWorkersDto"]>(request);
    a.dto = { ...a.dto, workers: input.workers.filter((w) => w.employeeNo.trim()), version: a.dto.version + 1 };
    return json(a.dto);
  }),
  http.get("*/v1/owner/employer-agreements/:agreementId/statement", ({ request, params }) => {
    const ok = owner(request, "owner.employerAgreements.statement");
    if (ok instanceof Response) return ok;
    const a = findAgreement(ok.tenantId, String(params.agreementId));
    if (!a) return notFoundProblem("owner.employerAgreements.statement");
    const month = new URL(request.url).searchParams.get("month") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      return validation("owner.employerAgreements.statement", "month", "YYYY-MM");
    return json(statement(a.dto, month));
  }),
  http.post("*/v1/owner/employer-agreements/:agreementId/payroll-exports", ({ request, params }) => {
    const op = "owner.employerAgreements.payrollExport";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const a = findAgreement(ok.tenantId, String(params.agreementId));
      if (!a) return notFoundProblem(op);
      const month = String(input.month ?? "");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return validation(op, "month", "YYYY-MM");
      const rows = statement(a.dto, month).lines.reduce((n, l) => n + l.shares.length, 0);
      // The export worker builds the CSV (BOM, formula guard) — here at once.
      const job: Schemas["ExportJobDto"] = {
        id: crypto.randomUUID(),
        kind: "payroll_deduction",
        status: "done",
        params: { employerAgreementId: a.dto.id, period: month },
        buildingId: null,
        rowCount: rows,
        error: null,
        requestedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        download: { url: "https://storage.test/exports/payroll.csv", expiresAt: iso(1) },
        version: 1,
      };
      state.owner.exports.unshift(job);
      return { status: 202, body: job };
    });
  }),
  http.put("*/v1/owner/leases/:leaseId/employer", async ({ request, params }) => {
    const op = "owner.leases.setEmployer";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = state.owner.leases.find((l) => l.id === params.leaseId);
    if (!lease || ok.tenantId !== SAMPLE) return notFoundProblem(op);
    if (["ended", "terminated", "cancelled"].includes(lease.status)) return problem(op, "employer.invalid_state");
    const { employerAgreementId } = await body<Schemas["LeaseEmployerDto"]>(request);
    const mine = world().agreements.filter((a) => a.tenantId === ok.tenantId);
    const target = employerAgreementId ? mine.find((a) => a.dto.id === employerAgreementId) : null;
    if (employerAgreementId && !target) return notFoundProblem(op);
    if (target && target.dto.state !== "active") return problem(op, "employer.invalid_state");
    if (target && target.dto.buildingId && target.dto.buildingId !== lease.buildingId)
      return problem(op, "employer.building_mismatch");
    for (const a of mine) {
      if (a.dto.leaseIds.includes(lease.id) && a !== target)
        a.dto = { ...a.dto, leaseIds: a.dto.leaseIds.filter((id) => id !== lease.id), version: a.dto.version + 1 };
    }
    if (target && !target.dto.leaseIds.includes(lease.id))
      target.dto = { ...target.dto, leaseIds: [...target.dto.leaseIds, lease.id], version: target.dto.version + 1 };
    return json({
      leaseId: lease.id,
      employerAgreementId: target?.dto.id ?? null,
      payerPartyId: target?.dto.employer.id ?? null,
      version: lease.version,
    });
  }),
];

// ---- Admin: every handoff, resend ----

export const networkAdminHandlers: HttpHandler[] = [
  http.get("*/v1/admin/rental-handoffs", ({ request }) => {
    const ok = platform(request, "admin.rentalHandoffs.list", "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const wanted = new URL(request.url).searchParams.get("state");
    const rows = world()
      .handoffs.map(adminHandoffDto)
      .filter((h) => !wanted || h.state === wanted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(paged(rows, request));
  }),
  http.post("*/v1/admin/rental-handoffs/:handoffId/actions/resend", ({ request, params }) => {
    const op = "admin.rentalHandoffs.resend";
    const ok = platform(request, op, "admin.tenant.manage");
    if (ok instanceof Response) return ok;
    return platformIdempotent(request, op, () => {
      const h = world().handoffs.find((one) => one.id === params.handoffId);
      if (!h) return notFoundProblem(op);
      if (h.state !== "invited") return problem(op, "handoff.invalid_state");
      // A fresh single-use token goes to getbuild (the fake port accepts it); the attempts restart.
      h.token = `${h.token.slice(0, 24)}${Math.random().toString(36).slice(2, 10).padEnd(8, "x")}`;
      h.deliveredAt = new Date().toISOString();
      h.deliveryAttempts = 1;
      h.lastDeliveryError = null;
      return { status: 200, body: adminHandoffDto(h) };
    });
  }),
];
