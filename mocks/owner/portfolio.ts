import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { json, mutating, owner, problem, roleOf } from "./support";
import { portfolioTotals } from "./portfolio-world";

type Schemas = components["schemas"];

const isLandlord = (tenantId: string) =>
  Object.values(TENANTS).some((tenant) => tenant.profile.id === tenantId && tenant.profile.type === "landlord");

/** `/v1/owner/portfolio` (B7.1, D-251): the landlord's units and the one-step add, kept per tenant. */
export const portfolioHandlers: HttpHandler[] = [
  http.get("*/v1/owner/portfolio", ({ request }) => {
    const ok = owner(request, "owner.portfolio.get");
    if (ok instanceof Response) return ok;
    const units = state.portfolio[ok.tenantId] ?? [];
    return json({ units, totals: portfolioTotals(units) });
  }),

  http.post("*/v1/owner/portfolio/units", async ({ request }) => {
    const op = "owner.portfolio.addUnit";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!isLandlord(ok.tenantId) || roleOf(ok) === "staff") return problem(op, "auth.forbidden");
    const body = (await request.json().catch(() => ({}))) as Schemas["PortfolioUnitCreateDto"];
    const condo = body.kind === "condo_unit";
    const errors = [
      ...(!body.address?.line1 ? [{ path: "address.line1", code: "required", message: "required" }] : []),
      ...(!body.address?.province ? [{ path: "address.province", code: "required", message: "required" }] : []),
      ...(!/^\d{5}$/.test(body.address?.postcode ?? "")
        ? [{ path: "address.postcode", code: "pattern", message: "5 digits" }]
        : []),
      ...(condo && !body.projectName ? [{ path: "projectName", code: "required", message: "required" }] : []),
      ...(condo && !body.unitNo ? [{ path: "unitNo", code: "required", message: "required" }] : []),
    ];
    if (errors.length) return problem(op, "validation.failed", { errors });
    const projectName = body.projectName?.trim() ?? "";
    const unitNo = body.unitNo?.trim() || (condo ? "" : "1");
    // Another landlord already registered this number in the project (the persona's own condo at Ari).
    const units = (state.portfolio[ok.tenantId] ??= []);
    if (condo && units.some((unit) => unit.building.name === projectName && unit.unitNo === unitNo))
      return problem(op, "http.conflict");
    if (
      condo &&
      projectName === "ไอดีโอ โมบิ อารีย์" &&
      unitNo === "12/345" &&
      ok.tenantId !== TENANTS.landlord.profile.id
    )
      return problem(op, "portfolio.unit_claimed");

    const unitId = crypto.randomUUID();
    const buildingId = crypto.randomUUID();
    units.push({
      unitId,
      unitNo,
      kind: body.kind,
      building: { id: buildingId, name: projectName || body.address.line1, external: condo },
      address: { ...body.address },
      areaSqm: body.areaSqm ?? null,
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      floorLabel: body.floorLabel ?? null,
      furnishing: body.furnishing ?? null,
      defaultRent: body.defaultRent ?? null,
      state: "vacant",
      leaseId: null,
      leaseEndDate: null,
      invoice: null,
      openServiceRequests: 0,
      vacantSince: null,
      listing: null,
    });
    return json({ unitId, buildingId, propertyId: crypto.randomUUID(), stub: condo }, 201);
  }),
];
