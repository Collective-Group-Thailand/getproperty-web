import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { allowed, body, idempotent, json, mutating, notFound, owner, problem, query } from "./support";

type Schemas = components["schemas"];

/**
 * Pack G2 on the owner surface (D-284, D-293): estate agencies, owner → agency listing mandates (invite → accept →
 * active → ended / revoked; exclusive conflicts refused), the units an agency was mandated, co-broke agreements
 * between agencies and the deals closed through the platform with the recorded commission (money between the
 * parties moves outside getproperty, ADR-0008) and the fees the calling tenant owes (none while unpriced, O-027).
 * Reset with the owner part `agency`.
 */

const AGENCY = TENANTS.agency.profile;
const LANDLORD = TENANTS.landlord.profile;
const CO_AGENCY = { id: "0199f2a0-0000-7000-8000-00000000a102", displayName: "นายหน้าร่วม จำกัด" };
const OTHER_OWNER = { id: "0199f2a0-0000-7000-8000-00000000b001", displayName: "สมชาย ใจดี" };

interface MockUnit {
  unitId: string;
  unitNo: string;
  unitType: string;
  areaSqm: string | null;
  buildingId: string;
  buildingName: string;
  province: string | null;
  district: string | null;
  ownerTenantId: string;
  listing: Schemas["MandatedUnitListingDto"] | null;
  listingSlug: string | null;
}

export interface MockAgencyWorld {
  agencies: Schemas["AgencyDto"][];
  units: MockUnit[];
  mandates: Schemas["MandateDto"][];
  coBrokes: Schemas["CoBrokeDto"][];
  deals: Schemas["DealDto"][];
}

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const AGENCY_IDS = {
  invited: "0199f2a0-0000-7000-8000-00000000c001",
  active: "0199f2a0-0000-7000-8000-00000000c002",
  coBroke: "0199f2a0-0000-7000-8000-00000000c101",
  deal: "0199f2a0-0000-7000-8000-00000000c201",
  otherUnit: "0199f2a0-0000-7000-8000-00000000d001",
  otherListing: "0199f2a0-0000-7000-8000-00000000d101",
  coListing: "0199f2a0-0000-7000-8000-00000000d102",
} as const;

function mandate(
  input: Partial<Schemas["MandateDto"]> & Pick<Schemas["MandateDto"], "id" | "unitId" | "state">,
): Schemas["MandateDto"] {
  const unit = state.agency.units.find((u) => u.unitId === input.unitId);
  return {
    agencyTenantId: AGENCY.id,
    agencyName: AGENCY.displayName,
    ownerTenantId: unit?.ownerTenantId ?? LANDLORD.id,
    ownerName: unit?.ownerTenantId === OTHER_OWNER.id ? OTHER_OWNER.displayName : LANDLORD.displayName,
    unitNo: unit?.unitNo ?? "",
    buildingId: unit?.buildingId ?? "",
    buildingName: unit?.buildingName ?? "",
    scope: "list",
    exclusive: false,
    commissionTerms: null,
    commissionPercent: null,
    commissionAmount: null,
    validFrom: today(),
    validTo: null,
    acceptedAt: null,
    activatedAt: null,
    endedAt: null,
    revokedAt: null,
    endReason: null,
    contractDocumentId: null,
    createdAt: now(),
    ...input,
  };
}

function unitsFromPortfolio(): MockUnit[] {
  return (state.portfolio[LANDLORD.id] ?? []).map((u) => ({
    unitId: u.unitId,
    unitNo: u.unitNo,
    unitType: u.kind ?? "condo_unit",
    areaSqm: u.areaSqm,
    buildingId: u.building.id,
    buildingName: u.building.name,
    province: (u.address?.province as string | undefined) ?? null,
    district: (u.address?.district as string | undefined) ?? null,
    ownerTenantId: LANDLORD.id,
    listing: null,
    listingSlug: null,
  }));
}

