import { http, type HttpHandler } from "msw";

import { BUILDINGS, meterPoints } from "../staff-world";
import { state } from "../state";
import { inWorld, operator } from "./staff";
import { json, problem } from "./support";

/*
 * CONTRACT-REQUEST — mocks of endpoints the pinned contract does not publish yet, in the requested
 * shapes of src/lib/api/pending.ts and docs/contract-requests.md. Each one is deleted the day the
 * contract adopts the endpoint (the generated base handler then answers). Not in the contract, they
 * borrow the problem documentation of the nearest staff read (`staff.devices.*`).
 */
export const contractRequestHandlers: HttpHandler[] = [
  // GET /v1/staff/buildings — the buildings of my scope (building switcher, Today).
  http.get("*/v1/staff/buildings", ({ request }) => {
    const ok = operator(request, "staff.devices.list");
    if (ok instanceof Response) return ok;
    return json({ data: inWorld(ok) ? BUILDINGS : [] });
  }),

  // GET /v1/staff/buildings/{buildingId}/meters — meter points with their open channel (installs, swaps).
  http.get("*/v1/staff/buildings/:buildingId/meters", ({ request, params }) => {
    const ok = operator(request, "staff.devices.get");
    if (ok instanceof Response) return ok;
    if (!inWorld(ok) || !BUILDINGS.some((building) => building.id === params.buildingId)) {
      return problem("staff.devices.get", "http.not_found");
    }
    return json({
      data: meterPoints(state.staff.meters, state.staff.channels, state.staff.devices, String(params.buildingId)),
    });
  }),
];