export function initialAgencyWorld(): MockAgencyWorld {
  return {
    agencies: [
      { id: AGENCY.id, displayName: AGENCY.displayName, slug: "agency-baandee01" },
      { id: CO_AGENCY.id, displayName: CO_AGENCY.displayName, slug: "agency-coagent02" },
    ],
    units: [],
    mandates: [],
    coBrokes: [],
    deals: [],
  };
}

/** Fills the world on first use (it reads the landlord portfolio, which has its own reset). */
function w(): MockAgencyWorld {
  const world = state.agency;
  if (world.units.length) return world;
  world.units = [
    ...unitsFromPortfolio(),
    {
      unitId: AGENCY_IDS.otherUnit,
      unitNo: "21/88",
      unitType: "condo_unit",
      areaSqm: "32.00",
      buildingId: "0199f2a0-0000-7000-8000-00000000e001",
      buildingName: "ไลฟ์ อโศก",
      province: "กรุงเทพมหานคร",
      district: "ห้วยขวาง",
      ownerTenantId: OTHER_OWNER.id,
      listing: { id: AGENCY_IDS.otherListing, state: "published" },
      listingSlug: "condo-1br-baandee88",
    },
  ];
  world.mandates = [
    // Malee (landlord persona) invites บ้านดี to list 8/101 — in the agency's inbox.
    mandate({
      id: AGENCY_IDS.invited,
      unitId: "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c02",
      state: "invited",
      scope: "list_and_lease",
      commissionTerms: "ค่านายหน้า 1 เดือนต่อสัญญาเช่า 1 ปี",
      commissionPercent: "100.0000",
      createdAt: daysAgo(1),
    }),
    // Another owner's unit บ้านดี already lists, exclusively.
    mandate({
      id: AGENCY_IDS.active,
      unitId: AGENCY_IDS.otherUnit,
      state: "active",
      exclusive: true,
      commissionAmount: "15000.00",
      commissionTerms: "ค่านายหน้า 15,000 บาท",
      validFrom: daysAgo(40).slice(0, 10),
      validTo: "2027-06-30",
      acceptedAt: daysAgo(40),
      activatedAt: daysAgo(40),
      createdAt: daysAgo(41),
    }),
  ];
  world.coBrokes = [
    {
      id: AGENCY_IDS.coBroke,
      listingAgencyTenantId: CO_AGENCY.id,
      listingAgencyName: CO_AGENCY.displayName,
      coAgencyTenantId: AGENCY.id,
      coAgencyName: AGENCY.displayName,
      contractDocumentId: null,
      listingId: AGENCY_IDS.coListing,
      listingSlug: "house-3br-coagent77",
      unitId: "0199f2a0-0000-7000-8000-00000000d002",
      mandateId: null,
      splitPercent: "40.0000",
      validFrom: today(),
      validTo: null,
      state: "proposed",
      note: "แบ่งค่านายหน้า 60/40",
      signedAt: null,
      createdAt: daysAgo(2),
    },
  ];
  world.deals = [
    {
      id: AGENCY_IDS.deal,
      ownerTenantId: OTHER_OWNER.id,
      ownerName: OTHER_OWNER.displayName,
      leaseId: "0199f2a0-0000-7000-8000-00000000f001",
      unitId: AGENCY_IDS.otherUnit,
      unitNo: "21/88",
      listingId: AGENCY_IDS.otherListing,
      mandateId: AGENCY_IDS.active,
      coBrokeAgreementId: null,
      listingAgencyTenantId: AGENCY.id,
      listingAgencyName: AGENCY.displayName,
      coAgencyTenantId: null,
      coAgencyName: null,
      monthlyRent: "15000.00",
      commissionAmount: "15000.00",
      coBrokeAmount: null,
      closedAt: daysAgo(5),
      // No published success-fee price (O-027): nothing accrued.
      accruals: [],
    },
  ];
  return world;
}

const HELD: Schemas["MandateState"][] = ["invited", "accepted", "active"];
const tenantType = (tenantId: string) =>
  Object.values(TENANTS).find((t) => t.profile.id === tenantId)?.profile.type ?? null;
const ownsUnit = (tenantId: string, unitId: string) =>
  w().units.some((u) => u.unitId === unitId && u.ownerTenantId === tenantId);

function mandateOf(ok: { tenantId: string }, id: string) {
  return w().mandates.find((m) => m.id === id && (m.ownerTenantId === ok.tenantId || m.agencyTenantId === ok.tenantId));
}

function coBrokeOf(ok: { tenantId: string }, id: string) {
  return w().coBrokes.find(
    (c) => c.id === id && (c.listingAgencyTenantId === ok.tenantId || c.coAgencyTenantId === ok.tenantId),
  );
}

/** A deal as the calling tenant sees it: accruals only its own (they all belong to the listing agency here). */
function dealFor(deal: Schemas["DealDto"], tenantId: string): Schemas["DealDto"] {
  return deal.listingAgencyTenantId === tenantId ? deal : { ...deal, accruals: [] };
}

function exclusiveConflict(unitId: string, exclusive: boolean, except?: string): boolean {
  const held = w().mandates.filter((m) => m.unitId === unitId && m.id !== except && HELD.includes(m.state));
  return held.some((m) => m.exclusive) || (exclusive && held.length > 0);
}

const record = (op: string, key: string | null, payload: unknown) =>
  state.owner.received.push({ op, idempotencyKey: key, body: payload as Record<string, unknown> });

export const agencyHandlers: HttpHandler[] = [
  http.get("*/v1/owner/agencies", ({ request }) => {
    const op = "owner.agencies.search";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.grant.manage");
    if (denied) return denied;
    const q = query(request).get("q")?.trim().toLowerCase();
    return json({
      data: w().agencies.filter((a) => a.id !== ok.tenantId && (!q || a.displayName.toLowerCase().includes(q))),
    } satisfies Schemas["AgenciesDto"]);
  }),

  http.get("*/v1/owner/mandates", ({ request }) => {
    const ok = owner(request, "owner.mandates.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const role = params.get("role");
    const stateFilter = params.get("state");
    const unitId = params.get("unitId");
    const data = w()
      .mandates.filter(
        (m) =>
          (role === "owner"
            ? m.ownerTenantId === ok.tenantId
            : role === "agency"
              ? m.agencyTenantId === ok.tenantId
              : m.ownerTenantId === ok.tenantId || m.agencyTenantId === ok.tenantId) &&
          (!stateFilter || m.state === stateFilter) &&
          (!unitId || m.unitId === unitId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ data } satisfies Schemas["MandatesDto"]);
  }),

  http.post("*/v1/owner/mandates", async ({ request }) => {
    const op = "owner.mandates.invite";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "tenant.grant.manage");
    if (denied) return denied;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["MandateInviteDto"];
      const agency = w().agencies.find((a) => a.id === input.agencyTenantId);
      if (!agency) return problem(op, "mandate.agency_required");
      if (!ownsUnit(ok.tenantId, input.unitId)) return notFound(op);
      if (input.validFrom && input.validFrom < today())
        return problem(op, "validation.failed", {
          errors: [{ path: "validFrom", code: "past", message: "Not in the past" }],
        });
      if (exclusiveConflict(input.unitId, Boolean(input.exclusive))) return problem(op, "mandate.exclusive_conflict");
      const created = mandate({
        id: crypto.randomUUID(),
        unitId: input.unitId,
        state: "invited",
        agencyTenantId: agency.id,
        agencyName: agency.displayName,
        scope: input.scope ?? "list",
        exclusive: Boolean(input.exclusive),
        commissionTerms: input.commissionTerms ?? null,
        commissionPercent: input.commissionPercent ? Number(input.commissionPercent).toFixed(4) : null,
        commissionAmount: input.commissionAmount ? Number(input.commissionAmount).toFixed(2) : null,
        validFrom: input.validFrom ?? today(),
        validTo: input.validTo ?? null,
      });
      w().mandates.push(created);
      return { status: 201, body: created };
    });
  }),

  http.get("*/v1/owner/mandates/:mandateId", ({ request, params }) => {
    const ok = owner(request, "owner.mandates.get");
    if (ok instanceof Response) return ok;
    const found = mandateOf(ok, String(params.mandateId));
    return found ? json(found) : notFound("owner.mandates.get");
  }),

  http.post("*/v1/owner/mandates/:mandateId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    if (!["accept", "decline", "revoke", "end"].includes(action)) return undefined;
    const op = `owner.mandates.${action}`;
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, action === "revoke" ? "tenant.grant.manage" : "listing.read");
    if (denied) return denied;
    const found = mandateOf(ok, String(params.mandateId));
    if (!found) return notFound(op);
    const asAgency = found.agencyTenantId === ok.tenantId;
    const apply = (reason: string | null): Response | { status: number; body: unknown } => {
      if (action === "accept" || action === "decline") {
        if (!asAgency || found.state !== "invited") return problem(op, "mandate.invalid_state");
        if (action === "accept") {
          if (exclusiveConflict(found.unitId, found.exclusive, found.id))
            return problem(op, "mandate.exclusive_conflict");
          const started = found.validFrom <= today();
          Object.assign(found, {
            state: started ? "active" : "accepted",
            acceptedAt: now(),
            activatedAt: started ? now() : null,
          });
        } else Object.assign(found, { state: "ended", endedAt: now(), endReason: reason });
      } else if (action === "revoke") {
        if (asAgency || !HELD.includes(found.state)) return problem(op, "mandate.invalid_state");
        Object.assign(found, { state: "revoked", revokedAt: now(), endReason: reason });
        // The agency's listing of the unit closes in the same step (D-293 (3)).
        const unit = w().units.find((u) => u.unitId === found.unitId);
        if (unit?.listing) unit.listing.state = "closed";
      } else {
        if (found.state !== "accepted" && found.state !== "active") return problem(op, "mandate.invalid_state");
        Object.assign(found, { state: "ended", endedAt: now(), endReason: reason });
      }
      return { status: 200, body: found };
    };
    if (action === "decline") {
      const input = await body<Schemas["MandateReasonDto"]>(request);
      record(op, null, input);
      const answer = apply(input.reason ?? null);
      return answer instanceof Response ? answer : json(answer.body, answer.status);
    }
    return idempotent(request, op, (payload) => apply((payload.reason as string | null | undefined) ?? null));
  }),

  http.get("*/v1/owner/mandated-units", ({ request }) => {
    const ok = owner(request, "owner.mandatedUnits.list");
    if (ok instanceof Response) return ok;
    const data = w()
      .mandates.filter((m) => m.agencyTenantId === ok.tenantId && (m.state === "active" || m.state === "accepted"))
      .flatMap((m) => {
        const unit = w().units.find((u) => u.unitId === m.unitId);
        if (!unit) return [];
        return [
          {
            mandate: m,
            unitId: unit.unitId,
            unitNo: unit.unitNo,
            unitType: unit.unitType,
            areaSqm: unit.areaSqm,
            buildingId: unit.buildingId,
            buildingName: unit.buildingName,
            province: unit.province,
            district: unit.district,
            listing: unit.listing && unit.listing.state !== "closed" ? unit.listing : null,
          },
        ];
      });
    return json({ data } satisfies Schemas["MandatedUnitsDto"]);
  }),

  http.get("*/v1/owner/co-broke-agreements", ({ request }) => {
    const ok = owner(request, "owner.coBroke.list");
    if (ok instanceof Response) return ok;
    const stateFilter = query(request).get("state");
    const data = w().coBrokes.filter(
      (c) =>
        (c.listingAgencyTenantId === ok.tenantId || c.coAgencyTenantId === ok.tenantId) &&
        (!stateFilter || c.state === stateFilter),
    );
    return json({ data } satisfies Schemas["CoBrokesDto"]);
  }),

  http.post("*/v1/owner/co-broke-agreements", async ({ request }) => {
    const op = "owner.coBroke.propose";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "listing.manage");
    if (denied) return denied;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["CoBrokeProposeDto"];
      if (tenantType(ok.tenantId) !== "agency") return problem(op, "mandate.agency_required");
      const co = w().agencies.find((a) => a.id === input.coAgencyTenantId && a.id !== ok.tenantId);
      if (!co) return problem(op, "mandate.agency_required");
      const held = w().mandates.find((m) => m.agencyTenantId === ok.tenantId && m.state === "active");
      const unit = w().units.find(
        (u) => u.listing?.id === input.listingId && u.listing.state !== "closed" && held?.unitId === u.unitId,
      );
      if (!unit || !held) return notFound(op);
      const split = Number(input.splitPercent);
      if (!(split > 0 && split < 100))
        return problem(op, "validation.failed", {
          errors: [{ path: "splitPercent", code: "range", message: "Above 0 and below 100" }],
        });
      const created: Schemas["CoBrokeDto"] = {
        id: crypto.randomUUID(),
        listingAgencyTenantId: ok.tenantId,
        listingAgencyName: AGENCY.displayName,
        coAgencyTenantId: co.id,
        coAgencyName: co.displayName,
        contractDocumentId: null,
        listingId: input.listingId,
        listingSlug: unit.listingSlug ?? "",
        unitId: unit.unitId,
        mandateId: held.id,
        splitPercent: split.toFixed(4),
        validFrom: input.validFrom ?? today(),
        validTo: input.validTo ?? null,
        state: "proposed",
        note: input.note ?? null,
        signedAt: null,
        createdAt: now(),
      };
      w().coBrokes.push(created);
      return { status: 201, body: created };
    });
  }),

  http.get("*/v1/owner/co-broke-agreements/:agreementId", ({ request, params }) => {
    const ok = owner(request, "owner.coBroke.get");
    if (ok instanceof Response) return ok;
    const found = coBrokeOf(ok, String(params.agreementId));
    return found ? json(found) : notFound("owner.coBroke.get");
  }),

  http.post("*/v1/owner/co-broke-agreements/:agreementId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    if (!["sign", "cancel", "end"].includes(action)) return undefined;
    const op = `owner.coBroke.${action}`;
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const denied = allowed(ok, op, "listing.manage");
    if (denied) return denied;
    const found = coBrokeOf(ok, String(params.agreementId));
    if (!found) return notFound(op);
    const apply = (): Response | { status: number; body: unknown } => {
      if (action === "sign") {
        if (found.coAgencyTenantId !== ok.tenantId || found.state !== "proposed")
          return problem(op, "co_broke.invalid_state");
        Object.assign(found, { state: "signed", signedAt: now() });
      } else if (action === "cancel") {
        if (found.listingAgencyTenantId !== ok.tenantId || found.state !== "proposed")
          return problem(op, "co_broke.invalid_state");
        found.state = "cancelled";
      } else {
        if (found.state !== "signed") return problem(op, "co_broke.invalid_state");
        found.state = "ended";
      }
      return { status: 200, body: found };
    };
    if (action === "sign") return idempotent(request, op, apply);
    record(op, null, {});
    const answer = apply();
    return answer instanceof Response ? answer : json(answer.body, answer.status);
  }),

  http.get("*/v1/owner/deals", ({ request }) => {
    const ok = owner(request, "owner.deals.list");
    if (ok instanceof Response) return ok;
    const data = w()
      .deals.filter(
        (d) =>
          d.ownerTenantId === ok.tenantId ||
          d.listingAgencyTenantId === ok.tenantId ||
          d.coAgencyTenantId === ok.tenantId,
      )
      .map((d) => dealFor(d, ok.tenantId));
    return json({ data } satisfies Schemas["DealsDto"]);
  }),

  http.get("*/v1/owner/deals/:dealId", ({ request, params }) => {
    const ok = owner(request, "owner.deals.get");
    if (ok instanceof Response) return ok;
    const found = w().deals.find(
      (d) =>
        d.id === params.dealId &&
        (d.ownerTenantId === ok.tenantId ||
          d.listingAgencyTenantId === ok.tenantId ||
          d.coAgencyTenantId === ok.tenantId),
    );
    return found ? json(dealFor(found, ok.tenantId)) : notFound("owner.deals.get");
  }),
];
